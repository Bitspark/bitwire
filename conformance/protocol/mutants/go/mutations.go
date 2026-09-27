package main

import (
	"bytes"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"
)

// mutation is one deliberate violation of bitwire/1.
type mutation struct {
	// violates is the rule the implementation behind the mutant breaks.
	violates string
	// catches names the scenario files, relative to scenarios/, of which at
	// least one must fail for the mutant to count as rejected.
	catches []string
	// request changes a request before the testee sees it. A non-nil result
	// is answered as the request's ok instead of forwarding the request.
	request func(op string, req map[string]any) (answer map[string]any)
	// answer changes an answer's ok; it reports whether it changed anything.
	answer func(op string, req, ok map[string]any) bool
	// relay puts a frame relay in front of every WebSocket connection of the
	// testee, and frames makes the frame mutation for each connection.
	relay  bool
	frames func() frameFunc
}

var mutations = map[string]*mutation{
	"none": {
		violates: "nothing: every connection is relayed frame by frame and left unchanged",
		relay:    true,
		frames:   perFrame(func(direction, *frame) {}),
	},
	"ignores-its-limit": {
		violates: "a frame over the receiver's limit is refused, and the connection ended",
		catches:  []string{"seam/over-limit-refused.json", "peer/over-limit-frame-ends-with-1009.json", "peer/over-limit-frame-ends-with-1009-client.json"},
		request: func(op string, req map[string]any) map[string]any {
			switch op {
			case "conn.listen", "conn.dial", "conn.pipe":
				req["limit"] = 1 << 26
			case "peer.listen", "peer.dial", "peer.over":
				optionsOf(req, true)["max_frame_bytes"] = 1 << 26
			}
			return nil
		},
	},
	"refuses-over-limit-with-4011": {
		violates: "an over-limit frame ends the connection with 1009, not 4011 (the defect of bitruntime#21)",
		catches:  []string{"peer/over-limit-frame-ends-with-1009.json", "peer/over-limit-frame-ends-with-1009-client.json"},
		relay:    true,
		frames:   substituteClose(func(code int) (int, bool) { return 4011, code == 1009 }),
	},
	"substitutes-its-close-code": {
		violates: "a close carries the code its side chose",
		catches:  []string{"seam/close-carries-code-and-reason.json"},
		relay:    true,
		frames: substituteClose(func(code int) (int, bool) {
			if code == 1000 {
				return 1001, true
			}
			return 1000, true
		}),
	},
	"aborts-instead-of-closing": {
		violates: "a side that closes or refuses sends a close frame with its code, and a refusal reaches the other side as 4011",
		catches:  []string{"peer/malformed-frame-ends-the-connection.json", "peer/empty-method-ends-with-4011.json", "seam/close-carries-code-and-reason.json"},
		relay:    true,
		frames: func() frameFunc {
			return func(dir direction, f *frame) ([]*frame, bool) {
				if dir == out && f.opcode() == opClose {
					return nil, true
				}
				return []*frame{f}, false
			}
		},
	},
	"closes-normally-as-going-away": {
		violates: "a normal close is 1000, and the other side reports it clean; 1001 means going away",
		catches:  []string{"peer/well-formed-frame-is-served.json", "peer/request-serials-may-leave-gaps.json"},
		relay:    true,
		frames:   substituteClose(func(code int) (int, bool) { return 1001, code == 1000 }),
	},
	"delivers-binary-as-text": {
		violates: "a frame arrives with its kind; a binary frame is never an envelope",
		catches:  []string{"seam/order-and-whole.json", "peer/binary-frame-ends-the-connection-canonical.json"},
		relay:    true,
		frames: perFrame(func(dir direction, f *frame) {
			if dir == in && f.opcode() == opBinary {
				f.setOpcode(opText)
			}
		}),
	},
	"delivers-frames-twice": {
		violates: "frames arrive in order, whole and once",
		catches:  []string{"seam/order-and-whole.json"},
		relay:    true,
		frames: func() frameFunc {
			return func(dir direction, f *frame) ([]*frame, bool) {
				if dir == out && f.data() {
					twice := *f
					return []*frame{f, &twice}, false
				}
				return []*frame{f}, false
			}
		},
	},
	"accepts-non-canonical-names": {
		violates: "only a name's canonical encoding reaches the path it encodes",
		catches:  []string{"peer/only-canonical-names-reach-a-path.json"},
		relay:    true,
		frames: perFrame(func(dir direction, f *frame) {
			// Only a frame of valid text, so that nothing else in it is repaired.
			if dir != in || f.opcode() != opText || !bytes.Equal(replaceInvalidUnicode(f.payload), f.payload) {
				return
			}
			env, ok := envelope(f.payload)
			if !ok {
				return
			}
			for _, member := range []string{"method", "event"} {
				if name, ok := env[member].(string); ok {
					if p, ok := replaceString(f.payload, member, name, canonicalize(name)); ok {
						f.setPayload(p)
					}
				}
			}
		}),
	},
	"drops-meta": {
		violates: "meta travels with a request and an event",
		catches:  []string{"peer/meta-travels-with-a-call-and-an-event.json"},
		relay:    true,
		frames: perEnvelope(func(dir direction, env map[string]any) bool {
			if _, ok := env["meta"]; dir == out && ok {
				delete(env, "meta")
				return true
			}
			return false
		}),
	},
	"drops-error-data": {
		violates: "a public error reaches the caller with its code, message and data",
		catches:  []string{"peer/public-error.json"},
		relay:    true,
		frames: perEnvelope(func(dir direction, env map[string]any) bool {
			if e, ok := env["error"].(map[string]any); dir == out && ok {
				if _, has := e["data"]; has {
					delete(e, "data")
					return true
				}
			}
			return false
		}),
	},
	"drops-events": {
		violates: "an emitted event reaches the other side",
		catches:  []string{"peer/events-both-ways.json"},
		relay:    true,
		frames: func() frameFunc {
			return func(dir direction, f *frame) ([]*frame, bool) {
				if dir == out && f.opcode() == opText {
					if env, ok := envelope(f.payload); ok && env["kind"] == "event" {
						return nil, false
					}
				}
				return []*frame{f}, false
			}
		},
	},
	"replaces-invalid-unicode": {
		violates: "strings hold Unicode scalar values; a frame with an unpaired surrogate is refused",
		catches:  []string{"peer/malformed-frame-ends-the-connection.json"},
		relay:    true,
		frames: perFrame(func(dir direction, f *frame) {
			if dir == in && f.opcode() == opText {
				if p := replaceInvalidUnicode(f.payload); !bytes.Equal(p, f.payload) {
					f.setPayload(p)
				}
			}
		}),
	},
	"accepts-repeated-serials": {
		violates: "a request serial that does not increase ends the connection",
		catches:  []string{"peer/request-serials-increase-in-publication-order.json"},
		relay:    true,
		frames:   dropStaleSerials,
	},
	"ignores-cancel": {
		violates: "a caller's cancellation reaches the handler, and the call ends cancelled",
		catches:  []string{"peer/cancellation-reaches-the-handler.json"},
		request: func(op string, req map[string]any) map[string]any {
			if op == "call.cancel" {
				return map[string]any{"ok": map[string]any{}}
			}
			return nil
		},
	},
	"ignores-call-deadline": {
		violates: "a call whose deadline passes ends with request_timeout",
		catches:  []string{"peer/request-timeout.json"},
		request: func(op string, req map[string]any) map[string]any {
			if op == "peer.call" {
				delete(req, "timeout_ms")
			}
			if o := optionsOf(req, false); o != nil {
				delete(o, "request_timeout_ms")
			}
			return nil
		},
	},
	"ignores-pending-limit": {
		violates: "the call past max_pending_requests is refused busy",
		catches:  []string{"peer/outstanding-call-limit.json"},
		request: func(op string, req map[string]any) map[string]any {
			if o := optionsOf(req, false); o != nil {
				delete(o, "max_pending_requests")
			}
			return nil
		},
	},
	"ignores-subprotocols": {
		violates: "the handshake selects a subprotocol the client offered and the server accepts",
		catches:  []string{"peer/subprotocol-negotiated-at-the-handshake.json"},
		request: func(op string, req map[string]any) map[string]any {
			if op == "peer.listen" || op == "peer.dial" {
				delete(req, "subprotocols")
			}
			return nil
		},
	},
}

// substituteClose makes the testee's close frames carry another code, chosen
// by substitute, and gives the testee back its own code where the other side
// answers with the substitute. Only the other side sees the substitution, as
// it would of a peer that closed with that code.
func substituteClose(substitute func(code int) (int, bool)) func() frameFunc {
	return func() frameFunc {
		var mu sync.Mutex
		chose := map[int]int{} // a substitute sent -> the code the testee chose
		return func(dir direction, f *frame) ([]*frame, bool) {
			code := f.closeCode()
			if code == 0 {
				return []*frame{f}, false
			}
			mu.Lock()
			defer mu.Unlock()
			if dir == out {
				if to, ok := substitute(code); ok && to != code {
					chose[to] = code
					f.setCloseCode(to)
				}
			} else if from, ok := chose[code]; ok {
				f.setCloseCode(from)
			}
			return []*frame{f}, false
		}
	}
}

// perFrame makes a stateless frame mutation that changes frames in place.
func perFrame(change func(direction, *frame)) func() frameFunc {
	return func() frameFunc {
		return func(dir direction, f *frame) ([]*frame, bool) {
			change(dir, f)
			return []*frame{f}, false
		}
	}
}

// perEnvelope makes a mutation of the JSON envelopes in text frames. A frame is
// re-encoded only when change reports a change.
func perEnvelope(change func(direction, map[string]any) bool) func() frameFunc {
	return perFrame(func(dir direction, f *frame) {
		if f.opcode() != opText {
			return
		}
		if env, ok := envelope(f.payload); ok && change(dir, env) {
			f.setPayload(encode(env))
		}
	})
}

func envelope(p []byte) (map[string]any, bool) {
	env, err := decode(p)
	return env, err == nil
}

// escapedReplacement is U+FFFD as a JSON escape.
const escapedReplacement = `\` + "uFFFD"

var lengthPrefixed = regexp.MustCompile(`^0*([0-9]+):(.*)$`)

// canonicalize decodes a one-segment name leniently, the way a defective peer
// might, and returns its canonical encoding: "echo" and "04:echo" become
// "4:echo". A name of the reserved channel. vocabulary stays plain.
func canonicalize(name string) string {
	if strings.HasPrefix(name, "channel.") {
		return name
	}
	segment := name
	if m := lengthPrefixed.FindStringSubmatch(name); m != nil {
		segment = m[2]
	}
	return strconv.Itoa(len(segment)) + ":" + segment
}

// replaceInvalidUnicode replaces every escaped unpaired surrogate with
// with an escaped U+FFFD, and every invalid UTF-8 sequence with U+FFFD.
func replaceInvalidUnicode(p []byte) []byte {
	var b bytes.Buffer
	unit := func(i int) (rune, bool) {
		if i+6 > len(p) || p[i] != '\\' || p[i+1] != 'u' {
			return 0, false
		}
		v, err := strconv.ParseUint(string(p[i+2:i+6]), 16, 16)
		return rune(v), err == nil
	}
	for i := 0; i < len(p); {
		if p[i] != '\\' || i+1 >= len(p) {
			b.WriteByte(p[i])
			i++
			continue
		}
		u, ok := unit(i)
		switch {
		case !ok:
			b.Write(p[i : i+2]) // another escape, such as \\ or \"
			i += 2
		case u >= 0xD800 && u <= 0xDBFF:
			if low, ok := unit(i + 6); ok && low >= 0xDC00 && low <= 0xDFFF {
				b.Write(p[i : i+12])
				i += 12
			} else {
				b.WriteString(escapedReplacement)
				i += 6
			}
		case u >= 0xDC00 && u <= 0xDFFF:
			b.WriteString(escapedReplacement)
			i += 6
		default:
			b.Write(p[i : i+6])
			i += 6
		}
	}
	out := b.Bytes()
	if !utf8.Valid(out) {
		out = bytes.ToValidUTF8(out, []byte(string(utf8.RuneError)))
	}
	return out
}

// dropStaleSerials drops every request travelling to the testee whose serial
// does not increase, so the testee never sees one: it neither answers it nor
// ends the connection. Every other frame passes unchanged.
func dropStaleSerials() frameFunc {
	var mu sync.Mutex
	last := map[string]int64{}
	return func(dir direction, f *frame) ([]*frame, bool) {
		keep := []*frame{f}
		if dir != in || f.opcode() != opText {
			return keep, false
		}
		env, ok := envelope(f.payload)
		if !ok || env["kind"] != "request" {
			return keep, false
		}
		id, _ := env["id"].(string)
		direction, digits, found := strings.Cut(id, ":")
		n, err := strconv.ParseInt(digits, 10, 64)
		if !found || err != nil {
			return keep, false
		}
		mu.Lock()
		defer mu.Unlock()
		if previous, seen := last[direction]; seen && n <= previous {
			return nil, false
		}
		last[direction] = n
		return keep, false
	}
}

// replaceString rewrites the first member called name whose string value
// reads as old, so that it holds new, and leaves every other byte of p as it
// was. It reports whether it changed anything.
func replaceString(p []byte, name, old, new string) ([]byte, bool) {
	if old == new {
		return p, false
	}
	member := regexp.MustCompile(`"` + regexp.QuoteMeta(name) + `"\s*:\s*("(?:[^"\\]|\\.)*")`)
	for _, at := range member.FindAllSubmatchIndex(p, -1) {
		var value string
		if json.Unmarshal(p[at[2]:at[3]], &value) != nil || value != old {
			continue
		}
		quoted, _ := json.Marshal(new)
		out := append(bytes.Clone(p[:at[2]]), quoted...)
		return append(out, p[at[3]:]...), true
	}
	return p, false
}

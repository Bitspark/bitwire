package main

import (
	"bufio"
	"bytes"
	"testing"
)

func TestFrameRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		name   string
		b0     byte
		masked bool
		size   int
	}{
		{"short text", 0x81, false, 5},
		{"masked binary", 0x82, true, 7},
		{"16-bit length", 0x81, true, 300},
		{"64-bit length", 0x82, false, 70000},
		{"close", 0x88, true, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := frame{b0: tc.b0, masked: tc.masked, key: [4]byte{1, 2, 3, 4}, payload: bytes.Repeat([]byte("ab"), tc.size)[:tc.size]}
			wire := f.encode()
			h, err := readHeader(bufio.NewReader(bytes.NewReader(wire)))
			if err != nil {
				t.Fatal(err)
			}
			if h.b0 != tc.b0 || h.masked != tc.masked || h.length != uint64(tc.size) {
				t.Fatalf("header %+v", h)
			}
			// Unchanged, a frame is written with the header it arrived with.
			got := wire[len(h.raw):]
			h.payload = bytes.Clone(got)
			if tc.masked {
				for i := range h.payload {
					h.payload[i] ^= h.key[i%4]
				}
			}
			if !bytes.Equal(h.payload, f.payload) {
				t.Fatal("payload differs")
			}
			if again := h.frame.encode(); !bytes.Equal(again, wire) {
				t.Fatal("an unchanged frame is not written as it arrived")
			}
		})
	}
}

func TestCloseCode(t *testing.T) {
	f := frame{b0: 0x88, masked: true, key: [4]byte{9, 8, 7, 6}, payload: []byte{0x03, 0xF1, 'o', 'k'}}
	if f.closeCode() != 1009 {
		t.Fatalf("closeCode %d", f.closeCode())
	}
	f.setCloseCode(4011)
	h, err := readHeader(bufio.NewReader(bytes.NewReader(f.encode())))
	if err != nil || h.length != 4 {
		t.Fatal(err, h)
	}
	if f.closeCode() != 4011 || string(f.payload[2:]) != "ok" {
		t.Fatalf("%d %q", f.closeCode(), f.payload)
	}
}

func TestCanonicalize(t *testing.T) {
	for in, want := range map[string]string{
		"echo":         "4:echo",
		"4:echo":       "4:echo",
		"04:echo":      "4:echo",
		"5:echo":       "4:echo",
		"4:echox":      "5:echox",
		"":             "0:",
		"channel.open": "channel.open",
		"3:dé":         "3:dé",
	} {
		if got := canonicalize(in); got != want {
			t.Errorf("canonicalize(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDropStaleSerials(t *testing.T) {
	mutate := dropStaleSerials()
	passes := func(dir direction, s string) bool {
		emit, abort := mutate(dir, &frame{b0: 0x81, payload: []byte(s)})
		if abort {
			t.Fatal("aborted")
		}
		return len(emit) == 1 && string(emit[0].payload) == s
	}
	request := func(id string) string {
		return `{"version":1,"kind":"request","id":"` + id + `","method":"4:echo","params":{}}`
	}
	for _, step := range []struct {
		dir  direction
		text string
		pass bool
	}{
		{in, request("c:5"), true},
		{in, request("c:7"), true},
		{in, request("c:7"), false},
		{in, request("c:6"), false},
		{in, request("s:1"), true},
		{in, request("c:8"), true},
		{out, request("c:1"), true},
		{in, `{"version":1,"kind":"cancel","id":"c:1"}`, true},
	} {
		if got := passes(step.dir, step.text); got != step.pass {
			t.Errorf("%s %s: passes %v", step.dir, step.text, got)
		}
	}
}

func TestMutationsAreDeclared(t *testing.T) {
	for name, m := range mutations {
		if m.violates == "" {
			t.Errorf("%s: no rule", name)
		}
		if name != "none" && len(m.catches) == 0 {
			t.Errorf("%s: no scenario named to catch it", name)
		}
		if m.relay != (m.frames != nil) {
			t.Errorf("%s: a relay needs a frame mutation, and a frame mutation a relay", name)
		}
		if m.frames == nil && m.request == nil && m.answer == nil && name != "none" {
			t.Errorf("%s: changes nothing", name)
		}
	}
}

func TestSubstituteClose(t *testing.T) {
	mutate := substituteClose(func(code int) (int, bool) { return 4011, code == 1009 })()
	closing := func(code int) *frame {
		return &frame{b0: 0x88, payload: []byte{byte(code >> 8), byte(code)}}
	}
	emit, _ := mutate(out, closing(1009))
	if emit[0].closeCode() != 4011 {
		t.Fatalf("the testee's close is sent as %d", emit[0].closeCode())
	}
	emit, _ = mutate(in, closing(4011))
	if emit[0].closeCode() != 1009 {
		t.Fatalf("the answer reaches the testee as %d", emit[0].closeCode())
	}
	emit, _ = mutate(out, closing(1000))
	if emit[0].closeCode() != 1000 {
		t.Fatalf("an unsubstituted close is sent as %d", emit[0].closeCode())
	}
}

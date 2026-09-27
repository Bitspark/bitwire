package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func stepOf(t *testing.T, text string) Step {
	t.Helper()
	s, err := parseStep([]byte(text))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

const (
	errClosed = `{"id":ID,"error":{"code":"closed","message":"m"}}`
	okEmpty   = `{"id":ID,"ok":{}}`
)

func countOps(t *testing.T, log, op string) int {
	t.Helper()
	n := 0
	for _, r := range requests(t, log) {
		if r["op"] == op {
			n++
		}
	}
	return n
}

// §7.2 repeat: how many requests each mode sends, and which answer is judged.
func TestRepeat(t *testing.T) {
	cases := []struct {
		name     string
		answers  []string
		step     string
		requests int
		result   string
	}{
		{"until ok stops at the first ok", []string{errClosed, errClosed, okEmpty}, `{"on":"a","op":"conn.receive","repeat":{"max":5}}`, 3, Pass},
		{"until ok gives up at max", []string{errClosed, errClosed, okEmpty}, `{"on":"a","op":"conn.receive","repeat":{"max":2,"until":"ok"}}`, 2, Fail},
		{"until error stops at the first error", []string{okEmpty, okEmpty, errClosed}, `{"on":"a","op":"conn.receive","repeat":{"max":5,"until":"error"},"expect_error":{"code":"closed"}}`, 3, Pass},
		{"until match polls until the expectation holds", []string{`{"id":ID,"ok":{"n":1}}`, `{"id":ID,"ok":{"n":2}}`}, `{"on":"a","op":"conn.receive","repeat":{"max":5,"until":"match"},"expect":{"n":2}}`, 2, Pass},
		{"until match judges the last answer", []string{`{"id":ID,"ok":{"n":1}}`}, `{"on":"a","op":"conn.receive","repeat":{"max":3,"until":"match"},"expect":{"n":2}}`, 3, Fail},
		{"until match stops on an ok to an expect_error step", []string{okEmpty}, `{"on":"a","op":"conn.receive","repeat":{"max":3,"until":"match"},"expect_error":{"code":"closed"}}`, 1, Fail},
		{"until match ignores assert on an error", []string{errClosed}, `{"on":"a","op":"conn.receive","repeat":{"max":3,"until":"match"},"expect_error":{"code":"closed"},"assert":{"present":"never"}}`, 1, Fail},
		{"unsupported is re-sent under until ok, then ends the case", []string{`{"id":ID,"error":{"code":"unsupported","message":"no"}}`}, `{"on":"a","op":"conn.receive","repeat":{"max":3},"expect_error":{"code":"unsupported"}}`, 3, Unsupported},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			testee, log, err := fake(t, map[string][]string{"conn.receive": c.answers})
			if err != nil {
				t.Fatal(err)
			}
			s := Scenario{Name: c.name, Layer: "seam", Steps: []Step{stepOf(t, c.step)}}
			outcome := Run(testee, testee, map[string]Hello{"a": testee.Hello, "b": testee.Hello}, s)
			if outcome.Result != c.result {
				t.Errorf("result %s (%s), want %s", outcome.Result, outcome.Reason, c.result)
			}
			if n := countOps(t, log, "conn.receive"); n != c.requests {
				t.Errorf("%d requests, want %d", n, c.requests)
			}
		})
	}
}

// §7.2: a poll is tested on a copy of the bindings.
func TestHoldsBindsNothing(t *testing.T) {
	step := stepOf(t, `{"on":"a","op":"x.y","expect":{"a":"$bind:v","n":2}}`)
	b := Bindings{}
	if holds(step, Answer{OK: value(t, `{"a":1,"n":1}`)}, b) {
		t.Fatal("held")
	}
	if !holds(step, Answer{OK: value(t, `{"a":1,"n":2}`)}, b) {
		t.Fatal("did not hold")
	}
	if len(b) != 0 {
		t.Errorf("a poll bound %v", b)
	}
}

// §7.3 Judging an answer.
func TestJudge(t *testing.T) {
	errorAnswer := func(members string) Answer {
		m := value(t, members).(map[string]any)
		code, _ := m["code"].(string)
		message, _ := m["message"].(string)
		return Answer{Error: &AnswerError{Code: code, Message: message, Members: m}}
	}
	cases := []struct {
		name, step string
		answer     Answer
		result     string
		bound      string
	}{
		{"unsupported comes first", `{"on":"a","op":"x.y","expect_error":{"code":"unsupported"}}`, errorAnswer(`{"code":"unsupported"}`), Unsupported, ``},
		{"an error with no expect_error fails", `{"on":"a","op":"x.y"}`, errorAnswer(`{"code":"closed"}`), Fail, ``},
		{"an error that differs fails", `{"on":"a","op":"x.y","expect_error":{"code":"failed"}}`, errorAnswer(`{"code":"closed"}`), Fail, ``},
		{"an expected error binds through $bind, not bind", `{"on":"a","op":"x.y","expect_error":{"code":"closed","close_code":"$bind:c"},"bind":"whole"}`, errorAnswer(`{"code":"closed","close_code":1000}`), "", `{"c":1000}`},
		{"ok to an expect_error step fails", `{"on":"a","op":"x.y","expect_error":{"code":"closed"}}`, Answer{OK: value(t, `{}`)}, Fail, ``},
		{"ok with both is held to expect", `{"on":"a","op":"x.y","expect":{"n":1},"expect_error":{"code":"closed"}}`, Answer{OK: value(t, `{"n":1}`)}, "", ``},
		{"an error with both is held to expect_error", `{"on":"a","op":"x.y","expect":{"n":1},"expect_error":{"code":"closed"}}`, errorAnswer(`{"code":"closed"}`), "", ``},
		{"expect null is present", `{"on":"a","op":"x.y","expect":null}`, Answer{OK: value(t, `{}`)}, Fail, ``},
		{"ok with neither holds and binds", `{"on":"a","op":"x.y","bind":"h"}`, Answer{OK: value(t, `{"handle":"c7"}`)}, "", `{"h":"c7"}`},
		{"bind overwrites $bind of the same name", `{"on":"a","op":"x.y","expect":{"handle":"$bind:h","url":"$bind:u"},"bind":{"url":"h"}}`, Answer{OK: value(t, `{"handle":"c7","url":"u1"}`)}, "", `{"h":"u1","u":"u1"}`},
		{"assert absent fails", `{"on":"a","op":"x.y","assert":{"absent":"\"stalled\":true"}}`, Answer{OK: value(t, `{"stalled": true}`)}, Fail, ``},
		{"assert present holds", `{"on":"a","op":"x.y","assert":{"present":"\"stalled\":false"}}`, Answer{OK: value(t, `{"stalled": false}`)}, "", ``},
		{"assert is held against an error too", `{"on":"a","op":"x.y","expect_error":{"code":"closed"},"assert":{"absent":"secret"}}`, errorAnswer(`{"code":"closed","message":"secret"}`), Fail, ``},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			b := Bindings{}
			outcome, done := judge(stepOf(t, c.step), c.answer, b, "fake")
			if (c.result == "") == done || (done && outcome.Result != c.result) {
				t.Fatalf("done %v, result %s (%s); want %q", done, outcome.Result, outcome.Reason, c.result)
			}
			if c.bound != "" && !equal(map[string]any(b), value(t, c.bound)) {
				t.Errorf("bound %s, want %s", render(map[string]any(b)), c.bound)
			}
		})
	}
}

// §7.1 end to end: expansion, reset of each side, substitution through the
// runner's bindings, and the order of requests.
func TestRunCase(t *testing.T) {
	testee, log, err := fake(t, map[string][]string{
		"conn.listen": {`{"id":ID,"ok":{"handle":"l1","url":"ws://x"}}`},
		"conn.dial":   {`{"id":ID,"ok":{"handle":"c1"}}`},
		"conn.accept": {`{"id":ID,"ok":{"handle":"c2"}}`},
		"conn.send":   {okEmpty},
	})
	if err != nil {
		t.Fatal(err)
	}
	s := Scenario{Name: "e2e", Layer: "seam", Steps: []Step{
		stepOf(t, `{"on":"runner","op":"pair.conns","args":{"limit_a":1024,"consume_b":"lazy"},"bind":{"a":"ca","b":"cb"}}`),
		stepOf(t, `{"on":"b","op":"conn.send","args":{"on":"$cb","kind":"text","text":"$$x"}}`),
	}}
	outcome := Run(testee, testee, map[string]Hello{"a": testee.Hello, "b": testee.Hello}, s)
	if outcome.Result != Pass {
		t.Fatalf("%s: %s", outcome.Result, outcome.Reason)
	}
	var ops []string
	for _, r := range requests(t, log)[1:] {
		ops = append(ops, r["op"].(string))
	}
	if got := strings.Join(ops, " "); got != "reset reset conn.listen conn.dial conn.accept conn.send" {
		t.Fatalf("requests: %s", got)
	}
	sent := requests(t, log)
	listen, dial, accept, send := sent[3], sent[4], sent[5], sent[6]
	if render(listen["limit"]) != "1024" || dial["url"] != "ws://x" || dial["consume"] != "lazy" || accept["on"] != "l1" {
		t.Errorf("expansion: %v %v %v", listen, dial, accept)
	}
	if send["on"] != "c1" || send["text"] != "$x" {
		t.Errorf("substitution: %v", send)
	}
}

func TestRunOutcomes(t *testing.T) {
	cases := []struct {
		name   string
		script map[string][]string
		steps  []string
		result string
		reason string
	}{
		{"an unbound argument fails", nil, []string{`{"on":"a","op":"conn.send","args":{"on":"$nothing"}}`}, Fail, "unbound"},
		{"a lacking need is unsupported", nil, []string{`{"on":"a","op":"conn.pipe"}`}, "", ""},
		{"a dead testee is a harness failure", map[string][]string{"conn.send": {"EXIT"}}, []string{`{"on":"a","op":"conn.send","args":{"on":"c"}}`}, Harness, "stdout"},
		{"a failed reset is a harness failure", map[string][]string{"reset": {okEmpty, `{"id":ID,"error":{"code":"internal"}}`}}, []string{`{"on":"a","op":"conn.send"}`}, Harness, "did not reset"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			testee, _, err := fake(t, c.script)
			if err != nil {
				t.Fatal(err)
			}
			var steps []Step
			for _, s := range c.steps {
				steps = append(steps, stepOf(t, s))
			}
			hello := testee.Hello
			if c.result == "" {
				hello = hello.without("pipe")
				c.result, c.reason = Unsupported, "lacks pipe"
			}
			// The first reset of this process succeeds even where the
			// script refuses the second.
			outcome := Run(testee, testee, map[string]Hello{"a": hello, "b": hello}, Scenario{Name: c.name, Layer: "seam", Steps: steps})
			if outcome.Result != c.result || !strings.Contains(outcome.Reason, c.reason) {
				t.Fatalf("%s: %s; want %s naming %q", outcome.Result, outcome.Reason, c.result, c.reason)
			}
		})
	}
}

func hellos(a, b []string) map[string]Hello {
	return map[string]Hello{
		"a": {Driver: 1, Layers: []string{"seam", "peer"}, Features: a},
		"b": {Driver: 1, Layers: []string{"seam", "peer"}, Features: b},
	}
}

func summary(steps []Step) string {
	var parts []string
	for _, s := range steps {
		parts = append(parts, s.On+":"+s.Op+" "+render(s.Args)+" -> "+render(s.Bind))
	}
	return strings.Join(parts, "\n")
}

// §4.1 Runner ops: each branch of each expansion.
func TestExpansion(t *testing.T) {
	cases := []struct {
		name, step string
		a, b       []string
		want       string
		refusal    string
	}{
		{"pair.conns, a listens", `{"on":"runner","op":"pair.conns","args":{"limit_a":10,"limit_b":"$x","consume_a":"lazy","consume_b":""},"bind":{"a":"ca"}}`, []string{"listen"}, []string{"listen"},
			`a:conn.listen {"limit":10} -> {"handle":"_p1_l","url":"_p1_url"}
b:conn.dial {"url":"$_p1_url"} -> "_p1_cb"
a:conn.accept {"consume":"lazy","on":"$_p1_l"} -> "ca"`, ""},
		{"pair.conns, only b listens", `{"on":"runner","op":"pair.conns","args":{"limit_a":10},"bind":{"a":"ca","b":"cb"}}`, nil, []string{"listen"},
			`b:conn.listen {} -> {"handle":"_p1_l","url":"_p1_url"}
a:conn.dial {"limit":10,"url":"$_p1_url"} -> "ca"
b:conn.accept {"on":"$_p1_l"} -> "cb"`, ""},
		{"pair.conns, neither listens", `{"on":"runner","op":"pair.conns"}`, nil, nil, "", "neither testee can listen"},
		{"pair.peers, the server listens", `{"on":"runner","op":"pair.peers","args":{"server":"b","server_options":{"max_frame_bytes":64}},"bind":{"client":"pc"}}`, nil, []string{"listen"},
			`b:peer.listen {"options":{"max_frame_bytes":64}} -> {"handle":"_p1_l","url":"_p1_url"}
a:peer.dial {"url":"$_p1_url"} -> "pc"
b:peer.accept {"on":"$_p1_l"} -> "_p1_ps"`, ""},
		{"pair.peers, only the client listens", `{"on":"runner","op":"pair.peers","args":{"server":"a","server_options":{"max_frame_bytes":64},"client_options":{"max_frame_bytes":32}}}`, []string{"lazy"}, []string{"listen", "lazy"},
			`b:conn.listen {"limit":32} -> {"handle":"_p1_l","url":"_p1_url"}
a:conn.dial {"consume":"lazy","limit":64,"url":"$_p1_url"} -> "_p1_ca"
b:conn.accept {"consume":"lazy","on":"$_p1_l"} -> "_p1_cb"
b:peer.over {"on":"$_p1_cb","options":{"max_frame_bytes":32},"role":"client"} -> "_p1_pc"
a:peer.over {"on":"$_p1_ca","options":{"max_frame_bytes":64},"role":"server"} -> "_p1_ps"`, ""},
		{"pair.peers, lazy lacking", `{"on":"runner","op":"pair.peers","args":{"server":"a"}}`, nil, []string{"listen", "lazy"}, "", "lazy"},
		{"pair.peers, neither listens", `{"on":"runner","op":"pair.peers","args":{"server":"a"}}`, []string{"lazy"}, []string{"lazy"}, "", "neither testee can listen"},
		{"pair.peer_and_conn, a listening server", `{"on":"runner","op":"pair.peer_and_conn","args":{"peer":"a","role":"server","limit":8,"consume":"lazy"},"bind":{"peer":"p","conn":"c"}}`, []string{"listen"}, nil,
			`a:peer.listen {} -> {"handle":"_p1_l","url":"_p1_url"}
b:conn.dial {"consume":"lazy","limit":8,"url":"$_p1_url"} -> "c"
a:peer.accept {"on":"$_p1_l"} -> "p"`, ""},
		{"pair.peer_and_conn, a listening client", `{"on":"runner","op":"pair.peer_and_conn","args":{"peer":"a","role":"client","options":{"max_frame_bytes":16}}}`, []string{"listen", "lazy"}, nil,
			`a:conn.listen {"limit":16} -> {"handle":"_p1_l","url":"_p1_url"}
b:conn.dial {"url":"$_p1_url"} -> "_p1_cb"
a:conn.accept {"consume":"lazy","on":"$_p1_l"} -> "_p1_ca"
a:peer.over {"on":"$_p1_ca","options":{"max_frame_bytes":16},"role":"client"} -> "_p1_p"`, ""},
		{"pair.peer_and_conn, a listening client without lazy", `{"on":"runner","op":"pair.peer_and_conn","args":{"peer":"a","role":"client"}}`, []string{"listen"}, nil, "", "lazy"},
		{"pair.peer_and_conn, the raw side listens", `{"on":"runner","op":"pair.peer_and_conn","args":{"peer":"a","role":"server","limit":8,"consume":"eager"}}`, []string{"lazy"}, []string{"listen"},
			`b:conn.listen {"limit":8} -> {"handle":"_p1_l","url":"_p1_url"}
a:conn.dial {"consume":"lazy","url":"$_p1_url"} -> "_p1_ca"
b:conn.accept {"consume":"eager","on":"$_p1_l"} -> "_p1_cb"
a:peer.over {"on":"$_p1_ca","role":"server"} -> "_p1_p"`, ""},
		{"pair.peer_and_conn, neither listens", `{"on":"runner","op":"pair.peer_and_conn","args":{"peer":"a","role":"server"}}`, []string{"lazy"}, nil, "", "neither testee can listen"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			steps, refusal := expand([]Step{stepOf(t, c.step)}, hellos(c.a, c.b))
			if c.refusal != "" {
				if !strings.Contains(refusal, c.refusal) {
					t.Fatalf("refusal %q, want %q", refusal, c.refusal)
				}
				return
			}
			if refusal != "" {
				t.Fatal(refusal)
			}
			if got := summary(steps); got != c.want {
				t.Fatalf("expanded:\n%s\nwant:\n%s", got, c.want)
			}
		})
	}
	// N counts runner ops from 1.
	steps, _ := expand([]Step{stepOf(t, `{"on":"runner","op":"pair.conns"}`), stepOf(t, `{"on":"a","op":"conn.send"}`), stepOf(t, `{"on":"runner","op":"pair.conns"}`)}, hellos([]string{"listen"}, nil))
	if steps[4].Op != "conn.listen" || render(steps[4].Bind) != `{"handle":"_p2_l","url":"_p2_url"}` {
		t.Errorf("the second runner op: %s", summary(steps))
	}
}

// §5.4 needs, and §5.8 mirroring.
func TestNeedsAndMirror(t *testing.T) {
	steps := []Step{
		stepOf(t, `{"on":"runner","op":"pair.peers","args":{"server":"b","server_options":{"propagate":true}}}`),
		stepOf(t, `{"on":"a","op":"conn.dial","args":{"consume":"lazy"}}`),
		stepOf(t, `{"on":"b","op":"tunnel.over"}`),
	}
	needs := sideNeeds(steps)
	if strings.Join(needs["a"], " ") != "lazy peer seam" || strings.Join(needs["b"], " ") != "peer propagator tunnel" {
		t.Fatalf("needs %v", needs)
	}
	s := Scenario{Name: "m", Layer: "tunnel", Steps: []Step{
		stepOf(t, `{"on":"runner","op":"pair.conns","args":{"limit_a":1,"consume_b":"lazy","other":"x"},"bind":{"a":"ca","b":"cb"}}`),
		stepOf(t, `{"on":"runner","op":"pair.peers","args":{"server":"a"}}`),
		stepOf(t, `{"on":"a","op":"conn.send","args":{"on":"$ca","limit_a":"kept"}}`),
	}}
	m := s.Mirrored()
	if m.Name != "m (mirrored)" {
		t.Errorf("name %q", m.Name)
	}
	if got := render(m.Steps[0].Args); got != `{"consume_a":"lazy","limit_b":1,"other":"x"}` {
		t.Errorf("runner args %s", got)
	}
	if got := render(m.Steps[0].Bind); got != `{"a":"cb","b":"ca"}` {
		t.Errorf("pair.conns bind %s", got)
	}
	if m.Steps[1].Args["server"] != "b" || m.Steps[2].On != "b" || m.Steps[2].Args["limit_a"] != "kept" {
		t.Errorf("mirrored %s", summary(m.Steps))
	}
	if s.Steps[2].On != "a" {
		t.Error("mirroring changed the original")
	}
}

func yes() *bool { v := true; return &v }
func no() *bool  { v := false; return &v }

// §8.2 applicability, §8.1 required cases and §8.4 the claim rule.
func TestClaim(t *testing.T) {
	c := &Config{Scope: "core", Implementation: "x", Implementations: map[string]Implementation{"x": {Listen: no()}, "y": {Listen: yes()}}, Pairings: [][2]string{{"x", "y"}, {"y", "x"}}}
	listenOnA := Scenario{Layer: "seam", Scope: "core", Steps: []Step{stepOf(t, `{"on":"a","op":"conn.listen"}`)}}
	if reason := inapplicable(c, listenOnA, [2]string{"x", "y"}, Transport{Name: "ws"}); !strings.Contains(reason, "does not accept connections") {
		t.Errorf("a listen on the implementation's side: %q", reason)
	}
	if reason := inapplicable(c, listenOnA, [2]string{"y", "x"}, Transport{Name: "ws"}); reason != "" {
		t.Errorf("a listen on the counterpart's side: %q", reason)
	}
	subprotocols := Scenario{Layer: "peer", Scope: "core", Steps: []Step{stepOf(t, `{"on":"a","op":"peer.dial","args":{"subprotocols":["v1"]}}`)}}
	if reason := inapplicable(c, subprotocols, [2]string{"y", "x"}, Transport{Name: "pipe"}); !strings.Contains(reason, "subprotocols") {
		t.Errorf("subprotocols: %q", reason)
	}
	if reason := inapplicable(c, subprotocols, [2]string{"y", "x"}, Transport{Name: "ws", Subprotocols: true}); reason != "" {
		t.Errorf("subprotocols on a transport that negotiates: %q", reason)
	}

	if required("core", Scenario{Scope: "tunnel"}) || !required("core and tunnel", Scenario{Scope: "tunnel"}) || required("core and tunnel", Scenario{Scope: "core", Optional: "defect"}) {
		t.Error("required")
	}
	if skipReason(c, Scenario{Scope: "tunnel"}, [2]string{"x", "y"}, Transport{}, nil, nil) == "" {
		t.Error("a tunnel case under a core claim runs")
	}
	if skipReason(c, Scenario{Scope: "core", Optional: "observer"}, [2]string{"x", "y"}, Transport{}, map[string]bool{"observer": true}, nil) != "" {
		t.Error("a requested diagnostic is skipped")
	}

	pass := reportCase{Required: true, Result: Pass}
	limited := reportCase{Required: true, Result: Skip, Applicability: "the ws transport cannot negotiate subprotocols"}
	optionalFail := reportCase{Required: false, Result: Fail}
	for _, tc := range []struct {
		name     string
		pairings [][2]string
		cases    []reportCase
		result   string
	}{
		{"all required pass", c.Pairings, []reportCase{pass, optionalFail}, "supported"},
		{"a named limitation", c.Pairings, []reportCase{pass, limited}, "supported"},
		{"a fail", c.Pairings, []reportCase{pass, {Required: true, Result: Fail}}, "not supported"},
		{"unsupported", c.Pairings, []reportCase{{Required: true, Result: Unsupported}}, "not supported"},
		{"a skip for another reason", c.Pairings, []reportCase{{Required: true, Result: Skip, Reason: "not selected for this run"}}, "not supported"},
		{"a harness failure", c.Pairings, []reportCase{{Required: true, Result: Harness}}, "not supported"},
		{"only side a", [][2]string{{"x", "y"}}, []reportCase{pass}, "not supported"},
		{"no pairing", nil, nil, "not supported"},
		{"with itself", [][2]string{{"x", "x"}}, []reportCase{pass}, "supported"},
	} {
		cfg := *c
		cfg.Pairings = tc.pairings
		got := claim(&cfg, tc.cases)
		if got.Result != tc.result {
			t.Errorf("%s: %s %v", tc.name, got.Result, got.Reasons)
		}
		if tc.name == "a named limitation" && (len(got.Limitations) != 1 || got.Counts[Skip] != 1) {
			t.Errorf("limitations %v, counts %v", got.Limitations, got.Counts)
		}
	}
}

// §7.5: a step with an integer within_ms waits within_ms plus the grace.
func TestWithinDeadline(t *testing.T) {
	saved := grace
	grace = 300 * time.Millisecond
	defer func() { grace = saved }()
	testee, _, err := fake(t, map[string][]string{"conn.receive": {"HANG"}})
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	outcome := Run(testee, testee, map[string]Hello{"a": testee.Hello, "b": testee.Hello}, Scenario{Name: "w", Layer: "seam", Steps: []Step{stepOf(t, `{"on":"a","op":"conn.receive","args":{"within_ms":200}}`)}})
	elapsed := time.Since(start)
	if outcome.Result != Harness || !strings.Contains(outcome.Reason, "within 500ms") {
		t.Fatalf("%s: %s", outcome.Result, outcome.Reason)
	}
	if elapsed > 5*time.Second {
		t.Errorf("the deadline took %s", elapsed)
	}
	if outcome.Failure == nil || outcome.Failure.Step == nil || *outcome.Failure.Step != 0 || outcome.Failure.Expansion != nil {
		t.Errorf("failure %+v", outcome.Failure)
	}
}

// A failure inside a runner op's expansion names the scenario's step and
// the position within the expansion.
func TestFailureLocation(t *testing.T) {
	testee, _, err := fake(t, map[string][]string{
		"conn.pipe":   {`{"id":ID,"ok":{"a":"p1","b":"p2"}}`},
		"conn.listen": {`{"id":ID,"ok":{"handle":"l1","url":"ws://x"}}`},
		"conn.dial":   {`{"id":ID,"error":{"code":"failed","message":"refused"}}`},
	})
	if err != nil {
		t.Fatal(err)
	}
	s := Scenario{Name: "f", Layer: "seam", Steps: []Step{stepOf(t, `{"on":"a","op":"conn.pipe","args":{}}`), stepOf(t, `{"on":"runner","op":"pair.conns"}`)}}
	outcome := Run(testee, testee, map[string]Hello{"a": testee.Hello, "b": testee.Hello}, s)
	f := outcome.Failure
	if outcome.Result != Fail || f == nil || f.Step == nil || *f.Step != 1 || f.Expansion == nil || *f.Expansion != 1 || f.Op != "conn.dial" {
		t.Fatalf("%s %s %+v", outcome.Result, outcome.Reason, f)
	}
}

func TestReadConfig(t *testing.T) {
	dir := t.TempDir()
	write := func(text string) string {
		file := filepath.Join(dir, "run.json")
		if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
		return file
	}
	good := `{"scope":"core","implementation":"x","implementations":{"x":{"name":"x","listen":false,"testee":{"argv":["{config}/testee{exe}"],"cwd":"sub","env":{"HOME_DIR":"{checkout}"}}},"y":{"name":"y","testee":{"argv":["y"]}}},"pairings":[["x","y"],["y","x"]],"transports":[{"name":"websocket","subprotocols":true}]}`
	c, err := ReadConfig(write(good))
	if err != nil {
		t.Fatal(err)
	}
	command := c.command(c.Implementations["x"], "/checkout")
	if !strings.HasPrefix(command.Argv[0], c.dir) || command.Cwd != filepath.Join(c.dir, "sub") || command.Env["HOME_DIR"] != "/checkout" {
		t.Errorf("command %+v", command)
	}
	for name, bad := range map[string]string{
		"an unknown member":      strings.Replace(good, `"scope":"core"`, `"scope":"core","extra":1`, 1),
		"a scope":                strings.Replace(good, `"scope":"core"`, `"scope":"tunnel"`, 1),
		"no transport":           strings.Replace(good, `[{"name":"websocket","subprotocols":true}]`, `[]`, 1),
		"an unknown pairing":     strings.Replace(good, `["y","x"]`, `["z","x"]`, 1),
		"a counterpart's listen": strings.Replace(good, `"y":{"name":"y",`, `"y":{"name":"y","listen":true,`, 1),
		"an optional kind":       strings.Replace(good, `"scope":"core"`, `"scope":"core","optional":["all"]`, 1),
	} {
		if _, err := ReadConfig(write(bad)); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}

package main

import (
	"strings"
	"testing"
)

// These tests hold the runner to the examples CONTRACT.md gives, section by
// section. The contract is released only once a runner passes them (§1).

func value(t *testing.T, text string) any {
	t.Helper()
	v, err := decode([]byte(text))
	if err != nil {
		t.Fatalf("%s: %v", text, err)
	}
	return v
}

func bindings(t *testing.T, text string) Bindings {
	t.Helper()
	b := Bindings{}
	if text == "" {
		return b
	}
	for k, v := range value(t, text).(map[string]any) {
		b[k] = v
	}
	return b
}

// §5.6 Argument substitution.
func TestSubstitutionExamples(t *testing.T) {
	cases := []struct{ args, bound, sent, err string }{
		{`{"on": "$pb"}`, `{"pb": "peer3"}`, `{"on":"peer3"}`, ""},
		{`{"text": "$row.frame"}`, `{"row": {"frame": "{\"a\":1}"}}`, `{"text":"{\"a\":1}"}`, ""},
		{`{"n": "$row.n"}`, `{"row": {"n": 1e3}}`, `{"n":1e3}`, ""},
		{`{"literal": "$$dollar"}`, ``, `{"literal":"$dollar"}`, ""},
		{`{"on": "$nothing"}`, ``, ``, "$nothing refers to nothing bound"},
		{`{"deep": [{"x": "$v"}, "plain", 7]}`, `{"v": [true, null]}`, `{"deep":[{"x":[true,null]},"plain",7]}`, ""},
		{`{"$v": "member names are never substituted"}`, `{"v": 1}`, `{"$v":"member names are never substituted"}`, ""},
		{`{"any": "$any"}`, `{"any": "a binding named any"}`, `{"any":"a binding named any"}`, ""},
		{`{"part": "x$v"}`, `{"v": 1}`, `{"part":"x$v"}`, ""},
	}
	for _, c := range cases {
		got, err := substitute(value(t, c.args), bindings(t, c.bound))
		if c.err != "" {
			if err == nil || !strings.Contains(err.Error(), c.err) {
				t.Errorf("%s: expected %q, got %v", c.args, c.err, err)
			}
			continue
		}
		if err != nil || render(got) != c.sent {
			t.Errorf("%s: sent %s (%v), want %s", c.args, render(got), err, c.sent)
		}
	}
}

type matchCase struct {
	expected, actual, bound string
	holds                   bool
}

func runMatches(t *testing.T, cases []matchCase) {
	t.Helper()
	for _, c := range cases {
		err := match(value(t, c.expected), value(t, c.actual), bindings(t, c.bound))
		if (err == nil) != c.holds {
			t.Errorf("%s against %s (bound %s): holds %v, want %v (%v)", c.expected, c.actual, c.bound, err == nil, c.holds, err)
		}
	}
}

// §6.2 Literals.
func TestLiteralExamples(t *testing.T) {
	runMatches(t, []matchCase{
		{`{"n": 1000}`, `{"n": 1e3}`, ``, true},
		{`{"a": null}`, `{"a": 0}`, ``, false},
		{`"text"`, `"text"`, ``, true},
		{`"text"`, `"Text"`, ``, false},
		{`true`, `true`, ``, true},
		{`false`, `0`, ``, false},
		{`1`, `1.0`, ``, true},
		{`9007199254740993`, `9007199254740992`, ``, true},
		{`1e400`, `1e400`, ``, true},
		{`1e400`, `2e400`, ``, false},
		{`1e400`, `1E400`, ``, false},
		{`0`, `-0`, ``, true},
		{`"1"`, `1`, ``, false},
	})
}

// §6.3 Objects.
func TestObjectExamples(t *testing.T) {
	runMatches(t, []matchCase{
		{`{"a": 1, "b": "x"}`, `{"a": 1, "b": "x", "c": true}`, ``, true},
		{`{"a": 1}`, `{}`, ``, false},
		{`{"a": "$absent"}`, `{"b": 1}`, ``, true},
		{`{"a": "$absent"}`, `{"a": null}`, ``, false},
		{`{"a": null}`, `{}`, ``, false},
		{`{"a": "$absent:x"}`, `{}`, ``, false},
		{`"$absent"`, `1`, ``, false},
		{`["$absent"]`, `[1]`, ``, false},
		{`{}`, `[]`, ``, false},
	})
}

// §6.4 Arrays.
func TestArrayExamples(t *testing.T) {
	runMatches(t, []matchCase{
		{`[1, "two", null]`, `[1, "two", null]`, ``, true},
		{`[1]`, `[1, 2]`, ``, false},
		{`[]`, `[]`, ``, true},
		{`[1, 2]`, `[2, 1]`, ``, false},
	})
}

// §6.5 Placeholders.
func TestPlaceholderExamples(t *testing.T) {
	runMatches(t, []matchCase{
		{`{"a": "$any"}`, `{"a": [1, 2]}`, ``, true},
		{`{"a": "$any"}`, `{"a": null}`, ``, true},
		{`{"a": "$any"}`, `{}`, ``, false},
		{`{"a": "$any:ignored"}`, `{"a": 1}`, ``, true},
		{`{"a": "$string"}`, `{"a": "s"}`, ``, true},
		{`{"a": "$string"}`, `{"a": 1}`, ``, false},
		{`{"a": "$int"}`, `{"a": 7}`, ``, true},
		{`{"a": "$int"}`, `{"a": 7.5}`, ``, false},
		{`{"a": "$int"}`, `{"a": 1e3}`, ``, false},
		{`{"a": "$int"}`, `{"a": 1.0}`, ``, false},
		{`{"a": "$int"}`, `{"a": 9223372036854775808}`, ``, false},
		{`{"a": "$int"}`, `{"a": -9223372036854775808}`, ``, true},
		{`{"a": "$number"}`, `{"a": 7.5}`, ``, true},
		{`{"a": "$number"}`, `{"a": "7"}`, ``, false},
		{`"$odd"`, `3`, ``, true},
		{`"$odd"`, `4`, ``, false},
		{`"$even"`, `-2`, ``, true},
		{`"$even"`, `2.0`, ``, false},
		{`{"a": "$bool"}`, `{"a": false}`, ``, true},
		{`{"a": "$bool"}`, `{"a": null}`, ``, false},
		{`{"a": "$not:first"}`, `{"a": "c:2"}`, `{"first": "c:1"}`, true},
		{`{"a": "$not:first"}`, `{"a": "c:1"}`, `{"first": "c:1"}`, false},
		{`{"a": "$not:first"}`, `{"a": "c:2"}`, ``, false},
		{`{"a": "$not:row.id"}`, `{"a": "c:2"}`, `{"row": {"id": "c:1"}}`, false},
		{`{"a": "$regex:^c:[0-9]+$"}`, `{"a": "c:12"}`, ``, true},
		{`{"a": "$regex:^c:[0-9]+$"}`, `{"a": "c:1x"}`, ``, false},
		{`{"a": "$regex:b"}`, `{"a": "abc"}`, ``, true},
		{`{"a": "$regex:("}`, `{"a": "("}`, ``, false},
		{`{"a": "$regex:x"}`, `{"a": 1}`, ``, false},
		{`{"parent": "$t"}`, `{"parent": "abc"}`, `{"t": "abc"}`, true},
		{`{"parent": "$t"}`, `{"parent": "abd"}`, `{"t": "abc"}`, false},
		{`{"parent": "$t"}`, `{"parent": "abc"}`, ``, false},
		{`{"a": "$row.n"}`, `{"a": 1000}`, `{"row": {"n": 1e3}}`, true},
		{`{"a": "$o"}`, `{"a": {"x": 1, "y": 2}}`, `{"o": {"x": 1}}`, false},
		{`{"a": "$any"}`, `{"a": 1}`, `{"any": 2}`, true},
		{`{"a": "$bind:"}`, `{"a": 1}`, ``, false},
	})
}

// §6.5 $bind binds and replaces; §6.7 order within one expectation.
func TestBindingExamples(t *testing.T) {
	b := Bindings{}
	if err := match(value(t, `{"id": "$bind:first"}`), value(t, `{"id": "c:1"}`), b); err != nil || !equal(b["first"], "c:1") {
		t.Fatalf("$bind:first: %v, %v", err, b)
	}
	if err := match(value(t, `{"id": "$bind:first"}`), value(t, `{"id": "c:2"}`), b); err != nil || !equal(b["first"], "c:2") {
		t.Fatalf("$bind replaces: %v, %v", err, b)
	}
	if err := match(value(t, `{"a": "$bind:x", "b": "$x"}`), value(t, `{"a": 5, "b": 5}`), Bindings{}); err != nil {
		t.Errorf("a binding made earlier in byte order is visible: %v", err)
	}
	if err := match(value(t, `{"b": "$bind:x", "a": "$x"}`), value(t, `{"a": 5, "b": 5}`), Bindings{}); err == nil {
		t.Errorf("a binding made later in byte order must not be visible")
	}
}

// §6.7 Value equality refuses extra members; where equality treats a
// missing member as null.
func TestValueEquality(t *testing.T) {
	for _, c := range []struct {
		a, b  string
		equal bool
	}{
		{`{"x": 1}`, `{"x": 1.0}`, true},
		{`{"x": 1}`, `{"x": 1, "y": 2}`, false},
		{`[1, [2]]`, `[1, [2]]`, true},
		{`[1]`, `[1, 1]`, false},
		{`null`, `null`, true},
		{`"a"`, `"a"`, true},
		{`true`, `1`, false},
	} {
		if got := equal(value(t, c.a), value(t, c.b)); got != c.equal {
			t.Errorf("equal(%s, %s) = %v", c.a, c.b, got)
		}
	}
}

// §6.6 Subsequences.
func TestContainsExamples(t *testing.T) {
	runMatches(t, []matchCase{
		{`{"$contains": [{"k": "a"}, {"k": "c"}]}`, `[{"k": "a"}, {"k": "b"}, {"k": "c"}]`, ``, true},
		{`{"$contains": [{"k": "c"}, {"k": "a"}]}`, `[{"k": "a"}, {"k": "b"}, {"k": "c"}]`, ``, false},
		{`{"$contains": [{"id": "1", "s": 1}, {"id": "2", "s": 1}, {"id": "1", "s": 2}], "$sequence_by": "id"}`,
			`[{"id": "2", "s": 1}, {"id": "1", "s": 1}, {"id": "1", "s": 2}]`, ``, true},
		{`{"$contains": [{"id": "1", "s": 2}, {"id": "1", "s": 1}], "$sequence_by": "id"}`,
			`[{"id": "1", "s": 1}, {"id": "1", "s": 2}]`, ``, false},
		{`{"$contains": [{"id": 1}], "$sequence_by": "id"}`, `[{"id": 1.0}]`, ``, false},
		{`{"$contains": [{"id": "$any"}], "$sequence_by": "id"}`, `[{"id": "1"}]`, ``, false},
		{`{"$contains": [{"k": 1}, {"k": 1}]}`, `[{"k": 1}]`, ``, false},
		{`{"$contains": []}`, `[]`, ``, true},
		{`{"$contains": [1], "ignored": "member"}`, `[0, 1]`, ``, true},
		{`{"$contains": [1]}`, `{"not": "an array"}`, ``, false},
		{`{"$contains": "not an array"}`, `[]`, ``, false},
	})
	// A $bind while trying an element that then fails is not undone.
	b := Bindings{}
	if err := match(value(t, `{"$contains": [{"v": "$bind:x", "k": "b"}]}`), value(t, `[{"k": "a", "v": 1}, {"k": "b", "v": 2}]`), b); err != nil {
		t.Fatal(err)
	}
	if !equal(b["x"], value(t, `2`)) {
		t.Errorf("the element taken binds last: x = %s", render(b["x"]))
	}
	b = Bindings{}
	_ = match(value(t, `{"$contains": [{"k": "z", "v": "$bind:x"}]}`), value(t, `[{"k": "a", "v": 1}]`), b)
	if _, bound := b["x"]; bound {
		t.Errorf("byte order holds k before v, so no failed candidate reaches v")
	}
	b = Bindings{}
	_ = match(value(t, `{"$contains": [{"a": "$bind:x", "k": "z"}]}`), value(t, `[{"a": 1, "k": "a"}]`), b)
	if !equal(b["x"], value(t, `1`)) {
		t.Errorf("a failed candidate's $bind is kept: x = %s", render(b["x"]))
	}
}

// §7.3 render and assert.
func TestRenderExamples(t *testing.T) {
	for _, c := range []struct{ in, out string }{
		{`{"b": 1, "a": [true, null]}`, `{"a":[true,null],"b":1}`},
		{`{"n": 1e3}`, `{"n":1e3}`},
		{`"<&>"`, `"\u003c\u0026\u003e"`},
		{`"\u2028\u2029"`, `"\u2028\u2029"`},
		{`"\b\f\n\r\t\u0001"`, `"\b\f\n\r\t\u0001"`},
		{`"\ud800"`, `"` + "�" + `"`},
		{`"quote \" and \\"`, `"quote \" and \\"`},
	} {
		if got := render(value(t, c.in)); got != c.out {
			t.Errorf("render(%s) = %s, want %s", c.in, got, c.out)
		}
	}
	step := Step{Assert: map[string]any{"absent": `"stalled":true`}}
	if reason := assertHolds(step, Answer{OK: value(t, `{"stalled" :  true}`)}); reason == "" {
		t.Errorf("assert searches the rendering, whatever the spacing")
	}
	step = Step{Assert: map[string]any{"present": `error {"code":"closed"`}}
	if reason := assertHolds(step, Answer{Error: &AnswerError{Code: "closed", Members: value(t, `{"code": "closed", "message": "m"}`).(map[string]any)}}); reason != "" {
		t.Errorf("an error answer renders as error and its object: %s", reason)
	}
}

// §7.4 bind.
func TestBindExamples(t *testing.T) {
	b := Bindings{}
	if err := bind("c", value(t, `{"handle": "h1", "url": "u"}`), b); err != nil || !equal(b["c"], "h1") {
		t.Errorf("a name binds the handle: %v %v", err, b)
	}
	if err := bind("v", value(t, `[1, 2]`), b); err != nil || render(b["v"]) != `[1,2]` {
		t.Errorf("a name binds a whole array: %v %v", err, b)
	}
	if err := bind("w", value(t, `{"url": "u"}`), b); err != nil || render(b["w"]) != `{"url":"u"}` {
		t.Errorf("a name binds an object without handle whole: %v %v", err, b)
	}
	if err := bind(value(t, `{"url": "u", "handle": "h"}`), value(t, `{"handle": null, "url": "x"}`), b); err != nil || b["h"] != nil || !equal(b["u"], "x") {
		t.Errorf("members bind by name, null counting as present: %v %v", err, b)
	}
	if err := bind(value(t, `{"missing": "m"}`), value(t, `{"handle": 1}`), b); err == nil {
		t.Errorf("a missing member fails the step")
	}
	if err := bind(value(t, `{"x": "m"}`), value(t, `3`), b); err == nil {
		t.Errorf("members of a scalar fail the step")
	}
}

func TestDecodeRefusesTrailingData(t *testing.T) {
	for _, text := range []string{`{} x`, `{}]`, `{}{}`, `1 2`} {
		if _, err := decode([]byte(text)); err == nil {
			t.Errorf("%q decoded", text)
		}
	}
	for _, text := range []string{`{} `, "{}\r", "{}\t\n"} {
		if _, err := decode([]byte(text)); err != nil {
			t.Errorf("%q: %v", text, err)
		}
	}
}

// §6.1: the runner reports where the values parted.
func TestMismatchLocation(t *testing.T) {
	err := match(value(t, `{"events": [{"n": 1}, {"n": 1}]}`), value(t, `{"events": [{"n": 1}, {"n": 2}]}`), Bindings{})
	if err == nil || err.Error() != "the answer.events[1].n: expected 1, got 2" {
		t.Fatalf("%v", err)
	}
}

// §6.8 Embedded JSON.
func TestJSONExamples(t *testing.T) {
	runMatches(t, []matchCase{
		{`{"$json": {"kind": "response", "id": "c:1"}}`, `"{\"id\":\"c:1\",\"kind\":\"response\",\"result\":{}}"`, ``, true},
		{`{"$json": {"kind": "response"}}`, `"{\"kind\":\"request\"}"`, ``, false},
		{`{"$json": {"traceparent": "$string"}}`, `"{\"result\":{\"traceparent\":\"x\"}}"`, ``, false},
		{`{"$json": "$any"}`, `"not json"`, ``, false},
		{`{"$json": "$any"}`, `5`, ``, false},
		{`{"$json": 1, "$contains": [1]}`, `"1"`, ``, false},
		{`{"$json": {"a": 1}}`, `"{\"a\":1} x"`, ``, false},
		{`{"$json": {"a": 1000}}`, `"{\"a\":1e3}"`, ``, true},
	})
	b := Bindings{}
	if err := match(value(t, `{"$json": {"id": "$bind:id"}}`), value(t, `"{\"id\":\"c:7\"}"`), b); err != nil || !equal(b["id"], "c:7") {
		t.Errorf("$json binds: %v %v", err, b)
	}
}

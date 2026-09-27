package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// The five result kinds (CONTRACT.md §8.3).
const (
	Pass        = "pass"
	Fail        = "fail"
	Unsupported = "unsupported"
	Skip        = "skip"
	Harness     = "harness"
)

// Outcome is how one case went.
type Outcome struct {
	Result string
	Reason string
	// Failure is set for fail and harness results that reached a step.
	Failure *Failure
}

// Failure is where a case parted from its scenario (§9).
type Failure struct {
	Step    *int           `json:"step,omitempty"`
	Op      string         `json:"op,omitempty"`
	On      string         `json:"on,omitempty"`
	Request map[string]any `json:"request,omitempty"`
	Answer  string         `json:"answer,omitempty"`
	StderrA string         `json:"stderrA"`
	StderrB string         `json:"stderrB"`
}

// pollPause and pollDeadline are the pause between polls of a step repeated
// until it matches, and the runner's deadline for each poll after the first
// (§7.2, §7.5).
var (
	pollPause    = 50 * time.Millisecond
	pollDeadline = 15 * time.Second
	stepDeadline = 15 * time.Second
	grace        = 10 * time.Second
)

// Run drives one case: a scenario, as written or mirrored, between the
// testees on sides a and b, whose hello the runner may have narrowed (§7.1).
func Run(a, b *Testee, hello map[string]Hello, s Scenario) Outcome {
	steps, reason := expand(s.Steps, hello)
	if reason != "" {
		return Outcome{Result: Unsupported, Reason: "the pair cannot be arranged: " + reason}
	}
	for _, side := range []string{"a", "b"} {
		for _, need := range sideNeeds(steps)[side] {
			if !hello[side].Has(need) {
				name := a.Name
				if side == "b" {
					name = b.Name
				}
				return Outcome{Result: Unsupported, Reason: fmt.Sprintf("the %s testee, on side %s, lacks %s", name, side, need)}
			}
		}
	}
	harness := func(step int, request map[string]any, err error) Outcome {
		f := &Failure{Request: request, StderrA: a.Stderr(), StderrB: b.Stderr()}
		if step >= 0 {
			f.Step, f.Op, f.On = &step, steps[step].Op, steps[step].On
		}
		return Outcome{Result: Harness, Reason: err.Error(), Failure: f}
	}
	for _, t := range []*Testee{a, b} {
		if err := t.Reset(); err != nil {
			return harness(-1, nil, err)
		}
	}
	bindings := Bindings{}
	if s.Row != nil {
		bindings[s.RowAs] = s.Row
	}
	for i, step := range steps {
		testee := a
		if step.On == "b" {
			testee = b
		}
		fail := func(request map[string]any, answer, reason string) Outcome {
			return Outcome{Result: Fail, Reason: reason, Failure: &Failure{
				Step: &i, Op: step.Op, On: step.On, Request: request, Answer: answer,
				StderrA: a.Stderr(), StderrB: b.Stderr(),
			}}
		}
		substituted, err := substitute(step.Args, bindings)
		if err != nil {
			return fail(step.Args, "", "the arguments refer to something unbound: "+err.Error())
		}
		args, _ := substituted.(map[string]any)
		if args == nil {
			args = map[string]any{}
		}
		answer, err := send(testee, step, args, bindings)
		if err != nil {
			return harness(i, args, err)
		}
		if outcome, done := judge(step, answer, bindings, testee.Name); done {
			outcome.Failure = &Failure{Step: &i, Op: step.Op, On: step.On, Request: args, Answer: answer.rendered(), StderrA: a.Stderr(), StderrB: b.Stderr()}
			if outcome.Result == Unsupported {
				outcome.Failure = nil
			}
			return outcome
		}
	}
	return Outcome{Result: Pass}
}

// send sends a step's op, again as its repeat says, and returns the last
// answer (§7.2). A dead testee is the error.
func send(t *Testee, step Step, args map[string]any, bindings Bindings) (Answer, error) {
	within := stepDeadline
	if w, ok := args["within_ms"].(json.Number); ok {
		if ms, err := w.Int64(); err == nil {
			within = time.Duration(ms)*time.Millisecond + grace
		}
	}
	answer, err := t.Request(step.Op, args, within)
	if err != nil || step.Repeat == nil {
		return answer, err
	}
	until := step.Repeat.Until
	if until == "" {
		until = "ok"
	}
	for n := 1; n < step.Repeat.Max; n++ {
		switch until {
		case "ok":
			if answer.Error == nil {
				return answer, nil
			}
		case "error":
			if answer.Error != nil {
				return answer, nil
			}
		case "match":
			if holds(step, answer, bindings) {
				return answer, nil
			}
			time.Sleep(pollPause)
			within = pollDeadline
		}
		if answer, err = t.Request(step.Op, args, within); err != nil {
			return answer, err
		}
	}
	return answer, nil
}

// holds reports whether a step's expectations hold for an answer, on a copy
// of the bindings so that a failed poll binds nothing (§7.2).
func holds(step Step, answer Answer, bound Bindings) bool {
	b := bound.clone()
	if answer.Error != nil {
		return step.ExpectError != nil && match(step.ExpectError, answer.Error.Members, b) == nil
	}
	if step.HasExpect && match(step.Expect, answer.OK, b) != nil {
		return false
	}
	return assertHolds(step, answer) == ""
}

// judge holds the last answer to its step (§7.3). It reports the outcome
// and true when the case ends at this step.
func judge(step Step, answer Answer, b Bindings, testee string) (Outcome, bool) {
	if answer.Error != nil {
		if answer.Error.Code == "unsupported" {
			return Outcome{Result: Unsupported, Reason: fmt.Sprintf("the %s testee does not support %s: %s", testee, step.Op, answer.Error.Message)}, true
		}
		if step.ExpectError == nil {
			return Outcome{Result: Fail, Reason: "the op failed: " + answer.Error.Error()}, true
		}
		if err := match(step.ExpectError, answer.Error.Members, b); err != nil {
			return Outcome{Result: Fail, Reason: "the error is not the one expected: " + strings.TrimPrefix(err.Error(), "the answer")}, true
		}
	} else {
		if step.ExpectError != nil && !step.HasExpect {
			return Outcome{Result: Fail, Reason: "expected an error " + render(step.ExpectError) + ", the op succeeded"}, true
		}
		if step.HasExpect {
			if err := match(step.Expect, answer.OK, b); err != nil {
				return Outcome{Result: Fail, Reason: err.Error() + "; expected " + render(step.Expect)}, true
			}
		}
		if err := bind(step.Bind, answer.OK, b); err != nil {
			return Outcome{Result: Fail, Reason: err.Error()}, true
		}
	}
	if reason := assertHolds(step, answer); reason != "" {
		return Outcome{Result: Fail, Reason: reason}, true
	}
	return Outcome{}, false
}

// assertHolds holds a step's assert against the answer's rendering, and
// says why it fails, or "".
func assertHolds(step Step, answer Answer) string {
	if step.Assert == nil {
		return ""
	}
	rendered := answer.rendered()
	if needle, ok := step.Assert["absent"].(string); ok && strings.Contains(rendered, needle) {
		return fmt.Sprintf("%q appears in the answer and must not", needle)
	}
	if needle, ok := step.Assert["present"].(string); ok && !strings.Contains(rendered, needle) {
		return fmt.Sprintf("%q does not appear in the answer and must", needle)
	}
	return ""
}

// bind applies a step's bind to an ok answer (§7.4).
func bind(spec any, ok any, b Bindings) error {
	switch v := spec.(type) {
	case nil:
		return nil
	case string:
		if object, isObject := ok.(map[string]any); isObject {
			if handle, has := object["handle"]; has {
				b[v] = handle
				return nil
			}
		}
		b[v] = ok
	case map[string]any:
		object, isObject := ok.(map[string]any)
		if !isObject {
			return fmt.Errorf("bind names members of an answer that is %s", render(ok))
		}
		for member, name := range v {
			value, has := object[member]
			if !has {
				return fmt.Errorf("bind names %s, which the answer lacks: %s", member, render(ok))
			}
			b[name.(string)] = value
		}
	}
	return nil
}

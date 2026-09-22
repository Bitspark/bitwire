// Records public profile lifecycle observations. Expectations are read only by
// Bitwire's runner; this driver has no replacement ledger or routing machinery.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"

	wire "github.com/Bitspark/bitwire/wire/go"
	ns "github.com/Bitspark/nightseam/runtime/go"
)

type step struct{ Op, ID, Label string }
type testCase struct {
	ID     string
	Limits ns.InvocationLimits
	Steps  []step
}
type sending func([]string, wire.Message) error

func (f sending) Send(path []string, message wire.Message) error { return f(path, message) }

func observe(test testCase) []any {
	retirements := 0
	controls := []string{}
	newInvocation := func() *ns.Invocation {
		return ns.NewInvocation(test.Limits, func() { retirements++ })
	}
	invocation := newInvocation()
	// An opaque send-only facade: participants cannot discover the Invocation.
	facade := func(v *ns.Invocation) wire.Wire { return sending(v.Deliver) }
	access := facade(invocation)
	var previous wire.Wire
	rows := []any{}
	cancel := wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileCancel, ID: "c:1"}}
	for _, action := range test.Steps {
		message := wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent, Data: json.RawMessage("null")}}
		var err error
		switch action.Op {
		case "snapshot":
			ordered := slices.Clone(controls)
			slices.Sort(ordered)
			rows = append(rows, map[string]any{"label": action.Label, "retired": invocation.Retired(), "retirements": retirements, "controls": ordered})
			continue
		case "replace":
			previous = access
			invocation = newInvocation()
			access = facade(invocation)
		case "settle":
			invocation.Settle()
		case "dispatchDone":
			invocation.DispatchDone()
		case "cancel":
			err = access.Send([]string{"invocation.control"}, cancel)
		case "oldCancel":
			if previous == nil {
				panic("oldCancel without a previous invocation")
			}
			err = previous.Send([]string{"invocation.control"}, cancel)
		case "unknown":
			err = access.Send([]string{"unsupported.operation", "participant"}, message)
		case "wrongKind":
			err = access.Send([]string{"invocation.capture", "participant"}, cancel)
		case "missingSink":
			err = access.Send([]string{"invocation.capture", "participant"}, message)
		case "capture", "ready", "release", "begin", "done":
			if action.Op == "capture" {
				message.Return = &wire.ReturnAddress{Wire: sending(func(path []string, control wire.Message) error {
					if len(path) != 0 || control.Frame.Kind != wire.ProfileCancel {
						panic("invalid control delivery")
					}
					controls = append(controls, action.ID+":"+control.Frame.ID)
					return nil
				})}
			}
			err = access.Send([]string{"invocation." + action.Op, action.ID}, message)
		default:
			panic("unknown fixture operation: " + action.Op)
		}
		if action.Label != "" {
			rows = append(rows, map[string]any{"label": action.Label, "admitted": err == nil})
		} else if err != nil {
			panic(fmt.Sprintf("%s/%s: %v", test.ID, action.Op, err))
		}
	}
	return rows
}

func main() {
	if len(os.Args) != 2 {
		panic("expected the input-only fixture path")
	}
	data, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	var fixture struct{ Cases []testCase }
	if err := json.Unmarshal(data, &fixture); err != nil {
		panic(err)
	}
	rows := []any{}
	for _, test := range fixture.Cases {
		rows = append(rows, map[string]any{"id": test.ID, "observations": observe(test)})
	}
	if err := json.NewEncoder(os.Stdout).Encode(rows); err != nil {
		panic(err)
	}
}

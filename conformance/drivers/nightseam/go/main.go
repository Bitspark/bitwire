// This executable records observations through the public Nightseam runtime.
// It does not contain a replacement Wire implementation or expected results.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync/atomic"
	"time"

	"github.com/Bitspark/nightseam/duplex/go"
	ns "github.com/Bitspark/nightseam/runtime/go"
)

type registration struct {
	ID        string   `json:"id"`
	Path      []string `json:"path"`
	Namespace bool     `json:"namespace"`
	Result    any      `json:"result"`
}
type testCase struct {
	ID              string                        `json:"id"`
	Kind            string                        `json:"kind"`
	Prefix          []string                      `json:"prefix"`
	Selections      [][]string                    `json:"selections"`
	MountKey        *string                       `json:"mountKey"`
	Path            []string                      `json:"path"`
	Payload         any                           `json:"payload"`
	Registrations   []registration                `json:"registrations"`
	Calls           []struct{ Path []string }     `json:"calls"`
	Duplicate       struct{ Registration string } `json:"duplicate"`
	ProfileRefusals [][]string                    `json:"profileRefusals"`
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
func pair() (duplex.Wire, duplex.Wire) {
	a, b, err := ns.NewWirePair(ns.Options{})
	check(err)
	return a, b
}
func call(wire duplex.Wire, path []string, value any) any {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var result any
	check(ns.CallWire(ctx, wire, path, value, &result))
	return result
}
func reply(message duplex.Message, value any) {
	if message.Frame.Kind != duplex.ProfileRequest || message.Return == nil {
		panic("expected a request with return access")
	}
	encoded, err := json.Marshal(value)
	check(err)
	check(message.Return.Wire.Send(nil, duplex.Message{Frame: duplex.ProfileFrame{
		Version: 1, Kind: duplex.ProfileResponse, ID: message.Frame.ID, Result: encoded,
	}}))
}
func echo(_ []string, message duplex.Message) { reply(message, message.Frame.Params) }
func closeWire(wire duplex.Wire)              { check(wire.Close(duplex.CodeNormal, "conformance complete")) }
func event() duplex.Message {
	return duplex.Message{Frame: duplex.ProfileFrame{Version: 1, Kind: duplex.ProfileEvent, Data: json.RawMessage("null")}}
}
func copyPath(path []string) []string { return append([]string{}, path...) }

// Every operation is delegated. The spies observe the boundary before/after
// composition, without implementing routing, dispatch or return correlation.
type observer struct {
	duplex.Wire
	send    func([]string, duplex.Message)
	receive func([]string, duplex.Message)
}

func (w observer) Send(path []string, message duplex.Message) error {
	if w.send != nil {
		w.send(path, message)
	}
	return w.Wire.Send(path, message)
}
func (w observer) Receive(path []string, receiver duplex.Receiver) (func(), error) {
	return w.Wire.Receive(path, duplex.Receiver{Namespace: receiver.Namespace, Closed: receiver.Closed,
		Message: func(path []string, message duplex.Message) {
			if w.receive != nil {
				w.receive(path, message)
			}
			if receiver.Message != nil {
				receiver.Message(path, message)
			}
		},
	})
}

func access(test testCase) any {
	client, server := pair()
	defer closeWire(client)
	var originalReturn, rootReturn, admittedReturn, receivedReturn *duplex.ReturnAddress
	var rootPath, receiverPath []string
	clientSpy := observer{Wire: client, send: func(path []string, m duplex.Message) {
		rootPath, rootReturn = copyPath(path), m.Return
	}}
	serverSpy := observer{Wire: server, receive: func(_ []string, m duplex.Message) { admittedReturn = m.Return }}
	selected := duplex.At(clientSpy, test.Prefix)
	if test.MountKey != nil {
		mounted := duplex.Mount(map[string]duplex.Wire{*test.MountKey: selected})
		defer closeWire(mounted)
		selected = duplex.At(mounted, []string{*test.MountKey})
	}
	prefix := copyPath(test.Prefix)
	for _, part := range test.Selections {
		selected = duplex.At(selected, part)
		prefix = append(prefix, part...)
	}
	outer := observer{Wire: selected, send: func(_ []string, m duplex.Message) { originalReturn = m.Return }}
	receiver := duplex.At(serverSpy, prefix)
	_, err := receiver.Receive(test.Path, duplex.Receiver{Message: func(path []string, message duplex.Message) {
		receiverPath, receivedReturn = copyPath(path), message.Return
		echo(path, message)
	}})
	check(err)
	value := call(outer, test.Path, test.Payload)
	return map[string]any{"rootPath": rootPath, "receiverPath": receiverPath, "payload": value,
		"sendReturnIdentity":    originalReturn != nil && originalReturn == rootReturn,
		"receiveReturnIdentity": admittedReturn != nil && admittedReturn == receivedReturn}
}

func routing(test testCase) any {
	client, server := pair()
	defer closeWire(client)
	var duplicate registration
	for _, entry := range test.Registrations {
		if entry.ID == test.Duplicate.Registration {
			duplicate = entry
		}
		_, err := server.Receive(entry.Path, duplex.Receiver{Namespace: entry.Namespace, Message: func(path []string, message duplex.Message) {
			reply(message, map[string]any{"result": entry.Result, "receiverPath": copyPath(path), "receiver": entry.ID})
		}})
		check(err)
	}
	if duplicate.ID == "" {
		panic("duplicate target does not name a registration")
	}
	detach, err := server.Receive(duplicate.Path, duplex.Receiver{Namespace: duplicate.Namespace, Message: echo})
	refused := err != nil
	if detach != nil {
		detach()
	}
	results := []any{}
	for _, entry := range test.Calls {
		results = append(results, call(client, entry.Path, nil))
	}
	observations := map[string]any{"calls": results, "duplicateRefused": refused}
	if test.ProfileRefusals != nil {
		refusals := []any{}
		for _, path := range test.ProfileRefusals {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			var result any
			err := ns.CallWire(ctx, client, path, nil, &result)
			cancel()
			var unpublished *ns.UnpublishedError
			refusals = append(refusals, map[string]any{"path": copyPath(path), "refused": errors.As(err, &unpublished)})
		}
		observations["requestRefusals"] = refusals
	}
	return observations
}

func lifetime(test testCase) any {
	client, server := pair()
	defer closeWire(client)
	mounted := duplex.Mount(map[string]duplex.Wire{"leaf": client})
	defer closeWire(mounted)
	var mountCloseCount, detachCloseCount atomic.Int32
	detach, err := server.Receive(test.Path, duplex.Receiver{Message: echo, Closed: func(duplex.Code, string) { detachCloseCount.Add(1) }})
	check(err)
	selected := duplex.At(mounted, []string{"leaf"})
	before := call(selected, test.Path, test.Payload)
	detach()
	detach()
	detachAgain, err := server.Receive(test.Path, duplex.Receiver{Message: echo})
	check(err)
	afterDetach := call(selected, test.Path, test.Payload)
	_, err = mounted.Receive(nil, duplex.Receiver{Namespace: true, Message: func([]string, duplex.Message) {}, Closed: func(duplex.Code, string) { mountCloseCount.Add(1) }})
	check(err)
	mountOriginRefused := mounted.Send(nil, event()) != nil
	closeWire(mounted)
	closeWire(mounted)
	// The former namespace must be free again on the borrowed endpoint.
	detachNamespace, err := client.Receive(nil, duplex.Receiver{Namespace: true, Message: func([]string, duplex.Message) {}})
	mountRegistrationReleased := err == nil
	if detachNamespace != nil {
		detachNamespace()
	}
	afterMountClose := call(client, test.Path, test.Payload)
	detachAgain()
	ended := make(chan struct{})
	_, err = server.Receive(test.Path, duplex.Receiver{Message: echo, Closed: func(duplex.Code, string) { close(ended) }})
	check(err)
	closeWire(duplex.At(client, nil))
	select {
	case <-ended:
	case <-time.After(5 * time.Second):
		panic("selected close did not notify endpoint receiver")
	}
	selectedCloseRefused := client.Send(test.Path, event()) != nil
	return map[string]any{"before": before, "afterDetach": afterDetach, "afterMountClose": afterMountClose,
		"selectedCloseRefused": selectedCloseRefused, "mountOriginRefused": mountOriginRefused,
		"mountCloseCount": mountCloseCount.Load(), "detachCloseCount": detachCloseCount.Load(),
		"mountRegistrationReleased": mountRegistrationReleased}
}

func forwarding(test testCase) any {
	caller, inbound := pair()
	outbound, server := pair()
	defer closeWire(caller)
	defer closeWire(outbound)
	var inboundReturn, outboundReturn *duplex.ReturnAddress
	a := observer{Wire: inbound, receive: func(_ []string, m duplex.Message) { inboundReturn = m.Return }}
	b := observer{Wire: outbound, send: func(_ []string, m duplex.Message) { outboundReturn = m.Return }}
	detach, err := ns.ForwardWire(a, b)
	check(err)
	defer detach()
	_, err = server.Receive(test.Path, duplex.Receiver{Message: echo})
	check(err)
	forwarded := call(caller, test.Path, test.Payload)
	identity := inboundReturn != nil && inboundReturn == outboundReturn
	detach()
	detach()
	_, err = inbound.Receive(test.Path, duplex.Receiver{Message: echo})
	check(err)
	inboundAfterDetach := call(caller, test.Path, test.Payload)
	outboundAfterDetach := call(outbound, test.Path, test.Payload)
	return map[string]any{"forwarded": forwarded, "forwardReturnIdentity": identity,
		"inboundAfterDetach": inboundAfterDetach, "outboundAfterDetach": outboundAfterDetach}
}

func main() {
	if len(os.Args) != 2 {
		panic("usage: driver <cases.json>")
	}
	data, err := os.ReadFile(os.Args[1])
	check(err)
	var fixture struct {
		SchemaVersion int        `json:"schemaVersion"`
		Cases         []testCase `json:"cases"`
	}
	check(json.Unmarshal(data, &fixture))
	if fixture.SchemaVersion != 1 || len(fixture.Cases) == 0 {
		panic("unsupported or empty fixture")
	}
	results := []any{}
	for _, test := range fixture.Cases {
		var result any
		switch test.Kind {
		case "access":
			result = access(test)
		case "routing":
			result = routing(test)
		case "lifetime":
			result = lifetime(test)
		case "forwarding":
			result = forwarding(test)
		default:
			panic(fmt.Sprintf("unknown case kind %q", test.Kind))
		}
		results = append(results, map[string]any{"id": test.ID, "observations": result})
	}
	check(json.NewEncoder(os.Stdout).Encode(results))
}

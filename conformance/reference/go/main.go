// This executable is a test-only composition reference, not a shipped runtime.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"

	wire "github.com/Bitspark/bitwire/wire/go"
)

type scheduler struct{ tasks []func() }

func (s *scheduler) drain() {
	for len(s.tasks) > 0 {
		task := s.tasks[0]
		s.tasks = s.tasks[1:]
		task()
	}
}

type endpoint struct {
	s        *scheduler
	peer     *endpoint
	receiver *wire.Receiver
	ended    bool
}

var _ wire.Endpoint = (*endpoint)(nil)

func pair(s *scheduler) (*endpoint, *endpoint) {
	a, b := &endpoint{s: s}, &endpoint{s: s}
	a.peer = b
	b.peer = a
	return a, b
}
func (e *endpoint) Send(path []string, message wire.Message) error {
	if e.ended || e.peer.ended {
		return errors.New("closed")
	}
	segments := append([]string{}, path...)
	e.s.tasks = append(e.s.tasks, func() {
		if r := e.peer.receiver; r != nil && r.Message != nil {
			r.Message(segments, message)
		}
	})
	return nil
}
func (e *endpoint) Receive(receiver wire.Receiver) (func(), error) {
	if e.ended {
		return nil, errors.New("closed")
	}
	if e.receiver != nil {
		return nil, errors.New("receive attachment already owned")
	}
	e.receiver = &receiver
	detached := false
	return func() {
		if detached {
			return
		}
		detached = true
		if e.receiver == &receiver {
			e.receiver = nil
		}
	}, nil
}
func (e *endpoint) Close(code wire.Code, reason string) error {
	if e.ended {
		return nil
	}
	e.ended = true
	r := e.receiver
	e.receiver = nil
	e.s.tasks = append(e.s.tasks, func() {
		if r != nil && r.Closed != nil {
			r.Closed(code, reason)
		}
	})
	return nil
}

type sender func([]string, wire.Message) error

func (s sender) Send(path []string, message wire.Message) error { return s(path, message) }
func at(w wire.AddressedWire, prefix []string) wire.AddressedWire {
	origin := append([]string{}, prefix...)
	return sender(func(path []string, message wire.Message) error {
		return w.Send(append(append([]string{}, origin...), path...), message)
	})
}
func mount(children map[string]wire.AddressedWire) wire.AddressedWire {
	return sender(func(path []string, message wire.Message) error {
		if len(path) == 0 || children[path[0]] == nil {
			return errors.New("no mounted destination")
		}
		return children[path[0]].Send(path[1:], message)
	})
}
func prefixOf(prefix, path []string) bool {
	if len(prefix) > len(path) {
		return false
	}
	for i, part := range prefix {
		if part != path[i] {
			return false
		}
	}
	return true
}

type route struct {
	prefix   []string
	receiver wire.Receiver
}

// Explicit optional policy, not a AddressedWire requirement: unique prefixes, longest
// prefix wins, suffix-relative callback paths. One router owns Receive.
type router struct {
	routes     map[string]*route
	detachRoot func()
	root       wire.Endpoint
	views      []*selectedEndpoint
	ended      bool
}

func newRouter(e wire.Endpoint) *router {
	r := &router{routes: map[string]*route{}, root: e}
	detach, err := e.Receive(wire.Receiver{Message: func(path []string, message wire.Message) {
		var selected *route
		for _, candidate := range r.routes {
			if prefixOf(candidate.prefix, path) && (selected == nil || len(candidate.prefix) > len(selected.prefix)) {
				selected = candidate
			}
		}
		if selected != nil && selected.receiver.Message != nil {
			selected.receiver.Message(path[len(selected.prefix):], message)
		}
	}, Closed: r.finish})
	must(err)
	r.detachRoot = detach
	return r
}
func (r *router) bind(prefix []string, receiver wire.Receiver) (func(), error) {
	if r.ended {
		return nil, errors.New("dispatcher ended")
	}
	keyBytes, err := json.Marshal(append([]string{}, prefix...))
	must(err)
	key := string(keyBytes)
	if r.routes[key] != nil {
		return nil, errors.New("duplicate prefix")
	}
	entry := &route{append([]string{}, prefix...), receiver}
	r.routes[key] = entry
	detached := false
	return func() {
		if detached {
			return
		}
		detached = true
		if r.routes[key] == entry {
			delete(r.routes, key)
		}
	}, nil
}
func (r *router) selectView(prefix []string) *selectedEndpoint {
	v := &selectedEndpoint{router: r, prefix: append([]string{}, prefix...), access: at(r.root, prefix)}
	r.views = append(r.views, v)
	return v
}
func (r *router) finish(code wire.Code, reason string) {
	if r.ended {
		return
	}
	r.ended = true
	for _, view := range r.views {
		must(view.Close(code, reason))
	}
	clear(r.routes)
}
func (r *router) detach() { r.detachRoot(); r.finish(0, "dispatcher detached") }

// Nested receiving views share one dispatcher; each owns only its attachment
// and route, never the borrowed root's closure.
type selectedAttachment struct {
	receiver    wire.Receiver
	detachRoute func()
}
type selectedEndpoint struct {
	router     *router
	prefix     []string
	access     wire.AddressedWire
	attachment *selectedAttachment
	ended      bool
}

var _ wire.Endpoint = (*selectedEndpoint)(nil)

func (v *selectedEndpoint) selectView(suffix []string) *selectedEndpoint {
	return v.router.selectView(append(append([]string{}, v.prefix...), suffix...))
}
func (v *selectedEndpoint) Send(path []string, message wire.Message) error {
	if v.ended || v.router.ended {
		return errors.New("view closed")
	}
	return v.access.Send(path, message)
}
func (v *selectedEndpoint) Receive(receiver wire.Receiver) (func(), error) {
	if v.ended || v.router.ended {
		return nil, errors.New("view closed")
	}
	if v.attachment != nil {
		return nil, errors.New("view receive attachment already owned")
	}
	detach, err := v.router.bind(v.prefix, receiver)
	if err != nil {
		return nil, err
	}
	attachment := &selectedAttachment{receiver: receiver, detachRoute: detach}
	v.attachment = attachment
	return func() {
		attachment.detachRoute()
		if v.attachment == attachment {
			v.attachment = nil
		}
	}, nil
}
func (v *selectedEndpoint) Close(code wire.Code, reason string) error {
	if v.ended {
		return nil
	}
	v.ended = true
	attachment := v.attachment
	v.attachment = nil
	if attachment != nil {
		attachment.detachRoute()
		if attachment.receiver.Closed != nil {
			attachment.receiver.Closed(code, reason)
		}
	}
	return nil
}
func must(err error) {
	if err != nil {
		panic(err)
	}
}
func bind(r *router, path []string, receive func([]string, wire.Message)) func() {
	detach, err := r.bind(path, wire.Receiver{Message: receive})
	must(err)
	return detach
}

func main() {
	s := &scheduler{}
	event := wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent, Data: json.RawMessage("null")}}
	client, server := pair(s)
	r := newRouter(server)
	deliveries := []string{}
	detachA := bind(r, []string{"a"}, func(path []string, _ wire.Message) { deliveries = append(deliveries, "a:"+strings.Join(path, "/")) })
	bind(r, []string{"b"}, func(path []string, _ wire.Message) { deliveries = append(deliveries, "b:"+strings.Join(path, "/")) })
	_, duplicateErr := server.Receive(wire.Receiver{})
	must(at(client, []string{"a"}).Send([]string{"run"}, event))
	must(at(client, []string{"b"}).Send([]string{"run"}, event))
	receiverRanDuringSend := len(deliveries) != 0
	s.drain()
	detachA()
	detachA()
	must(at(client, []string{"a"}).Send([]string{"ignored"}, event))
	must(at(client, []string{"b"}).Send([]string{"after-detach"}, event))
	s.drain()
	r.detach()
	attachmentReusable := false
	replacement, err := server.Receive(wire.Receiver{Message: func([]string, wire.Message) { attachmentReusable = true }})
	must(err)
	r.detach()
	must(client.Send([]string{"replacement"}, event))
	s.drain()
	replacement()

	overlapClient, overlapServer := pair(s)
	overlapRouter := newRouter(overlapServer)
	overlapDeliveries := []string{}
	bind(overlapRouter, []string{"a"}, func(path []string, _ wire.Message) {
		overlapDeliveries = append(overlapDeliveries, "parent:"+strings.Join(path, "/"))
	})
	detachDeep := bind(overlapRouter, []string{"a", "b"}, func(path []string, _ wire.Message) {
		overlapDeliveries = append(overlapDeliveries, "deep:"+strings.Join(path, "/"))
	})
	_, duplicateRouteErr := overlapRouter.bind([]string{"a"}, wire.Receiver{})
	must(overlapClient.Send([]string{"a", "b", "run"}, event))
	s.drain()
	detachDeep()
	must(overlapClient.Send([]string{"a", "b", "run"}, event))
	s.drain()

	forwardClient, forwardServer := pair(s)
	destinationClient, destinationServer := pair(s)
	destinationRouter := newRouter(destinationServer)
	reply := ""
	returnAddress := &wire.ReturnAddress{Wire: sender(func(_ []string, message wire.Message) error {
		must(json.Unmarshal(message.Frame.Result, &reply))
		return nil
	})}
	privateContext := &struct{ value string }{"private"}
	contexts := map[*wire.ReturnAddress]*struct{ value string }{returnAddress: privateContext}
	request := wire.Message{Frame: wire.ProfileFrame{
		Version: 1, Kind: wire.ProfileRequest, ID: "request-1", Params: json.RawMessage(`{"nested":[null,42,"value"]}`),
		Traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01", Tracestate: "vendor=opaque", Meta: map[string]string{"key": "value"},
	}, Return: returnAddress}
	deliveredPath := []string{}
	framePreserved, returnIdentityPreserved, associatedContextPreserved := false, false, false
	var capturedReturn *wire.ReturnAddress
	destinationView := destinationRouter.selectView([]string{"a"}).selectView([]string{"b"})
	detachDestination, err := destinationView.Receive(wire.Receiver{Message: func(path []string, message wire.Message) {
		deliveredPath = path
		framePreserved = reflect.DeepEqual(message.Frame, request.Frame)
		returnIdentityPreserved = message.Return == returnAddress
		associatedContextPreserved = contexts[message.Return] == privateContext
		capturedReturn = message.Return
	}})
	must(err)
	detachForwarder, err := forwardServer.Receive(wire.Receiver{Message: func(path []string, message wire.Message) { must(destinationClient.Send(path, message)) }})
	must(err)
	composed := at(mount(map[string]wire.AddressedWire{"": at(at(forwardClient, []string{"a"}), []string{"b"})}), []string{""})
	if _, grantsOwnership := composed.(wire.Endpoint); grantsOwnership {
		panic("selected access grants endpoint ownership")
	}
	must(composed.Send([]string{"run", ""}, request))
	s.drain()
	detachForwarder()
	detachForwarder()
	detachDestination()
	must(destinationView.Close(0, "done"))
	// The captured reply survives attachment/view teardown and forwarder detach.
	must(capturedReturn.Wire.Send(nil, wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileResponse, ID: "request-1", Result: json.RawMessage(`"answer"`)}}))
	sourceUsable, targetUsable := false, false
	stopSource, err := forwardServer.Receive(wire.Receiver{Message: func([]string, wire.Message) { sourceUsable = true }})
	must(err)
	bind(destinationRouter, []string{"probe"}, func([]string, wire.Message) { targetUsable = true })
	must(forwardClient.Send([]string{"probe"}, event))
	must(destinationClient.Send([]string{"probe"}, event))
	s.drain()
	stopSource()

	opaqueClient, opaqueServer := pair(s)
	opaqueRouter := newRouter(opaqueServer)
	opaquePaths := []string{}
	for _, test := range []struct {
		path  []string
		label string
	}{
		{[]string{""}, "empty"}, {[]string{"a/b"}, "slash"}, {[]string{"a", "b"}, "split"}, {[]string{"é"}, "composed"}, {[]string{"e\u0301"}, "decomposed"},
	} {
		bind(opaqueRouter, test.path, func([]string, wire.Message) { opaquePaths = append(opaquePaths, test.label) })
		must(opaqueClient.Send(test.path, event))
	}
	s.drain()
	viewClient, viewRoot := pair(s)
	viewRouter := newRouter(viewRoot)
	aView := viewRouter.selectView([]string{"scope"}).selectView([]string{"a"})
	bView := viewRouter.selectView([]string{"scope", "b"})
	detachedView := viewRouter.selectView([]string{"detached"})
	notifications := map[string]int{"active": 0, "detached": 0, "sibling": 0}
	nestedPath, selectedSendPath := []string{}, []string{}
	siblingAfterViewClose, routeReusable := false, false
	initialDetach, err := aView.Receive(wire.Receiver{Message: func([]string, wire.Message) { panic("detached receiver ran") }})
	must(err)
	_, duplicateViewErr := aView.Receive(wire.Receiver{})
	initialDetach()
	initialDetach()
	_, err = aView.Receive(wire.Receiver{Message: func(path []string, _ wire.Message) { nestedPath = path }, Closed: func(wire.Code, string) { notifications["active"]++ }})
	must(err)
	initialDetach()
	_, err = bView.Receive(wire.Receiver{Message: func([]string, wire.Message) { siblingAfterViewClose = true }, Closed: func(wire.Code, string) { notifications["sibling"]++ }})
	must(err)
	detachUnused, err := detachedView.Receive(wire.Receiver{Closed: func(wire.Code, string) { notifications["detached"]++ }})
	must(err)
	detachUnused()
	must(detachedView.Close(0, "done"))
	must(detachedView.Close(0, "done"))
	_, err = viewClient.Receive(wire.Receiver{Message: func(path []string, _ wire.Message) { selectedSendPath = path }})
	must(err)
	must(viewClient.Send([]string{"scope", "a", "in"}, event))
	must(aView.Send([]string{"out"}, event))
	s.drain()
	must(aView.Close(0, "done"))
	must(aView.Close(0, "done"))
	_, closedReceiveErr := aView.Receive(wire.Receiver{})
	closedSendErr := aView.Send([]string{"ignored"}, event)
	replacementView := viewRouter.selectView([]string{"scope", "a"})
	stopReplacement, err := replacementView.Receive(wire.Receiver{Message: func([]string, wire.Message) { routeReusable = true }})
	must(err)
	must(viewClient.Send([]string{"scope", "a", "replacement"}, event))
	must(viewClient.Send([]string{"scope", "b", "sibling"}, event))
	s.drain()
	stopReplacement()
	must(viewRoot.Close(0, "root done"))
	must(viewRoot.Close(0, "root done"))
	s.drain()
	_, rootReceiveErr := viewRoot.Receive(wire.Receiver{})
	_, viewRootReceiveErr := bView.Receive(wire.Receiver{})
	must(bView.Close(0, "done"))

	// Equal request IDs from independent callers still retain distinct original
	// return capabilities after route replacement. No completion ledger is inferred.
	identityClient, identityRoot := pair(s)
	identityRouter := newRouter(identityRoot)
	identityView := identityRouter.selectView([]string{"service"})
	capturedRequests := []wire.Message{}
	detachIdentity, err := identityView.Receive(wire.Receiver{Message: func(_ []string, message wire.Message) { capturedRequests = append(capturedRequests, message) }})
	must(err)
	lateReplies, replyIDs := []string{}, []string{}
	originalReturns := []*wire.ReturnAddress{}
	for _, caller := range []struct{ label, payload string }{{"left", "first"}, {"right", "second"}} {
		replyAccess, replyReceiver := pair(s)
		_, err := replyReceiver.Receive(wire.Receiver{Message: func(_ []string, message wire.Message) {
			if message.Frame.Kind != wire.ProfileResponse {
				panic("expected a response")
			}
			var result string
			must(json.Unmarshal(message.Frame.Result, &result))
			lateReplies = append(lateReplies, caller.label+":"+result)
			replyIDs = append(replyIDs, message.Frame.ID)
		}})
		must(err)
		original := &wire.ReturnAddress{Wire: replyAccess}
		originalReturns = append(originalReturns, original)
		payload, err := json.Marshal(caller.payload)
		must(err)
		must(at(identityClient, []string{"service"}).Send([]string{"call"}, wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileRequest, ID: "same-id", Params: payload}, Return: original}))
	}
	s.drain()
	capturedReturnIdentities := []bool{}
	for index, message := range capturedRequests {
		capturedReturnIdentities = append(capturedReturnIdentities, message.Return == originalReturns[index])
	}
	detachIdentity()
	must(identityView.Close(0, "done"))
	replacementDeliveries := []string{}
	_, err = identityRouter.selectView([]string{"service"}).Receive(wire.Receiver{Message: func(_ []string, message wire.Message) {
		if message.Frame.Kind != wire.ProfileEvent {
			panic("old request/reply reached replacement receiver")
		}
		var result string
		must(json.Unmarshal(message.Frame.Data, &result))
		replacementDeliveries = append(replacementDeliveries, result)
	}})
	must(err)
	must(identityClient.Send([]string{"service", "probe"}, wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent, Data: json.RawMessage(`"probe"`)}}))
	for index := len(capturedRequests) - 1; index >= 0; index-- {
		captured := capturedRequests[index]
		if captured.Frame.Kind != wire.ProfileRequest {
			panic("expected request")
		}
		must(captured.Return.Wire.Send(nil, wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileResponse, ID: captured.Frame.ID, Result: captured.Frame.Params}}))
	}
	s.drain()
	output := map[string]any{
		"siblings":             map[string]any{"deliveries": deliveries, "receiverRanDuringSend": receiverRanDuringSend, "duplicateEndpointAttachmentRefused": duplicateErr != nil, "attachmentReusableAfterDetach": attachmentReusable},
		"overlap":              map[string]any{"deliveries": overlapDeliveries, "duplicateRouteRefused": duplicateRouteErr != nil},
		"composition":          map[string]any{"deliveredPath": deliveredPath, "framePreserved": framePreserved, "returnIdentityPreserved": returnIdentityPreserved, "associatedContextPreserved": associatedContextPreserved, "reply": reply, "borrowedEndpointUsableAfterDetach": sourceUsable && targetUsable},
		"opaquePaths":          opaquePaths,
		"selectedEndpoints":    map[string]any{"nestedPath": nestedPath, "selectedSendPath": selectedSendPath, "duplicateReceiveRefused": duplicateViewErr != nil, "notifications": notifications, "closedReceiveRefused": closedReceiveErr != nil, "closedSendRefused": closedSendErr != nil, "rootReceiveRefused": rootReceiveErr != nil, "viewAfterRootCloseRefused": viewRootReceiveErr != nil, "siblingAfterViewClose": siblingAfterViewClose, "routeReusable": routeReusable},
		"sameIDDelayedReplies": map[string]any{"capturedReturnIdentities": capturedReturnIdentities, "lateReplies": lateReplies, "replyIDs": replyIDs, "replacementDeliveries": replacementDeliveries},
	}
	encoded, err := json.Marshal(output)
	must(err)
	fmt.Println(string(encoded))
}

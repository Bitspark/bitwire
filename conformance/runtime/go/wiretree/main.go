// Full-tree driver for ../../../wiretree/cases.json, run by
// scripts/conformance-runtime.mjs; the same interpretation as ../../ts/wiretree.ts.
// Expectations are withheld: this program only interprets inputs and records
// what happened. "production" is bitruntime's core.Compose, core.Select,
// core.Send and core.AsAddressed; "reference" is a test-only structural
// interpreter that is never evidence about a runtime. Carrier cases always use
// bitruntime's carriers, dispatcher, Forward, At and Mount. bind and serve are
// test-only because bitruntime v0.2.0 has no public facility for either
// (bitruntime#15).
package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"bitwire.conformance/runtime/internal/carrier"
	core "github.com/Bitspark/bitruntime/core/go"
	dispatch "github.com/Bitspark/bitruntime/dispatch/go"
	transports "github.com/Bitspark/bitruntime/transports/go"
	wire "github.com/Bitspark/bitwire/wire/go"
)

type tree = wire.WireTree
type child = wire.Child[wire.Wire]

// ---- Realizations of the structural operations ----

type trees interface {
	Compose(own wire.Wire, children []child) (tree, error)
	Select(t tree, path wire.TreePath) (tree, bool)
	Send(t tree, path wire.TreePath, message wire.Message) error
	AsAddressed(t tree) wire.AddressedWire
}

type production struct{}

func (production) Compose(own wire.Wire, children []child) (tree, error) {
	return core.Compose(own, children)
}
func (production) Select(t tree, path wire.TreePath) (tree, bool) { return core.Select(t, path) }
func (production) Send(t tree, path wire.TreePath, m wire.Message) error {
	return core.Send(t, path, m)
}
func (production) AsAddressed(t tree) wire.AddressedWire { return core.AsAddressed(t) }

// node is a test-only interpreter of the contract: complete, exact, immutable, acyclic.
type node struct {
	own      wire.Wire
	children []child
}

func copyChildren(children []child) []child {
	out := make([]child, len(children))
	for i, c := range children {
		out[i] = child{Key: bytes.Clone(c.Key), Tree: c.Tree}
		if out[i].Key == nil {
			out[i].Key = []byte{}
		}
	}
	return out
}
func (n *node) Own() wire.Wire                     { return n.own }
func (n *node) Children() []child                  { return copyChildren(n.children) }
func (n *node) At(path wire.TreePath) (tree, bool) { return reference{}.Select(n, path) }
func (n *node) Decompose() (wire.Wire, []child)    { return n.own, n.Children() }

type reference struct{}

func (reference) Compose(own wire.Wire, children []child) (tree, error) {
	seen := map[string]bool{}
	for _, c := range children {
		if c.Tree == nil || reflect.ValueOf(c.Tree).Kind() == reflect.Pointer && reflect.ValueOf(c.Tree).IsNil() {
			return nil, errors.New("missing child")
		}
		if seen[string(c.Key)] {
			return nil, errors.New("duplicate key")
		}
		seen[string(c.Key)] = true
	}
	active := map[tree]bool{}
	var visit func(t tree) error
	visit = func(t tree) error {
		if _, local := t.(*node); local {
			return nil
		}
		if active[t] {
			return errors.New("cycle")
		}
		active[t] = true
		for _, c := range t.Children() {
			if err := visit(c.Tree); err != nil {
				return err
			}
		}
		delete(active, t)
		return nil
	}
	for _, c := range children {
		if err := visit(c.Tree); err != nil {
			return nil, err
		}
	}
	return &node{own: own, children: copyChildren(children)}, nil
}
func (reference) Select(t tree, path wire.TreePath) (tree, bool) {
	current := t
	for _, key := range path {
		var next tree
		for _, c := range current.Children() {
			if bytes.Equal(c.Key, key) {
				next = c.Tree
				break
			}
		}
		if next == nil {
			return nil, false
		}
		current = next
	}
	return current, true
}
func (r reference) Send(t tree, path wire.TreePath, m wire.Message) error {
	selected, ok := r.Select(t, path)
	if !ok {
		return errors.New("missing")
	}
	return selected.Own().Send(m)
}
func (r reference) AsAddressed(t tree) wire.AddressedWire { return referenceBridge{r, t} }

type referenceBridge struct {
	r reference
	t tree
}

func (b referenceBridge) Send(path []string, m wire.Message) error {
	keys := wire.TreePath{}
	for _, segment := range path {
		if !utf8.ValidString(segment) {
			return errors.New("invalid path")
		}
		keys = append(keys, []byte(segment))
	}
	return b.r.Send(b.t, keys, m)
}

// ---- Inputs ----

type declaration struct {
	ID       string      `json:"id"`
	Own      *string     `json:"own"`
	Children [][2]string `json:"children"`
}
type step struct {
	Op         string     `json:"op"`
	Path       []string   `json:"path"`
	Keep       [][]string `json:"keep"`
	Selections [][]string `json:"selections"`
	Paths      [][]string `json:"paths"`
	Via        string     `json:"via"`
	Key        string     `json:"key"`
	To         string     `json:"to"`
	Node       string     `json:"node"`
	Mode       string     `json:"mode"`
	Own        *string    `json:"own"`
	Side       string     `json:"side"`
}
type testCase struct {
	ID     string `json:"id"`
	Family string `json:"family"`
	Root   string `json:"root"`
	Fault  string `json:"fault"`
	Relay  bool   `json:"relay"`
	Mount  bool   `json:"mount"`
	Steps  []step `json:"steps"`
}
type inputs struct {
	ServedAt     []string      `json:"servedAt"`
	Declarations []declaration `json:"declarations"`
	Cases        []testCase    `json:"cases"`
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}
func key(h string) []byte {
	b, err := hex.DecodeString(h)
	check(err)
	return b
}
func keys(path []string) wire.TreePath {
	out := wire.TreePath{}
	for _, h := range path {
		out = append(out, key(h))
	}
	return out
}
func segments(path []string) []string {
	out := []string{}
	for _, h := range path {
		out = append(out, string(key(h)))
	}
	return out
}

// ---- Instrumented primitives and structural editing ----

type primitive struct {
	name     string
	instance int
	h        *harness
}

func (p *primitive) Send(message wire.Message) error { return p.h.handle(p, message) }

type refuser struct{ _ byte }

func (*refuser) Send(wire.Message) error { return errors.New("refused") }

type harness struct {
	mu           sync.Mutex
	trace        [][]any
	unchanged    bool
	partsExact   bool
	expected     *wire.Message
	counts       map[*primitive]int
	instances    map[string]int
	shared       map[string]*primitive
	built        map[string]tree
	declarations map[string]declaration
	t            trees
	deliver      func(p *primitive, count int, message wire.Message) error
}

func newHarness(t trees, in inputs) *harness {
	h := &harness{unchanged: true, partsExact: true, counts: map[*primitive]int{}, instances: map[string]int{},
		shared: map[string]*primitive{}, built: map[string]tree{}, declarations: map[string]declaration{}, t: t}
	for _, d := range in.Declarations {
		h.declarations[d.ID] = d
	}
	return h
}
func (h *harness) push(entry ...any) {
	h.mu.Lock()
	h.trace = append(h.trace, entry)
	h.mu.Unlock()
}
func (h *harness) length() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.trace)
}
func (h *harness) setExpected(m wire.Message) {
	h.mu.Lock()
	h.expected = &m
	h.mu.Unlock()
}
func (h *harness) handle(p *primitive, message wire.Message) error {
	h.mu.Lock()
	h.counts[p]++
	count := h.counts[p]
	h.mu.Unlock()
	return h.deliver(p, count, message)
}
func (h *harness) primitive(name string, fresh bool) wire.Wire {
	h.mu.Lock()
	defer h.mu.Unlock()
	if p, ok := h.shared[name]; ok && !fresh {
		return p
	}
	h.instances[name]++
	p := &primitive{name: name, instance: h.instances[name], h: h}
	if !fresh {
		h.shared[name] = p
	}
	return p
}

// construct shows that neither the input nor the returned parts can change the tree.
func (h *harness) construct(own wire.Wire, children []child) (tree, error) {
	type pair struct {
		key string
		t   tree
	}
	want := []pair{}
	input := []child{}
	for _, c := range children {
		want = append(want, pair{string(c.Key), c.Tree})
		input = append(input, child{Key: bytes.Clone(c.Key), Tree: c.Tree})
	}
	t, err := h.t.Compose(own, input)
	if err != nil {
		return nil, err
	}
	for i := range input {
		for j := range input[i].Key {
			input[i].Key[j] = 'z'
		}
		input[i].Tree = nil
	}
	exact := func() bool {
		gotOwn, got := t.Decompose()
		if gotOwn != own || t.Own() != own || len(got) != len(want) || len(t.Children()) != len(want) {
			return false
		}
		for _, w := range want {
			if !slices.ContainsFunc(got, func(c child) bool { return string(c.Key) == w.key && c.Tree == w.t }) {
				return false
			}
		}
		return true
	}
	ok := exact()
	returned := t.Children()
	for i := range returned {
		for j := range returned[i].Key {
			returned[i].Key[j] = 'z'
		}
		returned[i].Tree = nil
	}
	ok = ok && exact()
	h.mu.Lock()
	h.partsExact = h.partsExact && ok
	h.mu.Unlock()
	return t, nil
}
func (h *harness) must(t tree, err error) tree {
	check(err)
	return t
}

type loop struct{ own wire.Wire }

func (l *loop) Own() wire.Wire                  { return l.own }
func (l *loop) Children() []child               { return []child{{Key: []byte("again"), Tree: l}} }
func (l *loop) At(wire.TreePath) (tree, bool)   { return nil, false }
func (l *loop) Decompose() (wire.Wire, []child) { return l.own, l.Children() }

func (h *harness) build(id, fault, rootID string) (tree, error) {
	if t, ok := h.built[id]; ok {
		return t, nil
	}
	d := h.declarations[id]
	children := []child{}
	for _, c := range d.Children {
		t, err := h.build(c[1], fault, rootID)
		if err != nil {
			return nil, err
		}
		children = append(children, child{Key: key(c[0]), Tree: t})
	}
	if id == rootID {
		switch fault {
		case "duplicate":
			children = append(children, child{Key: []byte("a"), Tree: h.must(h.build("leaf", "", ""))})
		case "missingChild":
			children = append(children, child{Key: []byte("hole"), Tree: nil})
		case "cycle":
			children = append(children, child{Key: []byte("loop"), Tree: &loop{own: &refuser{}}})
		}
	}
	var own wire.Wire = &refuser{}
	if d.Own != nil {
		own = h.primitive(*d.Own, false)
	}
	t, err := h.construct(own, children)
	if err != nil {
		return nil, err
	}
	h.built[id] = t
	return t, nil
}

type render struct {
	Own      any     `json:"own"`
	Children [][]any `json:"children"`
}

func (h *harness) render(t tree) render {
	var own any = "unknown"
	switch p := t.Own().(type) {
	case *refuser:
		own = nil
	case *primitive:
		own = []any{p.name, p.instance}
	}
	children := [][]any{}
	for _, c := range t.Children() {
		children = append(children, []any{hex.EncodeToString(c.Key), h.render(c.Tree)})
	}
	return render{Own: own, Children: children}
}
func (h *harness) rebuild(t tree, where []string, keep [][]string) tree {
	for _, path := range keep {
		if slices.Equal(path, where) {
			return t
		}
	}
	own, children := t.Decompose()
	next := []child{}
	for _, c := range children {
		next = append(next, child{Key: c.Key, Tree: h.rebuild(c.Tree, append(slices.Clone(where), hex.EncodeToString(c.Key)), keep)})
	}
	return h.must(h.construct(own, next))
}
func (h *harness) replaceAt(t tree, path []string, f func(tree) tree) tree {
	if len(path) == 0 {
		return f(t)
	}
	own, children := t.Decompose()
	found := false
	next := []child{}
	for _, c := range children {
		if hex.EncodeToString(c.Key) == path[0] {
			found = true
			next = append(next, child{Key: c.Key, Tree: h.replaceAt(c.Tree, path[1:], f)})
		} else {
			next = append(next, c)
		}
	}
	if !found {
		panic("edit path leaves the tree")
	}
	return h.must(h.construct(own, next))
}
func (h *harness) fresh(own wire.Wire) wire.Wire {
	if p, ok := own.(*primitive); ok {
		return h.primitive(p.name, true)
	}
	return &refuser{}
}
func (h *harness) copy(t tree) tree {
	next := []child{}
	for _, c := range t.Children() {
		next = append(next, child{Key: c.Key, Tree: h.copy(c.Tree)})
	}
	return h.must(h.construct(h.fresh(t.Own()), next))
}
func (h *harness) edit(t tree, s step, build func(id string) tree) tree {
	switch s.Op {
	case "rebuild":
		return h.rebuild(t, []string{}, s.Keep)
	case "replace":
		return h.replaceAt(t, s.Path, func(tree) tree { return build(s.Node) })
	case "own":
		return h.replaceAt(t, s.Path, func(n tree) tree {
			var own wire.Wire = &refuser{}
			if s.Own != nil {
				own = h.fresh(n.Own())
			}
			return h.must(h.construct(own, n.Children()))
		})
	case "substitute":
		return h.replaceAt(t, s.Path, func(n tree) tree {
			if s.Mode == "copy" {
				return h.copy(n)
			}
			return h.rebuild(n, []string{}, nil)
		})
	case "omit", "rename", "add":
		return h.replaceAt(t, s.Path, func(n tree) tree {
			next := []child{}
			for _, c := range n.Children() {
				name := hex.EncodeToString(c.Key)
				if s.Op == "omit" && name == s.Key {
					continue
				}
				if s.Op == "rename" && name == s.Key {
					c.Key = key(s.To)
				}
				next = append(next, c)
			}
			if s.Op == "add" {
				next = append(next, child{Key: key(s.Key), Tree: build(s.Node)})
			}
			return h.must(h.construct(n.Own(), next))
		})
	}
	panic("unknown edit " + s.Op)
}

// sameJSON compares encoded JSON payloads by value, since a carrier may re-encode them.
func sameJSON(a, b json.RawMessage) bool {
	var x, y any
	if json.Unmarshal(a, &x) != nil || json.Unmarshal(b, &y) != nil {
		return bytes.Equal(a, b)
	}
	return reflect.DeepEqual(x, y)
}

// chain applies each selection with the node's own At, and checks it against
// selecting the concatenation.
func (h *harness) chain(start tree, selections [][]string, fromRoot bool) (tree, bool) {
	current := start
	for _, selection := range selections {
		next, ok := current.At(keys(selection))
		if !ok {
			return nil, false
		}
		current = next
	}
	if fromRoot {
		all := []string{}
		for _, selection := range selections {
			all = append(all, selection...)
		}
		if direct, ok := h.t.Select(start, keys(all)); !ok || direct != current {
			h.push("selectionDiffers")
		}
	}
	return current, true
}

// derived sends through the realization: missing selection invokes nothing;
// a present node's refusal is its own.
func (h *harness) derived(base tree, ok bool, path []string, m wire.Message) {
	if !ok {
		h.push("missing")
		return
	}
	_, present := h.t.Select(base, keys(path))
	before := h.length()
	h.setExpected(m)
	if err := h.t.Send(base, keys(path), m); err != nil {
		if h.length() != before {
			h.push("fallback")
		}
		if present {
			h.push("refused")
		} else {
			h.push("missing")
		}
		return
	}
	if !present {
		h.push("fabricated")
	}
}

type refuseWire struct{ _ byte }

func (*refuseWire) Send([]string, wire.Message) error { return errors.New("not a reply target") }

var replyless = &wire.ReturnAddress{Wire: &refuseWire{}}

func event(data string) wire.Message {
	encoded, err := json.Marshal(data)
	check(err)
	return wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent, Data: encoded}, Return: replyless}
}

// ---- Local families: structure and the addressed bridge ----

func local(t trees, in inputs, test testCase) any {
	h := newHarness(t, in)
	h.deliver = func(p *primitive, count int, m wire.Message) error {
		h.mu.Lock()
		h.unchanged = h.unchanged && h.expected != nil && reflect.DeepEqual(m.Frame, h.expected.Frame) && m.Return == h.expected.Return
		h.mu.Unlock()
		h.push("delivered", p.name, count)
		return nil
	}
	root, err := h.build(test.Root, test.Fault, test.Root)
	if err != nil {
		return map[string]any{"construction": "refused"}
	}
	if test.Fault != "" {
		return map[string]any{"construction": "accepted"}
	}
	var view tree
	haveView := false
	sendOnly := true
	for index, s := range test.Steps {
		m := event(fmt.Sprintf("%s:%d", test.ID, index))
		switch s.Op {
		case "structure":
			if n, ok := t.Select(root, keys(s.Path)); ok {
				h.push("structure", h.render(n))
			} else {
				h.push("structure", "missing")
			}
		case "send":
			start, ok := root, true
			if s.Via == "view" {
				start, ok = view, haveView
			}
			var base tree
			if ok {
				base, ok = h.chain(start, s.Selections, s.Via != "view")
			}
			h.derived(base, ok, s.Path, m)
		case "same":
			a, aok := t.Select(root, keys(s.Paths[0]))
			b, bok := t.Select(root, keys(s.Paths[1]))
			h.push("same", aok && bok && a.Own() == b.Own())
		case "view":
			view, haveView = h.chain(root, s.Selections, true)
		case "bridge", "bridgeInvalid":
			bridge := t.AsAddressed(root)
			_, receives := bridge.(interface {
				Receive(wire.Receiver) (func(), error)
			})
			_, closes := bridge.(interface{ Close(wire.Code, string) error })
			_, structural := bridge.(interface{ Own() wire.Wire })
			sendOnly = sendOnly && !receives && !closes && !structural
			path := s.Path
			if s.Op == "bridgeInvalid" {
				path = []string{"\xff"}
			}
			before := h.length()
			h.setExpected(m)
			if err := bridge.Send(path, m); err != nil {
				if h.length() != before {
					h.push("fallback")
				}
				h.push("refused")
			}
		default:
			root = h.edit(root, s, func(id string) tree { return h.must(h.build(id, "", "")) })
		}
	}
	if test.Family == "bridge" {
		return map[string]any{"trace": h.trace, "sendOnly": sendOnly, "unchanged": h.unchanged}
	}
	return map[string]any{"trace": h.trace, "partsExact": h.partsExact, "unchanged": h.unchanged}
}

// ---- Carrier family ----

// bindWire is test-only addressless access at one fixed addressed path (bitruntime#15).
type bindWire struct {
	access wire.AddressedWire
	path   []string
}

func (b *bindWire) Send(m wire.Message) error { return b.access.Send(slices.Clone(b.path), m) }

// serve is test-only: exact dispatcher routes for every node whose keys are all
// UTF-8, each bound to that node's own Wire (bitruntime#15). A Go receiver
// returns nothing, so a refused request is answered through core.Respond.
func serve(d *dispatch.Dispatcher, t tree, prefix []string) func() {
	var detach []func()
	var visit func(n tree, path []string)
	visit = func(n tree, path []string) {
		own := n.Own()
		release, err := d.Register(append(slices.Clone(prefix), path...), wire.Receiver{Message: func(_ []string, m wire.Message) {
			if err := own.Send(m); err != nil && m.Frame.Kind == wire.ProfileRequest {
				_ = core.Respond(m, nil, err)
			}
		}})
		check(err)
		detach = append(detach, release)
		for _, c := range n.Children() {
			if !utf8.Valid(c.Key) {
				continue
			}
			visit(c.Tree, append(slices.Clone(path), string(c.Key)))
		}
	}
	visit(t, []string{})
	return func() {
		for _, release := range detach {
			release()
		}
	}
}

func take[T any](ch chan T) T {
	select {
	case v := <-ch:
		return v
	case <-time.After(5 * time.Second):
		panic("delivery deadline exceeded")
	}
}

type replies struct{ ch chan wire.Message }

func (r replies) Send(path []string, m wire.Message) error {
	if len(path) != 0 || m.Frame.Kind != wire.ProfileResponse {
		return errors.New("unexpected reply")
	}
	r.ch <- m
	return nil
}

type call struct {
	message wire.Message
	replies chan wire.Message
}

func runCarrier(t trees, in inputs, test testCase) (result any) {
	var cleanups []func()
	defer func() {
		slices.Reverse(cleanups)
		for _, cleanup := range cleanups {
			cleanup()
		}
	}()
	cleanup := func(f func()) { cleanups = append(cleanups, f) }
	near, first := carrier.Pair(cleanup)
	far := first
	if test.Relay {
		outgoing, target := carrier.Pair(cleanup)
		detach, err := core.Forward(first, outgoing)
		check(err)
		cleanup(detach)
		far = target
	}
	var access wire.AddressedWire = near
	if test.Mount {
		mounted := core.Mount(map[string]wire.Endpoint{"mounted": near})
		cleanup(func() { _ = mounted.Close(transports.CodeNormal, "done") })
		access = core.At(mounted, []string{"mounted"})
	}

	// The far side: an instrumented tree served on a dispatcher that borrows the endpoint.
	h := newHarness(t, in)
	signals := make(chan string, 8)
	var hold bool
	var held struct {
		message wire.Message
		name    string
	}
	h.deliver = func(p *primitive, count int, m wire.Message) error {
		h.mu.Lock()
		expected := h.expected
		ok := expected != nil && m.Frame.Kind == expected.Frame.Kind && m.Return != nil
		if ok && m.Frame.Kind == wire.ProfileRequest {
			ok = sameJSON(m.Frame.Params, expected.Frame.Params)
		}
		h.unchanged = h.unchanged && ok
		if m.Frame.Kind == wire.ProfileCancel {
			h.counts[p]--
		}
		holding := hold && m.Frame.Kind == wire.ProfileRequest
		if holding {
			hold = false
			held.message, held.name = m, p.name
		}
		h.mu.Unlock()
		switch {
		case m.Frame.Kind == wire.ProfileCancel:
			h.push("cancelled", p.name)
			signals <- "cancelled"
		case m.Frame.Kind == wire.ProfileEvent:
			h.push("delivered", p.name, count)
		case holding:
			h.push("held", p.name, count)
			signals <- "held"
		default:
			h.push("delivered", p.name, count)
			result, err := json.Marshal(p.name)
			check(err)
			return m.Return.Wire.Send(nil, wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileResponse, ID: m.Frame.ID, Result: result}})
		}
		return nil
	}
	farTree := h.must(h.build(test.Root, "", ""))
	d, err := dispatch.NewDispatcher(far)
	check(err)
	unserve := serve(d, farTree, in.ServedAt)

	// The near side: the same declared structure, each own Wire bound to its far
	// carrier path. A carrier path names a far position, and addressed access
	// cannot show that two positions share a node, so every position is bound.
	var mirror func(id string, path []string) tree
	mirror = func(id string, path []string) tree {
		dcl := h.declarations[id]
		children := []child{}
		for _, c := range dcl.Children {
			k := key(c[0])
			if !utf8.Valid(k) {
				continue
			}
			children = append(children, child{Key: k, Tree: mirror(c[1], append(slices.Clone(path), string(k)))})
		}
		n, err := t.Compose(&bindWire{access: access, path: append(slices.Clone(in.ServedAt), path...)}, children)
		check(err)
		return n
	}
	nearTree := mirror(test.Root, []string{})

	serial := 0
	request := func(label string) call {
		serial++
		params, err := json.Marshal(label)
		check(err)
		c := call{replies: make(chan wire.Message, 2)}
		c.message = wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileRequest, ID: fmt.Sprintf("c:%d", serial), Params: params},
			Return: &wire.ReturnAddress{Wire: replies{c.replies}}}
		return c
	}
	outcome := func(c call) {
		reply := take(c.replies)
		if reply.Frame.Error != nil {
			h.push("error", reply.Frame.Error.Code)
		}
	}
	var pending call

	for index, s := range test.Steps {
		label := fmt.Sprintf("%s:%d", test.ID, index)
		switch s.Op {
		case "send", "hold", "cancel":
			base, ok := h.chain(nearTree, s.Selections, true)
			if ok {
				_, ok = t.Select(base, keys(s.Path))
			}
			if !ok {
				h.push("missing")
				continue
			}
			if s.Op == "cancel" {
				cancel := wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileCancel, ID: pending.message.Frame.ID}, Return: pending.message.Return}
				h.setExpected(cancel)
				check(t.Send(base, keys(s.Path), cancel))
				take(signals)
				continue
			}
			c := request(label)
			h.setExpected(c.message)
			h.mu.Lock()
			hold = s.Op == "hold"
			h.mu.Unlock()
			if err := t.Send(base, keys(s.Path), c.message); err != nil {
				h.mu.Lock()
				hold = false
				h.mu.Unlock()
				h.push("refused")
				continue
			}
			if s.Op == "hold" {
				pending = c
				take(signals)
			} else {
				outcome(c)
			}
		case "sendAddressed":
			c := request(label)
			h.setExpected(c.message)
			if err := access.Send(s.Path, c.message); err != nil {
				h.push("refused")
				continue
			}
			outcome(c)
		case "release":
			h.mu.Lock()
			message, name := held.message, held.name
			h.mu.Unlock()
			result, err := json.Marshal(name)
			check(err)
			check(message.Return.Wire.Send(nil, wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileResponse, ID: message.Frame.ID, Result: result}}))
			var late string
			check(json.Unmarshal(take(pending.replies).Frame.Result, &late))
			h.push("late", late)
		case "structure":
			if n, ok := t.Select(farTree, keys(s.Path)); ok {
				h.push("structure", h.render(n))
			} else {
				h.push("structure", "missing")
			}
		case "direct":
			h.derived(farTree, true, s.Path, event(label))
		case "teardown":
			unserve()
			check(d.Close(transports.CodeNormal, "released"))
		default:
			if s.Side == "far" {
				farTree = h.edit(farTree, s, func(id string) tree { return h.must(h.build(id, "", "")) })
				unserve()
				unserve = serve(d, farTree, in.ServedAt)
			} else {
				nearTree = h.edit(nearTree, s, func(id string) tree { return mirror(id, segments(s.Path)) })
			}
		}
	}

	// The borrowed endpoint outlives every composition over it.
	unserve()
	_ = d.Close(transports.CodeNormal, "released")
	borrowed := make(chan wire.Message, 1)
	detach, err := far.Receive(wire.Receiver{Message: func(path []string, m wire.Message) {
		if strings.Join(path, "/") == "borrowed" {
			borrowed <- m
		}
	}})
	usable := false
	if err == nil {
		cleanup(detach)
		if near.Send([]string{"borrowed"}, event("borrowed")) == nil {
			select {
			case m := <-borrowed:
				usable = m.Frame.Kind == wire.ProfileEvent
			case <-time.After(5 * time.Second):
			}
		}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	return map[string]any{"trace": h.trace, "unchanged": h.unchanged, "borrowedUsable": usable}
}

func main() {
	if len(os.Args) != 4 || !slices.Contains([]string{"reference", "production"}, os.Args[1]) || !slices.Contains([]string{"local", "carrier"}, os.Args[2]) {
		panic("usage: wiretree reference|production local|carrier inputs.json")
	}
	var t trees = reference{}
	if os.Args[1] == "production" {
		t = production{}
	}
	data, err := os.ReadFile(os.Args[3])
	check(err)
	var in inputs
	check(json.Unmarshal(data, &in))
	if os.Args[2] == "carrier" {
		carrier.Kind()
	}
	output := []map[string]any{}
	for _, test := range in.Cases {
		if (os.Args[2] == "carrier") != (test.Family == "carrier") {
			continue
		}
		var observations any
		if test.Family == "carrier" {
			observations = runCarrier(t, in, test)
		} else {
			observations = local(t, in, test)
		}
		output = append(output, map[string]any{"id": test.ID, "observations": observations})
	}
	check(json.NewEncoder(os.Stdout).Encode(output))
}

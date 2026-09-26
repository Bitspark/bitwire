// This is a test-only structural interpreter, not a published implementation.
package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"errors"
	wire "github.com/Bitspark/bitwire/wire/go"
	"os"
	"sort"
)

type node[T any] struct {
	own      T
	children []wire.Child[T]
}

func compose[T any](own T, children []wire.Child[T]) *node[T] {
	n := &node[T]{own: own}
	for _, c := range children {
		for _, old := range n.children {
			if bytes.Equal(old.Key, c.Key) {
				panic("duplicate key")
			}
		}
		n.children = append(n.children, wire.Child[T]{Key: bytes.Clone(c.Key), Tree: c.Tree})
	}
	return n
}
func (n *node[T]) Own() T { return n.own }
func (n *node[T]) Children() []wire.Child[T] {
	result := make([]wire.Child[T], len(n.children))
	for i, c := range n.children {
		result[i] = wire.Child[T]{Key: bytes.Clone(c.Key), Tree: c.Tree}
	}
	return result
}
func (n *node[T]) At(path wire.TreePath) (wire.DeixisNode[T], bool) {
	var current wire.DeixisNode[T] = n
	for _, key := range path {
		var found wire.DeixisNode[T]
		for _, c := range current.Children() {
			if bytes.Equal(key, c.Key) {
				found = c.Tree
				break
			}
		}
		if found == nil {
			return nil, false
		}
		current = found
	}
	return current, true
}
func (n *node[T]) Decompose() (T, []wire.Child[T]) { return n.own, n.Children() }

type primitive struct {
	name       string
	admissions *[]string
	refuse     bool
}

func (p *primitive) Send(message wire.Message) error {
	if p.refuse {
		return errors.New("refused")
	}
	*p.admissions = append(*p.admissions, p.name+":"+string(message.Frame.Kind))
	return nil
}
func main() {
	admissions := []string{}
	makeNode := func(name string, children []wire.Child[wire.Wire]) *node[wire.Wire] {
		return compose[wire.Wire](&primitive{name: name, admissions: &admissions}, children)
	}
	leaf := makeNode("leaf", nil)
	refusing := compose[wire.Wire](&primitive{refuse: true}, nil)
	tree := makeNode("root", []wire.Child[wire.Wire]{
		{Key: []byte{}, Tree: makeNode("empty", nil)}, {Key: []byte{255}, Tree: makeNode("binary", nil)},
		{Key: []byte("a/b"), Tree: refusing}, {Key: []byte("a"), Tree: makeNode("branch", []wire.Child[wire.Wire]{{Key: []byte("b"), Tree: leaf}})},
	})
	at := func(path wire.TreePath) wire.WireTree {
		n, ok := tree.At(path)
		if !ok {
			panic("missing")
		}
		return n
	}
	label := func(path wire.TreePath) string { return at(path).Own().(*primitive).name }
	own, children := tree.Decompose()
	rebuilt := compose(own, children)
	exposed := tree.Children()
	exposed[1].Key[0] = 0
	_ = at(wire.TreePath{{255}}).Own().Send(wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent}})
	refusal := at(wire.TreePath{[]byte("a/b")}).Own().Send(wire.Message{})
	self, _ := tree.At(nil)
	_, missing := tree.At(wire.TreePath{{0}})
	nested, _ := at(wire.TreePath{[]byte("a")}).At(wire.TreePath{[]byte("b")})
	reconstructed, _ := rebuilt.At(wire.TreePath{[]byte("a"), []byte("b")})
	keys := []string{}
	for _, c := range tree.Children() {
		keys = append(keys, hex.EncodeToString(c.Key))
	}
	sort.Strings(keys)
	_, exists := tree.At(wire.TreePath{[]byte("a/b")})
	result := map[string]any{
		"self": self == tree, "binary": label(wire.TreePath{{255}}), "emptyKey": label(wire.TreePath{{}}), "missing": !missing,
		"nested": label(wire.TreePath{[]byte("a"), []byte("b")}), "nestedLaw": nested == at(wire.TreePath{[]byte("a"), []byte("b")}),
		"children": keys, "slashIsLiteral": at(wire.TreePath{[]byte("a/b")}) != at(wire.TreePath{[]byte("a"), []byte("b")}),
		"partsIdentity": own == tree.Own() && children[1].Tree == at(wire.TreePath{{255}}), "rebuildIdentity": reconstructed.Own() == leaf.Own(),
		"keyCopy": label(wire.TreePath{{255}}) == "binary", "refusingExists": exists, "refusingSend": refusal != nil, "admissions": admissions,
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		panic(err)
	}
}

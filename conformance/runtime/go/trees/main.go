// Produces the observation object of ../../../trees/go/main.go through
// bitruntime's production tree operations instead of the test-only
// interpreter: core.Compose constructs every node, core.Select and the node's
// At select, and core.Send is the derived sending. Where a send is refused and
// its path lies in the UTF-8 image, core.AsAddressed must refuse it too; that
// strengthens an observation without adding one. Expectations stay in
// ../../../trees/expected.json and are compared only by Bitwire's runner.
package main

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"sort"

	core "github.com/Bitspark/bitruntime/core/go"
	wire "github.com/Bitspark/bitwire/wire/go"
)

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

func compose(own wire.Wire, children []wire.Child[wire.Wire]) wire.WireTree {
	tree, err := core.Compose(own, children)
	if err != nil {
		panic(err)
	}
	return tree
}

func main() {
	admissions := []string{}
	makeNode := func(name string, children []wire.Child[wire.Wire]) wire.WireTree {
		return compose(&primitive{name: name, admissions: &admissions}, children)
	}
	leaf := makeNode("leaf", nil)
	refusing := compose(&primitive{refuse: true}, nil)
	tree := makeNode("root", []wire.Child[wire.Wire]{
		{Key: []byte{}, Tree: makeNode("empty", nil)}, {Key: []byte{255}, Tree: makeNode("binary", nil)},
		{Key: []byte("a/b"), Tree: refusing}, {Key: []byte("a"), Tree: makeNode("branch", []wire.Child[wire.Wire]{{Key: []byte("b"), Tree: leaf}})},
	})
	at := func(path wire.TreePath) wire.WireTree {
		n, ok := core.Select(tree, path)
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
	event := wire.Message{Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent}}
	_ = core.Send(tree, wire.TreePath{{255}}, event)
	refusal := core.Send(tree, wire.TreePath{[]byte("a/b")}, wire.Message{})
	addressedRefusal := core.AsAddressed(tree).Send([]string{"a/b"}, wire.Message{})
	self, _ := core.Select(tree, nil)
	viaAt, _ := tree.At(nil)
	_, found := core.Select(tree, wire.TreePath{{0}})
	missingSend := core.Send(tree, wire.TreePath{{0}}, event)
	missingAddressed := core.AsAddressed(tree).Send([]string{"\x00"}, event)
	nested, _ := at(wire.TreePath{[]byte("a")}).At(wire.TreePath{[]byte("b")})
	reconstructed, _ := core.Select(rebuilt, wire.TreePath{[]byte("a"), []byte("b")})
	keys := []string{}
	for _, c := range tree.Children() {
		keys = append(keys, hex.EncodeToString(c.Key))
	}
	sort.Strings(keys)
	_, exists := core.Select(tree, wire.TreePath{[]byte("a/b")})
	result := map[string]any{
		"self": self == tree && viaAt == tree, "binary": label(wire.TreePath{{255}}), "emptyKey": label(wire.TreePath{{}}),
		"missing": !found && missingSend != nil && missingAddressed != nil,
		"nested":  label(wire.TreePath{[]byte("a"), []byte("b")}), "nestedLaw": nested == at(wire.TreePath{[]byte("a"), []byte("b")}),
		"children": keys, "slashIsLiteral": at(wire.TreePath{[]byte("a/b")}) != at(wire.TreePath{[]byte("a"), []byte("b")}),
		"partsIdentity": own == tree.Own() && children[1].Tree == at(wire.TreePath{{255}}), "rebuildIdentity": reconstructed.Own() == leaf.Own(),
		"keyCopy": label(wire.TreePath{{255}}) == "binary", "refusingExists": exists, "refusingSend": refusal != nil && addressedRefusal != nil, "admissions": admissions,
	}
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		panic(err)
	}
}

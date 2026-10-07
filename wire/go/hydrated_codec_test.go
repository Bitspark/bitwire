package wire_test

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"testing"

	core "github.com/Bitspark/bitwire/ontos/go/core"
	wire "github.com/Bitspark/bitwire/wire/go"
)

var codecLimits = wire.HydratedCodecLimits{Nodes: 10000, Depth: 100, Bytes: 1000000}

func dataAtom(s string) wire.HydratedDataAtom {
	return wire.NewHydratedDataAtom(core.NewAtom([]byte(s)))
}
func dataTuple(items ...wire.HydratedData) wire.HydratedDataTuple {
	v, err := wire.NewHydratedDataTuple(items...)
	if err != nil {
		panic(err)
	}
	return v
}
func dataReference(keys wire.Path, scope, id core.Atom) wire.HydratedReference {
	v, err := wire.NewHydratedReference(keys, scope, id)
	if err != nil {
		panic(err)
	}
	return v
}
func codecShape(value wire.HydratedData) any {
	switch v := value.(type) {
	case wire.HydratedDataAtom:
		return map[string]any{"atom": hex.EncodeToString(v.Value().Bytes())}
	case wire.HydratedReference:
		keys := []string{}
		for _, key := range v.Path() {
			keys = append(keys, hex.EncodeToString(key.Bytes()))
		}
		return map[string]any{"path": keys, "scope": hex.EncodeToString(v.Scope().Bytes()), "id": hex.EncodeToString(v.ID().Bytes())}
	case wire.HydratedDataTuple:
		items := []any{}
		for _, item := range v.Items() {
			items = append(items, codecShape(item))
		}
		return map[string]any{"tuple": items}
	default:
		panic("unexpected structural data")
	}
}
func TestPublicHydratedCodecVectors(t *testing.T) {
	type named struct {
		Name  string
		Value map[string]json.RawMessage
	}
	var vectors struct {
		Scopes, IDs map[string]string
		Encode      []struct {
			Name, Hex string
			Body      map[string]json.RawMessage
		}
		Frames []struct {
			Name, Scope, ID, Hex string
			Path                 []string
			Body                 map[string]json.RawMessage
		}
		RejectBody, RejectFrame []named
	}
	b, err := os.ReadFile("../../conformance/hydrated-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &vectors); err != nil {
		t.Fatal(err)
	}
	a := dataAtom
	ts := dataTuple
	r := func(keys []string, scope, id string) wire.HydratedReference {
		p := wire.Path{}
		for _, k := range keys {
			p = append(p, core.NewAtom([]byte(k)))
		}
		return dataReference(p, atom(vectors.Scopes[scope]), atom(vectors.IDs[id]))
	}
	client := r([]string{"client42"}, "S", "I1")
	// Semantic fixtures are constructed independently of the encoded corpus bodies.
	fixtures := []wire.HydratedData{
		a("hello"), a(""), a("\x01"), a("\x02"), ts(), ts(a("a"), a("b")), client, r(nil, "S", "I1"),
		dataReference(wire.Path{core.NewAtom(nil), core.NewAtom([]byte{255, 47})}, atom(vectors.Scopes["S2"]), atom(vectors.IDs["I7"])),
		ts(a("echo"), a("hello"), client),
		ts(a("hello"), ts(r([]string{"a", "b", "service2"}, "S2", "I7"), r([]string{"client42"}, "S", "I2"))),
		ts(client, client),
		ts(a("\x02"), ts(ts(a("client42")), wire.NewHydratedDataAtom(atom(vectors.Scopes["S"])), wire.NewHydratedDataAtom(atom(vectors.IDs["I1"])))),
		ts(a("\x01"), ts()),
	}
	if len(fixtures) != len(vectors.Encode) {
		t.Fatal("fixture coverage")
	}
	for i, c := range vectors.Encode {
		t.Run(c.Name, func(t *testing.T) {
			packed, err := wire.PackHydratedBody(fixtures[i], codecLimits)
			if err != nil {
				t.Fatal(err)
			}
			bytes, err := wire.EncodeMessage(packed, codecLimits.Bytes)
			if err != nil || hex.EncodeToString(bytes) != c.Hex {
				t.Fatalf("independent bytes: %x %v", bytes, err)
			}
			decoded, err := wire.UnpackHydratedBody(value(c.Body), codecLimits)
			if err != nil || !reflect.DeepEqual(codecShape(decoded), codecShape(fixtures[i])) {
				t.Fatal("decoded structure", err)
			}
		})
	}
	bodies := []wire.HydratedData{fixtures[9], ts(a("hello"), r([]string{"a", "b", "service2"}, "S2", "I8")), a("ping")}
	for i, c := range vectors.Frames {
		t.Run(c.Name, func(t *testing.T) {
			packed, err := wire.PackHydratedFrame(wire.HydratedFrame{Scope: atom(c.Scope), ID: atom(c.ID), Body: bodies[i]}, codecLimits)
			if err != nil {
				t.Fatal(err)
			}
			addressed, err := wire.PackAddressed(path(c.Path), packed)
			if err != nil {
				t.Fatal(err)
			}
			bytes, err := wire.EncodeMessage(addressed, codecLimits.Bytes)
			if err != nil || hex.EncodeToString(bytes) != c.Hex {
				t.Fatalf("independent frame bytes: %x %v", bytes, err)
			}
			fixed, _ := hex.DecodeString(c.Hex)
			v, err := wire.DecodeMessage(fixed, codecLimits.Bytes)
			if err != nil {
				t.Fatal(err)
			}
			_, frame, err := wire.UnpackAddressed(v)
			if err != nil {
				t.Fatal(err)
			}
			decoded, err := wire.UnpackHydratedFrame(frame, codecLimits)
			if err != nil || !decoded.Scope.Equal(atom(c.Scope)) || !decoded.ID.Equal(atom(c.ID)) || !reflect.DeepEqual(codecShape(decoded.Body), codecShape(bodies[i])) {
				t.Fatal("decoded frame", err)
			}
		})
	}
	for _, c := range vectors.RejectBody {
		t.Run(c.Name, func(t *testing.T) {
			got, err := wire.UnpackHydratedBody(value(c.Value), codecLimits)
			if got != nil || !errors.Is(err, wire.ErrHydratedMalformed) {
				t.Fatal("expected complete refusal", err)
			}
		})
	}
	for _, c := range vectors.RejectFrame {
		t.Run(c.Name, func(t *testing.T) {
			got, err := wire.UnpackHydratedFrame(value(c.Value), codecLimits)
			if got.Body != nil || !errors.Is(err, wire.ErrHydratedMalformed) {
				t.Fatal("expected complete refusal", err)
			}
		})
	}
}

func TestHydratedCodecCaptureAndGroundData(t *testing.T) {
	token := core.NewAtom(make([]byte, 16))
	keys := wire.Path{core.NewAtom([]byte{255})}
	ref := dataReference(keys, token, token)
	children := []wire.HydratedData{ref}
	data := dataTuple(children...)
	keys[0] = core.NewAtom(nil)
	children[0] = dataAtom("changed")
	gotKeys := ref.Path()
	gotKeys[0] = core.NewAtom(nil)
	gotChildren := data.Items()
	gotChildren[0] = dataAtom("changed")
	// Reassigning the caller's value cannot mutate a captured child or create a cycle.
	ref = dataReference(nil, token, token)
	if data.At(0).(wire.HydratedReference).Path()[0].Len() != 1 || data.At(1) != nil {
		t.Fatal("caller storage escaped")
	}
	ordinary := core.NewTuple(core.NewAtom([]byte{2}), core.NewTuple(core.NewTuple(), token, token))
	structural, err := wire.HydratedDataFromGround(ordinary, codecLimits)
	if err != nil {
		t.Fatal(err)
	}
	packed, err := wire.PackHydratedBody(structural, codecLimits)
	if err != nil {
		t.Fatal(err)
	}
	unpacked, err := wire.UnpackHydratedBody(packed, codecLimits)
	if err != nil {
		t.Fatal(err)
	}
	got, err := wire.HydratedDataToGround(unpacked, codecLimits)
	if err != nil || !got.Equal(ordinary) {
		t.Fatal("ordinary data interpreted as a reference", err)
	}
	got, err = wire.HydratedDataToGround(dataTuple(dataAtom("ok"), ref), codecLimits)
	if got != nil || !errors.Is(err, wire.ErrHydratedMalformed) {
		t.Fatal("reference converted to ground", err)
	}
}

func TestHydratedCodecInclusiveBounds(t *testing.T) {
	token := core.NewAtom(make([]byte, 16))
	ref := dataReference(nil, token, token)
	data := dataTuple(ref, ref, ref)
	exact := wire.HydratedCodecLimits{Nodes: 4, Depth: 1, Bytes: 142} // 7 + 3*45
	body, err := wire.PackHydratedBody(data, exact)
	if err != nil {
		t.Fatal(err)
	}
	bytes, err := wire.EncodeMessage(body, 142)
	if err != nil || len(bytes) != 142 {
		t.Fatal("body size", err)
	}
	if _, err = wire.UnpackHydratedBody(body, exact); err != nil {
		t.Fatal(err)
	}
	for _, limits := range []wire.HydratedCodecLimits{{Nodes: 3, Depth: 1, Bytes: 142}, {Nodes: 4, Depth: 1, Bytes: 141}} {
		if _, err = wire.PackHydratedBody(data, limits); !errors.Is(err, wire.ErrHydratedLimit) {
			t.Fatal("encode boundary", err)
		}
		if _, err = wire.UnpackHydratedBody(body, limits); !errors.Is(err, wire.ErrHydratedLimit) {
			t.Fatal("decode boundary", err)
		}
	}
	frame := wire.HydratedFrame{Scope: token, ID: token, Body: data}
	frameBounds := exact
	frameBounds.Bytes = 200 // 142 + 58
	encoded, err := wire.PackHydratedFrame(frame, frameBounds)
	if err != nil {
		t.Fatal(err)
	}
	bytes, err = wire.EncodeMessage(encoded, 200)
	if err != nil || len(bytes) != 200 {
		t.Fatal("frame size", err)
	}
	if _, err = wire.UnpackHydratedFrame(encoded, frameBounds); err != nil {
		t.Fatal(err)
	}
	frameBounds.Bytes--
	if _, err = wire.PackHydratedFrame(frame, frameBounds); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("frame encode boundary", err)
	}
	if _, err = wire.UnpackHydratedFrame(encoded, frameBounds); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("frame decode boundary", err)
	}
	refBounds := wire.HydratedCodecLimits{Nodes: 1, Depth: 1, Bytes: 40}
	payload, err := wire.PackHydratedReference(ref, refBounds)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = wire.UnpackHydratedReference(payload, refBounds); err != nil {
		t.Fatal(err)
	}
	refBounds.Bytes--
	if _, err = wire.PackHydratedReference(ref, refBounds); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("reference encode boundary", err)
	}
	if _, err = wire.UnpackHydratedReference(payload, refBounds); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("reference decode boundary", err)
	}
	path := make(wire.Path, 5)
	nested := dataTuple(dataTuple(dataReference(path, token, token)))
	depthBounds := wire.HydratedCodecLimits{Nodes: 3, Depth: 2, Bytes: 69}
	body, err = wire.PackHydratedBody(nested, depthBounds)
	if err != nil {
		t.Fatal("path metadata is not tuple depth", err)
	}
	if _, err = wire.UnpackHydratedBody(body, depthBounds); err != nil {
		t.Fatal(err)
	}
	depthBounds.Depth--
	if _, err = wire.PackHydratedBody(nested, depthBounds); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("depth encode boundary", err)
	}
	if _, err = wire.UnpackHydratedBody(body, depthBounds); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("depth decode boundary", err)
	}
	for _, count := range []int{0, 127, 128} {
		items := make([]wire.HydratedData, count)
		for i := range items {
			items[i] = dataAtom("")
		}
		size := 7 + count*2
		if count >= 128 {
			size++
		}
		limits := wire.HydratedCodecLimits{Nodes: count + 1, Depth: 1, Bytes: size}
		data := dataTuple(items...)
		body, err := wire.PackHydratedBody(data, limits)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = wire.UnpackHydratedBody(body, limits); err != nil {
			t.Fatal(err)
		}
		limits.Bytes--
		if _, err = wire.PackHydratedBody(data, limits); !errors.Is(err, wire.ErrHydratedLimit) {
			t.Fatal("varint encode boundary", err)
		}
		if _, err = wire.UnpackHydratedBody(body, limits); !errors.Is(err, wire.ErrHydratedLimit) {
			t.Fatal("varint decode boundary", err)
		}
	}
}

type foreignHydrated struct{ wire.HydratedData }

func TestHydratedCodecRejectsForeignAndUnboundedValues(t *testing.T) {
	for _, v := range []wire.HydratedData{nil, (*wire.HydratedDataTuple)(nil), foreignHydrated{}, &wire.HydratedDataTuple{}, wire.HydratedReference{}} {
		if _, err := wire.PackHydratedBody(v, codecLimits); !errors.Is(err, wire.ErrHydratedMalformed) {
			t.Fatal("foreign value accepted", err)
		}
		if _, err := wire.NewHydratedDataTuple(v); !errors.Is(err, wire.ErrHydratedMalformed) {
			t.Fatal("foreign child accepted", err)
		}
	}
	if _, err := wire.NewHydratedReference(nil, core.NewAtom(nil), core.NewAtom(nil)); !errors.Is(err, wire.ErrHydratedMalformed) {
		t.Fatal(err)
	}
	for _, limits := range []wire.HydratedCodecLimits{{}, {Nodes: -1, Depth: 1, Bytes: 1}, {Nodes: 1, Depth: 0, Bytes: 1}, {Nodes: 1, Depth: 1, Bytes: 0}} {
		if _, err := wire.PackHydratedBody(dataAtom(""), limits); !errors.Is(err, wire.ErrHydratedOptions) {
			t.Fatal("invalid options", err)
		}
	}
	var data wire.HydratedData = dataAtom("")
	var ordinary core.Value = core.NewAtom(nil)
	for i := 0; i < 20000; i++ {
		data = dataTuple(data)
		ordinary = core.NewTuple(ordinary)
	}
	deep := wire.HydratedCodecLimits{Nodes: 20001, Depth: 20000, Bytes: 140002}
	packed, err := wire.PackHydratedBody(data, deep)
	if err != nil {
		t.Fatal(err)
	}
	unpacked, err := wire.UnpackHydratedBody(packed, deep)
	if err != nil {
		t.Fatal(err)
	}
	n := 0
	for {
		child, ok := unpacked.(wire.HydratedDataTuple)
		if !ok {
			break
		}
		n++
		unpacked = child.At(0)
	}
	if n != 20000 {
		t.Fatal("deep structure changed")
	}
	if _, err = wire.HydratedDataFromGround(ordinary, deep); err != nil {
		t.Fatal(err)
	}
	deep.Depth--
	if _, err = wire.UnpackHydratedBody(packed, deep); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("deep bound", err)
	}
	data = dataAtom("")
	ordinary = core.NewAtom(nil)
	for i := 0; i < 80; i++ {
		data = dataTuple(data, data)
		ordinary = core.NewTuple(ordinary, ordinary)
	}
	if _, err = wire.PackHydratedBody(data, codecLimits); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("shared tree encode bound", err)
	}
	if _, err = wire.HydratedDataFromGround(ordinary, codecLimits); !errors.Is(err, wire.ErrHydratedLimit) {
		t.Fatal("shared tree conversion bound", err)
	}
}

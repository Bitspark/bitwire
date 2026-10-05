package wire_test

import (
	"encoding/hex"
	"encoding/json"
	codec "github.com/Bitspark/bitwire/ontos/go/codec"
	core "github.com/Bitspark/bitwire/ontos/go/core"
	wire "github.com/Bitspark/bitwire/wire/go"
	"os"
	"testing"
)

func value(v map[string]json.RawMessage) core.Value {
	if raw, ok := v["atom"]; ok {
		var h string
		_ = json.Unmarshal(raw, &h)
		b, err := hex.DecodeString(h)
		if err != nil {
			panic(err)
		}
		return core.NewAtom(b)
	}
	var xs []map[string]json.RawMessage
	_ = json.Unmarshal(v["tuple"], &xs)
	items := make([]core.Value, len(xs))
	for i, x := range xs {
		items[i] = value(x)
	}
	return core.NewTuple(items...)
}
func atom(h string) core.Atom {
	b, err := hex.DecodeString(h)
	if err != nil {
		panic(err)
	}
	return core.NewAtom(b)
}
func path(keys []string) wire.Path {
	out := make(wire.Path, len(keys))
	for i, k := range keys {
		out[i] = atom(k)
	}
	return out
}
func TestIndependentMessageVectors(t *testing.T) {
	var vectors struct {
		Encode []struct {
			Name, Hex string
			Value     map[string]json.RawMessage
		}
		Addressed []struct {
			Name, Hex string
			Path      []string
			Message   map[string]json.RawMessage
		}
		Reject          []struct{ Name, Hex string }
		RejectAddressed []struct {
			Name  string
			Value map[string]json.RawMessage
		}
	}
	b, err := os.ReadFile("../../conformance/message-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, c := range vectors.Encode {
		t.Run(c.Name, func(t *testing.T) {
			v := value(c.Value)
			b, err := wire.EncodeMessage(v, wire.DefaultMaxMessageBytes)
			if err != nil || hex.EncodeToString(b) != c.Hex {
				t.Fatalf("independent bytes: %x %v", b, err)
			}
			d, err := wire.DecodeMessage(b, wire.DefaultMaxMessageBytes)
			if err != nil || !v.Equal(d) {
				t.Fatal("message changed", err)
			}
		})
	}
	for _, c := range vectors.Addressed {
		t.Run(c.Name, func(t *testing.T) {
			p, m := path(c.Path), value(c.Message)
			v, err := wire.PackAddressed(p, m)
			if err != nil {
				t.Fatal(err)
			}
			b, err := wire.EncodeMessage(v, wire.DefaultMaxMessageBytes)
			if err != nil || hex.EncodeToString(b) != c.Hex {
				t.Fatalf("independent addressed bytes: %x %v", b, err)
			}
			d, err := wire.DecodeMessage(b, wire.DefaultMaxMessageBytes)
			if err != nil {
				t.Fatal(err)
			}
			q, n, err := wire.UnpackAddressed(d)
			if err != nil || !wire.PathEqual(p, q) || !m.Equal(n) {
				t.Fatal("addressed message changed", err)
			}
		})
	}
	for _, c := range vectors.Reject {
		t.Run(c.Name, func(t *testing.T) {
			b, _ := hex.DecodeString(c.Hex)
			if _, err := wire.DecodeMessage(b, wire.DefaultMaxMessageBytes); err == nil {
				t.Fatal("invalid bytes accepted")
			}
		})
	}
	for _, c := range vectors.RejectAddressed {
		t.Run(c.Name, func(t *testing.T) {
			v := value(c.Value)
			if _, err := wire.EncodeMessage(v, wire.DefaultMaxMessageBytes); err != nil {
				t.Fatal("raw value refused", err)
			}
			if _, _, err := wire.UnpackAddressed(v); err == nil {
				t.Fatal("invalid addressed value accepted")
			}
		})
	}
}
func TestIndependentOntosCodecVectors(t *testing.T) {
	var vectors struct {
		Encode []struct {
			Name, Hex string
			Value     map[string]json.RawMessage
		}
		Reject []struct{ Name, Hex, Code string }
	}
	b, err := os.ReadFile("../../ontos/vectors/codec.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, c := range vectors.Encode {
		t.Run(c.Name, func(t *testing.T) {
			v := value(c.Value)
			b := codec.Encode(v)
			if hex.EncodeToString(b) != c.Hex {
				t.Fatal("codec changed")
			}
			d, err := codec.Decode(b)
			if err != nil || !d.Equal(v) {
				t.Fatal("roundtrip failed")
			}
		})
	}
	for _, c := range vectors.Reject {
		t.Run(c.Name, func(t *testing.T) {
			b, _ := hex.DecodeString(c.Hex)
			_, err := codec.Decode(b)
			d, ok := err.(*codec.DecodeError)
			if !ok || d.Code != c.Code {
				t.Fatalf("expected %s, got %v", c.Code, err)
			}
		})
	}
}
func TestExactPathsOwnershipAndBounds(t *testing.T) {
	if wire.PathEqual(nil, wire.Path{atom("")}) {
		t.Fatal("self confused with empty key")
	}
	if wire.PathEqual(wire.Path{atom("612f62")}, wire.Path{atom("61"), atom("62")}) {
		t.Fatal("slash parsed")
	}
	keys := wire.Path{atom("ff")}
	v, err := wire.PackAddressed(keys, core.NewTuple())
	if err != nil {
		t.Fatal(err)
	}
	keys[0] = atom("")
	p, _, err := wire.UnpackAddressed(v)
	if err != nil || p[0].Len() != 1 {
		t.Fatal("path capture aliased")
	}
	if _, err = wire.EncodeMessage(v, 1); err == nil {
		t.Fatal("limit not enforced")
	}
	if _, err = wire.EncodeMessage(nil, 100); err == nil {
		t.Fatal("nil message accepted")
	}
	var invalid *core.Atom
	if _, err = wire.EncodeMessage(invalid, 100); err == nil {
		t.Fatal("typed nil accepted")
	}
}

func TestImpossibleTupleLengthRefusedBeforeAllocation(t *testing.T) {
	b, _ := hex.DecodeString("01ffffff07")
	_, err := wire.DecodeMessage(b, wire.DefaultMaxMessageBytes)
	d, ok := err.(*codec.DecodeError)
	if !ok || d.Code != "limit_exceeded" {
		t.Fatalf("expected preallocation limit, got %v", err)
	}
}

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
func TestIndependentEnvelopeVectors(t *testing.T) {
	var vectors struct {
		Encode []struct {
			Name     string
			Hex      string
			Envelope struct {
				Source, Destination []string
				ID                  string
				Correlation         *string
				Payload             map[string]json.RawMessage
			}
		}
		Reject []struct{ Name, Hex string }
	}
	b, err := os.ReadFile("../../conformance/envelope-vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(b, &vectors); err != nil {
		t.Fatal(err)
	}
	for _, c := range vectors.Encode {
		t.Run(c.Name, func(t *testing.T) {
			e := wire.Envelope{Source: path(c.Envelope.Source), Destination: path(c.Envelope.Destination), ID: atom(c.Envelope.ID), Payload: value(c.Envelope.Payload)}
			if c.Envelope.Correlation != nil {
				a := atom(*c.Envelope.Correlation)
				e.Correlation = &a
			}
			b, err := wire.EncodeEnvelope(e, wire.DefaultMaxEnvelopeBytes)
			if err != nil {
				t.Fatal(err)
			}
			if hex.EncodeToString(b) != c.Hex {
				t.Fatal("independent byte mismatch")
			}
			d, err := wire.DecodeEnvelope(b, wire.DefaultMaxEnvelopeBytes)
			if err != nil {
				t.Fatal(err)
			}
			if !wire.PathEqual(e.Source, d.Source) || !wire.PathEqual(e.Destination, d.Destination) || !e.ID.Equal(d.ID) || !e.Payload.Equal(d.Payload) || (e.Correlation == nil) != (d.Correlation == nil) {
				t.Fatal("envelope changed")
			}
			if e.Correlation != nil && !e.Correlation.Equal(*d.Correlation) {
				t.Fatal("correlation changed")
			}
		})
	}
	for _, c := range vectors.Reject {
		t.Run(c.Name, func(t *testing.T) {
			b, _ := hex.DecodeString(c.Hex)
			if _, err := wire.DecodeEnvelope(b, wire.DefaultMaxEnvelopeBytes); err == nil {
				t.Fatal("malformed envelope accepted")
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
	e := wire.Envelope{Source: wire.Path{atom("ff")}, Payload: core.NewTuple()}
	c, err := wire.CaptureEnvelope(e)
	if err != nil {
		t.Fatal(err)
	}
	e.Source[0] = atom("")
	if c.Source[0].Len() != 1 {
		t.Fatal("capture aliased")
	}
	if _, err = wire.EncodeEnvelope(c, 1); err == nil {
		t.Fatal("limit not enforced")
	}
	if _, err = wire.CaptureEnvelope(wire.Envelope{}); err == nil {
		t.Fatal("nil payload accepted")
	}
}

func TestImpossibleTupleLengthRefusedBeforeAllocation(t *testing.T) {
	b, _ := hex.DecodeString("01ffffff07")
	_, err := wire.DecodeEnvelope(b, wire.DefaultMaxEnvelopeBytes)
	d, ok := err.(*codec.DecodeError)
	if !ok || d.Code != "limit_exceeded" {
		t.Fatalf("expected preallocation limit, got %v", err)
	}
}

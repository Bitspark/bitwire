package wire_test

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"

	core "github.com/Bitspark/bitwire/ontos/go/core"
	wire "github.com/Bitspark/bitwire/wire/go"
)

// Decision 0019 (proposed): a test-local reading of the bitwire/hydrated/1
// grammar, so the independent vectors judge a future codec rather than describe one.
var errHydrated = errors.New("hydrated: malformed")

func atomOf(v core.Value, min, max int) (core.Atom, error) {
	a, ok := v.(core.Atom)
	if !ok || a.Len() < min || a.Len() > max {
		return core.Atom{}, errHydrated
	}
	return a, nil
}

func tupleOf(v core.Value, n int) (core.Tuple, error) {
	t, ok := v.(core.Tuple)
	if !ok || (n >= 0 && t.Len() != n) {
		return core.Tuple{}, errHydrated
	}
	return t, nil
}

// hydratedWires reads a body and counts its wire leaves.
func hydratedWires(v core.Value) (int, error) {
	if _, ok := v.(core.Atom); ok {
		return 0, nil
	}
	t, err := tupleOf(v, 2)
	if err != nil {
		return 0, err
	}
	tag, err := atomOf(t.At(0), 1, 1)
	if err != nil {
		return 0, err
	}
	switch tag.Bytes()[0] {
	case 1:
		children, err := tupleOf(t.At(1), -1)
		if err != nil {
			return 0, err
		}
		n := 0
		for _, c := range children.Items() {
			k, err := hydratedWires(c)
			if err != nil {
				return 0, err
			}
			n += k
		}
		return n, nil
	case 2:
		ref, err := tupleOf(t.At(1), 3)
		if err != nil {
			return 0, err
		}
		p, err := tupleOf(ref.At(0), -1)
		if err != nil {
			return 0, err
		}
		for _, segment := range p.Items() {
			if _, err := atomOf(segment, 0, int(^uint(0)>>1)); err != nil {
				return 0, err
			}
		}
		if _, err := atomOf(ref.At(1), 16, 16); err != nil {
			return 0, err
		}
		if _, err := atomOf(ref.At(2), 1, 16); err != nil {
			return 0, err
		}
		return 1, nil
	}
	return 0, errHydrated
}

var hydratedHeader = core.NewAtom([]byte("bitwire/hydrated/1"))

func hydratedFrame(v core.Value) error {
	f, err := tupleOf(v, 4)
	if err != nil {
		return err
	}
	if !hydratedHeader.Equal(f.At(0)) {
		return errHydrated
	}
	if _, err := atomOf(f.At(1), 16, 16); err != nil {
		return err
	}
	if _, err := atomOf(f.At(2), 1, 16); err != nil {
		return err
	}
	_, err = hydratedWires(f.At(3))
	return err
}

func TestIndependentHydratedVectors(t *testing.T) {
	type named struct {
		Name  string
		Value map[string]json.RawMessage
	}
	var vectors struct {
		Encode []struct {
			Name, Live, Hex string
			Body            map[string]json.RawMessage
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
	for _, c := range vectors.Encode {
		t.Run(c.Name, func(t *testing.T) {
			v := value(c.Body)
			b, err := wire.EncodeMessage(v, wire.DefaultMaxMessageBytes)
			if err != nil || hex.EncodeToString(b) != c.Hex {
				t.Fatalf("independent bytes: %x %v", b, err)
			}
			n, err := hydratedWires(v)
			if err != nil || n != strings.Count(c.Live, "wire{") {
				t.Fatalf("wire leaves %d, %v", n, err)
			}
		})
	}
	for _, c := range vectors.Frames {
		t.Run(c.Name, func(t *testing.T) {
			f := core.NewTuple(hydratedHeader, atom(c.Scope), atom(c.ID), value(c.Body))
			v, err := wire.PackAddressed(path(c.Path), f)
			if err != nil {
				t.Fatal(err)
			}
			b, err := wire.EncodeMessage(v, wire.DefaultMaxMessageBytes)
			if err != nil || hex.EncodeToString(b) != c.Hex {
				t.Fatalf("independent frame bytes: %x %v", b, err)
			}
			p, m, err := wire.UnpackAddressed(v)
			if err != nil || !wire.PathEqual(p, path(c.Path)) || hydratedFrame(m) != nil {
				t.Fatal("frame changed", err)
			}
		})
	}
	for _, c := range vectors.RejectBody {
		t.Run(c.Name, func(t *testing.T) {
			if _, err := hydratedWires(value(c.Value)); err == nil {
				t.Fatal("malformed body accepted")
			}
		})
	}
	for _, c := range vectors.RejectFrame {
		t.Run(c.Name, func(t *testing.T) {
			if hydratedFrame(value(c.Value)) == nil {
				t.Fatal("malformed frame accepted")
			}
		})
	}
}

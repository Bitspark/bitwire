package wire

import (
	"errors"
	codec "github.com/Bitspark/bitwire/ontos/go/codec"
	core "github.com/Bitspark/bitwire/ontos/go/core"
)

const WebSocketProtocol = "bitwire.ontos.v1"
const MaxEnvelopeDepth = 4096
const DefaultMaxEnvelopeBytes = 16 * 1024 * 1024

var version = core.NewAtom([]byte("bitwire/envelope/1"))

func PathEqual(a, b Path) bool {
	if len(a) != len(b) {
		return false
	}
	return PathStartsWith(a, b)
}
func PathStartsWith(a, prefix Path) bool {
	if len(a) < len(prefix) {
		return false
	}
	for i, k := range prefix {
		if !k.Equal(a[i]) {
			return false
		}
	}
	return true
}
func CaptureEnvelope(e Envelope) (Envelope, error) {
	if e.Payload == nil {
		return Envelope{}, errors.New("missing envelope payload")
	}
	e.Source = append(Path{}, e.Source...)
	e.Destination = append(Path{}, e.Destination...)
	if e.Correlation != nil {
		c := *e.Correlation
		e.Correlation = &c
	}
	return e, nil
}
func pathValue(p Path) core.Tuple {
	items := make([]core.Value, len(p))
	for i, k := range p {
		items[i] = k
	}
	return core.NewTuple(items...)
}
func EncodeEnvelope(e Envelope, maxBytes int) ([]byte, error) {
	if maxBytes <= 0 {
		return nil, errors.New("limit must be positive")
	}
	e, err := CaptureEnvelope(e)
	if err != nil {
		return nil, err
	}
	correlation := []core.Value{}
	if e.Correlation != nil {
		correlation = append(correlation, *e.Correlation)
	}
	v := core.NewTuple(version, pathValue(e.Source), pathValue(e.Destination), e.ID, core.NewTuple(correlation...), e.Payload)
	type pending struct {
		v     core.Value
		depth int
	}
	stack := []pending{{v, 0}}
	size := 0
	for len(stack) > 0 {
		p := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if p.depth > MaxEnvelopeDepth {
			return nil, errors.New("envelope depth limit")
		}
		n := 0
		switch value := p.v.(type) {
		case core.Atom:
			n = value.Len()
			if n > maxBytes-size {
				return nil, errors.New("envelope byte limit")
			}
			size += n
		case core.Tuple:
			n = value.Len()
			if n > (maxBytes-size)/2 {
				return nil, errors.New("envelope byte limit")
			}
			for _, c := range value.Items() {
				stack = append(stack, pending{c, p.depth + 1})
			}
		}
		size++
		for {
			size++
			n >>= 7
			if n == 0 {
				break
			}
		}
		if size > maxBytes {
			return nil, errors.New("envelope byte limit")
		}
	}
	return codec.Encode(v), nil
}
func DecodeEnvelope(bytes []byte, maxBytes int) (Envelope, error) {
	if maxBytes <= 0 || len(bytes) > maxBytes {
		return Envelope{}, errors.New("envelope byte limit")
	}
	v, err := codec.DecodeWithLimits(bytes, codec.Limits{MaxDepth: MaxEnvelopeDepth, MaxAtomBytes: maxBytes, MaxTupleArity: maxBytes})
	if err != nil {
		return Envelope{}, err
	}
	t, ok := v.(core.Tuple)
	if !ok || t.Len() != 6 || !version.Equal(t.At(0)) {
		return Envelope{}, errors.New("envelope version or arity")
	}
	source, err := readPath(t.At(1))
	if err != nil {
		return Envelope{}, err
	}
	destination, err := readPath(t.At(2))
	if err != nil {
		return Envelope{}, err
	}
	id, ok := t.At(3).(core.Atom)
	if !ok {
		return Envelope{}, errors.New("invalid envelope ID")
	}
	c, ok := t.At(4).(core.Tuple)
	if !ok || c.Len() > 1 {
		return Envelope{}, errors.New("invalid correlation")
	}
	e := Envelope{Source: source, Destination: destination, ID: id, Payload: t.At(5)}
	if c.Len() == 1 {
		a, ok := c.At(0).(core.Atom)
		if !ok {
			return Envelope{}, errors.New("invalid correlation")
		}
		e.Correlation = &a
	}
	return e, nil
}
func readPath(v core.Value) (Path, error) {
	t, ok := v.(core.Tuple)
	if !ok {
		return nil, errors.New("invalid path")
	}
	p := make(Path, t.Len())
	for i, v := range t.Items() {
		a, ok := v.(core.Atom)
		if !ok {
			return nil, errors.New("invalid path key")
		}
		p[i] = a
	}
	return p, nil
}

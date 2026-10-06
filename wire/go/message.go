package wire

import (
	"errors"
	codec "github.com/Bitspark/bitwire/ontos/go/codec"
	core "github.com/Bitspark/bitwire/ontos/go/core"
)

const WebSocketProtocol = "bitwire.ontos.v2"
const MaxMessageDepth = 4096
const DefaultMaxMessageBytes = 16 * 1024 * 1024

var addressedVersion = core.NewAtom([]byte("bitwire/addressed/1"))

func PathEqual(a, b Path) bool {
	return len(a) == len(b) && PathStartsWith(a, b)
}
func PathStartsWith(a, prefix Path) bool {
	if len(a) < len(prefix) {
		return false
	}
	for i, key := range prefix {
		if !key.Equal(a[i]) {
			return false
		}
	}
	return true
}
func PackAddressed(path Path, message core.Value) (core.Value, error) {
	if message == nil {
		return nil, errors.New("nil message")
	}
	keys := make([]core.Value, len(path))
	for i, key := range path {
		keys[i] = key
	}
	return core.NewTuple(addressedVersion, core.NewTuple(keys...), message), nil
}
func UnpackAddressed(value core.Value) (Path, core.Value, error) {
	t, ok := value.(core.Tuple)
	if !ok || t.Len() != 3 || !addressedVersion.Equal(t.At(0)) {
		return nil, nil, errors.New("addressed version or arity")
	}
	keys, ok := t.At(1).(core.Tuple)
	if !ok {
		return nil, nil, errors.New("addressed path must be a tuple")
	}
	path := make(Path, keys.Len())
	for i, value := range keys.Items() {
		key, ok := value.(core.Atom)
		if !ok {
			return nil, nil, errors.New("path key must be an atom")
		}
		path[i] = key
	}
	return path, t.At(2), nil
}
func EncodeMessage(message core.Value, maxBytes int) ([]byte, error) {
	if maxBytes <= 0 {
		return nil, errors.New("limit must be positive")
	}
	type pending struct {
		value core.Value
		depth int
	}
	stack := []pending{{message, 0}}
	size := 0
	for len(stack) > 0 {
		p := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if p.depth > MaxMessageDepth {
			return nil, errors.New("message depth limit")
		}
		n := 0
		switch value := p.value.(type) {
		case core.Atom:
			n = value.Len()
			if n > maxBytes-size {
				return nil, errors.New("message byte limit")
			}
			size += n
		case core.Tuple:
			n = value.Len()
			if n > (maxBytes-size)/2 {
				return nil, errors.New("message byte limit")
			}
			for _, child := range value.Items() {
				stack = append(stack, pending{child, p.depth + 1})
			}
		default:
			return nil, errors.New("message must contain ground atom or tuple values")
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
			return nil, errors.New("message byte limit")
		}
	}
	return codec.Encode(message), nil
}
func DecodeMessage(bytes []byte, maxBytes int) (core.Value, error) {
	if maxBytes <= 0 || len(bytes) > maxBytes {
		return nil, errors.New("message byte limit")
	}
	return codec.DecodeWithLimits(bytes, codec.Limits{MaxDepth: MaxMessageDepth,
		MaxAtomBytes: len(bytes), MaxTupleArity: len(bytes) / 2})
}

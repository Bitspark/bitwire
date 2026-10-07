package wire

import (
	"errors"

	core "github.com/Bitspark/bitwire/ontos/go/core"
)

// HydratedCodecLimits bounds semantic nodes, tuple depth (root zero), and both
// semantic payload bytes and encoded bytes. All three bounds are inclusive and positive.
type HydratedCodecLimits struct{ Nodes, Depth, Bytes int }

var (
	ErrHydratedMalformed = errors.New("hydrated codec: malformed")
	ErrHydratedLimit     = errors.New("hydrated codec: limit")
	ErrHydratedOptions   = errors.New("hydrated codec limits must be positive")
)

// HydratedData is pure structural data, never a live Wire or an export registry.
type HydratedData interface{ hydratedData() }

type HydratedDataAtom struct{ value core.Atom }
type HydratedDataTuple struct{ items []HydratedData }

// HydratedReference describes a reference. Valid shape implies no liveness or authority.
type HydratedReference struct {
	path      Path
	scope, id core.Atom
}

func (HydratedDataAtom) hydratedData()  {}
func (HydratedDataTuple) hydratedData() {}
func (HydratedReference) hydratedData() {}

func NewHydratedDataAtom(value core.Atom) HydratedDataAtom {
	return HydratedDataAtom{value: value}
}
func (a HydratedDataAtom) Value() core.Atom { return a.value }

func NewHydratedDataTuple(items ...HydratedData) (HydratedDataTuple, error) {
	for _, item := range items {
		if !validHydratedData(item) {
			return HydratedDataTuple{}, ErrHydratedMalformed
		}
	}
	return HydratedDataTuple{items: append([]HydratedData(nil), items...)}, nil
}
func (t HydratedDataTuple) Len() int              { return len(t.items) }
func (t HydratedDataTuple) Items() []HydratedData { return append([]HydratedData(nil), t.items...) }
func (t HydratedDataTuple) At(index int) HydratedData {
	if index < 0 || index >= len(t.items) {
		return nil
	}
	return t.items[index]
}

func NewHydratedReference(path Path, scope, id core.Atom) (HydratedReference, error) {
	if scope.Len() != 16 || id.Len() != 16 {
		return HydratedReference{}, ErrHydratedMalformed
	}
	return HydratedReference{path: append(Path(nil), path...), scope: scope, id: id}, nil
}
func (r HydratedReference) Path() Path       { return append(Path(nil), r.path...) }
func (r HydratedReference) Scope() core.Atom { return r.scope }
func (r HydratedReference) ID() core.Atom    { return r.id }

type HydratedFrame struct {
	Scope, ID core.Atom
	Body      HydratedData
}

var hydratedHeader = core.NewAtom([]byte("bitwire/hydrated/1"))
var hydratedTupleTag = core.NewAtom([]byte{1})
var hydratedReferenceTag = core.NewAtom([]byte{2})

const hydratedFrameOverhead = 58 // tuple header + 18-octet version + two 16-octet tokens

func validHydratedData(value HydratedData) bool {
	switch v := value.(type) {
	case HydratedDataAtom:
		return true
	case HydratedDataTuple:
		return true
	case HydratedReference:
		return v.scope.Len() == 16 && v.id.Len() == 16
	default:
		return false
	}
}
func (l HydratedCodecLimits) validate() error {
	if l.Nodes <= 0 || l.Depth <= 0 || l.Bytes <= 0 {
		return ErrHydratedOptions
	}
	return nil
}
func hydratedVarintSize(n int) int {
	size := 1
	for n >= 128 {
		n >>= 7
		size++
	}
	return size
}

type hydratedBudget struct {
	limits                          HydratedCodecLimits
	nodes, valueBytes, encodedBytes int
}

func (b *hydratedBudget) node(depth int) error {
	if b.nodes >= b.limits.Nodes || depth > b.limits.Depth {
		return ErrHydratedLimit
	}
	b.nodes++
	return nil
}
func hydratedAdd(total *int, amount, limit int) error {
	if amount > limit-*total {
		return ErrHydratedLimit
	}
	*total += amount
	return nil
}
func (b *hydratedBudget) payload(n int) error {
	return hydratedAdd(&b.valueBytes, n, b.limits.Bytes)
}
func (b *hydratedBudget) encoded(n int) error {
	return hydratedAdd(&b.encodedBytes, n, b.limits.Bytes)
}
func (b *hydratedBudget) atom(a core.Atom) error {
	if err := b.payload(a.Len()); err != nil {
		return err
	}
	if err := b.encoded(a.Len()); err != nil {
		return err
	}
	return b.encoded(1 + hydratedVarintSize(a.Len()))
}
func (b *hydratedBudget) reference(r HydratedReference, tagged bool) error {
	if err := b.payload(32); err != nil {
		return err
	}
	overhead := 39 + hydratedVarintSize(len(r.path))
	if tagged {
		overhead += 5
	}
	if err := b.encoded(overhead); err != nil {
		return err
	}
	for _, key := range r.path {
		if err := b.atom(key); err != nil {
			return err
		}
	}
	return nil
}

func measureHydrated(root HydratedData, limits HydratedCodecLimits, prefix int, referenceOnly bool) error {
	if err := limits.validate(); err != nil {
		return err
	}
	b := hydratedBudget{limits: limits}
	if err := b.encoded(prefix); err != nil {
		return err
	}
	type entry struct {
		node  HydratedData
		depth int
	}
	pending := []entry{{root, 0}}
	for len(pending) != 0 {
		e := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if !validHydratedData(e.node) {
			return ErrHydratedMalformed
		}
		if err := b.node(e.depth); err != nil {
			return err
		}
		switch v := e.node.(type) {
		case HydratedDataAtom:
			if err := b.atom(v.value); err != nil {
				return err
			}
		case HydratedReference:
			if err := b.reference(v, !referenceOnly); err != nil {
				return err
			}
		case HydratedDataTuple:
			if err := b.encoded(6 + hydratedVarintSize(len(v.items))); err != nil {
				return err
			}
			if len(v.items) > limits.Nodes-b.nodes-len(pending) {
				return ErrHydratedLimit
			}
			for _, child := range v.items {
				pending = append(pending, entry{child, e.depth + 1})
			}
		}
	}
	return nil
}

// Inspect raw size without allocating an encoded buffer or recursing into the input.
func checkHydratedEncoded(root core.Value, maxBytes int) error {
	total := 0
	pending := []core.Value{root}
	for len(pending) != 0 {
		value := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		switch v := value.(type) {
		case core.Atom:
			if err := hydratedAdd(&total, v.Len(), maxBytes); err != nil {
				return err
			}
			if err := hydratedAdd(&total, 1+hydratedVarintSize(v.Len()), maxBytes); err != nil {
				return err
			}
		case core.Tuple:
			if err := hydratedAdd(&total, 1+hydratedVarintSize(v.Len()), maxBytes); err != nil {
				return err
			}
			if v.Len() > (maxBytes-total)/2-len(pending) {
				return ErrHydratedLimit
			}
			for i := 0; i < v.Len(); i++ {
				pending = append(pending, v.At(i))
			}
		default:
			return ErrHydratedMalformed
		}
	}
	return nil
}
func hydratedReferenceValue(r HydratedReference) core.Value {
	keys := make([]core.Value, len(r.path))
	for i, key := range r.path {
		keys[i] = key
	}
	return core.NewTuple(core.NewTuple(keys...), r.scope, r.id)
}
func readHydratedReference(value core.Value) (HydratedReference, error) {
	t, ok := value.(core.Tuple)
	if !ok || t.Len() != 3 {
		return HydratedReference{}, ErrHydratedMalformed
	}
	keys, ok := t.At(0).(core.Tuple)
	scope, scopeOK := t.At(1).(core.Atom)
	id, idOK := t.At(2).(core.Atom)
	if !ok || !scopeOK || !idOK || scope.Len() != 16 || id.Len() != 16 {
		return HydratedReference{}, ErrHydratedMalformed
	}
	path := make(Path, keys.Len())
	for i := range path {
		key, ok := keys.At(i).(core.Atom)
		if !ok {
			return HydratedReference{}, ErrHydratedMalformed
		}
		path[i] = key
	}
	return NewHydratedReference(path, scope, id)
}

// Called only after complete validation. The result stack avoids Go recursion.
func buildHydratedBody(root HydratedData, groundOnly bool) (core.Value, error) {
	type entry struct {
		node   HydratedData
		finish bool
	}
	pending := []entry{{node: root}}
	var results []core.Value
	for len(pending) != 0 {
		e := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		switch v := e.node.(type) {
		case HydratedDataAtom:
			results = append(results, v.value)
		case HydratedReference:
			if groundOnly {
				return nil, ErrHydratedMalformed
			}
			results = append(results, core.NewTuple(hydratedReferenceTag, hydratedReferenceValue(v)))
		case HydratedDataTuple:
			if !e.finish {
				pending = append(pending, entry{node: v, finish: true})
				for i := len(v.items) - 1; i >= 0; i-- {
					pending = append(pending, entry{node: v.items[i]})
				}
				continue
			}
			start := len(results) - len(v.items)
			var value core.Value = core.NewTuple(results[start:]...)
			if !groundOnly {
				value = core.NewTuple(hydratedTupleTag, value)
			}
			results = append(results[:start], value)
		}
	}
	return results[0], nil
}

func readHydratedBody(root core.Value, limits HydratedCodecLimits, groundOnly bool) (HydratedData, error) {
	type entry struct {
		value core.Value
		depth int
		arity int // -1 means enter; nonnegative means finish a tuple
	}
	b := hydratedBudget{limits: limits}
	pending := []entry{{root, 0, -1}}
	var results []HydratedData
	for len(pending) != 0 {
		e := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if e.arity >= 0 {
			start := len(results) - e.arity
			t, err := NewHydratedDataTuple(results[start:]...)
			if err != nil {
				return nil, err
			}
			results = append(results[:start], t)
			continue
		}
		if err := b.node(e.depth); err != nil {
			return nil, err
		}
		if a, ok := e.value.(core.Atom); ok {
			if err := b.atom(a); err != nil {
				return nil, err
			}
			results = append(results, NewHydratedDataAtom(a))
			continue
		}
		t, ok := e.value.(core.Tuple)
		if !ok {
			return nil, ErrHydratedMalformed
		}
		nested := t
		if !groundOnly {
			if t.Len() != 2 {
				return nil, ErrHydratedMalformed
			}
			if hydratedReferenceTag.Equal(t.At(0)) {
				r, err := readHydratedReference(t.At(1))
				if err != nil {
					return nil, err
				}
				if err = b.reference(r, true); err != nil {
					return nil, err
				}
				results = append(results, r)
				continue
			}
			nested, ok = t.At(1).(core.Tuple)
			if !hydratedTupleTag.Equal(t.At(0)) || !ok {
				return nil, ErrHydratedMalformed
			}
		}
		if err := b.encoded(6 + hydratedVarintSize(nested.Len())); err != nil {
			return nil, err
		}
		if nested.Len() > limits.Nodes-b.nodes {
			return nil, ErrHydratedLimit
		}
		pending = append(pending, entry{arity: nested.Len()})
		for i := nested.Len() - 1; i >= 0; i-- {
			pending = append(pending, entry{nested.At(i), e.depth + 1, -1})
		}
	}
	return results[0], nil
}

func HydratedDataFromGround(value core.Value, limits HydratedCodecLimits) (HydratedData, error) {
	if err := limits.validate(); err != nil {
		return nil, err
	}
	return readHydratedBody(value, limits, true)
}
func HydratedDataToGround(value HydratedData, limits HydratedCodecLimits) (core.Value, error) {
	if err := measureHydrated(value, limits, 0, false); err != nil {
		return nil, err
	}
	return buildHydratedBody(value, true)
}
func PackHydratedBody(value HydratedData, limits HydratedCodecLimits) (core.Value, error) {
	if err := measureHydrated(value, limits, 0, false); err != nil {
		return nil, err
	}
	return buildHydratedBody(value, false)
}
func UnpackHydratedBody(value core.Value, limits HydratedCodecLimits) (HydratedData, error) {
	if err := limits.validate(); err != nil {
		return nil, err
	}
	if err := checkHydratedEncoded(value, limits.Bytes); err != nil {
		return nil, err
	}
	return readHydratedBody(value, limits, false)
}
func PackHydratedReference(value HydratedReference, limits HydratedCodecLimits) (core.Value, error) {
	if err := measureHydrated(value, limits, 0, true); err != nil {
		return nil, err
	}
	return hydratedReferenceValue(value), nil
}
func UnpackHydratedReference(value core.Value, limits HydratedCodecLimits) (HydratedReference, error) {
	if err := limits.validate(); err != nil {
		return HydratedReference{}, err
	}
	if err := checkHydratedEncoded(value, limits.Bytes); err != nil {
		return HydratedReference{}, err
	}
	r, err := readHydratedReference(value)
	if err != nil {
		return HydratedReference{}, err
	}
	if err := measureHydrated(r, limits, 0, true); err != nil {
		return HydratedReference{}, err
	}
	return r, nil
}
func PackHydratedFrame(frame HydratedFrame, limits HydratedCodecLimits) (core.Value, error) {
	if err := limits.validate(); err != nil {
		return nil, err
	}
	if frame.Scope.Len() != 16 || frame.ID.Len() != 16 {
		return nil, ErrHydratedMalformed
	}
	if err := measureHydrated(frame.Body, limits, hydratedFrameOverhead, false); err != nil {
		return nil, err
	}
	body, err := buildHydratedBody(frame.Body, false)
	if err != nil {
		return nil, err
	}
	return core.NewTuple(hydratedHeader, frame.Scope, frame.ID, body), nil
}
func UnpackHydratedFrame(value core.Value, limits HydratedCodecLimits) (HydratedFrame, error) {
	var zero HydratedFrame
	if err := limits.validate(); err != nil {
		return zero, err
	}
	if err := checkHydratedEncoded(value, limits.Bytes); err != nil {
		return zero, err
	}
	t, ok := value.(core.Tuple)
	if !ok || t.Len() != 4 || !hydratedHeader.Equal(t.At(0)) {
		return zero, ErrHydratedMalformed
	}
	scope, scopeOK := t.At(1).(core.Atom)
	id, idOK := t.At(2).(core.Atom)
	if !scopeOK || !idOK || scope.Len() != 16 || id.Len() != 16 {
		return zero, ErrHydratedMalformed
	}
	body, err := readHydratedBody(t.At(3), limits, false)
	if err != nil {
		return zero, err
	}
	return HydratedFrame{Scope: scope, ID: id, Body: body}, nil
}

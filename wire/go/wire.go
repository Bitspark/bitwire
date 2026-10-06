// Package wire declares addressless interaction and addressed access.
package wire

import core "github.com/Bitspark/bitwire/ontos/go/core"

type Path []core.Atom
type Termination struct {
	Kind    string
	Message string
}

// Closed broadcasts resource release. Termination is stable after Closed closes.
// Send returns local admission only. Receive has one detachable owner.
type Wire interface {
	Send(core.Value) error
}
type Endpoint interface {
	Wire
	Receive(func(core.Value)) (func(), error)
	Closed() <-chan struct{}
	Termination() Termination
	Close() error
}
type AddressedWire interface {
	Send(Path, core.Value) error
}
type AddressedEndpoint interface {
	AddressedWire
	Receive(func(Path, core.Value)) (func(), error)
	Closed() <-chan struct{}
	Termination() Termination
	Close() error
}
type WireNode = DeixisNode[Wire]
type Child[T any] struct {
	Key  core.Atom
	Node DeixisNode[T]
}
type Parts[T any] struct {
	Own      T
	Children []Child[T]
}
type DeixisNode[T any] interface {
	Own() T
	Children() []Child[T]
	At(Path) (DeixisNode[T], bool)
	Decompose() Parts[T]
}

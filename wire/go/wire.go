// Package wire declares the generic envelope wire. Implementations live in bitruntime.
package wire

import core "github.com/Bitspark/bitwire/ontos/go/core"

type Path []core.Atom
type Envelope struct {
	Source      Path
	Destination Path
	ID          core.Atom
	Correlation *core.Atom
	Payload     core.Value
}
type Termination struct {
	Kind    string
	Message string
}

// Closed broadcasts resource release. Termination is stable after Closed closes.
// Send returns local admission only. Receive has one detachable owner.
type Wire interface {
	Send(Envelope) error
	Receive(func(Envelope)) (func(), error)
	Closed() <-chan struct{}
	Termination() Termination
	Close() error
}
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

package wire

import ontoswire "github.com/bitspark/ontos/wire/go"

// HydratedValue admits only an ontos Atom/Tuple, a finite immutable HydratedTuple,
// or a runtime-recognized HydratedWire. An arbitrary Go value is invalid.
// This open union lets runtimes own recognition without extending ontos.Value.
type HydratedValue = ontoswire.NativeValue

// ReceivedContext is established by composition, never supplied by message data.
type ReceivedContext = any

// HydratedTuple returns captured children, without exposing mutable storage.
// Runtime construction collapses a wholly ground tuple to ontos.Tuple.
type HydratedTuple = ontoswire.NativeTuple[HydratedWire]

// HydratedWire grants sending only; success means local admission.
type HydratedWire interface{ Send(HydratedValue) error }

// HydratedEndpoint owns receiving and closure. Convey only Wire(), on every path.
type HydratedEndpoint interface {
	HydratedWire
	Wire() HydratedWire
	Receive(func(HydratedValue, ReceivedContext)) (func(), error)
	Closed() <-chan struct{}
	Termination() Termination
	Close() error
}

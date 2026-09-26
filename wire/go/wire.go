// Package wire declares the Bitwire 0.3 primitive, tree and addressed carrier contracts.
// It defines the shared boundary; dispatch, codecs and carriers belong to
// implementations. TreePath uses exact byte keys. The separate bitwire/1
// AddressedWire carrier retains Unicode-scalar string paths without normalization.
package wire

import "encoding/json"

// Code is a wire termination code. Meaning and defaults follow the profile.
type Code int

// ProfileKind is one of the profile's four frame kinds. Correlation and
// validation remain the peer's; a wire only carries the frame.
type ProfileKind string

const (
	ProfileRequest  ProfileKind = "request"
	ProfileResponse ProfileKind = "response"
	ProfileEvent    ProfileKind = "event"
	ProfileCancel   ProfileKind = "cancel"
)

// ProfileError is public error data, without a runtime error dependency.
// Its fields do not prove that a failed send was never published. That local
// evidence, when required by value conversion, belongs to the admitting runtime.
type ProfileError struct {
	Code    string          `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// ProfileFrame carries a profile frame. An AddressedWire path is the request method or
// event name; keeping it outside this value prevents contradictory names.
// Payloads retain their JSON representation, including numeric precision.
// A nil RawMessage means absent; the bytes "null" mean present JSON null.
// Only fields allowed for Kind may be populated, and Version must be 1.
// The profile implementation validates those conditions at its boundary.
type ProfileFrame struct {
	Version     int               `json:"version"`
	Kind        ProfileKind       `json:"kind"`
	ID          string            `json:"id,omitempty"`
	Params      json.RawMessage   `json:"params,omitempty"`
	Result      json.RawMessage   `json:"result,omitempty"`
	Error       *ProfileError     `json:"error,omitempty"`
	Data        json.RawMessage   `json:"data,omitempty"`
	Traceparent string            `json:"traceparent,omitempty"`
	Tracestate  string            `json:"tracestate,omitempty"`
	Meta        map[string]string `json:"meta,omitempty"`
}

// ReturnAddress is a local capability with stable pointer identity, even when
// its AddressedWire implementation is not comparable. Routing must preserve the pointer
// and any runtime-owned context associated with it. It is never an envelope
// member. A runtime may use it to retain an event's received context without
// providing a callable reply or creating a response waiter.
type ReturnAddress struct{ Wire AddressedWire }

// Message preserves a frame, its local capability and associated received
// context through routing. Context is established and recognized by the runtime,
// not inferred from caller-supplied payloads or metadata. Keep the message's
// contents immutable after Send admits it; implementations may retain them.
type Message struct {
	Frame  ProfileFrame
	Return *ReturnAddress `json:"-"`
}

// Receiver receives complete deliveries relative to its endpoint's origin, and
// an ending. The endpoint owns asynchronous dispatch. Receiver contains no
// routing policy; a dispatcher may interpret paths after delivery.
type Receiver struct {
	Message func(path []string, message Message)
	Closed  func(code Code, reason string)
}

// AddressedWire is send access to an origin. It grants neither receive attachment nor
// endpoint lifecycle control.
// Send returns when accepted or refused, without running a destination handler
// on the sender's stack or waiting for its result. Success means admission,
// not completion of an application effect.
type AddressedWire interface {
	Send(path []string, message Message) error
}

// Endpoint combines send access with receive attachment and lifecycle control.
// Receive attaches one owning receiver for every relative path. A second
// attachment is refused until the first is detached. Detach is idempotent and
// does not close the endpoint. Path dispatch and sharing among selected views
// belong to an explicit composition, not this primitive.
type Endpoint interface {
	AddressedWire
	Receive(receiver Receiver) (detach func(), err error)
	Close(code Code, reason string) error
}

// Wire is addressless sending access. Send completes on admission or refusal,
// not application completion, and grants no receiver or endpoint ownership.
// Message/frame semantics are unchanged from the selected profile.
type Wire interface {
	Send(message Message) error
}

// Key is an exact byte string. Empty keys and arbitrary binary bytes are valid.
// Implementations copy mutable key inputs/outputs to preserve tree structure.
type Key = []byte

// TreePath selects a descendant through exact byte keys; the empty path is self.
// This is distinct from the bitwire/1 carrier's Unicode string paths.
type TreePath = [][]byte

// Child is one complete named subtree. Children form a finite map by key bytes.
type Child[T any] struct {
	Key  Key
	Tree DeixisNode[T]
}

// DeixisNode is the full finite, acyclic structural contract, not an opaque
// routing handle. Its topology and own-value associations remain stable.
// Children and Decompose return the complete child map with exact keys.
// At returns (nil,false) for a missing path, never a fabricated proxy.
// Decomposition followed by reconstruction preserves structure and payload
// capability identity. Construction and derived operations belong to runtimes.
type DeixisNode[T any] interface {
	Own() T
	Children() []Child[T]
	At(path TreePath) (DeixisNode[T], bool)
	Decompose() (T, []Child[T])
}

// WireTree is a full Deixis tree with one addressless Wire at every node.
// Derived sending selects a node and calls its own Wire.Send(message).
// An arbitrary AddressedWire cannot be reconstructed into a WireTree.
type WireTree = DeixisNode[Wire]

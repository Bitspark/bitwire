// Package wire declares the Bitwire 0.2 access contract.
// It defines the shared boundary; dispatch, codecs and carriers belong to
// implementations. Paths are relative sequences of Unicode-scalar strings,
// without normalization or interpretation of dots, slashes or empty segments.
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

// ProfileFrame carries a profile frame. The Send path is the request method or
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
// its Wire implementation is not comparable. Routing must preserve the pointer
// and any runtime-owned context associated with it. It is never an envelope
// member. A runtime may use it to retain an event's received context without
// providing a callable reply or creating a response waiter.
type ReturnAddress struct{ Wire Wire }

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

// Wire is send access to an origin. It grants neither receive attachment nor
// endpoint lifecycle control.
// Send returns when accepted or refused, without running a destination handler
// on the sender's stack or waiting for its result. Success means admission,
// not completion of an application effect.
type Wire interface {
	Send(path []string, message Message) error
}

// Endpoint combines send access with receive attachment and lifecycle control.
// Receive attaches one owning receiver for every relative path. A second
// attachment is refused until the first is detached. Detach is idempotent and
// does not close the endpoint. Path dispatch and sharing among selected views
// belong to an explicit composition, not this primitive.
type Endpoint interface {
	Wire
	Receive(receiver Receiver) (detach func(), err error)
	Close(code Code, reason string) error
}

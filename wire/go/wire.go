// Package wire declares the Bitwire access contract, adapted from Nightseam's
// duplex/go/wire.go and reviewed at 1c63f1c4d7e4b5987d4bd32e294177645c92ed8f.
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

// Receiver receives deliveries relative to its wire's origin, and an ending.
// A root owns asynchronous dispatch; composition does not invoke Message itself.
type Receiver struct {
	// Namespace matches this path and every descendant. Exact registrations
	// take precedence; otherwise the longest segment prefix wins.
	Namespace bool
	Message   func(path []string, message Message)
	Closed    func(code Code, reason string)
}

// Wire is an endpoint with an origin. Receive registers an exact relative
// dispatch path; duplicate registrations are refused. Its detach is idempotent.
// Send returns when accepted or refused, without running a destination handler
// on the sender's stack or waiting for its result. Success means admission,
// not completion of an application effect.
// A root owns queue bounds, dispatch and carrier closure. A selected view shares
// that ownership; a mount only owns its routing and registrations.
type Wire interface {
	Send(path []string, message Message) error
	Receive(path []string, receiver Receiver) (detach func(), err error)
	Close(code Code, reason string) error
}

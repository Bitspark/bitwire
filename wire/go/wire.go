// Package wire declares the draft Bitwire contract, adapted from Nightseam's
// duplex/go/wire.go at commit 5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515.
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
type ProfileError struct {
	Code    string          `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

// ProfileFrame carries a profile frame. The Send path is the request method or
// event name; keeping it outside this value prevents contradictory names.
// Payloads retain their JSON representation, including numeric precision.
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

// ReturnAddress is a local address with stable pointer identity, even when its
// Wire implementation is not comparable. It is never an envelope member.
type ReturnAddress struct{ Wire Wire }

// Message preserves a frame and its local return capability through routing.
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
// Send returns when accepted or refused, without running a destination handler.
// A root owns queue bounds, dispatch and carrier closure. A selected view shares
// that ownership; a mount only owns its routing and registrations.
type Wire interface {
	Send(path []string, message Message) error
	Receive(path []string, receiver Receiver) (detach func(), err error)
	Close(code Code, reason string) error
}

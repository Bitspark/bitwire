package wire_test

import (
	"fmt"

	wire "github.com/Bitspark/bitwire/wire/go"
)

// A consumer can provide access without receiver or lifecycle operations.
type sendOnly func([]string, wire.Message) error

func (send sendOnly) Send(path []string, message wire.Message) error {
	return send(path, message)
}

var _ wire.Wire = sendOnly(nil)

func ExampleWire() {
	access := sendOnly(func(path []string, message wire.Message) error {
		fmt.Println(path, message.Frame.Kind)
		return nil
	})
	address := &wire.ReturnAddress{Wire: access}
	_ = address.Wire.Send([]string{"result"}, wire.Message{
		Frame: wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent, Data: []byte("null")},
	})
	// Output: [result] event
}

// Compile this separate owner-side consumer without providing a fake runtime.
// Behavioral receiver ownership checks belong to implementation conformance.
func attach(endpoint wire.Endpoint, receiver wire.Receiver) (wire.Wire, func(), error) {
	detach, err := endpoint.Receive(receiver)
	return endpoint, detach, err
}

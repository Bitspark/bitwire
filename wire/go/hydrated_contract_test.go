package wire

import "testing"

// A foreign implementation satisfies the declaration but gains no runtime export authority.
type hydratedSender struct{}

func (hydratedSender) Send(HydratedValue) error { return nil }

var _ HydratedWire = hydratedSender{}

func TestHydratedDeclarationIsSeparateFromGround(t *testing.T) {
	var live HydratedWire = hydratedSender{}
	if _, ground := any(live).(Wire); ground {
		t.Fatal("live sender also satisfies ground-only Wire")
	}
	if err := live.Send(live); err != nil {
		t.Fatal(err)
	}
}
func hydratedOwnerSurface(owner HydratedEndpoint) {
	detach, err := owner.Receive(func(_ HydratedValue, _ ReceivedContext) {})
	if err == nil {
		detach()
	}
	_ = owner.Wire().Send(owner.Wire())
	_ = owner.Closed()
	_ = owner.Termination()
	_ = owner.Close()
}

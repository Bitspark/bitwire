// Package carrier selects the bitruntime carrier a conformance driver runs on,
// exactly as the Nightseam baseline selects its carriers: a local pair, or a
// WebSocket connection whose client or server side sends. It supplies only
// construction and cleanup; every delivery is bitruntime's own.
package carrier

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"time"

	core "github.com/Bitspark/bitruntime/core/go"
	engine "github.com/Bitspark/bitruntime/engine/go"
	websocket "github.com/Bitspark/bitruntime/engine/websocket/go"
	transports "github.com/Bitspark/bitruntime/transports/go"
	wire "github.com/Bitspark/bitwire/wire/go"
)

// Kind is BITRUNTIME_CARRIER: "local" or "peer". A peer is a real WebSocket
// between two bitruntime engines; BITRUNTIME_REVERSE=1 makes the server side
// the sending origin.
func Kind() string {
	kind := os.Getenv("BITRUNTIME_CARRIER")
	if kind != "local" && kind != "peer" {
		panic("expected BITRUNTIME_CARRIER=local or peer")
	}
	if reverse := os.Getenv("BITRUNTIME_REVERSE"); reverse != "" && reverse != "0" && reverse != "1" {
		panic("expected BITRUNTIME_REVERSE=0 or 1")
	}
	return kind
}

func check(err error) {
	if err != nil {
		panic(err)
	}
}

// Pair returns two connected endpoints. Sending on the first delivers to the
// receiver of the second, and the reverse. cleanup registers each release.
func Pair(cleanup func(func())) (wire.Endpoint, wire.Endpoint) {
	if Kind() == "local" {
		a, b, err := core.NewPair(core.PairOptions{})
		check(err)
		cleanup(func() {
			_ = a.Close(transports.CodeNormal, "done")
			_ = b.Close(transports.CodeNormal, "done")
		})
		return a, b
	}
	connected := make(chan *engine.Peer, 1)
	handler, err := websocket.NewHandler(websocket.ServerOptions{
		Authenticate: func(r *http.Request) (context.Context, error) { return r.Context(), nil },
		CheckOrigin:  func(*http.Request) bool { return true },
		OnConnect:    func(peer *engine.Peer) { connected <- peer },
	})
	check(err)
	server := httptest.NewServer(handler)
	cleanup(server.Close)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	cleanup(cancel)
	client, _, err := websocket.Dial(ctx, server.URL, websocket.DialOptions{ConnectTimeout: 5 * time.Second})
	check(err)
	cleanup(func() { _ = client.Close() })
	var remote *engine.Peer
	select {
	case remote = <-connected:
	case <-time.After(5 * time.Second):
		panic("the server did not publish its accepted peer")
	case <-ctx.Done():
		panic(ctx.Err())
	}
	cleanup(func() { _ = remote.Close() })
	if os.Getenv("BITRUNTIME_REVERSE") == "1" {
		return remote.Wire(), client.Wire()
	}
	return client.Wire(), remote.Wire()
}

# Go Wire declarations

Package `github.com/Bitspark/bitwire/wire/go`, named `wire`, presents the 0.1
[Wire contract](../../docs/wire/contract.md). It uses only the Go standard library.

```go
type Wire interface {
    Send(path []string, message Message) error
    Receive(path []string, receiver Receiver) (detach func(), err error)
    Close(code Code, reason string) error
}
```

[wire.go](wire.go) contains the supporting frame, return-address and receiver
types. Install the released module with:

```console
go get github.com/Bitspark/bitwire@v0.1.0
```

There is no endpoint implementation in this package. Existing
Nightseam Go implementations require an adoption change or bridge because these
declarations introduce distinct named types.

From the repository root, `go vet ./...` and `go test ./...` compile the package.
The independent [conformance baseline](../../conformance/README.md) checks
composition behavior through pinned public Nightseam implementations. Those
drivers and the release's public Go installation check are separate evidence.

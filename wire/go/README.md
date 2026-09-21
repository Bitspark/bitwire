# Go Wire declarations

Package `github.com/Bitspark/bitwire/wire/go`, named `wire`, presents the draft
[Wire contract](../../docs/wire/contract.md). It uses only the Go standard library.

```go
type Wire interface {
    Send(path []string, message Message) error
    Receive(path []string, receiver Receiver) (detach func(), err error)
    Close(code Code, reason string) error
}
```

[wire.go](wire.go) contains the supporting frame, return-address and receiver
types. There is no endpoint implementation or published release yet. Existing
Nightseam Go implementations require an adoption change or bridge because these
declarations introduce distinct named types.

From the repository root, `go vet ./...` and `go test ./...` compile the package.
No behavioral tests are claimed by this declaration-only scaffold.

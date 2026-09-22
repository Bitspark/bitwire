# Go Wire declarations

A callable return capability holds Wire access to its own relative-path origin.
The selected profile defines supported paths, frame kinds and lifetime, and may
reserve that origin's paths for invocation operations. This grants no endpoint
receive or closure authority. Pure routing preserves the original return
capability and associated context; generic Wire alone does not imply lifecycle
support. Consumers must agree on a profile revision as well as its name; see
[the shared decision](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0004-return-origins-and-profile-revisions.md).

Package `github.com/Bitspark/bitwire/wire/go`, named `wire`, presents the 0.2
[Wire contract](../../docs/wire/contract.md). It uses only the Go standard library.

```go
type Wire interface {
    Send(path []string, message Message) error
}

type Endpoint interface {
    Wire
    Receive(receiver Receiver) (detach func(), err error)
    Close(code Code, reason string) error
}
```

[wire.go](wire.go) contains the supporting frame, return-address and receiver
types. Install the released module with:

```console
go get github.com/Bitspark/bitwire@v0.2.0
```

`Wire` grants send access. `Endpoint` additionally grants one owning receive
attachment and lifecycle control. A `ReturnAddress` needs only `Wire`.
The receiver sees each complete message and its relative path; it has no
registration path or namespace option. Shared selection and handler routing
belong to an explicit dispatcher composition.

There is no endpoint implementation in this package. Nightseam implementations
of the 0.1 contract require an adoption change or bridge for 0.2.

From the repository root, `go vet ./...` and `go test ./...` check the package
and its send-only consumer example. The independent
[conformance work](../../conformance/README.md) records behavioral evidence
separately from declaration and package installation checks.

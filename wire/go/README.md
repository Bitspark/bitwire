# Bitwire for Go

Version 0.3.0 is public through the Go proxy. A fresh consumer passed with the
checksum database enabled, no replacement and the exact release commit in the
[core workflow](https://github.com/Bitspark/bitwire/actions/runs/36231433436).
See the [delivery matrix](https://github.com/Bitspark/bitwire/blob/main/docs/languages.md#version-030-delivery)
for the separately verified distribution and runtime boundaries.

**Contract: 0.3.0.** `Wire` is the addressless
primitive `send(message)`. `WireTree = DeixisNode<Wire>` provides the complete
finite, acyclic structure: own value, complete byte-keyed children, partial
selection and decomposition. Keys are exact arbitrary bytes, including empty
and non-UTF-8 keys. Empty path selects self; a missing edge is distinct from a
present refusing primitive. Recomposition preserves own and child identities.

This is symmetric with Bitstore's `Data.read()` primitive and
`DataTree = DeixisNode<Data>`. Derived sending selects the node and invokes its
own Wire. Construction and derived operators belong in bitruntime; these
packages publish declarations and criteria, not a production tree runtime.
See [decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md)
and the [migration guide](https://github.com/Bitspark/bitwire/blob/main/docs/migration-0.3.md).

`AddressedWire` explicitly names the former `Wire.send(path, message)` surface.
It is not a full WireTree. `Endpoint` extends AddressedWire, and return
capabilities retain AddressedWire so the existing response/lifecycle path
space, local identity, received context and closure rules remain intact.
Carrier paths remain exact Unicode-scalar strings under unchanged `bitwire/1`;
they do not imply support for arbitrary tree byte keys on that carrier.

The following addressed-carrier examples use the **0.3 contract names**. Older
0.2.0 artifacts used `Wire` for the addressed interface; their release evidence
does not validate the renamed declarations or full structural trees.

Package `github.com/Bitspark/bitwire/wire/go`, named `wire`, presents the 0.3
[AddressedWire contract](../../docs/wire/contract.md). It uses only the Go standard library.

```go
type AddressedWire interface {
    Send(path []string, message Message) error
}

type Endpoint interface {
    AddressedWire
    Receive(receiver Receiver) (detach func(), err error)
    Close(code Code, reason string) error
}
```

[wire.go](wire.go) contains the supporting frame, return-address and receiver
types. Install the released module with:

```console
go get github.com/Bitspark/bitwire@v0.3.0
```

`AddressedWire` grants send access. `Endpoint` additionally grants one owning receive
attachment and lifecycle control. A `ReturnAddress` needs only `AddressedWire`.
The receiver sees each complete message and its relative path; it has no
registration path or namespace option. Shared selection and handler routing
belong to an explicit dispatcher composition.

There is no endpoint implementation in this package. Nightseam implementations
of the 0.1 contract require an adoption change or bridge for 0.2.

From the repository root, `go vet ./...` and `go test ./...` check the package
and its send-only consumer example. The independent
[conformance work](../../conformance/README.md) records behavioral evidence
separately from declaration and package installation checks.

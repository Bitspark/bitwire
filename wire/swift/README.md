# Bitwire for Swift

Version 0.3.0 is available through the public Git release. A fresh anonymous
SwiftPM consumer passed against the exact release commit in the
[source verification workflow](https://github.com/Bitspark/bitwire/actions/runs/36232682234).
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

The Swift 6 product and module `Bitwire` declare the shared AddressedWire protocol and its
supporting values. The SwiftPM manifest is at the repository root, so consumers
can resolve the same source release as the other bindings using the Git URL.
There is no runtime dependency on Nightseam or another Bitspark package.

**Status:** contract binding and package checks. This is not an endpoint runtime
and does not claim behavioral conformance merely because its declarations build.

## Consume

Add the published exact version to a SwiftPM manifest:

```swift
dependencies: [
    .package(url: "https://github.com/Bitspark/bitwire.git", exact: "0.3.0")
],
targets: [
    .target(name: "YourAdapter", dependencies: [
        .product(name: "Bitwire", package: "bitwire")
    ])
]
```

The exact version above is published and independently verified. Consumer source imports `Bitwire` and implements `AddressedWire`. Implementations
provide admission and asynchronous dispatch. `AddressedWire` exposes only `send`;
`Endpoint: AddressedWire` adds `receive(receiver:)` and `close(code:reason:)`. One receiver
may be attached at a time; a second active attachment is refused. The receiver
sees the relative path and complete message. Dispatch and matching policy live
outside this primitive.

```swift
import Bitwire
import Foundation

func sendRead(over wire: any AddressedWire, returnTo address: ReturnAddress) throws {
    let frame = ProfileFrame(kind: .request, id: "request-1", params: Data("null".utf8))
    try wire.send(path: ["cell", "get"], message: Message(frame: frame, returnAddress: address))
}
```

## Representation

- `AddressedWire`, `Endpoint`, callbacks and supporting values are `Sendable`; Swift 6 concurrency
  checking remains enabled. Admission refusal is reported by `throws`.
- Paths use `[String]`. Implementations must compare segment UTF-8 or Unicode
  scalar sequences. Swift's native string equality considers canonically
  equivalent spellings equal; the AddressedWire contract keeps those spellings distinct.
- `Metadata` stores keys by their bytes. Its entry and dictionary-literal
  initializers preserve distinct scalar spellings. An existing `[String: String]`
  may already have merged those keys before it reaches Bitwire.
- JSON payloads use `Data?`, retaining number precision and encoded spelling.
  `nil` is absent and `Data("null".utf8)` is JSON null. This representation does
  not validate JSON or replace the `nightseam.duplex/1` profile codec.
- `ReturnAddress` is a final reference type: copying a `Message` retains the
  same capability object (`===`). It is local access, never serialized data.
  Local routing must also preserve any opaque received context the runtime
  associates with that identity. Public frame fields do not supply verification
  proof, and the contract introduces no application-writable trusted context.
- `ReturnAddress.wire` exposes send-only access, without requiring endpoint control.
- `Detach` is an idempotent receive detachment. Closing an `Endpoint` and releasing
  a live binding remain distinct operations under the shared contract/profile.

See the [common contract](../../docs/wire/contract.md) and
[profile boundary](../../docs/wire/profile.md). Selection, mounting, forwarding,
dispatch, carrier support and generated adapters belong to implementations.

## Checks

With Swift 6.0 or later and Node installed, run from the repository root:

```sh
node wire/swift/check.mjs
```

This exports the manifest, sources, tests and notices to a temporary source
package outside the checkout, runs `swift test --jobs 2`, and runs the separate
[consumer fixture](consumer/Package.swift) against the exported product. The
tests check return identity, JSON representation, scalar-sensitive metadata and
the `Sendable` surface. They do not simulate a conforming endpoint.

## License and provenance

Apache License 2.0; see [LICENSE](LICENSE) and [NOTICE](NOTICE). The declarations
and metadata value are adapted from
[Nightseam at `1c63f1c4`](https://github.com/Bitspark/nightseam/tree/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/duplex/swift/NightseamDuplex/Sources/NightseamDuplex).

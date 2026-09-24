# Bitwire for Swift

Declared composites keep an origin, the behavior for a message sent at `[]`,
beside complete named children. Selecting a child gives exactly that child's
access; the origin is never a fallback, and a mount is the case with a refusing
origin. Segments map to Deixis keys by exact UTF-8 encoding. Keys compare by
UTF-8 bytes or Unicode scalars, never by `String` equality, which identifies
canonically equivalent spellings. Rebuilding uses parts retained by the
construction owner; a send-only Wire cannot enumerate or unwrap them, though its
behavior may reveal which routes respond. The [shared
decision](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0006-declared-composites-realize-deixis-nodes.md)
adds no native Wire methods. Its Go/TypeScript conformance evidence does not
establish a production construction API in this language.

A callable return capability holds Wire access to its own relative-path origin.
The selected profile defines supported paths, frame kinds and lifetime, and may
reserve that origin's paths for invocation operations. This grants no endpoint
receive or closure authority. Pure routing preserves the original return
capability and associated context; generic Wire alone does not imply lifecycle
support. Consumers must agree on a profile revision as well as its name; see
[the shared decision](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0004-return-origins-and-profile-revisions.md).

The Swift 6 product and module `Bitwire` declare the shared Wire protocol and its
supporting values. The SwiftPM manifest is at the repository root, so consumers
can resolve the same source release as the other bindings using the Git URL.
There is no runtime dependency on Nightseam or another Bitspark package.

**Status:** contract binding and package checks. This is not an endpoint runtime
and does not claim behavioral conformance merely because its declarations build.

## Consume

Once a release tag is published, add its exact version to a SwiftPM manifest:

```swift
dependencies: [
    .package(url: "https://github.com/Bitspark/bitwire.git", exact: "0.2.0")
],
targets: [
    .target(name: "YourAdapter", dependencies: [
        .product(name: "Bitwire", package: "bitwire")
    ])
]
```

The version above illustrates the syntax; it does not assert that the release
exists. Consumer source imports `Bitwire` and implements `Wire`. Implementations
provide admission and asynchronous dispatch. `Wire` exposes only `send`;
`Endpoint: Wire` adds `receive(receiver:)` and `close(code:reason:)`. One receiver
may be attached at a time; a second active attachment is refused. The receiver
sees the relative path and complete message. Dispatch and matching policy live
outside this primitive.

```swift
import Bitwire
import Foundation

func sendRead(over wire: any Wire, returnTo address: ReturnAddress) throws {
    let frame = ProfileFrame(kind: .request, id: "request-1", params: Data("null".utf8))
    try wire.send(path: ["cell", "get"], message: Message(frame: frame, returnAddress: address))
}
```

## Representation

- `Wire`, `Endpoint`, callbacks and supporting values are `Sendable`; Swift 6 concurrency
  checking remains enabled. Admission refusal is reported by `throws`.
- Paths use `[String]`. Implementations must compare segment UTF-8 or Unicode
  scalar sequences. Swift's native string equality considers canonically
  equivalent spellings equal; the Wire contract keeps those spellings distinct.
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

# Bitwire for TypeScript

**Source contract: 0.3.0; publication pending.** `Wire` is the addressless
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

The following addressed-carrier examples use the **0.3 source names**. Older
0.2.0 artifacts used `Wire` for the addressed interface; their release evidence
does not validate the renamed declarations or full structural trees.

`@bitspark/bitwire` declares the shared contract for access through relative
paths. It has no runtime dependencies. Runtimes implement the contract and
generated adapters use it to connect operations to AddressedWire access.

After 0.3.0 is published (this is not a claim of registry availability):

```sh
npm install @bitspark/bitwire@0.3.0
```

```typescript
import type { AddressedWire, Message, Path } from '@bitspark/bitwire';

function send(wire: AddressedWire, path: Path, message: Message): void {
  wire.send(path, message);
}
```

`AddressedWire` grants only send access. The separate `Endpoint extends AddressedWire` interface
adds `receive(receiver): () => void` and `close(code?, reason?): void`. Receive
attaches one owning receiver for all paths; a second attachment is refused until
the first is detached. The receiver gets the complete message and delivered
relative path. Dispatch tables, namespace matching and shared selected views
are composition policies rather than primitive receiver options.

Return addresses need only `AddressedWire`, so a generated adapter can accept a send-only
implementation without obtaining receive attachment or endpoint closure.

This package provides declarations and an empty JavaScript entry point. It does
not implement endpoints, queues, transports or generated adapters. A matching
TypeScript shape alone does not establish behavioral conformance.

The [AddressedWire contract](https://github.com/Bitspark/bitwire/blob/main/docs/wire/contract.md),
[profile boundary](https://github.com/Bitspark/bitwire/blob/main/docs/wire/profile.md)
and [conformance criteria](https://github.com/Bitspark/bitwire/tree/main/conformance)
describe the shared meaning. The historical
[0.2 release record](https://github.com/Bitspark/bitwire/releases/tag/v0.2.0) identifies
the published artifacts and verified implementation coverage; preparing this
manifest does not itself publish a version.

Licensed under Apache-2.0. See the included `LICENSE` and `NOTICE`.

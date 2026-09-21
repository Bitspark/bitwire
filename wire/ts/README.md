# Bitwire for TypeScript

`@bitspark/bitwire` declares the shared contract for access through relative
paths. It has no runtime dependencies. Runtimes implement the contract and
generated adapters use it to connect operations to Wire access.

For a published version:

```sh
npm install @bitspark/bitwire@0.2.0
```

```typescript
import type { Wire, Message, Path } from '@bitspark/bitwire';

function send(wire: Wire, path: Path, message: Message): void {
  wire.send(path, message);
}
```

`Wire` grants only send access. The separate `Endpoint extends Wire` interface
adds `receive(receiver): () => void` and `close(code?, reason?): void`. Receive
attaches one owning receiver for all paths; a second attachment is refused until
the first is detached. The receiver gets the complete message and delivered
relative path. Dispatch tables, namespace matching and shared selected views
are composition policies rather than primitive receiver options.

Return addresses need only `Wire`, so a generated adapter can accept a send-only
implementation without obtaining receive attachment or endpoint closure.

This package provides declarations and an empty JavaScript entry point. It does
not implement endpoints, queues, transports or generated adapters. A matching
TypeScript shape alone does not establish behavioral conformance.

The [Wire contract](https://github.com/Bitspark/bitwire/blob/v0.2.0/docs/wire/contract.md),
[profile boundary](https://github.com/Bitspark/bitwire/blob/v0.2.0/docs/wire/profile.md)
and [conformance criteria](https://github.com/Bitspark/bitwire/tree/v0.2.0/conformance)
describe the shared meaning. The
[release record](https://github.com/Bitspark/bitwire/releases/tag/v0.2.0) identifies
the published artifacts and verified implementation coverage; preparing this
manifest does not itself publish a version.

Licensed under Apache-2.0. See the included `LICENSE` and `NOTICE`.

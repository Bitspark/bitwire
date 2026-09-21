# Bitwire for TypeScript

`@bitspark/bitwire` declares the shared contract for access through relative
paths. It has no runtime dependencies. Runtimes implement the contract and
generated adapters use it to connect operations to Wire access.

For a published version:

```sh
npm install @bitspark/bitwire@0.1.0
```

```typescript
import type { Wire, Message, Path } from '@bitspark/bitwire';

function send(wire: Wire, path: Path, message: Message): void {
  wire.send(path, message);
}
```

This package provides declarations and an empty JavaScript entry point. It does
not implement endpoints, queues, transports or generated adapters. A matching
TypeScript shape alone does not establish behavioral conformance.

The [Wire contract](https://github.com/Bitspark/bitwire/blob/v0.1.0/docs/wire/contract.md),
[profile boundary](https://github.com/Bitspark/bitwire/blob/v0.1.0/docs/wire/profile.md)
and [conformance criteria](https://github.com/Bitspark/bitwire/tree/v0.1.0/conformance)
describe the shared meaning. The
[release record](https://github.com/Bitspark/bitwire/releases/tag/v0.1.0) identifies
the published artifacts and verified implementation coverage; preparing this
manifest does not itself publish a version.

Licensed under Apache-2.0. See the included `LICENSE` and `NOTICE`.

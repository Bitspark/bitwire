# Bitwire for TypeScript

Declared composition may retain separate own-origin behavior and subtree
admission policy. Selection keeps inherited policy context; reconstruction uses
raw construction parts and original capability/state identities, applying each
policy occurrence once. Views grant no closure or construction authority.
The opt-in [shared interpretation](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0005-declared-composition-and-subtree-policy.md)
adds no native Wire methods. Its Go/TypeScript conformance interpreters do not
establish production construction API adoption in this language.

A callable return capability holds Wire access to its own relative-path origin.
The selected profile defines supported paths, frame kinds and lifetime, and may
reserve that origin's paths for invocation operations. This grants no endpoint
receive or closure authority. Pure routing preserves the original return
capability and associated context; generic Wire alone does not imply lifecycle
support. Consumers must agree on a profile revision as well as its name; see
[the shared decision](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0004-return-origins-and-profile-revisions.md).

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

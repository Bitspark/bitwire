# bitwire

Addressless messages, addressed access and complete wire trees, with one shared
contract for each layer. [CHARTER.md](CHARTER.md) records their purpose and laws.
bitwire owns declarations, canonical message formats and independent conformance
observations. bitruntime supplies implementations.

```typescript
import type { Wire, Endpoint, AddressedWire, AddressedEndpoint, WireTree } from '@bitspark/bitwire';
// Wire: send(Value).
// Endpoint: Wire + receive(Value), closed, close().
// AddressedWire: send(Path, Value).
// AddressedEndpoint: addressed send/receive with the same endpoint lifetime.
// WireTree: complete DeixisNode<Wire>, including own values and all children.
```

A message is any immutable ground Ontos Value. Paths preserve exact bytes and
segment boundaries. Empty self differs from an empty-key child. The foundation
requires no source, identifier, correlation, RPC kind or request deadline.
Send success means local admission, not operation execution. Complete structure
and remote discovery are separate from opaque route access.

Read [the contract](docs/wire/contract.md), [formats](docs/wire/carriers.md) and
[decision 0015](docs/decisions/0015-addressless-wires-and-addressed-access.md).
Raw carriers encode one Value with ontos-codec-v1; WebSocket negotiates
bitwire.ontos.v2. The optional addressed layer carries bitwire/addressed/1 as an
ordinary Value. It can be implemented once over every carrier. There is no legacy
protocol, fallback decoder or compatibility alias.

The [checked Ontos mirror](ontos/README.md) pins v0.9.0 with reversible import
adaptations, hashes and vectors. TypeScript /ontos, /ontos-codec and /ontos-data
share one value family; optional data embeddings do not restrict raw messages.
Eight native presentations live in wire/{go,ts,py,rs,swift,cpp,java,hs}.
The [language matrix](docs/languages.md) distinguishes declarations from runtime
conformance.

Run pnpm install --frozen-lockfile and node scripts/check.mjs. Native binding CI
also checks packaged consumers. The [release process](RELEASING.md) requires
exact-commit rehearsal, immutable tags and actual public consumer verification.

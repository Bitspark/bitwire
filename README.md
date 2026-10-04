# bitwire

One generic duplex envelope interface, independent of runtime and carrier.
bitwire owns the contract, native declarations, canonical envelope format and
independent conformance observations. bitruntime supplies endpoint implementations.

```typescript
import type { Wire, Envelope, Path } from '@bitspark/bitwire';
// Wire: send(envelope), receive(handler), closed, close().
// Path: readonly Atom[]. Payload: ground ontos Atom | Tuple.
```

Paths preserve exact bytes and segment boundaries. Empty self differs from the
empty-key child. Payloads are opaque; the wire defines no call/return kinds,
invocation deadlines or ID deduplication. Source/correlation are routing context,
not authentication. Send success is local admission, not operation execution.

Read [the contract](docs/wire/contract.md), [current encoding](docs/wire/carriers.md)
and [clean replacement decision](docs/decisions/0014-generic-envelope-wire.md).
The current format is bitwire/envelope/1 over ontos-codec-v1; WebSocket negotiates
bitwire.ontos.v1. There are no supported historical profiles or compatibility
exports. Stored application identity is a consumer's separate concern.

The [checked ontos consumer mirror](ontos/README.md) pins v0.9.0 with reversible
import adaptations, hashes and vectors. No private registry or checkout is needed.
TypeScript users import Atom/Tuple from this package or its /ontos subpath;
/ontos-codec and /ontos-data share those same classes. The optional data embeddings
do not constrain arbitrary ground wire payloads.

Eight native presentations live in wire/{go,ts,py,rs,swift,cpp,java,hs}. The
[language matrix](docs/languages.md) distinguishes package/declaration checks
from runtime behavior. Complete DeixisNode<T> structure is independent of opaque
route access. Consumers can store Wire values in trees without a second wire API.

Run pnpm install --frozen-lockfile and node scripts/check.mjs. Native binding CI
also checks packaged consumers. Release uses an exact-commit provenance rehearsal,
an immutable tag, public npm/crates/Go verification and the established optional
Python/Maven workflows. Haskell is delivered as source; Hackage remains deferred.

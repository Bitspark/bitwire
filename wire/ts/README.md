# TypeScript Wire declarations

The private workspace package `@bitspark/bitwire` presents the draft
[Wire contract](../../docs/wire/contract.md). It has no runtime dependencies.

```typescript
import type { Wire } from '@bitspark/bitwire';
```

This import is usable from a configured workspace consumer after building the
package. It is not an npm installation instruction: no package has been published.
[src/index.ts](src/index.ts) contains the full declarations. There is no endpoint
implementation; a matching TypeScript shape does not establish protocol conformance.

From the repository root, `pnpm install --frozen-lockfile` followed by
`node scripts/check.mjs` checks and builds the declarations alongside Go.

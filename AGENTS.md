# Working here

Read [the generic contract](docs/wire/contract.md), [carrier format](docs/wire/carriers.md)
and [decision 0014](docs/decisions/0014-generic-envelope-wire.md).
There is one duplex envelope Wire. Ground ontos values and exact byte paths
are generic; invocation protocols belong to consumers. Full Deixis structure
is independent of opaque routing access. No legacy aliases or profile fallback.

Keep published contracts independent of bitruntime and generators. Runtime Wire
implementations belong in bitruntime. Preserve the pinned ontos consumer mirror;
change the whole release pin/vectors/checks together, never its value semantics.
Align all eight presentations and independent observations. Compilation is not
runtime conformance. Use component-first two-letter language directories.

Use a task branch/worktree and PR, run pnpm install --frozen-lockfile and
node scripts/check.mjs, then squash a green change to main. Keep native binding
package checks and the release rehearsal/public registry checks. Explicit human
scope authorizes normal integration/delivery; do not ask again. Do not add
private checkout dependencies, credentials or local orchestration state.

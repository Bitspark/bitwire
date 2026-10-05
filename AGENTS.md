# Working here

Read [CHARTER.md](CHARTER.md), [the contract](docs/wire/contract.md),
[carrier format](docs/wire/carriers.md) and [decision 0015](docs/decisions/0015-addressless-wires-and-addressed-access.md).
Wire is addressless sending. Endpoint owns receiving/closure. AddressedWire adds
an exact byte-path argument; WireTree adds complete deixis structure. Carriers
implement addressless endpoints; one addressed layer works over all carriers.
Invocation protocols belong to consumers. No legacy aliases or profile fallback.
Changes to these boundaries must name the charter invariant and amend the
contract explicitly; consumer implementations do not amend deixis by implication.

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

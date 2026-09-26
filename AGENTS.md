# Working here as an agent

The active naming decision is [0012](docs/decisions/0012-explicit-data-and-wire-trees.md):
`Wire` is addressless, `WireTree` is the complete Deixis structure, and
`AddressedWire` is the existing carrier access. Preserve this distinction.

Read [COLLABORATION.md](COLLABORATION.md), the ownership decisions
([0001](docs/decisions/0001-shared-wire-contract.md),
[0007](docs/decisions/0007-using-bitwire-never-requires-nightseam.md) and
[0010](docs/decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md)) and the relevant
[contract](docs/wire/contract.md) before changing this tree.

- Keep Wire's contract independent of runtime and generator implementations,
  including Bitwire's own.
- Nothing Bitwire publishes may require Nightseam or bitruntime;
  `node scripts/check.mjs` enforces this. Implementations belong in bitruntime.
- Keep every delivered language presentation and the shared conformance cases
  aligned when shared meaning changes; track pending bindings explicitly.
- Distinguish draft specifications, implemented checks and consumer adoption.
- Run `node scripts/check.mjs` before committing; install dependencies with
  `pnpm install --frozen-lockfile` first.
- After the initial repository bootstrap, use a branch/worktree and a pull
  request; squash a green change onto `main`.
- Follow user-authorized scope through validation and delivery. An explicit
  decision in the active task is sufficient authorization; do not ask for it again.
- Do not add private checkout dependencies, local orchestration state or credentials.

## Repository layout

Use component-first source paths with two-letter language directories:
`<component>/<lang>/` and `cmd/<command>/<lang>/`. Read [LAYOUT.md](LAYOUT.md)
for the shared codes, current paths and migration boundaries. Apply it to new
components and ports; an existing path moves only with its imports, manifests,
tests and tooling. Preserve the repository's ownership and release rules.

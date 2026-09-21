# Working here as an agent

Read [COLLABORATION.md](COLLABORATION.md), the
[ownership decision](docs/decisions/0001-shared-wire-contract.md) and the relevant
[contract](docs/wire/contract.md) before changing this tree.

- Keep Wire's contract independent of runtime and generator implementations.
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

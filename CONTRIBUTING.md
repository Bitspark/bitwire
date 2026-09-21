# Contributing

Bitwire defines one shared access contract. Start with the
[documentation index](docs/README.md) and [COLLABORATION.md](COLLABORATION.md).

Use Go 1.26, Node.js 24 or later, and pnpm 12.4.1:

```console
pnpm install --frozen-lockfile
node scripts/check.mjs
```

The command runs the same checks as CI on Linux and Windows. At this stage it
checks documentation and language declarations, not runtime conformance.

A contribution should explain the concrete change in meaning, which languages
and consumers it affects, and the evidence holding it. A design proposal should
first attempt composition from the existing contract before adding a primitive.
Examples should be self-contained and use synthetic public data.

After the bootstrap commit, changes land through pull requests with green CI,
using a squash merge. A vulnerability is reported privately as described in
[SECURITY.md](SECURITY.md). Participation follows the
[code of conduct](CODE_OF_CONDUCT.md).

Contributions are licensed under the [Apache License 2.0](LICENSE).

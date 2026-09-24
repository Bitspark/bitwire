# Runnable use cases

Bitwire defines the access contract. Runnable programs live with the runtime
or domain interface they exercise. This catalogue connects a use case to its
implementation, model, command and observable result.

## Run the Nightseam examples

The [Nightseam catalogue](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/README.md)
contains Go and TypeScript consumers. Install Node.js 24+, pnpm 12.4.1 and
Go 1.26, then use a public checkout:

```sh
git clone https://github.com/Bitspark/nightseam.git
cd nightseam
git checkout cd7c80ebf815fa91945cc809bc799464c189e29b
node scripts/examples.mjs list
node scripts/examples.mjs run rebuild-with-state
node scripts/examples.mjs check --all
```

The checkout above pins the example implementation recorded by this catalogue.
To follow later development instead, select Nightseam's main branch. Commands
below run from that repository's root, not from Bitwire.

| Use case | Runnable implementation and model | Command |
| --- | --- | --- |
| Give a parent behavior and complete children | [service-tree](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/service-tree/README.md): call the shop itself and its cart | `node scripts/examples.mjs run service-tree` |
| Select and reuse a subtree | [select-and-remount](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/select-and-remount/README.md): mount the same cart as a checkout's basket | `node scripts/examples.mjs run select-and-remount` |
| Rebuild without losing state | [rebuild-with-state](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/rebuild-with-state/README.md): add recommendations and retain the existing cart | `node scripts/examples.mjs run rebuild-with-state` |
| Retain a child's policy | [guarded-child](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/guarded-child/README.md): a two-add budget survives rebuilding its parent | `node scripts/examples.mjs run guarded-child` |
| Cancel a pending invocation | [cancel-pending-request](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/cancel-pending-request/README.md): cancel the original handler after assembler replacement | `node scripts/examples.mjs run cancel-pending-request` |
| Call across languages and a network carrier | [probe](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/examples/probe/README.md): generated Go server and TypeScript client over WebSockets | `node scripts/examples.mjs run probe` |

The first five run in Go and TypeScript independently. Add `--language=go`
or `--language=ts` to run one. Probe runs both ends together on an ephemeral
loopback port. Each command prepares packages, installs an isolated consumer,
executes it, checks its result and cleans up. Public dependency downloads
require network access; no private checkout, credentials or hosted service
are required. `--keep` retains temporary consumers for inspection.

**Availability:** the five composition recipes require Nightseam's unreleased
declared composition API. The runner uses packaged source, not the current
published 0.6.0 packages. Probe is also available in release tags; use a tag's
instructions for direct registry installation. A successful source run does
not establish registry publication or adoption by another consumer.

## The example and its model

The bookshop has its own behavior at `[]`, returning `Bookshop`. Its
`cart` child offers relative `list` and `add` requests and starts with
`book` and `pen`. The application owns the cart state, handlers and physical
endpoints. The assembler owns a declared construction description. A caller
receives separate send access.

To extend the shop, the assembler decomposes its description, retains the
origin and complete cart capability, adds a `recommendations` child, and
binds the new description. Old and new access still reach the same cart.
Adding `notebook` through the new access is visible through the old access.
The example checks and prints:

```text
before: book, pen
same cart capability: true
shop: Bookshop
after: book, pen, notebook
recommendations: pencil
```

A **retained subtree** here means retaining access to the whole child, including
any state or guard it carries. The assembler does not need to inspect that
child's internals. Copying construction containers does not copy the cart.
This is live access retained in a process; it is not a serialized tree, snapshot,
persistence mechanism or Deixis round trip.

The guard recipe makes the same point with a stateful admission wrapper.
The cancellation recipe checks a different lifetime: a caller's already bound
access keeps reaching the original invocation after the assembler constructs
replacement access. The destination runtime tracks that invocation; plain
composition forwards control frames unchanged.

The full [model and approach](https://github.com/Bitspark/nightseam/blob/cd7c80ebf815fa91945cc809bc799464c189e29b/docs/runtime/examples.md)
documents the domain, exact native APIs, ownership, package isolation and CI.
The shared meaning comes from the [Wire contract](../docs/wire/contract.md),
[composition guide](../docs/composition.md) and
[declared-node decision](../docs/decisions/0006-declared-composites-realize-deixis-nodes.md).

## How the catalogue is organized

| Owner | Keeps |
| --- | --- |
| Bitwire | Shared contracts, language presentations, independent conformance and this use-case index |
| Nightseam | Runtime consumers, Go/TypeScript implementations, package runner and its CI checks |
| A domain repository such as BitTree | Examples of its own domain model and adapters, linked here when runnable |

A ready entry links to a directory with a README, source, dependency manifests,
a runnable command, expected output, assertions, prerequisites, cleanup and an
honest availability statement. Nightseam's inventory selects these directories;
`check --all` runs the catalogue against packaged consumers outside the
workspace on Linux and Windows, and its required CI gate depends on success.
A new example should arrive with its implementation, model and documented
result together.

Examples teach workflows and exercise them; they do not replace the independent
[conformance cases](../conformance/README.md), whose purpose is to hold contract
observations across implementations and carriers. Source acceptance, release
status and consumer adoption remain separate in the
[integration status](../docs/integration.md).

Future domain examples can cover observations, competing change sets, provider
policies and commit behavior in BitTree. The full
[BitTree Wire exposure](https://github.com/Bitspark/bittree/issues/28) and
[Bitwire/Deixis integration](https://github.com/Bitspark/bitwire/issues/29) remain
separate integration work. They are not advertised here as runnable recipes.

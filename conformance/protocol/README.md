# bitwire/1 conformance

This directory holds the conformance material for protocol revision
[`bitwire/1`](../../protocol/bitwire-1/README.md). It is identified and
released separately from the protocol. The protocol's
[scope](../../protocol/bitwire-1/SCOPE.md#evidence-and-conformance-tooling)
defines the separation, and nothing here changes a protocol requirement.

| What | Identity | Files |
| --- | --- | --- |
| Protocol | (`bitwire/1`, `normativeDigest`) | [`protocol/bitwire-1`](../../protocol/bitwire-1/README.md) |
| Conformance contract | Edition 1, compatible with driver 1 | [`CONTRACT.md`](CONTRACT.md), [`scenario.schema.json`](scenario.schema.json), [`selection.json`](selection.json) |
| Evidence set | These files' content hashes | [`scenarios/`](scenarios) |

## The evidence set

The scenarios under `scenarios/` derive from the upstream scenarios archived
unmodified in the protocol bundle. The selection rules in
[`selection.json`](selection.json) decide which ones travel and with what
scope. A derivative keeps the upstream steps, table expansion and expectations
exactly as they are. It adds:
- the protocol identity it tests;
- its scope (**core**, or **tunnel** for core and tunnel);
- the archived source file and that file's SHA-256;
- an `optional: observer` marker when it needs one runtime's observer. Such a
  scenario is a diagnostic and supports no conformance claim.

Two archived scenarios are out of scope and do not travel: the identity
exchange, and a test-only recorder. New evidence is added as new scenarios
under the bitwire schema. It is never added to the archived files or to the
normative tables.

```console
node scripts/protocol-scenarios.mjs verify     # derivatives match their archived sources
node scripts/protocol-scenarios.mjs generate   # rewrite them from the archive and selection.json
```

`verify` also prints the contract's `contractDigest` and the evidence set's
`evidenceDigest`, computed with the protocol's digest procedure
([CONTRACT.md §1](CONTRACT.md#1-identity-and-status)). Reports record both.

`node scripts/check.mjs` verifies them. `scripts/protocol-scenarios.test.mjs`
also checks:
- that the steps are unchanged;
- the identity labels;
- the selection;
- the schema's shape.

## Known evidence defects

Two derivatives expect more than `bitwire/1` requires. By decision 0008 a
scenario that contradicts its revision is a defect in the scenario, not in the
protocol:

- `peer/trace-members-verbatim` matches a regular expression that assumes the
  envelope members `id`, `traceparent` and `tracestate` arrive in that order. The
  envelope does not order its members.
- `tunnel/declaration-digest` expects Nightseam Go's exact refusal message. The
  tunnel requires only that the message name the family.

They stay faithful to their archived sources. A bitwire-authored replacement
follows with the runner, and until then a failure in only these two is
reported as this defect ([#59](https://github.com/Bitspark/bitwire/issues/59)).

## Not yet here

- The test-only runner that executes this contract.
- The testees that drive bitruntime's Go and TypeScript peers.
- Reports against released implementations.
- Evidence for the path encoding (finding F3).

[#59](https://github.com/Bitspark/bitwire/issues/59) tracks each of these as a
separate increment.

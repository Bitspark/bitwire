# Production acceptance for superseded decision 0005

[Decision 0006](../../docs/decisions/0006-declared-composites-realize-deixis-nodes.md)
supersedes decision 0005's policy-bearing node value. This gate remains as
evidence about the superseded shape, which Nightseam's merged but unreleased API
implements. It is not evidence for decision 0006; the
[declared-composite evidence](../declared/README.md) states how that API differs.

Run `node scripts/conformance-production.mjs` to replay decision 0005's
[27 independent cases](decision-0005-cases.json), kept byte for byte, through
Nightseam's production Go and TypeScript constructors, complete parts and
guarded binding. This is 162 case executions: both languages over local pairs
and WebSockets in both directions. `--language=go` or `--language=ts` selects one language.

The [pin](nightseam.json) identifies an **unreleased public source revision**.
It fixes the implementation commit from [Nightseam PR #698](https://github.com/Bitspark/nightseam/pull/698).
It is separate from the immutable [v0.6.0 baseline](../current/README.md), which
exercises decision 0006 through a test-only interpreter and released `Mount`. Passing this
gate does not claim the new API is in a published runtime package.

The runner fetches that exact public commit into a temporary checkout, verifies
the Bitwire module version, source revision and module sum, rejects a replaced
contract, installs the frozen TypeScript dependencies and checks the installed
contract version. The independent fixture has a pinned SHA-256. Inputs omit all
expected observations; Bitwire's separate judge refuses missing, extra,
duplicate and mismatched results. CI also requires Go's race detector for the
production driver and upstream construction and shared-policy tests.

Nightseam's drivers adapt fixture actions to its public `ComposeDeclared` /
`Declared.compose`, `Decompose` / `decompose`, `Bind` / `bind` and existing
endpoint facilities. They do not replace production routing or construction.
They record observations; expected results are authored and judged in Bitwire.
The upstream attachment and concurrent-policy tests remain supplementary
runtime-owned evidence, distinct from the independent cases.

Coverage includes retained parent origins, inherited policies, complete cuts,
shared state and aliases, exact paths and refusals, captured views after route
replacement, borrowed ownership, unchanged local associations and a pending
request's later reply and cancellation. Deliberately incorrect constructions
remain counterexamples. See the superseded [interpretation](../../docs/decisions/0005-declared-composition-and-subtree-policy.md)
for the admitted policies and observation relation.

These carrier runs are Go/Go and TypeScript/TypeScript, with connected, ordered,
nonfaulting WebSockets. They do not establish cross-language composition,
verified authority, all concurrent schedules, fault transparency, other runtime
languages, generated/live adapter coverage or domain-specific tree conversion.
No Bitwire package gains a runtime dependency or needs a private checkout.

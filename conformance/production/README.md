# Production acceptance for declared composites

Run `node scripts/conformance-production.mjs` to replay decision 0006's
[39 independent cases](../declared/cases.json) through Nightseam's production
Go and TypeScript constructors, complete parts and send-only binding. This is
234 executions: both languages over local pairs and WebSockets in both
directions. Every case must meet its expectation; this gate allows no gaps.
`--language=go` or `--language=ts` selects one language.

The [pin](nightseam.json) identifies the **unreleased public source revision**
implementing [Nightseam #705](https://github.com/Bitspark/nightseam/issues/705).
It is separate from the immutable [v0.6.0 baseline](../current/README.md), whose
released `Mount` still has its recorded gaps. Passing this gate does not claim
the new API is in a published runtime package. Release-pinned adoption remains
[Nightseam #703](https://github.com/Bitspark/nightseam/issues/703).

The runner fetches that exact public commit into a temporary checkout, verifies
the Bitwire module version, source revision and module sum, rejects a replaced
contract, installs frozen TypeScript dependencies and checks the installed
contract version. The independent fixture has a pinned SHA-256. Inputs omit
expected observations; Bitwire's separate judge refuses missing, extra,
duplicate and mismatched results. CI requires Go's race detector for the
production driver and supplementary upstream tests.

Nightseam's drivers adapt fixture actions to its public `ComposeDeclared` /
`Declared.compose`, `Decompose` / `decompose`, `Bind` / `bind` and existing
endpoint facilities. The assembler retains descriptions separately from
send-only access. They do not replace production routing, construction or parts
and never unwrap opaque children. Expected observations are authored and judged
in Bitwire. Native construction tests and actual requester-cancellation tests
through bound, selected and reconstructed access remain supplementary,
runtime-owned evidence; the runner executes them in both languages.

Coverage includes parent origin behavior, complete children and cuts, shared
state and aliases, exact paths and construction refusals, opaque guard state,
captured views after replacement, unchanged local associations, borrowed
ownership, and a pending request's late reply and cancellation. Deliberately
incorrect constructions remain counterexamples. See the
[decision](../../docs/decisions/0006-declared-composites-realize-deixis-nodes.md)
and [fixture inventory](../declared/README.md).

These carrier runs are Go/Go and TypeScript/TypeScript, with connected, ordered,
nonfaulting WebSockets. They do not establish cross-language composition,
verified authority, all concurrent schedules, fault transparency, other runtime
languages, generated/live adapter coverage or domain-specific tree conversion.
No Bitwire package gains a runtime dependency or needs a private checkout.

## Superseded decision 0005 evidence

`node scripts/conformance-production.mjs --decision=0005` preserves the earlier
gate: [27 cases](decision-0005-cases.json), unchanged byte for byte, against the
[original source pin](nightseam-decision-0005.json) from
[Nightseam PR #698](https://github.com/Bitspark/nightseam/pull/698). It performs
162 executions over the same languages and carriers. That API retained raw
declared children and inherited policies and refused response/cancel frames.
It is historical evidence for the superseded shape, separate from the current
origin-and-complete-child contract. CI's default production gate tests 0006.

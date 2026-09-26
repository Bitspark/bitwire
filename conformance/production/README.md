# Production acceptance for declared composites

**Historical evidence:** the observations and names below refer to the stated
0.1/0.2 addressed contract. In 0.3 that surface is `AddressedWire`; `Wire` is
addressless and `WireTree` is complete byte-keyed structure. These results do
not establish the new structural contract. See
[decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md).

Run `node scripts/conformance-production.mjs` to replay the 39
[decision 0006 cases](../declared/cases.json) through Nightseam's production Go
and TypeScript declared-composition API: `ComposeDeclared` /
`Declared.compose`, `Decompose` / `decompose` and `Bind` / `bind`. This is 234
case executions: both languages over local pairs and WebSockets in both
directions. `--language=go` or `--language=ts` selects one language.

Unlike the released baseline, this gate accepts **no gaps**. Every case must meet
its expectation exactly, including the 16 origin-bearing cases that released
`Mount` cannot express and the construction refusals it lacks.

The [pin](nightseam.json) identifies an **unreleased public source revision**
from [Nightseam PR #713](https://github.com/Bitspark/nightseam/pull/713), which
adopts [decision 0006](../../docs/decisions/0006-declared-composites-realize-deixis-nodes.md).
It is separate from the immutable [v0.6.0 baseline](../current/README.md), which
runs the same cases through a test-only interpreter and released `Mount` with
[recorded gaps](../declared/production-gaps.json). Passing this gate does not
put the API in a published runtime package. When a release ships it, the
baseline moves to that release and its gap ledger empties.

The runner fetches the pinned public commit into a temporary checkout and
verifies the Bitwire module version, source revision and module sum. It rejects
a replaced contract, installs the frozen TypeScript dependencies and checks the
installed contract version. The fixture's SHA-256 is pinned here, and must equal
the digest Nightseam records in its `conformance/declared/upstream.json`. Inputs
omit every expected observation. Bitwire's separate judge refuses missing,
extra, duplicate and mismatched results. CI also requires Go's race detector for
the production driver and the upstream construction and caller-cancellation tests.

Nightseam's drivers are Bitwire's declared-composite harness with only the
realization replaced by these public API calls. They add an origin adapter that
refuses nonempty paths. They do not replace production routing, construction or
decomposition. Expected results are authored and judged in Bitwire. The upstream
construction tests and actual requester-cancellation tests through bound,
selected and reconstructed access remain supplementary, runtime-owned evidence;
the runner executes them in both languages. Cancellation continues to target
the captured invocation after the assembler replaces its description.

These carrier runs are Go/Go and TypeScript/TypeScript, with connected, ordered,
nonfaulting WebSockets. They do not establish cross-language composition,
verified authority, all concurrent schedules, fault transparency, other runtime
languages, generated/live adapter coverage or domain-specific tree conversion.
No Bitwire package gains a runtime dependency or needs a private checkout.

The previous gate replayed the superseded decision 0005's 27 cases against
[Nightseam PR #698](https://github.com/Bitspark/nightseam/pull/698). That
evidence remains in history at [the last revision running it](https://github.com/Bitspark/bitwire/tree/fdc2ae99bbd4dcf1f887c5e32bbda2e315c890a1/conformance/production).

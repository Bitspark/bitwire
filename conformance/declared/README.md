# Declared-composite evidence

**Historical evidence:** the observations and names below refer to the stated
0.1/0.2 addressed contract. In 0.3 that surface is `AddressedWire`; `Wire` is
addressless and `WireTree` is complete byte-keyed structure. These results do
not establish the new structural contract. See
[decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md).

[Decision 0006](../../docs/decisions/0006-declared-composites-realize-deixis-nodes.md)
defines the realization: an origin at every node, complete named children, and
construction parts retained by their owner. Run `node scripts/conformance-current.mjs`
to exercise the [fixtures](cases.json) in Go and TypeScript.

## Two realizations, one oracle

The runner removes every `expected` value before handing inputs to a driver, and
compares complete observations itself. Missing, extra, duplicate and mismatched
results fail. Each driver runs the same 39 cases on local pairs and on WebSockets
in both directions:

| Realization | What is exercised | Result |
| --- | --- | --- |
| **Reference**, test-only | The [Go](../current/go/declared/main.go) and [TypeScript](../current/ts/declared.ts) interpreters of `compose(origin, children)` with retained parts, over released Nightseam selection, forwarding, endpoints and invocation facilities. | Every case meets its expectation. This is executable specification, not evidence about a runtime. |
| **Production**, Nightseam v0.6.0 | Released `Mount`/`mount` as the child-only specialization, with released `At`/`at`, `ForwardWire`/`forwardWire` and carriers. | The 20 cases expressible with a refusing origin meet their expectations. The other 19 must reproduce the exact observations in the [gap ledger](production-gaps.json). |

A production gap passes only while its observation stays exactly as recorded.
A changed observation fails, and so does a gap that starts conforming, which
must then be removed from the ledger. The oracle is never relaxed to fit a
runtime. The two drivers share their instrumented children, carriers and step
interpreter. They differ only in the realization that constructs composites.

## Coverage

Origin-bearing cases cover behavior at `[]` beside complete children. They
include direct, nested-selected, mounted-carrier, forwarded and reconstructed
access; complete cuts of different shapes agreeing; empty keys and paths, opaque
segments and composed/decomposed Unicode; and missing destinations that never
fall back to the origin. They also cover empty declared branches versus missing
ones: identical refusals, different retained parts.

Negative controls alter the description and show the difference in behavior:

- rebuilding from children alone loses the origin, and a fresh origin resets its
  state;
- copying a subtree breaks sharing with an alias;
- omitted, renamed and extra children change routing.

Construction refuses conflicting, invalid and missing children and cyclic
descriptions. Invalid paths never reach an origin. A captured view keeps its
original target after rebinding. A real request admitted through a composite
survives rebuilding, rebinding and teardown, then receives its late reply at the
original return capability and its captured cancellation.

The child-only cases repeat routing, selection, cuts, alterations, sharing,
substitution, forwarding, rebinding, the pending request and teardown with
refusing origins, so production can run them. Guard cases show interception
composed around access: a guard's state survives reconstruction of what it
guards, a fresh guard resets it, a guarded child is still complete access, and
rebuilding from views selected through a guard checks twice.

Every observation records whether each constructed composite retains exactly its
origin, children and keys, and copies its input. It also records whether every
message, original return capability and context marker reached its destination
unchanged; whether callers receive send-only access; and whether borrowed
endpoints stay usable afterwards. A context marker is a test association, not
verified authentication.

Mutating the Go reference so that a missing child falls back to the origin fails
3 cases; making reconstruction copy subtrees instead of reusing them fails 11.

## Recorded production gaps

The [ledger](production-gaps.json) records the exact Go and TypeScript
observations against released Nightseam v0.6.0:

| Gap | Observation |
| --- | --- |
| No origin-bearing construction | No public constructor takes an origin; 16 cases cannot be expressed. |
| Conflicting segments accepted | `Mount` takes an already-built map, so a later entry silently replaced an earlier one. |
| Invalid segments accepted | A key outside the UTF-8 image is copied, then unreachable because sending validates the path later. |
| Missing children accepted | A nil or undefined child is accepted, then refused as missing on send. |

Two limitations are recorded without cases. `Mount` types its children as
Endpoint, so send-only children need a receive-refusing adapter. `Mount` exposes
no parts, so the owner keeps the entries it supplied, which decision 0006
permits. Clearing the supplied map after construction left routing unchanged.

## Limits

Only Go and TypeScript have executable evidence; the other six presentations
carry the documented obligations. The fixtures use serial schedules and
connected, ordered, nonfaulting carriers; they do not prove concurrent state
synchronization or fault behavior. The carriers own identity and context mapping
after the last local hop.

Verified authority, generated live-value adapters and BitTree's conversion
cycles are not exercised here.

## Unreleased production API

Nightseam [PR #713](https://github.com/Bitspark/nightseam/pull/713) adopts
decision 0006 in its declared-composition API. The separate
[production gate](../production/README.md) runs these same 39 cases through that
API at a pinned unreleased source revision and accepts no gaps. The gap ledger
above still describes released v0.6.0 and empties once a release ships the API.

The superseded decision 0005 cases and their gate against Nightseam PR #698
remain in history at [`fdc2ae9`](https://github.com/Bitspark/bitwire/tree/fdc2ae99bbd4dcf1f887c5e32bbda2e315c890a1/conformance/production).

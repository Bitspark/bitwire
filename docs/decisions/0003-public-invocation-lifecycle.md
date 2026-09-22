# 0003: Invocation-aware composition has a public lifecycle contract

**Status:** accepted design requirements, 2026-09-21. Exact profile APIs and
implementation evidence remain required in
[Nightseam #439](https://github.com/Bitspark/nightseam/issues/439) and
[Bitwire #20](https://github.com/Bitspark/bitwire/issues/20).

**2026-09-22 update:** Nightseam #439 has landed in v0.6.0. The
[current baseline](../../conformance/current/README.md) separates executable
evidence from remaining Bitwire #20 review. [Decision 0004](0004-return-origins-and-profile-revisions.md)
records the return-origin and profile-revision disposition. The requirements
below remain acceptance criteria; publication does not discharge them.

## Decision and operator direction

The operator requires the correct long-term interface now. A migration that
works only because Nightseam recognizes its own private objects is insufficient.
This decision sharpens [0002](0002-delivery-dispatch-and-ownership.md); it does
not claim the invocation machinery is implemented by the released Bitwire package.

Keep generic addressed access small. Wire provides Send; Endpoint adds receive
attachment and closure. An invocation-aware dispatcher consumes an **explicit,
public, profile-specific lifecycle facility**, supplied at construction or through
an equivalent public capability. Its implementation and storage may remain private.
Independent same-profile implementations must be able to use the public contract
without importing internal packages, recognizing private concrete endpoint types
or unwrapping opaque endpoints.

The admitted invocation owns captured routing state. A registration controls
future selection; detachment and replacement cannot rewrite a selection already
captured for an invocation. A profile/runtime owns invocation identity, control,
terminal-state decisions and accounting. A dispatcher selects and captures a
target through that lifecycle contract; it cannot invent completion from a
delivery callback returning.

This is one lifecycle authority per invocation, not one global ledger for every
runtime, transport or machine. A carrier/profile bridge explicitly maps its local
invocation scope; pure routing preserves the original return capability and
runtime-associated context.

## Responsibilities the public interface must express

The exact Go and TypeScript method names are an implementation deliverable, not
frozen pseudocode in this decision. The public API and state rules must establish:

| Responsibility | Owner and required observation |
| --- | --- |
| Admission and identity | The profile runtime creates or resolves a validated admitted invocation. Queue admission and invocation admission are distinguished, and the point at which routing becomes fixed is specified. |
| Capture | The dispatcher registers an immutable target, registration generation and relative-path transformation for this invocation traversal before invoking receiver code. Multiple or repeated routing boundaries have distinct captures. |
| Cancellation | The lifecycle facility resolves the admitted invocation and its captured continuation. Cancellation is latched while captures are being installed, so a downstream capture cannot miss it. |
| Settlement and completion | Caller withdrawal, fixed outcome, actual executing-body completion and queued-control drain are distinct. The execution owner or generated binder reports actual body completion through explicit public participation; the dispatcher does not acquire that authority merely by observing delivery. |
| Retirement | Only the lifecycle owner authorizes capture reclamation when no permitted future or already admitted control requires it. A router cannot infer retirement from callback return, an optional Promise, a timeout or garbage collection. |
| Accounting | Unfinished bodies retain their execution permits after caller timeout/cancellation. Admission and total capture cost, including depth, are bounded. Completed sequential work does not accumulate permanent capture or tombstone history. |
| Ownership transfer | Deliberately detached work has an explicit execution owner; endpoint shutdown does not silently release the budget of a body that continues running. RPC retirement does not release returned live values. |

The integration must define race-safe capture registration against cancellation
and retirement, including refusal once capture is no longer admissible. A public
facility must preserve authority: arbitrary caller metadata or a forged lifecycle
handle does not establish an admitted invocation or verified context. Publishing
the interface does not make private runtime state caller-authored evidence.

For composed dispatchers, cancellation follows the captured traversal through
every relevant boundary. Retaining only an inner dispatcher object is insufficient
if that dispatcher subsequently repeats lookup in its current registrations.
State must distinguish separate traversals, not merely one mutable receiver field
or one slot per dispatcher when that dispatcher is visited more than once.
Bound total retained capture and control work as well as depth: shallow fan-out
can otherwise allocate unbounded state within a single invocation.

## Correlation identity and the two reuse races

Already admitted stale controls and newly arriving stale controls require
different arguments:

1. **Already admitted:** the queued control retains its old invocation handle or
   generation. Compare-and-remove prevents old cleanup from deleting a newer
   capture under the same lookup key.
2. **Newly arriving after reuse:** if the received control has exactly the same
   externally usable identity as a new invocation, a private generation counter
   cannot tell which invocation it means. The profile must prevent ambiguous
   reuse, carry distinguishing identity, or provide an actual retirement barrier
   making old controls impossible.

A fresh local return object can distinguish local requests, including equal
textual IDs on distinct return capabilities. It does not by itself distinguish
remote controls when the physical carrier still presents the same connection and
request ID. The identity discipline must hold at each actual correlation boundary,
with explicit mappings across carriers. Draining a local queue alone does not
prove that no old control can arrive later.

Prefer an adequate existing identity discipline over adding a network generation
field speculatively. Document the exact scope, minting/reuse rule, enforcement,
exhaustion and late-control behavior. Enforcing nonreuse must not silently require
an unbounded set of all past identifiers. Any changed wire semantics need an
explicit compatibility/profile-version decision.

## Independent implementations and unsupported cases

A generic Endpoint remains a valid addressed-delivery implementation without
this invocation facility. A dispatcher must refuse unsupported invocation-aware
use rather than silently weakening cancellation or retention guarantees.
Sharing a frame vocabulary is not itself lifecycle participation. A lookup into
a private native ledger, even if exposed publicly, is not a complete independent
integration. Handler/execution owners must have an explicit public way to supply
authoritative completion; opaque void callbacks cannot reveal it automatically.

That refusal is not the whole extensibility story. Acceptance requires two
independently implemented same-profile endpoint integrations and an opaque
forwarding wrapper through the
**public** facility, with no private concrete-type test. If the only successful
path is a native Nightseam object discovered through private state, the long-term
interface is not complete. Convenience factories may supply Nightseam's native
facility by default; the integration boundary must still be public and testable.
The independent implementations must not share a private ledger to make the
experiment work. Forwarding must explicitly preserve or bridge public lifecycle
participation between their facilities without replacing pure-routing return
identity. This experiment precedes declaring the exact lifecycle API settled.

## Delivery and acceptance

Nightseam owns a small compilable public Go/TypeScript API packet: interfaces,
construction, authority, state transitions and unsupported behavior. It also
owns actual runtime, generated-adapter, physical-carrier and live-value acceptance.
Bitwire owns the shared obligations, native Wire/Endpoint declarations and
independent composition observations. No second production runtime is introduced
here merely to make a contract test pass.

Before #20 and the final migration can close, link evidence for:

- Delayed responses and captured cancellation through detach/rebind, including
  void/early-returning callbacks and unchanged return identity.
- More sequential completed requests than the in-flight capacity, with bounded
  unfinished work and bounded nested capture cost.
- Both identity-reuse races, cancellation during capture construction, and
  shutdown while application work continues.
- Independent public lifecycle integration through opaque endpoints, nested and
  repeated dispatcher traversal, mounts and two-connection forwarding.
- Caller settlement versus actual body completion, and returned callable lifetime
  surviving retirement of the invocation that returned it.

The 0.2 reference experiment proves useful addressed composition and retained
replies; it does not supply this full lifecycle proof. A release or a green
declaration check cannot replace these observations.

The existing 0.2.0 tag is immutable. Its publication is not a reason to preserve
an inadequate interface. If implementation evidence demonstrates that shared
public declarations need to change, specify and review that change and publish
a new appropriate version. Do not bolt on private exceptions, conceal a changed
profile, or rewrite the released tag to avoid the version change.

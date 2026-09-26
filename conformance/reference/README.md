# Receive ownership and composition reference

**Historical evidence:** the observations and names below refer to the stated
0.1/0.2 addressed contract. In 0.3 that surface is `AddressedWire`; `Wire` is
addressless and `WireTree` is complete byte-keyed structure. These results do
not establish the new structural contract. See
[decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md).

Run `node scripts/composition.mjs` after installing the repository's pinned
dependencies. This compiles and executes independent Go and TypeScript
implementations against the current Bitwire declarations. Both must produce the
observations in [expected.json](expected.json). Neither implementation reads that
oracle; the runner performs the comparison.

These are **test-only reference implementations**, not a runtime shipped in the
Bitwire packages. They demonstrate a possible composition of the smaller 0.2
contract. They neither migrate Nightseam nor prove behavior of its generator.

## The design exercised

A pair owns delivery scheduling and each endpoint has one receive attachment.
An explicit dispatcher owns that attachment and provides independent prefix
registrations. Send-only selection and mounting return Wire values: access to a
destination does not confer permission to replace its receiver or close it.
Separately, the dispatcher exposes selected Endpoint values with the same
`receive(receiver)` interface as a root. Each receiving view owns its attachment
and route; closing it does not close the borrowed root. Nested views use the same
dispatcher, without acquiring additional root attachments. Root closure ends the
views, notifying only their active attachments, at most once.

The reference dispatcher deliberately chooses **unique prefix registrations,
longest prefix wins, suffix-relative callback paths**. This is optional dispatcher
policy, not a requirement of Wire or Endpoint. A different dispatcher could
reject overlap or use exact routes without changing those interfaces. In
particular, it need not reproduce 0.1's exact-versus-namespace registration table.

| Scenario | Independent expected observation |
| --- | --- |
| Two sibling selected views | Both deliver through one root attachment; detaching one leaves the other working. Delivery does not run inside Send. |
| Receive ownership | A second root attachment is refused; detaching allows replacement; a stale repeated detach cannot remove that replacement. |
| Overlapping selected views | The deeper prefix wins; detaching it exposes the parent prefix; duplicate prefixes are refused by the dispatcher. |
| Nested selection, empty-key mount and forwarding | A nested selected Endpoint receives `['run', '']`, preserves the complete frame, return identity and an opaque context association, and captures the original return capability. Its reply succeeds **after** receiver detach, view closure and forwarder detach. |
| Borrowed endpoint lifetime | Detaching the forwarder leaves both endpoints usable. Send-only selected/mounted access does not expose endpoint close. |
| Selected Endpoint attachment and closure | Nested receiving and sending paths remain relative to the view. Duplicate receive is refused; detach/rebind works, including stale detach. Closing an active view notifies once; closing a detached view never notifies its old receiver. |
| Shared root and sibling ownership | A closed view refuses Send and Receive, but its route can be reused by a fresh view and its sibling still receives. Root closure notifies the remaining active sibling once, refuses new root/view attachment, and repeated close does not notify again. |
| Equal request IDs with distinct return identities | Two callers both use `same-id`; their original return capabilities survive receiver detach, view closure and route replacement. Delayed replies sent in reverse order reach the corresponding original callers. The replacement receiver sees only its new probe event. |
| Opaque paths | Empty segments, a slash within one segment, two segments, and composed/decomposed Unicode reach distinct destinations. |

The scheduler is intentionally explicit and drained by the test. It establishes
deferred dispatch for this reference without pretending to implement production
queue bounds, physical transport or concurrent lifetime behavior. Go passes the
Message value unchanged and compares its entire frame and return pointer;
TypeScript additionally checks message and frame object identity. The context
association is a test-owned private map, not authentication evidence.

The delayed-reply case is deliberately bounded. A receiving callback returning
does not establish completion of the asynchronous invocation. The reference
captures the original return capabilities unchanged; it neither wraps them nor
builds a cancellation or completion ledger. Runtime/profile-owned cancellation
association, terminal completion, cleanup and concurrent lifetime interleavings
remain unproved here and require explicit integration in the runtime.

## What this establishes and what comes next

One receive attachment is sufficient for multiple selected receivers **when a
shared dispatcher explicitly owns it**. Two independent wrappers cannot each
take ownership of the same endpoint. This is the architectural obligation that
must be retained in a real runtime migration.

Nightseam must implement and validate its own dispatcher, ownership, profile and
generated adapters against the new contract. Generic model substitution and
commutation still need tests using the actual generated adapters. These reference
tests are evidence for access composition, not that separate claim.

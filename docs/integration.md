# Integration and current status

## Current state

Bitwire **0.2.0** is released in all eight native presentations. Wire provides
send access; Endpoint adds one receive attachment and closure. Dispatchers own
path registration and matching above that boundary.

Nightseam adopted the complete Go/TypeScript type family and the public
invocation lifecycle in [PR444](https://github.com/Bitspark/nightseam/pull/444),
merged as `ce70365a41409e54329c3883c2a888c965c1313b`. Both upstream adoption
issues, #421 and #439, are closed. **Nightseam v0.6.0**, at
`5cc9723a24646c40ed1861f892b2b23eb6d785d7`, is the current immutable baseline.
Go aliases and TypeScript re-exports the released Bitwire 0.2.0 definitions;
there is no second native type family at that boundary.

The [current conformance baseline](../conformance/current/README.md) executes
Bitwire's independent composition expectations against those production
implementations, and adds independently specified lifecycle observations.
Supplementary upstream tests exercise independent endpoints and runtime races.
Historical 0.1 evidence and the test-only 0.2 reference remain distinct.

Nightseam's chosen lifecycle representation uses the request's existing return
Wire and profile-defined paths. It needs no new Bitwire method. Publication and
these scoped observations do not imply complete cross-domain interoperability.

[Decision 0006](decisions/0006-declared-composites-realize-deixis-nodes.md)
specifies declared composites as Deixis nodes with an origin at every node.
Released Nightseam realizes only the child-only specialization through
`Mount`. The [declared evidence](../conformance/declared/README.md) records its
conforming cases and the exact gaps an origin-bearing constructor must close.
Nightseam's merged, unreleased implementation of
[#705](https://github.com/Bitspark/nightseam/issues/705) supplies that constructor
in Go and TypeScript. The [source production gate](../conformance/production/README.md)
verifies all 39 independent cases at a public commit, plus upstream construction
and caller-cancellation tests. This closes the source implementation gaps without
changing the v0.6.0 release baseline or claiming published-package acceptance.

## Open review findings

[Decision 0004](decisions/0004-return-origins-and-profile-revisions.md) answers
the two findings recorded in [PR26](https://github.com/Bitspark/bitwire/pull/26):

1. A callable return Wire has its own relative-path origin. A profile defines
   supported operations and may reserve that origin's path space. Pure routing
   still preserves the original return identity and context.
2. Nightseam has documented its pre-1.0 release-based profile versioning.
   Bitwire accepts that explicit disposition for the pinned 0.6.0 baseline,
   without treating all releases named `nightseam.duplex/1` as compatible.

[#20](https://github.com/Bitspark/bitwire/issues/20) remains open for full
acceptance review, particularly actual generated/live/context observations,
execution-owner authority, shutdown and asynchronous control-drain obligations.
The [coverage table](../conformance/current/README.md#review-and-outstanding-acceptance)
states what is exercised here and what still needs assessment. The absence of
a new primitive is not an exemption from those requirements.

## Dependency direction

```text
bitruntime and its implementations ────────────┐
Bitlink's planned adapters and generation ──────┼──> Bitwire contract
Consumer-owned space/service composition ──────┘
```

Bitwire owns access semantics, language declarations, the protocol and carrier
specifications, and independent criteria. [Decision 0010](decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md)
places the implementations in bitruntime, the contract language in bittype, and
adapters and their generation in Bitlink. Until they deliver, frozen Nightseam
v0.6.0 is the implementation in use. Consumers own domain
contracts, attachment rules and application policy. Bitwire packages have no
runtime dependency on those consumers, on Nightseam or on bitruntime, and
`node scripts/check.mjs` fails if a published package depends on or imports
Nightseam or bitruntime. Identity
cryptography and authentication are outside this access contract; access alone
is not proof of authority.

## Next steps

1. Review and link the remaining exact-release runtime/generated acceptance
   against #20; do not infer completion from a passing subset.
2. Use a real downstream scenario that discovers a capability, invokes it,
   receives child access and continues composition. Compare local and remote
   observations under one declared contract. Attachment remains the consumer's
   obligation rather than a hidden adapter workaround.
3. As a second generator becomes implemented, exercise it against the same
   contract and profile revision, including generic slots containing callbacks.
   Different domain meanings need explicit adapters; a shared Wire signature
   does not translate them automatically.

The immutable [first delivery](delivery.md) and
[ownership decision](decisions/0001-shared-wire-contract.md) retain their
historical provenance. The [language matrix](languages.md) separates native
package availability from runtime and generator adoption.

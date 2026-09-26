# Decisions

One page records one decision, its scope and its consequences. A later decision
may supersede it; historical decisions are not silently rewritten into a different
choice. An accepted repository boundary does not imply a completed implementation.

| Decision | Status |
| --- | --- |
| [0011: Bitwire is Deixis over Ends](0011-bitwire-is-deixis-over-ends.md) | **Proposed** for review on #42 with Deixis, bitstore and bitruntime; not accepted. |
| [0010: Bitwire holds the contract, and bitruntime implements it](0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md) | Accepted; supersedes where 0007 put the implementations and the part of 0009 that says Bitwire provides carriers. bitruntime, bittype and bittheory were created with charters on 2026-09-26 and hold no code yet. |
| [0009: Which carriers Bitwire provides, and how byte streams carry frames](0009-carriers-bitwire-provides-and-byte-stream-framing.md) | Accepted; carrier groups and the `bitwire-stream/1` framing. The [carrier specification](../wire/carriers.md) is a draft; nothing is implemented. Implemented by bitruntime under 0010. |
| [0008: A protocol revision has its own identity](0008-a-protocol-revision-has-its-own-identity.md) | Accepted; supersedes 0004's compatibility section. Takes effect when 0007 publishes the protocol. |
| [0007: Using Bitwire never requires Nightseam](0007-using-bitwire-never-requires-nightseam.md) | Accepted and amended the same day. Its rule and independence check stand; where it put the implementations is superseded by 0010, which moves them to bitruntime. |
| [0006: Declared composites realize Deixis nodes over origin behavior](0006-declared-composites-realize-deixis-nodes.md) | Accepted; Go/TypeScript reference and unreleased production construction pass all cases. Released Nightseam child-only specialization retains recorded gaps. |
| [0005: Declared composition retains own behavior and subtree policy](0005-declared-composition-and-subtree-policy.md) | Superseded by 0006 before release; its policy is re-expressed as a guard around access. |
| [0004: Return origins and profile revisions make composition explicit](0004-return-origins-and-profile-revisions.md) | Accepted clarification; current Go/TypeScript baseline and remaining acceptance recorded. Compatibility section superseded by 0008. |
| [0003: Invocation-aware composition has a public lifecycle contract](0003-public-invocation-lifecycle.md) | Accepted requirements; Nightseam implementation landed, scoped evidence and remaining review recorded. The state machine moves to Bitwire under 0007. |
| [0002: Separate addressed delivery, dispatch and endpoint ownership](0002-delivery-dispatch-and-ownership.md) | Accepted for 0.2.0; adopted in Nightseam Go/TypeScript 0.6.0. |
| [0001: The shared Wire contract has an independent home](0001-shared-wire-contract.md) | Accepted scope; eight bindings delivered, consumer adoption tracked separately. Carrier and profile ownership superseded by 0007. |

# Decisions

One page records one decision, its scope and its consequences. A later decision
may supersede it; historical decisions are not silently rewritten into a different
choice. An accepted repository boundary does not imply a completed implementation.

| Decision | Status |
| --- | --- |
| [0006: Declared composites realize Deixis nodes over origin behavior](0006-declared-composites-realize-deixis-nodes.md) | Accepted; Go/TypeScript reference and unreleased production construction pass all cases. Released Nightseam child-only specialization retains recorded gaps. |
| [0005: Declared composition retains own behavior and subtree policy](0005-declared-composition-and-subtree-policy.md) | Superseded by 0006 before release; its policy is re-expressed as a guard around access. |
| [0004: Return origins and profile revisions make composition explicit](0004-return-origins-and-profile-revisions.md) | Accepted clarification; current Go/TypeScript baseline and remaining acceptance recorded. |
| [0003: Invocation-aware composition has a public lifecycle contract](0003-public-invocation-lifecycle.md) | Accepted requirements; Nightseam implementation landed, scoped evidence and remaining review recorded. |
| [0002: Separate addressed delivery, dispatch and endpoint ownership](0002-delivery-dispatch-and-ownership.md) | Accepted for 0.2.0; adopted in Nightseam Go/TypeScript 0.6.0. |
| [0001: The shared Wire contract has an independent home](0001-shared-wire-contract.md) | Accepted scope; eight bindings delivered, consumer adoption tracked separately. |

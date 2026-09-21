# Integration and current status

## Current state

The scaffold establishes an independently owned Wire contract project. It has
Go and TypeScript declarations adapted from Nightseam's public implementation,
documentation and repository checks. It does not change any consumer dependency.

Nightseam still defines and implements its own Wire. Its generated adapters use
Nightseam's runtime context and value environment in addition to Wire. Bitlink's
protocol-generation model is design work; this repository supplies no Bitlink
generator. Bitsystem's typed-space model is a consumer of the intended boundary.

In particular, the initial Go declarations introduce distinct named types. An
existing `nightseam/duplex/go.Wire` does not automatically implement
`bitwire/wire/go.Wire` merely because their methods look alike: their parameter
types must also match. An upstream alias/import migration or an explicit adapter
is still required. TypeScript structural compatibility likewise does not prove
behavior or protocol compatibility.

## Intended dependency direction

```text
Nightseam runtime and generated adapters ──┐
Bitlink's generated protocol adapters ────┼──> Bitwire contract
Bitsystem's space composition ────────────┘
```

Bitwire has no runtime dependency on these consumers. Archon is a useful model
for a small independently specified foundation, not a required dependency:
identity cryptography and authentication do not belong in this access package.

## Reconcile the ownership records

Nightseam's [2026-09-21 decision](https://github.com/Bitspark/nightseam/blob/5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515/docs/decisions/the-reusable-foundation-lives-in-nightseam.md)
currently assigns both Wire specification and implementation to Nightseam.
Bitlink's older model assigns an entire runtime extraction to the name Bitwire.
The [Bitwire decision](decisions/0001-shared-wire-contract.md) selects a narrower
scope: shared contract and conformance here, runtime implementation in Nightseam.
The sibling records have not been amended by this bootstrap; adoption must make
their ownership statements agree.

## Next steps

1. Review the draft against the pinned Nightseam behavior and identify the exact
   common contract and required profile obligations.
2. Extract independent behavioral cases and a driver that exercises existing
   implementations. Keep each case's expected observations separate from runtime
   code. Do not require a second runtime before this can be useful.
3. Migrate Nightseam's public Wire definitions to the agreed package, preserving
   generated APIs, identity checks, scoped references and composition behavior.
4. Exercise the same generated model over a local origin, a mounted/selected
   origin and a physical carrier; compare their observations.
5. As Bitlink gains an implementation, exercise both generators against the same
   declared contract and profile, including generic slots containing callbacks.

The [conformance plan](../conformance/README.md) distinguishes these observations
from the compilation and documentation checks that run today.

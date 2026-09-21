# Integration and current status

## Current state

The released **0.2.0 contract** separates send-only Wire from Endpoint receive
attachment/closure and dispatcher routing. The
[decision](decisions/0002-delivery-dispatch-and-ownership.md) records the reasoning,
shared receive ownership and migration. New reference composition checks are
test-only evidence; they do not establish actual Nightseam adoption.
[Nightseam #439](https://github.com/Bitspark/nightseam/issues/439) owns the runtime
and generated-adapter migration, coordinated with #421. The verified
[public handover](https://github.com/Bitspark/nightseam/issues/439#issuecomment-5759045944)
provides the immutable source and Go/npm coordinates. Publication and
post-adoption acceptance remain separate gates; [capture retirement](https://github.com/Bitspark/bitwire/issues/20)
still requires actual runtime evidence.

The [0.1.0 release](https://github.com/Bitspark/bitwire/releases/tag/v0.1.0) provides eight native contract bindings, package checks and
ten independent access-composition cases executed in Go and TypeScript against
public Nightseam revision `1c63f1c4d7e4b5987d4bd32e294177645c92ed8f`. The
[language matrix](languages.md) records publication separately. These changes do
not themselves migrate any consumer dependency.

At the baseline revision, Nightseam defines and implements its own Wire. Its generated adapters use
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

## Ownership records

At bootstrap, Nightseam's [earlier 2026-09-21 decision](https://github.com/Bitspark/nightseam/blob/5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515/docs/decisions/the-reusable-foundation-lives-in-nightseam.md)
assigned both Wire specification and implementation to Nightseam.
Bitlink's older model assigns an entire runtime extraction to the name Bitwire.
The [Bitwire decision](decisions/0001-shared-wire-contract.md) selects a narrower
scope: shared contract and conformance here, runtime implementation in Nightseam.

Nightseam has since approved that narrower boundary. Its required 0.6.0 adoption
task, [#421](https://github.com/Bitspark/nightseam/issues/421), has received the
public v0.1.0 coordinates and behavioral evidence. Go and npm registry consumers
passed without checkout replacements in the [release run](https://github.com/Bitspark/bitwire/actions/runs/35577033829).
Public Nightseam builds and installation require no private Bitwire access. The decision-record
revision is tracked separately in [#422](https://github.com/Bitspark/nightseam/issues/422).
This approval does not change the current imports or establish completed adoption.
Bitlink's older whole-runtime description still needs reconciliation.

## Next steps

1. Migrate Nightseam's public Wire/Endpoint definitions to released 0.2.0,
   moving handler registration into a shared dispatcher while preserving
   generated APIs, identity checks, scoped references and composition behavior.
2. Exercise the same generated model over a local origin, a mounted/selected
   origin and a physical carrier; compare their observations.
3. As Bitlink gains an implementation, exercise both generators against the same
   declared contract and profile, including generic slots containing callbacks.

The [conformance baseline](../conformance/README.md) distinguishes the executable
observations from remaining runtime/profile obligations and declaration checks.

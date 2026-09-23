# First delivery

## Declared composites, unreleased

[Issue #29](https://github.com/Bitspark/bitwire/issues/29) and
[decision 0006](decisions/0006-declared-composites-realize-deixis-nodes.md)
realize Deixis v0.2.0's `Node[T]` with an origin at every node and complete
named children. The work has separate lanes:

1. **Contract and acceptance, this repository.** The decision, the shared
   contract, the composition guide, all eight binding documents, 39 independent
   cases, test-only reference interpreters and the
   [production gap ledger](../conformance/declared/production-gaps.json).
   Native declarations do not change, so this needs no package release of its
   own; it is recorded under Unreleased for the next contract release.
2. **Production construction, Nightseam.** An origin-bearing constructor over
   complete send-only children that refuses conflicting, invalid and missing
   children at construction. Nightseam PR #713 provides it in unreleased
   source; Bitwire's [production gate](../conformance/production/README.md)
   runs all 39 cases through it with no gaps accepted. Once a release ships it,
   the released baseline moves to that release and the gap ledger empties.
   Until then, released v0.6.0 conforms only as the child-only specialization.
3. **Consumers, their own repositories.** BitTree and other consumers own their
   domain mappings; this contract does not certify them.

## Subsequent 0.2.0 delivery

The immutable [v0.2.0 release](https://github.com/Bitspark/bitwire/releases/tag/v0.2.0)
is commit `616a2fc5e3a0972f67f40331a9d9ca102bc9698d`. Its
[public rehearsal](https://github.com/Bitspark/bitwire/actions/runs/35588663413)
and [core publication/registry consumers](https://github.com/Bitspark/bitwire/actions/runs/35588831224)
passed. The [language matrix](languages.md) records each additional distribution.
The [Nightseam handover](https://github.com/Bitspark/nightseam/issues/439#issuecomment-5759045944)
supplies verified coordinates. [Issue #20](https://github.com/Bitspark/bitwire/issues/20)
remains open for actual capture-retirement evidence in Nightseam; publication and
the reference composition experiment do not close it.

The [accepted separation](decisions/0002-delivery-dispatch-and-ownership.md)
updates all eight bindings, adds a test-only composition experiment, and requires
a new immutable minor release. The delivery sequence is package and composition
checks, reviewed merge, exact-commit public rehearsal, tag/publication and clean
registry/source consumers. [Nightseam #439](https://github.com/Bitspark/nightseam/issues/439)
implements the runtime and generator changes in parallel. It must use the new
release and provide its own combined acceptance; Bitwire's reference experiment
does not discharge those obligations. The historical first delivery follows.

[Delivery issue #2](https://github.com/Bitspark/bitwire/issues/2) and
[milestone 0.1.0](https://github.com/Bitspark/bitwire/milestone/1) track the first
public contract and the complete eight-language scope.

## Delivered handover

The public, immutable [v0.1.0 release](https://github.com/Bitspark/bitwire/releases/tag/v0.1.0)
is commit `9f45a2e0e9dc576db34237e5ad3aaaa0266a276b`. The exact-commit
[public rehearsal](https://github.com/Bitspark/bitwire/actions/runs/35576831304)
and [registry installation checks](https://github.com/Bitspark/bitwire/actions/runs/35577033829)
passed. Go, npm, Rust, Python and Java are publicly installable; the
[language matrix](languages.md) records all eight distribution statuses.

The [Nightseam handover](https://github.com/Bitspark/nightseam/issues/421#issuecomment-5757542437)
provides the pinned coordinates and independent driver invocation. Nightseam owns
its import migration and the combined acceptance against the shared types.

## Work streams

1. [Review the common contract](https://github.com/Bitspark/bitwire/issues/3),
   including its existing profile obligations and native representations.
2. [Execute independent behavioral cases](https://github.com/Bitspark/bitwire/issues/4)
   through public Nightseam surfaces at a pinned source revision.
3. Implement and package the [eight bindings](languages.md) in parallel once
   their shared semantics are settled.
4. [Prepare and rehearse publication](https://github.com/Bitspark/bitwire/issues/5),
   including outside-workspace consumers of the exact package artifacts.
5. Publish the first usable contract and hand the verified coordinates and
   evidence to [Nightseam #421](https://github.com/Bitspark/nightseam/issues/421).
   Nightseam then imports or deliberately re-exports the shared types and reruns
   its generated-adapter and composition acceptance against them.

## First observable chain

A caller sends through a selected and mounted Wire. A receiver observes the
expected relative path and returns a reply. Pure routing retains local return
identity and context; constructing a carrier may map return capabilities as its
profile requires. Detaching or closing the mount leaves its borrowed endpoint
usable. Independent expected observations hold that behavior to the contract.

This is complemented by path distinctions, selection composition, receiver
precedence, admission and lifetime cases. Compiling declarations cannot replace
these observations. Full generated-model transparency remains a distinct
upstream acceptance obligation.

## Dependency direction

Published Bitwire libraries have no dependency on Nightseam, Bitlink or Bitsystem.
A test-only driver can depend on a pinned public Nightseam source revision.
The driver reports what implementation and contract were exercised. Local
development overrides cannot satisfy the final public consumer-install check.

## Public handover gate

Before Nightseam can adopt a released dependency:

- The common definition and profile boundary are reviewed and versioned.
- Independent Go/TypeScript cases execute against the pinned implementation.
- The exact Go/TypeScript package artifacts pass content and clean-install checks.
- A public immutable source tag and npm version resolve without private access.
- License, provenance, package coordinates and maintenance ownership are recorded.
- The consuming Nightseam task receives the exact version and evidence.

Additional bindings and registry setup proceed in parallel. They are reported
explicitly rather than disappearing from scope or silently widening the 0.6.0
handover gate. [Releasing](../RELEASING.md) records the operational procedure.

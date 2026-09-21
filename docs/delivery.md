# First delivery

[Delivery issue #2](https://github.com/Bitspark/bitwire/issues/2) and
[milestone 0.1.0](https://github.com/Bitspark/bitwire/milestone/1) track the first
public contract and the complete eight-language scope.

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

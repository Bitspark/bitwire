# 0001: The shared Wire contract has an independent home

**Partly superseded** by [decision 0007](0007-using-bitwire-never-requires-nightseam.md)
on 2026-09-25. Using Bitwire must never require Nightseam, so the operators,
carriers and network profile left in Nightseam below move to Bitwire. The record
below is unchanged history.

**Status:** accepted scope, 2026-09-21. **Delivery:** [0.1.0](../delivery.md).

## Question

Where should the contract connecting protocol adapters, runtime access and typed
space composition be defined?

## Decision

Bitwire owns the shared access contract, its supporting language declarations,
composition laws and independent conformance criteria. Nightseam remains the home
of its runtime and generator. Bitlink may target the same contract from its own
protocol projections. Consumers supply their models and application policy.

The project starts with Go and TypeScript declarations based on Nightseam's
implemented Wire. It retains the existing message profile and does not rename
`nightseam.duplex/1`. This is a contract extraction, not a fork of the runtime or
a replacement declaration language.

The initial repository is private. Documentation, source and verification are
organized for eventual public use, with no private dependencies or credentials.
There is no package publication or release in this bootstrap.

The subsequent 0.1.0 delivery made the repository and immutable source release
public. The [language matrix](../languages.md) records verified package
availability; the initial scope and runtime ownership remain unchanged.

## Why

The contract can be specified and checked without owning a generator, a carrier
or an application. Giving that contract one home makes its ownership and version
boundary explicit for multiple consumers. One set of conformance observations
should hold every implementation to the same meaning.

A separate repository does not itself establish composability. The interface,
its laws and the observed behavior do. The separation is useful only while the
contract remains small and the consumers actually share it.

## Consequences

The complete scope includes Go, TypeScript, Python, Rust, Swift, C++, Java and
Haskell; Go and TypeScript were the initial scaffold. Changes to meaning must
update every delivered presentation, the specification and shared cases together.
Runtime-specific dependencies must not leak into
the contract package. Shared method names alone do not establish interoperability;
the required profile, identity and live-reference agreements remain explicit.

At bootstrap, the older Bitlink whole-runtime decomposition and Nightseam's
specification-home decision needed reconciliation. Nightseam has since approved
this narrower boundary: [#421](https://github.com/Bitspark/nightseam/issues/421)
requires adoption in 0.6.0 once Bitwire is ready, and
[#422](https://github.com/Bitspark/nightseam/issues/422) tracks the decision-record
revision. Bitlink's older description still needs reconciliation. These decisions
do not claim completed consumer migration. See [integration](../integration.md).

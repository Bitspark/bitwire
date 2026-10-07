# Documentation

Read [the charter](../CHARTER.md), [wire contract](wire/contract.md),
[carrier and addressed formats](wire/carriers.md),
[decision 0015](decisions/0015-addressless-wires-and-addressed-access.md), and
[language delivery matrix](languages.md).

[Communication composition](wire/composition.md) documents the target for
runtime trees, explicit routing/mounts, multiplexing, wire export and additional
carriers. [Decision 0016](decisions/0016-communication-composition.md) distinguishes
that direction from the protocols and implementations still to be delivered.

The [hydrated composition](wire/hydrated.md) explains messages containing live
wires and composable domain adapters. [Decision 0019](decisions/0019-hydrated-wire-protocol.md)
is accepted. The [native contracts](wire/hydrated-native.md) and [pure Go/TypeScript
codec](wire/hydrated-codec.md) implement its public foundation, with
[independent vectors](../conformance/hydrated-vectors.json). The
[0.6.0 change record](releases/0.6.0.md) separates these artifacts from the runtime.
Its [adapter composition](wire/hydrated.md#composing-domain-adapters) section states
the commuting and lifting laws, direction requirements and nested Cell examples.

Addressless interaction, addressed access and complete structure are different
contracts. Each has one current meaning. Superseded implementations are removed;
immutable releases and dated decisions retain the historical evidence.

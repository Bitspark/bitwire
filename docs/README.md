# Documentation

Read [the charter](../CHARTER.md), [wire contract](wire/contract.md),
[carrier and addressed formats](wire/carriers.md),
[decision 0015](decisions/0015-addressless-wires-and-addressed-access.md), and
[language delivery matrix](languages.md).

[Communication composition](wire/composition.md) documents the target for
runtime trees, explicit routing/mounts, multiplexing, wire export and additional
carriers. [Decision 0016](decisions/0016-communication-composition.md) distinguishes
that direction from the protocols and implementations still to be delivered.

The [hydrated wire proposal](wire/hydrated.md) develops the application-facing
layer for messages containing live wires, with a recursive value domain, candidate
ground encoding, ownership laws and the protocol decisions needed before code.
[Decision 0019](decisions/0019-hydrated-wire-protocol.md) proposes those decisions
for a first edition, with [independent vectors](../conformance/hydrated-vectors.json).
The proposal's [adapter composition](wire/hydrated.md#composing-domain-adapters) section states
the commuting and lifting laws, direction requirements and nested Cell examples.

Addressless interaction, addressed access and complete structure are different
contracts. Each has one current meaning. Superseded implementations are removed;
immutable releases and dated decisions retain the historical evidence.

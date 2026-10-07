# Documentation

Read [the charter](../CHARTER.md), [wire contract](wire/contract.md),
[carrier and addressed formats](wire/carriers.md),
[decision 0015](decisions/0015-addressless-wires-and-addressed-access.md), and
[language delivery matrix](languages.md).

[Communication composition](wire/composition.md) documents the target for
runtime trees, explicit routing/mounts, multiplexing, wire export and additional
carriers. [Decision 0016](decisions/0016-communication-composition.md) distinguishes
that direction from the protocols and implementations still to be delivered.
[Tree routing](wire/routing.md), proposed by [decision 0017](decisions/0017-tree-routing.md),
is the first of those protocols: routing opaque messages through a tree of
runtime instances in one absolute namespace.

Addressless interaction, addressed access and complete structure are different
contracts. Each has one current meaning. Superseded implementations are removed;
immutable releases and dated decisions retain the historical evidence.

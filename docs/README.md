# Documentation

Read [the charter](../CHARTER.md), [wire contract](wire/contract.md),
[carrier and addressed formats](wire/carriers.md),
[decision 0015](decisions/0015-addressless-wires-and-addressed-access.md), and
[language delivery matrix](languages.md).

[Communication composition](wire/composition.md) documents the target for
runtime trees, explicit routing/mounts, multiplexing, wire export and additional
carriers. [Decision 0016](decisions/0016-communication-composition.md) distinguishes
that direction from the protocols and implementations still to be delivered.
[Exporting a Wire](wire/export.md), proposed by [decision 0018](decisions/0018-wire-export.md),
is the first of those protocols: live, connection-scoped export of a send-only
Wire, with re-export through another hop.

Addressless interaction, addressed access and complete structure are different
contracts. Each has one current meaning. Superseded implementations are removed;
immutable releases and dated decisions retain the historical evidence.

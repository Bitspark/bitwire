# Identity and ownership

bitwire defines opaque message interaction and its composable access layers.
bitruntime implements them. Services interpret messages. The contract must stay
usable without any particular carrier, runtime, service or invocation protocol.

The defining boundaries are:

- **W1 — Addressless sending.** Wire sends one ground ontos Value. No path, ID,
  reply address, RPC kind or deadline is mandatory in that value.
- **W2 — Addressed access.** AddressedWire adds a separate exact byte-path
  argument. Its representation is an ordinary value carried by W1. It must be
  realizable once above every conforming carrier.
- **W3 — Complete structure.** WireNode is the complete DeixisNode of Wire own
  values. Opaque addressed access is not a tree or a discovery guarantee.
- **W4 — Ownership.** Endpoint adds one receive owner and connection lifecycle.
  A send capability alone grants neither. Structural selection/reconstruction
  acquires, invokes and disposes of no borrowed resource.
- **W5 — Honest outcomes.** Successful send is local admission. Structural
  absence, admission refusal, termination and application outcomes are distinct.
- **W6 — Independent meaning.** The written laws and independently derived cases
  judge implementations. Language count, compilation and consumer adoption are
  not independent proof of the architecture.

[Decision 0015](docs/decisions/0015-addressless-wires-and-addressed-access.md)
records the reconsideration; [the contract](docs/wire/contract.md) states the
current laws. deixis's generic structure permits sender and receiver instances
equally and is not amended by a bitwire implementation choice.

The [composition architecture](docs/wire/composition.md) applies W1-W6 to future
distributed routing, multiplexing and live-wire export. It is a target and a set
of implementation obligations, not a claim that those protocols already exist.
The [hydrated native contracts](docs/wire/hydrated-native.md) and accepted
[decision 0019](docs/decisions/0019-hydrated-wire-protocol.md) now define the
recursive live-value boundary above W1 without changing its ground domain.
Their live realizations belong in bitruntime; executable topology policy and
durable service allocations remain with their consumers.

Changes to these boundaries need an explicit decision identifying the affected
IDs, the failing use case, alternatives, expected observations and consumer
migration. Advice that holds a boundary fixed cannot independently justify that
boundary. Preserve historical evidence; update current guidance and all native
presentations together. Remove superseded implementations rather than carrying
compatibility machinery into the replacement.

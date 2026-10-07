# rs wire presentation

Addressless Wire sends a ground ontos value. Endpoint adds receive ownership and
closure. AddressedWire adds an exact byte-path argument; AddressedEndpoint carries
that layer over one endpoint. WireNode is the complete deixis structure over Wire
values (a nominal interface in Java), not opaque route access.

See the repository's docs/wire/contract.md and docs/wire/carriers.md. Version 0.5.0
is a clean breaking replacement; compilation and packaged consumers check the
native surface, while bitruntime supplies independently tested implementations.

The public hydrated declarations add recursive atoms, tuples and send-only live
wires above the ground boundary. HydratedEndpoint retains receive/lifetime
ownership; its wire view conveys only sending. Arrival context is established by
composition outside the message. Runtime construction and recognition enforce
finite immutable tuples, ground canonicalization and owned capability identity;
implementing a native interface alone does not make a foreign object exportable.
See [hydrated native contracts](../../docs/wire/hydrated-native.md) and
[decision 0019](../../docs/decisions/0019-hydrated-wire-protocol.md).

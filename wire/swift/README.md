# swift wire presentation

Addressless Wire sends a ground Ontos value. Endpoint adds receive ownership and
closure. AddressedWire adds an exact byte-path argument; AddressedEndpoint carries
that layer over one endpoint. WireTree is the complete Deixis structure over Wire
values (a nominal interface in Java), not opaque route access.

See the repository's docs/wire/contract.md and docs/wire/carriers.md. Version 0.5.0
is a clean breaking replacement; compilation and packaged consumers check the
native surface, while bitruntime supplies independently tested implementations.

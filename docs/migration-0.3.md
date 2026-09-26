# Migrating to explicit primitives and trees in 0.3

The names and structural contract change intentionally before 1.0.
[Decision 0012](decisions/0012-explicit-data-and-wire-trees.md) is accepted;
the [language matrix](languages.md) separates source declarations, publication
and runtime adoption.

| Previous surface or proposal | Current name and meaning |
| --- | --- |
| `Wire.send(path, message)` | `AddressedWire.send(path, message)`: existing addressed carrier access. |
| Proposed `End.send(message)` | `Wire.send(message)`: addressless interaction. |
| Addressed access described as `Deixis[End]` | `WireTree = DeixisNode<Wire>`: complete finite structure with exact byte keys. |
| Bitstore's materialized `Data` tree | `DataTree = DeixisNode<Data>`; own `Data.read()` retrieves fixed bytes. Materialized byte trees and persistence machinery remain distinct. |
| Proposed `ByteSource` | `Data`: the storage primitive. |

## Existing endpoints and return capabilities

Rename existing addressed `Wire` implementations, parameters and imports to
`AddressedWire`. Keep their `send(path, message)` signature and behavior.
`Endpoint` now extends `AddressedWire`; the receiver still sees a complete
message and a string path, and owns one attachment. Keep `ReturnAddress.wire`
addressed: the existing profile's response and lifecycle operations depend on
its relative path space and identity. A primitive Wire is not a drop-in return
capability for that profile.

There is no alias preserving the old meaning under `Wire`. New compile errors
are deliberate opportunities to distinguish primitive, tree and carrier.
Do not change wire envelopes, request IDs, admission/refusal, received context
or endpoint ownership as part of this rename.

## Complete structure

Implement `WireTree` only where the implementation can supply the complete
`DeixisNode<Wire>` contract: `own`, `children`, partial `at` and `decompose`.
An arbitrary opaque router is not such a tree. It cannot gain enumeration,
finite structure or reconstruction by adding a nominal interface.

Use exact byte keys, preserve empty and non-UTF-8 keys, reject duplicate keys,
and preserve own/child identity through reconstruction. Empty path selects
self; a missing path returns no tree and must not fall back to an ancestor's
own Wire. Sharing children is valid; structural cycles are not.

For existing paths:

```text
send(tree, path, message) = select(tree, path).own().send(message)
read(tree, path)          = select(tree, path).own().read()
```

`at` is structural selection, not a deferred prefix binding that always succeeds.
A bound view of `AddressedWire` remains addressed access. Full tree parts carry
authority; access restricted to a subset of operations should be delegated
through an explicit restricted facade, not by claiming a partial enumeration is
the complete tree.

## Paths and deployment

`TreePath` contains arbitrary byte keys. The unchanged carrier's `Path` contains
Unicode-scalar strings. An adapter uses the exact UTF-8 image or documents a
new encoding/profile; it must not normalize or decode arbitrary bytes lossily.
The native API revision does not establish a binary path encoding in `bitwire/1`.

Bitwire publishes declarations and criteria. bitruntime supplies constructors,
selection, derived sending and carrier implementations. Source package checks
and historical addressed conformance are not evidence that every runtime now
provides structural trees. Consumer adoption and any registry publication must
be verified against their actual versions before they are reported complete.

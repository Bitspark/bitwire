# 0012: Data and Wire are primitives; their trees share the Deixis contract

**Status:** accepted, 2026-09-26, on the user's explicit direction to make the
names and structure symmetric, accepting the breaking rename before wider
adoption. Native declarations target **0.3.0**. Runtime adoption, behavioral
acceptance and registry publication are separate delivery steps.

This supersedes the addressed meaning of `Wire` in decisions 0001–0006 and the
incomplete structural claim in decision 0006. It also supersedes proposed
decision 0011, `Bitwire = Deixis[End]`, in
[draft PR #49](https://github.com/Bitspark/bitwire/pull/49); that draft was not
accepted or merged. Ownership under decisions 0007 and 0010 is unchanged.

## Decision

The family uses the following names and equations:

```typescript
interface Data {
  read(): Promise<Bytes>;
}

interface Wire {
  send(message: Message): void;
}

type DataTree = DeixisNode<Data>;
type WireTree = DeixisNode<Wire>;
```

Bitstore owns `Data` and `DataTree`. Bitwire owns `Wire` and `WireTree`. `Bytes`
remains the raw value representation, not a reader or a tree. `End`,
`ByteSource`, and addressed `Wire` are not the names of the new primitives.
Language-native error and asynchronous representations may differ without
changing the meaning. A successful `Data.read` yields that primitive's fixed
content. A successful `Wire.send` admits a message; it does not await an
application result.

Both trees expose the same full structural contract:

```typescript
type Key = Uint8Array;
type TreePath = readonly Key[];
type Children<T> = ReadonlyArray<readonly [Key, DeixisNode<T>]>;

interface DeixisNode<T> {
  own(): T;
  children(): Children<T>;
  at(path: TreePath): DeixisNode<T> | undefined;
  decompose(): Readonly<{ own: T; children: Children<T> }>;
}
```

This is the Deixis model `T × FiniteMap[Bytes, DeixisNode<T>]`, not merely a
path-prefix wrapper. Every node has an own value and a complete child map.
Keys are arbitrary exact bytes, including empty and non-UTF-8 keys. Trees are
finite and acyclic. Empty path selects self; an absent edge returns no node.
Construction rejects duplicate byte keys and preserves the identity of own
capabilities and retained children. Implementations prevent mutation of keys
or child maps from changing the represented structure.

Decomposition is complete. Recomposition from it preserves structure and own
capability identity; decomposition after construction recovers the same own
value and exact child map. Shared child instances may be preserved under
multiple names, but a child cannot introduce a structural cycle.

## Derived operations

For an existing path, the only dispatch rule is:

```text
read(tree, path)          = select(tree, path).own().read()
send(tree, path, message) = select(tree, path).own().send(message)

select(tree, [])          = tree
select(select(tree, a), b) = select(tree, a ++ b)   when selection succeeds
```

Missing selection is distinct from selecting a primitive that refuses. No own
value serves as fallback for a missing descendant. The implementations of tree
construction and derived sending belong in bitruntime; this repository owns
the declarations, laws and independent criteria. A data capability itself is
not serialized bytes: materialization reads it to obtain a byte-valued tree.

## Existing addressed carriers

The old `Wire.send(path, message)` is explicitly named `AddressedWire`. It is
an addressed carrier/access surface, not a `WireTree`. `Endpoint` extends
`AddressedWire`, and `ReturnAddress.wire` remains an `AddressedWire`. They
retain the existing string `Path`, admission, received-context, correlation,
receive attachment and closure contracts of `bitwire/1`.

This distinction is necessary: an arbitrary addressed router can hide children,
have routes that vary on use, or route through cycles. It does not provide a
complete finite tree. Giving it a new type name cannot manufacture structural
guarantees. Selecting and binding a prefix of such a router likewise does not
become structural `WireTree.at`.

The unchanged carrier uses Unicode-scalar string segments. A bridge from tree
keys to that carrier accepts only exact UTF-8 keys or specifies an additional
encoding/profile explicitly; it never silently normalizes, decodes arbitrary
bytes lossily, or claims byte-path support in the unchanged protocol.

A return capability's existing profile-defined relative path space includes
response and lifecycle operations. Replacing that `AddressedWire` with an
addressless `Wire` would erase those operations. Moving return delivery to a
different primitive requires its own explicit lifecycle mapping and evidence;
this rename does not make that change.

## Migration and delivery

1. Update all eight native declarations and their independent package consumers
   together. Existing addressed implementations use `AddressedWire`; new
   primitives use `Wire`, and full structures use `WireTree`.
2. Keep immutable release and historical conformance evidence labeled with the
   version it tested. Old evidence is not structural conformance evidence.
3. Migrate bitruntime's constructors, operators and carriers to the explicit
   distinction, then update its consumers against a verified dependency revision.
4. Publish only through the established release process. Source declarations,
   runtime behavior and registry availability are recorded independently in the
   [language matrix](../languages.md).

There is no compatibility alias that keeps the old addressed meaning under
`Wire`; compilation failures identify call sites that must choose the correct
capability. The spelling is intentionally changed now, before more consumers
build against the ambiguous contract.

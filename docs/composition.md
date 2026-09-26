# Composition of full trees and addressed access

The full structural contract is `WireTree = DeixisNode<Wire>`, exactly parallel
to Bitstore's `DataTree = DeixisNode<Data>`. The primitives differ only in their
operation: `Wire.send(message)` admits interaction; `Data.read()` retrieves
fixed bytes. [Decision 0012](decisions/0012-explicit-data-and-wire-trees.md)
replaces the earlier practice of calling addressed access the full structure.

## Full tree composition

Each node contains its own primitive and a complete map of byte-keyed child
trees. Keys are arbitrary exact bytes; empty and non-UTF-8 keys remain distinct.
A tree is finite and acyclic. The same child instance may be shared under more
than one name. Construction rejects duplicate byte keys and protects the
structure from mutation through caller-owned collections.

The common methods are `own`, `children`, `at` and `decompose`. Runtime
construction preserves primitive/child identities and supports both directions:

```text
decompose(compose(own, children)) ≅ { own, children }
compose(decompose(tree))         ≅ tree
select(tree, [])                 ≅ tree
select(select(tree, a), b)       ≅ select(tree, a ++ b)
```

The selection equation applies when the first selection exists. Missing paths
return no node; they do not invoke an ancestor's own primitive as fallback.
For existing paths the operation is entirely determined by structure:

```text
send(tree, path, message) = select(tree, path).own().send(message)
read(tree, path)          = select(tree, path).own().read()
```

A subtree can be inserted beneath another key without changing the primitive.
A retained primitive's state survives decomposition and reconstruction because
reconstruction preserves that capability, rather than copying its hidden state.
Complete parts also expose all the capabilities they hold. Delegate restricted
access separately if the caller must not have the complete structure.

## Addressed access and carriers

`AddressedWire.send(path, message)` preserves the former addressed interface.
It can be derived from a tree with an explicit key mapping, but an arbitrary
AddressedWire is not itself a tree. It may hide routes, dispatch dynamically or
route through cycles; none can satisfy the complete finite structural contract
by changing a type annotation.

Binding a prefix of addressed access is therefore a separate operation from
structural `at`. A prefix can be bound without knowing whether a route exists;
structural selection answers whether a node is present. Similarly, refusal to
send does not prove that a child is absent.

Existing carrier paths contain Unicode-scalar strings. Tree keys contain any
bytes. The unchanged `bitwire/1` carrier supports the exact UTF-8 image only;
an adapter must reject other keys or specify an additional encoding/profile.
No implicit normalization or lossy conversion is permitted.

`Endpoint` extends AddressedWire with one receive attachment and closure.
Selected receiving views share a dispatcher's attachment. Pure routing keeps
local return identity and received context. A physical hop has additional
profile-defined correlation, context and live-reference obligations.
`ReturnAddress.wire` remains addressed because its profile has response and
invocation-lifecycle paths. Replacing it with a primitive Wire would erase
those operations and requires a separate explicit lifecycle design.

## Ownership and evidence

Bitwire owns the declarations, laws, protocol and independent expectations.
bitruntime owns production tree construction, derived operators, carriers and
profile execution. Consumers own application meaning, interpretation identity
and authority policy. Sharing a tree interface does not translate incompatible
payloads or make an access handle proof of authorization.

The [tree reference cases](../conformance/trees/README.md) exercise the new
structural contract using test-only interpreters. The
[declared composition evidence](../conformance/declared/README.md) and
[runnable example catalogue](../examples/README.md) retain the older addressed
interpretation and its versioned runtime observations. Historical green cases
are not full WireTree runtime adoption. The [language matrix](languages.md)
records source declarations, publication and consumer adoption separately.

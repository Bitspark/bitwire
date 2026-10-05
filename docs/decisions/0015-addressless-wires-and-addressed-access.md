# Addressless wires and addressed access

**Decided, 5 October 2026**, under the owner's request to reconsider and correct
deixis, bitwire and bitruntime together. This is the implementation agent's
reasoned decision, not a retrospective claim that each detail received separate
owner approval. It supersedes decision 0014's collapsed sending surface and
mandatory generic envelope. Its RPC removal, Ontos value semantics, runtime
ownership and clean replacement policy remain.

## Reason

The September separation had a concrete purpose: transports implement one
addressless abstraction, and addressing is implemented once above it. Removing
JSON/RPC, serialized return addresses and duplicate service transports did not
require removing that layer. October's single envelope mixed carrier-independent
delivery with routing and exchange metadata. Deixis then adopted that consumer
choice as a fixed premise, although its generic tree laws did not require it.

Restore the structural distinction without restoring old protocol machinery.
An addressless send needs a ground Ontos value, not source/destination paths,
message IDs or correlation fields. Consumers can carry any of those in their
message convention. Choosing raw Value also permits a plain atom as a complete
message; an otherwise useful envelope is not universal vocabulary.

## Contract

```ts
interface Wire { send(message: Value): Promise<void> }
interface Endpoint extends Wire {
  receive(handler: (message: Value) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
interface AddressedWire { send(path: Path, message: Value): Promise<void> }
interface AddressedEndpoint extends AddressedWire {
  receive(handler: (path: Path, message: Value) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
type WireTree = DeixisNode<Wire>;
```

Wire is the send capability; Endpoint includes receive and close ownership.
AddressedWire adds exact byte-path selection. AddressedEndpoint presents that
layer over an owned endpoint, without acquiring a second transport or creating
another connection lifetime. WireTree supplies complete structure; addressed
access alone supplies no enumeration or proof of remote membership.

The [contract](../wire/contract.md) defines outcomes and resource ownership; the
[carrier specification](../wire/carriers.md) defines one addressless format and
one optional addressed message representation. A path argument must be captured
before admission. Prefix scopes compose by concatenation. For a complete tree,
addressed sending selects the node and invokes its own Wire exactly once. No
ancestor fallback, implicit mount or string-path intermediate is permitted.

## Owners and migration

- deixis owns the pure mandatory-value tree and structural laws. Its ADR 0014
  treats sender and receiver trees as equally valid instances.
- bitwire owns these declarations, message formats and independent observations.
- bitruntime owns endpoints, carriers, the reusable addressed layer, prefix
  binding and derived sending over complete trees.
- system2 owns service IDs, correlation, reply paths and invocation outcomes.

The clean replacement updates all eight presentations and both runtime languages.
There is no decoder fallback, compatibility alias, JSON intermediate, or implicit
conversion of strings into paths. Existing immutable releases retain their
historical meaning. A live Wire remains a capability, never a ground value;
multiplexing or conveying wires needs a separately defined allocation and
lifetime protocol and is not implemented by this correction.

## Required observations

Before implementation, require: a bare atom traverses a raw endpoint; repeated
identical values are distinct admissions; arbitrary nested ground values survive;
empty path differs from empty-key child; binary keys and segment boundaries
survive; prefix cuts select identically; structural operations invoke nothing;
reconstruction retains own capabilities; missing local paths invoke nothing;
existing sender refusal stays distinct; raw and addressed endpoints retain
detach, ordering, close and bound laws; and the same addressed implementation
works over a local pair and WebSocket. A malformed addressed message fails that
layer; the raw endpoint treats the same ground value as ordinary data.

Tests and source-name checks cannot replace these laws. Future changes must name
the boundary they alter, justify why the current contract is insufficient and
record affected consumers, independent evidence and migration before code.

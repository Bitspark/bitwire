# Addressless wires and addressed access

**Decided, 5 October 2026**, under the owner's request to reconsider and correct
deixis, bitwire and bitruntime together. This is the implementation agent's
reasoned decision, not a retrospective claim that each detail received separate
owner approval. The preceding description of the owner's request is a paraphrase.
It supersedes decision 0014's collapsed sending surface and
mandatory generic envelope. Its RPC removal, ontos value semantics, runtime
ownership and clean replacement policy remain.

## Reason

The owner wrote in the implementation chat on 4 October 2026 at 00:15:09 UTC:

> I would prefer there to be a clean cut. no historic profiles, no legacy baggage. also, no adapters if they are not required for good reasons if we could as well consolidate to one interface

Source: Codex chat `01a0fdbc-035d-7cc3-b13f-6fc51b41b394`, archived user message,
line 2581. The qualification about good reasons is part of that request.
[Decision 0014](0014-generic-envelope-wire.md) instead recorded its reason as:

> The owner requested a clean replacement without historical profiles, compatibility exports or redundant wire adapters.

That condensation omitted the qualification. In the current reconsideration chat
`01a10739-ce26-73c0-b27c-13b9146811a8`, the owner then wrote:

> And also on bitwire / bitruntime of course. Let's use this opportunity to redo it right, in both deixis and bitwire/bitruntime.

These are verbatim user words, distinct from the agent's design conclusion below.

The September separation had a concrete purpose: transports implement one
addressless abstraction, and addressing is implemented once above it. Removing
JSON/RPC, serialized return addresses and duplicate service transports did not
require removing that layer. October's single envelope mixed carrier-independent
delivery with routing and exchange metadata. deixis then adopted that consumer
choice as a fixed premise, although its generic tree laws did not require it.

This decision satisfies the clean-cut request with one addressless carrier
interface and one derived addressed layer connecting different abstractions;
it introduces no competing generic wire translation, RPC mandate or compatibility
decoder.

Restore the structural distinction without restoring old protocol machinery.
An addressless send needs a ground ontos value, not source/destination paths,
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

- deixis owns the pure mandatory-value tree and structural laws. The landed
  [charter at 7a8cb0b](https://github.com/Bitspark/deixis/blob/7a8cb0b6d487772f9b61e208ed6b2ecebab7ba77/CHARTER.md)
  states selection before invocation and permits both sender and receiver values.
  Its repository agents are consolidating that record with
  [the ADR 0013 correction](https://github.com/Bitspark/deixis/pull/18) and
  [the identity draft, ID9-ID12](https://github.com/Bitspark/deixis/pull/20).
  Those pending records are not represented here as already adopted or as
  permission to silently change the floor.
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

## Exchange and receive scope

system2 owns its current exchange convention, not every future exchange design.
A reusable exchange profile above AddressedWire is deferred until a second
consumer needs the same semantics, or a consumer requires cancellation or
streaming that warrants a shared contract. That work must define captured reply
routes, lifecycle substructure, correlation bounds, authority and cancellation
after rerouting. The old profiles supply questions and evidence, not code to keep
or an automatically reinstated protocol.

The current addressed facade has one stable local path root per endpoint for the
connection's lifetime. receive delivers the full path sent by the peer, relative
to that receiving root. under and bind grant sending only: they do not create a
prefixed receiver, strip incoming segments, rebase opaque source fields or grant
another receive owner. A consumer using reply paths must name them relative to
that stable connection root. system2/service/2 does so. A symmetric scoped receive
or mount-crossing exchange would need an explicit higher-level mapping; it is
not implied by under.

deixis-fable's [peer read on PR 76](https://github.com/Bitspark/bitwire/pull/76)
approved the layering direction with provenance and scope corrections. The
discussion on [PR 76](https://github.com/Bitspark/bitwire/pull/76) carries the actual
review and responses; no claim of an independent runtime review follows from it.

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

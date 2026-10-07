# Pure hydrated protocol codec

**Implementation work package, 7 October 2026.** This specifies the implementation
slice after the [hydrated adapter composition proposal](hydrated.md#composing-domain-adapters).
It implements [decision 0019](../decisions/0019-hydrated-wire-protocol.md), with
counting rules reviewed at `603f49583756702c32dad04759710ca629452859`. The owning
review accepted this API before implementation. Integration and the first public
hydrated release still require the owning repository's checks and release gate.

## Responsibility

The codec constructs and validates the ground representation of a body,
reference or frame. A runtime supplies reference descriptors in place of live
Wires and turns decoded descriptors into proxies afterwards. The codec never
registers a target, generates a secret, admits a send, selects a route, owns an
endpoint, imports bitruntime or invokes a user-provided callback.

This removes duplicate protocol grammar from runtime realizations while leaving
allocation, atomic staging, admission, reference recognition and ownership there.
An accepted codec result is data. It does not certify that a reference is live,
that its holder is authenticated or that a frame will be admitted remotely.

## Structural input and output

Use an immutable structural domain, separate from live hydrated values:

```text
HydratedData = DataAtom(Atom)
             | DataTuple(HydratedData*)
             | DataReference(HydratedReference)

HydratedReference = (Path, scope: Atom, id: Atom)
HydratedFrame     = (scope: Atom, id: Atom, body: HydratedData)
HydratedCodecLimits = (nodes, depth, bytes)
```

An Atom retains its existing ontos bytes. Tuple construction captures children
and preserves order and multiplicity. A reference captures its path; scope and
id are each exactly 16 octets. A descriptor is explicitly constructed as a
reference, so ordinary data with reference-shaped contents remains data.

Constructors/accessors are native to each language but expose the same cases.
They preserve finite acyclic structure without exposing mutable path or child
storage. Helpers convert ground ontos values into DataAtom/DataTuple and recover
ground values from a subtree containing no reference. This is an additional
codec data type, not an extension of ontos's ground Value or a live Wire type.
Ground conversion helpers take explicit codec limits as well; this prevents a
compact shared input tree from expanding without bounds during conversion.

## Proposed pure operations

Names use the repository's existing pack/unpack convention, because these
operations produce and consume ground values, not encoded byte arrays:

| Operation | Meaning |
| --- | --- |
| packHydratedBody / PackHydratedBody | Structural data to its tagged ground body, validating all nodes and limits. |
| unpackHydratedBody / UnpackHydratedBody | A ground body to structural data, rejecting any malformed node. |
| packHydratedFrame / PackHydratedFrame | Target scope/id and structural body to the complete ground frame. |
| unpackHydratedFrame / UnpackHydratedFrame | Validate a whole frame and return its target and structural body. |
| packHydratedReference / PackHydratedReference | A validated descriptor to the ground reference payload `(path, scope, id)`. |
| unpackHydratedReference / UnpackHydratedReference | Validate and capture a reference payload. |

The existing raw codec supplies ontos-codec-v1 bytes, and `packAddressed` supplies
the independent addressed representation. No new byte decoder, carrier format,
RPC envelope, compatibility reader or version fallback is introduced.

Each operation validates its complete result before returning it. Failure yields
no partial tree or callback effects. Public errors distinguish malformed shape
from a configured bound; invalid limit options are caller errors. The codec
cannot report runtime failures such as stale scope, unknown export or target
refusal because it has no knowledge of those states.

## One counting domain

Follow D8 in both directions. Each data atom, data tuple and reference leaf is
one node. The root is at tuple depth zero; each tuple edge increases depth by
one. Reference path segments are metadata, not extra value nodes or tuple depth.
Value bytes are atom payload bytes plus reference path bytes and 32 octets per
reference occurrence. Aliased/repeated occurrences count separately.
Path segment count has no separate limit and is not constrained by the tuple
depth bound; path size is limited through bytes, including encoded overhead.

The same byte bound also limits the complete encoded ground frame, including
header and tags. A standalone body operation applies it to the encoded body.
Both the value-byte and encoded-body checks apply to standalone bodies; the
encoded check implies the value-byte check, but both use the same definition.
Frame operations additionally account for the frame overhead. This difference
is explicit because a body alone has no target/header. Reference helpers apply
it to their encoded payload. Every supplied bound is a finite positive integer.
An operation checks bounds before potentially large output allocation, and uses
checked arithmetic. A rejected encode must not leave a partially constructed
protocol value for the runtime to send.

Bounds are inclusive: node count must be `<= nodes`, every node's depth
`<= depth`, value bytes `<= bytes`, and the relevant encoded body, reference
payload or frame bytes `<= bytes`. A value exactly at a bound is accepted if all
its other requirements hold; exceeding any one bound is refused.

## Acceptance before implementation

The Go surface uses value structs with private storage: `NewHydratedDataAtom`,
`NewHydratedDataTuple` and `NewHydratedReference`. Tuple and reference constructors
return `(value, error)`; arrays returned by `Items` and `Path` are copies. Codecs
accept the concrete values, rejecting pointer aliases, nils and foreign embedded
implementations of `HydratedData`. Reassigning a caller's variable cannot mutate
an already captured value. Errors use `ErrHydratedMalformed`, `ErrHydratedLimit`
and `ErrHydratedOptions`.

TypeScript exports the same three constructors as classes. Nodes and their child
and path arrays are frozen, and construction rejects foreign objects, cycles and
subclass hooks. Codec shape/bound failures are `HydratedCodecError` with kind
`malformed` or `limit`; invalid limit options throw `RangeError`. Ground embedding
and extraction are `hydratedDataFromGround` / `hydratedDataToGround` in TypeScript
and `HydratedDataFromGround` / `HydratedDataToGround` in Go. They apply the same
semantic and encoded-body bounds, and extraction refuses a reference leaf.

For example, after a runtime has supplied the reference descriptor:

```typescript
const limits = { nodes: 1000, depth: 64, bytes: 65536 };
const body = new HydratedDataTuple([
  new HydratedDataAtom(atom([42])),
  new HydratedReference(path, scope, id),
]);
const groundFrame = packHydratedFrame({ scope, id, body }, limits);
const decoded = unpackHydratedFrame(groundFrame, limits);
// decoded.body contains data descriptors; no endpoint was exported or imported.
```

## Conformance observations

The independent [0019 vectors](../../conformance/hydrated-vectors.json) predate
this implementation and remain unchanged by this package. Replay every accepted
body and addressed frame against their hand-derived bytes, and every rejected
body/frame against the public decoder. Do not derive expected bytes from a new
encoder or replace the test-local readers merely to make the tests agree.

Additional boundary observations, specified here before code, are:

1. Encode/decode agree with those independent bytes in Go and TypeScript.
2. Ground subtrees round-trip; tag-looking data cannot become a reference.
3. Caller mutation of path/child arrays after construction changes no value.
4. Tight node, depth and byte limits agree in both directions, including tuple
   overhead, empty atoms and repeated references. Compare exact boundary and
   one-over cases with independently calculated sizes. A five-segment reference
   path at value depth zero is accepted under depth two if its bytes fit.
5. A malformed child rejects the complete frame; there is no partial decoded
   tree. The implementation invokes no runtime or caller callback.
6. Invalid options, invalid scope/id lengths, unknown tags, excessive depth,
   cycles or foreign structural objects cannot bypass validation or exhaust the
   host stack before the configured bound is reported.
7. Fresh packed consumers can import and exercise the new functions using public
   dependencies; existing raw/addressed observations remain unchanged.

Go and TypeScript are the initial executable-codec targets, matching the existing
raw/addressed codec implementation scope. The repository's eight-presentation
alignment remains a production adoption requirement: this slice must not be
reported as completing the live HydratedWire/Endpoint declarations in all eight
languages. The owning review must state the staging and remaining native work;
no declaration-only check is presented as runtime conformance.

## Delivery and migration

Only after the record, public API and exact implementation revision are reviewed
and integrated can bitruntime replace its private grammar traversal with these
functions. Runtime staging and proxy construction must continue to satisfy the
independent allocation, authority, lifecycle and admission observations. The same
consumer composition suite must pass after that replacement, including both
carriers, nested cells and bounded reply lifetimes.

bitnode then consumes the qualified runtime through published, pinned foundations
and supplies its own admitted topology and received context. A sibling checkout
or copied codec is not evidence of that delivery. The wider implementation remains
open until those owning repository gates and integrations are verified.

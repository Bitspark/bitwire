# 0011: Bitwire is Deixis over Ends

**Status:** **proposed**, 2026-09-26, for [#42](https://github.com/Bitspark/bitwire/issues/42).
It is not accepted until three things have happened:

- it is reviewed with [deixis#49](https://github.com/Bitspark/deixis/issues/49),
  [bitstore-svc#13](https://github.com/Bitspark/bitstore-svc/issues/13) and
  [deixis-svc#1](https://github.com/Bitspark/deixis-svc/issues/1);
- bitruntime has run experiments against it;
- the maintainer has taken the decisions listed under [Open decisions](#open-decisions).

The naming is already decided (the maintainer, 2026-09-26):

- **`Bitwire = Deixis[End]`**, structured interaction. It is the counterpart of
  **`Bitdata = Deixis[Bytes]`**, structured data.
- **`End`** is the addressless primitive.
- **`bitwire.Wire`** stays the addressed interface, and keeps its name in all eight
  languages.

## Question

Bitwire's primitive today is addressed: `Wire.Send(path, message)`. The
maintainer's direction on 2026-09-25 separates two things:

- an addressless primitive (A0);
- addressed access built from that primitive by Deixis's tree structure (A1).

Deixis already describes the same split in its interaction doctrine
([`docs/WIRES.md`](https://github.com/Bitspark/deixis/blob/main/docs/WIRES.md)):

- a *wire* is a conduit;
- an *end* is what a party holds, with the surface `{send}`;
- names in a tree are bound to ends;
- the routing law `connect(a) / p ≈ connect(a ++ p)` joins the two.

What exactly is the primitive, what does addressed access become, and where does
everything between them live?

## Proposal

### Three layers, not two

| Layer | What it is | What lives there |
| --- | --- | --- |
| **Transport** | Moves whole frames between two places, with the properties it declares | The transports and carriers of [decision 0009](0009-carriers-bitwire-provides-and-byte-stream-framing.md), framing, close codes, backpressure. A relay that passes frames without interpreting them, such as bitwire-svc's, lives here. |
| **End** (A0) | Addressless sending access at one origin | `End.Send(message)` returns admission or refusal. There is no path. |
| **Wire** (A1) = Deixis[End] | Addressed access: an End at every node, plus keyed children | Selection, mounting, forwarding, declared composition ([0006](0006-declared-composites-realize-deixis-nodes.md)), refusal of missing paths |

The **protocol** (`bitwire/1`, [decision 0008](0008-a-protocol-revision-has-its-own-identity.md))
is not a fourth box stacked on top. It sits where transport meets addressing:

- it is the vocabulary of the messages Ends carry: requests, responses, events
  and cancels, with ids, correlation, return capabilities and the invocation
  lifecycle of [decision 0003](0003-public-invocation-lifecycle.md);
- when addressed traffic crosses a process boundary, the protocol engine writes
  the path into the frame (today the `method` field). That is addressing
  serialized for the crossing, read by the receiving side's engine and never by a
  relay.

### End

```go
// End is addressless send access at one origin. Send returns when the message is
// accepted or refused, never when it has been handled. It grants neither
// receiving nor closing.
type End interface {
	Send(message Message) error
}
```

```typescript
export interface End {
  send(message: Message): void; // throws a refusal
}
```

`Message` is today's local delivery object: a profile frame plus local
capabilities (the return capability and received-context evidence). The
alternative, raw bytes, cannot carry a return capability, and a relay that moves
bytes already exists one layer down, as a transport. The version boundary: a
second profile would need either a second message type or a generic
`End[M]`; see [Open decisions](#open-decisions).

### Wire: addressed access as Deixis over Ends

`bitwire.Wire` keeps its method, and gains two laws that define it as Deixis over
Ends for *every* Wire, opaque ones included:

```text
origin(w)            = the End that sends w's messages at []:  origin(w).send(x) = w.send([], x)
w.send(p, x)         ≃ origin(at(w, p)).send(x)                    (addressed send is derived)
at(at(w, a), b)      ≃ at(w, a ++ b)        at(w, []) ≃ w          (unchanged)
```

- `origin` is derived from `Send`, so it keeps every guard and attenuation of the
  view it came from. It is not an accessor that exposes an assembler's raw End.
- `Origin` and `At` are operators in bitruntime, not new methods on `Wire`.
  Today's implementations stay valid Wires without change.

### Declared composites: the finite realization

Decision 0006 already says a composite's own value is "the behavior for a
message sent at `[]`, which never sees a path". This decision gives that value its
type:

```text
compose : End × FinMap[Segment, Wire] → Wire           (was: origin typed as Wire)
send(compose(o, m), [],    x) = o.send(x)
send(compose(o, m), k : p, x) = send(m[k], p, x)   when k ∈ dom m, else refused
```

- **Exact leaves by construction.** An End cannot receive a path, so
  `compose(o, {})` refuses every nonempty suffix. Research 0001's question of
  prefix views versus exact leaves disappears for declared composites.
- **Children stay Wires, and may be opaque.** A remote peer's Wire, or a
  dispatcher whose routes are discovered on use, is a legitimate child. It is a
  *mount of a bound connect* in WIRES.md's terms. The structure claims exactly
  what is declared and no more: an opaque child is not an enumerable tree.
- **Everything else in 0006 stands:**
  - keys are the exact UTF-8 encoding of a segment;
  - a missing child refuses, and the origin is never a fallback;
  - the assembler retains the parts, and send access grants no decomposition.

  Only the origin's type narrows, from `Wire` to `End`. An existing origin `o`
  becomes `origin(o)`.
- **Wire paths can't spell every Deixis key.** Paths are Unicode strings and
  Deixis keys are bytes, so keys outside the UTF-8 image are unreachable through a
  Wire path. That is an explicit restriction of the mapping, not a normalization
  of keys, as deixis#49 requires.

### Return capabilities

A return capability keeps its current type, `ReturnAddress{Wire}`, and this
decision gives it a structural reading.
[Decision 0004](0004-return-origins-and-profile-revisions.md) gave the return
origin the outcome at `[]` and lifecycle participation at `invocation.*` paths.
That is itself a small declared tree:

- its origin End receives the outcome;
- its children receive the lifecycle messages.

The alternative is an End-typed reply plus separate control Ends. It is listed as
an open decision, because it changes the lifecycle wiring of decision 0003.

### Receiving and ownership

`Endpoint` (`Receive`, `Close`) is unchanged in this revision. A carrier's far
side delivers addressed traffic to one receiver; a dispatcher or a declared
composite interprets the paths after delivery. Receiving at the End level (a
handler bound as a node's own value, WIRES.md §4) is deferred to a later revision.
The reason: it changes how carriers deliver and how the dispatcher captures
routes, and those are exactly the parts bitruntime must port first for
bitsystem3.

A parent retains its named children's Wire capabilities. It does not own their
endpoint lifetime, and it cannot inspect an opaque child.

## Version transition

| Artifact | Change |
| --- | --- |
| Bitwire contract, next minor release (0.3.0) | Adds the `End` type in all eight languages. `Wire`, `Endpoint`, `Message`, `ReturnAddress` and `Receiver` are unchanged. It adds the two laws above and retypes the declared-composite origin. The planned received-context evidence field on `Message` lands in the same release. |
| `bitwire/1` protocol | Unchanged, byte for byte. Paths keep travelling in `method`. |
| Conformance | The 39 declared cases keep their observations, with origins typed as Ends. New cases: the derived-send law for opaque Wires; `origin` preserving guards; exact leaves; opaque children; keys outside the UTF-8 image. |
| Consumers | Source-compatible for everything that sends through `Wire`. Only code that builds composites with a Wire-typed origin changes, and it wraps that origin with `origin(...)`. |

## Deixis dependency

Bitwire's published declarations take **no package dependency** on Deixis. The
relationship is a documented correspondence, as in decision 0006, and the
conformance cases hold it.

bitruntime *may* use a Deixis core library for its composites. But Deixis is
currently **private**, and a public repository cannot depend on a private module
without breaking public installs. Until Deixis is public, bitruntime implements
the construction directly and checks it against the same cases.

## Acceptance

- `End` is declared in all eight languages; `Wire` is unchanged.
- The contract states the two laws and the retyped composite. The draft carrier
  specification names the transport layer below `End`.
- Independent cases cover the new laws, run against bitruntime's first candidate
  over the in-process pair and WebSocket.
- A byte-for-byte interoperability run against a Nightseam v0.6.0 peer shows
  that `bitwire/1` is unchanged.
- deixis#49 and bitstore-svc#13 record that `Deixis[End]` and `Deixis[Bytes]` use
  the same structural contract: keys, own values, selection, reconstruction and
  missing-path behavior.

## Open decisions

For the maintainer:

1. **End's message type.** Recommended: the profile-typed `Message` above.
   Alternative: a generic `End[M]`, which opens the primitive to other profiles
   (streams, other codecs) at the cost of generics in all eight languages.
2. **Return capabilities.** Recommended: keep `ReturnAddress{Wire}`, read as a
   small declared tree. Alternative: an End-typed reply plus control Ends, which
   rewires decision 0003's lifecycle.
3. **Receiving at the End level.** Recommended: defer to the revision after
   bitsystem3's migration. Alternative: redesign `Endpoint` now.
4. **Making Deixis public**, so that bitruntime can share its core instead of
   re-implementing the construction.
5. **Research 0001's decisions 4, 5 and 6**, which the carrier contract below `End`
   needs: whether a synchronous refusal proves that nothing was published, when a
   message becomes immutable, and graceful shutdown.

## Not decided here

- Package coordinates in bitruntime.
- Bitdata's encoding and content identity (deixis#49, bitstore-svc#13).
- The generic Deixis service's binding and discovery profile (deixis-svc#1).

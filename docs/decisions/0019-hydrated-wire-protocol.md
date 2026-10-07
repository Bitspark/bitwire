# 0019: hydrated wire protocol, first edition

**Status:** accepted, 7 October 2026, by Wire & Runtime (`codex-communications`),
bitwire's owner, at `603f495`
([review](https://github.com/Bitspark/bitwire/pull/83#issuecomment-6041135674)).
It is a protocol decision. The shared pure codec, the native declarations in all
eight presentations, the bitruntime realization and a release remain to be
delivered and qualified. Tracking issue
[#82](https://github.com/Bitspark/bitwire/issues/82). This record settles the
[protocol decisions](../wire/hydrated.md#protocol-decisions) that the
[hydrated wire proposal](../wire/hydrated.md) leaves open, for a first edition,
`bitwire/hydrated/1`. Its cases are in
[hydrated-vectors.json](../../conformance/hydrated-vectors.json). It amends no
released contract: adoption still needs the contract extension, native
declarations and a bitruntime realization, judged by these cases.

## The case

A domain adapter sends a request carrying a reply Wire. The provider replies
through it, and the reply carries a continuation Wire back. Neither adapter
allocates references, keeps tables or knows the route. Between them, a routed
tree forwards ground values it never decodes.

Wire & Runtime's experiment shows this construction working end to end
([bitruntime#40](https://github.com/Bitspark/bitruntime/pull/40), delivered at
`4ead83f1e49c9937c6b93761c936b73072d13cdd`). The experiment also shows where it
stops. With its own adapters and default limits, one long-lived caller completes
63 calls, and the 64th is refused `export limit`, because nothing can end a
finished reply. Its grammar was disposable by design. This record turns the
construction into rules, and answers the lifetime gap from an existing concept.

## Terms

- A **namespace** is a set of participants, each at a distinct absolute path of
  exact byte atoms, that reach each other by addressed sends through the
  composition beneath them. A routed tree is one; two runtimes on a direct
  connection, each given a path, are another.
- A participant's **hydration scope** is its hydration state for one
  incarnation: a fresh random 16-octet **scope token**, its live exports and its
  bounds. A participant gets a new scope whenever it is newly placed (attached,
  rebound or restarted).
- An **export** registers a local target under the scope with an **export id**:
  16 octets that no holder of another reference can predict, never reused within
  the scope (D3).
- A **reference** is the ground form of a live Wire: owner path, scope token and
  id.
- A **proxy** is the live Wire a holder gets from a reference. Sending through it
  sends a frame to the owner.

## Decisions

### D1. Runtime values

The value domain is the proposal's: an Atom, a hydrated tuple of hydrated
values, or a hydrated Wire leaf. A hydrated tuple captures its items at
construction and is immutable, so a value is finite and acyclic. A Wire leaf is
recognized by the runtime's own brand, never by its shape: an object with a
`send` method is not a hydrated Wire, and a ground-only Wire is not one either.
A hydrated tuple with no Wire anywhere beneath it is the ground tuple with the
same items. A receiver cannot tell how a ground value was constructed.

### D2. Frame grammar

A proxy's send becomes one addressed send to the owner path, whose message is a
**frame**:

```text
frame = ( "bitwire/hydrated/1", scope, id, body )

body(atom a)              = a
body(tuple of c1 ... cn)  = ( 0x01, ( body(c1), ..., body(cn) ) )
body(wire w)              = ( 0x02, ( (owner path segments...), scope, id ) )
```

- The header is the 18-octet ASCII atom `bitwire/hydrated/1`. `scope` and `id`
  are the target's scope token and export id, 16 octets each.
- Tags are one-octet atoms: `01` for a tuple and `02` for a Wire. `00` and every
  other value are reserved.
- Atoms are written bare. Every tuple and every Wire is a 2-tuple whose first
  item is its tag.
- **Reading a body:** an atom is an atom. A 2-tuple whose first item is a
  one-octet atom `01` or `02` is read by that tag. Anything else is malformed,
  and one malformed node makes the whole frame malformed.
- **Data stays data.** A data tuple that looks like an encoded Wire is written
  as a tagged tuple, so it is read back as data. A bare atom equal to a tag is
  an atom. No scanning or heuristic ever turns data into a capability.
- **Canonical form.** The body is a function of the value, and its bytes are
  ontos-codec-v1. Decoding and re-encoding reproduces the bytes.
- Size counts toward the carrying layer's message limit.

The frame is an ordinary ground value. It needs no ontos extension, no carrier
change and no new addressed format.

### D3. Scope and authority

- **A reference is valid throughout its namespace.** Any holder, through any
  route, sends to the owner path. Forwarding a reference copies it, and transit
  participants keep no reference state. The proposal's paragraph saying that
  copying an A-to-B reference into a B-to-C scope is insufficient holds for
  connection-scoped references. Within one namespace, the experiment is its
  counterexample.
- **Possession of one reference is the authority to send to that one Wire, and
  to no other.** A reference is a bearer capability within its namespace, so
  each one carries its own unpredictability, in its export id:
  - An export id is 16 octets drawn from a cryptographically secure random
    source. A counter, a timestamp or any value derivable from another reference
    is not an export id: holding one reference would then grant its siblings.
  - The exporter redraws an id equal to any live id in the scope. A withdrawn id
    recurs with probability 2^-128 per draw, which this edition treats as never
    reused. A realization that wants the guarantee by construction may instead
    use a keyed pseudorandom permutation of a counter, with a per-scope secret
    key; holders cannot tell the two apart.
  - The scope token, also 16 random octets, identifies the incarnation (D7). It
    is shared by every export of the scope and grants nothing by itself.
  - References are confidential wherever frames, payloads, diagnostics or logs
    travel. Holding one authenticates no one (D4).
- **Gateways.** A reference names an owner in one namespace. Carrying a Wire into
  another namespace needs an explicit gateway, which this edition does not
  define. The connection-scoped forwarding of the closed #80 is one candidate
  shape for it, not a selected one.

### D4. Addressed binding and received context

- **Outgoing.** A proxy sends `frame` to the owner path through the participant's
  addressed sender. Routing below that sender is the composition's.
- **Incoming.** The participant's dispatcher owns its receive slot. It hands
  hydration each value addressed to the participant's own path, together with
  the **received context**: what the composition establishes about the arrival,
  for example a routing layer's checked origin or a direct connection's
  attachment.
- **Delivery.** Hydration delivers the decoded value to the target's receive
  together with that context. A send through a local face that never leaves the
  process carries the composition's local context instead. The context is never part of the value, and no
  value a caller supplies can alter it. The proposal's `HydratedEndpoint.receive`
  handler gains this second argument.
- No return coordinates are needed. A reference carries its owner's absolute
  path.

### D5. Allocation and admission

- **Encoding is atomic.** A send encodes the whole value before anything is
  registered. A failure anywhere (a bound, an unexportable Wire or an ended
  scope) refuses the send before admission and registers nothing.
- **Registration precedes admission.** New exports are registered before the
  frame is handed to the addressed sender, so a fast reply finds them.
- **Encoding and registration are one step per scope.** Concurrent sends that
  carry the same new face agree on its single export id, and every frame names
  the id that was registered. Concurrent sends that carry distinct new faces
  never take the scope past its export bound: each one either registers within
  the bound or is refused `limit` before admission.
- **Refused or failed admission withdraws nothing, and leaves no orphan.** A
  sending face has one export per scope, reused by every send that carries it
  (D7). So a refused attempt never adds an entry the endpoint would not have
  anyway, and that entry ends when the endpoint closes. This meets the
  proposal's requirement that a refused attempt leave no orphaned exports,
  without any rollback. Rolling back would need rules for a concurrent send that
  carries the same Wire. The experiment also retains such exports, but without
  an owner to end them.
- **Decoding is atomic.** A frame that is malformed anywhere is refused whole:
  nothing is imported and nothing is delivered.

### D6. Forwarding

- Encoding a proxy writes its reference unchanged. It never exports a proxy of a
  proxy.
- Recognition is runtime-wide within the namespace. A proxy one local participant
  imported, encoded by another local participant in the same namespace, also
  writes the original reference. A reference's validity is its owner's, not the
  importing participant's.
- A proxy from another namespace is refused at encoding, as
  `foreign-namespace`. Wrapping it implicitly would be a gateway (D3).

### D7. Aliasing and release

This answers the experiment's 64-call limit from W4's existing split: a send
capability on one side, and an Endpoint that owns receiving and lifetime on the
other.

- **Exportable Wires.** A hydrated value may carry:
  - the **sending face** of a local HydratedEndpoint, which has one export per
    scope that lives exactly as long as that endpoint; or
  - a proxy (D6).

  Passing the endpoint itself conveys only its sending face, on every path,
  local or remote: a value captures an endpoint as its face, and a local send
  delivers the face. The runtime keeps the link from the face to its endpoint
  privately, so the receiver gets no
  receive, `closed` or close. Any other hydrated Wire, and the face of an
  endpoint that has already closed, is refused at encoding as `unexportable`. An arbitrary send-only Wire reveals no lifetime, so it cannot
  be given one silently.
- **The owner ends an export by closing its endpoint.** When a HydratedEndpoint
  closes or terminates, its export is withdrawn. A frame that arrives later is
  refused at the owner as `unknown-export`. The sender's send has already
  resolved on local admission, so it learns of the refusal only through the
  domain.
- **Carrier shutdown is not the target's lifetime.** A participant's scope ends
  when its placement ends: its references go stale, and frames carrying them are
  refused `stale-scope`. A scope's end closes no domain endpoint. An endpoint
  shared by several scopes or connections is closed only by its owner.
- **Holders keep no table.** Occurrences of one reference within one decoded
  value share one proxy, so they alias. Across messages, the same reference
  yields proxies that behave the same, with no promised object identity.
  Dropping a proxy needs no message.
- **No distributed release in this edition.** Holders cannot revoke each other,
  and the owner cannot learn that every holder is gone. A service decides by its
  own protocol when to close what it owns: after one reply, on unsubscribe, or
  on a deadline.
- **Returning home.** Decoding a reference whose owner is this participant, in
  its current scope, yields the original sending face. A reference to a stale
  scope or a withdrawn id, whether this participant's or another's, still
  decodes, to a Wire whose sends are refused. Liveness is judged when sending,
  never when decoding, so one closed reply Wire cannot make a whole message
  undeliverable.

### D8. Ordering and limits

- **Ordering.** Frames from one sender that travel one lower link reach the
  target's receive in their admission order. Hydration adds no reordering, and
  delivery follows the Endpoint laws: non-inline dispatch, one receiver, ordered
  admissions. A detach removes only the receiver it was returned for. A
  receiver's failure terminates its endpoint, which ends its export. No order is promised across different senders, links or proxies.
- **Limits.** A scope has finite, configured bounds on live exports, and on each
  value's nodes, depth and bytes, and on a frame's encoded bytes. Sender and
  receiver count a value the same way, so one bound means one thing in both
  directions: each atom, tuple and Wire leaf is one node at its tuple depth, and
  a value's bytes are its atom bytes plus each Wire leaf's reference material
  (its path bytes and 32). The whole frame, header and tags included, counts
  against the byte bound on both sides. A sender that exceeds a bound is refused
  before admission; an incoming frame that exceeds one is refused at the owner
  before any delivery. A target that does not admit a delivery, for example because its
  receive queue is full, is refused `target-refused`.
- **Refusals are host diagnostics, never outcomes.** At the owner:
  `malformed-frame`, `stale-scope`, `unknown-export`, `limit`, `target-refused`.
  At the sender, before admission: `unexportable`, `foreign-namespace`, `limit`,
  `scope-ended`.

## Encoding measurements

Encoded sizes of representative messages, in octets (ontos-codec-v1, 16-octet scopes):

| Message | Every node tagged (experiment) | Atoms bare (D2) | Plain data |
| --- | --- | --- | --- |
| echo request (op, arg, reply Wire) | 70 | 60 | — |
| reply carrying two Wires | 112 | 107 | — |
| ten small fields, no Wire | 147 | 97 | 92 |
| 1 KiB atom plus a reply Wire | 1089 | 1079 | — |

Leaving atoms bare costs a data-heavy small message about 5% over plain data,
where tagging every node costs about 60%. The two forms are equally unambiguous.

## Alternatives

- **Tag every node** (the experiment). It is equally unambiguous but about ten
  times the framing on small data messages, with nothing gained.
- **Ground data plus a side table of reference positions.** It would add no
  framing to data, but needs rules for positions, overlaps, placeholders and
  canonical order, each a further malformed case. It also cannot be checked in
  one pass.
- **Connection-scoped references with re-export at each hop** (#80, closed). This
  makes every transit participant stateful and couples a reference's lifetime to
  every link it crossed. It remains the gateway shape between namespaces.
- **Exporting any Wire, retained until the scope ends** (the experiment). The
  experiment's own observation stops it at call 64, and a domain adapter cannot
  repair that without touching tables.
- **Distributed release by reference counting across holders.** Holders cannot
  safely revoke each other, and a lost holder never reports. It is deferred:
  owner closure bounds state without it.
- **Refusing a whole frame for a stale reference inside it** (the experiment
  does this for references to its own participant). This makes one closed reply
  Wire poison unrelated content. It is replaced by judging liveness when
  sending.
- **Counter or derived export ids** (the first draft of this record, and the
  experiment). Rejected in review: the scope token is shared by every export,
  so a holder of one reference could construct its siblings' references.
- **Rolling back an attempt's exports when admission is refused.** It is sound in
  principle, but needs concurrency rules for a Wire reused by a concurrent send.
  It is unnecessary once every export is owner-bounded.

## Charter

| Invariant | Effect |
| --- | --- |
| W1 Addressless sending | A frame is an ordinary ground value. Ground Wire, Endpoint and the raw format are unchanged. |
| W2 Addressed access | A frame travels to the owner path through the released addressed layer. Hydration never reads a path inside application data. |
| W3 Complete structure | A proxy supplies no structure or discovery. WireNode is unchanged. |
| W4 Ownership | A conveyed Wire is a sending face. Export lifetime comes from the owning endpoint, and no holder gains receive or close. |
| W5 Honest outcomes | Sends resolve on local admission. Refusals are diagnostics at the refusing side, never outcomes. |
| W6 Independent meaning | Byte vectors are hand-derived from ontos-codec-v1, checked against the released encoder, and replayed in Go and TypeScript by test-local grammar readers. The behavioural observations below judge the runtime. |

## Observations for the realization

A conforming runtime shows each of these, over local pairs and a real network
carrier, with the same adapters:

1. **Round trips.** Each encoding vector round-trips. Ground subvalues stay ground,
   and data shaped like a tag or a reference stays data.
2. **Recursion.** A reply Wire carries a further Wire back, and that one carries a
   third. Transit participants decode nothing and register nothing.
3. **Long-lived calls.** 200 sequential calls, in which the caller closes each
   reply endpoint after its reply and the provider closes each continuation after
   use. Live exports at both ends stay at the number of open endpoints, and no
   call is refused.
4. **A shared Wire.** A exports W to B, and B forwards it to C. B registers
   nothing, and C's sends reach W. When A closes W, the sends of both B and C are
   refused `unknown-export` at A, and neither holder could have revoked the
   other.
5. **No proxy of a proxy.** Forwarding emits identical reference bytes, including
   when a second local participant in the same namespace encodes the proxy.
6. **Refusals before admission.** An `unexportable` Wire, or a `foreign-namespace`
   proxy, refuses the send before admission, registers nothing and sends
   nothing.
7. **Stale scopes.** After the owner's scope is replaced at the same path, frames
   carrying the old scope are refused `stale-scope`, and the replacement target
   receives nothing.
8. **Sibling forgery.** One owner scope exports a public endpoint and a private
   one, the private one intended for another holder. A holder given only the
   public reference, which therefore knows the scope token, replaces its id with
   any other value, including every id the realization could plausibly issue
   next. Each such send is refused `unknown-export` at the owner, and the
   private endpoint receives nothing.
9. **Returning home.** A participant's own current reference decodes to the
   original sending face. A stale or withdrawn one decodes to a Wire whose sends
   are refused, while the rest of the message is delivered.
10. **Received context.** The target receives the context the composition supplied.
   A value containing a tuple shaped like a context stays data and changes
   nothing.
11. **Atomic decoding.** A frame with one malformed node is refused
    `malformed-frame`: nothing is imported and nothing is delivered.
12. **Registration before admission.** A reply that races its request's admission
    finds its export. A send refused by the lower layer leaves its exports until
    their endpoints close.
13. **Concurrent sends.** Many concurrent sends carrying one new face register
    exactly one export, and every frame names it; every delivery arrives. With an
    export bound of N, concurrent sends carrying 2N distinct new faces leave at
    most N live exports, and every other send is refused `limit` before admission.
14. **Ordering.** Frames from one sender over one link reach the target in
    admission order.
15. **Bounds.** Values beyond the node, depth, byte or export bounds are refused
    before work, an incoming frame whose reference material exceeds the byte
    bound is refused with nothing delivered, and a target that does not admit a
    delivery is refused `target-refused`. Under the same bounds, across tight node,
    depth and byte budgets, a sender accepts a value exactly when a receiver
    accepts its frame.
16. **Two languages.** Go and TypeScript peers exchange these frames using fresh
    published dependencies.
17. **Endpoint laws on every path.** A local send of an endpoint, bare or inside a
    tuple, delivers its sending face, with no receive or close. A detach that has
    gone stale cannot remove a newer receiver. A receiver that fails terminates
    its endpoint, whose export then refuses `unknown-export`.

## Consultation

The bitwire process asks for an expert consultation on public contracts. On
7 October 2026 the owner said: "no consultations for now, they are not available
currently"
([quoted in bitspark-accounts](https://github.com/Bitspark/bitspark-accounts/blob/862ed7fddaa9f2badc535f7feb7ff834060c6cc7/docs/decisions/2026-10-07-generic-confirmation.md)).
This record is decided without that advice and reviewed by bitwire's owner
instead, with each alternative and its reason recorded. A later answer is
evaluated against what was built, and any change is a new decision.

## Provenance and evidence

- **The owner's fiber layering**, relayed 7 October and recorded in
  [the platform's applications and shells decision](https://github.com/Bitspark/platform/blob/7e2e65d57713756130031a531b3756ea13979137/planning/decisions/2026-10-07-applications-shells-and-bitnodes.md).
  Domain adapters work with live Wires, and shared hydration turns them into
  addressed ground data and back.
- **The proposal** ([hydrated.md](../wire/hydrated.md), #81 at
  `70758254e0536aeec0652f5fd85f5620fda9e683`) supplies the value domain, the
  surface and the decision table this record answers.
- **The experiment**, bitruntime#40 at `5c3decc359885632d95bffd834ec7c8379390679`
  (main `4ead83f`). It shows end-to-end references through an opaque router,
  swap-back, data isolation and stale-scope refusal, plus the 63-call limit as
  its own observation. Its review asked for that limit to be recorded.
- **The closed export record** (#80 at `305c8234d1a376971d30e5d618f5f405ce9c13b5`)
  and its review findings on scope aliasing, release fan-out and source
  retirement. Its realization (bitruntime `a383393`) is evidence of the lower
  table mechanism only.
- **The vectors.** Hand-derived, and checked against the released bitwire 0.5.0
  encoder.
- **An evidence realization** in Go and TypeScript, on the unmerged bitruntime
  branch `evidence/hydrated-0019-go`, runs the observations; the pull request
  names the head that matches this revision. It is evidence for review, not a
  released implementation.
- **Review history.** Wire & Runtime's review of `20a6b6b` found that counter
  export ids let one reference's holder construct its siblings' references,
  and that concurrent Go sends could split one face across two ids or pass the
  export bound. This revision answers both: unpredictable export ids (D3), one
  encode-and-register step per scope (D5), and observations 8 and 13. Its
  further probes found unbounded reference material in incoming frames, an
  endpoint conveyed whole by a local send, and stale detaches and receiver
  failures outside the Endpoint laws; D7, D8 and observations 15 and 17 now
  cover them. Fiber Composition's replay then found sender and receiver counting
  Wire leaves differently under one bound; D8 now fixes one counting domain.

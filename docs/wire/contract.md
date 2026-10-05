# Wire contract

**Decided:** [decision 0015](../decisions/0015-addressless-wires-and-addressed-access.md).
The [charter](../../CHARTER.md) identifies the boundaries. Native declarations
present one meaning, with language-native asynchronous and failure forms.

## Values, capabilities and paths

`Value = Atom(Bytes) | Tuple(Value*)` is the finite immutable, well-founded,
structurally compared ground Ontos domain. Atoms are exact octets with no intrinsic
text, identifier or authority meaning. Every ground value, including a bare atom
and an unfamiliar tuple, is a legal message. Live capabilities are not Values.

`Path = Atom*` retains exact bytes, segment boundaries, order and multiplicity.
Empty self differs from an empty-key child. Slash bytes, invalid UTF-8 and distinct
Unicode byte spellings remain distinct. No parsing, normalization, ancestor
fallback, implicit mount or child creation is performed.

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
interface Termination { readonly kind: 'closed' | 'failed'; readonly message?: string }
type WireTree = DeixisNode<Wire>;
```

Wire grants sending. Endpoint additionally grants ownership of receiving and
closure at one end of a duplex connection. AddressedWire adds a relative path in
a declared routing domain. AddressedEndpoint applies this layer to an Endpoint.
It uses the same connection and lifecycle; it creates neither another endpoint
lifetime nor permission to use a concurrently attached raw receive handler.

## Admission, ordering and termination

A successful send means local admission, never delivery, execution or response.
A rejected send was not admitted, including invalid input, limits and termination.
Later failure can leave an admitted operation's outcome unknown. IDs, correlation,
deduplication, replay, deadlines and service failures belong to consumer protocols.
Repeated identical Values remain distinct admissions.

Each direction admits messages in a linear local order and starts dispatch of
whole messages in that order, at most once. Healthy attached endpoints eventually
dispatch queued messages under a progressing scheduler. Closure may discard the
remaining suffix. Opposite directions have no shared order. Asynchronous work
started by handlers is not awaited and can finish out of order.

Exactly one receive handler may be attached; a second attachment fails
synchronously. Detach is idempotent and affects only its attachment. Detached
messages wait in a bounded queue. Send and attachment never invoke a handler
inline. A synchronous handler exception fails the endpoint; consumer-level
refusal should be handled inside its protocol when the connection must survive.

Terminal observation fulfills once, never rejects, after owned carrier resources
are released. It reports normal closure or failure; diagnostic text is not a
protocol token. Close is idempotent, ends admission, discards undelivered queues
and awaits resource release. It does not cancel already dispatched application
work. Carrier closure eventually ends the peer; diagnostics may differ. Closing
one local-pair endpoint terminates both.

## Limits

Endpoints declare positive finite message-byte, queue-byte, queue-count and decode
depth bounds. Defaults: 16 MiB per encoded message, 64 MiB queued encoded bytes,
1024 queued messages per direction, depth 4096. Size counts the complete canonical
value and every occurrence, including repeated immutable subvalues. These are
operational limits, not Ontos identity rules or bounds on application-held data.

Outgoing size/depth violations reject before admission or partial output. Incoming
overflow fails the endpoint. A local pair's overflow fails both ends and refuses
the overflowing send. Carrier output queue exhaustion refuses local admission.
No address or ID registry is needed for the raw endpoint.

## Addressed layer

Packing captures the path array into immutable data before sending. Unpacking
produces the exact path and opaque message. The complete addressed value counts
against the underlying endpoint's bounds. The layer has no independent queue,
retry, deadline, ID table, discovery exchange or ownership transfer.

The runtime's addressed endpoint facade attaches its decoder only when `receive`
is called; construction alone performs no I/O or receive attachment. Detach removes
that attachment. Close and terminal observation delegate to the underlying
endpoint. The raw owner must not use raw receiving concurrently with the facade.
A malformed addressed value fails the owning endpoint through handler failure;
there is no guessing another protocol. The raw endpoint itself accepts that same
ground value without interpreting it.

For a captured prefix `p`, `under(A,p).send(q,m) = A.send(p++q,m)`. Empty prefix
is operational identity; repeated prefix binding agrees with concatenation.
`bind(A,p)` exposes only `send(m) = A.send(p,m)`, without receive or close rights.
These operations do not prove remote membership or stable participant identity.
All paths through one addressed endpoint retain its underlying admission order.

## Complete structure and derived sending

A complete DeixisNode is finite and well founded with an own opaque value and a
complete finite child map keyed by unique exact atoms. `own`, `children`, `at` and
`decompose` agree. Child order is presentation, not identity. Empty selection is
self; missing selection is absent. Both reconstruction directions preserve own
values and complete child subtrees. Shared acyclic subtrees are permitted;
duplicate keys and cycles are not. Supplied foreign nodes must continue to obey
these laws.

For a WireTree, derived addressed sending selects first, then invokes the chosen
Wire once. Missing selection rejects with the runtime's distinct missing-path
error and invokes nothing. Refusal by a present Wire propagates as its own failure.
Selection and reconstruction do not bind, invoke, clone or close any capability.
Selecting with `p` and then `q` agrees with selecting `p++q`, including definedness.
Effectful comparisons use corresponding initial states and operation schedules.

A receiver handler tree is another legal DeixisNode instance. Its dispatch helper
returns false only for structural absence and otherwise calls the selected handler
once. This does not turn receive handlers into the definition of WireTree.
Neither an opaque addressed facade nor a transport endpoint implies discovery.

## Authority and evidence

Paths designate; they do not authenticate or authorize. Establishment identity is
runtime context. Service message fields cannot manufacture that context. Portable
names, authorization, reference restoration and wire multiplexing require their
own higher-level protocols.

Independent cases cover bare/unknown messages, repeated admissions, exact byte
paths and prefix cuts, structural noninterference, missing-versus-refused dispatch,
ordering, detach, handler failures, limits and actual resource release. The same
addressed cases must run over local pairs and WebSocket. Compilation alone is not
runtime conformance; structural laws alone do not establish transport guarantees.

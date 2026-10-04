# Generic envelope wire

**Decided for the clean replacement.** See [decision 0014](../decisions/0014-generic-envelope-wire.md).
Native declarations present these laws, not independent protocols.

## Values and paths

`Bytes` is a finite octet sequence. ontos L0 is `Value = Atom(Bytes) | Tuple(Value*)`:
finite, immutable, well founded, structurally compared and uninterpreted. Atoms
have no intrinsic text, number, identifier, reference or authority meaning.
Unknown ground embeddings are valid payloads. JSON is no identity rule.

`Path = Atom*` is an ordered sequence of exact byte keys. Empty path selects self;
a path containing the empty atom selects the empty-key child. Bytes, segment
boundaries, order and multiplicity matter. Slash bytes are ordinary key bytes.
No parsing, case folding, Unicode normalization, ancestor fallback or implicit
child creation. Addresses are scoped to the connection's routing domain.

## Envelope and interface

```typescript
type Path = readonly Atom[];
interface Envelope {
  readonly source: Path;
  readonly destination: Path;
  readonly id: Atom;
  readonly correlation?: Atom;
  readonly payload: Value;
}
interface Wire {
  send(envelope: Envelope): Promise<void>;
  receive(handler: (envelope: Envelope) => void): () => void;
  readonly closed: Promise<Termination>;
  close(): Promise<void>;
}
interface Termination { readonly kind: 'closed' | 'failed'; readonly message?: string }
```

Every field except correlation is required. Empty IDs are valid. Missing
correlation differs from an empty correlation atom. The wire imposes no UUID,
text, monotonicity, uniqueness or deduplication requirement on IDs. An exchange
protocol can define these for its own messages. There is no implicit invocation
table. Source and correlation do not authenticate a sender or grant authority.

## Admission and ownership

Send captures header arrays before admission. Ground values are immutable;
later edits to caller arrays/records cannot affect delivery. Success means local
admission, not delivery, execution or response. Rejection means not admitted,
including invalid input, limits and termination. Later failure may leave an
admitted envelope's outcome unknown; replay needs a separate exchange contract.

Successful admissions have a linear local order. Each direction dispatches
whole envelopes once in that order, with no merging or splitting. Both endpoints
may originate messages. Same-ID messages are distinct admissions, both delivered.

## Receiving and termination

At most one handler is attached. A second attachment fails synchronously. Detach
is idempotent and removes only its own handler. Incoming envelopes wait in a
bounded queue while detached. Neither attachment nor send invokes a handler
inline. Dispatch starts in order; asynchronous handler work is not awaited and
may finish out of order. A synchronous handler exception fails the endpoint.
Native presentations document equivalent exception handling.

Terminal observation fulfills exactly once, never rejects, after release of
owned carrier/listeners/timers. It reports normal closure or failure; messages
are diagnostic, not stable authority/protocol tokens. Close is idempotent, ends
admission, discards undelivered queues and awaits release. It promises no graceful
delivery and does not cancel already-dispatched service work. Carrier closure
eventually terminates the peer, whose diagnostic classification may differ.
Local pair closure terminates both endpoints immediately.

## Bounds and structure

Endpoints declare finite envelope, queued-byte, queued-count and decode-depth
limits. Queue overflow fails the receiving endpoint and ends the connection.
An outgoing limit violation refuses admission without partial bytes. Reference
defaults: 16 MiB envelope, 64 MiB queued bytes, 1024 queued envelopes, depth 4096.
These are operational limits, not ontos identity rules. They do not bound work
or values retained by applications after dispatch. No ID registry is required.

A complete `DeixisNode<T>` is finite and acyclic, with an own value and complete
ordered child map keyed by unique atoms. `own`, `children`, `at(Path)` and
`decompose` agree. Empty selection returns self; missing selection is absent.
Decomposition reconstructs own values and exact child structure. Construction
rejects duplicate keys and cycles. Child order is presentation order, not key
identity. Opaque route access does not imply complete discovery.

## Independent expected observations

Before runtime code: empty self differs from empty child; binary/slash keys and
distinct Unicode byte spellings stay distinct; mutation after send cannot change
delivery; unknown payloads survive; duplicate IDs are both delivered; missing
routes do not select ancestors; a second handler fails; detach retains order;
handler throws terminate; oversized sends reject before admission; queue overflow
ends the connection; close drops queues and releases owned resources without
claiming execution cancellation. Compile-only evidence does not prove these laws.

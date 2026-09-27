# Research: What a carrier guarantees when it refuses, closes and frames

**ID:** 0004
**Date:** 27 September 2026
**Status:** awaiting-advice
**Author:** Julian Matschinske <julian@matschinske.com>
**Issue:** [bitwire#54](https://github.com/Bitspark/bitwire/issues/54)

## Question

bitwire is a contract repository. It must now specify the **carrier contract**:
the guarantees that every *carrier* makes, whoever implements it. A carrier is
the component that moves messages between two endpoints: over a network
connection, over a byte stream such as a child process's stdin and stdout, or
inside one process. The contract must be written so that we can test
implementations against it with independently written cases and byte-exact
vectors.

Five decisions are open. Each is currently answered only by what one
implementation happens to do:

1. **Refusal and publication.** When a send is refused synchronously, does that
   prove the message was never published, meaning it never became visible
   beyond the sender? What evidence may justify a retry, and how is
   "we cannot know" represented?
2. **When a message becomes immutable.** At what moment does the carrier own a
   message, so that what was validated is what is sent?
3. **Closing.** Abrupt close versus graceful drain. What happens to refusals
   still queued, to requests admitted but not yet answered, and to handlers
   still running? And should one overflowing queue end the whole connection?
4. **Errors and close codes.** One classification for "this carrier is
   closed" that keeps its cause. Which close codes may be sent and which may
   only be observed. The code the receiver sends versus the code the sender
   observes, which differ on some transports.
5. **The framed byte stream `bitwire-stream/1`.** Its exact framing, limits,
   end-of-input, truncation, write-failure and close-race rules, fixed from a
   specification rather than inferred from a runtime.

**The hard constraint:** the network protocol revision `bitwire/1` is
immutable. It is defined as the on-the-wire behavior of one released program,
and implementations are tested for exactly that behavior. Some of the answers
we are drawn to would change what crosses the network. Those need a new
protocol revision, and we must say which ones.

**What we need back:** for each decision, a recommendation we can write as
contract text and test cases. We also need a view of which parts belong in
the carrier contract (valid for every transport and revision), which belong
in a future protocol revision, and which belong elsewhere. Decisions 4 and 5
block an implementation that is waiting (the byte-stream transports). The
others can be staged.

**Scale:**
- Two implementations exist, Go and TypeScript, in one runtime project,
  bitruntime.
- Four consumers are waiting on answers: the byte-stream transports, the
  tunnel, a message relay service, and a developer tool that talks to child
  processes over stdio.
- One consumer already depends on today's behavior of decision 1. It retries a
  request that a closed connection refused, and never one it admitted.
- Traffic is request/response and events between services and tools, with
  frames of at most 1 MiB. It is not a high-volume data plane.

## Terms

- **Message.** One unit a carrier moves. It has a **kind**:
  - a *request*, which expects a response;
  - an *event*, which expects nothing;
  - a *response*, which answers a request;
  - a *cancel*, which withdraws a request.

  A request also carries a **return capability**: a local object through which
  the response and later controls come back to the requester.
- **Path.** An array of strings naming where a message goes, such as
  `["tree", "get"]`. Over the network a path becomes a request's method name
  or an event's name.
- **`AddressedWire`.** The in-process send interface for messages with a path:
  `Send(path, message) error`. **Endpoint** adds receiving and closing. **Wire**
  is the same without a path: `Send(message) error`. All three are declared in
  bitwire's contract (below).
- **Admission and refusal.** `Send` returns when the carrier has either
  *admitted* the message (accepted it for delivery) or *refused* it. Admission
  is never evidence that the destination acted on the message.
- **Publication.** A message is *published* once it can become visible beyond
  the sender's own pre-admission machinery: written to a socket, placed where
  another thread or process can read it, or handed to a component that may do
  either. "Unpublished" is local proof that this did not happen and never will
  for this send.
- **Transport.** Moves whole, ordered *frames* (byte strings, text or binary)
  between two places. Examples: a WebSocket connection, an in-memory pipe, and
  the planned framed byte stream.
- **Carrier.** Provides `AddressedWire` endpoints, over a transport or without
  one. It assigns request identifiers, matches responses and cancels to their
  requests, and creates each accepted request's *invocation*: the local record
  that tracks it until it is answered.
  - A **peer** is a carrier over a transport that speaks the network protocol.
  - A **local pair** is a carrier without one: two connected endpoints in the
    same process.
  - A peer's **root** is the endpoint through which its application sends and
    receives.
- **Profile, protocol revision, `bitwire/1`.** The network protocol, and its
  first immutable revision. Each frame is one JSON object, an *envelope*,
  whose `kind` member is one of the four message kinds.
- **Close code.** A number, with a reason text, that a connection ends under.
  The numbers are the WebSocket registry's on every transport:
  - 1000 normal;
  - 1001 going away;
  - 1002 protocol error;
  - 1009 message too big;
  - 1011 internal error;
  - 4011, the protocol's own code for "the other side broke the protocol".

  RFC 6455 reserves three codes that a WebSocket endpoint may only *observe*
  and must never send in a close frame: 1005 (no status received), 1006
  (abnormal closure: the connection dropped without a close frame) and 1015
  (TLS handshake failed). We call these **observe-only**.
- **Abort** ends a connection at once and sends nothing. **Close** sends a
  code and reason, then ends.
- **Bounds.** Queue depths, the maximum frame size (1 MiB by default) and
  deadlines. `bitwire/1` fixes their defaults.
- **Tunnel.** An optional layer of `bitwire/1` that multiplexes *channels* over
  one connection with credit-based flow control. Its control messages are
  ordinary events named `channel.open`, `channel.close` and so on.
- **Conformance cases and vectors.** A *case* is an expected observation
  written from the specification, never recorded from an implementation. A
  *vector* is an exact byte sequence with its expected verdict, for a codec or
  a framing.

## Context

### Who is who

- **bitwire** is a contract repository. It publishes the interface
  declarations in eight languages, the `bitwire/1` protocol bundle, and
  independent conformance cases. It ships no production implementation. By
  accepted decision, bitwire *specifies* carriers and the byte-stream framing,
  and bitruntime *implements* them.
- **bitruntime** is the Go and TypeScript implementation: carriers,
  transports, the protocol engine and the dispatcher. It was ported from
  Nightseam v0.6.0 and interoperates with it byte for byte.
- **Nightseam** was the original runtime. It is discontinued. `bitwire/1` is by
  definition its release v0.6.0's network behavior, frozen.
- **Consumers waiting on this decision:**
  - bitruntime's byte-stream transports (stdio, TCP, Unix sockets);
  - bitruntime's tunnel;
  - bitwire-svc, a relay that splices frames between two connections;
  - a developer tool that runs child processes over stdio.

  bitsystem3, an application, already runs on bitruntime and relies on
  today's behavior for decision 1.

### The interfaces bitwire declares

Go presentation, `wire/go/wire.go` (the other seven languages say the same):

```go
// Message preserves a frame, its local capability and associated received
// context through routing. [...] Keep the message's contents immutable after
// Send admits it; implementations may retain them.
type Message struct {
	Frame  ProfileFrame   // the envelope: kind, id, params/result/error/data, trace, meta
	Return *ReturnAddress // the return capability; never sent over the network
}

// Receiver receives complete deliveries relative to its endpoint's origin,
// and an ending.
type Receiver struct {
	Message func(path []string, message Message)
	Closed  func(code Code, reason string)
}

// AddressedWire is send access to an origin. [...]
// Send returns when accepted or refused, without running a destination handler
// on the sender's stack or waiting for its result. Success means admission,
// not completion of an application effect.
type AddressedWire interface {
	Send(path []string, message Message) error
}

// Endpoint combines send access with receive attachment and lifecycle control.
type Endpoint interface {
	AddressedWire
	Receive(receiver Receiver) (detach func(), err error)
	Close(code Code, reason string) error
}

// Wire is addressless sending access. Send completes on admission or refusal,
// not application completion, and grants no receiver or endpoint ownership.
type Wire interface {
	Send(message Message) error
}
```

`ProfileError`, the public error data a response can carry, says of itself:
"Its fields do not prove that a failed send was never published. That local
evidence, when required by value conversion, belongs to the admitting
runtime." So the contract today names publication evidence but assigns it to
no one.

The contract text, `docs/wire/contract.md`, says: "Both Wire and AddressedWire
sending complete on admission or refusal; neither awaits a response or
executes destination application code on the sender's stack. [...] Successful
admission says nothing about completion of an application effect. Bounds,
request correlation and termination policy are provided by the selected
profile's implementation." It also says: "Closing an endpoint ends its active
attachment and notifies its Closed callback, if present, at most once."

bitwire declares no transport interface, no `Abort`, no close-code constants
and no closed-error type in any language. The only public transport seam today
is bitruntime's (below).

### Decisions already taken (binding)

**Decision 0007** made bitwire the owner of the protocol and the carrier
contract. It says what the carrier contract must state:

> The carrier contract states what every carrier preserves:
> - messages, and their order within a stated scope;
> - the identity of the original return capability within a process;
> - the mapping of return capabilities and context across a process boundary;
> - what acceptance and closing promise at its boundary;
> - one classification of closed errors;
> - which close codes may be sent and which may only be observed, so that 1006 is
>   never transmitted.
>
> It binds carriers written outside Bitwire too. Anyone can add a transport by
> implementing the public seam.

It also draws the line between carrier and runtime: "A carrier *accepts* a
request and creates its invocation; a dispatcher *captures* the request's
route into that invocation. Up to acceptance, for the invocation's state, and
for what an accepted request is still owed on its connection (its response and
its cancels), Bitwire is responsible. Choosing a handler, capturing a route and
running a handler belong to the runtime." It leaves open three questions from
an earlier consultation (our research 0001): decisions 1, 2 and 3 of this
document.

A later clarification of 0007 says that the rule "1006 is never transmitted"
applies from the carrier contract onward. It does not apply retroactively to
`bitwire/1`, which transmits 1006 in one place (see "The tunnel's abort"
below).

**Decision 0008** gives every protocol revision its own identity and makes it
immutable: "A change to what a peer sends, accepts or refuses, to close codes,
or to default bounds is a new revision."

**Decision 0009** fixed the carrier groups and the outline of the byte-stream
framing:

> **Carriers are grouped by what their transport lacks.** A transport must move
> whole, ordered frames reliably in both directions, with backpressure, a receive
> limit and an explicit close.
>
> **Byte streams carry frames as `Content-Length` records.** A record has three parts:
> 1. a short ASCII header block: `Frame: text`, `binary` or `close`; then `Code:`
>    for a close; then `Content-Length:`;
> 2. an empty line;
> 3. exactly that many bytes of body.
>
> Closing works as follows:
> - A close record carries its code, with the reason as its body.
> - The other side replies with a close record of its own.
> - End of input without a close record is observed as 1006.
> - 1005, 1006 and 1015 are never sent.
>
> The receive limit is checked against `Content-Length` before any of the body is
> read. The format is named `bitwire-stream/1`. Under decision 0008's rule, it
> never changes in place.

0009 rejected newline-delimited JSON: it cannot carry binary frames, a close
needs a reserved line that could collide with a frame, and a frame's size is
known only after the whole line is read. It also rejected a binary length
prefix, which is unreadable in logs and terminals and whose width and byte
order must be fixed. And it says two things are deliberately *not* carriers:
a durable log, and a frame-splicing relay, which "works below the Wire and
preserves no end-to-end authentication".

**Decision 0010**: bitwire specifies carriers and the framing; bitruntime
implements them. Decision 0012 keeps carriers on `AddressedWire`; the
addressless `Wire` and its trees are a separate contract.

### What `bitwire/1` already binds

These sentences are in the revision's hashed scope document and cannot change
without a new revision:

- "A frame larger than the receiver's limit is refused before delivery. The
  receiver ends the connection with **1009**. What the sending side observes
  when that close is lost to the transport's teardown is the transport's."
- A malformed or binary frame ends the connection with **4011**.
- "A caller at its limit of outstanding calls refuses the next call without
  sending a frame."
- **Default bounds:** 128 outgoing frames; 128 events waiting for their
  handlers; 128 calls outstanding; 64 requests being handled; frames of at
  most 1 MiB; a 30-second call deadline; a 10-second write deadline.
- **Pacing:** a full queue is paced for one write deadline, and a consumer
  that has not drained it by then is disconnected.
- **"A full Wire queue ends that carrier."** Cancellation has a bounded
  reserved admission per retained request, so saturation cannot strand it.
- **The queue order** of accepted data and control frames, and the
  distinction between `busy`, a remote refusal, and the caller's own limit.
- **Admission is enqueue.** An emitted event resolves when its frame is queued
  for the connection. A later write failure or write-deadline expiry ends the
  connection; it is not reported to that sender.

**The tunnel's abort.** `bitwire/1` requires that "an aborting side sends
`channel.close` with code **1006** and an empty reason, and ends the channel
at once", and that "a receiver treats a `channel.close` carrying 1006 as an
abnormal end of the channel". Its channel limits are 1009 for an oversized
inner frame, 1002 for a frame beyond the credit window and 1001 when the outer
connection closes. Transmitting 1006 contradicts decision 0007's rule. The
revision's findings register holds this for revision 2.

### The carrier specification draft

`docs/wire/carriers.md` is a draft. Nothing in it is adopted, and it records
decisions 1 and 3 of this document as still open. Beyond decision 0009 it
fixes the byte-stream details as follows:

- **Header lines.**
  - Lines end with CR LF and come in a fixed order: `Frame:`, then `Code:`
    (close records only), then `Content-Length:`.
  - `Content-Length` is decimal, without leading zeros (an empty body is `0`),
    and at most 15 digits.
  - The header block, including its empty line, is at most 128 bytes.
- **Close records.** A close record's body is the reason: UTF-8, at most 123
  bytes, which is the WebSocket bound.
- **Closing:**
  > A side sends one close record and nothing after it. A side that receives a
  > close record replies with its own close record carrying the same code, as a
  > WebSocket does, unless it has already sent one. It delivers the code and
  > reason to its receiver. `Close` waits for that reply, or for the end of
  > input, until its context ends. After both records, each side ends its write
  > direction and then the stream: it closes a child's stdin, or shuts down a
  > TCP connection's write side.
  > - **Abort** sends nothing and ends the stream at once.
  > - **End of input without a close record**, from an abort or a dropped stream,
  >   is observed as 1006.
  > - Anything received after a close record is discarded.
- **Refusals:**

  | What it receives | Code |
  | --- | --- |
  | A header block that does not match the grammar, is longer than 128 bytes, or names an unknown frame kind | 1002 |
  | A `Content-Length` over its receive limit, checked before any of the body is read | 1009 |
  | A close record with an observe-only code, or a reason longer than 123 bytes | 1002 |
  | Bytes before the first record that are not a header block, such as a banner a child printed to stdout | 1002 |
- **Backpressure:** "A sender writes each record whole, one at a time and in
  order. Concurrent sends are serialized, so records never interleave. A send
  waits while the stream cannot take more. [...] The format adds no
  acknowledgments or credit."
- **Conformance:** portable vectors, byte for byte:
  - each kind of record, including an empty body;
  - a record split across many reads, and several records arriving in one
    read;
  - each refusal with its close code;
  - the limit enforced before the body is read;
  - the close reply, a close from both sides at once, and end of input
    observed as 1006;
  - a banner before the first record.

**The draft is silent on:**
- a truncated record (end of input inside a header or a body);
- the `Code:` line's syntax, and the limits that apply to close records;
- what `Close` does when its wait expires;
- what the sender of an over-limit frame observes;
- a write that fails partway through a record;
- the order of half-close against a concurrent send;
- decisions 1 to 3 of this document.

### How the implementations behave today

bitruntime v0.3.0 (Go and TypeScript) is the only implementation. What
follows is what it does, read from its code and tests. None of it is contract
yet.

**The layers of a peer, from the application down:**

```text
application code
   │  Send(path, message)            returns: admitted, or refused
   ▼
root Endpoint ──► root queue (128)   a nil Send means "in this queue"
   ▼
protocol engine ──► output queue (128) ──► write loop
   │   assigns request ids, correlates responses, creates invocations,
   │   validates inbound envelopes, paces and ends the connection
   ▼
transport Conn.Send(frame)           the seam: whole frames, in order
   ▼
WebSocket / in-memory pipe / (planned) framed byte stream
```

A local pair has no transport. Its two endpoints hand messages to each other
through one bounded queue per direction.

**The transport seam in Go** (`transports/go/transport.go`, abbreviated):

```go
// Conn is a frames duplex connection. [...] Once Close or Abort was called,
// every Send and Receive returns ErrClosed; once the remote closed, Receive
// returns a *CloseError and Send fails.
type Conn interface {
	// Send writes one frame after every frame sent before it. It blocks while
	// the transport cannot take more, until ctx ends.
	Send(ctx context.Context, frame Frame) error
	// Receive returns the next frame in order. A frame larger than the
	// receive limit is not delivered: Receive returns an error and the
	// connection ends with CodeTooLarge (1009).
	Receive(ctx context.Context) (Frame, error)
	// Close ends the connection with a code and a reason the remote side
	// will see, waiting for its acknowledgement until ctx ends where the
	// transport has one. A code that is not Sendable is refused with
	// ErrUnsendableCode and nothing is sent.
	Close(ctx context.Context, code Code, reason string) error
	// Abort ends the connection at once, with no handshake and nothing sent.
	// The remote side observes CodeAbnormalClosure (1006).
	Abort() error
}

// Sendable: 1004, 1005, 1006 and 1015 are never sent; 1000–1014 and
// 3000–4999 otherwise are.
func Sendable(code Code) bool

// ErrClosed is the one classification of a closed carrier: every endpoint,
// operator and helper reports a closed or ended carrier as an error for which
// errors.Is(err, ErrClosed) holds, whatever layer noticed it.
var ErrClosed = errors.New("bitruntime: closed")

// CloseError is what Receive returns once the remote side closed: its code
// and reason. errors.Is(err, ErrClosed) holds for it.
type CloseError struct { Code Code; Reason string }
```

The seam does not say whether a `Send` that returned an error might still
have delivered its frame. It says nothing about draining queued frames on
`Close`, or about whether cancelling a `Receive` may damage the connection.
(On WebSocket it does damage it.)

**The transport seam in TypeScript** (`transports/ts/src/index.ts`,
abbreviated). It is push-based and has no abort:

```ts
export interface FrameConnection {
  readonly state: 'connecting' | 'open' | 'closing' | 'closed';
  /** What a send left with the connection that the transport has not taken yet.
   *  The peer paces on it and reads only whether it is zero. */
  readonly buffered: number;
  /** Throws when the connection is not open. */
  send(frame: Frame): void;
  /** Throws a RangeError, and sends nothing, for a code that is not sendable. */
  close(code?: number, reason?: string): void;
  listen(handlers: { open?, frame?, close?(code, reason), error? }): () => void;
}
```

**The behavior today, side by side:**

| Question | Go | TypeScript |
| --- | --- | --- |
| **Decision 1.** What does a synchronous refusal from `Send` prove? | Every synchronous error from a root or a pair is wrapped as `Unpublished`: nothing was queued. | The same at the root. The call helpers treat *any* synchronous throw from *any* `AddressedWire` as proof, which the contract does not promise. |
| Refusals that arrive later | `busy` (the pending-call bound), a duplicate id and `method_not_found` come back through the return capability after `Send` returned success, and carry no proof. | The same. |
| What does a successful `Send` mean? | "In the root queue". The frame then moves to the output queue, then to the transport. A failure at a later stage reaches a request's return capability, or is lost for an event. | The same, and the peer can still refuse at handoff and end the carrier. |
| **Decision 2.** When does the carrier own the message? | The root, the pair and reply capabilities copy the payloads at the start of `Send`, then validate the copy. The WebSocket transport does not copy, but writes synchronously. | The root and pair take a JSON snapshot at admission. The in-memory pipe does not copy: the receiver gets the same byte array, so a later mutation by the sender shows. |
| **Decision 3.** Is there a graceful drain? | No. `Close` sends 1000 but abandons frames already accepted, including events whose send returned success. | No. Every ending drops the output queue and the inbound event queue. |
| Pending work when a carrier ends | Pending calls and requests still queued at the root are answered `disconnected`. Queued refusals are answered with their refusal (a fix of a Nightseam defect in which 3 to 56 of 512 refused callers waited out their own deadline). Running handlers are cancelled and their responses dropped. | The same for calls and queued requests. Running handlers are aborted and never answered. |
| A full queue | Ends the whole carrier, as `bitwire/1` requires. The peer aborts (the far side sees 1006); the pair ends with 4011. | Ends the whole carrier, sending 4011. |
| **Decision 4.** One closed classification | `errors.Is(err, ErrClosed)` holds everywhere and the cause is kept (`ErrBackpressure`, a remote `CloseError`, a context's end). But a call cut off by the carrier's end gets only the public error `disconnected`, which loses the cause and does not match `ErrClosed`. | `PublicError('disconnected')` is the classification, with the cause kept as a non-enumerable property. |
| Close codes the engine sends | 1000 on close. 4011, with the decoder's error as reason, for a protocol violation, including a binary frame (1003 would fit). An operational failure (write failure, stall, overflow) is an abort, so the far side sees 1006 and cannot tell a stalled consumer from a dropped network. | 1000 on close. **Every internal failure sends 4011** with one fixed reason: malformed or oversized frames, write timeout, stalled consumer, full queue, socket error. |
| An application asks to close with an observe-only code | Refused at the transport; the peer aborts instead, so the far side sees 1006. | Turned into 1000 with an empty reason, so the far side sees a *normal* close. |
| What the receiver's `Closed` callback reports | Always `1001 "peer ended"` at a peer's root, whatever happened. The local pair passes the real code. | The same. |
| An over-limit frame | The receiver sends 1009. Over the pipe the sender sees 1009. Over WebSocket the sender sees 1009 or 1006, a race the test suite allows. | The peer sends 4011, not 1009. 1009 appears only when the WebSocket library's own limit trips first. |
| **Tunnel** | Not ported. Nightseam v0.6.0 Go sends `channel.close` 1006 on abort, and sends any code unchecked. | Not ported. v0.6.0 TypeScript had no channel abort. |
| **Decision 5.** Byte streams | Not built. | Not built. |

**Concrete defects on record:**
- **A refusal racing an outgoing write** (Nightseam issue 456). A peer
  refused a request as a protocol violation (a non-increasing request serial,
  which ends the connection with 4011) while it was still writing the answer
  to the previous request. The raw side intermittently observed 1006 instead
  of 4011. Two causes were named and never told apart: the abort pre-empting
  the close frame, or the observing driver reporting closure before reading
  the frame already in flight. The test was reshaped to avoid the race.
  Nothing was fixed, and bitruntime has no test for it.
- **The sender of an over-limit frame** can observe 1006 instead of 1009 on
  a TCP WebSocket, because the socket teardown loses the close frame.
  `bitwire/1` already says what the sender observes "is the transport's".
- **A frame-splicing relay and a consumer that retries.** bitsystem3 retries
  a request that a closed local pair refused synchronously, and never one
  that was admitted. The relay service must not infer publication or retry
  safety from anything the contract does not state.

### Constraints

- **`bitwire/1` is immutable.** A rule that changes what a peer sends, accepts
  or refuses, a close code on the network, or a default bound needs a new
  revision. Revision 2 has no date; it waits on a separate design of how
  received context travels. Anything we decide for the network must therefore
  either fit revision 1 as it is, or be marked as waiting for revision 2.
- **The carrier contract binds every carrier**, including ones written
  outside Bitspark, and the in-process local pair. It must be testable from
  outside: expected observations, not implementation internals.
- **Language shapes differ.** Go's transport seam blocks and pulls;
  TypeScript's pushes and paces on a `buffered` count. The contract states
  what each promises so that conformance compares like with like. It must not
  force one language's concurrency model on the other.
- **Out of scope here:** the invocation lifecycle (how a running handler's
  body is retired, which has its own issue), authentication, application
  retries and received-context authority. No protocol negotiation, no
  automatic replay, no generic service.
- **Evidence must be independent.** bitwire writes expected observations from
  the specification. bitruntime's current behavior is input, not the answer.

### Advice already given on these questions

**Our research 0001** (an earlier consultation) recommended, for decision 1:

> Returning a synchronous refusal means this send has not made the request, or
> authority newly exported solely for it, available beyond its pre-admission
> machinery, and no deferred action from this send will publish it later.
> [...] Once a component has crossed its publication boundary, a later
> transport error cannot truthfully become `Unpublished`. A carrier may need to
> admit into an owned queue and report subsequent failure through invocation
> completion, rather than return an ambiguous write failure as a synchronous
> refusal.

| Sender observation | What may be concluded |
| --- | --- |
| Synchronous refusal satisfying the contract | This send was not published. |
| Acceptance, followed by timeout or disconnection | Publication was possible; remote effects may be unknown. |
| An asynchronous `method_not_found` or other response | A published invocation received that response; this is not the same evidence as local non-publication. |

For decision 3 it recommended "graceful shutdown: refuse new requests and
events, preserve owed controls and required receive state, and detach after
draining or reaching an explicit deadline", distinct from "abort: end local
pending invocations with an appropriate failure outcome [...]; do not imply
that remote execution stopped". And: "A decision to stop admitting new work
must not, by itself, prevent delivery of valid controls belonging to
previously admitted work."

**bitsystem3's research on its carrier stack** recommended:
- Publication evidence "concerns one identified publication attempt at one
  boundary. It must never be inferred from serialized `PublicError` fields, an
  arbitrary nested failure, a timeout or a lost reply."
- One closed classification that preserves "whether the closed resource was a
  root, pair, channel or physical connection as structured detail".
- **Root overflow** should end only the root, "not the physical session or
  unrelated extensions", with "reserved capacity for terminal responses,
  cancellation, channel credit and other necessary control messages". This
  conflicts with `bitwire/1`'s "a full queue ends its carrier", so it would need
  revision 2.
- Byte budgets: 128 frames of up to 1 MiB each already allow 128 MiB of
  queued data per queue, before copies. "A bounded data queue with an unbounded
  cleanup queue is not a bounded runtime."

**Our research 0003** said of 1006: "RFC 6455 prohibits transmitting 1006 in a
WebSocket Close control frame and recognizes that endpoints can observe
different close codes. Your decision extends the no-transmission requirement to
carriers generally. Preserve that rule without claiming that a remote endpoint
always observes the close code a sender selected." And: "The reported
over-limit 1006 observation is a reason to examine test observation points,
not to weaken every close-code assertion to accept either value."

### What we have considered

**Decision 1: refusal and publication.**
- **A. Any synchronous refusal from any `Send` proves non-publication.** This
  is an obligation on every implementation, composites included (research
  0001's recommendation). It is simple for callers. But an opaque wrapper, such
  as a tee or a retrying guard, whose inner send succeeded and a later step
  failed would forge the proof.
- **B. Only an explicit marker proves non-publication.** A component attaches
  the marker (today's `Unpublished`) only when it can guarantee it, for one
  identified attempt at its own boundary. A plain synchronous error proves
  nothing. Forwarders and composites pass the marker through only for the
  attempt they themselves made. Callers retry only on the marker.
- **C. No proof at all.** Retry safety is the application's business, through
  idempotency keys.

We lean to **B**, with a three-valued outcome for a request: *unpublished*
(the marker), *answered* (a response arrived) and *unknown* (admitted, then
timed out, cancelled or disconnected). One open sub-question: the caller-side
limit of outstanding calls, which `bitwire/1` says "sends nothing". Today it
is answered later without proof. Should it become a synchronous marked refusal?
That would change no frame.

**Decision 2: when a message becomes immutable.**
- **A. Ownership transfers at the start of `Send`.** The carrier copies (or
  snapshots) the payload, then validates the copy, and the caller may reuse its
  buffers once `Send` returns. This is bitruntime's endpoint behavior today.
- **B. The caller must keep the message unchanged from the start of `Send`
  onward, forever.** Zero-copy, and the carrier may retain it. This is close to
  today's contract text ("immutable after Send admits it"), which leaves the
  window *during* `Send` uncovered.
- **C. The same split one level down.** The transport seam takes ownership of
  a frame's bytes at `send` (so the TypeScript pipe's aliasing becomes a
  defect), while the endpoint follows A.

We lean to **A** at the endpoint and **C** at the seam, and would like to know
whether copying at every layer is the usual price.

**Decision 3: closing.**
- **A. Abort only (today).** Every admitted or queued request is answered
  exactly once and promptly, with its refusal or `disconnected`. Admitted
  events and owed responses may be lost. Simple, and honest when stated.
- **B. `Close` drains.** It stops admitting new work, flushes the output
  queue (admitted events, owed responses, cancels) up to a deadline, then sends
  its close code. `Abort` stays immediate.
- **C. B plus a "going away" phase.** The peer tells the other side it will
  admit no new requests but will finish those in flight, like HTTP/2's GOAWAY.
  That needs a new frame, so revision 2.
- **Root overflow:** keep "a full queue ends its carrier" for revision 1, and
  record root-only termination with reserved control capacity as a candidate
  for revision 2.

We lean to **B** for the carrier contract, and C and root-only overflow as
revision-2 candidates. We are unsure how much a drain can promise when the
far side is itself slow, and whether "admitted events may be lost on close"
is acceptable to state plainly.

**Decision 4: errors and close codes.**
- **Sendable set:** 1000–1003, 1007–1014 and 3000–4999 are sendable; 1004,
  1005, 1006 and 1015 are observe-only, as RFC 6455 has it. A request to close
  with an observe-only code is refused at the seam and nothing is sent. The
  open question is what the layer above does then: abort (Go today, so the far
  side sees 1006), or close with 1000 (TypeScript today, so the far side sees a
  normal close).
- **Which code for which failure.** The implementations disagree:
  - protocol violations are 4011 in both;
  - operational failures (a write that timed out, a stalled consumer, a full
    queue) are an abort in Go and 4011 in TypeScript.

  Candidates are an abort, 1011 (internal error) or 1008 (policy violation).
  `bitwire/1` does not fix this. Its profile lists the registry codes, requires
  4011 for protocol violations and 1009 for an over-limit frame, and says a
  consumer that has not drained within one write deadline is disconnected, but
  not with which code. bitruntime's two languages, each ported from its
  Nightseam v0.6.0 counterpart, differ here. So the carrier contract can fix one code
  without a new revision: that narrows implementations within what revision 1
  already allows.
- **Receiver versus sender.** The contract promises the code a side *sends*.
  What the other side *observes* is promised only per transport:
  - exact on the in-memory pipe and on the byte stream;
  - on WebSocket, the sent code or 1006 when the close frame was lost to the
    socket teardown.

  Tests then assert the sender's action exactly, and the far side's
  observation against that per-transport rule.
- **One closed classification.** One error kind, with the cause kept and the
  resource that closed (root, pair, channel, connection) as detail. A call cut
  off by its carrier's end reports that kind, not only a public error code.
  A receiver's `Closed` callback reports the code the connection really ended
  under, not a constant.

**Decision 5: `bitwire-stream/1`.** Gaps to close, with our tentative answers:

| Situation | Tentative rule |
| --- | --- |
| End of input inside a header block or body | Observed as 1006: the stream was dropped. Nothing is delivered. |
| A write fails partway through a record | The stream cannot be resynchronized, so the writer aborts: it sends nothing more and ends the stream. The far side observes the truncation as above. |
| `Code:` line | Four decimal digits, a sendable code. A close record with an observe-only code is refused with 1002. |
| `Close` whose wait for the reply expires | The side aborts and observes 1006 itself. |
| Both sides send close records at once | Each receives the other's record, sends no reply because it already sent one, and ends its write direction; each delivers the code it *received*. |
| After sending its close record, a side has a frame to send | Refused locally as closed; never written. |
| Header names in another letter case, or bare LF line ends | Refused with 1002; the grammar is exact. |
| A child process on stdio | Writes only records to stdout and diagnostics to stderr. The child's exit is end of input. |

## Questions for the Expert

1. **Publication evidence.** How would you define what a refused send proves,
   so that it composes through wrappers, forwarders and carriers without ever
   being forged? We lean to an explicit marker for one attempt at one
   boundary, and a three-valued outcome: unpublished, answered or unknown.
   Which patterns from comparable systems fit a small in-process-plus-network
   messaging layer, and which traps have you seen? Examples we know of are
   HTTP/2's `REFUSED_STREAM` and `GOAWAY` with its last stream id, gRPC's
   transparent retry, and message brokers' publisher confirms.

2. **Closing.** What should a carrier owe work it has admitted when it closes:
   admitted events, owed responses, queued requests, cancels in flight?
   - Where would you draw the line between a draining `Close` and an immediate
     `Abort`?
   - How should a drain be bounded when the far side is slow?
   - Is "admitted events may be lost on close" an acceptable thing to state
     plainly?
   - Is ending only the overflowing root the right direction for our next
     revision, given that `bitwire/1` binds "a full queue ends its carrier"?

3. **Errors and close codes.** How would you structure close codes and the
   one closed classification?
   - Which code should an operational failure send (a stalled consumer, a
     write that timed out, a full queue), given that the protocol reserves
     4011 for protocol violations?
   - What should a layer do when asked to close with an observe-only code?
   - How should conformance tests assert what a sender does and what the far
     side observes, when the observation depends on the transport (1009 lost
     and seen as 1006), without weakening every assertion to "either"?

4. **The framed byte stream.** Please review `bitwire-stream/1` as drafted,
   together with our tentative rules for the gaps: truncation, a failed write
   partway through a record, the close handshake's timeout, simultaneous
   close, and stdio's specifics. What would you change, and what is still
   missing? What should the portable vectors look like, so that an
   implementation in any language can run them? Experience from protocols
   that frame JSON over stdio with `Content-Length` headers (such as the
   Language Server Protocol) is especially welcome.

5. **Open.** Looking at the whole packet, what are we not asking that we
   should? How would you stage it: what belongs in a carrier contract valid
   for every revision now, what waits for protocol revision 2, and what should
   be left to implementations?

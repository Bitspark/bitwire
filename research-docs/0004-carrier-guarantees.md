# Research: What a carrier guarantees when it refuses, closes and frames

**ID:** 0004
**Date:** 27 September 2026
**Status:** advised
**Run-ID:** run_0433aa85-2cb9-4776-aeb8-18070e987502
**Document-ID:** doc_90198353-fd44-4d82-9e19-1eb08ee241de
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

Five decisions are open; we call them D1 to D5. Each is currently answered
only by what one implementation happens to do:

- **D1. Refusal and publication.** When a send is refused synchronously, does that
  prove the message was never published, meaning it never became visible
  beyond the sender? What evidence may justify a retry, and how is
  "we cannot know" represented?
- **D2. When a message becomes immutable.** At what moment does the carrier own a
  message, so that what was validated is what is sent?
- **D3. Closing.** Abrupt close versus graceful drain. What happens to queued
  refusals and to requests admitted but not yet answered? And should one
  overflowing queue end the whole connection?
- **D4. Errors and close codes.** One classification for "this carrier is
  closed" that keeps its cause. Which close codes may be sent and which may
  only be observed. The code the receiver sends versus the code the sender
  observes, which differ on some transports.
- **D5. The framed byte stream `bitwire-stream/1`.** Its exact framing, limits,
  end-of-input, truncation, write-failure and close-race rules, fixed from a
  specification rather than inferred from a runtime.

**The hard constraint.** The network protocol revision `bitwire/1` is
immutable. It was drawn from one released program, Nightseam v0.6.0, but
what binds is its normative text: a scope document plus the upstream specification text it
adopts, "as written", with no implementation's behavior taking precedence.
- A rule that changes what that scope binds (a frame, a close code, a default
  bound) needs a new protocol revision. Revision 2 has no date: it waits on a
  separate design of how received context travels.
- Where that text leaves a choice open, for instance which code a stalled
  connection closes with, our reading is that a separate carrier contract may
  require one of the permitted behaviors of the carriers that claim it, without
  changing what `bitwire/1` conformance means. Decision 0008 also says "A
  revision is never tightened in place", and we are not sure our reading
  respects that. We ask about it below.
- Rules about what happens in process are the carrier contract's alone.
- The byte-stream format `bitwire-stream/1` is not yet published, so D5 is
  free until it is.

**What we need back:** for each decision, a recommendation we can write as
contract text and test cases. We also need a view of which parts belong in
the carrier contract (valid for every transport and revision), which belong
in a future protocol revision, and which belong elsewhere. D4 and D5 block an
implementation that is waiting (the byte-stream transports). The others can be
staged.

**Scale:**
- One implementation exists, in Go and TypeScript: bitruntime.
- Four consumers wait on answers:
  - bitruntime's byte-stream transports (stdio, TCP, Unix sockets) need D4
    and D5;
  - bitruntime's tunnel needs D4, including how an abort is signalled without
    sending 1006;
  - bitwire-svc, a relay that splices frames between two connections, needs
    to know what admission and closing mean (D1, D3). By decision it is not a
    carrier itself, so it consumes these guarantees at its own boundary;
  - a developer tool that runs child processes over stdio needs D5.
- One application, bitsystem3, already depends on today's behavior for D1. It
  retries a request that a closed local pair refused, and never one it
  admitted.
- Traffic is request/response and events between services and tools, with
  frames of at most 1 MiB. It is not a high-volume data plane.

## Terms

- **Message.** One unit a carrier moves. It has a **kind**:
  - a *request*, which expects a response;
  - an *event*, which expects nothing;
  - a *response*, which answers a request;
  - a *cancel*, which withdraws a request.

  A request also carries a **return capability**: a local object through which
  its response comes back to the requester. A **control** is a message owed to
  a request that was already admitted: its response, and a cancel for it.
- **Call and request being handled.** From one side's view, a *call* is an
  outgoing request that awaits its response, and a *request being handled* is
  an incoming one whose handler is running.
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
  for this send. bitruntime marks such a refusal with an error wrapper named
  `Unpublished`.
- **Queued refusal.** A refusal already decided, such as `busy`, whose notice
  is still queued for delivery to the caller's return capability.
- **Public error codes.** A response can carry an error with a string code.
  The ones this document uses:
  - `busy`, which has two meanings in `bitwire/1`. A receiver at its limit of
    requests being handled answers it on the network. A caller at its own limit
    of calls outstanding gets it locally, and no frame is sent.
  - `disconnected`: the connection ended before the answer came.
  - `method_not_found`: no handler for the path.
  - `internal`: a handler failed with an error that is not public.
- **Transport and seam.** A *transport* moves whole, ordered *frames* (byte
  strings, text or binary) between two places. Examples: a WebSocket
  connection, an in-memory pipe, and the planned framed byte stream. The *seam*
  is the public interface a transport implements.
- **Carrier.** Provides `AddressedWire` endpoints, over a transport or without
  one. It assigns request identifiers, matches responses and cancels to their
  requests, and creates each accepted request's *invocation*: the local record
  that tracks it until it is answered.
  - A **peer** is a carrier over a transport that speaks the network protocol.
  - A **local pair** is a carrier without one: two connected endpoints in the
    same process.
  - A peer's **root** is the endpoint through which its application sends and
    receives.
  - A **dispatcher** picks the handler for a request's path. *Capturing the
    route* means recording that choice in the invocation.
- **`bitwire/1`.** The network protocol's first revision, and immutable. Each
  frame is one JSON object, an *envelope*, whose `kind` member is one of the
  four message kinds. Its normative text is a *scope document* identified by a
  content hash. A *findings register* beside it records known defects held for
  a later revision. "The profile" is the older name for this protocol, and
  the name its upstream documents use.
- **Request serial.** A request's identifier carries a number that must
  strictly increase per connection and direction. A non-increasing one is a
  protocol violation.
- **Close code.** A number, with a reason text, that a connection ends under.
  The numbers are the WebSocket registry's on every transport:
  - 1000 normal;
  - 1001 going away;
  - 1002 protocol error;
  - 1003 unsupported data;
  - 1008 policy violation;
  - 1009 message too big;
  - 1011 internal error;
  - 4011, the protocol's own code for "the other side broke the protocol".

  RFC 6455 defines three codes that a WebSocket endpoint may only *observe* and
  must never send in a close frame: 1005 (no status received), 1006 (abnormal
  closure: the connection dropped without a close frame) and 1015 (TLS
  handshake failed). We call these **observe-only**. RFC 6455 also marks 1004
  as reserved, and bitruntime never sends it either.
- **Abort** ends a connection at once and sends nothing. **Close** sends a
  code and reason, then ends.
- **Bounds and pacing.** Bounds are the queue depths, the maximum frame size
  (1 MiB by default) and deadlines; `bitwire/1` fixes their defaults.
  *Pacing* means that when a queue is full, its sender waits for room up to
  one write deadline instead of failing at once.
- **Tunnel.** An optional layer of `bitwire/1` that multiplexes *channels* over
  one connection with credit-based flow control. Its control messages are
  ordinary events named `channel.open`, `channel.close` and so on.
- **Received context.** Runtime-established facts that arrive with a message,
  such as its trace or the authority it was sent under. How they travel is a
  separate design, out of scope here.
- **Conformance cases and vectors.** A *case* is an expected observation
  written from the specification, never recorded from an implementation. A
  *vector* is an exact byte sequence with its expected verdict, for a codec or
  a framing.
- **Bitspark** is the organization that owns the repositories named here.

## Context

### Who is who

- **bitwire** is a contract repository. It publishes the interface
  declarations in eight languages, the `bitwire/1` protocol bundle, and
  independent conformance cases. It ships no production implementation. By
  accepted decision, bitwire *specifies* carriers and the byte-stream framing,
  and bitruntime *implements* them.
- **Nightseam** was the original runtime. It is discontinued. `bitwire/1` is by
  definition its release v0.6.0's network behavior, frozen.
- **bitruntime** is the Go and TypeScript implementation: carriers,
  transports, the protocol engine and the dispatcher. It was ported from
  Nightseam v0.6.0 and interoperates with it byte for byte.
- The consumers waiting on this decision are listed under "Scale" above.

### The interfaces bitwire declares

The Go binding, `wire/go/wire.go` (the other seven language bindings say the
same). An endpoint's paths are relative to its *origin*, the point in the path
namespace it stands for.

```go
// Message preserves a frame, its local capability and associated received
// context through routing. [...] Keep the message's contents immutable after
// Send admits it; implementations may retain them.
type Message struct {
	Frame  ProfileFrame   // the envelope: version (1), kind, id, params/result/error/data,
	                      // trace, meta; no method or event member, the path supplies it
	Return *ReturnAddress // the return capability; never sent over the network
}

// Receiver receives complete deliveries relative to its endpoint's origin,
// and an ending.
type Code int // a close code

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

`ProfileError`, the public error data a response can carry (its TypeScript
counterpart is `PublicError`), says of itself: "Its fields do not prove that a
failed send was never published. That local evidence [...] belongs to the
admitting runtime." So the contract today names publication evidence but
assigns it to no one.

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

### The layers of a peer

From the application down, in bitruntime (the queue names are used below):

```text
application code
   │  Send(path, message)            returns: admitted, or refused
   ▼
root Endpoint ──► root queue (128)   a Send with no error means "in this queue"
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
an earlier consultation (our research 0001): D1, D2 and D3.

A later clarification of 0007 says that the rule "1006 is never transmitted"
applies from the carrier contract onward. It does not apply retroactively to
`bitwire/1`, which transmits 1006 on a tunnel abort.

**Decision 0008** gives every protocol revision its own identity and makes it
immutable: "A change to what a peer sends, accepts or refuses, to close codes,
or to default bounds is a new revision."

**Decision 0009** set what a transport must provide, and the outline of the
byte-stream framing:

> A transport must move
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
addressless `Wire` is a separate contract.

### What `bitwire/1` already binds

These come from the revision's scope document and the upstream profile text it
adopts. Quotation marks mark verbatim text; the rest is a close paraphrase.
None can change without a new revision.

- "A frame larger than the receiver's limit is refused before delivery. The
  receiver ends the connection with **1009**. What the sending side observes
  when that close is lost to the transport's teardown is the transport's."
- A malformed or binary frame ends the connection with **4011**.
- "A caller at its limit of outstanding calls refuses the next call without
  sending a frame."
- **Default bounds:** 128 outgoing frames; 128 events waiting for their
  handlers; 128 calls outstanding; 64 requests being handled; frames of at
  most 1 MiB; a 30-second call deadline; a 10-second write deadline; a
  30-second dial handshake.
- **Pacing** applies to a sender waiting for output capacity, to a physical
  carrier write and to an inbound event consumer: each waits up to one write
  deadline, and a consumer that has not drained by then is disconnected.
- **The root's queue is not paced:** "Structured `Wire.Send` instead admits to
  its bounded queue or refuses immediately [...] A full Wire queue ends that
  carrier." (`Wire` here is the root endpoint, not the addressless `Wire`.)
  Each outstanding request reserves room for its cancel, so a full queue can
  never block a cancel.
- **The queue order** of accepted data and control frames, and the two
  meanings of `busy`.
- **Sending completes on acceptance:** "sending one completes when the frame
  was accepted for sending". What happens to an accepted frame whose write
  later fails is not stated; see "How the implementations behave today".

**The tunnel's abort.** `bitwire/1` requires that "an aborting side sends
`channel.close` with code **1006** and an empty reason, and ends the channel
at once", and that "a receiver treats a `channel.close` carrying 1006 as an
abnormal end of the channel". Its channel limits are 1009 for an oversized
inner frame, 1002 for a frame beyond the credit window and 1001 when the outer
connection closes. Transmitting 1006 contradicts decision 0007's rule. The
revision's findings register holds this for revision 2.

**Which rules touch the network.** In what follows, a rule about what a side
*sends* or *accepts* on a connection (a close code, a frame, a bound) can only
fit `bitwire/1` as it is, or wait for revision 2. A rule about what happens
*in process* (what `Send` returns, what an error proves, when a message is
copied, what a callback reports) is the carrier contract's alone, and valid
under every revision.

### The carrier specification draft

`docs/wire/carriers.md` is a draft. Nothing in it is adopted. It records D1
and D3 as still open, and does not mention D2. Beyond decision 0009 it proposes
these byte-stream details:

- **Header lines.**
  - Lines end with CR LF and come in a fixed order: `Frame:`, then `Code:`
    (close records only), then `Content-Length:`.
  - `Content-Length` is decimal, without leading zeros (an empty body is `0`),
    and at most 15 digits.
  - The header block, including its empty line, is at most 128 bytes.
- **Close records.** `Code: ` is followed by the close code in decimal, and
  "the code must be one that may be sent, never 1005, 1006 or 1015". The body
  is the reason: UTF-8, at most 123 bytes, which is the WebSocket bound.
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
- **Refusals.** "A receiver sends a close record with the given code and ends
  the stream":

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
- the `Code:` line's digit count and leading zeros, and whether a close
  record's body counts toward the receive limit;
- what `Close` does when its wait expires;
- what the sender of an over-limit frame observes;
- a write that fails partway through a record;
- the order of half-close against a concurrent send;
- D1 to D3.

### How the implementations behave today

bitruntime v0.3.0 (Go and TypeScript) is the only implementation. What
follows is what it does, read from its code and tests. None of it is contract
yet.

**The transport seam in Go** (`transports/go/transport.go`, abbreviated):

```go
type Kind int  // Text or Binary
type Frame struct {
	Kind Kind
	Data []byte
}
type Code int // a close code, the WebSocket registry's number

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

// ErrClosed is the one classification of a closed carrier: every endpoint
// and helper reports a closed or ended carrier as an error for which
// errors.Is(err, ErrClosed) holds, whatever layer noticed it.
// (errors.Is is Go's test that an error is, or wraps, a given error.)
var ErrClosed = errors.New("bitruntime: closed")

// CloseError is what Receive returns once the remote side closed: its code
// and reason. errors.Is(err, ErrClosed) holds for it.
type CloseError struct { Code Code; Reason string }
```

The seam does not say whether a `Send` that returned an error might still
have delivered its frame. It says nothing about draining queued frames on
`Close`, or about whether cancelling a `Receive` may damage the connection.
(On WebSocket it does damage it.) And although `Close` promises to wait "until
ctx ends", the Go WebSocket transport ignores the context and uses its
library's fixed bounds of 5 s to write the close frame and 5 s to await the
reply.

**The transport seam in TypeScript** (`transports/ts/src/index.ts`,
abbreviated). It is push-based and has no abort:

```ts
export type Frame = { kind: 'text'; data: string } | { kind: 'binary'; data: ArrayBuffer | Uint8Array };

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

**The behavior today, side by side.** Error names used here:
- `Unpublished` (Go) and `UnpublishedError` (TypeScript): bitruntime's marker
  for "not published";
- `ErrBackpressure`: a full queue;
- `PublicError`: an error carrying a public code, the in-process form of
  `ProfileError`.

| Question | Go | TypeScript |
| --- | --- | --- |
| **D1.** What does a synchronous refusal from `Send` prove? | The root and the pair wrap every synchronous error as `Unpublished`: nothing was queued. | The root and the pair throw unmarked errors. |
| What the call helpers infer | The helpers (library functions that send a request, or emit an event, through any `AddressedWire`) mark *any* synchronous error from *any* `AddressedWire` as unpublished, which the contract does not promise. | The same. |
| Refusals that arrive later | `busy` for the caller's own limit of calls outstanding, a duplicate id and `method_not_found` come back through the return capability after `Send` returned success, and carry no proof. | The same. |
| What does a successful `Send` mean? | "In the root queue". The engine then moves the frame to the output queue, where a full queue ends the carrier, and then to the transport. A failure at a later stage reaches a request's return capability, or is lost for an event. | The same. |
| A write that fails after acceptance | Ends the connection; the sender of that frame is not told. | The same. |
| **D2.** When does the carrier own the message? | The root, the pair and return capabilities copy the payloads at the start of `Send`, then validate the copy. The WebSocket transport does not copy, but writes synchronously. | The root and pair take a JSON snapshot at admission. The in-memory pipe does not copy: the receiver gets the same byte array, so a later mutation by the sender shows. |
| **D3.** Is there a graceful drain? | No. `Close` sends 1000 but abandons frames already accepted, including events whose send returned success. | No. Every ending drops the output queue and the inbound event queue. |
| Pending work when a carrier ends | Pending calls and requests still queued at the root are answered `disconnected`. Queued refusals are answered with their refusal (a fix of a Nightseam defect in which 3 to 56 of 512 refused callers waited out their own deadline). Running handlers are cancelled and their responses dropped. | The same for calls and queued requests. Running handlers are aborted and never answered. |
| A full queue | Ends the whole carrier, as `bitwire/1` requires. The peer aborts (the far side sees 1006); the pair ends with 4011. | Ends the whole carrier, sending 4011. |
| **D4.** One closed classification | `errors.Is(err, ErrClosed)` holds for errors raised at the carrier, and keeps the cause (`ErrBackpressure`, a remote `CloseError`, a context's end). | `PublicError('disconnected')` is the classification; errors raised at the peer or root keep their cause as a non-enumerable property. |
| A call cut off by the carrier's end | Answered by a response carrying `disconnected`: the caller gets only that public error, which loses the cause and does not match `ErrClosed`. | The same loss: the caller rebuilds a fresh `PublicError('disconnected')`. A remote close's code and reason are also discarded. |
| Close codes the engine sends | 1000 on close. 4011, with the decoder's error as reason, for a protocol violation, including a binary frame. (1003, unsupported data, would describe that better, but `bitwire/1` binds 4011: a revision-2 idea at most.) An operational failure (write failure, stall, overflow) is an abort, so the far side sees 1006 and cannot tell a stalled consumer from a dropped network. | 1000 on close. **Every internal failure sends 4011** with one fixed reason: malformed or oversized frames, write timeout, stalled consumer, full queue, socket error. |
| Close codes a side *can* send | Any sendable code. | Over the browser WebSocket API, which Node's built-in WebSocket follows, only 1000 and 3000–4999. For any other code the adapter closes without a code, and the far side sees 1005. So a TypeScript client cannot send 1008, 1009 or 1011 at all. |
| An application asks to close with an observe-only code | The engine checks and aborts instead (the transport would refuse the code too), so the far side sees 1006. | Turned into 1000 with an empty reason, so the far side sees a *normal* close. |
| What the receiver's `Closed` callback reports | Always `1001 "peer ended"` at a peer's root, whatever happened. The local pair passes the real code. | The same. |
| An over-limit frame | The WebSocket transport's limit is set to the peer's frame limit, so the transport ends the connection with 1009 before the engine sees the frame. Over the pipe the sender sees 1009; over WebSocket, 1009 or 1006, a race the test suite allows. Were the transport's limit higher, the engine would refuse with 4011. | No transport limit is set, so the engine refuses the frame and sends 4011. That **deviates from `bitwire/1`**, which binds 1009. 1009 appears only when a WebSocket server library's own limit trips first. The in-memory pipe has no limit. |
| **Tunnel** | Not ported. Nightseam v0.6.0 Go sends `channel.close` 1006 on abort, and sends any code unchecked. | Not ported. v0.6.0 TypeScript had no channel abort. |
| **D5.** Byte streams | Not built. | Not built. |

**Defects on record:**
- **A refusal racing an outgoing write** (Nightseam issue 456). A peer
  refused a request as a protocol violation (a non-increasing request serial,
  which ends the connection with 4011) while it was still writing the answer
  to the previous request. The test's raw WebSocket client intermittently
  observed 1006 instead of 4011. Two causes were named and never told apart:
  the peer's abort pre-empting its close frame, or the client library reporting
  closure before reading the frame already in flight. The test was reshaped to avoid the race.
  Nothing was fixed, and bitruntime has no test for it.
- **The sender of an over-limit frame** can observe 1006 instead of 1009 on
  a TCP WebSocket, because the socket teardown loses the close frame.
  `bitwire/1` already says what the sender observes "is the transport's".
- The race above bears on D3 and D4: must a refusal during a write still
  deliver its close code?

### Constraints

- **`bitwire/1` is immutable**, by the test stated under "The hard
  constraint" at the top.
- **The carrier contract binds every carrier**, including ones written
  outside Bitspark, and the in-process local pair. It must be testable from
  outside: expected observations, not implementation internals.
- **Language shapes differ.** Go's transport seam blocks and pulls;
  TypeScript's pushes and paces on a `buffered` count. The contract states
  what each promises so that conformance compares like with like. It must not
  force one language's concurrency model on the other.
- **Out of scope here:** the invocation lifecycle (how a running handler's
  body is retired, which has its own issue), authentication, application
  retries and received context. No protocol negotiation and no automatic
  replay.
- **Evidence must be independent.** bitwire writes expected observations from
  the specification. bitruntime's current behavior is input, not the answer.

### Advice already given on these questions

**Our research 0001** (an earlier consultation) recommended, for D1:

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

For D3 it recommended "graceful shutdown: refuse new requests and
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
  unrelated extensions" (such as the tunnel), with "reserved capacity for terminal responses,
  cancellation, channel credit and other necessary control messages". This
  conflicts with `bitwire/1`'s "A full Wire queue ends that carrier", so it would
  need revision 2.
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

**D1: refusal and publication.**
- **A. Any synchronous refusal from any `Send` proves non-publication.** This
  is an obligation on every implementation, composites included. Research
  0001 recommended it. It is simple for callers. But an opaque wrapper, such as
  a tee or a retrying guard, whose inner send succeeded and a later step
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
timed out, cancelled or disconnected).
- B departs from research 0001's recommendation (A) and follows bitsystem3's
  carrier research, because A cannot be enforced on arbitrary wrappers.
- B keeps bitsystem3's retry valid: bitruntime's root and pair already mark
  every synchronous refusal. Only the TypeScript call helpers' inference from
  a bare throw would have to go.
- One open sub-question: the caller's own limit of calls outstanding
  (`busy`, which "sends nothing"). Today it is answered later without proof.
  Should it become a synchronous marked refusal? That would change no frame.

**D2: when a message becomes immutable.** This is two questions, one per
layer.
- **At the endpoint (`Send`):**
  - *Copy, then validate.* The carrier copies (or snapshots) the payload at
    the start of `Send` and validates the copy; the caller may reuse its
    buffers once `Send` returns. This is bitruntime's endpoint behavior today.
  - *Zero-copy.* The caller keeps the message unchanged from the start of
    `Send` onward, and the carrier may retain it. Today's contract text says
    "immutable after Send admits it", which leaves the window *during* `Send`
    uncovered.
- **At the transport seam (`send(frame)`):**
  - the seam owns a frame's bytes from `send`, so that the TypeScript pipe's
    aliasing becomes a defect;
  - or the caller keeps them unchanged until the transport has taken them.

We lean to copy-then-validate at the endpoint, and to the seam owning the
bytes. We would like to know whether copying at every layer is the usual
price.

**D3: closing.**
- **A. Abort only (today).** Every admitted or queued request is answered
  exactly once and promptly, with its refusal or `disconnected`. Admitted
  events and owed responses may be lost.
- **B. `Close` drains what is queued; `Abort` stays immediate.** `Close` stops
  admitting new work, writes everything already in its output queue (admitted
  events, responses its handlers already produced, cancels) up to a deadline,
  then sends its close code. It does *not* wait for responses to its own
  outstanding calls, which are answered `disconnected`, nor for handlers
  still running (their retirement is the separate lifecycle design).
- **C. B plus a "going away" phase.** The peer tells the other side that it
  will admit no new requests but will finish those in flight, like HTTP/2's
  GOAWAY. That needs a new frame, so revision 2.

We lean to **B** for the carrier contract, and C for revision 2. We are
unsure how much a drain can promise when the far side is itself slow. We
think the contract should state plainly that admitted events may be lost on
`Abort`, and on `Close` when its deadline passes.

**D3′: root overflow**, a separate sub-decision. `bitwire/1` binds "A full
Wire queue ends that carrier" (the root's queue). Ending only the root, with
reserved room for control messages, needs protocol support, so it waits for
revision 2. We would keep revision 1's rule and record root-only termination
as a revision-2 candidate.

**D4: errors and close codes.**
- **Sendable set.** 1000–1003, 1007–1014 and 3000–4999 are sendable. 1005,
  1006 and 1015 are observe-only, as RFC 6455 defines them. 1004 and every
  other code are unassigned or reserved, and never sent either.
- **An application asks to close with an observe-only code.** Today Go aborts
  (the far side sees 1006) and TypeScript closes with 1000 (the far side sees a
  normal close). We lean to refusing the request with an error to the caller,
  and sending nothing. A caller that wants to end without a code calls
  `Abort`, so that no layer silently turns one request into another.
- **Which code an operational failure sends.** Protocol violations are 4011
  in both languages, as `bitwire/1` binds. Operational failures (a write that
  timed out, a stalled consumer, a full queue) are an abort in Go and 4011 in
  TypeScript.
  - `bitwire/1` does not fix this code. Its scope lists the registry codes,
    binds 4011 for protocol violations and 1009 for an over-limit frame, and
    says a consumer that has not drained within one write deadline is
    disconnected, but not with which code. bitruntime's two languages, each
    ported from its Nightseam v0.6.0 counterpart, differ here.
  - So, by our reading under "The hard constraint", the carrier contract
    could require one code now. None of the candidates below is a code either
    Nightseam v0.6.0 language sent for these failures.
  - A TypeScript client over the browser WebSocket API can send only 1000 and
    3000–4999, so 1011 and 1008 are out of its reach; a code in 4000–4999 is
    not.
  - **We lean to** an abort when the connection's own write path failed
    (nothing more can be written), and a sent code when the side fails but can
    still write, such as on a full queue, so that the far side can tell
    overload from a dropped network. For that code, 1011 (internal error)
    describes it best, but the browser limit above suggests a code of our own
    in 4000–4999 beside 4011.
- **Receiver versus sender.** Our proposal is that the contract promises the
  code a side *sends*. What the other side *observes* is promised only per
  transport:
  - exact on the in-memory pipe;
  - on WebSocket, the sent code, or 1006 when the close frame was lost to the
    socket teardown;
  - on the byte stream, as D5 settles.

  Tests then assert the sender's action exactly, and the far side's
  observation against that per-transport rule. The race of Nightseam issue 456
  (a refusal during an outgoing write) is then a question of the sender's
  action: must it finish or abandon the write and still send 4011?
- **One closed classification.** One error kind, with the cause kept and the
  resource that closed (root, pair, channel, connection) as detail. A call
  cut off by its carrier's end reports that kind, not only a public error
  code. A receiver's `Closed` callback reports the code the connection really
  ended under, not a constant.
- **The tunnel before revision 2.** `bitwire/1` requires a tunnel abort to
  *send* `channel.close` 1006, which the carrier contract forbids. We intend
  that a tunnel speaking revision 1 keeps revision 1's behavior, as a recorded
  exception, and that revision 2 gives the abort a form of its own, with the
  receiver reporting 1006 locally.

**D5: `bitwire-stream/1`.** The format is not yet published, so none of this
is bound. Within decision 0009's outline, these are the gaps to close, with
our tentative answers:

| Situation | Tentative rule |
| --- | --- |
| End of input inside a header block or a body | Observed as 1006: the stream was dropped. The partial record is not delivered. |
| A write fails partway through a record | The stream cannot be resynchronized, so the writer aborts: it writes nothing more and ends the stream. The far side observes the truncation as above. |
| `Code:` line | Four decimal digits naming a sendable code. A close record with an observe-only, reserved or unassigned code is refused with 1002. |
| A close record's body | Counts toward the receive limit like any body; its 123-byte bound applies first. |
| A frame over the receiver's limit | The receiver sends a close record with 1009, reads and discards input until the sender's close record or end of input (bounded by its close deadline), then ends the stream. The sender therefore finishes its write and reads 1009, rather than meeting a reset. |
| `Close` | Drains as D3 decides, sends its close record, then waits for the reply up to a close deadline. If the wait expires, the side aborts and observes 1006 itself. |
| Both sides send close records at once | Each receives the other's record, sends no reply because it has already sent one, and ends its write direction. Each delivers the code it *received*. |
| A frame to send after a side's own close record | Refused locally as closed, never written, and marked unpublished (D1). |
| Header names in another letter case, or bare LF line ends | Refused with 1002; the grammar is exact. |
| A child process on stdio | Writes only records to stdout and diagnostics to stderr. The child's exit is end of input. |

### Where each proposal would live

| Proposal | Layer | Status |
| --- | --- | --- |
| D1: what a refusal proves; the three-valued outcome | In process | Carrier contract, valid now |
| D1: the caller's own limit as a marked synchronous refusal | In process (no frame) | Carrier contract, valid now |
| D2: copy-then-validate; the seam owns frame bytes | In process | Carrier contract, valid now |
| D3 B: a draining `Close`; exactly one answer per admitted request | Wire, within what `bitwire/1` leaves open | Carrier contract now, if our reading of decision 0008 holds; otherwise revision 2 |
| D3 C: a going-away phase | Wire, new frame | Revision 2 |
| D3′: root-only overflow with reserved control room | Wire | Revision 2 |
| D4: sendable set; refusing an observe-only close request | Seam and in process | Carrier contract, valid now |
| D4: abort versus a sent code for operational failures | Wire, within what `bitwire/1` leaves open | Carrier contract now, if our reading of decision 0008 holds; otherwise revision 2 |
| D4: one closed classification; `Closed` reports the real code | In process | Carrier contract, valid now |
| D4: a tunnel abort without sending 1006 | Wire | Revision 2; revision 1 keeps 1006 as a recorded exception |
| D5: every `bitwire-stream/1` rule | A transport format | Free until published, then immutable under decision 0008 |

Two things we do not ask about now:
- **Order** is settled by the draft: within one direction of one connection.
- **Byte budgets.** Bounds today count frames: 128 frames of up to 1 MiB each
  allow 128 MiB per queue. Budgets in bytes, per connection and in aggregate,
  are planned with the runtime's engine design.

We intend to declare the transport seam, its close codes and the closed
classification in bitwire's eight language bindings, so that a carrier written
outside bitruntime implements a bitwire interface. Question 5 invites a view
on that.

## Questions for the Expert

For each answer, please say where it belongs:
- the carrier contract, valid under `bitwire/1` as it is;
- a later protocol revision;
- or implementations and applications.

Questions 3 and 4 block an implementation that is waiting. For those we most
need rules we can write down as contract text and byte vectors.

1. **What a send's outcome promises** (D1, D2). How would you define what `Send`
   promises at its boundary, so that the promise composes through wrappers,
   forwarders and carriers and can never be forged? It has two halves:
   - **What a refusal proves.** We lean to an explicit marker for one attempt
     at one boundary, and a three-valued outcome: unpublished, answered or
     unknown. That includes a caller at its own limit of calls outstanding,
     which sends nothing.
   - **When the carrier owns the message.** We lean to copy-then-validate at
     the endpoint, and to the transport seam owning a frame's bytes.

   Which patterns from comparable systems fit a small in-process-plus-network
   layer, and which traps have you seen? Examples we know of are HTTP/2's
   `REFUSED_STREAM` and `GOAWAY`, gRPC's transparent retry, and message
   brokers' publisher confirms. Is copying at every layer the usual price?

2. **Closing** (D3). What should a carrier owe work it has admitted when it
   closes: admitted events, owed responses, queued requests, cancels in
   flight? We lean to a `Close` that drains up to a deadline, beside an
   immediate `Abort`. We would leave a GOAWAY-like phase, and ending only the
   overflowing root, for revision 2. How would you bound a drain when the far
   side is slow, and what should the contract state plainly as possibly lost?

3. **Close codes and the closed classification** (D4; blocks the byte-stream
   transports). How would you structure the codes a carrier sends, and one
   "closed" error kind that keeps its cause and the resource that closed? We
   need decisive answers on two points:
   - which code an operational failure sends (a stalled consumer, a write that
     timed out, a full queue), given that `bitwire/1` uses 4011 for the other
     side breaking the protocol;
   - what a layer does when asked to close with an observe-only code.

   We lean to asserting the sent code exactly, and the far side's observation
   against a per-transport rule. How would you shape those assertions without
   weakening them to "either"?

4. **The framed byte stream** (D5; blocks the byte-stream transports). How
   would you complete `bitwire-stream/1`, within decision 0009's outline, so that it can be written as contract text
   and portable byte vectors? Please confirm, amend or replace each tentative
   rule in the gap table, and name what is still missing. What shape should
   the vectors take so that a harness in any language can run them?
   Experience with `Content-Length`-framed JSON over stdio, such as the
   Language Server Protocol, is especially welcome.

5. **Open.** Looking at the whole packet, what are we not asking that we
   should? What would you do differently if you were designing this carrier
   contract? One layering question in particular: a carrier contract that
   requires, of the carriers claiming it, one of the behaviors `bitwire/1`
   permits. Is that a separate layer, or does it tighten the revision in place,
   which decision 0008 forbids?

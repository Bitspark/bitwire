# Carriers and transports

**Status:** [decision 0013](../decisions/0013-carrier-contract-layering-and-adoption.md)
adopts, on 27 September 2026:
- the carrier contract's close codes and closed classification
  ([below](#adopted-close-codes-and-the-closed-classification));
- the framed byte stream [`bitwire-stream/1`](#the-framed-byte-stream-bitwire-stream1).

The contract's publication evidence, message ownership and closing
([D1–D3](#next-publication-ownership-and-closing)) are the next adoption step.
Until then those sections are a draft. The adopted text follows
[research 0004](../../research-docs/0004-carrier-guarantees.md), an outside
consultation, and elaborates decisions
[0007](../decisions/0007-using-bitwire-never-requires-nightseam.md),
[0008](../decisions/0008-a-protocol-revision-has-its-own-identity.md) and
[0009](../decisions/0009-carriers-bitwire-provides-and-byte-stream-framing.md).
Under [decision 0010](../decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md),
bitwire specifies carriers and bitruntime implements them.

**The carrier contract is a separate claim.** Under decision 0013 it may constrain
the carriers that claim it to behavior a protocol revision permits, and it
changes no revision. [`bitwire/1`](../../protocol/bitwire-1/SCOPE.md) keeps
Nightseam v0.6.0 behavior, including a tunnel abort sent as `channel.close` with
1006 (finding F2).
- A claim names what it covers: "`bitwire/1`", or "`bitwire/1` and carrier
  contract, edition 1".
- **Edition 1** is the adopted part: the close codes and closed classification,
  and, for a carrier over a byte stream, `bitwire-stream/1`.
- D1–D3 will make a later edition.

`bitwire-stream/1` is frozen when it is published as an immutable bundle, as
`bitwire/1` was. Until then, what implementing it exposes can still be
corrected in place; after it, any change is a new format name.

Under [decision 0012](../decisions/0012-explicit-data-and-wire-trees.md), carriers
retain `AddressedWire`/`Endpoint` semantics. The addressless `Wire` and the full
byte-keyed `WireTree` are separate contracts. This document does not make an
opaque carrier a complete tree, or change its path encoding.

## Transport and carrier

- A **transport** moves frames between two places. It knows nothing of requests,
  ids or return capabilities.
- A **carrier** provides AddressedWire endpoints. It mints request ids, correlates
  responses and cancels, gives each received request a return capability, and
  creates each accepted request's invocation.

A **protocol engine** is a carrier over a transport. The **in-process pair** is a
carrier with no transport: it passes structured messages without serializing
them. WebSocket is a transport; the engine running over a WebSocket is a carrier.

## What a transport provides

Every transport provides one interface, taken from Nightseam's
[`duplex.Conn`](https://github.com/Bitspark/nightseam/blob/dfacbb2783598c55d5ba78273e6ee8d11ebd9cee/duplex/go/duplex.go):

- **Whole frames.** A frame is text or binary, and arrives whole or not at all.
- **Order.** In each direction, frames arrive in the order they were sent.
- **Reliability.** While the transport is open, no frame is lost, duplicated or
  altered.
- **Both directions**, usable concurrently.
- **Backpressure.** Sending waits while the transport cannot take more. No buffer
  grows without bound.
- **A receive limit.** A frame over the receiver's limit is not delivered, and
  the connection ends with 1009.
- **Explicit closing.**
  - `Close` sends a code and a reason that the other side sees. It waits for an
    acknowledgement where the transport has one.
  - `Abort` ends the connection at once and sends nothing.
  - Codes are the WebSocket registry's numbers on every transport.
  - Some codes are only ever observed. 1006 is what a side sees when the other
    aborted or the transport dropped.

The protocol above depends on these properties. Request serials must increase
within a direction, and each request is answered exactly once. A transport that
loses, duplicates or reorders frames breaks correlation.

## Carrier groups

Carriers are grouped by what their transport lacks, because that decides what
has to be added.

| Group | Examples | What must be added | The project provides (bitruntime) |
| --- | --- | --- | --- |
| Framed, duplex and reliable | WebSocket; WebRTC data channels in reliable, ordered mode; browser message ports (iframes, workers), Node worker threads, Electron IPC; Windows named pipes in message mode | At most a close convention. Data channels and message ports carry no close code or reason, and message ports have no backpressure. | WebSocket (step 3). Others may implement the interface. |
| Reliable byte streams | stdio of a child process; TCP; TLS; Unix domain sockets; named pipes in byte mode; SSH channels; QUIC, HTTP/2 and WebTransport streams | Framing and a close record: [`bitwire-stream/1`](#the-framed-byte-stream-bitwire-stream1) | The framed stream, with stdio, TCP and Unix sockets (step 3). The same framing serves the others. |
| Built from carriers | Tunnels (many channels over one connection); forwarders; relays such as bitwire-svc | Nothing at the transport | Forwarding (step 2) and tunnels (step 7) |
| No persistent connection | HTTP request/response, long polling, server-sent events; message brokers such as NATS, MQTT 5, AMQP, Redis Streams and Kafka | A session and delivery contract: sequencing, resumption, deduplication, and a meaning for acceptance without a connection | Nothing for now |
| Unreliable | UDP; unreliable WebRTC; QUIC and WebTransport datagrams; BLE; LoRa | A reliability layer, which is what QUIC provides | Excluded |
| In-process | The in-process pair; later, a WebAssembly host–guest boundary or shared-memory rings | Nothing. Without serialization, return-capability identity and context pass directly. | The in-process pair (step 2) |

Notes on the groups:

- **Serial lines and Bluetooth RFCOMM** are byte streams, but not reliable ones.
  They can use the framed stream only beneath a checksum-and-retransmission
  layer.
- **Native multiplexing.** QUIC, HTTP/2 and SSH carry many streams natively. A
  tunnel over them can map its channels onto those streams instead of
  reimplementing flow control.
- **Relays splice frames below the AddressedWire.** bitwire-svc passes opaque frames
  between two outbound connections. It is part of a transport path, not an AddressedWire
  forwarder, and it preserves no end-to-end authentication.
- **Brokers fit return capabilities well**, because NATS reply inboxes and MQTT 5
  response topics are return addresses. What they lack is a connection:
  - acceptance means a broker's acknowledgment;
  - there is no close;
  - at-least-once delivery produces duplicates, which the serial rule treats as
    a protocol violation.

  They need a contract of their own before bitwire supports any.
- **A durable log is not a carrier.** Return capabilities and live scopes cannot
  be replayed from stored envelopes. Recording and following an AddressedWire is a
  composition over one, not a way to carry it.

## The carrier contract

Every carrier, whether bitwire's or not, preserves:
- messages, and their order within a stated scope. For a carrier over a
  transport, the scope is one direction of one connection.
- the identity of the original return capability within a process;
- across a process boundary, the mapping of return capabilities and context. A
  received request gets a fresh return capability, and replies to it reach the
  original caller.
- the invocation of each accepted request, created at acceptance with
  [decision 0003](../decisions/0003-public-invocation-lifecycle.md)'s state
  machine.

A rule belongs to the contract by its observable effect, not by where its code
lives (decision 0013).

### Adopted: close codes and the closed classification

**Three questions for a close code.** They are separate, and each has its own
answer:
- **Is the number valid in an encoded close?** The valid set is frozen at
  1000–1003, 1007–1014 and 3000–4999. A later change to the WebSocket registry
  does not change it.
  - 1005, 1006 and 1015 are *observe-only*: they describe what a side observed,
    and are never sent.
  - 1004 and every other number are reserved or unassigned, and never sent
    either.
  - Valid does not mean assigned. 4000–4999 is for private use.
- **Can this adapter emit it?** An adapter declares the valid codes it cannot
  send. The browser WebSocket API, for one, sends only 1000 and 3000–4999 and has
  no abort. An adapter that lacks a capability a claim needs does not make that
  claim; it does not remap codes to hide the gap.
- **Does the protocol permit it for this condition?** The protocol revision
  decides. See "Under `bitwire/1`" below.

Numeric validity does not override a transport's own rules. A WebSocket's
role-specific restrictions still apply.

**A close request** is validated before it changes any state:
- A code outside the valid set, or a reason that is not valid UTF-8 or is longer
  than 123 bytes, is an argument error. Nothing is sent, the connection stays as
  it was, and the reason is never truncated or repaired.
- A valid code that the adapter cannot emit is an unsupported-capability error,
  with the same effect. The adapter never substitutes another code, never omits
  the code, and never aborts instead.
- A repeated valid close joins the ending already under way. It neither changes
  its code and reason nor sends a second close.
- `Abort` is idempotent, and may interrupt a close in progress.

**One closed classification.** Every endpoint, operator and helper reports a
closed or ended carrier as one local error kind, whatever layer noticed it. The
error carries a **termination record**:

| Member | Holds |
| --- | --- |
| resource | What closed, by kind and identity: a root, a pair, a channel or a connection. A root's error names the root and keeps the connection's as its cause. |
| cause | The original local cause, such as backpressure, a remote close or a context's end. |
| local close | The code and reason this side selected, if any, and how far its close was written: not started, partial or complete. |
| peer close | The first complete, valid close the other side sent, if any. |
| observed code | What this side observed the connection end under. |
| drain complete | Whether the queued work covered by a drain reached the transport (D3). Until D3 is adopted, a carrier that does not track it reports it as unknown. |
| handshake complete | Whether both close records, or both close frames, were exchanged. |

- The record is local. It is never serialized into a `ProfileError`.
- The public projection of a closed carrier stays the code `disconnected`.
- A received public error named `disconnected` is never evidence that this
  side's carrier closed.
- A call that the carrier's end cuts off reports the local kind with its cause,
  through every call helper, not only the public projection.

**`Closed(code, reason)`**, a receiver's ending notification:
- On a network transport it reports the first valid peer close when one arrived.
  Otherwise it reports what the transport observed without one: 1006, or
  another observe-only code such as a WebSocket's 1015. The code this side
  selected stays available separately, in the termination record.
- A local pair reports its logical ending directly.
- A `Closed` notification is final for its attachment: no message is delivered
  after it.

**Under `bitwire/1`.** The revision binds 4011 for a protocol violation and 1009
for an over-limit frame, and a carrier claiming this contract keeps both. Such a
carrier also follows these rules:
- When its own write path has failed, or a partly written record cannot be
  completed safely, it aborts and sends nothing more.
- For other operational failures, such as overload, a stalled consumer or a
  full root queue, it prefers an abort. It stops using 4011 as a catch-all for
  them. The revision permits other codes here, so a peer that sends 4011 is not
  made nonconforming to `bitwire/1`.
- A dedicated operational-failure code waits for a later protocol revision, or
  for another explicitly versioned claim like this contract.

**The revision-1 tunnel.** `bitwire/1` requires an aborting side to send
`channel.close` with 1006. That contradicts the rule that 1006 is never sent. A
carrier claiming this contract over the revision-1 tunnel states this
compatibility exception in its claim, and claims the unqualified rule only once
revision 2 gives a channel abort a form of its own, with the receiver reporting
1006 locally.

### Next: publication, ownership and closing

These are drafts. [Decision 0013](../decisions/0013-carrier-contract-layering-and-adoption.md)
adopts them as a named additional claim once the documented deviations of current
implementations are fixed. Their direction, from research 0004:
- **D1, publication.**
  - A successful send reports admission at its boundary, never completion.
  - An error alone never proves that nothing was published.
  - Evidence of non-publication names one attempt at one declared boundary. It
    is never inferred from a public code, a timeout, a disconnection, a
    cancellation, a nested error or the timing of an error, and never relabeled
    from an inner boundary to an outer one.
  - Callers see three outcomes: unpublished, answered or unknown. Two facts
    underlie them: completion, and a certificate of non-publication.
- **D2, ownership.** The caller keeps its inputs stable while `Send` runs. Before
  admission the carrier owns a stable representation and validates it, and later
  mutation never changes what it emits. The same holds at the transport seam. No
  copy is required at every layer.
- **D3, closing.** A queued-work drain:
  - An admission barrier stops new locally initiated work.
  - A writer seal ends the outgoing stream.
  - Everything admitted before the barrier is flushed, wherever it waits, within
    one absolute close deadline.
  - Each registered call settles exactly once, locally.
  - Handlers still running are not awaited.
  - Revision 1's rule that a full root queue ends its carrier stays.

### Still open

These are to be specified, beside step 5's engine hooks:
- **Language-neutral milestones.** Admission, ownership, writable progress,
  flush, peer close and final termination. Each binding then gives them an
  idiomatic API. A blocking Go send and an immediate TypeScript send both report
  admission, and neither implies a physical write. A zero `buffered` count
  needs a stated local meaning, and is never a peer's acknowledgement.
- **The seam's remaining questions.** They are:
  - operation concurrency;
  - receive cancellation beyond the byte stream;
  - callback serialization;
  - buffer lifetime;
  - ownership of the underlying resources.
- **Identity facts.** Each transport has its own source of identity: TLS client
  certificates, SSH keys, Unix peer credentials, a child process's parentage for
  stdio, a browser's origin. The hook design decides how these facts reach the
  engine's context and then received-context evidence.
- **Byte budgets.** Today's bounds count frames and multiply by a frame limit.
  The contract should bound bytes, per connection and in aggregate.

## The framed byte stream, `bitwire-stream/1`

`bitwire-stream/1` turns any reliable, ordered byte stream into a transport: a
child process's stdin and stdout, a TCP connection or a Unix domain socket. It is
a transport format, independent of the protocol above it. The name identifies
this format, and peers agree on it out of band. It is frozen on publication
(see the status above).

### Records

In each direction, the stream is a sequence of records. Each record is a header
block followed by a body, with no delimiter after the body: the next record
begins at the next byte. The header block is exactly one of these byte
sequences. Quoted text is case-sensitive ASCII, `CRLF` is the two bytes 0D 0A,
and `SP` is one space:

```text
text   = "Frame:" SP "text" CRLF "Content-Length:" SP length CRLF CRLF
binary = "Frame:" SP "binary" CRLF "Content-Length:" SP length CRLF CRLF
close  = "Frame:" SP "close" CRLF "Code:" SP code CRLF "Content-Length:" SP length CRLF CRLF

length = "0" / (nonzero-digit 0*14digit)     ; decimal, no leading zero, at most 15 digits
code   = 4digit                              ; four decimal digits
```

After the header block come exactly `length` bytes of body.
- **The grammar is exact.** A header block does not match it when it has:
  - another header, a repeated or reordered one, or an unknown frame kind;
  - other letter case, a tab, an extra space, or a bare LF;
  - a byte order mark or any other bytes before the first record.

  Nothing is normalized, and there is no recovery mode.
- **When a header block is decided.** No valid header block is longer than 61
  bytes.
  - A receiver refuses a header block as soon as the bytes read cannot begin a
    valid one, and at the latest once it has read the block's first empty line,
    128 bytes, or the end of input.
  - It checks a close code against the valid set, and a length against its
    limit, only once the whole block has matched. A grammar error outranks both.
  - It checks a close reason once the body is complete.
- **Text and binary bodies.** Such a body is one frame of that kind. The framer
  keeps the body's bytes and its kind, and neither decodes nor validates text.
  The protocol binding does that: under `bitwire/1`, an invalid envelope (text
  that is not valid UTF-8, or a binary frame) ends the connection with 4011. A
  binding that turns a text body into a string never repairs malformed bytes,
  for example with replacement characters.
- **Close bodies.** A close body is the reason: valid UTF-8, at most 123 bytes,
  the WebSocket bound. It has its own fixed 123-byte limit, separate from the
  data limit, so a small data limit never prevents a meaningful close.
- **Parsing a length.** The receiver compares a parsed `length` with the limit
  that applies before it narrows the length to a machine integer, and before it
  allocates any body storage.

A request of `bitwire/1`, with each CR LF shown as `\r\n` (the line breaks after
them are only for reading):

```text
Frame: text\r\n
Content-Length: 71\r\n
\r\n
{"version":1,"kind":"request","id":"c:1","method":"4:echo","params":{}}
```

A close with code 1000 and the reason `done`:

```text
Frame: close\r\n
Code: 1000\r\n
Content-Length: 4\r\n
\r\n
done
```

### Reading

- **Splitting.** Records arrive split across reads, or several to a read. The
  parser keeps its state and buffered bytes across reads. Bytes that arrive
  together with end of input are processed before the end.
- **End of input between records** without a close record is observed as 1006.
  The side sends no close record.
- **End of input inside a record.** The bytes read decide:
  - A prefix of a valid header block, or a complete header block within its
    limit and part of its body, is a truncation. Nothing of the partial record is delivered, no
    close record is sent, 1006 is observed, and the termination record notes the
    truncation.
  - Anything else is refused with 1002.
- **After a close.** Once the first valid close record has arrived, no further
  data is delivered and no second reply is sent. Trailing bytes are discarded
  and never replace the recorded ending.
- **Cancelling a wait.** Cancelling a wait to receive keeps the parser's state
  and buffered bytes. It is not an abort.

### Writing

- **Whole records.** A sender writes each record whole, one at a time and in
  order. Concurrent sends are serialized, so records never interleave. "Whole"
  means without interleaving, not in one system call: a short write is resumed.
- **Backpressure.** A send waits while the stream cannot take more. That is the
  byte stream's own flow control, such as a pipe buffer or a TCP window. The
  format adds no acknowledgements or credit.
- **Cancellation.**
  - A send cancelled before any of its bytes were handed over, with no deferred
    write remaining, is unpublished.
  - A send cancelled after part of its record was written leaves the stream
    unaligned, so the side aborts.
- **Write failure.** An unrecoverable write failure after bytes were handed over
  may have published them, including when the API reports no trustworthy byte
  count. The side aborts and writes nothing more, not even a close record. The
  other side may observe a truncation.
- **Independent progress.** Input and output progress independently, so a
  sender blocked in a send can still receive the other side's close.

### Closing

- **`Close(code, reason)`** is validated first (see "A close request"). It then
  seals the writer; once D3 is adopted, the seal follows the queued-work drain.
  No data record is accepted after the seal, and a send refused there is
  unpublished. The side writes its close record after any record already being
  written, and never inside one.
- **The reply.** A side that receives a close record starts no further data
  record. It finishes one already being written if its close deadline allows,
  and aborts otherwise. Then it replies with a close
  record carrying the same code and an **empty reason**, unless it has already
  sent or committed its own. It delivers the received code and reason to its
  receiver, and reports queued output it abandoned as an incomplete drain.
- **Simultaneous closes.** When both sides send close records at once, each
  receives the other's, sends no reply, and reports the code it *received*.
- **Half-close.** Once its close record is fully written, a side ends its write
  direction: it closes a child's stdin, or shuts down a TCP connection's write
  side. It keeps reading for the reply.
- **One deadline.** An absolute close deadline covers the whole close: the drain
  (once D3 is adopted), the record being written, the close record, the wait for
  the reply, and disposal. Progress does not restart it. When it passes, the
  close fails and the side aborts. It reports 1006 only if no valid close record
  arrived; a received code is never overwritten with 1006.
- **Abort** writes nothing more and ends the stream at once.

### Refusals

A receiver refuses what it cannot take by sending a close record with an empty
reason. It delivers nothing more, and ends the stream as described below:

| What it receives | Code |
| --- | --- |
| A header block that does not match the grammar, including bytes before the first record such as a banner a child printed to stdout | 1002 |
| A close record whose code is not a valid close code, whose `length` exceeds 123, or whose reason is not valid UTF-8 | 1002 |
| A text or binary record whose `length` exceeds the receive limit | 1009 |

**An over-limit record** is refused from its header alone:
1. The receiver parses the complete header block, finds the declared body over
   its limit, stops delivering data, and selects 1009 without waiting for any
   body byte.
2. It sends its close record through its one writer, after any record already
   being written.
3. It may keep reading the stream's input for a bounded time. That improves the
   chance that the sender reads the close, and lets the sender's reply arrive.
   - It discards exactly the declared body before reading another header block,
     which may be the reply.
   - It never searches a body for bytes that look like a close record, and never
     allocates or decodes the refused body.
4. It stops at its close deadline or its discard budget, whichever comes first,
   then ends the stream.

A sender may therefore observe 1009, or 1006 when the close record was lost to
the stream's teardown. The receiver's 1009 is what the format requires.

After a 1002 refusal the side reads no further records:
- After a malformed header block, record alignment is lost. A later close record
  cannot be found by scanning, and discarding bytes cannot complete a close
  handshake.
- A refused close record was already the peer's close.

It ends the stream once its close record is written, after bounded discarding if
it chooses.

### stdio

- **Stdout is for records.** A child process writes nothing to stdout except
  records, and sends its diagnostics to stderr. A banner is refused (1002).
- **Reading to the end.** The parent reads stdout through to the pipe's end of
  input, and processes every buffered record first.
- **Exit is not a close.** A child's exit status, even zero, is not a protocol
  close, and an exit notification never discards buffered records. The end of
  stdout without a close record is observed as 1006, after every record before
  it is processed.
- **Ownership.** The stdio transport binding owns the descriptors. Starting,
  supervising and reaping the child lie outside the carrier contract. Closing
  the framed connection does not prove that the process exited.

### Configuration

The receive limit, the close deadline, the discard budget and any time allowed
to assemble a header block or a record are explicit configuration of a binding. Each
implementation states its defaults. None of them is a library's hidden default.

### Why this shape

[Decision 0009](../decisions/0009-carriers-bitwire-provides-and-byte-stream-framing.md)
compares it with newline-delimited JSON and a binary length prefix:
- It carries binary frames, which newline framing cannot.
- It states a frame's size before the frame, so the receive limit is enforced
  without buffering.
- Its headers stay readable in a log or a terminal.

It takes the Language Server Protocol's precedent for ASCII headers and a byte
count, but its headers, frame kinds and close handshake are its own, so it is
not compatible with it.

## Conformance

`bitwire-stream/1` is held to portable vectors at two levels:
- **Framing vectors.** Each vector gives:
  - the input as hexadecimal bytes, the receive limit and any end of input;
  - the frames the receiver must deliver, and the close it must request (code,
    and an empty reason).

  A harness runs each vector as one read, one byte at a time, and split at
  every point into two reads. Vectors assert what a side does, never what the
  far side observes.
- **Session scenarios.** These cover what a byte sequence alone cannot state:
  partial writes, blocked directions, deadlines, simultaneous closes and
  transport failures.

The vectors cover:
- each kind of record, including an empty body;
- split and coalesced reads, and bytes that arrive with end of input;
- zero and boundary lengths, the 15-digit bound, and the limit enforced from the
  header alone;
- each refusal with its code: each kind of grammar deviation, invalid close
  codes and reasons, a banner and a byte order mark;
- truncation inside a header block and inside a body, and end of input between
  records;
- the close reply with an empty reason, and data after a close.

The framing vectors are published under
[`conformance/stream`](../../conformance/stream/README.md). The session
scenarios, and API-boundary scenarios for the close codes and closed
classification, are not written yet. Conformance keeps separate suites:
- the envelope codec;
- the carrier and API boundary;
- stream framing;
- each transport binding.

A binary record is thus valid framing, and still an invalid `bitwire/1`
envelope.

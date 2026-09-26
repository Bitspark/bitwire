# Carriers and transports

**Status:** draft specification, 25 September 2026. It elaborates decisions
[0007](../decisions/0007-using-bitwire-never-requires-nightseam.md),
[0008](../decisions/0008-a-protocol-revision-has-its-own-identity.md) and
[0009](../decisions/0009-carriers-bitwire-provides-and-byte-stream-framing.md).
Under [decision 0010](../decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md),
Bitwire specifies carriers and bitruntime implements them. Nothing here is
implemented yet; the work is tracked in [#39](https://github.com/Bitspark/bitwire/issues/39).

Under [decision 0012](../decisions/0012-explicit-data-and-wire-trees.md), carriers
retain `AddressedWire`/`Endpoint` semantics. The new addressless `Wire` and full
byte-keyed `WireTree` are separate contracts; this draft does not make an opaque
carrier a complete tree or change its path encoding.

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
  between two outbound connections. It is part of a transport path, not a AddressedWire
  forwarder, and it preserves no end-to-end authentication.
- **Brokers fit return capabilities well**, because NATS reply inboxes and MQTT 5
  response topics are return addresses. What they lack is a connection:
  - acceptance means a broker's acknowledgment;
  - there is no close;
  - at-least-once delivery produces duplicates, which the serial rule treats as
    a protocol violation.

  They need a contract of their own before Bitwire supports any.
- **A durable log is not a carrier.** Return capabilities and live scopes cannot
  be replayed from stored envelopes. Recording and following a AddressedWire is a
  composition over one, not a way to carry it.

## The carrier contract (draft)

Every carrier, whether Bitwire's or not, preserves:

- messages, and their order within a stated scope; for a carrier over a
  transport, the scope is one direction of one connection;
- the identity of the original return capability within a process;
- across a process boundary, the mapping of return capabilities and context: a
  received request gets a fresh return capability, and replies to it reach the
  original caller;
- the invocation of each accepted request, created at acceptance with
  [decision 0003](../decisions/0003-public-invocation-lifecycle.md)'s state
  machine;
- the meaning of acceptance at its boundary. Accepted means admitted for
  delivery, never evidence of completion. What a synchronous refusal proves is
  research decision 4, still open.
- the meaning of closing: which accepted work is still answered, and how. This
  is research decision 6, still open.
- one classification of closed errors, so that a closed carrier reads the same
  whichever layer reports it;
- the split between close codes that may be sent and codes that may only be
  observed. 1005, 1006 and 1015 are never sent.

The following are still to be specified, together with step 5's engine hooks:

- **Identity facts.** Each transport has its own source of identity: TLS client
  certificates, SSH keys, Unix peer credentials, a child process's parentage for
  stdio, a browser's origin. The hook design decides how these facts reach the
  engine's context and then received-context evidence.
- **Byte budgets.** Today's bounds count frames and multiply by a frame limit.
  The contract should bound bytes, per connection and in aggregate.
- **Per-language promises.** Go's interface blocks and pulls; TypeScript's pushes
  and paces itself by a `buffered` count. The contract states what each
  promises, so that conformance compares like with like.

## The framed byte stream, `bitwire-stream/1`

`bitwire-stream/1` turns any reliable, ordered byte stream into a transport. It
is a transport format, independent of the protocol above it. It follows decision
0008's rule: the name identifies an immutable format, and peers agree on it out
of band.

### Records

In each direction, the stream is a sequence of records. A record is a header
block, an empty line and a body. The header block is ASCII, and every line ends
with CR LF. It has exactly these lines, in this order and spelling:

1. `Frame: text`, `Frame: binary` or `Frame: close`;
2. for a close only, `Code: ` followed by the close code in decimal;
3. `Content-Length: ` followed by the body's length in bytes: decimal, without
   leading zeros (an empty body is `0`), at most 15 digits;
4. an empty line.

The body is exactly `Content-Length` bytes. The header block, including its
empty line, is at most 128 bytes.

- A **text** or **binary** body is one frame of that kind. The format does not
  validate text; the protocol above does, and the profile ends a connection with
  4011 on malformed text.
- A **close** body is the reason: UTF-8, at most 123 bytes. That is the WebSocket
  bound, so a reason means the same on every transport. The code must be one that
  may be sent, never 1005, 1006 or 1015.

A request of the protocol above, with each CR LF shown as `\r\n` (the line breaks
after them are only for reading):

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

### Closing

- **Close.** A side sends one close record and nothing after it. A side that
  receives a close record replies with its own close record carrying the same
  code, as a WebSocket does, unless it has already sent one. It delivers the code
  and reason to its receiver. `Close` waits for that reply, or for the end of
  input, until its context ends. After both records, each side ends its write
  direction and then the stream: it closes a child's stdin, or shuts down a TCP
  connection's write side.
- **Abort** sends nothing and ends the stream at once.
- **End of input without a close record**, from an abort or a dropped stream, is
  observed as 1006.
- Anything received after a close record is discarded.

### Refusals

A receiver sends a close record with the given code and ends the stream when it
receives:

| What it receives | Code |
| --- | --- |
| A header block that does not match the grammar, is longer than 128 bytes, or names an unknown frame kind | 1002 |
| A `Content-Length` over its receive limit. This is checked before any of the body is read. | 1009 |
| A close record with an observe-only code, or with a reason longer than 123 bytes | 1002 |
| Bytes before the first record that are not a header block, such as a banner printed to stdout | 1002 |

The last row matters for stdio. A child process writes nothing to stdout except
records, and sends its diagnostics to stderr.

### Backpressure and order

A sender writes each record whole, one at a time and in order. Concurrent sends
are serialized, so records never interleave. A send waits while the stream
cannot take more. That is the byte stream's own flow control, such as a pipe
buffer or a TCP window. The format adds no acknowledgments or credit.

### Why this shape

[Decision 0009](../decisions/0009-carriers-bitwire-provides-and-byte-stream-framing.md)
compares it with newline-delimited JSON and a binary length prefix.

- It carries binary frames, which newline framing cannot.
- It states a frame's size before the frame, so the receive limit is enforced
  without buffering.
- Its headers stay readable in a log or a terminal.

It resembles the Language Server Protocol's base protocol, but the headers
differ, so it is not compatible with it.

## Conformance

Implementations of the framed stream will be held to portable vectors, byte for
byte:

- each kind of record, including an empty body;
- a record split across many reads, and several records arriving in one read;
- each refusal above, with its close code;
- the receive limit enforced before the body is read;
- the close reply, a close from both sides at once, and end of input observed as
  1006;
- a banner before the first record.

Every transport also passes the transport interface's own suite, as Nightseam's
transports do today.

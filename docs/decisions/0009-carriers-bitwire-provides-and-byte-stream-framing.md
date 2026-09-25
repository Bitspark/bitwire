# 0009: Which carriers Bitwire provides, and how byte streams carry frames

**Status:** accepted, 2026-09-25, on the user's decision. Elaborates steps 2, 3
and 7 of [decision 0007](0007-using-bitwire-never-requires-nightseam.md). The
draft [carrier specification](../wire/carriers.md) holds the details. Nothing is
implemented yet.

## Question

Decision 0007 makes Bitwire the home of carriers, and WebSocket is one of them.
Three questions follow:

- What else can carry Wire access?
- Which of those carriers does Bitwire provide?
- How does a byte stream such as stdio or TCP carry frames?

[nightseam#663](https://github.com/Bitspark/nightseam/issues/663) asked the last
question for stdio and recommended newline-delimited JSON.

## Decision

**Carriers are grouped by what their transport lacks.** A transport must move
whole, ordered frames reliably in both directions, with backpressure, a receive
limit and an explicit close. Each group states what has to be added to reach
that, and what Bitwire provides:

| Group | Bitwire provides |
| --- | --- |
| Framed, duplex and reliable: WebSocket, WebRTC data channels, message ports, named pipes in message mode | WebSocket. Others implement the public transport interface. |
| Reliable byte streams: stdio, TCP, TLS, Unix sockets, SSH channels, QUIC streams | One framing, `bitwire-stream/1`, with stdio, TCP and Unix sockets |
| Built from carriers: tunnels, forwarders, relays | Forwarding and tunnels |
| No persistent connection: HTTP request/response, message brokers | Nothing until a consumer needs it. Then a separate session and delivery contract. |
| Unreliable: UDP, datagrams | Excluded. Use QUIC instead. |
| In-process | The in-process pair |

Two things are deliberately not carriers:

- **A durable log.** Return capabilities and live scopes cannot be replayed from
  stored envelopes.
- **A frame-splicing relay such as bitwire-svc.** It works below the Wire and
  preserves no end-to-end authentication.

**Byte streams carry frames as `Content-Length` records.** A record has three
parts:

1. a short ASCII header block: `Frame: text`, `binary` or `close`; then `Code:`
   for a close; then `Content-Length:`;
2. an empty line;
3. exactly that many bytes of body.

Closing works as follows:

- A close record carries its code, with the reason as its body.
- The other side replies with a close record of its own.
- End of input without a close record is observed as 1006.
- 1005, 1006 and 1015 are never sent.

The receive limit is checked against `Content-Length` before any of the body is
read. The format is named `bitwire-stream/1`. Under decision 0008's rule, it
never changes in place.

## Alternatives

| Option | For | Against |
| --- | --- | --- |
| **Newline-delimited JSON** (#663's recommendation; MCP's stdio transport) | Readable, and the protocol's frames are JSON already | Cannot carry binary frames, which the transport interface carries. A close needs a reserved line that could collide with a frame. The size is known only after reading the whole line. |
| **Binary length prefix** | Compact, binary-safe, cheapest to bound | Unreadable in logs and terminals. Its width and byte order must be fixed. |
| **`Content-Length` records** (chosen) | Binary-safe. The size is known before the body. Readable headers. A close record with code and reason. | A few bytes of header per frame, and a small header parser |
| **Leave it to consumers** | Nothing to specify | Every tool invents its own framing, and two tools that host each other disagree (the cost #663 names) |

## Why

- **Binary frames.** The transport interface carries them, so a framing that
  cannot is only a partial transport.
- **Size before the body.** Nightseam's transport interface says
  [a limit that could be exceeded first is not a limit](https://github.com/Bitspark/nightseam/blob/dfacbb2783598c55d5ba78273e6ee8d11ebd9cee/duplex/go/duplex.go).
  The receiver has to know a frame's size before reading it.
- **Readability.** stdio in particular is often read by a person debugging a
  tool.
- **Clear promises.** Grouping by what a transport lacks tells an implementer
  what to build, and tells Bitwire what not to promise. Connectionless and
  unreliable transports break the protocol's serial and exactly-once rules.

## Consequences

- Step 3 implements `bitwire-stream/1` in Go and TypeScript, with stdio, TCP and
  Unix sockets, held to portable vectors.
- Bitwire's format answers nightseam#663, instead of Nightseam choosing a format
  of its own.
- Message ports and WebRTC data channels need a close convention when someone
  implements them.
- Supporting a broker or HTTP request/response later needs its own decision and
  contract.

## Not decided here

- Package names and coordinates.
- Close conventions for message ports and data channels.
- A session and delivery contract for connectionless carriers.
- The carrier contract's open items: identity facts, byte budgets and
  per-language promises. These are designed with step 5's engine hooks.

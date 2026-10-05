# Carrier and addressed message formats

**Current:** [decision 0015](../decisions/0015-addressless-wires-and-addressed-access.md).
There is one addressless carrier format and one addressed representation layered
above it. No JSON, legacy selection, autodetection or fallback decoder exists.

## Addressless carrier

One message is one complete ground ontos value, encoded with `ontos-codec-v1`.
No envelope is required around it. Reject noncanonical varints, unknown tags,
truncation, trailing bytes and configured size/depth violations. Validate cost
before allocating output; count every occurrence of shared immutable values.
Bound decoder allocation by input length before honoring tuple length claims.

WebSocket negotiates exactly `bitwire.ontos.v2`; one binary message carries one
complete encoded Value. WebSocket supplies fragmentation. Text, malformed bytes,
over-limit input and wrong/missing negotiation fail the connection. Reference
compression is disabled. The old `bitwire.ontos.v1` envelope protocol is not
negotiated. An old envelope-shaped tuple sent as data under v2 is just opaque data,
not an implicitly supported old protocol.

Normal TLS verification applies. Establishment has a finite timeout separate from
service execution. An attached server owns accepted endpoints and its upgrade
handler, leaving a supplied HTTP/HTTPS server open. A convenience listener owns
its server. Establishment policy may authenticate peers; payload fields do not.

Close ends admission, drops queues and initiates shutdown. Reference carriers
allow five seconds for the handshake before forcing release. Terminal observation
follows actual release. A later socket-write failure cannot turn an earlier local
admission into proof that the peer received nothing.

## Addressed representation

The reusable addressed layer sends this ordinary Value through an Endpoint:

```text
Tuple(Atom(UTF8("bitwire/addressed/1")), Tuple(path atoms), message value)
```

The version is exact ASCII. Arity is exactly three, the path is a tuple of atoms,
and the final field is any ground Value. No source, identifier, correlation,
request/response kind or deadline is implied. Reject other constructors, versions
or field counts at the addressed decoder. Packing and unpacking preserve exact
paths and messages; path capture prevents later array edits from changing a send.

This representation is independent of WebSocket and can be nested as opaque data.
Applying another addressed layer is explicit. The entire nested value, headers
included, counts against the carrier bounds. An addressed layer does not flatten
nested payloads or automatically follow an embedded path.

Local pairs and WebSocket endpoints expose the same raw message boundary. One
runtime facade implements addressed access for both. Stream framing for other
carriers and logical-wire allocation/multiplexing are separate contracts, not
implicit features of this format. Fixed independent bytes and behavioral cases
check both levels; no runtime implementation is the reference oracle.

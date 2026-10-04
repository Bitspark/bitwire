# Current envelope carrier format

**Decided for the clean replacement.** One format, without historical profile
negotiation. The logical boundary is [the generic wire](contract.md).

## Canonical bytes

Encode this six-element ontos tuple using `ontos-codec-v1`:

```text
Tuple(Atom(UTF8("bitwire/envelope/1")),
      Tuple(source atoms), Tuple(destination atoms), id atom,
      Tuple() | Tuple(correlation atom), payload value)
```

The version is exact ASCII bytes, not a registered text embedding. Paths are raw
tuples of atoms. Correlation has arity zero or one. Reject other field counts,
versions, header constructors or correlation arities. Payloads stay opaque;
unknown shapes are valid. Reject overlong/overflowing varints, unknown tags,
truncation and trailing bytes. No JSON or legacy fallback exists.
Check cost/depth before allocating outgoing bytes. Count every occurrence,
including repeated immutable values. Native limits do not change value identity.

## WebSocket

Negotiate exactly `bitwire.ontos.v1`. Each binary message carries one complete
canonical envelope. WebSocket handles fragmentation. Text, malformed bytes,
over-limit messages and missing/wrong negotiated protocol fail the connection.
Reference Node compression is disabled. No service names or RPC timers enter
this carrier. ws/wss dialing uses normal host TLS verification. Cancellation and
finite handshake timeout belong to establishment, not service execution.

A server may attach to caller-owned HTTP/HTTPS, owning only its upgrade handler
and accepted endpoints. A convenience listener owns its server and releases the
listening handle on shutdown. Establishment policy authenticates/authorizes peers;
source paths still do not authenticate an envelope's sender.

Close refuses admissions, drops queues and starts carrier shutdown. The reference
carrier allows at most five seconds for a closing handshake, then forces release.
Terminal observation follows actual release. Send callback failure terminates;
it cannot retroactively turn an admitted operation into one never admitted.

## Other carriers and checks

Local pairs use the same logical envelopes/limits; no API-to-API bridge is needed.
Canonical encoding supplies their cost accounting. Stream framing is outside
this release's delivered carriers. Fixed independently calculated envelope vectors
and pinned ontos vectors check byte interoperability. Runtime cases additionally
check negotiation, malformed traffic, detach/close, limits, native peers and
actual socket release.

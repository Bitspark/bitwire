# One generic envelope wire

**Decided, 4 October 2026.** The owner requested a clean replacement without
historical profiles, compatibility exports or redundant wire adapters. This
supersedes the active interface/protocol choices in 0001–0013. Published releases
remain immutable Git history, not supported profiles.

There is one duplex `Wire`: send envelopes, attach one receive handler, observe
termination and close. Envelopes have byte-segment source/destination paths,
opaque byte IDs, optional correlation IDs and ground ontos values. Requests and
replies are not wire kinds. Routing context is not authentication or authority.

Complete finite `DeixisNode<T>` structure is independent. An opaque router does
not claim a full tree. There is no separate addressed sending interface, local
return-address serialization, or wire-to-wire bridge needed by a consumer.
bitwire owns the contract and independent cases; bitruntime implements it.
Domain adapters own operation semantics. Carriers encode the same envelopes.

The one current binary format is `bitwire/envelope/1`, encoded with frozen
`ontos-codec-v1`. WebSocket negotiates `bitwire.ontos.v1`. Remove the previous
JSON/RPC format, with no autodetection or compatibility profile.

The pinned ontos consumer mirror is v0.9.0, commit
`5eed85de5697f53397407f9f82f3b310648827f7`. Its documented vendoring path permits
checked consumer mirrors with pins, vectors and drift checks. Include that
mirror so this consumer requires no private registry. Do not publish standalone
ontos packages or change their upstream visibility. TypeScript consumers share
one value implementation rather than bridging different nominal value classes.

The [contract](../wire/contract.md) and [carriers](../wire/carriers.md) define
admission, ownership, closure, limits, routing and observations before code.

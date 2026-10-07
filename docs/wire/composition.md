# Composing running instances and conveying wires

**Status, 7 October 2026:** documented target architecture and requirements for
future protocols. The released foundation is bitwire 0.5.0 and bitruntime 0.6.0.
Distributed mounts, multiplexing, live-wire export and stream framing are not
implemented by those releases. This document specifies their intended scope and
the decisions and observations required before implementation; it does not
publish a frame grammar or a new callable API. [Decision 0016](../decisions/0016-communication-composition.md)
records the authority, alternatives and relationship to existing contracts.

## Goal and vocabulary

Applications should be able to compose running communication instances into a
logical routing tree, route opaque messages between them, and convey usable
wires over established connections. The same machinery should work over local
pairs and conforming network carriers. Request/response and other service
conventions remain consumers of it.

A **runtime instance** here means an application-owned instance of bitruntime's
communication machinery: its connections, route bindings and bounded live state.
It need not be a separate process or daemon. A host executable configures and
operates it. Neither the routing topology nor the set of runtime instances is
automatically a complete discoverable tree.

The [released contract](contract.md) remains the foundation:

| Abstraction | Meaning |
| --- | --- |
| `Wire` | `send(Value)`; sending authority only. |
| `Endpoint` | Wire plus one detachable receive owner and connection closure. |
| `AddressedWire` | `send(Path, Value)` within a declared routing scope. |
| `AddressedEndpoint` | Addressed send/receive using the underlying endpoint's lifetime. |
| `WireNode` | Complete `DeixisNode<Wire>` structure, including every own value and child. |

Values are ground ontos values. A live object is not a Value. Paths are exact
byte atoms; readable labels below are notation, not a string-path interface.

## Owners and dependencies

The direction of authority is from a depended-on contract to its realizations.
A foundational repository does not assign responsibilities to its consumers by
describing them. References to consumer designs below identify their own source
and scope, not authority derived from deixis.

| Owner | Responsibility |
| --- | --- |
| deixis | Generic complete-tree structure, selection, reconstruction and their laws for opaque `T`. No connections, routing execution, clocks or service ownership. |
| bitwire | Interaction interfaces, protocol meaning and canonical formats, reusable codecs and independent conformance expectations. This includes defining the optional composition protocols before they are implemented. |
| bitruntime | Production endpoints and carriers; reusable routing/mount machinery, multiplexers and wire-export/import machinery once their contracts are specified. It owns the associated queues, registries, dispatch, resource accounting and release. |
| Application or executable host | Chooses topology, listeners, allowed attachments, identities, route admission and service placement; configures and owns runtime instances. |
| Service consumer | Operation meanings, typed adapters, invocation/result/cancellation conventions, and operation authorization. |

The separate [bitnode draft at `6f2e773`](https://github.com/Bitspark/bitnode/blob/6f2e77314a1e0ffd203b2079b11fdfc6a19a7c38/docs/DESIGN.md)
proposes such an executable host: tree membership, assigned locations and service
outlets. Its draft used the older envelope foundation. The intended division is
reusable communication mechanics in bitruntime, host policy and executable
composition in bitnode or another application. This document does not adopt that
draft's absolute-path profile or source/ID/correlation fields as generic wire law.

The [bitwire-svc design at `37ad781`](https://github.com/Bitspark/bitwire-svc/blob/37ad781cf63e51dfc0c1956282fda17c7f01510d/README.md)
separately proposes owner-managed, durable relay allocations and two outbound
attachments per live pairing. It is a planning document, not a running service.
Its persistence, allocation-management API and authorization belong to that
service. A connection-scoped multiplexer or export registry in bitruntime does
not require that service or a database. The service may use runtime machinery;
its durable allocation is not a live endpoint or a promise to restore one after
restart. This documentation does not revise that service's API or establish its
conformance to bitwire 0.5.0.

## Three distinct facilities

### Addressing and routing

Addressing supplies the destination path of an individual message. Routing
selects a destination and may invoke a selected Wire or explicitly forward to
another runtime. The current addressed facade packs/unpacks a path and Value;
it does not install routes, open connections or enumerate a remote subtree.

Current `asAddressed(WireNode)` selects an exact represented node and invokes its
own Wire once. Current `bind` and `under` grant sending only. They do not acquire
a receiver, allocate a logical connection, change the receiving root or confer
ownership of an underlying endpoint.

### Multiplexing

A multiplexer uses an owned carrying Endpoint to establish several logical
duplex connections. Each resulting local endpoint must obey the ordinary
Endpoint contract: ordered admissions and dispatch in each direction, one receive
owner, declared bounds and terminal resource release. The carrying endpoint has
one receive owner, the multiplexer, which dispatches its protocol internally.

Channel selection is a form of addressing. Multiplexing adds allocation,
acceptance/refusal, per-channel lifecycle and aggregate accounting. It should
first be designed using the existing addressed representation where suitable;
carrier independence is not a reason to invent another generic sending surface.
Whether channel selection uses paths or a separate field is not settled here.

Closing a logical endpoint should release that logical connection without
closing healthy siblings. Failure of the carrying connection terminates its
dependent logical endpoints. A complete protocol must distinguish child failures
from malformed control traffic or aggregate failures that end the carrier.
Sharing a carrier still shares its capacity and failure domain: logical
separation alone proves neither independent progress nor freedom from blocking.

### Exporting an existing Wire

The [hydrated wire proposal](hydrated.md) develops a shared upper interface whose
messages can contain wires recursively. It covers value traversal and collision-free
encoding as well as export/import, while leaving explicit protocol decisions open.
It is proposed design, not an addition to the released interface below.
[Decision 0019](../decisions/0019-hydrated-wire-protocol.md) proposes its first
edition: references valid end to end within one namespace, so the per-connection
sketch below applies to gateways between namespaces.

Creating a channel does not make an existing Wire available remotely. Export
associates that Wire with a scoped protocol reference. Import produces a local
Wire proxy; a send through it is carried to the exporting runtime and forwarded
to the registered Wire. Protocol references travel as ordinary ground Values.
The opted-in binding interprets them; raw carriers never guess that a value is a
capability or substitute live objects into the ontos domain.

```text
A holds Wire w
A exports w through a connection to B
B imports the reference as Wire wB
B calls wB.send(value)
A's export machinery forwards that value to w.send(value)
```

Exporting `Wire` conveys sending authority only. It does not convey receive
ownership or permission to close the original endpoint. Releasing an export
removes its forwarding association, not an unrelated owner's live resource.
Exporting an owned Endpoint, if needed, requires a separately explicit ownership
operation. Bidirectional endpoint joining is not a substitute for exporting a
send-only Wire.

Exports may use multiplexed channels or addressed reference routes. A duplex
channel per exported Wire is not a requirement. The protocol must specify
reference scope, validity, duplicates/aliasing, release races, stale-reference
rejection and re-export through another hop. Merely copying reference bytes to
another connection does not make them valid there. First define live,
connection-scoped exports; durable names, restoration and automatic reconnect
are separate consumer requirements, not hidden registry behavior.

## Composing runtime instances into a routing tree

A host can attach another runtime beneath a chosen byte prefix. For example,
runtime A delegates `[b]` to runtime B, and B delegates `[c]` to runtime C. A
message selecting `[b,c,service]` can cross both attachments and reach the
designated service. The resolver must declare whether it forwards an absolute
path in a shared namespace or delegates a suffix into a new root. These are
explicit profiles, not interchangeable interpretations of `Path`.

For every mount or forwarding boundary, specify:

- The routing root, matching rule, delegated suffix or absolute coordinates,
  and precedence between an own destination, local children and mounts.
- The authorized attachment, binding generation and allowed originating scope.
  Claimed paths cannot authenticate a sender. Replacing a connection must not
  let old callbacks remove or send into the replacement.
- Return routing and scope for any convention that expects replies. Forwarding
  a destination does not make opaque reply names valid in the next namespace.
- Absence, forwarding refusal, stale bindings, disconnect and loop/limit outcomes;
  no undeclared ancestor fallback or automatic retry of an uncertain operation.
- Ownership of receive attachments, links and listeners; finite routing state,
  queue and connection bounds; shutdown and failure propagation.

Pure deixis selection never crosses a remote mount or performs I/O. Remote route
access supplies no child enumeration. A complete `WireNode` may represent a
finite known view, but an opaque remote attachment cannot stand in for all
unknown children. Discovery or coherent snapshots require their own contract.
The logical routing tree also need not equal the physical transport graph.

Routing requests is possible because requests are messages. A router does not
need a mandatory RPC vocabulary. A service's request/response convention needs
an explicit return-route binding; routing alone does not supply correlation,
cancellation, retries or operation authorization. The existing exchange and
relay obligations in [decision 0015](../decisions/0015-addressless-wires-and-addressed-access.md#exchange-and-receive-scope)
apply when that work is introduced; their consumer triggers are unchanged.

## How addressing and multiplexing compose

The following expressions show interpretation order only, not frame syntax.

**Addressing inside a logical connection:**

```text
Multiplex(channel, Address(path, value))
```

The multiplexer delivers to the selected logical Endpoint; `addressed(endpoint)`
then supplies a namespace within it. Each logical connection may have its own
addressed receiver. Closing that endpoint affects its own addressed facade.
This composition follows directly once the logical Endpoint exists.

**A multiplexer at an addressed destination:**

```text
Address(pathToMultiplexer, Multiplex(channel, value))
```

An explicitly owned dispatcher routes incoming control/data to that multiplexer.
The binding must define the destination of outgoing traffic, the return route,
the receive attachment and the binding's closure behavior. It shares no second
concurrent receive owner with the raw endpoint. `bind(A,p)` alone is insufficient:
it grants only sending. The addressed multiplexer binding is still unspecified.

Neither composition is a mandatory stack, nor are the two equivalent merely
because their interfaces compose. Nested paths, channel identifiers and reply
scopes cannot be flattened or rebased implicitly. Their complete encoded
overhead counts toward the carrying endpoint's bounds. Any relay transparency
claim must state its observation boundary and assumptions; path concatenation
does not establish end-to-end delivery or progress.

## Carriers

Carriers implement raw addressless Endpoints. Addressing, multiplexing and
reference export must depend on that contract, not on WebSocket APIs. The
released runtime supplies local pairs and WebSocket in Go and TypeScript;
WebSocket is the current network implementation, not the only permitted carrier.

The [format document](carriers.md) defines ontos-codec-v1 messages and the
WebSocket binding. A stream carrier still needs a bitwire framing contract:
record delimiting, partial/coalesced reads, canonicality and size checks before
allocation, EOF/truncation, half-close policy, establishment and shutdown.
bitruntime would implement it over a declared byte-stream binding, initially
TCP/TLS, with pipes or Unix sockets possible consumers of the same framing.
These are proposed carriers, not existing exports. A carrier without the required
ordering and delivery behavior must establish those properties before it can
present the existing Endpoint contract.

## Admission, authority and resource bounds across layers

Every hop has its own local admission. A proxy or forwarding send may succeed
locally before a later target refuses. Later refusal cannot retroactively turn
that admission into a rejection or prove non-execution. A composition protocol
must specify observable later failures and termination; a remote-admission
acknowledgement, if useful, is a separate observation, not application completion.

Registries, pending opens/exports, control traffic and logical data queues need
finite limits. Both per-logical-connection and aggregate limits are necessary;
creating more channels must not bypass the host's resource budget. Specify
accounting, overflow behavior, scheduling/progress assumptions and how control
traffic needed for release can proceed under load. Do not claim unlimited
handler work is bounded merely because endpoint queues are bounded.

Connection failure invalidates dependent live references and ends the relevant
owned endpoints. No restoration, replay or transfer to a replacement participant
is implicit. Tests must distinguish each registration generation. Routing and
reference IDs designate; trusted connection context and explicit export/admission
policy determine authority. Services still check permission for their operations.

## Status and work sequence

| Facility | Evidence at the documented baseline | Next requirement |
| --- | --- | --- |
| Raw/local/WebSocket endpoints and addressed facade | Implemented in bitruntime 0.6.0 against bitwire 0.5.0. | Preserve their observations across additions. |
| Complete local trees and exact derived sending | Implemented; no remote discovery implied. | Keep mount execution separate. |
| Distributed routing/mounts | Direction and obligations only. | Specify binding, roots, reply mapping, failure and ownership, then implement reusable routing. |
| Multiplexing | Direction and requirements only. | Specify establishment, framing, lifecycle and budgets, then implement logical endpoints. |
| Export/import of existing wires | Direction and requirements only. | Specify scoped references, forwarding, authority and release, then implement proxies/registry. |
| Multiplexer at an addressed destination | Composition requirement only. | Define the bidirectional addressed binding. |
| Stream carriers | Proposed extension. | Specify stream framing, then implement and test a concrete binding. |
| Generic `Pages<Wire>` | Motivating consumer, not an API commitment. | Build only after wire conveyance has a usable contract. |

bitwire records each protocol's meaning and independent expected observations
before runtime implementation. Exact public APIs, frame tags, identifier grammar,
credit/queue policy and timeout policy remain to be decided in those records.
This architecture document must not be cited as if those details were settled.
bitruntime's [implementation plan](https://github.com/Bitspark/bitruntime/blob/main/docs/COMPOSITION.md)
tracks realization and evidence without becoming a second protocol definition.
Neither a new package release nor a deployed service is delivered by this record.

## Required acceptance observations

The protocol-specific corpus must include these observations, with declared
outcomes and independently chosen expected bytes before implementation:

1. The same upper-layer implementation works over local, WebSocket and a specified
   stream carrier; Go/TypeScript peers exercise both connection roles.
2. Several logical endpoints preserve per-direction order, exact messages and
   receive ownership. Child closure leaves siblings usable; carrier loss releases
   all dependents. Control/refusal/overflow cases exercise the declared limits.
3. Export an existing send-only Wire and invoke the intended target exactly once
   for each delivered protocol message; absence and target refusal stay distinct.
   Releasing the export cannot close the borrowed target or grant receive access.
4. Invalid/stale references, duplicate exports, release/send races and re-export
   obey their declared rules. Reconnect never revives a previous live generation.
5. A multi-process tree reaches a service through at least two boundaries and a
   cross-branch route. A declared reply convention returns to the original client.
   Binary, empty and slash-containing atoms survive; payloads stay opaque.
6. Missing mounts, disallowed attachments, cycles/limits, connection replacement
   and later-hop refusal never invoke a fallback target, silently replay work or
   misreport local admission as execution.
7. Both composition orders have their own namespace, ownership and failure cases.
   No test treats a send-only bound path as a duplex Endpoint.
8. Every added queue/table and owned transport is released under saturation and
   failure. Fresh packaged consumers run outside sibling checkouts.

Passing today's endpoint or structural suites establishes none of these missing
multi-hop, allocation or export observations. Their coverage must be reported
separately when delivered.

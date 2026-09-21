# Wire contract

This page specifies the shared access contract for Bitwire 0.2. The
[conformance work](../../conformance/README.md) records executable evidence
separately; declarations compiling does not establish behavioral conformance.
The 0.1 baseline was reviewed against Nightseam at
[`1c63f1c4`](https://github.com/Bitspark/nightseam/tree/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f).

## Surface and scope

| Operation | Go | TypeScript |
| --- | --- | --- |
| Send at a relative path | `Send(path []string, message Message) error` | `send(path: Path, message: Message): void` |
| Attach an Endpoint receiver | `Receive(receiver Receiver) (detach func(), err error)` | `receive(receiver: Receiver): () => void` |
| End an Endpoint | `Close(code Code, reason string) error` | `close(code?: number, reason?: string): void` |

`Wire` contains only Send. `Endpoint` extends Wire with Receive and Close.
Passing Wire access does not require receiver or closure authority. A runtime
requiring enforced attenuation exposes a send-only facade; a static type alone
does not hide extra operations on an underlying object. A return address holds
Wire access. The [decision](../decisions/0002-delivery-dispatch-and-ownership.md)
explains this separation and the breaking migration from 0.1.

The supporting declarations are in [Go](../../wire/go/wire.go) and
[TypeScript](../../wire/ts/src/index.ts). Other native presentations must preserve
the same observable behavior; native spelling, ownership and error mechanisms
need not be identical.

A Wire is access to an origin, not a serialized address. `Wire[A]` in a model
description means this access interpreted through contract `A`; the base
interface itself is type-erased. Bitwire 0.2 carries the four structured frame
kinds defined in the [profile boundary](profile.md). It is independent of the
carrier, runtime and generator, but is not an arbitrary-payload or
profile-polymorphic interface.

## Paths

A path is a sequence of opaque Unicode scalar strings. There is no separator
parsing, normalization or permission inheritance. `[]`, `[""]`, `["a/b"]` and
`["a", "b"]` are different paths. Canonically equivalent Unicode spellings remain
different sequences unless their scalar values are identical. A native string
type that compares after normalization must use an exact representation for
path keys.

Selecting access prepends its prefix to sent paths. A receiving view supplied by
a shared dispatcher removes the same prefix from delivered paths. Mounting
chooses a borrowed child using exactly one segment and removes it on delegation.
A receiving mount restores that segment when delivering a child's message. An
empty string is a valid child key. The mount has no destination at the empty
path. Receive capability requires the corresponding endpoint attachments;
send-only access alone cannot provide it.

Path validity does not promise a destination or admission by every profile.
The pinned Nightseam profile requires a nonempty request/event path at a peer
root. Selecting `[]` is nevertheless valid and preserves the root's behavior,
including that refusal. A nonempty selection can turn an empty relative suffix
into a nonempty root path.

## Sending and receiving

Send completes on admission or refusal; it does not await a response or execute
destination application code on the sender's stack. The endpoint implementation
owns asynchronous dispatch. Successful admission says nothing about completion
of an application effect. Bounds, request correlation and termination policy are
provided by the selected profile's implementation.

An Endpoint has at most one active receive attachment. A second attachment is
refused without replacing the first. Receive has no matching-path argument and
Receiver has no namespace flag. Its callback sees the destination path relative
to that endpoint's origin, with the complete Message. It is not a sender address,
return address or correlation identifier. Delivery is not implicit broadcast.

An attachment receives the endpoint's incoming application deliveries; internal
response correlation and cancellation handling remain the profile's responsibility.
Attaching to a closed endpoint is refused. Closing an endpoint ends its active
attachment and notifies its Closed callback, if present, at most once. A detached
receiver receives no later closure notification from that attachment.

A dispatcher may own that attachment and provide many routed receiving views or
handler registrations. Exact/prefix matching, precedence and duplicate-path rules
belong to its explicit policy, not to Wire or Endpoint. Sibling selected views
share that dispatcher; they cannot each attach an independent root receiver.
Overlapping views require a stated selection policy. The dispatcher can expose
Wire access and Endpoint views without exposing its routing table to callers.

The returned detach action is idempotent. It prevents new dispatch through that
attachment; a later attachment may be installed. Already admitted requests retain
the return and cancellation path
they captured. Detaching is distinct from closing an endpoint, cancelling an
admitted request or releasing a live binding.

Returning from a Message callback is not invocation completion. The primitive
provides no generic terminal-invocation signal. An invocation-aware dispatcher
therefore integrates explicitly with its profile runtime's admission, correlation
and terminal-state ledger. That owner retains a captured route/cancellation
association for an admitted invocation, keyed by return-capability identity and
request ID, until its profile-defined terminal state permits retirement. Detach
or rebind must not retarget that invocation to a new receiver. A pure router
cannot infer this lifetime from callback return or observe it by wrapping the
return capability; the latter would violate identity preservation. Bounds and
retirement belong to that explicit runtime integration, not an unbounded table
silently introduced by Wire selection. The reference composition experiment
checks retained replies; full cancellation/retirement acceptance remains with
the implementing profile.

Implementing Endpoint alone does not supply a particular runtime's invocation
lifecycle association. An invocation-aware dispatcher requires that explicit
profile integration, including when an endpoint is wrapped opaquely; it must
refuse an unmanaged invocation that cannot satisfy its advertised lifecycle
guarantees. It must not silently substitute current route lookup. Generic
addressed delivery and pure routing remain usable without that runtime-specific
invocation facility.

The integration distinguishes caller withdrawal, an early deadline response,
actual executing-body completion and retirement of already queued controls.
Reusing a return-identity/request-ID pair must not let an older control address
or delete the newer capture. Capture storage is bounded while requests remain
unfinished and reclaimed across arbitrarily many sequential completed requests;
a fixed timeout or weak map is not evidence of terminal retirement. See
[capture-retirement issue #20](https://github.com/Bitspark/bitwire/issues/20)
for the required runtime observations and their upstream ownership.

## Preservation laws

The following are obligations on compositions, not additional primitive methods
or claims that this package implements them. For valid paths and otherwise
equivalent dispatcher policies and attachments:

```text
at(w, [])                  ≃ w
at(at(w, a), b)             ≃ at(w, a ++ b)
at(mount({k: w}), [k])      ≃ w    (routing and message observations)
```

Equivalence means equal routing, delivered relative paths, frame meaning, local
capability identity and associated received context. It includes equivalent
admission or refusal and need not mean the same language object. The mount law
applies while the mount remains open and does not identify lifecycle ownership:
closing a mount releases its own attachments and leaves borrowed children usable.
Send-only selection has no Close. A selected Endpoint supplied by a dispatcher
owns its route, not the borrowed root's closure. An explicitly shared owning
endpoint capability can close that endpoint; it must be identified as such,
rather than inferred from equivalent send paths.

Selection and mounting create no new peer, channel, request correlation or
message queue, including on first use. A forwarder passes messages through the
existing endpoints and preserves their order, capabilities and context; it does
not inspect or convert references hidden in payloads. Detaching a forwarder
leaves its borrowed endpoints usable.

## Local capabilities and context

A local Message comprises a structured frame and optional local delivery
capability/context. A request's return capability supports its response;
correlation uses both that capability's identity and the request identifier.
Composition must retain capability identity, not construct a new wrapper merely
pointing to the same endpoint. Native bindings may represent stable identity by
a pointer, an object or another opaque identity token.

The receiving runtime may associate invocation context with that capability or
with an opaque local context field. An event can carry received context without
acquiring a callable reply, request identifier or response waiter. Go and
TypeScript need no public context member: the runtime's private association with
the local capability is sufficient. Another native presentation may expose an
opaque carrier for the same obligation.

Local selection, mounting, forwarding and pair dispatch preserve context already
established by the receiving runtime. They must not discard it by reconstructing
a message from its visible fields alone. A caller-supplied context field or
metadata map does not, by its presence, establish verified invocation context;
the runtime must recognize the evidence it created or validated. Bitwire does
not define an authentication system or a public constructor for trusted proof.

Frame payloads, local capability identity and any associated context must remain
stable after admission. A sender does not mutate admitted messages. An
implementation that snapshots data must preserve its meaning and any local
associations; plain structural copying is not always sufficient.

Only profile fields cross a physical hop. Local capability objects and received
context are never serialized. The next receiving runtime establishes its own
incoming context. Incoming metadata is not implicitly copied into reverse calls
or events. The [profile boundary](profile.md) identifies the remaining identity,
live-reference and publication obligations.

## Lifetime

A root Endpoint owns its closure. Wire access does not imply that ownership.
A dispatcher owns its root attachment and routes, not a borrowed root's closure.
A mount owns its attachments and routing, not its borrowed children. Closing a
mount detaches its attachments and notifies its receivers without closing those children.
Closing or detaching twice has no additional effect on ownership.

Closing an Endpoint is not release of a live binding. Scope nonces, checked reference
import, owner ledgers and release barriers belong to the live profile. A Wire
implementation claiming that profile must preserve them when presenting access
through this contract. Moving a type declaration does not transfer those runtime
responsibilities or establish consumer adoption.

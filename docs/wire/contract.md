# Wire contract

This page specifies the shared access contract for Bitwire 0.1. The
[conformance work](../../conformance/README.md) records executable evidence
separately; declarations compiling does not establish behavioral conformance.
The interface and these obligations were reviewed against Nightseam at
[`1c63f1c4`](https://github.com/Bitspark/nightseam/tree/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f).

## Surface and scope

| Operation | Go | TypeScript |
| --- | --- | --- |
| Send at a relative path | `Send(path []string, message Message) error` | `send(path: Path, message: Message): void` |
| Install a receiver | `Receive(path []string, receiver Receiver) (detach func(), err error)` | `receive(path: Path, receiver: Receiver): () => void` |
| End an endpoint | `Close(code Code, reason string) error` | `close(code?: number, reason?: string): void` |

The supporting declarations are in [Go](../../wire/go/wire.go) and
[TypeScript](../../wire/ts/src/index.ts). Other native presentations must preserve
the same observable behavior; native spelling, ownership and error mechanisms
need not be identical.

A Wire is access to an origin, not a serialized address. `Wire[A]` in a model
description means this access interpreted through contract `A`; the base
interface itself is type-erased. Bitwire 0.1 carries the four structured frame
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

Selecting an origin prepends its prefix to sent and registered paths, then
removes that prefix from delivered paths. Mounting chooses a borrowed child
using exactly one segment, removes it on delegation and restores it for delivery
to a receiver registered on the mount. An empty string is a valid child key.
The mount has no destination at the empty path; a namespace receiver at that
origin may register across its children.

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

Receivers select an exact path unless namespace matching is enabled. Exact
matches win; otherwise the longest matching segment prefix wins. Duplicate
registrations in the same matching mode are refused. Exact and namespace
registrations at one path may coexist. Callbacks see paths relative to the Wire
on which they registered, not relative to the registration's matching prefix.

The returned detach action is idempotent. It prevents new dispatch through that
registration; already admitted requests retain the return and cancellation path
they captured. Detaching is distinct from closing an endpoint, cancelling an
admitted request or releasing a live binding.

## Preservation laws

The following are obligations on compositions, not additional primitive methods
or claims that this package implements them. For valid paths and otherwise
equivalent registrations:

```text
at(w, [])                  ≃ w
at(at(w, a), b)             ≃ at(w, a ++ b)
at(mount({k: w}), [k])      ≃ w    (routing and message observations)
```

Equivalence means equal routing, delivered relative paths, frame meaning, local
capability identity and associated received context. It includes equivalent
admission or refusal and need not mean the same language object. The mount law
applies while the mount remains open and does not identify lifecycle ownership:
closing a mount leaves borrowed children usable. Closing a selected view closes
the endpoint it selects, including the mount when the selected origin is a mount.

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

A root owns its endpoint's closure; selected views share it. A mount owns its
registrations and routing, not its borrowed children. Closing a mount detaches
its registrations and notifies its receivers without closing those children.
Closing or detaching twice has no additional effect on ownership.

Closing a Wire is not release of a live binding. Scope nonces, checked reference
import, owner ledgers and release barriers belong to the live profile. A Wire
implementation claiming that profile must preserve them when presenting access
through this contract. Moving a type declaration does not transfer those runtime
responsibilities or establish consumer adoption.

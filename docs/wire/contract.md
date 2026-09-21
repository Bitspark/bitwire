# Wire contract

**Status: draft, seeded from Nightseam at
`5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515`.** The language declarations compile;
this repository has not yet executed the behavioral laws against a runtime.
The [integration plan](../integration.md) records the remaining work.

## Surface

| Operation | Go | TypeScript |
| --- | --- | --- |
| Send at a relative path | `Send(path []string, message Message) error` | `send(path: Path, message: Message): void` |
| Install a receiver | `Receive(path []string, receiver Receiver) (detach func(), err error)` | `receive(path: Path, receiver: Receiver): () => void` |
| End an endpoint | `Close(code Code, reason string) error` | `close(code?: number, reason?: string): void` |

The full supporting declarations are in [Go](../../wire/go/wire.go) and
[TypeScript](../../wire/ts/src/index.ts). A Wire is access to an origin, not a
serialized address. `Wire[A]` in a model description means this access interpreted
through contract `A`; the base interface itself is type-erased.

## Paths

A path is a sequence of opaque Unicode scalar strings. There is no separator
parsing, normalization or permission inheritance. `[]`, `[""]`, `["a/b"]` and
`["a", "b"]` are different paths. A selected view prepends its prefix. A mount
consumes exactly one segment to select a child; the empty string is a valid key.
The mount has no destination at the empty path.

The intended composition laws are:

```text
at(w, [])                  ≃ w
at(at(w, a), b)             ≃ at(w, a ++ b)
at(mount({k: w}), [k])      ≃ w    (routing and message observations)
```

The last equivalence is about access, not identical lifecycle ownership: closing
a mount detaches its routing and leaves borrowed children usable. Selecting or
mounting introduces no new peer, channel or message queue.

## Sending and receiving

Send completes on admission or refusal. Go reports refusal as an error;
TypeScript throws. Send does not await a response or run destination application
code on the sender's stack. The endpoint implementation owns asynchronous
dispatch, bounds, correlation and termination as required by the chosen profile.

Receivers select an exact path unless `Namespace` / `namespace` is enabled.
Exact matches win, otherwise the longest matching segment prefix wins. Receiver
callbacks see paths relative to the Wire on which they registered. Duplicate
registrations are refused. Detachment is idempotent and prevents new dispatch;
already admitted requests retain their captured return and cancellation path.

## Messages and return access

The initial Message contains a profile frame and an optional local return
capability. Composition preserves frame content and the identity of that
capability. The return capability is never serialized into a network envelope.
The [profile boundary](profile.md) says which additional agreements make generated
operations interoperable.

## Lifetime and context

A selected view shares its endpoint's closure. A mount owns its registrations
and routing, not its borrowed children. Detaching forwarding leaves both borrowed
endpoints usable. Closing a Wire is not the release of a live binding.

Scope nonces, checked reference import, owner ledgers, release barriers and
verified invocation context must survive a conforming presentation. Moving an
interface cannot erase these obligations. Their current machinery remains in
Nightseam. The first extraction must specify which guarantees are in the common
contract and which remain explicit profile obligations, with cases for both.

The scaffold provides no implementation of selection, mounting, forwarding,
dispatch, identity exchange or live-reference conversion.

# 0002: Separate addressed delivery, dispatch and endpoint ownership

**Native names and structural claim superseded:** [decision 0012](0012-explicit-data-and-wire-trees.md)
reclaims `Wire` for addressless sending and names the full structure `WireTree`.
The addressed interface below is now `AddressedWire`; its carrier and lifecycle
obligations remain. This record preserves the historical names.

**Status:** accepted, 2026-09-21. **Contract version:** 0.2.0, breaking 0.1.0.

[Decision 0003](0003-public-invocation-lifecycle.md) sharpens the required public
profile lifecycle integration; private storage alone is not the integration API.

## Decision

A Wire provides send access to a relative origin. An Endpoint additionally
provides one owning receive attachment and endpoint closure. The receiver sees
the delivered relative path and the complete message. Handler registration,
exact/prefix matching and overlap precedence belong to a composed dispatcher.

```typescript
interface Wire {
  send(path: Path, message: Message): void;
}
interface Endpoint extends Wire {
  receive(receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}
interface Receiver {
  message?: (path: Path, message: Message) => void | Promise<void>;
  closed?: (code: number, reason: string) => void;
}
```

The complete obligations are in the [contract](../wire/contract.md). Native
declarations use idiomatic interfaces, protocols, traits or records for the same
capabilities. A return address contains Wire access; replying does not require
control over the return endpoint's receiver or lifetime.

## Reasoning

Sending supplies a destination; receiving observes that destination. The path
belongs to delivery. The 0.1.0 callback already received that path, so this change
removes registration policy rather than simply relocating an argument.

The old interface required exact versus namespace matching, exact-match priority,
longest-prefix selection and duplicate-registration refusal from every endpoint.
A generated dispatcher, a space's dynamic map lookup and a forwarder need not
share that registration abstraction. They can all interpret or pass on the same
addressed message. Routing convenience remains reusable runtime infrastructure.

The root namespace receiver already allowed forwarding in 0.1.0. A more specific
registration could win over it, so it was not an unconditional interceptor. The
benefit is a smaller set of primitive obligations and a clearer place to compose
policy, not an assertion that forwarding was previously impossible.

Bitsystem's original typed-space model exposed send-only access. Passing access
to a model should not require granting receiver attachment or endpoint closure.
Endpoint bundles those additional capabilities for implementations that need
them. This is interface-level capability separation: an implementation requiring
enforced attenuation must expose a facade without the extra operations, rather
than relying on a type annotation to prevent a cast to its underlying endpoint.

The common boundary becomes smaller: implementations agree on addressed delivery
and preservation, while dispatchers agree on their chosen handler policy. A
space subtree, generated service and forwarder can all present Wire access.
This improves the conditions for composition; it does not itself prove model
transparency or generic-instantiation commutation. Those still require adapters
and their behavioral acceptance.

## Receiving views share an explicit owner

An Endpoint accepts one active receive attachment. A second attachment is
refused without replacing the first. Detach is idempotent and permits another
attachment. Requests are never implicitly broadcast.

Two selected receiving views cannot independently claim the same root receiver:

```text
root endpoint -> one dispatcher attachment -> view [a] -> receiver A
                                         -> view [b] -> receiver B
```

The runtime constructs one dispatcher and derives the views from that owner.
Selection adds an outgoing prefix and removes it from incoming delivered paths.
For overlapping views, the dispatcher explicitly chooses its policy; the
primitive has no hidden longest-prefix rule. A router may offer both exact and
namespace registrations, with the old policy as one useful choice.

A send-only selection needs only the underlying Wire and a prefix. It cannot
promise receive access. A receiving selection needs the shared dispatcher and
its attachment ownership. This distinction prevents an apparently generic
`at(w, path)` from quietly allocating competing root receivers.

Selecting or mounting access allocates no new peer, channel or message queue.
A dispatcher can maintain a routing table without becoming another carrier.
Detach releases the caller's attachment or route; it does not close borrowed
endpoints. Closing a composed owner releases its own registrations and owned
state. Sharing another endpoint's closure requires an explicit owning capability.

Complete messages, local return identity and runtime-established context survive
pure composition. Detach does not destroy the captured return/cancellation paths
of already admitted requests. Existing invocation and live-binding obligations
remain with their runtime/profile implementation.

In particular, a callback returning does not mean an asynchronous invocation has
finished. The smaller primitive deliberately supplies no completion signal.
An invocation-aware dispatcher must share the runtime's explicit admission and
terminal-state ledger to retain and retire cancellation associations. Its key
includes the original return identity and request ID, so equal IDs on distinct
return capabilities remain distinct. Rebinding a route cannot retarget an admitted
invocation. A standalone router cannot infer those states from Wire alone, and
wrapping a return capability to observe completion would violate preservation.
This integration is a runtime/profile obligation, not hidden generic routing
behavior. Nightseam's combined acceptance must exercise bounded retention and
retirement with delayed responses and cancellation after detach/rebind.

One realization keeps the selected route in the existing runtime-owned context
of each admitted invocation, associated with the unchanged return capability.
Cancellation retrieves that capture; normal terminal-state cleanup retires the
context. This requires neither a global perpetual router map nor another Wire
method. It is a proposed runtime integration, whose actual implementation and
generated/physical acceptance remain Nightseam's responsibility.

[Issue #20](https://github.com/Bitspark/bitwire/issues/20) records the obstruction
and its acceptance criteria. A replied execution and a still-running execution
can be indistinguishable to a bare router when replies bypass it. Callback return,
a fixed timeout, an optional Promise or a weak map cannot resolve that missing
information. The runtime integration must distinguish early caller settlement
from actual body completion and queued-control retirement, preserve captures
through forwarding and nested dispatch, reclaim state across more sequential
calls than its capacity, and prevent old controls from affecting a reused key.
The issue remains open for actual runtime evidence; retained-reply reference
tests alone do not close it.

## Migration and evidence

All eight bindings change together. `Wire.receive(path, receiver)` becomes an
Endpoint attachment plus dispatcher registration when routing is needed;
`Receiver.namespace` disappears from the primitive. Access-only dependencies
take Wire. Binders take Endpoint or a runtime-specific dispatcher as appropriate.

The message profile remains `nightseam.duplex/1`; this is a native access API
change, not a changed frame encoding. The immutable 0.1.0 release remains valid
for its contract. New packages use 0.2.0.

The [composition experiment](../../conformance/README.md) exercises the new
boundary in Go and TypeScript. It is test-only design evidence, not a second
production runtime or evidence of Nightseam adoption. The pinned 0.1.0 runtime
cases remain historical evidence. Routing precedence belongs to dispatcher
coverage; primitive coverage checks addressed delivery and attachment ownership.

[Nightseam #439](https://github.com/Bitspark/nightseam/issues/439) owns the
runtime/generator migration, coordinated with its existing adoption issue #421.
Its acceptance must use the actual released dependency and generated adapters,
including generic composition, physical carriers, context and live references.

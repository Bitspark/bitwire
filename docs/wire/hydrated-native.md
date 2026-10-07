# Hydrated native interaction contracts

Decision [0019](../decisions/0019-hydrated-wire-protocol.md) is implemented by the
public declarations in all eight presentations. These declarations add a live
value boundary above ground Wire; they do not extend Ontos or change a carrier.
The executable codec and a conforming runtime are separately qualified artifacts.

`HydratedValue` contains exact atoms, finite immutable tuples and opaque
`HydratedWire` leaves. Ground values embed unchanged. Runtime tuple construction
captures children, projects endpoint owners to their sending faces and returns
the ordinary ground tuple if there is no wire beneath it. It performs no sends.
A foreign container, a cyclic tuple or an arbitrary object with a send method is
not thereby an admissible value. The runtime recognizes capabilities it owns or
has imported; native interface conformance is not evidence of that recognition.

`HydratedWire` grants only `send(value)`. `HydratedEndpoint` additionally owns one
receive attachment and closure, exposes its sending face, and observes the same
`Termination` as a ground endpoint. Endpoints and recursively nested endpoints
are conveyed only as that sending face, including local delivery. Access to an
original owner must never become recoverable by inspecting a received wire.

`ReceivedContext` is an opaque composition-established value passed beside the
received message. The native type imposes no actor, route or authentication
schema. A receiver narrows it according to its actual composition contract;
message data cannot establish it. A local delivery uses the composition's local
context, not an assertion copied from an earlier remote arrival.

| Presentation | Value and tuple view | Context | Owner's send-only view |
| --- | --- | --- | --- |
| TypeScript | Atom, HydratedTuple (`kind`, `length`, `items`, `at`), HydratedWire | `unknown` | `wire` |
| Go | Open union with the documented admissible cases; HydratedTuple.Items | `any` | `Wire()` |
| Rust | Ground(Value), Tuple and Wire variants; HydratedTuple.items | shared Any + Send + Sync | `wire()` |
| Python | Atom, Tuple, HydratedTuple and HydratedWire protocols | `object` | `wire` |
| Swift | ground, tuple and wire cases; HydratedTuple.items | `any Sendable` | `wire` |
| C++ | ground, tuple and wire alternatives; HydratedTuple.items | shared immutable `std::any` | `wire()` |
| Java | Ground Value, HydratedTuple and HydratedWire under HydratedValue | `Object` in the receiver callback | `wire()` |
| Haskell | HydratedGround, HydratedTuple, HydratedWireValue | `Dynamic` | `hydratedWire` |

TypeScript's `kind: 'wire'` separates the live interface from ground Wire in a
structurally typed language. It is a discriminant, not a runtime brand or an
export credential. A runtime still validates ownership. Open or boxed native
unions do not relax finite structure, canonicalization or capability recognition.
An implementation normalizes the native representation at its admission boundary;
constructing a native value directly cannot bypass these laws.

Send success means local admission. The shared endpoint laws still require ordered
non-inline dispatch, one generation-safe detachable receiver, bounded detached
queues, handler-failure termination, idempotent close and terminal observation
after owned resource release. Async handler work is not awaited. Ending an
endpoint withdraws its exports; ending a scope does not close borrowed endpoints.
A send capability cannot observe or control that owner's lifetime.

The accepted protocol defines atomic whole-value staging before carrier admission,
namespace-scoped references, per-export unpredictable identifiers and symmetric
bounds. A lower admission refusal can leave newly committed exports live until
their owner closes; this is bounded owner state, not a delivery acknowledgement.
No distributed release, request-response convention or cross-namespace gateway
is added by these declarations.

Declaration and installed-consumer checks establish availability and type shape.
They do not stand in for runtime observations: recursive wire transfer, retained
ownership, aliasing, expiry, forged references, concurrency, limits, termination
and local/network interoperability remain required of runtime implementations.

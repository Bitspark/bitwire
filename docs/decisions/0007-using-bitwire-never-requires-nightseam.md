# 0007: Using Bitwire never requires Nightseam

**Status:** accepted, 2026-09-25, on the user's direction: no one using Bitwire
should be required to use Nightseam. This supersedes the part of
[decision 0001](0001-shared-wire-contract.md) that left carriers and the network
profile in Nightseam. The direction is decided; only the independence check is
implemented. Each piece remains where it is today until it is delivered
([Delivery](#delivery)). Delivery is tracked in
[#39](https://github.com/Bitspark/bitwire/issues/39), and Nightseam's side in
[nightseam#719](https://github.com/Bitspark/nightseam/issues/719).

## Question

Decision 0001 extracted the access interface. Everything that makes it usable
stayed in Nightseam:

- the operators Bitwire's laws describe: selection, mounting, forwarding and
  declared composition;
- every carrier: the in-process pair, WebSocket peers and tunnels;
- the network profile `nightseam.duplex/1`, its specification and its revisions.

Bitwire's packages hold types. A program that selects a path, composes a service
or connects two processes needs Nightseam. So does Bitwire's own conformance: its
module [requires Nightseam v0.6.0](../../conformance/current/go/go.mod).
[Research 0001](../../research-docs/0001-declared-composition-implications.md)
then found that several open contract questions are settled where a carrier
accepts a message. Where should these pieces live?

## Decision

**Using Bitwire never requires Nightseam.** A program that depends only on
Bitwire can build, select, compose and forward access, run it within one process,
and connect two processes. Nightseam, like any other runtime, builds on Bitwire
and adds to it. Nothing Bitwire publishes depends on a runtime.

| Bitwire owns | Nightseam owns |
| --- | --- |
| The access contract, its laws and independent conformance, as before | Dispatch: registration, route capture and the invocation lifecycle facility required by [decision 0003](0003-public-invocation-lifecycle.md) |
| Operators that need only the Wire interface: selection, mounting, forwarding, declared composition and decomposition | Live references and their `live.` vocabulary |
| The transport seam and its transports: an in-memory pipe, WebSocket, and one framed byte stream for stdio, TCP and Unix sockets | The generator, generated adapters and declaration identity (`identity.`) |
| Carriers: the in-process pair, the protocol engine that realizes an Endpoint over a transport, and tunnels | Authentication (`auth.`) and other optional profiles |
| The network protocol and a carrier contract | Tracing and observation integrations, attached through public hooks |

**The line between them** is the one research 0001 drew. A carrier *accepts* a
message; a dispatcher *captures* its route. Up to acceptance, and for what an
accepted request is still owed on its connection (its response and its cancels),
the carrier is responsible. Choosing a handler, capturing a route and running an
invocation belong to the runtime.

**The protocol engine** mints request ids, correlates responses and cancels,
gives each received request a fresh return capability, enforces bounds, and
closes or aborts. It establishes a received message's context only through public
hooks, so that Nightseam's authentication, observers, trace propagator and
invocation lifecycle attach to it without private access. Decision 0003 already
requires public, profile-specific facilities; this extends that requirement to
the engine.

**The protocol.** Bitwire owns the specification that Nightseam publishes as
`nightseam.duplex/1`, including the rule by which a layer adds its own vocabulary
under a reserved prefix. Its first Bitwire revision is that profile unchanged:
the same frames accepted and refused, the same close codes and the same bounds.
It is pinned to the Nightseam revision that the move copies, and any difference
from the v0.6.0 baseline in [decision 0004](0004-return-origins-and-profile-revisions.md)
is recorded then.

The name never travels on a connection. An envelope carries only `version` `1`,
and no WebSocket subprotocol is offered by default
([Nightseam's profile](https://github.com/Bitspark/nightseam/blob/dfacbb2783598c55d5ba78273e6ee8d11ebd9cee/docs/wire/profile.md#the-subprotocol)).
Changing its owner and its name therefore breaks no deployed peer. Bitwire calls
the revision `bitwire/1` and records `nightseam.duplex/1` as another name for it.
Names inside it, such as the reserved `nightseam.` metadata prefix, change only
in a later revision.

**The carrier contract** states what every carrier preserves:

- messages, and their order within a stated scope;
- the identity of the original return capability within a process;
- the mapping of return capabilities and context across a process boundary;
- what acceptance and closing promise at its boundary.

It binds carriers written outside Bitwire too. Anyone can add a transport by
implementing the public seam.

**Packaging.** The contract package gains no dependency. Operators need only the
interface and the standard library. Each transport ships in its own package, so
a program using the contract, or one transport, does not pull in another
transport's libraries.

**Verification stays independent.** Expected observations are written from the
specification, never recorded from Bitwire's own implementations. Bitwire's
reference realization runs on Bitwire alone, and Nightseam's production gate
holds Nightseam to the same cases. Portable vectors for framing and envelopes,
and runs between a Bitwire peer and a Nightseam peer, hold both to the same bytes.

**Enforced now.** `node scripts/check.mjs` fails if any published package, in any
language, depends on or imports Nightseam
([`independence-lib.mjs`](../../scripts/independence-lib.mjs)). Test-only
conformance under `conformance/` is exempt. Its reference realization still runs
over Nightseam; that is pending work, not a permanent exemption.

## Why

- **The interface alone was not usable.** Bitwire's laws describe selection,
  mounting, forwarding and composition, and none of them shipped with Bitwire.
  In practice, every Bitwire user depended on Nightseam.
- **One runtime owning the protocol made every other implementation a guest.** A
  second runtime, such as Bitlink's, would follow a protocol that one runtime
  revises in its own releases. Decision 0004 had to accept exactly that for
  v0.6.0.
- **The open contract questions sit at the carrier.** Research 0001 left three
  decisions that are made where a message is accepted
  ([applied rows 12, 28 and 9](../../research-docs/0001-declared-composition-implications.md#applied)):
  whether a synchronous refusal proves that nothing was published, when a
  message becomes immutable, and what closing owes work already admitted. With
  the carrier in Bitwire, they become Bitwire rules checked against Bitwire code.
- **Consumers should not need a runtime to connect.** BitTree, Bitsystem and the
  relay service can use Wire across processes without a generator, live
  references or authentication.
- **The code already divides this way.** Nightseam's
  [transport package](https://github.com/Bitspark/nightseam/tree/dfacbb2783598c55d5ba78273e6ee8d11ebd9cee/duplex/go)
  imports nothing else from Nightseam, and its
  [profile](https://github.com/Bitspark/nightseam/blob/dfacbb2783598c55d5ba78273e6ee8d11ebd9cee/docs/wire/profile.md)
  "names no runtime".

Decision 0001's separation of meaning from implementation still holds, in a new
form: the contract and its cases stay independent of every implementation,
including Bitwire's own.

## Consequences

**Bitwire** becomes an implementation repository as well as a contract. It takes
on the transports' dependencies, in separate packages, and their CI and
maintenance in each delivered language. Research decisions 4 and 5, and the
carrier's half of 6, become Bitwire's to settle. This decision does not settle
them.

**Nightseam** revises its decision that
[the reusable foundation lives in Nightseam](https://github.com/Bitspark/nightseam/blob/dfacbb2783598c55d5ba78273e6ee8d11ebd9cee/docs/decisions/the-reusable-foundation-lives-in-nightseam.md):
carriers, peers, tunnels and the profile's specification leave its list. Its
runtime, dispatch, invocation lifecycle, live references, generator, declaration
model and identity, and optional authentication stay.

- Its peer splits. The protocol engine moves. The method-name API (`Handle`,
  `Call`, `Emit`), live references, the identity check and authentication then
  sit on Bitwire's endpoint. Live references become ordinary traffic under their
  reserved prefix rather than handlers registered on a peer.
- Its unreleased declared-composition API
  ([PR #713](https://github.com/Bitspark/nightseam/pull/713)) has no compatibility
  constraint yet. It can move to Bitwire before Nightseam releases it, or ship
  there first and later become an alias.
- Its released v0.6.0 paths can remain as aliases of Bitwire's until Nightseam
  retires them in a later release.
- The stdio carrier proposed in
  [nightseam#663](https://github.com/Bitspark/nightseam/issues/663) becomes an
  instance of Bitwire's framed byte stream.

**Consumers** such as BitTree, Bitsystem, Bitlink and the relay service's clients
can depend on Bitwire alone for access and carriers. They add Nightseam only for
generated adapters, live references, identity checks or authentication.

## Delivery

The rule holds for a language once all of that language's pieces are delivered.
The [language matrix](../languages.md#independence-from-nightseam) records each
gap until then.

| Step | Scope | Needs Nightseam |
| --- | --- | --- |
| 1 | This decision and the independence check | No |
| 2 | Go and TypeScript operators: selection, mounting, forwarding, declared composition and decomposition; the in-process pair | No |
| 3 | Go and TypeScript transports: the seam, the in-memory pipe, WebSocket, and a framed byte stream with stdio and TCP | No |
| 4 | The protocol specification as `bitwire/1`, and the carrier contract | Review, since Nightseam then follows it |
| 5 | The Go and TypeScript protocol engine, interoperating byte for byte with Nightseam peers; Bitwire's reference realization no longer imports Nightseam | Agreement on the engine's public hooks |
| 6 | Nightseam builds on Bitwire's operators, transports and engine | Nightseam's work |
| 7 | Python, Rust, Swift, C++, Java and Haskell; tunnels | No |

Steps 2 and 3 mostly move code that depends only on Bitwire's types. Until step 7,
the other six languages still need Nightseam's peers to connect processes.

## Not decided here

- The engine's public hooks, and package names and coordinates.
- Research decisions 4, 5 and 6.
- Any change to what `bitwire/1` accepts or refuses.
- How Bitwire versions later protocol revisions.

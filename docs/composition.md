# What composition through Wire means

The useful property is that composing access produces access that can be
composed again. A component can participate in a larger assembly without knowing
where the assembly placed it. The common contract states what must survive that
change of surroundings; conformance checks observe whether an implementation
keeps those promises.

## Within Wire

Suppose storage, a worker and a catalog each expose Wire access. An assembly can
mount them under three names:

```text
storage ── ["storage"] ──┐
worker  ── ["worker"]  ──┼── system Wire
catalog ── ["catalog"] ──┘
```

Selecting `["worker"]` from the system yields access to the worker. That access
can itself be mounted inside another system or selected further. The worker
receives paths relative to its own origin, so changing the assembly's outer
prefix does not require changing the worker's operation names.

For valid paths, equivalent dispatch policies and the required attachments:

```text
at(w, [])                 ≃ w
at(at(w, a), b)            ≃ at(w, a ++ b)
at(mount({"worker": w}), ["worker"]) ≃ w
```

The equivalence concerns routing and message observations, including the
documented admission/refusal behavior. It does not make the objects identical
or transfer closure ownership. Closing the mount leaves its borrowed worker
usable. Wire itself grants only send access; receiving views require a shared
dispatcher that owns the endpoint's one attachment. Matching and overlap policy
are explicit above that attachment.

Pure selection, mounting and forwarding preserve the original local return
capability and established context. They do not create a new carrier or inspect
and translate hidden references in payloads. A physical hop is a different
boundary: its profile maps correlation and establishes receiving context, and
its value adapters manage references crossing scopes.

## A composite's own behavior

A mount has nothing of its own at `[]`. A declared composite can: its value is
an **origin** that handles messages sent to the composite itself, beside its
named children. This is Deixis's `Node[T]` with an origin at every node:

```text
system { origin: describeSystem }
  ├─ counter { origin: increment }
  └─ report  (an existing endpoint, used whole)
```

Sending to `[]` reaches `describeSystem`; sending to `["counter"]` reaches
`increment`; sending to `["report", "daily"]` reaches the report endpoint at
`["daily"]`. Selecting `["counter"]` gives exactly the counter's access, with
nothing of the system in between. A missing name refuses and never falls back to
`describeSystem`. A mount is the same construction with a refusing origin.

The assembler that built the system keeps its parts: the origin and the complete
child map. Rebuilding from those parts keeps the same counter, the same origin
and any child shared under two names, so their state continues. Rebuilding from
the children alone loses `describeSystem`. Replacing the counter with a fresh
copy resets it and breaks sharing. Those parts are held by the assembler, not
exposed through the Wire it hands out; a caller with send access learns nothing
about the structure it reaches.

Interception, such as a budget over the whole system, is access composed around
the system: `guard(budget, system)`. It is not part of any node's value.
Selecting through the guard checks the budget once per send; rebuilding the
system inside the same guard keeps the budget's state. The
[decision](decisions/0006-declared-composites-realize-deixis-nodes.md) states
the key mapping, laws, equivalence and ownership. The
[evidence](../conformance/declared/README.md) separates the test-only interpreter
from released runtime behavior and its recorded gaps.

## Across consumers

The common boundary allows an implementation authored in one repository to be
used by a caller, generated adapter or assembly authored in another. Each keeps
its own responsibility:

| Layer | What it contributes |
| --- | --- |
| Bitwire | Addressed access, preservation and ownership laws, native declarations and independent expectations. |
| Runtime/profile, such as Nightseam | Scheduling, transport, correlation, invocation lifecycle and reference machinery. |
| Generated adapter | The declared methods, events and value conversions exposed to application code. |
| Domain consumer | What operations mean, how components attach and which actions are authorized. |

Using the same Wire signature alone is insufficient. Participants must agree on
the operation contract and identity, value encoding, profile revision, reference
scope and authority. A storage API is not made into a worker API by mounting it
at `["worker"]`. Different meanings need an explicit domain adapter. Likewise,
the same profile name does not negotiate compatible pre-1.0 releases.

## Why lifetime is part of composition

A request admitted to worker A must retain its captured route even if that
registration is subsequently replaced by worker B. Its delayed response and
cancellation belong to A's invocation. A caller timeout does not prove that A's
body finished, and a completed call does not automatically release a live
capability returned by that call. Each boundary must retain enough state to
honor these obligations and reclaim it when they actually end.

A callable return capability is itself Wire access at an origin. Its profile
may define lifecycle operations there, allowing independently implemented
participants to coordinate through public messages. Bitwire does not prescribe
Nightseam's vocabulary to every Wire or make that vocabulary an authority proof.

## What this enables, and how we establish it

A component can be tested locally, mounted into a larger assembly and accessed
over a compatible remote carrier while keeping the same domain-facing
interface. A call can return another callable component; the caller can continue
using or composing that access under the live-reference profile. A system can
therefore discover a capability, invoke it, receive a child space and continue
operating on that space through the same access foundation.

That is an architectural possibility with explicit conditions, not proof that
every consumer already implements it. The [current baseline](../conformance/current/README.md)
checks actual production composition and scoped lifecycle observations. The
remaining generated/live/authority and downstream attachment requirements stay
visible there. The next domain-level demonstration must compare a real declared
component locally and remotely, including returned child access, under the
consumer's actual attachment and policy rules.

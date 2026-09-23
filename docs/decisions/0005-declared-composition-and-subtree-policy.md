# 0005: Declared composition retains own behavior and subtree policy

**Status:** accepted, 2026-09-23, following the user's decision to support both
exact-node behavior and explicit parent interception. This is an opt-in
interpretation around the existing Wire interface, not a new Wire primitive.
[Evidence and limits](../../conformance/declared/README.md) distinguish the
test-only interpreter from released runtime facilities and consumer adoption.
Tracked by [#29](https://github.com/Bitspark/bitwire/issues/29).

## The value at a node

Deixis [v0.2.0's mandatory-value model](https://github.com/Bitspark/deixis/blob/v0.2.0/docs/design/0010-mandatory-node-values.md)
is `Node[T] = T × FinMap[Bytes, Node[T]]`. It does not assign operational meaning
to T. This Wire interpretation, called **declared admission composition Q**,
chooses:

```text
T_Q = (own: OriginAccess, policy: AdmissionPolicy)
Parts_Q = (value: T_Q, children: FinMap[Segment, Declared_Q])
```

Every node has both slots. Own access can explicitly refuse; the identity
policy permits unchanged delegation. Neither is inferred from the children.
The own slot receives only the empty relative path and supplies this node's
behavior. Nonempty paths traverse the child map exactly; the own slot is never
a fallback for missing children. A node with no children still has its own
behavior, including an explicit refusal. A child-only mount is the specialization
with refusing own access and an identity policy.

Q admits finite, acyclic, completely declared structures. Different positions
may retain the same child, own capability or policy state. Cyclic routing and
opaque, partially described namespaces require a separately declared domain.
A structure and its child maps are immutable after construction; state behind
retained capabilities can change. Rebinding constructs a new description and
does not retarget existing selected access or admitted work.

## Admission policy

A policy applies to this node and every descendant reached through this
occurrence. On an incoming request or event, the policies run root to leaf;
each sees the remaining path relative to its node, the unchanged message, and
only context established by the runtime. They are admission checks, not
destination application handlers. They must be bounded, synchronous and
nonblocking; admission machinery is allowed to run on the sending stack.
The destination handler remains asynchronously dispatched by its endpoint.

A policy returns permit or refusal. It is not given a forwarding continuation.
The composition delegates the original message exactly once after permission,
without changing its path other than consuming the selected child segment.
At each node its policy runs before origin dispatch or child lookup. A refusal
stops traversal. Thus an outer check can consume admission budget even when a
later check, a missing child, or the destination refuses. This is an attempt
budget, not a transaction or a reservation with rollback. No completion signal
is inferred from Send returning.

The identity policy needs no mutable state. Other policies retain their
original live state and synchronize concurrent checks as required by the
implementation. A shared quota stays shared across siblings, views and
reconstructions. Each **occurrence** is checked once: deliberately installing
the same policy at two depths performs two checks. Deduplicating by policy
object identity would change that declaration.

This initial interpretation covers request/event admission. Responses and
cancellation are handled by the admitted invocation's captured profile
facilities, outside fresh admission checks. Q refuses a response or cancel
presented as a new request/event traversal. Implementations that expose a
generic control entry must bind it to the captured invocation; current tree
lookup is insufficient. Exhausting a quota, selecting a view or rebuilding a
tree cannot suppress a reply or cancellation already owed by the profile.

Retries, fanout, rewriting, response interception and completion-dependent
concurrency permits are outside Q. They need additional declared ordering,
correlation, effect and terminal-lifetime rules. Q does not weaken the shared
[invocation lifecycle obligations](0003-public-invocation-lifecycle.md).

## Construction parts and selected access are different

The construction owner retains `Parts_Q`. Decomposing a declared composite
returns its exact own access, policy instance and complete **raw** child
descriptions. Rebuilding copies the map structure as needed but retains those
capabilities, shared state and aliases. Repeated reconstruction at any complete
cut therefore preserves the declared behavior.

A selected Wire is **bound access**. It retains the inherited ancestor-policy
context; handing it to another caller does not hand out a raw child or a way
to strip those guards. The usual `at(root, prefix)` construction already
retains this context by sending through the root. It needs no new peer, queue,
receiver attachment or method on Wire.

Rebuilding a parent from selected child views is not decomposition: it would
apply ancestor policies again. Returning raw children from a public selection
would instead bypass those policies. Construction descriptions are capabilities
held by the assembler, not an enumeration or unwrapping facility granted to
everyone holding Wire. To reconstruct selected access, its construction owner
retains the raw description **and its inherited binding context**, then binds
once. A send-only Wire alone cannot recover either.

Here is the context-qualified law. `I(d, γ)` interprets declaration d in an
inherited binding context γ; `γ·p` retains the ancestor occurrences, their state,
and their coordinate paths on the way to p.

```text
at(w, [])                             ≈ w
at(at(w, p), q)                        ≈ at(w, p ++ q)
at(I(d, γ), p)                         ≈ I(node(d, p), γ·p)
build(parts(d))                        ≈ d
parts(build(t, children))              ≅ (t, children)
```

The last equality retains capability/state identity and exact child keys;
it is not equality of freshly serialized policy configuration. Child selection
is generally **not** equivalent to interpreting the raw child with empty
context. The original law `at(mount({k:w}), [k]) ≈ w` still holds for a pure
mount; Q adds no implicit permission inheritance to ordinary path syntax.

## Observations and authority

Equivalence quantifies over the same initial state, admissible input schedule
and declared profile. It includes own behavior, exact routing and definedness,
policy order and effects, admission/refusal, message meaning, ordering, shared
state, replies and supported invocation outcomes. It preserves local return
identity and established context at every pure local boundary. Comparisons of
stateful alternatives must start from related states, or deliberately continue
through shared state; sequentially consuming a quota is not evidence of
inequivalence between two views.

Substitution must preserve the whole subtree's behavior **in the inherited
context**, including aliases shared with the surrounding assembly. Matching a
single response or replacing a counter with a fresh counter is insufficient.
Omitted, added, renamed or conflicting children change the complete declaration.
A conflict must be refused before native map overwrite can discard it.

Wire segments map to Deixis keys by exact UTF-8 encoding of Unicode scalar
strings. The admitted key domain is that image, including empty bytes.
Invalid UTF-8 byte keys and unpaired surrogates are refused, never replaced or
normalized. Composed and decomposed spellings of Unicode remain distinct.
This mapping is not a codec for stateful capabilities or for arbitrary Deixis
payloads. A remote declaration requires an explicit capability/state binding
protocol, not JSON serialization of a policy closure.

Selected access and reconstruction borrow origins, children and policy state.
They grant no Receive or Close, do not reset state, and do not close borrowed
resources when a view is discarded. An implementation with explicit view
release keeps shared resources alive until their owning lifetime ends.
Pending calls retain their captured target across rebind, detach and teardown.
Physical carriers may remap correlation and establish receiving context;
carrier faults, verified authority and resource bounds must be stated by any
stronger end-to-end claim.

## Compatibility and delivery

The native Wire/Endpoint/frame declarations are unchanged in all eight
languages. Their documentation points to this interpretation. Existing pure
mounts remain pure; an arbitrary existing Wire does not acquire Q's declaration
or guarantees. Immutable Bitwire 0.2.0 packages are not retrospectively certified.
No new package dependency on Deixis or Nightseam is introduced.

Bitwire owns this contract and independent fixtures. Its Go/TypeScript
interpreters under conformance are executable specification code, not a shipped
runtime or a Nightseam composition API. They use released Nightseam selection,
endpoints and forwarding for integration evidence. Nightseam remains the home
for any production construction API and profile integration. Consumer adapters,
including BitTree's operational mapping and round-trip proof, remain separate.

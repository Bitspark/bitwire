# 0006: Declared composites realize Deixis nodes over origin behavior

**Status:** accepted, 2026-09-23, following the user's direction for
[#29](https://github.com/Bitspark/bitwire/issues/29): the own value is the
behavior at the composite's origin, and named children keep their complete Wire
access. Supersedes [decision 0005](0005-declared-composition-and-subtree-policy.md)'s
node value and its context-qualified selection law. Native Wire and Endpoint
declarations are unchanged. [Evidence and gaps](../../conformance/declared/README.md)
keep the test-only reference interpreter apart from released Nightseam behavior.

## Question

Deixis [v0.2.0](https://github.com/Bitspark/deixis/blob/v0.2.0/docs/design/0010-mandatory-node-values.md)
implements `Node[T] = T × FinMap[Bytes, Node[T]]` and gives `T` no operational
meaning. What does a Wire composite hold at its own position? Which composites
are admitted, what must be retained to decompose them, and in what sense is Wire
access a realization of that model?

## The realization

```text
Segment = Unicode scalar string            Key = Bytes
Origin  = Message → Admission              behavior at the empty relative path
Access  = send access (Wire)
Parts   = Origin × FinMap[Segment, Access]

compose : Parts → Access
parts   : admitted composite → Parts       held by the construction owner
```

The own value is the composite's **origin**: a handler of a Message delivered at
`[]`. It never sees a path, and its admission follows ordinary Send semantics.
A refusing origin is a value, not an absent one. Named children are complete Wire
access: the composite neither wraps, restricts nor inspects them.

```text
send(compose(o, m), [],    x) = o(x)
send(compose(o, m), k : p, x) = send(m[k], p, x)      when k ∈ dom m
                              = refused               otherwise
```

The origin is never a fallback for a missing child, and no child is consulted
for `[]`. Composition consumes exactly one segment, delegates the unchanged
message once, and allocates no peer, channel, queue, correlation or attachment.

A Deixis tree over origins has the interpretation

```text
I(Node(o, m)) = compose(o, {key⁻¹(k) ↦ I(m[k])})
```

The binding context is trivial: a child's behavior does not depend on where it
is mounted. Deixis's interpretation laws therefore hold with `γ` omitted.
A child-only mount is the specialization with the refusing origin:

```text
mount(m) = compose(refuse, m)
```

Natively, an origin can be represented by existing send access used only at
`[]`, or by a function of a Message. Either way this adds no package type.

## Admitted composites

A composite is admitted when it comes from an explicit construction that:

- takes an origin and a list of `(segment, access)` entries;
- refuses a missing origin, a missing child value, a segment outside the key
  image below, and duplicate segments before a native map could discard one;
- copies its inputs, so its origin and child map are immutable afterwards;
- retains `Parts` for its construction owner.

Children must exist before their parent, so construction from values is finite
and acyclic. A declaration that refers to itself is refused. Later state behind
retained capabilities can change; the description cannot.

A child is either an admitted composite, whose own parts are retained, or
**opaque** access: an endpoint, a selected view, a forwarder, a guard or a
runtime's mount. An opaque child is retained and delegated whole. In Deixis
terms, a composite with opaque children is a declared skeleton whose holes hold
complete access, the `Skeleton(F) × Subtrees(F)` of a cut. Decomposition stops at
those holes. Where every child is admitted, recursively, the composite is
**completely declared**: its declaration `decl(c)` is the Deixis node with the
same origins and keys, and `I(decl(c)) ≈ c`.

An arbitrary Wire is not admitted as a composite. Being reachable by paths does
not make it decomposable.

## Retained information and authority

`Parts` belongs to the construction owner, not to the access it hands out.
A send-only Wire has no enumeration, unwrapping or parts method, and this
decision adds none. As [decision 0002](0002-delivery-dispatch-and-ownership.md)
requires for attenuation, an implementation hands out a facade that cannot be
cast back to its description. Selection reveals nothing structural either:
sending below a missing child and below an existing child whose origin refuses
and which has no children produce the same refusals. Only `Parts` distinguishes
them. Behavior does not disclose structure.

Reconstruction uses the retained parts. Rebuilding from selected views,
`compose(o, {k ↦ at(c, [k])})`, is equivalent in behavior by the child law below.
It is not the same description, though: it routes through the old composite,
keeps it alive and cannot recover an origin that only `Parts` holds. Around a
guard, it repeats the guard's checks.

## Exact segment-to-key mapping

```text
key  : Segment → Key               key(s) = UTF-8(s)
path : Segment* → Key*             path(s₁ … sₙ) = key(s₁) … key(sₙ)
```

`key` is a bijection between Unicode scalar strings and valid UTF-8 byte strings.
Its image is the admitted key domain. `[]` maps to the empty path ε, `[""]` to a
path of one empty key, and `path(p ++ q) = path(p) ++ path(q)`. There is no
normalization, case folding or separator parsing: `"é"` and `"é"` are
different keys, and `"a/b"` is one key. A Deixis node with a key outside the
image, such as invalid UTF-8, has no Wire realization. Construction refuses it;
it is never replaced or repaired. A native string type must hold scalar values
exactly: Go strings must be valid UTF-8, and UTF-16 presentations must not
contain unpaired surrogates. A canonical ordering of siblings, where one is
needed, is by key bytes, which differs from UTF-16 code-unit order for
supplementary characters. The mapping names positions only. It is not a codec
for origins, access or state.

## Laws

For an admitted composite `c = compose(o, m)`, access `w`, and paths `p` and `q`,
let `⊥` be access that refuses every send and `origin(w) = x ↦ send(w, [], x)`.

```text
(S0) at(w, [])                ≈ w
(S1) at(at(w, p), q)           ≈ at(w, p ++ q)
(S2) at(c, [k])               ≈ m[k]              k ∈ dom m
(S3) at(c, [k])               ≈ ⊥                 k ∉ dom m
(O)  origin(c)                ≈ o
(R0) compose(parts(c))        ≈ c
(R1) parts(compose(o, m))     ≅ (o, m)
(M)  mount(m)                 ≈ compose(refuse, m)
```

For a Deixis tree `n` whose keys lie in the image:

```text
(H) I(Node(o, m))             = compose(o, {k ↦ I(m[k])})
(A) at(I(n), p)               ≈ I(at(n, path(p)))     path(p) ∈ D_n
    at(I(n), p)               ≈ ⊥                     otherwise
(V) origin(at(I(n), p))       ≈ valueAt(n, path(p))   path(p) ∈ D_n
```

Deixis's navigation is partial and Wire selection is total syntax. **Undefined
navigation corresponds to refusal:** when `at(n, path(p))` is undefined, every
send through `at(I(n), p)` refuses. A selected view of a missing child can be
created; it refuses on use and gains no fallback. The converse does not hold:
an existing childless node whose origin refuses also behaves as `⊥`, and only
`Parts` distinguishes the two. With opaque children, `(S1)` and `(S2)` carry
selection into the child, whose own behavior governs below.

**Complete cuts.** For any prefix-free set `F` of declared positions, reusing the
subtrees at `F` whole and rebuilding every declared composite above them from
`Parts` yields a composite equivalent to `c`. Different complete cuts of the same
composite agree with each other. Ancestor origins, exact keys and childless
declared branches survive every cut.

**Both reconstruction directions.** `(R0)` is behavioral: the rebuilt composite
is a new container that observes like the old one. `(R1)` is structural: `≅`
compares the origin capability and each child access by identity, and the key
domain exactly. It is not equality of copied or serialized configuration.

**Substitution.** If `b ≈ b'` in the assembly's context, including any state
they share with the rest of that assembly, then
`compose(o, m[k := b]) ≈ compose(o, m[k := b'])`. A fresh copy of a stateful
child is generally not such a `b'`: sharing is part of the context.

## Observational equivalence

`w ≈ w'` under a declared profile holds when every admissible observing context
started from related states produces the same observations through `w` and
`w'`. A context may select, relay through conforming carriers, and hold other
access to shared state. The observations are:

- for each send, admission or refusal, including refusal of missing destinations
  and invalid paths;
- which origin or child receives it, and the relative path it receives;
- the unchanged complete message: frame meaning, the original local
  return-capability identity and the established context at every pure local
  boundary;
- subsequent replies, events and supported invocation outcomes, including delayed
  replies and captured cancellation;
- the order of admissions from one sender, and effects on shared state observable
  through other access, including origins and children reachable elsewhere;
- authority and lifetime: no Receive, Close, parts or ownership of borrowed
  children is granted, and discarding or rebuilding closes nothing borrowed.

Language object identity of the access, allocation of containers and timing
beyond order are not observed. Using a counter sequentially through two
equivalent views is not evidence of inequivalence; compare from related states
or continue deliberately through shared state. Across a physical carrier,
equivalence uses the carrier's declared correlation and context mapping and
assumes a connected, ordered, nonfaulting carrier. Transport failure is a
separate outcome and is not hidden by this relation.

Structural identity `≅` is a separate claim about retained `Parts`.

## What composition preserves

| Obligation | Rule |
| --- | --- |
| Origin behavior | Rebuilding keeps the same origin capability. Children alone never recover it; reconstruction with a refusing or fresh origin is a different composite. |
| Child state and aliasing | Children are retained by identity. The same access at two keys stays shared; resetting or copying a child is substitution only if equivalent in context. |
| Routing | Exactly one segment is consumed per level. There is no normalization and no fallback to the origin or elsewhere. |
| Admission and refusal | Composition refuses only missing destinations and invalid paths, and admits nothing its origin or child would refuse. An invalid path is refused before any origin or child sees it. |
| Replies | Composition never wraps or replaces a return capability, so a reply reaches the original caller unchanged. |
| Return identity and context | Messages are delegated as the same objects. They are never reconstructed from visible fields. |
| Invocation captures | An admitted invocation keeps its captured target through rebuild, rebind and teardown, and controls use the captured facilities rather than current lookup ([decision 0003](0003-public-invocation-lifecycle.md)). |
| Lifecycle ownership | A composite owns nothing it borrows. An owning mount endpoint's Close ends only its own routing; borrowed children stay usable. |

## Interception is composition around access

Decision 0005 put an admission policy into the node value. A selected child was
then a guarded view rather than the child, `at(c, [k]) ≉ m[k]`, so its selection
law needed an inherited context. That does not realize Deixis's
`at(Node(t, m), [k]) = m[k]`. This decision keeps interception available as
ordinary access composed around a node:

```text
guard(P, w)                   : Access
send(guard(P, w), p, x)       = send(w, p, x)     when P(p, x) permits
                              = refused           otherwise
```

A guard is opaque access, not a composite. As a child it keeps `(S2)` exact:
`at(compose(o, {k: guard(P, w)}), [k]) ≈ guard(P, w)`. Around a composite,
`at(guard(P, c), p)` is ordinary selection through the guard, so every send
checks `P` once with its path relative to the guard. Decision 0005's
interpretation is recovered as
`I_Q(Node((o, P), m)) = guard(P, compose(o, {k ↦ I_Q(m[k])}))`; its context
`γ·p` is the chain of guards that `p` crosses. The owner retains `(P, w)`: the same
policy instance preserves its state, a fresh one resets it, and wrapping views
selected through a guard in the same guard again checks twice. Decision 0005's
policy rules still describe such a guard where an implementation offers one:
bounded synchronous checks, one check per occurrence, an attempt budget and
request/event admission only. Guards are optional, not a primitive.

## Not claimed

No Wire method, enumeration or unwrapping is added. An arbitrary Wire is not
decomposable. Generic undo, edit history, domain inverse operations and a codec
for origins or access are out of scope. Attaching a new child at a fresh key
yields a different composite; it leaves every existing path's behavior unchanged
but promises no equality of the whole. Bitwire takes no dependency on Deixis;
the model is cited at v0.2.0, and earlier Deixis APIs or bytes impose no
constraint.

## Compatibility and delivery

The native declarations in all eight languages are unchanged; their
documentation points to this decision. Existing pure mounts are the
specialization `(M)`. The immutable 0.2.0 packages are not retroactively
certified. Decision 0005 was never released. Its node value is superseded before
any release, and its record remains as history.

Bitwire owns this contract and its independent fixtures. The Go and TypeScript
reference interpreters under conformance are test-only. Released Nightseam
v0.6.0 is exercised through `At`, `Mount`, `ForwardWire` and its carriers. There,
the child-only specialization meets every applicable expectation, and the
[recorded gaps](../../conformance/declared/production-gaps.json) are exact:

- no public constructor takes an origin;
- `Mount` accepts conflicting, invalid or missing children at construction;
- `Mount` requires Endpoint children for send-only composition.

Nightseam owns any production construction API. Its merged but unreleased
origin-and-complete-child API from [#705](https://github.com/Bitspark/nightseam/issues/705)
is assessed by the [source production gate](../../conformance/production/README.md):
all 39 independent cases in Go and TypeScript over local pairs and both
WebSocket directions. Decision 0005's earlier implementation and cases remain
replayable as historical evidence. Published-package adoption is still distinct;
consumers such as BitTree own their domain mappings.

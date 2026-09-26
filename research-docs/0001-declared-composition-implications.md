# Research: What a tree of origins and complete children implies for message-addressed capabilities

**ID:** 0001
**Date:** 24 September 2026
**Author:** Julian Matschinske <julian@matschinske.com>
**Status:** applied
**Run-ID:** run_345bdfe3-d76d-46b5-b0f5-161b0ba6c5c3
**Document-ID:** doc_0a1918b1-fe12-4e88-b3dc-7ac9567ad8c9

## Question

We have a small, send-only messaging-access primitive, `Wire.Send(path, message)`. Over it we have just
realized a finite-tree model, **Deixis**: `Node[T] = T × FinMap[Bytes, Node[T]]`, where `T` is read as "the
behavior at this node's own address". Every node has an own behavior, and its named children are complete
access.

A code generator now emits a **declared composite** for every generated service. It is a node that refuses
at its own address and has one child per operation the service receives, plus a compatibility check. Each
child is a *selected view* of the same underlying access, meaning access that prefixes one path segment.
The generator knows the complete operation list at build time. A send-only capability cannot reveal that
list.

The general construction passes Bitwire's independent conformance cases in two languages. The generated
construction is tested only by the runtime project's own scenarios. One fact limits everything below: **the
tree governs only traffic that its holder sends.** Replies, callbacks toward the caller, and callables
passed by reference all travel outside it.

We want to understand what this object *is* and what it *implies* before more systems depend on it.

**What the advice will feed.** Before the runtime's next release we will decide:

- (a) whether to ship the generated description and its send/receive bridge as they are;
- (b) where interception belongs and what it owes to requests already in flight;
- (c) what to tell the two consumer projects deciding whether to model their own structure this way (BitTree
  and Bitsystem, both described below);
- (d) what Bitwire should add to its contract and conformance cases.

Changes are cheap now, because nothing here is released and nothing carries a compatibility constraint.
They become expensive once the runtime release ships and consumers adopt it.

**Priorities.** Questions 3 and 2 bear most directly on the release. Question 1 frames everything, and
question 4 bears on the consumers.

**Useful advice** would give us:

- a framing whose predictions we can turn into laws and conformance cases;
- a clear line between must-settle-before-release and later;
- pointers to comparable systems or literature.

Proof sketches are welcome but not required.

The five questions, in brief (full text at the end):

1. What is this object, and what does that predict?
2. How should authority and interception be arranged, given that the tree governs only sends?
3. What can be guaranteed to work that is already in flight when the tree is rebuilt, in a concurrent,
   multi-carrier system?
4. Which consumer structure belongs in declared trees at all, and how should deeper, changing and returned
   structure work?
5. What are we not seeing?

## Context

### System overview

Several open-source repositories in one organization share a message-passing model. They are built by a
very small team working with many AI coding agents in parallel.

| Project | Role |
| --- | --- |
| **Deixis** | A specification with four small libraries (Rust, Go, TypeScript, Python) for finite trees with byte-string keys and one opaque value at every node. It fixes shape, paths, identity and composition laws, and gives values no meaning. Released as v0.2.0. |
| **Bitwire** | The shared *access contract*: a one-method send interface (`Wire`) and a three-method extension (`Endpoint`), plus laws and independent conformance cases. It has native declarations in Go, TypeScript, Python, Rust, Swift, C++, Java and Haskell. It owns meaning, not implementations. Contract 0.2.0 is released; everything below is unreleased. |
| **Nightseam** | A runtime and code generator implementing the contract. It provides carriers, dispatch, an invocation lifecycle, "live references" (callables passed by reference across connections), and Go and TypeScript adapters generated from JSON protocol declarations. v0.6.0 is released; the API discussed here is on its main branch and unreleased. |
| **Consumers** | **BitTree** models a whole repository as one tree, down to syntax nodes. **Bitsystem** is a kernel of typed "spaces", each an own model with named children. Both are deciding how to model their structure. **Bitlink** is a planned second generator. |

The paradigm is capability-style and asynchronous:

- holding access is what lets you send;
- sending returns on acceptance or refusal, never on completion;
- replies travel back on a capability carried inside the message.

Go and TypeScript are the primary implementation languages. Everything is before 1.0, and correctness and
composability matter far more than raw performance. Each project numbers its own decision records:
"Deixis 0010" and "Bitwire 0006" are separate series.

### Vocabulary

These are the base terms, in the order they are first needed. Terms specific to one section are defined
there.

- **Wire, origin.** A Wire is send-only access to some place, called its **origin**. `Send(path, message)`
  addresses a destination *relative* to that origin. "Origin" has three uses below, and each is flagged
  where it occurs:
  - the place a Wire addresses;
  - a composite's own behavior at `[]`;
  - in the bridge of section 4 of the code, the endpoint whose receive side is borrowed.
- **Path, segment.** A path is a sequence of opaque Unicode strings called segments. There is no separator
  parsing and no normalization, so `[]`, `[""]`, `["a/b"]` and `["a","b"]` are four different paths. `[]`,
  the empty path, addresses the origin itself.
- **Selection, view.** `at(w, p)`, written `At` in Go, is a *view*: access that prepends `p` to every path
  sent through it. Creating a view never fails. Sending through it may.
- **Endpoint.** A Wire plus two more capabilities:
  - `Receive(receiver)`, which attaches the *single* receiver for everything delivered to this origin;
  - `Close`.

  Passing a Wire never grants those two.
- **Frame kinds.** Every message is one of four:
  - **request**: has an ID, expects a response;
  - **event**: one-way;
  - **response**: answers a request by ID;
  - **cancel**: withdraws a request by ID.
- **Return capability.** In code this is `ReturnAddress`. A request carries a local object holding *send
  access back to its caller*. It is never serialized. Replies are sent to it, not routed by path. Its
  pointer identity is meaningful and must survive routing.
- **Acceptance.** `Send` returning no error means the message was accepted for delivery, not that the
  destination acted on it. The documents call this "admission". Below, "admitted" means only this.
- **Runtime-established context.** Per-request state, such as the authenticated principal, that the runtime
  associates *privately* with a return capability. It is never reconstructed from message fields, and a
  sender cannot forge it through metadata.
- **Message profile.** The fixed frame format. It carries version, kind, ID, JSON payloads, trace headers
  (`traceparent`/`tracestate`) and a string map `meta`. Only these fields, plus the encoded path, cross a
  process boundary.
- **Carrier.** Something that moves messages between two endpoints: an in-process **local pair**, a
  WebSocket **peer** (one connection's endpoint), or a **tunnel channel** multiplexed over a peer. A carrier
  that crosses a process boundary serializes only profile fields, mints its own request IDs (strictly
  increasing per connection and direction), and gives the receiving side fresh return capabilities.
  - The **carrier root** is the empty-path origin of a carrier endpoint. A request or event sent to a
    carrier root at `[]` is refused.
- **Raw access.** A carrier endpoint used directly, not through any composite.
- **Forwarder.** `ForwardWire(a, b)` joins two endpoints: messages arriving at either are sent out of the
  other, unchanged.
- **Dispatcher.** A receive-side router. It owns an endpoint's single receiver slot and routes deliveries to
  handlers registered by exact path or longest prefix.
- **`method_not_found`.** The error code a dispatcher sends *in a response* when a request names an
  unregistered path. It is one kind of `PublicError`, a `{code, message, data}` error that crosses the wire.
- **Publication.** A request is *published* once anything beyond the local sender might act on it. When
  `Send` fails synchronously, the runtime wraps the error as `Unpublished`: local proof that nothing was
  published. Some cleanup depends on that proof, as section 6 of the code shows.

**Notation primer.**

| Notation | Meaning |
| --- | --- |
| `×` | Pairs (product type). |
| `FinMap[K,V]` | A finite map. |
| `m[k]` | Lookup, defined only when `k ∈ dom m`, where `dom m` is the key set. |
| `{k ↦ v}` | Map literal. `{k: v}` in the contract means the same. |
| `x ↦ e` | An anonymous function. |
| `Key*` | Finite sequences of keys. |
| `ε` | The empty tree path (the Wire side writes `[]`). |
| `++` | Concatenation. |
| `k : p` | A path whose first segment is `k`. |
| `‖` | Byte concatenation. |
| `⇀` | A partial function. |
| `≡` | Kleene equality: both sides are defined in exactly the same cases and equal where defined. |
| `≈` | An equivalence relation. In Deixis it is a *parameter* supplied by each consumer. Bitwire instantiates it as its observational equivalence (defined below). |
| `≅` | Structural identity of retained parts. |
| `⊥` | A *defined* access that refuses every send. It is **not** "undefined": the difference between refusing and undefined matters below. |
| `at` / `At` | Lowercase `at` is tree navigation in Deixis formulas and view creation on the Wire side. Capital `At` in Deixis laws is the consumer's selection operation. In Go code, `At` is the view constructor. |

Law labels are prefixed **D-** (Deixis) or **B-** (Bitwire decision 0006), because some letters recur with
different meanings.

### The tree model (Deixis v0.2.0)

This is the core, from Deixis decision 0010:

```text
Key  = Bytes
Path = Key*

Node[T] = Node(T, FinMap[Key, Node[T]])       every node carries exactly one T

own     : Node[T] → T
at      : Node[T] × Path ⇀ Node[T]
valueAt : Node[T] × Path ⇀ T

own(Node(t,m)) = t
at(n,ε) ≡ n
at(at(n,p),q) ≡ at(n,p ++ q)
at(Node(t,m),[k]) ≡ m[k]                      exactly when k ∈ dom(m)

decompose(Node(t,m)) = (t,m)                  compose((t,m)) = Node(t,m)
(D-R0) compose(decompose(n)) ≡ n              (round trip: parts, then node)
(D-R1) decompose(compose((t,m))) ≡ (t,m)      (round trip: node, then parts)

map(f,Node(t,m)) = Node(f(t), {k ↦ map(f,m[k])})
at(map(f,n),p) ≡ map(f,at(n,p))
```

- **Optionality is explicit.** It is a choice of value type, `Node[Option[T]]`.
- **Missing paths are navigation results, never values:** "Missing paths refuse; no default value or node is
  created."
- **Identity is lifted, not defined.** Two trees are identical iff they have the same set of paths and
  values related by the consumer's `≈` at every path. The value type is called the **slot**, and its `≈`
  may be undecidable, as with functions compared extensionally. Deixis adds no object identity.
- **Contexts and cuts are exact.**
  - Splitting a tree at a path gives a one-hole *context* plus the subtree, and plugging the subtree back is
    the inverse.
  - For any prefix-free set `F` of existing paths, cutting into a *skeleton* plus the subtrees at `F`, then
    rebuilding, is the identity.
- **Attachment is conservative.** `attach(A, p, k, B)` adds `B` at a fresh key `k` under `p`, never
  replaces, and keeps every old value. But "structural value preservation is not behavioral invariance under
  growth": a parent that lists or aggregates its children behaves differently after a child is added.
- **Overlay has no universal unit.** `A ⊔ B` is defined only when values agree on every shared path,
  including the root.

Deixis also states what a consumer's *interpretation* owes. An interpretation `I` maps a tree to
behavior, in a **binding context** `γ`: whatever an interpretation needs to know about where a subtree is
placed. `γ·p` is that context extended by path `p`, and `Comp` is the consumer's node constructor.

```text
(D-H) I(compose((t,m)),γ)  ≈ Comp(γ, t, {k ↦ I(m[k], γ·[k])})       homomorphism
(D-A) At(I(n,γ), p)        ≈ I(at(n,p), γ·p)                         selection commutes
(D-G) b ≈ b'  ⇒  C[b] ≈ C[b']                                         congruence
(D-V) I_r(n,γ) ≈ I_s(n,γ)                                             realization invariance
```

In (D-G), `C` is an admitted *assembly context* (an assembly with one hole), and `C[b]` fills the hole
with `b`. In (D-V), `r` and `s` are two *realizations* of the same logical tree, for example in-process
versus behind a relay, or cut differently. Deixis notes that (D-H) and (D-G) are different claims, and that
structural reconstruction proves none of them for a particular implementation.

**Deixis's doctrine about interaction** (its "wires" note) matters here in three ways.

1. **The routing law.** It is `connect(a) / p ≈ connect(a ++ p)`:
   - `connect` turns an address into access;
   - `/ p` resolves path `p` below something;
   - the law says addressing and resolution commute.

   Where it is undefined, it "refuses — never default-routes".
2. **Functions cannot be conveyed.** The doctrine distinguishes two *wings*: data conveys by copying bytes,
   and interaction conveys by relaying messages. A function sits on neither.
   - It cannot be copied, because behavior has no computable canonical bytes.
   - A relay for it must interpret calls.

   So the portable thing to place in a tree is a **name**. A local **binder** resolves the name to an
   **end**, a send capability. A closure in the tree is a lawful realization only in-process, on the
   degenerate "identity wire" where a send is a direct call. The claim that the routing law holds across a
   process boundary is stated but not yet backed by tests.
3. **Mounts.** "A position that carries a mount *and* children of its own must declare which answers a path
   below it — an interpretation rule, never a default." Here a mount is a node whose value splices in
   another node's paths. A binder that sends unknown names to a fallback is a forbidden "repair pass".

### The access contract (Bitwire)

This is abridged from the Go declaration. Nightseam imports the package as `bitwire`.

```go
type Code int // termination code; 1000 is a normal closure (WebSocket convention)

type ProfileKind string

const (
	ProfileRequest  ProfileKind = "request"
	ProfileResponse ProfileKind = "response"
	ProfileEvent    ProfileKind = "event"
	ProfileCancel   ProfileKind = "cancel"
)

// Wire is send access to an origin. It grants neither receive attachment nor
// endpoint lifecycle control. Send returns when accepted or refused, without
// running a destination handler on the sender's stack or waiting for its result.
type Wire interface {
	Send(path []string, message Message) error
}

// Endpoint: Receive attaches one owning receiver for every relative path. A second
// attachment is refused until the first is detached. Detach is idempotent and does
// not close the endpoint.
type Endpoint interface {
	Wire
	Receive(receiver Receiver) (detach func(), err error)
	Close(code Code, reason string) error
}

type Receiver struct {
	Message func(path []string, message Message) // deliveries relative to this origin
	Closed  func(code Code, reason string)
}

type Message struct {
	Frame  ProfileFrame   // Version, Kind, ID, JSON Params/Result/Error/Data, trace, Meta
	Return *ReturnAddress // local return capability; never serialized
}

type ReturnAddress struct{ Wire Wire }
```

The contract already has two composition operations:

- selection `at`;
- **mount** `mount({k: w, …})`, which consumes one segment, delegates to the named child, and has nothing at
  `[]`.

```text
at(w, [])                ≈ w
at(at(w, a), b)           ≈ at(w, a ++ b)
at(mount({k: w}), [k])    ≈ w
```

Composition preserves the complete message:

- the original return capability, compared by pointer;
- its runtime-established context.

It also creates no peer, channel or queue, and grants no ownership over borrowed endpoints: closing a mount
leaves its children usable.

### Declared composites (Bitwire decision 0006, accepted 23 September 2026)

**Keys first.** A Deixis key is bytes, and a Wire segment is a Unicode scalar string. The mapping is exact
UTF-8:

```text
key : Segment → Key         key(s) = UTF-8 bytes of s     (a bijection onto valid UTF-8)
key⁻¹                       its inverse, defined only on valid UTF-8
path(s₁ … sₙ) = key(s₁) … key(sₙ)                         (so [] is ε and [""] is one empty key)
```

There is no normalization. U+00E9 (a precomposed "é") and U+0065 U+0301 ("e" followed by a combining acute
accent) are different keys. Byte strings that are not valid UTF-8 have no Wire counterpart. In Go that means
invalid UTF-8 strings; in TypeScript it means strings with unpaired surrogates.

**The realization.** The value at every node is its **origin** (second sense): the behavior for a message
sent at `[]`. Every named child is **complete** access, meaning a whole capability retained as it is and
never unwrapped.

```text
Segment = Unicode scalar string        Access = send access (a Wire)
Origin  = Message → accepted | refused (behavior at [], never sees a path)
Parts   = Origin × FinMap[Segment, Access]

compose : Parts → Access               parts : admitted composite → Parts (held by its constructor)
refuse  = the origin that refuses every message (Go: RefusingOrigin{})

send(compose(o, m), [],    x) = o(x)
send(compose(o, m), k : p, x) = send(m[k], p, x)      when k ∈ dom m
                              = refused               otherwise

I(Node(o, m)) = compose(o, {key⁻¹(k) ↦ I(m[k])})      the binding context γ is trivial:
                                                       a child behaves the same wherever it is placed
mount(m)      = compose(refuse, m)
```

The origin is never a fallback for a missing child. A refusing origin is a value, not an absence.

**Construction.** Construction takes an origin and a *list* of `(segment, access)` entries. It refuses the
following:

- a missing origin or child;
- a segment outside the key image;
- duplicate segments, checked before a native map could silently drop one.

It copies its input containers; the capabilities themselves are borrowed. Children must exist before their
parent, so the *description* is finite and acyclic. The routing graph need not be. A child that forwards
back into its ancestor forms a cycle at run time, and nothing refuses it (inferred, not tested).

A child is either another declared composite, whose parts its constructor also holds, or **opaque**
access: an endpoint, a view, a forwarder, a guard, or a runtime mount. Decomposition stops at opaque
children. In Deixis terms, such a composite is a declared skeleton whose holes hold complete access.

**Parts, assembler, bound access.**

- The **assembler** is whoever constructed a composite. It alone holds the **parts**: the origin and the
  child list.
- What it hands out is **bound access**, a separate send-only Wire. There is no method on a Wire that
  enumerates or unwraps anything, and the decision adds none. An arbitrary Wire is not decomposable.
- A missing child and an existing childless child whose origin refuses produce the same refusal. Only the
  parts distinguish them.
- Rebuilding from views selected out of a composite is equivalent in behavior but is not the same
  description. It routes through the old composite and cannot recover the origin.

**Interception is composition around access, not a node value.** An earlier, unreleased draft (decision
0005) stored an admission policy in each node. A selected child was then the child *seen through* its
ancestors' policies, so selection needed a non-trivial binding context and did not realize
`at(Node(t,m),[k]) = m[k]`. Decision 0006 replaces that with a **guard**, an ordinary access wrapper:

```text
guard(P, w)             : Access
send(guard(P, w), p, x) = send(w, p, x)   when P(p, x) permits;   refused otherwise
```

A guard is opaque. As a child, it keeps the child law exact. Around a composite, selecting through it
checks `P` once per send. The old policy-bearing node is recovered as `guard(P, compose(o, …))`. Wrapping
views selected through a guard in the same guard again checks twice.

**Laws.** Here `c = compose(o, m)` is admitted, and `origin(w) = x ↦ send(w, [], x)`:

```text
(B-S0) at(w, [])                 ≈ w                        (S: selection)
(B-S1) at(at(w, p), q)            ≈ at(w, p ++ q)
(B-S2) at(c, [k])                ≈ m[k]        k ∈ dom m
(B-S3) at(c, [k])                ≈ ⊥           k ∉ dom m
(B-O)  origin(c)                 ≈ o                        (O: origin)
(B-R0) compose(parts(c))         ≈ c                        behavioral; weaker than D-R0's ≡
(B-R1) parts(compose(o, m))      ≅ (o, m)                   same capabilities by identity, exact keys
(B-M)  mount(m)                  ≈ compose(refuse, m)       (M: mount)
(B-A)  for a Deixis tree n whose keys are all valid UTF-8:
       at(I(n), p) ≈ I(at(n, path(p)))   where the tree defines at(n, path(p));   ≈ ⊥ otherwise
```

Undefined navigation implies refusal, but refusal does not imply undefined navigation. The laws also cover
cuts and substitution:

- **Complete cuts.** Reusing any prefix-free set of declared subtrees whole and rebuilding above them gives
  an equivalent composite, and any two such cuts agree.
- **Substitution.** A child may be replaced only by one equivalent *in the assembly's context*, including
  any state it shares with the rest of the assembly. A fresh copy of a stateful child is not such a
  replacement.

**Observational equivalence `≈` (Bitwire's instance).** Two accesses are equivalent when every admissible
observing context, started from related states, observes the same things through each. An admissible
context holds only the access it was given plus independent access to shared state. The observations are:

- acceptance or refusal of each send;
- which origin or child receives it, and at which relative path;
- the unchanged message, including return-capability pointer and runtime-established context at every
  local hop;
- later replies, events and invocation outcomes;
- per-sender acceptance order;
- effects on shared state visible through other access;
- authority and lifetime.

The identity of the access objects themselves, and timing beyond order, are not observed. Across a carrier,
the relation uses the carrier's mapping between local return capabilities and wire request IDs, and assumes
the carrier is connected, ordered and nonfaulting. Faults are separate outcomes.

### Relevant code

All Nightseam code is from its main branch at commit `dfacbb27`, 24 September 2026. Comments marked
`// [annotation]` are ours.

#### 1. Production construction (`nightseam: duplex/go/declared.go`)

```go
var (
	ErrDeclaredValue       = errors.New("declared composition requires an origin and complete child access")
	ErrDeclaredChildExists = errors.New("declared child key already exists")
)
// [annotation] Also used: ErrNoRoute ("wire path has no destination"), the one sentinel returned both
// by RefusingOrigin and for a missing child, which is why behavior cannot distinguish them; and
// EncodePath(path), which length-prefixes segments and returns ErrPath if any segment is not valid
// UTF-8 (Go strings are byte strings, so this is where scalar validity is enforced).

// RefusingOrigin is explicit origin behavior for a node which only groups children.
type RefusingOrigin struct{}

func (RefusingOrigin) Send([]string, bitwire.Message) error { return ErrNoRoute }

// DeclaredChild retains complete send access: an endpoint, selected view, forwarder,
// guard or another bound composite. Its internal structure need not be declared.
type DeclaredChild struct {
	Key  string
	Wire bitwire.Wire
}

// Declared is an immutable construction description owned by an assembler. Origin and
// child capabilities are borrowed, retaining their state and identities. Bind returns
// separate send-only access; callers cannot recover these parts from it. The zero value
// is not an admitted description.
type Declared struct{ node *declaredNode }

type declaredNode struct {
	origin   bitwire.Wire
	children map[string]bitwire.Wire
}

// ComposeDeclared copies a complete sequence of child entries, refusing duplicates before a
// native map can overwrite them. Keys are exact Unicode scalar strings; empty keys are allowed.
// Origin handles only [], never missing-child fallback. Nil origins or children (including typed
// nils) are refused. Construction acquires no receiver attachments, queues, peers, invocation
// state or lifecycle authority.
func ComposeDeclared(origin bitwire.Wire, children []DeclaredChild) (Declared, error) {
	if missingDeclaredWire(origin) { // [annotation] nil, or a Go interface holding a nil pointer
		return Declared{}, ErrDeclaredValue
	}
	routes := make(map[string]bitwire.Wire, len(children))
	for _, child := range children {
		if _, err := EncodePath([]string{child.Key}); err != nil {
			return Declared{}, err
		}
		if missingDeclaredWire(child.Wire) {
			return Declared{}, ErrDeclaredValue
		}
		if _, found := routes[child.Key]; found {
			return Declared{}, ErrDeclaredChildExists
		}
		routes[child.Key] = child.Wire
	}
	return Declared{node: &declaredNode{origin: origin, children: routes}}, nil
}

// Decompose returns the original origin and complete child access, ordered by exact UTF-8 key
// bytes. Only the containers are copied. Opaque children are never inspected or unwrapped.
func (d Declared) Decompose() (bitwire.Wire, []DeclaredChild) { /* [annotation] sorted copy; zero value -> (nil, nil) */ }

// Bind grants only send access to this immutable description. Each send delegates the unchanged
// message once, to the origin at [] or to the named child with one segment removed. Every frame
// kind follows the same rule. Validation, admission, asynchronous dispatch and invocation lifetime
// belong to the destination/profile; guards are ordinary Wire wrappers. Existing access stays bound
// after an assembler rebuilds or replaces its description. There is nothing to attach or close here.
func (d Declared) Bind() bitwire.Wire { return &declaredWire{node: d.node} }

type declaredWire struct{ node *declaredNode }

func (w *declaredWire) Send(path []string, message bitwire.Message) error {
	if w.node == nil {
		return ErrDeclaredValue
	}
	if _, err := EncodePath(path); err != nil { // [annotation] whole path validated before routing
		return err
	}
	if len(path) == 0 {
		return w.node.origin.Send([]string{}, message)
	}
	child, found := w.node.children[path[0]]
	if !found {
		return ErrNoRoute // [annotation] synchronous; never falls back to the origin
	}
	return child.Send(append([]string{}, path[1:]...), message)
}
```

The TypeScript version is equivalent. It holds its parts in private fields, returns a frozen `{send}` object
from `bind()`, throws instead of returning errors, and has no zero value.

This API replaced an unreleased predecessor, which "What we've considered" describes.

#### 2. What the generator emits, and why

A **family** is a JSON-declared protocol with two **sides**, server and client. Under each side, `methods`
are request/response operations that the side serves, and `events` are one-way messages that the side
emits. A side therefore *receives* its own methods plus the other side's events; these are its
**operations**, and each is one path segment. A **model** is an implementation of one side. Generated code
provides two functions:

- `ToWire(model)` exposes a model as an endpoint;
- `FromWire(endpoint)` interprets an endpoint as a typed proxy of the remote side.

Here is a fragment of a test-fixture family called "probe". `Payload`, `Seen` and `Payloads` are declared
data types.

```json
{
  "server": {
    "methods": { "echo": {"request": "Payload", "result": "Payload"}, "no_args": {"result": "string"},
                 "seen": {"request": "Seen", "result": "Payloads"} },
    "events":  { "changed": {"type": "Payload"} } },
  "client": {
    "methods": { "reverse": {"request": "Payload", "result": "Payload"} },
    "events":  { "noticed": {"type": "Seen"} } }
}
```

The **identity check** is a reserved operation, `identity.check` (`runtime.IdentityMethod`). Before a proxy
is used, `FromWire` sends it to compare a digest of the declaration. On a mismatch the proxy fails.

- A remote `method_not_found` counts as "no identity to compare", and passes.
- The name prefixes `identity.`, `live.`, `channel.` (tunnels) and `auth.` belong to runtime layers. The
  generator refuses any family operation in them.

The generated server binding registers exactly what the server receives, plus the identity responder. It
then emits a description of the same domain:

```go
// [annotation] Summary of ToWire, not generated text: create a local pair; attach a dispatcher to one
// end; register identity.check; then register "echo", "no_args", "noticed", "seen" with RegisterWire
// (exact-path handlers). The names come from deliveredNames: the sorted unique names of every
// method and event this side receives.

// Declared describes access to this side's model as a declared composition of
// its complete operation domain: every operation it receives, and the identity
// check, is a child that selects that path on access. The origin refuses. An
// assembler composes guards around the children it rebuilds from the parts.
func Declared(access bitwire.Wire) (duplex.Declared, error) {
	children := make([]duplex.DeclaredChild, 0, 5)
	for _, name := range []string{runtime.IdentityMethod, "echo", "no_args", "noticed", "seen"} {
		children = append(children, duplex.DeclaredChild{Key: name, Wire: duplex.At(access, []string{name})})
	}
	return duplex.ComposeDeclared(duplex.RefusingOrigin{}, children)
}
```

Here `duplex` is Nightseam's composition package from section 1. `access` is any Wire that reaches the
model: the endpoint `ToWire` returned, or a carrier endpoint.

**Why this exists.** A send-only Wire cannot tell an assembler which operations are behind it. The generated
description gives the assembler the complete, exact list as parts. It can then do three things without
knowing the service:

- wrap a guard around one operation;
- remount or replace a single operation;
- nest the service under nodes of its own.

The documentation prescribes exactly this: "to guard single operations, [the assembler] rebuilds the
description from its parts with guards composed around those children". No code does it yet for a generated
service.

**What it costs, compared with raw access:**

- **The identity child becomes mandatory.** Without it, `identity.check` would be refused *locally* and the
  proxy would fail, whereas over raw access a missing responder is tolerated.
- **Undeclared names are refused differently.** They are refused synchronously, where raw access would
  publish the request (section 6 of the code).
- **The domain is closed only at the first segment.** `["echo", "x"]` passes through as
  `access.Send(["echo","x"])`.

The generated origin always refuses. An assembler can replace it, because `Decompose` returns it.

#### 3. Presenting a model through declared access, and the conformance scenario

Every generated family also gets a test helper that presents its model through declared access. In that
helper, `adapter` is the family's generated package from section 2, `wire` is the model's endpoint, and
`once` makes the cleanup idempotent.

```go
func Declared(_ context.Context, wire bitwire.Endpoint) (bitwire.Endpoint, func(), error) {
	family, err := adapter.Declared(wire)            // [annotation] errors elided below
	root, err := duplex.ComposeDeclared(duplex.RefusingOrigin{}, []duplex.DeclaredChild{{Key: "family", Wire: family.Bind()}})
	view := duplex.Through(wire, duplex.At(root.Bind(), []string{"family"}))   // Through: section 4
	return view, once(func() { _ = view.Close(1000, "") }), nil
}
```

`"family"` is just a key label. The helper is generated for every family. It is exercised over pipes,
WebSockets and tunnel channels for one fixture family.

A separate conformance scenario builds a guarded tree for a generic "cell" service. Each child edge below
is labeled with its key, and brackets are guard wrappers:

```text
[root guard] → root (refusing origin) ─"svc"→ [svc guard] → cell description (refusing) ─ one child per operation → carrier
```

- `"svc"` is just the key under which the scenario places the service.
- The **direct** presentation drops the root: `[svc guard] → cell description`.
- The **selected** presentation is `At([root guard], ["svc"])`.
- The **reconstructed** presentation first rebuilds both descriptions from their parts.
- The **forwarded** presentation puts a local forwarder in front of the carrier.

The guards count checks and pass cancels through unchecked:

```go
type declaredGuard struct {
	gate  *declaredGate // [annotation] admit() counts a check; if armed by refuseNext(), refuses once
	inner bitwire.Wire
}

func (g declaredGuard) Send(path []string, message bitwire.Message) error {
	if kind := message.Frame.Kind; kind == bitwire.ProfileRequest || kind == bitwire.ProfileEvent {
		if err := g.gate.admit(); err != nil {
			return err
		}
	}
	return g.inner.Send(path, message)
}
```

Responses never pass through the tree, because they go to return capabilities. In practice, cancels are
the only thing guards pass through unchecked.

The cell service's `round_trip` method calls back into the caller's `mirror` method, then emits an event.
The scenario has 36 table-driven cases across local pairs, WebSockets and tunnel channels. CI runs them in
three of the four Go/TypeScript language pairings, and the fourth has passed locally. It observes:

- calls, the callback, and events in both directions;
- one guard refusal, after which everything stays usable;
- a reply delayed across a complete rebuild and a *rebind*, meaning `svc` is replaced with a description
  over a different target;
- a caller's cancellation crossing the carrier both ways;
- metadata;
- teardown that leaves the borrowed carrier usable.

#### 4. The bridge from send-only access to an Endpoint (`nightseam: duplex/go/through.go`)

`FromWire` must *receive* from the model: callbacks, events and identity requests. So it takes an
Endpoint. Declared access is send-only. `Through(origin, access)` joins the two. Here "origin" is the third
sense: the endpoint whose receive side is borrowed.

```go
// Through is an endpoint that receives on a borrowed origin and sends through
// separately composed access, such as declared bound access over that origin.
// Its single receive attachment borrows one attachment from origin. Closing it
// detaches that attachment and leaves both origin and access usable; an ending
// origin ends it too.
func Through(origin bitwire.Endpoint, access bitwire.Wire) bitwire.Endpoint

// Send: after Close, returns ErrClosed; otherwise access.Send(path, message). Never uses origin.Send.
// Receive: refuses a second attachment (ErrReceiverExists); attaches one receiver on origin whose
//   deliveries pass through with unchanged paths -- not filtered by any declared domain.
// Close / origin ending: marks Through closed once, detaches its origin attachment, notifies the
//   receiver once; never closes origin or access.
```

`Through` never checks that `access` actually routes to `origin`. It notices the origin ending only while a
receiver is attached.

#### 5. A call, traced end to end

1. The typed proxy calls `CallWire(proxyWire, ["echo"], params)`. `FromWire` wrapped the `Through` endpoint
   in a dispatcher for incoming traffic, and the dispatcher's `Send` passes outgoing paths through
   unchanged.
2. `Through.Send` hands the message to `At(root.Bind(), ["family"])`, which sends `["family", "echo"]` to
   the root composite.
3. The root consumes `family`, the family description consumes `echo`, and the child `At(access, ["echo"])`
   sends `["echo"]` to the carrier endpoint. Any guard on the way checks the request once.
4. A process-crossing carrier accepts the request. It maps its return capability to a wire request ID and
   serializes only profile fields.
5. The remote runtime creates a fresh return capability, establishes context, and its dispatcher routes the
   request to the handler.
6. The reply goes to the caller's original return capability. Routing is not involved.

Traffic toward the caller follows a different path:

- Callbacks and events arrive at the carrier endpoint, which is `Through`'s origin, and go unfiltered to the
  proxy's receiver.
- Replies arrive on return capabilities.
- Callables passed by reference are invoked over the connection directly (section 8).

**The tree governs only step 2 and step 3.**

#### 6. Three outcomes for "no destination"

| Where the name is missing | What happens |
| --- | --- |
| A declared composite, or a mount | `Send` returns `ErrNoRoute` **synchronously**. `CallWire` wraps it as `Unpublished`: nothing was published. |
| A remote dispatcher (raw access) | The request is accepted and published, then answered **asynchronously** with `method_not_found`. An unknown *event* is silently dropped. |
| A forwarder whose destination refuses synchronously | The forwarder answers the request with an error (code `internal`, because `ErrNoRoute` is not a `PublicError`) and **detaches itself in both directions**. This is tested for a destination refusing with `busy`, and inferred from the code for `ErrNoRoute`. |

The dispatcher's branch:

```go
// nightseam: runtime/go/dispatcher.go. registration is the exact-or-longest-prefix match
// (nil if none, or if the dispatcher is closed); sendWireResponse sends a response frame with
// this error to message.Return at [].
if registration == nil || registration.receiver.Message == nil {
	if message.Frame.Kind == bitwire.ProfileRequest {
		_ = sendWireResponse(message, nil, &PublicError{Code: "method_not_found", Message: "Unknown method"})
	}
	return
}
```

The live-reference layer (section 8) discards callables exported for a call only on local proof of
non-publication. The same logical mistake, calling an operation that is not there, therefore leaves
different state depending on where it is detected:

- detected by a composite, those callables are discarded immediately;
- detected by a remote dispatcher, they stay held by their owner until released.

The identity check diverges in the same way (section 2). One more consequence: because composites refuse
synchronously, **a sender can probe which names a composite declares**. The decision says send access
reveals no structure. Whether this membership reveal is acceptable has not been decided.

#### 7. Invocation lifecycle and cancellation

Nightseam's **invocation lifecycle** is a public protocol that routers and handlers use to report a
request's progress to the runtime that accepted it. They send to the request's return capability at paths:

- `invocation.capture`: a router records which handler the request was routed to;
- `.ready`;
- `.begin` and `.done`: the handler body is running, then finished;
- `.release`;
- `.control`: relays a cancel.

A **control** is a lifecycle message such as a relayed cancel. A **traversal** is one pass of a request
through one router. The receive-side dispatcher never routes a cancel by current registrations:

```go
// nightseam: runtime/go/dispatcher.go (excerpt)
// A control belongs to the traversal that captured it, never to the
// registration in force now. Handing it to the invocation is what keeps a
// detach or a rebind from retargeting an admitted request.
if message.Frame.Kind == bitwire.ProfileCancel {
	_ = RelayInvocationControl(message) // sent on message.Return at ["invocation.control"];
	return                              // silently dropped if Return carries no lifecycle
}
... // [annotation] match a registration (see section 6); events are delivered directly, uncaptured
capture, err := CaptureInvocation(message, func(control bitwire.Message) {
	registration.receiver.Message(slices.Clone(delivered), control) // the registration matched for this request
})
if err != nil {
	// [annotation] refuse the request: invalid_message if its Return carries no lifecycle,
	// busy past a bound of 64 captures per invocation
}
defer capture.Ready()
registration.receiver.Message(delivered, message)
```

On the **sending** side, a caller cancels by re-sending a cancel frame through the *same access value and
path* it used for the request. It discards any error:

```go
// nightseam: runtime/go/wire.go (callWire, abridged: trace headers and a forwarding branch omitted)
// cancelRemote: the caller's context ended (cancelled, or the 30 s default deadline) before a reply.
// address: the same *ReturnAddress pointer the request carried; it, not the ID, identifies the call
// locally (callWire always uses the ID "c:1"; distinct request IDs are minted only at carriers).
if cancelRemote {
	_ = wire.Send(path, bitwire.Message{Frame: bitwire.ProfileFrame{Version: 1, Kind: bitwire.ProfileCancel, ID: returning.id}, Return: address})
}
```

Bound access cannot be closed, and descriptions are immutable. So "rebuild the tree, then cancel" works:
the access the caller captured still routes to the same child. That depends on four conditions, each of
which can fail:

- **The captured access must still be open.** A mount, a dispatcher's selected endpoint, a dispatcher or
  `Through` returns "closed" after `Close`. A cancel sent after that is lost silently, and the remote body
  runs until its own deadline (30 seconds by default).
- **Guards must pass cancels.** The documentation says a guard "must respect the profile's invocation
  lifecycle, including controls owed to an admitted request". Nothing enforces it.
- **Guards must keep the return capability.** A guard that replaces it breaks four things at once:
  - cancel correlation, which is keyed by return-capability pointer plus ID;
  - runtime-established context;
  - lifecycle participation;
  - admission, because a dispatcher reached without an intervening carrier refuses the request outright.
- **A forwarder must not meet a synchronous refusal.** Any synchronous refusal at a forwarder's destination
  detaches it (section 6).

#### 8. Live references travel outside the tree

A **live reference** is a callable passed by reference, for example a callback parameter or a returned
subscription handle. On the wire it is a JSON descriptor inside ordinary parameters or results. Its
lifetime has two parts:

- a **scope**, the set of callables exported over one connection;
- an **owner**, a lifetime that releases what it created.

Invocation does not use Wire paths:

```go
// nightseam: live/go/live.go. Two fragments from different functions. `peer` is the connection's
// *runtime.Peer, a lower-level object than bitwire.Wire: Handle registers a named method on it and
// Call issues a request on it, so neither passes through any Wire or composite.
if err := peer.Handle(InvokeMethod /* "live.invoke" */, s.onInvoke); err != nil { ... }   // in Over(...)
err := s.peer.Call(call, InvokeMethod, invokeParams{Binding: id, Contract: held.contract, Request: request}, &result) // in remote(...)
```

This has three consequences:

- **The tree cannot reach callables.** Declared composition, guards and refusal never see a callable
  passed to or returned from a declared operation. Callbacks therefore cannot be intercepted by guards
  composed around access.
- **Closing access does not revoke them.** Closing `Through` or a mount does not revoke a callable. Its
  owner does. Release uses its own event, `live.release`, which also bypasses the tree.
- **Relays do not translate them.** A raw forwarder onto a *different* connection passes the descriptors
  through untranslated. They then name nothing valid on the other side (`reference_unknown`). Generated
  converters must re-export them from one connection's scope into another's.

#### 9. How consumers relate

**BitTree** represents a repository as immutable, content-hashed syntax-tree nodes. Printing them back
reproduces the source exactly. Its Deixis instantiation is `Node[Label]`, where a label is a node's kind,
optional name and text:

```text
Key = u32 ordinal as 4 bytes big-endian ‖ field name in UTF-8
```

Keys are positional, and many are not valid UTF-8. Ordinal 128 encodes as `00 00 00 80`, and `0x80` alone
is not valid UTF-8. So these keys have no Wire counterpart under decision 0006.

BitTree's accepted remote-access design keeps operations and data apart:

> "Wire routes select operations; Bittree addresses are request data. A Wire path names the export and the
> operation. An address is a member of the request and is resolved by the one resolver on the server. …
> selecting a Wire prefix never scopes a tree."

The tree service is a flat family of 18 methods. A rival proposal is recorded without a verdict: "the tree
*is* a space: the address is the path, observations (snapshot sessions) are mounted children, composition
is mount". It names three frictions:

- non-UTF-8 names;
- dynamic children, since a mount takes a static map;
- BitTree's resolver is not exact one-segment routing. It passes through a file's *body* implicitly, selects
  by name then index, reads `01` as `1`, and loads deferred (not yet parsed) nodes along the way.

**Bitsystem** has *spaces*: an own model at every node plus named children, with `resolve([]) = s` and
`resolve([n] ++ rest) = child(n).resolve(rest)`. It is the closest structural fit, but it differs in four
ways:

- **Growth.** Children are added *after* the parent exists, when an applied effect spawns them.
- **Parenthood.** Every space has exactly one parent, whereas Wire allows one access under two keys.
- **Shared key domain.** Child names are arbitrary non-empty UTF-8, so a generated operation named `plan` and
  a child named `plan` would collide in one key domain.
- **Stated goal:** "discover a capability, invoke it, receive a new capability or space, and continue
  composing through the same foundation".

**Bitlink**, a planned second generator, would need to emit the same complete-domain description.

### What can go wrong: one index

Each row is labeled with its evidence and the question it bears on. Rows marked *conceptual* are what we
are asking about. *Implementation* rows will simply be fixed.

| # | Issue | Evidence | Kind | Q |
| --- | --- | --- | --- | --- |
| 1 | The tree governs only what its holder sends. Inbound callbacks and events, replies, live invocations and releases bypass it. | Source | conceptual | 1, 2 |
| 2 | A missing name is refused synchronously by a composite but asynchronously by a remote dispatcher. This leaves different publication evidence, different callable cleanup, and a different identity-check outcome. | Source. Tested for the general composite; untested for generated services. | conceptual | 1, 3 |
| 3 | Synchronous refusal lets a sender probe which names are declared. | Source | conceptual | 2 |
| 4 | One synchronous refusal detaches a forwarder in both directions, and the remote caller sees `internal`. | Tested for `busy`; inferred for "no route" | conceptual | 3 |
| 5 | A cancel is lost if the caller's captured access has been closed, or if a guard refuses it. A guard that replaces the return capability breaks correlation, context, lifecycle and admission. | Inferred; guard behavior documented, not enforced | conceptual | 2, 3 |
| 6 | `Through` pairs a send half and a receive half without checking they belong together, and delivers inbound traffic unfiltered. | Source | conceptual | 2 |
| 7 | The description is acyclic, but routing through opaque forwarding children can cycle without bound. | Inferred | conceptual | 3 |
| 8 | Live descriptors relayed onto another connection resolve to nothing without generated converters. | Documented | conceptual | 2 |
| 9 | Guarding a single *generated* operation is prescribed but never exercised. | Search of the repository | conceptual | 2, 4 |
| 10 | `Through` may close without notifying the current receiver on a stale ending from an earlier attachment. Some documentation disagrees with code. | Source reading | implementation | — |

### Constraints

**Fixed:**

- The access interface stays `Send` only. A new primitive needs an observable requirement that composition
  around the existing interface cannot meet.
- No enumeration or unwrapping through a Wire.
- Decomposition comes only from retained construction information: parts held by the assembler, or what a
  generator knows.
- Ownership:
  - Deixis owns the tree laws.
  - Bitwire owns this interpretation.
  - Nightseam owns carriers, lifecycle and generated code.
  - Each consumer owns its domain mapping.
- The message profile, for this release:
  - return capabilities are local and never serialized;
  - request IDs strictly increase per connection and direction;
  - runtime-established context is never reconstructed from message fields;
  - requests and events cannot be sent to a carrier root at `[]`.
- All eight language bindings share one meaning. Only Go and TypeScript have executable runtime evidence.
- The released 0.2.0 contract and v0.6.0 runtime are immutable.
- Generic undo, edit history and domain inverse operations are out of scope.

**Open to change:**

- the shape of the generated description, and whether to generate it at all;
- `Through`;
- the definition of `≈` and what the laws promise across carriers;
- where guards belong and what they must pass;
- whether synchronous refusal at composites is right;
- names versus live access in declarations;
- the key spelling for consumers.

### What we've considered

- **A policy value in every node (decision 0005, superseded before release).** It made interception
  structural, but a selected child was no longer the child. It was replaced by guards composed around
  access.
- **Only child-only mounts.** These cannot express behavior at a composite's own address. They are now the
  refusing-origin special case.
- **A cancellation table owned by the composite.** The predecessor API recorded each accepted request's
  destination so that cancels could be routed to it. The same predecessor also had a policy slot and deep
  lookup/attach helpers. The table duplicated the invocation lifecycle's job and made composites stateful,
  so it was removed in favor of callers re-sending through their captured access. Section 7 lists the cost.
- **Enumeration or introspection on Wire.** Rejected: it would grant structural authority to everyone who
  can send.
- **Dynamic structure through a prefix-routing dispatcher** instead of immutable composites. This is
  available now. BitTree's rival proposal points to it for per-observation children. It gives up retained
  parts and decomposition.
- **Generating only the operation-name list** rather than a description over access. It would avoid the
  mandatory identity child and the refusal change, but it leaves each assembler to build views itself.
- **Names versus live access in the tree.** Deixis's doctrine favors portable names resolved locally by a
  binder, which are comparable and content-addressable. The implementation stores live capabilities, which
  are local and compared by pointer. We have not decided whether declarations should carry names.
- **"The tree is the space" for BitTree.** Undecided. The accepted design keeps addresses in request data.

### Evidence status (24 September 2026)

| Realization | Result on Bitwire's 39 independent cases |
| --- | --- |
| Test-only reference interpreters (Go, TypeScript) | All cases pass, over local pairs and WebSockets in both directions. |
| Released runtime (Nightseam v0.6.0), child-only `Mount` | 20 conform. 19 are exact recorded gaps, meaning expected failures pinned in the suite: no constructor takes an origin, and conflicting, invalid or missing children are accepted. |
| Unreleased runtime API (Nightseam main) | All cases pass with no gaps, in both languages, over local pairs and WebSockets in both directions. |

- Two deliberate changes to the reference interpreter are caught by the suite. Letting a missing child fall
  back to the origin fails 3 cases, and rebuilding by copying subtrees fails 11.
- Bitwire's suite covers the general composite, not the generated description. The generated-service
  scenarios in section 3 are Nightseam's own evidence.
- Nothing yet exercises carrier faults, concurrent schedules, or the six other language bindings.

## Questions for the Expert

1. **What is this object?** How would you characterize a declared composite in established terms,
   especially the generated one: a refusing origin, one view per operation its side receives, and the
   identity check? What does that characterization predict should and should not hold?

   Framings we have looked at, though the list is not exhaustive:
   - object-capability facets and attenuation;
   - membranes;
   - per-process namespaces in the style of Plan 9;
   - interface or refinement types;
   - an initial-algebra interpretation of a tree;
   - coalgebraic behavior and bisimulation.

   A good framing should also account for these properties:
   - it equals the raw access only on its declared domain, and refuses synchronously elsewhere (index row 2);
   - it governs only what its holder sends (row 1);
   - its description is finite and acyclic, while routing through opaque children may cycle (row 7);
   - it holds live capabilities where Deixis's doctrine would place portable names.

   *Grounding:* "The tree model", "Declared composites", code sections 2 and 5.

2. **Authority and interception.** How would you arrange authority and interception across four things:
   - retained parts;
   - send-only bound access;
   - guards;
   - the `Through` bridge, which pairs send access with a receive attachment it cannot verify belong
     together?

   The tree governs only what its holder sends. Traffic that never passes through it includes:
   - inbound callbacks and events;
   - live invocations over the connection;
   - capability descriptors inside payloads crossing relays.

   What patterns from comparable capability systems would you apply?

   Context for the trust model: a family's operation list is public in its JSON declaration. What is
   actually private to an assembler is the *assembly*: which guards sit where, and what was rebound to
   what. Holders of bound access may be local code or remote peers.

   *Grounding:* "Parts, assembler, bound access", "Interception", code sections 4, 6 and 8; index rows 3, 6,
   8 and 9.

3. **Work already in flight.** How would you state what the model guarantees for work already accepted or
   in flight (requests, their cancels and their replies) when these conditions hold:
   - descriptions are rebuilt or rebound;
   - callers are concurrent;
   - messages cross several carriers and forwarders;
   - carriers can fault?

   And what should acceptance and synchronous refusal be allowed to prove to the sender? The concrete
   pressures:
   - cancellation is re-sent through the caller's *captured* access, and is lost if that access has been
     closed or a guard refuses it (row 5);
   - one synchronous refusal detaches a forwarder (row 4);
   - synchronous and asynchronous refusal leave different evidence about publication, and so different
     cleanup of callables and a different identity-check outcome (row 2);
   - faults are outside the current relation.

   The known alternative, a composite-owned cancellation table, was removed. What patterns from comparable
   systems would you apply?

   *Grounding:* "Observational equivalence", code sections 6 and 7.

4. **Consumer structure.** How would you decide which parts of a consumer's structure belong in declared
   routes, which in dynamic dispatch, and which in request data? And for what does belong in declarations,
   how would you keep them finite, retained by their owner, and consistent with the tree model's
   attachment, overlay and cut laws?

   Test cases:
   - positional keys that are often not valid UTF-8;
   - operations and child names sharing one key domain (a child named `plan` next to an operation `plan`);
   - names reserved by runtime layers;
   - children spawned after their parent exists, and per-observation children;
   - callables returned by calls;
   - growth, which preserves old values but not whole-subtree behavior.

   At which layer (Deixis, Bitwire, Nightseam or the consumer) should key spelling and the
   operations-versus-children question be settled?

   *Grounding:* code section 9, "What we've considered".

5. **Open.** Looking at the whole picture, what consequences, opportunities or risks of this composition
   model would you highlight that the questions above do not cover? That includes anything you would want
   settled or tested before this ships in a runtime release or a consumer adopts it.

## Applied

**Advice:** [0001-declared-composition-implications.advice.md](0001-declared-composition-implications.advice.md).
It came from run `run_345bdfe3-d76d-46b5-b0f5-161b0ba6c5c3`, and `nightfall consult verify` judged it genuine.

**Checked against:** Nightseam main at `dfacbb27`, which has not moved since the document was written, and
Bitwire main at `bcaf44c`. The document the expert read changed afterwards only in its status lines, so no
advice rests on text the expert did not see.

**Method:** three independent readers checked each premise against the source, one per area: the generator
and identity check, the in-flight lifecycle, and refusal, forwarding and resources. Each verdict below cites
their evidence.

**Verdicts:**
- **HOLDS:** the premise is intact.
- **ADAPT:** directionally right, but a detail differs.
- **STALE:** the premise was not true.

**Outcomes:**
- **Integrated:** changed in this pull request.
- **Decision:** needs the maintainer's call.
- **Nightseam:** belongs to the runtime.
- **Consumer:** belongs to BitTree or Bitsystem.
- **Later:** deferred by the advice itself.

| # | Recommendation | Verdict and evidence | Outcome |
| --- | --- | --- | --- |
| 1 | Keep the immutable composite, and keep guards as ordinary access wrappers. | HOLDS. This is the current design. | No change. |
| 2 | The generated description is a prefix restriction, not an exact operation set. Make generated children origin-only leaves unless suffix forwarding is intended. | HOLDS. Children are `At(access,[op])`, and nothing in generated code, live references, tunnels, lifecycle paths or documentation relies on paths below an operation. `ComposeDeclared(At(access,[op]), nil)` is accepted, and a leaf would not break identity, events, callbacks or cancels. Two side effects: a suffix error becomes a local `Unpublished` refusal instead of a remote `method_not_found`, and the golden files need regenerating. | Integrated: the prefix/exact distinction and the leaf pattern in decision 0006. Nightseam: change the generator. |
| 3 | Laws for prefix restrictions over the same access: `G_D(G_E(w)) ≈ G_{D∩E}(w)`, and idempotence. | HOLDS. They follow from the routing rule. | Integrated in decision 0006. Later: conformance cases. |
| 4 | Keep three things apart: the description (an algebra), bound access (interactive behavior), and the interpretation, which is not injective. | HOLDS. The decision already separates structure from behavior. | No change. |
| 5 | An interface framing needs qualifying: a declaration states intent, not implementation or coherence after rebinding. | HOLDS. | Recorded; see 27. |
| 6 | Keep live capabilities in the local assembly. Optionally, a portable manifest of names bound through an explicit authority environment. | HOLDS as a direction. Nothing implements it. | Later. |
| 7 | Acceptance, route capture and execution are different commitments. State a guarantee about stable traversals, not a global snapshot. | HOLDS. A dispatcher matches and captures when it *delivers*, and a carrier only queues. Detaching and re-registering between acceptance and delivery retargets the request. No document states where routing becomes fixed, although decision 0003 requires it. Every rebind test detaches after delivery. | Integrated: decision 0006's preservation table and clarifications. Nightseam: document where routing becomes fixed, and test a rebind between acceptance and delivery. |
| 8 | An opaque child can hold mutable routing state, so retaining it does not retain its destination. | HOLDS. | Integrated in decision 0006. |
| 9 | Keep composites stateless and give the runtime invocation lifetime. Provide graceful shutdown (stop admitting, keep owed controls, drain or reach a deadline) separately from abort. | HOLDS. Only abort exists. A peer close cancels every handler and drops queued responses and cancels, and generated cleanup settles no outgoing call. | Nightseam. Decision: whether the release needs graceful shutdown. |
| 10 | A guard that stops admission must still pass controls for admitted work, keep the return capability, and never derive authority from sender metadata. | HOLDS. Nightseam's documentation says so, but nothing enforces it, and a guard that swaps the return capability also breaks admission at a dispatcher. | Integrated as a rule in decision 0006. Nightseam: a standard guard helper. |
| 11 | Define cancellation at each phase: before acceptance, before capture, after completion, and concurrent with a reply. | ADAPT. Partly guaranteed already: a cancel before capture is latched and pushed on readiness, a queued cancel keeps its reserved slot, and completion is final. Three gaps remain: a cancel over a third-party asynchronous Wire, a local-pair deadline that fires while the request is still queued, and a physical cancel dropped when the output queue is full. | Nightseam: close the gaps and test them. |
| 12 | Make "synchronous refusal means nothing was published, and nothing will be later" an explicit obligation on every Wire implementation. | HOLDS as a gap. Every Wire in the tree complies, but Bitwire's contract assigns this evidence to the runtime and obliges nothing. An opaque tee or retrying guard that fails after an inner send succeeded would forge the proof and cause a wrongful unwind. | Decision: a Bitwire contract obligation across eight languages, or a Nightseam profile rule. |
| 13 | Do not make raw and declared refusals look alike. | HOLDS. | No change. |
| 14 | A refused message should fail only that request, not detach its forwarder. Give local routing refusals a deliberate public error code. | HOLDS. `ForwardWire` detaches in both directions on any synchronous error in Go and TypeScript. A route miss becomes `internal`, and a closed mount on the path also yields `internal`, because `duplex.ErrClosed` and `runtime.ErrClosed` are different errors. This contradicts Nightseam's own decision that busy is a refusal, not a failure. | Nightseam, before release. |
| 15 | Promise only a partial order. Do not promise order across a change of path. | HOLDS, with one overclaim found: Bitwire's contract said a forwarder "preserves their order". A Go peer delivers requests concurrently, so a forwarder keeps only the order in which its source delivers. | Integrated: contract corrected, and the order clarification added to decision 0006. |
| 16 | Separate three things: local assembly equivalence, transport realization, and fault behavior as a refinement of a lifecycle specification. | HOLDS as a direction, consistent with faults already being separate outcomes. | Integrated as a clarification. Later: a lifecycle specification for faults. |
| 17 | Retained parts carry authority. Delegate bound access, not parts. An origin Wire may accept more paths than the composite exposes. | HOLDS. `Decompose` returns the raw origin, and the examples use an origin (`At(caller,["storeInfo"])`) that accepts suffixes. | Integrated in decision 0006 and the contract. |
| 18 | Put interception in three places: admission guards on send access, ingress checks before trusted dispatch, and capability-aware gateways. | HOLDS. | Integrated in decision 0006. |
| 19 | Where a guard sits changes which paths it observes. | HOLDS. | Integrated. |
| 20 | This is not a membrane. Promise route-level attenuation only. | HOLDS. Live invocations and releases go over the connection, never the tree, and descriptors are not translated by relays. | Integrated in decision 0006, the contract, the binding READMEs and the poster fact sheet. |
| 21 | Treat `Through` as an asymmetric adapter. Give generated proxies a runtime-owned session assembly. Add a test that rebinds sends to a different carrier and then makes a new callback-bearing call. | HOLDS for `Through` and the missing test. The one conformance rebind reuses the same carrier with a different prefix, never installs it into `Through`, and makes no callback call. ADAPT for session assembly: a dispatcher's selected endpoints already share one receive slot, and generated `FromWire` works over them. They cannot replace `Through`'s send side, though, and several services on one carrier need a prefix convention on the far side. | Nightseam. |
| 22 | Narrow the confidentiality claim to "no operation recovers the assembly; behavior may reveal routes". | HOLDS. Decision 0006, all eight binding READMEs and the poster fact sheet overclaimed. | Integrated. |
| 23 | BitTree should keep its flat service with addresses as request data, and consider a repository- or snapshot-scoped service facet. Hex-encoding keys fixes only their spelling. | HOLDS. It matches BitTree's accepted design, and its resolver is not exact routing. | Consumer (BitTree). |
| 24 | Bitsystem should separate a space's model operations from its child namespace (for example `ops` and `children`), and choose explicitly between retained generations and live discovery. | HOLDS. It resolves the collision between an operation `plan` and a child `plan`. | Consumer (Bitsystem). |
| 25 | A returned callable is a new capability with its own lifetime, not an attached child. | HOLDS. | Integrated through the non-membrane clarification. Consumer. |
| 26 | Keep layer ownership as assigned. Runtime-reserved prefixes should not ban domain names at every depth. | HOLDS. The reserved prefixes apply only to generated operations. | No change. |
| 27 | Report the identity check as compatible, incompatible or unverified. A digest cannot certify an assembly whose operations were rebound separately. | HOLDS, and the verification found worse: a remote `method_not_found` counts as success and is surfaced nowhere. A misaddressed access such as `At(target,["elsewhere"])` passes the check as "absent". | Nightseam, before release. Decision: whether to require identity by default. |
| 28 | Say when a message becomes immutable, so that the data a guard checked is the data admitted. | ADAPT. Bitwire already covers "after admission" but not the window during `Send`. Go carriers validate before copying, so a concurrent mutation could admit bytes that were never validated. TypeScript copies first. | Decision: extend Bitwire's rule to cover the call to `Send`, which changes the Go and TypeScript doc comments. Nightseam: copy, then validate. |
| 29 | Make no termination claim for opaque routing, and give admitting components resource bounds. | HOLDS. There is no depth guard, and a Go cycle overflows the stack fatally. The capture bound resets at every carrier hop, and a non-amplifying event loop through a local pair circulates forever. | Integrated as a no-termination clarification. Nightseam: a cyclic-forwarding policy and resource bounds. |
| 30 | Seven conformance scenario families: generated facets, acceptance versus capture, shutdown and controls, refusal isolation, correlation races, carrier and reference boundaries, snapshot and input ownership. | HOLDS. Gaps the verification confirmed: none of the four duplicate-request refusal sites is tested, a stale ending after rebind is untested for `Through`, selected endpoints, local pairs and peers, and the late-reply and duplicate-response paths are untested. | Later. Split between Bitwire cases and Nightseam tests; not built here. |
| 31 | Before release, settle: exact versus prefix domains, synchronous-refusal evidence, how forwarders handle errors, acceptance versus capture, cancellation and close ownership, the scope of `Through`, and the non-membrane claim. | HOLDS. | Decision. The non-membrane claim and the capture wording are settled on Bitwire's side by this change; the rest is Nightseam's. |

No recommendation was stale.

**Integrated in this change:**
- decision 0006: dated clarifications, plus three corrected sentences;
- the contract's declared-composite section and its forwarder-order claim;
- all eight binding READMEs;
- the poster fact sheet;
- the changelog.

No native declaration or conformance case changes.

**Outside this change:**
- **Decisions and Nightseam work:** rows 2, 7, 9, 11, 12, 14, 21, 27, 28, 29 and 31.
- **Consumers:** rows 23 to 25.
- **Later:** rows 3, 6, 16 and 30.

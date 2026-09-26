# Research: Repository boundaries that follow a theory of contracts, realizations and instances

**ID:** 0002
**Date:** 25 September 2026
**Author:** Julian Matschinske <julian@matschinske.com>
**Status:** applied
**Run-ID:** run_a52b7f3e-c9dd-4f31-bd52-6f6df457b82f
**Submission log:** run_2250f8a8-a75f-411f-b77f-aa7d88452eae (account-1) failed inside the consult service after 28 seconds: "Nightjar session-control request timed out" (nightjar_unavailable), while that account was re-authenticating. The same uploaded document was resubmitted once, pinned to account-2.
**Document-ID:** doc_b6ca2a65-e4c8-453c-9165-3b5e25dead52

## Question

A small organization maintains a set of open-source repositories. Together they
give programs typed access to each other by sending messages, across languages.
One of them, **Nightseam**, held nearly everything: a declaration language, a
code generator, and the runtime that generated code runs on. Its maintainer has
discontinued it, and its pieces need new homes. Another, **Bitwire**, holds the
shared *wire contract*: the interface every program uses to send messages, its
laws, and conformance cases. This document lives in Bitwire.

The project already has a formal model, the **contract theory** described below.
It separates:

- a *contract* (a shape plus the behavior it allows) from its *realizations* in
  particular programming languages, and both from running *instances*;
- a *model world* (application interfaces and their types) from a *wire world*
  (addressed messaging). The two meet only in *adapters*;
- *generators*, which the theory treats as functions with contracts of their own.

Two repository maps are on the table:

- a **family design**, written in planning documents before Nightseam was
  discontinued;
- a **theory-derived map**, drafted by the agent preparing this document while
  discussing it with the maintainer.

Asked to choose, the maintainer asked for "the more principled approach". The
repository boundaries should follow from a principle the project can defend,
with the theory as the leading candidate, rather than from convenience or
history. Both maps are candidates to test, not constraints.

**The question: which division of repositories follows those seams, and by what
principle should the contested placements be decided?**

The advice will feed five decisions. None is implemented yet.

- **(a)** Should Bitwire, which owns the wire contract and its conformance cases,
  also ship the Go and TypeScript implementations: carriers, the protocol engine,
  operators? An accepted decision says so. The alternative is a separate runtime
  repository.
- **(b)** Should protocol declarations share a language with value types, or sit
  in a separate system-declaration layer?
- **(c)** Where do adapters, wire types, the generation kernel and canonical
  declaration identity live?
- **(d)** Where does the theory itself live?
- **(e)** In what order do six dependent repositories move off the frozen
  Nightseam?

**Useful advice would give us:**

- a principle for when a seam deserves its own repository rather than a module;
- a recommended division, with its dependency graph;
- the reasoning for the contested placements;
- comparable systems or literature;
- what we are not seeing.

### Reading guide

- **Status of the inputs**, then **Terms**: what is decided or open, and the
  equivalences used throughout.
- **Context**:
  - the paradigm and scale;
  - the theory and Deixis, the tree model it shares;
  - Bitwire today;
  - what Nightseam contains and how its parts couple;
  - the family design;
  - the six dependents;
  - constraints.
- **What we've considered**: one matrix comparing three maps piece by piece, then
  the contested placements. Each placement is tagged with the decision (a)–(e)
  and the question it feeds.

### Status of the inputs

| Input | Status | Open to challenge? |
| --- | --- | --- |
| The paradigm: Wire access, four message kinds, return capabilities | Released (Bitwire 0.2.0) | No |
| Bitwire decision 0006 (composites realize Deixis trees), 0008 (protocol revision identity), 0009 (carrier groups, byte-stream framing) | Accepted; 0006 implemented, 0008 and 0009 not | No |
| Bitwire decision 0007: "using Bitwire never requires Nightseam", and Bitwire also takes the implementations | Accepted 25 Sep 2026; only its independence check is implemented | The rule, no. Where the implementations live, yes. |
| Nightseam discontinued and frozen at v0.6.0 | Decided 25 Sep 2026 | No |
| The contract theory | Written and partly machine-checked; never adopted as an architecture | Yes, as a basis for boundaries |
| The domain graph (the theory applied to this system) | Proposed 22 Sep 2026; seven of its choices open | Yes |
| The family design | Planning documents from mid-September, before the discontinuation; no code | Yes |
| The theory-derived map | Drafted for this document | Yes |

### Terms

- **Seam:** a boundary crossed by a narrow interface, with dependencies pointing
  one way.
- **Wire, Endpoint, origin:** A *Wire* is send access to a place, its *origin*.
  `Send(path, message)` addresses something relative to that origin. An
  *Endpoint* adds receiving and closing.
- **Transport:** moves whole frames between two places, such as a WebSocket, a
  pipe, or a framed byte stream.
- **Carrier:** turns something into Wire endpoints. Over a transport, the carrier
  is the **protocol engine**; Nightseam's code calls it the **peer**. An
  in-process carrier needs no transport.
- **Profile:** the network protocol that frames messages as JSON: requests,
  responses, events, cancels, ids. It is named `nightseam.duplex/1` today; Bitwire
  decisions rename it `bitwire/1`. "Duplex" is also the name of a Nightseam package
  of transports and operators.
- **Operators:** functions from Wires to Wires: selection, mounting, forwarding and
  declared composition.
- **Dispatcher:** routes each delivered request to the handler registered for its
  path.
- **Return capability:** local send access back to a request's caller;
  `ReturnAddress` in code. It is never serialized.
- **Live reference:** a handle, carried inside a message, to a function living in
  another process.
  - A *scope* bounds one connection's references.
  - An *owner* holds references and supplies their lifetime.
  - *Release* ends a reference.
- **Tunnel:** many channels multiplexed over one connection.
- **Family:** Nightseam's unit of declaration, a directory of declaration files for
  one API. The set of repositories is "the project".
- **Bind and stub:** the theory's two adapter directions.
  - *Bind* turns a native implementation into Wire access; generated code calls it
    `ToWire`.
  - *Stub* turns Wire access into a native object; generated code calls it
    `FromWire`, and elsewhere it is called a client or proxy.
- **Descriptor:** the JSON description of a family's types that a runtime
  validator reads. Code calls it "schema"; bitschema calls it a "description". In
  generated code, the prefix `Wire…` (as in `WireSchema`, `WireDigest`) means "for
  use on the wire". It has nothing to do with the `Wire` interface.
- **Canonical declaration graph, digest:** a canonical JSON encoding of a
  declaration and everything it references. Its SHA-256 is the *digest*, which
  serves as the *declaration identity*. Other senses of identity are always
  qualified: *key identity* (Archon) and *tree equality* (Deixis).

## Context

### Paradigm, languages and scale

**The paradigm.**

- Programs hold access to places and send messages to them: `Send(path, message)`.
- A path is a sequence of opaque Unicode strings.
- A message is one of four kinds:
  - *request*: has an id and expects a response;
  - *response*: answers a request by id;
  - *event*: one-way;
  - *cancel*: withdraws a request.
- `Send` returns when the message is accepted or refused, never when it has been
  handled.
- A request carries a return capability, and replies go to it.
- Holding access is what lets you send. Access is not authority to cause an
  effect.

**Languages.** Go and TypeScript carry the implementations. The wire contract is
also declared in Python, Rust, Swift, C++, Java and Haskell.

**Scale and working style.**

- One maintainer works with many AI coding agents in parallel. Each agent works
  on its own branch and lands through pull requests.
- A change spanning two repositories needs two pull requests, with a released or
  pinned version between them.
- About a dozen repositories take part in this discussion.
- Sizes:
  - Bitwire's contract declarations are about 130 lines each in Go and TypeScript,
    and about 3,100 across all eight languages, plus conformance tooling.
  - Nightseam's generator is about 18,400 lines of Go and its runtime about
    10,000, with TypeScript mirrors and six further runtime ports.
- Multi-module repositories are normal here. Nightseam's authentication and
  telemetry were separate Go modules inside it, and Bitwire's conformance
  harness is its own module.
- Everything is before 1.0. Correctness and composability matter far more than
  performance.

### The repositories involved

| Repository | What it is | State |
| --- | --- | --- |
| **Deixis** | A specification and four small libraries for finite trees with byte-string keys and a value at every node | Released v0.3.0 |
| **Bitwire** | The wire contract in eight languages, its laws and conformance cases | Released v0.2.0; decisions 0007–0009 accepted, not yet implemented |
| **Nightseam** | The discontinued predecessor: declaration language, generator, and runtime | Frozen at v0.6.0; its main branch is 40 unreleased commits ahead |
| **Archon** | Ed25519 identity keys, signed envelopes, proof of possession, login. Explicitly *not* authority: grants belong to a separate authority layer, named *thesmos* in its documents | Public, v0.8.1 |
| **bitschema** | "The runtime form of a type": descriptions and a validator | Design documents only |
| **Bitlink** | Holds the family design documents. Its GitHub description: "A declaration language for a system and a generator that renders everything of that system except its behavior: protocol, bindings, clients, storage, CLI, UI and spec from one JSON declaration." The family design gives it a narrower role (below). | Documents only |
| **bitverse** | Planning repository where the family design records repository ownership | Documents only |
| **BitTree** | A consumer: one tree for a whole repository, down to syntax nodes. The family design also casts it as the substrate every layer reads and writes through. | In use |
| Five more consumers | Listed under "The six repositories that depend on Nightseam" | In use |

The following names exist only in plans, with no repositories:

- `bittype`: the type language;
- `bitmodel`: system declarations and the generation kernel;
- `bitengine`: hosting;
- `bitstore`, `bitui`, `bitshell`: future storage, user-interface and
  command-line generators.

`bitruntime` is the working name of the runtime repository in the theory-derived
map.

### The contract theory

The theory was developed inside Nightseam in September 2026. It states that it
"belongs to Nightseam's language-independent foundation". It uses TypeScript as a
metalanguage for its definitions and exhaustively checks small finite examples.

**Notation.**

| Symbol | Meaning |
| --- | --- |
| `Σ x. P(x)` | A dependent pair: some `x` together with a `P(x)` |
| `Π x. P(x)` | A family of results, one for each `x` |
| `⊨` | "satisfies" |
| `≈_S` | Observational equivalence of behaviors |
| `≃` | Observational equivalence of Wires |
| `≡` | Structural equality of trees |
| `μX. F(X)` | The least recursive type with `X = F(X)` |
| `++` | Path concatenation |
| `k :: rest` | A path whose first segment is `k` |
| `⟦s⟧_H` | What source `s` in language `H` denotes |

**Contract, realization, instance.**

- A *shape* `S` lists sorts, fields, operations, arguments and results.
- A *behavior domain* fixes what can be observed, together with an equivalence
  `≈_S`.
- A specification `B` is a predicate on behaviors that respects `≈_S`.

```text
C = (S, B)                              a contract
T : NativeRealization[L, S]             a realization of the shape in language L
BehaviorOf_T : Instance[T] -> Behavior[S]
i ⊨_T C   iff   B(BehaviorOf_T(i))      satisfaction concerns this instance
```

The theory insists on four separations:

- A contract and a language do not select a unique realization. A Go interface
  and a Go record of functions can both realize one shape.
- A native signature does not make its inhabitants lawful. A storage cell that
  ignores writes has the right methods and violates the contract.
- Satisfaction is a separate relation from structural conformance.
- A declaration digest "identifies specified declaration content, not an
  arbitrary behavioral predicate `B`".

**Adapters.** An adapter `a : Instance[T] -> Instance[U]` maps between two
realizations of one shape:

```text
A1  satisfaction preservation:  i ⊨_T C  =>  a(i) ⊨_U C
A2  behavioral transparency:    BehaviorOf_U(a(i)) ≈_S BehaviorOf_T(i)
```

- When the admitted inputs include the lawful ones, A2 implies A1.
- A1 does not imply A2. An adapter that replaces every stored value with a fresh
  default stays lawful, yet changes what callers observe.
- For the wire, bind and stub must satisfy a round-trip law:
  `BehaviorOf_T(stub(bind(i))) ≈_S BehaviorOf_T(i)`.
- Transport failures, ownership and concurrency must be either in the behavior
  domain or explicitly excluded.

**Generators are functions with their own contract.** `D` is the declaration
language, `L` the output language, and `H` the language the generator is written
in.

```text
TypeGen[D, L]  : Π admitted C. Syntax[C, D]
                   -> Σ T : NativeRealization[L, shape(C)]. ({C} × Syntax[T, L])
AdapterGen[D, L, U_(-)] :
  Π admitted C. Π supported T : NativeRealization[L, shape(C)].
    (Syntax[C, D] × Syntax[T, L]) -> {C} × Syntax[T, L] × Syntax[Adapter(T, U_C), L]
```

How to read these signatures:

- *Admitted* and *supported* mean a generator does not promise every contract or
  every realization.
- `{C}` records the input contract beside the output, because "the native
  declaration alone need not express B".
- `U_(-)` is the chosen wire realization for each contract, `U_C`.
- An adapter generator needs both the contract and the realization it adapts.
- A generator's source denotes a function: `⟦source⟧_H = g`. "The host language H
  does not thereby become the output language."
- "A generator can itself implement a contract `C_g = (S_g, B_g)`… Its source
  represents g, not the object contract C on which it operates."

**Shapes are trees.**

```text
Shapes(O)    = μX. Option(O) × FiniteMap(Key, X)                     closed shapes
Shapes(O, G) = μX. Generic(G) + (Option(O) × FiniteMap(Key, X))      with holes
```

- Navigation composes: `at(S, p ++ q) = at(at(S, p), q)`, and a missing prefix
  stays missing.
- Substituting shapes into holes makes generics compose: filling in the arguments
  and then transforming gives the same result as transforming the template and
  each argument, then filling in.
- Structural navigation and substitution do not lift to behavior on their own.
  Restricting a contract to a part, or instantiating a contract template, needs
  an explicit behavioral projection and a rule for the result's specification.

**Representations.** The theory also places a fixed subject (a shape, contract,
type or instance) at *coordinates* such as role × syntax-or-semantics ×
language. A transformation changes one coordinate at a time. This bears on
generators but not directly on repositories.

**The domain graph.** Nightseam's `docs/domain.md` applied the theory to this
system as a typed graph. Its central claim is two triads:

- **model:** ModelContract, ModelType, ModelInstance;
- **wire:** WireContract, WireType, Wire.

They meet at the *wire type*: the shape a model contract takes on the wire, that
is, its operations as paths and its values as JSON. It is the `U_C` above.
Adapters are the code that joins the triads. The graph's node kinds:

| Kind | Nodes |
| --- | --- |
| Definitions | ModelContract; WireContract (access plus the protocol); Side (the provider or caller role of a contract); ModelType; WireType |
| Code | Adapter (bind or stub, per language) |
| Instances | Participant (a process; "where policy lives"); ModelInstance; Wire; Space and entry (a mount or dispatcher); Carrier and peer; Message and invocation (one request's life); Reference (a live reference); Grant; Observation |

Rules in the graph that bear on placement:

- **Layering.** "Each layer speaks the one beneath it; everything on the wire
  belongs to exactly one layer." A model contract sits over the wire contract, and
  the wire contract over a carrier.
- **Two commuting squares.**
  - Operation square: performing an operation and then adapting gives the same
    result as adapting and then performing.
  - Construction square: instantiating a generic and then generating an adapter
    gives the same result as generating and then instantiating. Generators are
    tested against the construction square.
- **Access is not authority.** Grants join access by a single edge, at the point
  where an effect happens.
- **Placement and policy** "are a consumer's, composed above the wire and calling
  in from outside".

Seven choices in the graph remain open:

- one node for the wire contract, or separate access and protocol nodes;
- whether model and wire types are nodes;
- whether adapters are nodes or edges;
- whether spaces belong in the graph;
- whether grants form a separate graph;
- whether an invocation is a node;
- whether observations are nodes.

The theory itself says that package extraction and a generator plug-in interface
"remain their own design questions".

### Deixis: the tree both sides share

Deixis is "the structure of a tree, and nothing about what a tree holds". Since
v0.2.0 its node model is:

```text
Node[T] = T × FinMap[Bytes, Node[T]]           every node has a value and keyed children
compose(decompose(n)) ≡ n        decompose(compose((t, children))) ≡ (t, children)
```

- **Optional values** are a choice of `T`: `Node[Option[T]]`. The theory's
  `Shapes(O)` is `Node[Option[O]]`.
- **Paths** compose: `at(n, p ++ q) = at(at(n, p), q)`.
- **Equality is lifted, not defined.** Two trees are equal when their values are
  equivalent under a supplied relation and their children correspond. "No layer
  above deixis may redefine `=`."
- **It depends on nothing.** It calls itself "not a layer but the material".
- **Four libraries** (Rust, Go, TypeScript, Python) are judged by shared vectors:
  "No implementation is the reference; the vectors are."

Bitwire's declared composites realize this tree (decision 0006):

- a composite's value is its *origin* Wire, the behavior at its own address;
- a path segment maps to a key by UTF-8.

Bitwire takes no package dependency on Deixis. The relationship is a documented
correspondence.

### Bitwire today

Bitwire's published packages contain **types only**. Go presentation, trimmed:

```go
type Code int                    // termination code
type ProfileKind string          // "request" | "response" | "event" | "cancel"
type ProfileError struct{ Code, Message string; Data json.RawMessage }

// ProfileFrame is one message of the profile. The Send path is the request
// method or event name, so the frame itself has no method field.
type ProfileFrame struct {
	Version int; Kind ProfileKind; ID string
	Params, Result, Data json.RawMessage; Error *ProfileError
	Traceparent, Tracestate string; Meta map[string]string
}

// ReturnAddress is a local capability with stable pointer identity; routing
// must preserve it and any runtime-owned context associated with it.
type ReturnAddress struct{ Wire Wire }
type Message struct {
	Frame  ProfileFrame
	Return *ReturnAddress
}
type Receiver struct {
	Message func(path []string, message Message)
	Closed  func(code Code, reason string)
}

// Send returns when accepted or refused. Success means admission, not completion.
type Wire interface{ Send(path []string, message Message) error }
type Endpoint interface {
	Wire
	Receive(receiver Receiver) (detach func(), err error)   // one receiver at a time
	Close(code Code, reason string) error
}
```

**Operators and laws.**

- **Selection.** `at(w, p)` prepends `p` to every send. `at(at(w, a), b) ≃ at(w,
  a ++ b)` and `at(w, []) ≃ w`.
- **Mounting.** Routes by the first path segment to named children.
- **Forwarding.** Joins two endpoints.
- **Declared composition** (decision 0006). `compose(origin, children)` builds a
  composite whose set of children is fixed when it is built.
  - A send to the empty path goes to the origin.
  - A send to `k :: rest` goes to child `k` with `rest`.
  - A missing child refuses the send, and the origin is never a fallback.
  - The code that built the composite (its *assembler*) keeps the parts, so it
    can decompose and rebuild it. A rebuild from the same parts is
    observationally equivalent to the original.

**Conformance, and whose implementations it checks.** Bitwire's cases are written
from the specification. Today they run against implementations Bitwire does not
own:

- a test-only reference interpreter, built over released Nightseam facilities;
- Nightseam itself, pinned at v0.6.0 in a test-only module.

Of the 39 declared-composite cases, released Nightseam passes the 20 it can
express. The other 19 are recorded as exact gaps. Nightseam's unreleased main
passes all 39. In practice, then, the contract and its implementations already
live in separate repositories, with Bitwire checking an external implementation.

**Recent decisions**, all accepted on 25 September 2026:

- **0007: "using Bitwire never requires Nightseam."**
  - *Moved to Bitwire:* the operators; the transports (in-memory pipe,
    WebSocket, a framed byte stream for stdio, TCP and Unix sockets); the
    in-process carrier; the protocol engine; tunnels; the invocation lifecycle's
    state machine; the protocol specification; a carrier contract.
  - *Left in Nightseam:* dispatch, live references, the generator, declaration
    identity and authentication.
  - Its only implemented part is a check that fails if any published Bitwire
    package depends on Nightseam. Test-only conformance is exempt from that check.
  - It was written while Nightseam was expected to continue. The same day, the
    maintainer discontinued Nightseam, which left everything 0007 kept there
    without a home.
- **0008:** a protocol revision is a name, an immutable behavioral revision and
  hashes of its specification files. A published revision is never changed; any
  change is a new revision.
- **0009:** carriers are grouped by which transport property they must add
  (framing, closing, reliability). Byte streams carry frames as `Content-Length`
  header records.

### What Nightseam contains, and where its parts couple

Nightseam is one Go module plus matching TypeScript packages, with runtime ports
in six more languages. Snippets below are from its main branch, which is 40
commits past the v0.6.0 release that consumers pin. Declared composition and
parts of the generated output exist only on main.

**The declaration language.** A family is a directory of files:

| File | What it declares |
| --- | --- |
| `model.json` | Types: records, entities, enums, aliases, unions, generics |
| `protocol.json` | Two *sides* (server and client), each with methods and events, plus public errors |
| `live.json` | *Callable* types: values that are live references |
| `go.json` and similar | Renames only |

Nightseam calls these files *tiers*. The family design uses the word
differently: in its scheme, `model.json` roughly corresponds to tier 1,
`protocol.json` and `live.json` to tier-2 concerns, and `go.json` to tier 3.

An example: the `codex` test family, whose digest appears below. Its `model.json`
declares `Payload` as a record with an integer `count` and an optional,
nullable string `note`. Its `protocol.json`:

```json
{"profile": "nightseam.duplex/1",
 "server": {"methods": {"echo": {"request": "Payload", "result": "Payload"}},
            "events":  {"changed": {"type": "Payload"}}},
 "client": {"methods": {"reverse": {"request": "Payload", "result": "Payload"}}},
 "errors": {"denied": "The caller is denied"}}
```

Methods under `server` are implemented by the server and called by the client.
Events under `server` are emitted by the server.

**Built-in vocabularies.** The generator embeds built-in families that describe
protocol messages the runtime implements by hand:

- `duplex`: the message envelope;
- `identity`: the `identity.check` request;
- `live`: `live.invoke` and `live.release`;
- `tunnel`: `channel.open` and related messages;
- `auth`.

Nothing ties these descriptions to the runtime mechanically, and one already
disagrees with it: the built-in declares `live.release` as a method, while the
runtime and the prose specification treat it as an event.

**The generator pipeline** (about 18,400 lines of Go):

| Stage | Package | Lines |
| --- | --- | --- |
| Shared leaves: diagnostics, naming, a regular-expression dialect, a JSON string guard | `diag`, `naming`, `pattern`, `scalarjson` | ~1,000 |
| Read files into a typed model; configuration | `load`, `model` | ~2,100 |
| Resolve imports, inheritance, generics | `analysis` | 1,227 |
| Apply rules | `check` | 1,228 |
| Build the one representation every target receives, including the descriptor, the canonical declaration graph and its digest | `render` | 2,291 |
| Target plug-in interface; run the pipeline and refuse output outside a target's directories; name the targets | `spi`, `kernel`, `compose` | ~620 |
| Synthesize validated example values for documentation | `examples` | 912 |
| Go and TypeScript targets | `targets/golang`, `targets/typescript` | 3,697 + 2,846 |
| Specification documents | `doc`, `targets/markdown`, `targets/atlas` | ~1,450 |
| Command line; test support (including an oracle for the construction square) | `cmd/nightseam`, `oracle`, `surface`, `emit` | ~970 |

The target plug-in interface (`spi` is a service provider interface):

```go
type Concern string                  // "model" | "protocol" | "live": which files a target reads
type File struct{ Path string; Data []byte }
type Target interface {
	Name() string
	Consumes() []Concern
	Owns(family string) []string     // directories the generator owns wholesale
	Check(f *render.Family) []diag.Diagnostic    // located errors and warnings
	Render(f *render.Family) ([]File, error)
}
```

`render.Family` carries types, both sides' methods and events, errors and live
facts. Three of its fields carry the descriptor, the canonical declaration graph
and the digest, under misleading names:

- `Wire` holds the descriptor;
- `Declaration` holds the canonical declaration graph;
- `WireDigest` holds the SHA-256 of `Declaration`.

**The runtime.** It covers roughly 10,000 lines. Authentication is a further
2,600 lines in a separate module that depends on Archon, and telemetry 581.

- **Transports and operators (the `duplex` package).** The frame transport
  interface, an in-memory pipe, WebSocket, selection, mounting, declared
  composition and recording. They depend only on Bitwire's types.
- **The protocol engine and dispatch (`runtime`).**
  - The peer, with `Dial`/`Accept` for opening WebSocket connections.
  - The in-process carrier, which is a pair of joined endpoints.
  - The dispatcher and the invocation lifecycle.
  - Request/response helpers: `CallWire` sends a request and waits at its return
    capability, and `HandleWire` registers a handler.

  None of these files refers to types or descriptors.
- **Type-dependent runtime (`runtime`, about 2,900 of its 7,100 Go lines).**
  - The value validator that reads descriptors (1,193 lines).
  - Declaration identity (705 lines). This **re-implements the canonical-graph
    encoding** the generator also produces, for a reason: a generic family's
    identity becomes concrete only when type arguments are supplied at run time,
    so the runtime rebuilds the applied graph and its digest.
  - Presence codecs: `Optional` distinguishes absent from null.
  - Value adapters: per-type conversions used for live references.
- **The identity check.** Before exposing a generated object, an adapter sends
  `identity.check` with a `(declaration path, digest)` pair and compares the
  answer. The declaration path is the family name, not a Wire path. A peer that
  answers "method not found" is accepted, so the check is skipped against peers
  that lack it.
- **Live references (`live`).** The mechanism covers scopes, bindings with
  nonces, owners, release barriers and bounds. It compares contracts and digests
  only as opaque strings. It is **tied to Nightseam's peer**
  (`Over(peer *runtime.Peer, …)`), not to the Wire interface.
- **Tunnels (`tunnel`).** Tunnels are also tied to the peer
  (`New(peer *runtime.Peer, …)`), and they refuse a channel whose declared digest
  doesn't match.

**Generated code.** For each family and language, the generator emits a types and
protocol package, plus one package per side. Each side's package contains both
directions: `ToWire` (bind) and `FromWire` (stub). The following excerpt is Go,
trimmed and commented:

```go
// protocol package: the embedded descriptor and canonical declaration graph
var schema = runtime.MustSchema("{\"types\":{…}}", WireDigest(), …).MustWithDeclaration(WireDeclaration())
func WireSchema() *runtime.Schema { return schema }
func WireDeclaration() string   { return "{\"definitions\":{\"codex\":{…}},…}" }
func WireDigest() string        { return "008edf4d6e62…" }   // SHA-256 of WireDeclaration()

// stub direction, in both side packages: a native call becomes a request at
// the path ["echo"], validated before sending and after receiving
func (c *serverMethods) Echo(ctx context.Context, params protocol.Payload) (protocol.Payload, error) {
	protocol.WireSchema().ValidateValue(protocol.MustTypeExpression("\"Payload\""), params)
	runtime.CallWire(ctx, c.wire, []string{"echo"}, params, &raw, runtime.WireCallOptions{…})
	…
}

// bind direction. ServerModel is a factory: func(Client) (Server, error).
// AdapterContext carries the peer's options and a value environment.
func ToWire(model protocol.ServerModel, env runtime.AdapterContext) (bitwire.Endpoint, error) {
	access, served, _ := runtime.NewWirePair(env.Options)   // two joined in-process endpoints
	dispatcher, _ := runtime.NewDispatcher(served, …)       // routes by path to handlers
	identity, _ := declarationIdentity()                    // rebuilds the digest at run time
	registerIdentity(dispatcher, identity)                   // serves identity.check
	implementation, _ := model(accessClient(served, env))    // build the implementation
	bindServer(dispatcher, implementation, env)              // one handler per method
	return access, nil                                       // the caller's Wire access
}
```

So generated code imports four layers:

- Bitwire's types;
- the operators;
- the runtime: validator, codecs, request/response helpers, identity check,
  in-process carrier, dispatcher, and the peer's option types;
- for live families, the live-reference owners.

**Couplings any split must resolve:**

1. **The generator links the runtime.** The example synthesizer validates
   examples with the runtime's validator, so building the generator pulls in the
   transports and WebSocket.
2. **The canonical declaration encoding exists twice,** in the generator and in
   the runtime. A written specification holds the two together.
3. **The runtime and generator share leaf packages:** the regular-expression
   dialect (682 lines) and the JSON string guard. The protocol engine imports the
   guard too.
4. **Live references, tunnels and generated code depend on the peer's types,**
   not only on Wire access.
5. **Built-in vocabularies** are declared for the generator but implemented by
   hand in the runtime.

**Open design threads it leaves behind.** None has a verdict.

- Extracting the type language: with its reusable tooling, or only its
  specification. That thread lists five artifacts that "type model" conflates: a
  source declaration, a resolved model, a canonical identity graph, a validator
  descriptor, and a native type.
- A domain-neutral generation kernel, in which generators are separate modules
  that declare typed inputs and outputs. The maintainer set this direction; its
  design is open.

### The family design (written before Nightseam was discontinued)

In mid-September 2026 a set of planning documents designed the successor to
Nightseam as a group of repositories. The documents are bitverse's architecture
page and Bitlink's `MODEL.md`. They call it "a re-implementation, not a
migration: the declaration language is new." Almost none of it exists as code.
Its layering rule:

> "each layer is built on the one beneath and speaks it; none knows the ones
> above. The declaration must not know its renderers; the runtime must not know
> the generator. A repository boundary must satisfy that rule; existing
> packaging alone does not establish the right semantics."

Its map, adapted from the architecture page. `▲` points from a dependent up to
what it depends on. Omitted: a styling repository, bitstyle.

```text
declaration side                              runtime side
────────────────                              ────────────
bittype    type language + per-language       bitschema  type descriptions + validator;
           type rendering                                 embedded by generated code
                ▲                                             ▲
bitmodel   families, tiers, concerns as       bitwire    transport interface, peer
           language, resolve/check,                       (profile), tunnel, scoped
           kernel, target interface                       references, telemetry adapter,
                                                          conformance suite
                ▲                                             ▲
bitlink    protocol → bitwire          ───────────────────────┤
bitstore   storage → postgres      (later)                    │
bitui      ui → react              (later)                    │
bitshell   cli → a command tree    (later)                    │
bitengine  service → a host        (hosting, supervision) ────┘

bittree    the addressed tree both sides read and write through
```

"Dependencies point upward within a column and from the declaration side to the
runtime side, never back. Generated code depends on bitwire, bitschema and
bittype's runtime support only — never on anything in the left column."

**Its parts:**

- **Three tiers of declaration.** Each fact goes in the lowest tier that can
  state it.
  - *Tier 1*, `types.json`: records, enums, aliases, generics. These are true of
    the domain whatever the system does.
  - *Tier 2*, the *concerns*, one file each: protocol, storage, command line,
    user interface.
  - *Tier 3*: per-target overrides, which "may not introduce anything".
- **bittype** is "what you write" for tier 1: the type language and its rendering
  into one types package per language. It starts as a package inside bitmodel,
  and becomes a repository "the day bitstore needs type rendering without the
  rest".
- **bitschema** is "what a program checks against": one description format and
  one validator, depending on nothing in the project. bittype's rendering emits
  bitschema descriptions; bitschema never depends on bittype.
- **bitmodel** holds families, imports, all the concerns *as language*, resolve
  and check, the generation kernel and the target interface. It renders nothing
  itself; every target lives in a repository of its own.
- **Bitlink** is "the projection from model to wire": the generated interfaces,
  bindings, clients and wire validators. "The declaration of an interface is
  bitmodel's; the generated interface is bitlink's, because its shape … is the
  wire's calling convention, not a fact about the domain."
- **bitwire** is "everything every peer speaks", with "no declarations, no
  generator". Nightseam's `runtime` package is split three ways:
  - the peer, `Dial`/`Accept`, observation and trace go to bitwire's peer package;
  - the validator goes to bitschema;
  - the presence helpers go to bittype's runtime support.
- **bitengine** hosts a family's generated binding and its implementations:
  lifecycle, supervision, health. It is explicitly not the generation kernel.

**Principles bearing on placement:**

- "A seam is real when a consumer outside the parent proves it." That is why
  bittype waits inside bitmodel.
- "No runtime dependency on the generator."
- "Reference export/import belongs to the runtime mechanism; mapping declared
  arguments and results to native signatures belongs to generated proxies and
  bindings; schema checking belongs to validators."
- Canonical declaration identity: "identity, scope, provenance — belongs to
  bittype's own hash".
- Archon's ownership rule, which the family design quotes: the owner of a thing is
  "the *lowest* layer that can define its canonical bytes, validity conditions,
  success claim and versioning **without higher-layer vocabulary**."

The design predates Bitwire decisions 0006 to 0009. Since then Bitwire has become
a contract repository with laws, conformance cases and protocol specifications,
rather than the extracted runtime the design describes.

### The six repositories that depend on Nightseam

| Repository | What it is | Last active | Pinned | Generator | Runtime pieces | Live refs | Grants | Tunnels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bitsystem3 | A live, model-first system of typed "spaces" and facts, with a browser UI | 25 Sep | v0.6.0 | no, hand-written adapters | dispatcher, helpers, in-process carrier, selection, `Dial` | – | – | – |
| BitTree | One tree for a whole repository, down to syntax nodes | 24 Sep | v0.6.0, isolated in an optional binding module | yes (25 generated files) | peer, dispatcher, forwarding, mounting | experiment | – | – |
| repo-tool | A persistent repository service with work sessions; CLI and MCP clients call one generated API | 24 Sep | v0.6.0 | yes (25) | peer, `Dial`/`Accept`, forwarding, identity check | – | **yes** (the only user) | – |
| nightforge | Turns shipped binaries back into source; a runner service | 24 Sep | v0.6.0 (a vendored copy) | yes (38) | peer, `Dial`, forwarding, pipe | **yes** (the only user) | – | – |
| nighthall | Provisions coding-agent runtimes on a user's machines and serves them over a WebSocket | 20 Sep | **v0.3.0**, which predates Bitwire | yes (28) | peer, generated bindings | – | – | **yes** |
| bitsystem | The earlier prototype of the space system | 24 Sep | three different pins | yes (31) | peer, `Dial`, forwarding | – | – | experiment |

Hand-written code in these repositories touches mostly the peer, connection
setup, forwarding and a few helpers. Their dependence on the type-dependent
runtime comes through generated code. So five of the six are bound to whatever
replaces the generator, and to the runtime support its output calls. Nothing
depends on the six non-primary language runtimes.

### Constraints

**Ruled out:**

- continuing Nightseam;
- aliases or re-exports of moved code (a ruling on the predecessor);
- any published Bitwire package depending on Nightseam.

**Allowed but not proposed:**

- one multi-module repository for everything;
- Bitwire taking everything, the generator included;
- carrying Nightseam's declaration language forward unchanged;
- adopting the family design as written.

**Fixed:**

- the paradigm;
- decisions 0006, 0008 and 0009;
- Bitwire's rule that its contract and cases stay independent of every
  implementation, "including Bitwire's own", with expected observations written
  from the specification.

**Timeline.** There is no deadline.

- Dependents stay pinned to the frozen v0.6.0 and keep working.
- bitsystem3 can move as soon as carriers exist.
- The five generator users wait for a successor generator and type language,
  which has no code yet.

The boundaries can therefore be chosen before the code is written. That is why
changing them is cheap now and expensive later.

## What we've considered

### Three maps, piece by piece

- **Map 1** is decision 0007 as written. It is a partial baseline: it only says
  what Bitwire holds.
- **Map 2** is the family design.
- **Map 3** is the theory-derived candidate: one repository per seam of the theory
  and the domain graph.

"Unplaced" means the map is silent. "Nightseam (orphaned)" means 0007 left the
piece in the discontinued repository.

| Piece | Map 1: 0007 baseline | Map 2: family design | Map 3: theory-derived |
| --- | --- | --- | --- |
| Wire contract, laws, conformance cases, protocol specification, carrier contract | Bitwire | bitwire | Bitwire |
| Operators (selection, mounting, forwarding, composition) | Bitwire | bitwire (inferred) | runtime repository |
| Transports, in-process carrier, protocol engine (peer) | Bitwire | bitwire | runtime repository |
| Invocation lifecycle state machine | Bitwire | unplaced (predates it) | runtime repository |
| Dispatcher, request/response helpers | Nightseam (orphaned) | bitwire (peer package, inferred) | runtime repository |
| Tunnels | Bitwire | bitwire | runtime repository |
| Live-reference mechanism (scopes, owners, release) | Nightseam (orphaned) | bitwire | runtime repository |
| Live-reference conversion to native values | Nightseam (orphaned) | Bitlink (generated proxies) | Bitlink |
| Telemetry adapter | unplaced | bitwire | runtime repository (optional module) |
| Value validator and descriptor format | Nightseam (orphaned) | bitschema | bitschema |
| Presence codecs and other type runtime support | Nightseam (orphaned) | bittype runtime support | bittype runtime support |
| Value-type language (tier 1) and per-language type rendering | Nightseam (orphaned) | bittype (inside bitmodel at first) | bittype |
| Protocol and live declarations | Nightseam (orphaned) | bitmodel (tier-2 concerns) | bittype: one contract language, since the theory's shape includes operations |
| Storage, command-line and UI declarations | – | bitmodel | unplaced |
| Canonical declaration graph and digest | Nightseam (orphaned) | bittype's hash | bittype |
| Identity-check exchange | Nightseam (orphaned) | unplaced | Bitlink |
| Built-in vocabulary declarations | Nightseam (orphaned) | Bitlink injects the envelope; others unplaced | unplaced |
| Generation kernel and target interface | Nightseam (orphaned) | bitmodel | unplaced |
| Adapter generation and wire types | Nightseam (orphaned) | Bitlink | Bitlink |
| Specification documents | Nightseam (orphaned) | bitmodel | unplaced |
| Hosting, lifecycle, supervision | – | bitengine | unplaced (consumers) |
| Grants | Nightseam (orphaned) | unplaced | an authority layer above Archon |
| Tree structure | Deixis | not mentioned | Deixis |
| The theory | Nightseam (orphaned) | not mentioned | unplaced |

Map 3's dependencies:

- Deixis, Bitwire, bittype and bitschema depend on nothing in the project.
- The runtime repository depends on Bitwire.
- Bitlink depends on bittype, Bitwire, the runtime repository and bitschema.

Its new repositories are the runtime repository and bittype. bitschema and
Bitlink exist as documents and would gain code; the authority layer would be one
more.

### The contested placements

1. **Wire contract and its implementations: one repository or two?**
   *Feeds (a), question 2.*
   - *For one* (Maps 1 and 2):
     - the protocol specification and its engine change together, on one version
       train;
     - "everything every peer speaks" sits in one place;
     - conformance needs a runnable implementation in continuous integration;
     - separate modules inside one repository can already keep dependencies apart
       (the contract module stays dependency-free);
     - Bitwire's rule already requires its cases to stay independent of its own
       implementation.
   - *For two* (Map 3):
     - the domain graph separates the wire-contract definition from wire,
       carrier and peer instances;
     - a repository that ships the implementation its cases judge must work to
       keep those cases independent;
     - the contract changes rarely and the runtime often;
     - downstream architecture checks that key on module paths may not tell "the
       contract" from "the WebSocket transport";
     - today's practice (Bitwire checking Nightseam as an external implementation)
       is already two repositories.
2. **Protocols with value types, or in a separate system-declaration layer?**
   *Feeds (b), question 3.*
   - For one language: the theory's shape covers operations, arguments and
     results, so a contract language includes protocols.
   - For separation: the family design keeps tier-1 types apart because "types
     survive a system with no protocol", and storage and UI generators need types
     without protocols. It puts every concern in bitmodel.
3. **Where the two triads meet.** *Feeds (c), question 3.*
   - Adapters need a model type and a wire type, and the generator that produces
     them needs both contract languages.
   - Placed with the type language, it would make types depend on the wire. Placed
     in the runtime, it would make the runtime depend on model contracts.
   - Map 3 gives it its own layer. The family design reaches the same answer
     (Bitlink) by a different argument: the generated interface's shape "is the
     wire's calling convention".
4. **The runtime support generated code calls.** *Feeds (c), question 3.*
   - Today it is one package: validator, codecs, request/response helpers, the
     identity check, value adapters, the peer's option types.
   - One proposal (Maps 2 and 3) splits it: wire helpers to the runtime, validation
     to bitschema, presence codecs to the type language's runtime support, the
     identity check to the meeting layer.
   - The alternative is to keep one "generated-code support" package, on either
     side.
5. **Canonical declaration identity.** *Feeds (c), question 3.*
   - Today the generator produces it, and the runtime re-implements it to close
     generic applications at run time.
   - Candidates: the type language (Maps 2 and 3); a small shared specification
     with vectors that each side implements; or one library both import.
6. **The generation kernel.** *Feeds (c), question 3.*
   - The theory treats a generator as a function with its own contract,
     independent of its host language.
   - The maintainer wants a domain-neutral kernel in which generators are separate
     modules declaring typed inputs and outputs.
   - Candidates: its own repository; the system-declaration layer (Map 2); or the
     type-language repository.
7. **Live references and tunnels.** *Feeds (c), question 3.*
   - The scope, binding, owner and release mechanism is wire-side. Converting
     model-valued positions is adapter-side.
   - Today the mechanism and tunnels depend on the peer rather than on Wire
     access. Any placement has to decide whether they are re-expressed over the
     wire contract.
8. **The theory's home.** *Feeds (d), question 4.*
   - It lives in the discontinued repository today, and every candidate layer
     instantiates its laws.
   - Options: a small repository of its own; alongside Deixis; the planning
     repository (bitverse); Bitwire; or the generation kernel's repository.
9. **Migration order.** *Feeds (e), question 1.*
   - bitsystem3 needs only carriers.
   - BitTree isolated its Nightseam use in one optional module.
   - repo-tool is the only grants user, and nightforge the only live-reference
     user.
   - nighthall is pinned to a release that predates Bitwire.
   - Five of the six wait for a generator successor that has no code.

**Couplings to cut regardless of map** (from the Nightseam section):

- the generator's dependency on the runtime validator;
- the double implementation of the canonical encoding;
- the shared leaf packages;
- built-in vocabularies maintained separately from the runtime that implements
  them.

## Questions for the Expert

1. **When should a seam be a repository?** The theory gives us seams: contract,
   realization and instance; the model world and the wire world; generators as
   functions with their own contracts. The family design adds a rule: "a seam is
   real when a consumer outside the parent proves it." How would you decide which
   seams become repositories and which stay modules? We'd like you to weigh
   dependency direction, who checks whom, release cadence, and one maintainer
   working with many parallel agents. And how would that principle order the
   work, given six dependents that stay pinned to the frozen predecessor until
   they move directly, without shims?

2. **How would you place a wire contract relative to its implementations?**
   Bitwire owns the contract and the conformance cases that judge
   implementations, and requires those cases to stay independent of every
   implementation, including its own. An accepted decision moves the Go and
   TypeScript carriers, protocol engine and operators into the same repository;
   the domain graph keeps the contract apart from wire instances. How would you
   weigh these, and would separate modules in one repository give the same
   benefits as separate repositories? What have ecosystems learned when they
   separated, or deliberately kept together, a specification, its conformance
   suite and its runtime?

3. **How would you divide the path from a declared contract to a running
   adapter?** Between the two ends sit:
   - the declaration language;
   - canonical declaration identity, encoded today in both the generator and the
     runtime;
   - a domain-neutral generation kernel;
   - the bind/stub adapters, their generator and the wire types they target;
   - the runtime support generated code calls.

   What test would you use to place each piece, and how have comparable systems
   separated language, code generation and runtime? One tension to address: the
   theory's shape includes a protocol's operations, which suggests one contract
   language, while the family design keeps value types apart because storage and
   user-interface generators need types without protocols.

4. **How would you give the theory itself a home, and make it bind the
   repositories?** Which layer, if any, should own it? What would make its laws
   hold across repositories rather than only in documents? The laws we have in
   mind are the bind/stub round trip and the two commuting squares. Candidate
   mechanisms we know of are shared test vectors, cross-repository commuting
   checks, and dependency rules enforced by tooling; we'd welcome better ones.

5. **What are we not seeing?** For example, places where the theory's seams and
   workable repository seams should deliberately diverge, or risks in splitting
   one project into four or five repositories at once with a very small team.

## Applied

**Advice:** [0002-repository-seams-from-contract-theory.advice.md](0002-repository-seams-from-contract-theory.advice.md).

- It came from run `run_a52b7f3e-c9dd-4f31-bd52-6f6df457b82f`, and
  `nightfall consult verify` judged it genuine advice.
- One warning: the capture replaced the advisor's citation links with markers,
  so its source URLs are not in the file. The references it names by title are
  listed at the end of this section.

**Revision the expert read:** commit `3ed8788`. Since then only the header lines
have changed (status and run records), so no advice rests on text the expert did
not see.

**Checked against:**

- Nightseam `origin/main` `dfacbb27`;
- Bitwire `main` `74afa06`;
- the consumer inventory and repository visibility on GitHub.

**Verdicts:**

- **HOLDS:** the premise is intact.
- **ADAPT:** directionally right, but a detail differs.
- **STALE:** the premise was not true.

**Outcomes:**

- **Decision:** needs the maintainer's call.
- **Later:** belongs to the design of a piece not yet built.
- **Recorded:** accepted as analysis; nothing to change.

| # | Recommendation | Verdict and evidence | Outcome |
| --- | --- | --- | --- |
| 1 | The theory defines semantic boundaries and correctness obligations. Independent ownership, compatibility commitments and release decisions decide which boundaries become repositories. | HOLDS. The theory itself leaves "package extraction … and the outstanding domain-graph choices" as separate design questions. | Decision: adopt as the governing principle. |
| 2 | A repository needs a charter: the decisions it owns, what it promises and how that is versioned, the independent evidence that checks it, and which real change becomes easier. The module boundary is the default unit of work; a repository is an explicit compatibility commitment. | HOLDS. It extends the family design's "a consumer outside the parent proves it" rule rather than replacing it. | Decision: adopt; each new repository opens with a charter. |
| 3 | The brief's argument separating the contract from "wire, carrier and peer instances" is a category mistake: a repository holds source, not running instances. | HOLDS. The brief did argue this way in its "for two" case and in Map 3's framing. | Recorded: correction accepted. |
| 4 | **(a)** Keep Bitwire as the normative contract and conformance repository. Put the Go and TypeScript implementations in **bitruntime**. Supersede the implementation placement of decision 0007 and keep its independence rule. | HOLDS. Decision 0008 already makes protocol revisions immutable, so fixes and new revisions don't touch a published one. Bitwire already checks an external implementation (`conformance/drivers/nightseam`, `conformance/current`) and records exact gaps. | Decision. |
| 5 | Operators, dispatch, live references and tunnels become modules inside bitruntime, not repositories. | HOLDS. None has an independent consumer or compatibility policy today. | Decision, as part of 4. |
| 6 | **(b)** One modular, wire-independent contract language in **bittype**, with a value-type core usable on its own. Abstract operations and callable signatures extend that core; their mapping to paths and the profile belongs to the binding. Don't create bitmodel yet. | HOLDS. `protocol.json` mixes operations with `"profile": "nightseam.duplex/1"`. The canonical declaration graph already covers sides, operations and errors, and excludes the profile's envelope layouts. | Decision. |
| 7 | Bitlink owns the model-to-wire binding, not every generated interface. The test: would the declaration make sense unchanged with a different adapter and no Bitwire? | HOLDS. It narrows the family design's claim that generated interfaces are the wire's calling convention. | Decision, as part of the map. |
| 8 | An adapter generator takes the chosen native realization explicitly. If only one realization per language is supported at first, that is a stated restriction. | HOLDS. This is the theory's `AdapterGen` signature. | Later: generator design. |
| 9 | **(c)** Canonical declaration identity gets one normative specification, shared vectors, and one library per language, used by both the generator and the generated-code support. Before moving it, audit what the canonical graph contains. Keep declaration identity, profile revision, generated-code compatibility and behavior distinct. | HOLDS. Two Go implementations exist today: `internal/render/declaration.go` and `runtime/go/declaration_identity.go`. The runtime copy exists to close generic applications at run time, which a shared library can do. | Decision (home: bittype). Later: the audit. |
| 10 | Start the domain-neutral generation kernel as a separate module inside bittype, forbidden to import the declaration language. Extract it when its interface stabilizes. A general plug-in platform is not a prerequisite for the first generator. | HOLDS. Today's `spi.Target` exposes `render.Family` and the concerns `model`, `protocol` and `live`, so it is not neutral. | Decision. |
| 11 | Split runtime support by meaning: validation to bitschema; absence/null to bittype; wire conversions, the identity exchange and reference conversion to Bitlink; correlation, dispatch, carriers and reference mechanics to bitruntime. | HOLDS. It matches the coupling inventory and both candidate maps. | Decision, as part of the map. |
| 12 | Publish a generated-code compatibility contract, and record language, format, binding, generator and support versions in generated artifacts or their build manifest. | ADAPT. Nightseam decided that generated files carry no version: a header version rewrites every file on every release and breaks byte-identical checks. Use a generation manifest beside the output, not file headers. | Later: generator design. |
| 13 | A generator that emits calls to bitruntime need not link bitruntime. | HOLDS. The link exists today only through `internal/examples`, which validates examples with the runtime's validator. That validator belongs in bitschema. | Later. |
| 14 | Live references and tunnels depend on the smallest stated capabilities (an Endpoint plus lifetime and scope facilities), with the peer as one implementation. No catch-all session interface, and no new obligation on every Wire. | HOLDS. `live.Over(*runtime.Peer, …)` and `tunnel.New(*runtime.Peer, …)`. | Later: the engine-hook design (Bitwire #39, step 5). |
| 15 | Give each built-in vocabulary one authoritative owner. Wire-only vocabularies live with the wire specification; the identity exchange lives in Bitlink. Declarations for the generator are derived from, or checked against, those. | HOLDS. `live.release` is a method in the built-in declaration and an event in the runtime and prose (nightseam#724). | Later: the protocol move (Bitwire #39, step 4). |
| 16 | The regular-expression dialect goes with the validation semantics it serves. The JSON string guard becomes a tiny neutral module, and the protocol engine depends only on it. | HOLDS. `runtime/go/peer.go` imports `internal/scalarjson`, and `internal/pattern` is shared by the declaration checker and the runtime validator. | Later. |
| 17 | **(d)** Give the theory a normative, versioned home in bitverse, and have each repository declare which theory revision and laws it claims to satisfy. | ADAPT. bitverse is **private**. The theory is public today (in Nightseam), and Bitwire, which is public, may cite only public sources. The normative area needs a public home: bitverse made public, or a public repository of its own. | Decision. |
| 18 | Assign each law's tests to the owner of its semantics. Compare observations, not generated text. Add deliberately unlawful implementations. Qualify conformance reports by specification revision, suite revision and implementation version. | HOLDS. Bitwire already mutates its reference (a missing child falling back to the origin fails 3 cases) and pins fixture hashes and revisions. | Later: each owner, as its repository forms. |
| 19 | An observation model covering transport failures, ownership and concurrency is a specification task in its own right. | HOLDS. It matches research 0001's recommendation of a lifecycle specification for faults. | Later. |
| 20 | **(e)** Migrate as a partial order with gates: bitsystem3 first, then BitTree as the first generated consumer; repo-tool and nightforge independently once authority or live references pass; nighthall once tunnels and its v0.3.0 baseline are covered; bitsystem last. | HOLDS. It corrects the brief: bitsystem3 needs the handwritten-adapter path (dispatcher, helpers, selection, connection setup), not only carriers. | Decision. |
| 21 | Record each consumer's actual baseline. Extract from identified commits, keeping released v0.6.0 apart from the 40 unreleased commits. | HOLDS. | Later. |
| 22 | Build a runtime slice first, then one generated vertical slice covering absence/null, errors, reverse calls and generic identity, before declaring interfaces stable. Don't design every repository before a slice runs. | HOLDS. | Decision: the plan. |
| 23 | Carrying the declaration language forward unchanged is allowed. A successor-owned implementation can accept the old syntax at first, separating extraction from redesign. | HOLDS. The brief lists it as allowed. It contradicts the family design's "the declaration language is new", which is open to challenge. | Decision. |
| 24 | Keep authority in an isolated module of its only consumer (repo-tool), above Archon. Extract the authority layer when a reusable contract is demonstrated. | HOLDS. repo-tool is the only grants user; Archon excludes authority. | Decision. |
| 25 | Make the identity check's outcome explicit: checked and matching, checked and mismatching, or unavailable under a stated policy. | HOLDS. `CheckIdentity` returns success on `method_not_found` (nightseam#720; research 0001 decision 2). | Later: Bitlink. |
| 26 | Don't make `render.Family` the universal interface between repositories; use typed, versioned artifacts and narrow projections. | HOLDS. The same direction as Nightseam's open kernel threads. | Later: kernel design. |
| 27 | Don't make BitTree mandatory infrastructure because both sides can be represented as trees. | HOLDS. The family design casts it as the substrate; Deixis is the structural correspondence. | Decision (on the family design). |
| 28 | The principle: "A module owns a coherent semantic decision. A repository owns an independently useful compatibility commitment. The theory states the obligations across those boundaries; executable, versioned checks make those obligations credible." | HOLDS. | Decision: adopt with 1 and 2. |

No recommendation was stale.

**A finding of the verification, not the advice.** bitverse, Bitlink, bitschema
and Deixis are private; Bitwire, Archon and Nightseam are public. Public
repositories will depend on bittype, bitruntime and Bitlink, and on the theory
as a normative source. Their visibility should be decided when they are created.

**References the advice names by title** (their links were lost in capture):

- Parnas, *On the Criteria To Be Used in Decomposing Systems into Modules* (1972);
- Test262, an independent conformance suite for ECMAScript;
- the WebAssembly specification repository, which holds the specification,
  reference interpreter and tests together;
- Protocol Buffers: compiler, runtimes, conformance tests, the plug-in protocol,
  and its cross-version runtime guarantees;
- Smithy: service and operation shapes in one model, with protocol traits kept
  separate.

**Integrated in this change:** this document and its advice. Every architectural
recommendation needs the maintainer's decision first, so no decision record
changes here. The recommended outcome, if adopted, is one decision that
supersedes decision 0007's implementation home and records:

- the governing principle (rows 1, 2 and 28);
- the map in rows 4 to 11 and 17;
- the migration plan in rows 20, 22 and 23;
- authority staying with its consumer (row 24).

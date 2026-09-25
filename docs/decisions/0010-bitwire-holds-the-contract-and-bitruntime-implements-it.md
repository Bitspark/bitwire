# 0010: Bitwire holds the contract, and bitruntime implements it

**Status:** accepted, 2026-09-25, on the maintainer's decisions after
[research 0002](../../research-docs/0002-repository-seams-from-contract-theory.md).
This supersedes:

- where [decision 0007](0007-using-bitwire-never-requires-nightseam.md) put the
  implementations;
- the part of [decision 0009](0009-carriers-bitwire-provides-and-byte-stream-framing.md)
  that says Bitwire provides carriers.

Three things stand:

- 0007's rule that using Bitwire never requires Nightseam;
- the protocol identity rule of [decision 0008](0008-a-protocol-revision-has-its-own-identity.md);
- 0009's carrier groups and framing.

Nothing described here is implemented yet, and none of the new repositories
exists.

## Question

Decision 0007 moved the Go and TypeScript implementations into Bitwire, the
repository that also holds the contract and the conformance cases that judge
implementations. The same day, the maintainer discontinued Nightseam. That left
dispatch, live references, the generator, declaration identity and authority
without a home. Where should each piece live, and by what principle?

## The principle

Adopted from research 0002:

> A module owns a coherent semantic decision. A repository owns an independently
> useful compatibility commitment. The theory states the obligations across those
> boundaries; executable, versioned checks make those obligations credible.

- The contract theory decides the semantic boundaries and the obligations across
  them. It does not decide repositories by itself: turning each of its categories
  into a directory would give it more authority than it claims.
- A module is the default unit of work.
- A repository is an explicit compatibility commitment. Each new repository opens
  with a charter that states:
  - which decisions it owns;
  - what it promises consumers, and how that promise is versioned;
  - what independently written evidence checks the promise;
  - which real change becomes easier or safer because it is separate.

## Decision

**Bitwire keeps the wire contract:**

- the Wire and Endpoint interfaces in eight languages, and their laws;
- the protocol specification (`bitwire/1`, decision 0008);
- the carrier contract and the byte-stream framing (decision 0009);
- the independent conformance cases and their runner protocol.

It ships no production implementation, and nothing it publishes depends on one.

**bitruntime**, a new public repository, implements it in Go and TypeScript. It
holds, as modules rather than separate repositories:

- operators, transports, carriers and the protocol engine;
- the invocation lifecycle;
- dispatch and the request/response helpers;
- the live-reference mechanism and tunnels.

Telemetry and wire-authentication integration are optional modules. bitruntime
depends on Bitwire; Bitwire never depends on bitruntime.

**The repositories around them:**

| Home | Owns |
| --- | --- |
| Deixis | Tree structure, its laws, vectors and libraries |
| Bitwire | The wire contract, protocol and carrier specifications, conformance |
| bitruntime (new, public) | The Go and TypeScript implementations above |
| bittype (new, public) | A wire-independent contract language: a value-type core usable on its own, extended by abstract operations and callable signatures that do not name Bitwire. Also parsing, resolution and checking; rendering native types; canonical declaration identity; small runtime identity and presence libraries; and, at first, the generation kernel as a separate module that may not import the declaration language. |
| bitschema | The descriptor format, the validator, and the validation primitives they need |
| Bitlink | The model-to-wire binding: mapping operations to paths and the profile; wire types; bind and stub adapters and their generation; the identity check; converting model values that contain live references |
| The theory (new, public; name to be chosen) | The contract theory, versioned: its laws, which tests check which law, and pinned cross-repository integration checks |
| Consumers | Model instances, programs, placement and policy. Authority stays in its only user, repo-tool, above Archon, until a reusable authority contract is shown. |

The main dependencies, where `A → B` means A depends on B:

```text
bitruntime                  → Bitwire
bittype, bitschema          → nothing in the project
Bitlink generator           → bittype, bitschema
Bitlink adapter support     → bittype runtime support, bitschema, Bitwire, bitruntime
generated adapters          → generated types, Bitlink support, bitruntime
the theory's integration checks → released versions of all of them (tests only)
```

A generator that emits calls to bitruntime has a compatibility dependency on it,
not a link-time one.

**A new contract language comes first.** The successor does not carry
Nightseam's declaration language forward. Research 0002 suggested carrying it,
to separate moving the code from redesigning the language; the maintainer chose
to design the language first.

- Value types, abstract operations and callable signatures belong to the
  language.
- Paths, the profile and message representation belong to Bitlink's binding.
- No system-declaration repository (`bitmodel`) is created yet. Storage,
  interface and command-line concerns begin as modules of the components that
  define them.

**Declaration identity** gets one normative canonicalization specification,
shared vectors, and one library per language in bittype. Both the generator and
the generated-code support use that library. It supports generic application at
run time without the parser, the transports or the peer. Before it moves, an
audit fixes exactly what the canonical graph contains. Four things stay distinct:

- declaration identity;
- the profile revision;
- generated-code compatibility;
- behavior the declaration does not represent.

**The theory** moves from Nightseam to its own public repository.

- Each repository declares which theory revision and which laws it claims.
- The tests for a law live with the owner of its semantics:

| Law | Tested by |
| --- | --- |
| Wire, carrier and operator laws | Bitwire's cases, run against bitruntime |
| Canonical declaration and generic-application laws | bittype |
| Descriptor and validator agreement | bitschema |
| The bind/stub round trip, the operation square, the construction square | Bitlink, with bittype fixtures |
| Released cross-repository combinations | The theory repository's integration checks |

- Tests compare observations, not generated text.
- Deliberately unlawful implementations check that the tests reject violations.

**Visibility.**

- bitruntime, bittype and the theory repository are public, because public
  Bitwire and its consumers depend on them.
- bitschema and Bitlink are private today. They become public before any public
  repository depends on them.

**Migration is a gated partial order.** Before any consumer moves, record its
actual baseline. Then extract from identified Nightseam commits, keeping the
v0.6.0 release apart from its 40 unreleased commits. The order:

1. **bitsystem3**, once bitruntime has the path hand-written adapters use:
   carriers, dispatch, helpers, selection and connection setup.
2. **BitTree**, as the first generated consumer, once the new language, bittype,
   bitschema and Bitlink produce a working slice. That slice must cover
   absence and null, errors, reverse calls and generic identity.
3. **repo-tool** once authority integration passes, and **nightforge** once live
   references pass. Neither waits for the other.
4. **nighthall**, once tunnels and its v0.3.0 baseline are covered. It moves
   from a release that predates Bitwire.
5. **bitsystem**, last.

Each move requires clean regeneration, the consumer's own tests, the relevant
conformance results, and an audit showing that no Nightseam dependency remains.

## Why

- **Bitwire's product is a standard; bitruntime's is an implementation.** They
  answer different acceptance questions. Bitwire asks whether an observation is
  required, permitted or forbidden. bitruntime asks whether its code produces only
  permitted observations.
- **Decision 0008 makes protocol revisions immutable,** so runtime fixes and new
  revisions never touch a published contract.
- **The handoff becomes explicit:** this implementation satisfies this contract
  revision under this suite revision. Specification changes and implementation
  fixes stay visibly different.
- **It matches practice.** Bitwire already checks an implementation it does not
  own, Nightseam's, and records exact gaps.
- **Other pieces stay modules until a commitment justifies a repository.** That
  covers operators, dispatch, live references, tunnels, the generation kernel,
  future concern layers and authority.
- **Comparable systems use both layouts.** A separately maintained conformance
  suite (Test262), a specification kept together with its reference interpreter
  and tests (WebAssembly), one repository for compiler, runtimes and conformance
  (Protocol Buffers). The choice follows the role intended for Bitwire.

## Consequences

**Bitwire.**

- In [#39](https://github.com/Bitspark/bitwire/issues/39), steps 2, 3, 5 and 7
  move to bitruntime. Two things stay in Bitwire: step 4 (the protocol
  specification, carrier contract, runner protocol, tables and scenarios) and
  the received-context evidence change to the contract.
- The independence check now also refuses a dependency on bitruntime.
- The draft [carrier specification](../wire/carriers.md) keeps its groups and
  framing, and names bitruntime as the implementer.
- 0007's statement that "a program that depends only on Bitwire can … connect two
  processes" becomes Bitwire plus bitruntime.

**Built-in protocol vocabularies** each get one authoritative owner:

- the wire-only ones (the envelope, tunnels) are specified with the protocol in
  Bitwire;
- the identity exchange belongs to Bitlink;
- the declarations a generator reads are derived from these specifications, or
  checked against them.

**Coupling that must not move with the code.**

- The generator does not link the runtime. Validation of examples moves to
  bitschema.
- A small, neutral JSON string guard replaces the leaf the protocol engine shares
  with the generator. The regular-expression dialect moves to bitschema.
- Live references and tunnels depend on stated capabilities, meaning an Endpoint
  plus lifetime and scope, not on the peer or on a catch-all session interface.
- The identity check reports checked-and-matching, checked-and-mismatching, or
  unavailable under a stated policy. It never counts "not checked" as a match.
- Generated-code compatibility is recorded in a generation manifest, not in file
  headers.

**The family design** remains useful history. Where it differs from this decision,
this decision holds:

- bitwire is not the runtime;
- there is no bitmodel yet;
- BitTree is a consumer, not mandatory infrastructure.

## Not decided here

- The theory repository's name.
- When each repository is created, and its charter.
- The design of the new contract language.
- Research 0001's open decisions 4, 5 and 6.

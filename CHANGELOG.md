# Changelog

## Unreleased

- Add deliberately invalid `bitwire/1` testees (#59).
  `conformance/protocol/mutants/go` wraps a valid driver-1 testee and changes
  one thing: an argument in the exchange, or a WebSocket frame, through a
  transparent TCP relay. `scripts/conformance-protocol-runtime.mjs` runs each
  mutation around bitruntime's released Go testee:
  - the control, which changes nothing, must be supported;
  - every mutant must be rejected by a failing case of a scenario it names.

  Among the mutants is the defect of bitruntime#21: 4011 where 1009 is bound.
  It exposed a gap in the authored over-limit scenarios. They asserted the
  refusing peer's own report, but not the code the sender reads off the wire.
  They now do, as the malformed-frame scenario does for 4011, which gives a new
  `evidenceDigest`.

  The runs also exposed a rare race in bitruntime's Go client, now
  bitruntime#32: a cancelled call's slot is freed after the caller learns it
  ended, so a call made at once can be refused `busy`.
- Move the runtime conformance families from bitruntime v0.3.0 to v0.4.2, the
  release the `bitwire/1` runs pin. This includes the full-tree family's
  production realization, bound and served by bitruntime. The Go module,
  TypeScript release asset, SHA-256, integrity and lockfile move together.
  bitwire stays at 0.3.0.
- Adopt the carrier contract's first part (decision 0013, #54), after research
  0004:
  - Decision 0013 clarifies decision 0008. A separately versioned carrier
    contract may constrain the carriers that claim it to behavior a protocol
    revision already permits, and changes no revision. It also sets the order
    of adoption.
  - `docs/wire/carriers.md` now defines close codes:
    - the frozen valid set, 1000–1003, 1007–1014 and 3000–4999;
    - adapter capabilities;
    - validation of a close request before any state changes;
    - one closed classification with a local termination record;
    - operational failures under `bitwire/1`;
    - the revision-1 tunnel's compatibility exception.
  - It specifies `bitwire-stream/1` completely: an exact header grammar, a
    separate 123-byte close-reason limit, 1009 from the header alone,
    truncation, the close handshake with an empty-reason reply, half-close, one
    close deadline, and stdio.
  - Publication, ownership and the queued-work drain (D1 to D3) stay drafts
    for the next step.
  - `conformance/stream/vectors.json` holds 92 portable framing vectors, run by
    `scripts/stream.test.mjs` under every read schedule against two test-only
    reference receivers. Sixteen deliberately wrong receivers must each fail
    one.
  - Decisions 0008 and 0009 note the clarification and the adoption.
- Run the `bitwire/1` conformance runner against bitruntime's released
  driver-1 testees (#59). `scripts/conformance-protocol-runtime.mjs` pins
  bitruntime v0.4.2 under `conformance/protocol/testees`, builds the Go testee
  from the public module and installs the TypeScript testee from its release
  asset, both checked against the pins. It then makes one core claim per
  language over WebSockets, in every pairing. Both claims are supported, with
  345 required cases passing in each. The runtime-conformance CI job runs it.
- Repair conformance evidence that could certify broken behavior (#65):
  - The full-tree drivers hold each delivered message to an independent snapshot
    taken before sending, and a derived send's caller-visible outcome to its own
    primitive's, in Go and TypeScript. Four more unlawful realizations
    (corrupting the message, replacing the return capability, swallowing a
    refusal, throwing after admission) must each be rejected.
  - The TypeScript driver keeps a key's leading U+FEFF. The cases
    `keys-are-exact-bytes` (structure) and `carrier-keys-are-exact-bytes` hold
    it as distinct from `"a"`, for any tree realization and across carriers.
  - The `bitwire/1` matching language gains `$json` (CONTRACT.md §6.8), a
    structural assertion on a string that holds JSON. The authored scenarios
    assert response envelopes with it instead of patterns over raw text, which
    had also matched an echoed request and nested trace members.
  - The runner reads a `hello` without `listen` from both of its lists, refuses a
    `foreach.as` that names a matcher keyword, counts mirrored variants in its
    case-name uniqueness check, and refuses a repeated pairing or transport name.
- Add bitwire-authored `bitwire/1` scenarios under
  `conformance/protocol/scenarios`, written from `SCOPE.md`. Three replace
  known defects: the trace members of a response in any member order; a refused
  channel open that names the family; and the binary-frame refusal with a
  canonical handler name. The others hold what no archived scenario asserted:
  1009 for an over-limit frame in each role, 4011 for an empty method or event
  name, and the path encoding (plain names are not rejected; only canonical
  names reach a path). CONTRACT.md §4.3 now fixes that a driver's method,
  event or name is a one-segment path carried canonically. The evidence set is
  now 46 scenarios.
- Add the `bitwire/1` conformance contract, edition 1, as a draft, with its evidence set,
  under `conformance/protocol` (#60). `CONTRACT.md` defines the driver-1 exchange,
  the scenario format, the matching language, case execution, scopes, the claim
  rule and reports. The 37 scenarios derive from the archived upstream ones, and
  each adds its protocol identity, scope and source. Add bitwire's test-only runner
  for the contract, `conformance/protocol/runner/go`: it passes every example in
  the contract and writes the report of section 9. `scripts/conformance-protocol.mjs`
  tests it in CI and checks its digests against the tooling. The edition is released
  after the first runs against real testees (#59).
- Move the released-runtime conformance from bitruntime v0.2.0 to v0.3.0 (tag
  v0.3.0 at `26d1138e2d3bff4dc066d29b3d036550316363db`), in Go and TypeScript.
  Every family's results are unchanged. The runtime gap ledger names v0.3.0 and
  its moved line anchors, and the disposition re-pins its digest without
  changing any disposition.
- Publish protocol revision `bitwire/1` as an immutable bundle, `protocol/bitwire-1`. It
  holds byte-identical copies of the released Nightseam v0.6.0 wire documents,
  tables, rationale, runner material and scenarios, plus a normative `SCOPE.md`
  that states the identity, selects the binding requirements, interprets the
  tables and disposes every link. The identity is (`bitwire/1`, `normativeDigest`)
  over the scope and the six adopted artifacts. `scripts/protocol.mjs` verifies the
  bundle offline and against the public source. An informative `FINDINGS.md`
  records defects without changing revision-1 obligations. Research 0003
  (an outside consultation) chose this structure. The conformance contract and
  runner follow separately (#59).

- Add the full-tree conformance family (`conformance/wiretree`) for decision
  0012: 20 structural, 1 bridge and 8 carrier cases with independently authored
  expectations, run in Go and TypeScript against released bitruntime.
  Structural and bridge cases run without a carrier; carrier cases run on the
  local pair and on real WebSockets in both directions. The production
  realization binds a Wire to a carrier path and serves a tree through
  bitruntime's public `Bind`/`bind` and `Serve`/`serve` (v0.3.0), with
  `Update`/`update` when the far tree is edited; the reference realization
  uses test-only adapters, which answer a refused request and drop a refused
  event as `Serve` does. Twelve deliberately unlawful TypeScript
  realizations are each rejected by the case aimed at them. A disposition maps
  all 39 historical declared cases, their 19 recorded gaps and two limitations
  to current cases or explicit historical addressed limitations; the historical
  files are unchanged and pinned by digest.
- Clarify in the contract that derived sending on a missing tree path is
  refused and never reports admission. bitruntime v0.2.0 already
  behaves this way; no declaration changes.

## 0.3.0 — 2026-09-26

- Publish the immutable source release at `f825f3f4a79135646b775e25dcd770656546b4a1`.
  Verify clean public Go/npm/Rust/Python/Maven Central and anonymous
  Swift/C++/Haskell consumers. Hackage remains deferred.
  [Delivery evidence](docs/languages.md#version-030-delivery) records each route.

- Accept decision 0012 and publish breaking 0.3.0 declarations in all eight
  languages: `Wire.send(message)` is addressless; `WireTree = DeixisNode<Wire>`
  provides complete byte-keyed structure; the former addressed interface becomes
  `AddressedWire`. Align the model with Bitstore Data/DataTree, preserve Endpoint
  and return-capability semantics under unchanged bitwire/1, add migration
  guidance and independent structural reference cases. Runtime adoption and
  registry publication are separate delivery steps.

- Document the family component-first layout with two-letter language directories,
  command paths and explicit adoption notes for existing source.

- Record that bitruntime, bittype and bittheory now exist as public repositories, each opening with the charter decision 0010 requires; the theory repository is named bittheory.

- Decide that Bitwire holds the contract and a separate repository, bitruntime, implements it (decision 0010, after research 0002). This supersedes where decision 0007 put the implementations; 0007's rule and independence check stand, and the check now also refuses a dependency on bitruntime. The decision records the family map (bittype for a new, wire-independent contract language and declaration identity; bitschema; Bitlink for adapters and their generation; a public repository for the contract theory), public visibility for the new repositories, and a gated migration order for Nightseam's six dependents.

- Record research 0002 on repository boundaries that follow the contract theory, with an outside expert's advice verified against the code. The advice keeps Bitwire as the normative contract and conformance repository, moves the production implementations to a separate runtime repository, gives value types and abstract operations one wire-independent contract language, places adapters and their generation where model and wire meet, consolidates canonical declaration identity, and proposes a gated migration order. No decision record changes yet; the recommended outcome awaits the maintainer.

- Decide which carriers Bitwire provides and how byte streams carry frames (decision 0009). Carriers are grouped by what their transport lacks: WebSocket; one framing, `bitwire-stream/1`, for stdio, TCP and Unix sockets; forwarding and tunnels; the in-process pair. Connectionless transports wait for a consumer and a contract of their own, and unreliable ones are excluded. Byte streams carry `Content-Length` records with a close record and reply, checking the receive limit before reading a body. A draft carrier specification (`docs/wire/carriers.md`) holds the groups, the carrier contract and the record format.

- Decide that a protocol revision has its own identity (decision 0008): a name, an immutable behavioral revision and the hashes of its normative artifacts, never tightened in place. `bitwire/1` is the behavior of the accepted Nightseam v0.6.0 baseline. From revision 2, a bootstrap exchange establishes the revision, roles, extensions and receive limits. This supersedes decision 0004's compatibility section.

- Decide that using Bitwire never requires Nightseam (decision 0007). Bitwire takes ownership of the operators its laws describe, the transport seam and transports (an in-memory pipe, WebSocket and a framed byte stream for stdio and TCP), carriers including the protocol engine, the network protocol as `bitwire/1` (unchanged on the wire) and a carrier contract. Nightseam keeps dispatch, live references, the generator, declaration identity and authentication. This supersedes decision 0001's carrier and profile ownership. Amended the same day: the invocation lifecycle's state machine moves to Bitwire because carriers create it; moved packages get no aliases; received context becomes delivered evidence (a contract change planned for 0.3.0); the conformance runner protocol, tables and scenarios move with the protocol. A new check fails if any published package, in any language, depends on or imports Nightseam; the operators, carriers and protocol themselves are pending.

- Record research 0001 on what declared composition implies, with an outside expert's advice verified against the runtime. Clarify decision 0006, the contract and all eight binding documents. Behavior may reveal which routes respond. Retained parts carry authority. Composites attenuate routes but are not a membrane. A composite of selected views restricts by first segment, while origin-only leaves give an exact operation set. Capture, not carrier acceptance, fixes a request's route. Ordering is partial: a forwarder keeps its source's delivery order. Routing through opaque children may cycle, and nothing claims it terminates.

- Add a self-contained poster at `poster/index.html` for new consumers: the
  seam, one send traced through an assembly, attachment in each language, the
  rules and limits, and how conformance is checked. `poster/SEAM.md` cites every
  claim; `poster/DESIGN.md` records the editorial and visual contract.

- Add a runnable use-case catalogue linking Nightseam's Go and TypeScript
  consumers for service trees, remounting, retained cart state and guards,
  pending-call cancellation and WebSocket calls. Document the bookshop model,
  example ownership, commands, packaging checks and source-versus-release status.

- Run Nightseam's actual requester-cancellation tests through bound, selected and reconstructed declared access in the production acceptance gate, alongside the 39 independent composition cases.
- Define declared composites as a realization of Deixis `Node[T]` (decision 0006): an origin at every node beside complete named children, exact UTF-8 segment keys, both reconstruction directions, agreement across complete cuts and an explicit observational equivalence. This supersedes the unreleased decision 0005's policy-bearing node value; interception becomes a guard composed around access. All eight native presentations are aligned without adding Wire methods.
- Replace the declared fixtures with 39 independent cases, run through a test-only reference interpreter and through released Nightseam v0.6.0's child-only `Mount`, locally and over WebSockets in both directions. Production may differ only by exactly recorded gaps: no origin-bearing construction, and conflicting, invalid or missing children accepted at construction.
- Verify Nightseam's unreleased production Go/TypeScript declared-composition API (PR #713) against all 39 decision 0006 cases at a pinned public source revision, with no gaps accepted; the superseded decision 0005 gate and its fixture are retired, and the released baseline keeps its recorded gaps.

- Clarify return-capability origins and record the accepted release-qualified Nightseam 0.6.0 profile baseline in all eight binding documents, without changing native declarations.
- Execute Bitwire's composition oracle against released production Go/TypeScript local and WebSocket endpoints; add independent lifecycle observations and separate upstream endpoint, race, serial and execution-budget evidence to required CI.
- Record completed Go/TypeScript adoption and the remaining lifecycle, generated/live and consumer acceptance work explicitly.

- Record two open contract review findings against the invocation lifecycle
  evidence: ownership of the return capability's path space, and the compatibility
  disposition of tightening the pinned profile in place.

- Record verified 0.2.0 Go/npm/Rust/Python/Java registry consumers and Swift/C++/Haskell anonymous source consumers, plus Nightseam's released-contract handover.

- Publish Java 0.1.0 on Maven Central and verify an independent public registry consumer.
- Add a manual Maven authentication diagnostic that checks secret formatting and effective settings without exposing credentials or publishing artifacts.
- Check heading anchors in local documentation links, not only the destination file.

## 0.2.0 — 2026-09-21

- Separate send-only Wire from Endpoint receive attachment and closure in all eight native bindings.
- Replace path-based receive registration with one owning receiver; move matching and overlap policy to composed dispatchers.
- Document shared receiving views, relative-path laws, capability separation and migration from 0.1.0.
- Exercise the new boundary with a test-only Go/TypeScript composition experiment and independent expected observations; retain the pinned Nightseam 0.1.0 baseline as historical evidence.
- Update packaged consumers to the new access and endpoint interfaces; coordinate runtime/generator migration in Nightseam #439.

- Support Haskell installation directly from the pinned public Git release, with an anonymous fresh-store consumer check in CI; defer Hackage publication.
- Record verified 0.1.0 distribution availability and the Nightseam handover.
- Wait for npm's install metadata to contain the released version before checking public consumers.
- Resolve the public GitHub repository without a trailing slash in Python/Haskell publication checks.

## 0.1.0 — 2026-09-21

- Provide native contract bindings for Go, TypeScript, Python, Rust, Swift, C++, Java and Haskell.
- Execute ten independent access-composition cases in Go and TypeScript against pinned public Nightseam.
- Validate package artifacts and consumers outside the checkout.
- Publish npmjs, Go and crates.io packages with exact-commit public rehearsal and registry verification.
- Verify public SwiftPM Git dependency and C++ installed-package consumers.
- Publish Python on PyPI and verify tests against the public installation.
- Add separate manual publication paths for PyPI, Maven Central and Hackage.
- Define common preservation laws and the retained profile boundary without moving runtime or generator implementations.

- Track all eight native language bindings and the independent public Nightseam handover.

- Record Nightseam's approved 0.6.0 Bitwire adoption plan, distinct from its pending implementation.
- Establish Bitwire as the shared Wire contract and conformance project.
- Add Go and TypeScript declarations based on Nightseam's relative-path Wire.
- Document composition laws, message-profile boundaries and pending consumer adoption.
- Add portable declaration and documentation checks, run by CI on Linux and Windows.

The release includes no endpoint runtime and does not claim completed Nightseam
adoption. The conformance baseline records its remaining profile/runtime obligations;
each distribution's availability is recorded in the [language matrix](docs/languages.md).

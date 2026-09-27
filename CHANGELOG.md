# Changelog

## Unreleased

- Repair conformance evidence that could certify broken behavior (#65):
  - The full-tree drivers hold each delivered message to an independent snapshot
    taken before sending, and a derived send's caller-visible outcome to its own
    primitive's, in Go and TypeScript. Four more unlawful realizations
    (corrupting the message, replacing the return capability, swallowing a
    refusal, throwing after admission) must each be rejected.
  - The TypeScript driver keeps a key's leading U+FEFF, and the carrier case
    `carrier-keys-are-exact-bytes` holds it as distinct from `"a"`.
  - The `bitwire/1` matching language gains `$json` (CONTRACT.md §6.8), a
    structural assertion on a string that holds JSON. The authored scenarios
    assert response envelopes with it instead of patterns over raw text, which
    had also matched an echoed request and nested trace members.
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
  0012: 19 structural, 1 bridge and 8 carrier cases with independently authored
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

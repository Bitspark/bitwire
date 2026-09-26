# Changelog

## Unreleased

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

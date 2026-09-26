# Language bindings

Bitwire has one shared contract with eight native presentations. A binding gives
generated adapters, runtime implementations and application code the same native
boundary. It does not require Bitwire to own their execution machinery.

## Coordinates and scope

| Language | Source | Package or product | Consumer name | Tracking |
| --- | --- | --- | --- | --- |
| Go | `wire/go` | `github.com/Bitspark/bitwire` | `github.com/Bitspark/bitwire/wire/go` | [#5](https://github.com/Bitspark/bitwire/issues/5) |
| TypeScript | `wire/ts` | `@bitspark/bitwire` on npmjs | `@bitspark/bitwire` | [#5](https://github.com/Bitspark/bitwire/issues/5) |
| Python | `wire/py` | `bitspark-bitwire` on PyPI | `bitwire` | [#7](https://github.com/Bitspark/bitwire/issues/7) |
| Rust | `wire/rs` | `bitspark-bitwire` on crates.io | `bitwire` | [#6](https://github.com/Bitspark/bitwire/issues/6) |
| Swift | `wire/swift` | SwiftPM product `Bitwire` | `Bitwire` | [#8](https://github.com/Bitspark/bitwire/issues/8) |
| C++ | `wire/cpp` | CMake package `Bitwire`, target `Bitwire::wire` | `<bitwire/wire.hpp>`, namespace `bitwire` | [#9](https://github.com/Bitspark/bitwire/issues/9) |
| Java | `wire/java` | Maven `dev.bitspark:bitwire` | `dev.bitspark.bitwire` | [#10](https://github.com/Bitspark/bitwire/issues/10) |
| Haskell | `wire/hs` | `bitspark-bitwire` on Hackage | `Bitwire` | [#11](https://github.com/Bitspark/bitwire/issues/11) |

The delivery table below distinguishes published coordinates from pending ones. Swift uses
a repository-root manifest so a Git dependency can resolve the public package.
C++ initially uses tagged source and an installable CMake package; registry
recipes can be added without changing the access contract.

## Version 0.3.0 delivery

[Decision 0012](decisions/0012-explicit-data-and-wire-trees.md) is accepted.
All eight bindings distinguish `Wire.send(message)`, the complete
`WireTree = DeixisNode<Wire>`, and `AddressedWire.send(path, message)`.
Each tree supplies own, complete byte-keyed children, partial selection and
decomposition, matching Bitstore's DataTree. Endpoint and return-address
surfaces remain addressed. See the [migration guide](migration-0.3.md).

The immutable [v0.3.0 release](https://github.com/Bitspark/bitwire/releases/tag/v0.3.0)
was created on 2026-09-26 and names
commit `f825f3f4a79135646b775e25dcd770656546b4a1`, merged through
[PR #50](https://github.com/Bitspark/bitwire/pull/50). Its annotated tag object is
`713c9c8b0df718e77f572fe4eb6937a2c429bc22`. The
[exact-commit public provenance rehearsal](https://github.com/Bitspark/bitwire/actions/runs/36231327044)
passed. Distribution availability is verified independently:

| Language | Public delivery of 0.3.0 | Installation evidence |
| --- | --- | --- |
| Go | `github.com/Bitspark/bitwire@v0.3.0` through the public Go proxy. | Fresh strict public-proxy consumer passed with checksum database enabled, the exact release commit and no replacements. |
| TypeScript | [`@bitspark/bitwire@0.3.0`](https://www.npmjs.com/package/@bitspark/bitwire/v/0.3.0) with provenance. | Fresh public npm installation, TypeScript compilation and runtime entry-point import passed. |
| Rust | [`bitspark-bitwire@0.3.0`](https://crates.io/crates/bitspark-bitwire/0.3.0) published. | Publication and a clean public consumer passed in the [core workflow](https://github.com/Bitspark/bitwire/actions/runs/36231433436). |
| Python | [`bitspark-bitwire==0.3.0`](https://pypi.org/project/bitspark-bitwire/0.3.0/) on PyPI. | Public installed-package tests passed after source/wheel checks and publication. |
| Swift | Public SwiftPM Git dependency, exact version `0.3.0`. | Fresh anonymous URL consumer built and ran against the exact release commit. |
| C++ | Public tagged source and installed `Bitwire::wire` CMake package. | Anonymous release checkout and external installed-package consumer passed against the exact release commit. |
| Java | [`dev.bitspark:bitwire:0.3.0`](https://repo.maven.apache.org/maven2/dev/bitspark/bitwire/0.3.0/) on Maven Central. | Signed artifacts published; an independent Central consumer compiled and ran with a fresh Maven repository. |
| Haskell | Public Git dependency pinned to the 0.3.0 release commit; Hackage remains deferred. | Anonymous Git consumer built and ran with a fresh Cabal store against the exact release. |

The [core publication and public registry verification](https://github.com/Bitspark/bitwire/actions/runs/36231433436)
passed for Go, npm and Rust. [Python publication and installed-package verification](https://github.com/Bitspark/bitwire/actions/runs/36232678897)
passed using the configured API-token route. [Swift/C++/Haskell anonymous source verification](https://github.com/Bitspark/bitwire/actions/runs/36232682234)
passed against the immutable release. [Maven Central publication and clean-consumer verification](https://github.com/Bitspark/bitwire/actions/runs/36232680583)
also passed against that release. All eight delivery routes are verified.
Hackage remains deferred under the existing uploader-approval decision.

The [tree reference observations](../conformance/trees/README.md) exercise
independent Go/TypeScript test-only interpreters. The package contains no
production tree runtime. Runtime and downstream adoption remain separately
verified in their owners; compiling these declarations or installing a package
does not establish those behaviors.

Decision 0007 originally planned public received-context evidence for 0.3.0.
That separate lifecycle feature is not delivered by this naming/structure
revision: existing message associations and addressed return semantics remain
unchanged. Its design and delivery remain pending in the runtime/profile lane.

## Published 0.2.0 delivery (historical names)

This evidence preserves 0.2.0's names: its addressed type was `Wire`. In 0.3
that surface is `AddressedWire`. No 0.2 artifact exports the new primitive or
full tree interface.

**0.2.0 is released**, a breaking minor revision. Wire provides Send; Endpoint
adds a single Receive attachment and Close. All eight native bindings and package
consumers use that contract. See the
[decision and migration](decisions/0002-delivery-dispatch-and-ownership.md).

The immutable [v0.2.0 source release](https://github.com/Bitspark/bitwire/releases/tag/v0.2.0)
identifies commit `616a2fc5e3a0972f67f40331a9d9ca102bc9698d`. Distribution
availability is verified independently:

| Language | Public delivery of 0.2.0 | Installation evidence |
| --- | --- | --- |
| Go | `github.com/Bitspark/bitwire@v0.2.0` through the public Go proxy | Clean module consumer, checksum database enabled, no replacements. |
| TypeScript | [`@bitspark/bitwire@0.2.0`](https://www.npmjs.com/package/@bitspark/bitwire/v/0.2.0) with provenance | Clean npm install, TypeScript compilation and runtime entry-point import. |
| Rust | [`bitspark-bitwire@0.2.0`](https://crates.io/crates/bitspark-bitwire/0.2.0) | Clean Cargo registry consumer compiled and ran. |
| Python | [`bitspark-bitwire==0.2.0`](https://pypi.org/project/bitspark-bitwire/0.2.0/) | Tests passed against the public PyPI installation after wheel/source and exact-wheel consumer checks. |
| Swift | Public Git dependency, exact version `0.2.0` | Fresh SwiftPM URL consumer compiled and ran; resolved version and commit equal the immutable release. |
| C++ | Public tagged source and installed `Bitwire::wire` | Anonymous release checkout matched its SHA; an external installed-package consumer passed. |
| Java | [`dev.bitspark:bitwire:0.2.0`](https://repo.maven.apache.org/maven2/dev/bitspark/bitwire/0.2.0/) on Maven Central | Signed binary, POM, sources and Javadoc published; an independent public Central consumer compiled and ran with a fresh Maven repository. |
| Haskell | Public Git dependency pinned to the 0.2.0 release commit | Anonymous Git consumer built and ran with a fresh Cabal store; Hackage remains deferred in [#11](https://github.com/Bitspark/bitwire/issues/11). |

The [exact-commit public rehearsal](https://github.com/Bitspark/bitwire/actions/runs/35588663413)
and [core publication](https://github.com/Bitspark/bitwire/actions/runs/35588831224)
passed. The latter verifies Go, npm and Rust registry consumers.
[Python publication and verification](https://github.com/Bitspark/bitwire/actions/runs/35589245306)
used the configured API-token route; installation passed after registry propagation.
[Java publication and clean Central verification](https://github.com/Bitspark/bitwire/actions/runs/35589087610)
passed with the configured signing key and corrected Portal credentials.
[Swift/C++/Haskell source verification](https://github.com/Bitspark/bitwire/actions/runs/35589088118)
passed against the immutable release, with an isolated anonymous consumer for each.

The [reference composition experiment](../conformance/reference/README.md) exercises
0.2 in Go and TypeScript; it is not a shipped runtime or proof of Nightseam's
adoption. The separate pinned Nightseam baseline remains historical 0.1 evidence.
[Capture-retirement issue #20](https://github.com/Bitspark/bitwire/issues/20) stays
open for actual profile/runtime acceptance. Public packages, reference evidence
and consumer adoption are distinct results.

The immutable [0.1.0 release](https://github.com/Bitspark/bitwire/releases/tag/v0.1.0)
and its API remain available. Hackage publication is deferred by operator decision;
Git is the supported Haskell delivery route.

## Historical declared composites

[Decision 0006](decisions/0006-declared-composites-realize-deixis-nodes.md)
makes declared composites a realization of Deixis nodes. Each node's value is
an origin, and named children stay complete Wire access. It supersedes the
unreleased decision 0005. Decision 0012 supersedes this structural interpretation:
the historical UTF-8 key image and owner-retained parts are addressed behavior,
not the complete byte-keyed tree interface now required in all source bindings.

| Language | Contract | Reference evidence | Released runtime evidence | Production construction with origins |
| --- | --- | --- | --- | --- |
| Go | Documented | 39 cases, three carriers | Nightseam v0.6.0 `Mount`: 20 child-only cases conform; 19 recorded gaps | Unreleased Nightseam source (PR #713): all 39 cases, no gaps; not yet released |
| TypeScript | Documented | 39 cases, three carriers | Nightseam v0.6.0 `mount`: 20 child-only cases conform; 19 recorded gaps | Unreleased Nightseam source (PR #713): all 39 cases, no gaps; not yet released |
| Python, Rust, Swift, C++, Java, Haskell | Documented | None | Not exercised | Not assessed |

The [evidence](../conformance/declared/README.md) lists the cases and the
[gap ledger](../conformance/declared/production-gaps.json) holds the exact
production observations. Reference interpreters are test-only and are not
counted as runtime adoption. The separate [production gate](../conformance/production/README.md)
runs the same cases through Nightseam's unreleased Go/TypeScript construction
API from PR #713 at a pinned source revision, with no gaps accepted. Native
construction and actual requester-cancellation tests supplement those cases in
both languages. Adoption by a released runtime package is still pending.

## Independence from Nightseam

[Decision 0007](decisions/0007-using-bitwire-never-requires-nightseam.md) requires
that using Bitwire never requires Nightseam. `node scripts/check.mjs` fails if any
published package below depends on or imports Nightseam or bitruntime.
[Decision 0010](decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md) places the
implementations in [bitruntime](https://github.com/Bitspark/bitruntime). Its
production rollout must be verified separately; the original delivery split was:

| Language | Contract (Bitwire) | Operators (bitruntime) | In-process pair and transports (bitruntime) | Protocol engine (bitruntime) |
| --- | --- | --- | --- | --- |
| Go | Delivered | Pending | Pending | Pending |
| TypeScript | Delivered | Pending | Pending | Pending |
| Python, Rust, Swift, C++, Java, Haskell | Delivered | Not planned until a consumer needs it | Not planned | Not planned |

The in-process pair creates invocations, so the invocation lifecycle's state
machine arrives with the operators. Until bitruntime delivers a piece, it comes
from frozen Nightseam v0.6.0.

## Native representations

The [contract](wire/contract.md) is normative. Representations must preserve exact
arbitrary byte tree keys, complete own/child structure, structural absence,
scalar-string carrier paths, frame values and absence versus JSON null, local return
identity, received context and lifetime observations. Callback and error shapes
follow each language, with their mapping documented. Local context and return
capabilities are not serialized into profile envelopes.

Nightseam at `1c63f1c4d7e4b5987d4bd32e294177645c92ed8f` provides extraction
references for Go, TypeScript, Python, Rust, Swift, C++ and Java. Its Haskell
runtime was not present at that extraction revision; that binding was derived
from this shared contract. This historical reference is not a statement about
the current upstream rollout.

## Adoption

Nightseam v0.6.0 has adopted Bitwire v0.2.0 in Go and TypeScript through
[PR444](https://github.com/Bitspark/nightseam/pull/444), closing #421 and #439.
The [current baseline](../conformance/current/README.md) checks the actual
production implementations and distinguishes scoped lifecycle evidence from
remaining acceptance. The other six bindings share the documented return-origin
semantics, but their runtime/profile adoption and validation remain separately
tracked upstream; this baseline makes no six-language conformance claim.
All eight Bitwire bindings remain in scope. A binding can exist before a
complete runtime or generator in that language.

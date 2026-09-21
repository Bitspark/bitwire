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

## Current delivery

All eight native bindings are implemented. Go/TypeScript have independent
behavioral observations against pinned Nightseam; native bindings have type,
representation and packaged-consumer checks. The latter do not establish that
their runtime implementations conform.

The immutable [v0.1.0 source release](https://github.com/Bitspark/bitwire/releases/tag/v0.1.0)
identifies commit `9f45a2e0e9dc576db34237e5ad3aaaa0266a276b`. Availability is
verified independently for each distribution:

| Language | Public delivery of 0.1.0 | Installation evidence |
| --- | --- | --- |
| Go | `github.com/Bitspark/bitwire@v0.1.0` through the public Go proxy | Clean module consumer, checksum database enabled, no replacements. |
| TypeScript | [`@bitspark/bitwire@0.1.0`](https://www.npmjs.com/package/@bitspark/bitwire/v/0.1.0) with provenance | Clean npm install, TypeScript compilation and runtime entry-point import. |
| Rust | [`bitspark-bitwire@0.1.0`](https://crates.io/crates/bitspark-bitwire/0.1.0) | Clean Cargo registry consumer compiled and ran. |
| Python | [`bitspark-bitwire==0.1.0`](https://pypi.org/project/bitspark-bitwire/0.1.0/) | Tests passed against the public PyPI installation, following wheel/source and exact-wheel consumer checks. |
| Swift | Public Git dependency, exact version `0.1.0` | Standalone Swift 6.1.3 consumer resolved the tag, compiled and ran. |
| C++ | Public tagged source and installed `Bitwire::wire` | GNU 13.3 installed-package consumer compiled and passed CTest. |
| Java | Maven Central publication pending | Build, tests, sources, Javadoc, installed consumer and signing passed; Central rejects the configured token with HTTP 401, tracked in [#10](https://github.com/Bitspark/bitwire/issues/10). |
| Haskell | Public Git dependency pinned to the 0.1.0 release commit | Cabal build/tests, source-package consumer and anonymous Git consumer with a fresh store; [installation instructions](../wire/hs/README.md#install-from-git). Hackage publication is deferred in [#11](https://github.com/Bitspark/bitwire/issues/11). |

The [core release run](https://github.com/Bitspark/bitwire/actions/runs/35577033829)
records Go, npm and Rust registry checks. Swift and C++ public source checks used
disposable environments, anonymous HTTPS fetch and no source checkout mounts.
The [Python publication run](https://github.com/Bitspark/bitwire/actions/runs/35578328647)
records the upload and subsequent PyPI installation tests.
The [Haskell publication run](https://github.com/Bitspark/bitwire/actions/runs/35578334722)
records successful artifact checks and the subsequent authorization refusal.
The supported Haskell distribution now uses the public Git release; the
`bindings` workflow checks that installation separately from the current source.
Every binding carries contract revision `0.1.0`; registry availability and
Nightseam adoption remain separate facts.

## Native representations

The [contract](wire/contract.md) is normative. Representations must preserve exact
scalar-string paths, frame values and absence versus JSON null, local return
identity, received context and lifetime observations. Callback and error shapes
follow each language, with their mapping documented. Local context and return
capabilities are not serialized into profile envelopes.

Nightseam at `1c63f1c4d7e4b5987d4bd32e294177645c92ed8f` provides extraction
references for Go, TypeScript, Python, Rust, Swift, C++ and Java. Its Haskell
runtime has not landed; that binding is derived from this shared contract.

## Adoption

[Nightseam #421](https://github.com/Bitspark/nightseam/issues/421) has received the
verified public Go/TypeScript handover for 0.6.0; its import migration and
post-adoption acceptance are tracked there. Its other-language rollout is separately
scheduled upstream. All eight Bitwire bindings remain in scope; no future
runtime port or extra registry account silently becomes a prerequisite for the
agreed Go/TypeScript handover. A binding can exist before a complete runtime or
generator in that language.

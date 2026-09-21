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
| Java | `wire/java` | Maven `io.github.bitspark:bitwire` | `io.github.bitspark.bitwire` | [#10](https://github.com/Bitspark/bitwire/issues/10) |
| Haskell | `wire/hs` | `bitspark-bitwire` on Hackage | `Bitwire` | [#11](https://github.com/Bitspark/bitwire/issues/11) |

Coordinates are release targets until verified in the named registry. Swift uses
a repository-root manifest so a Git dependency can resolve the public package.
C++ initially uses tagged source and an installable CMake package; registry
recipes can be added without changing the access contract.

## Current delivery

Go and TypeScript declarations are present. The six additional bindings and
their package checks are being implemented under the issues above. No registry
publication or Nightseam import migration is claimed by this matrix yet.

The initial release target is contract revision `0.1.0`. Every published binding
must identify its contract revision. A source tag, a compiled artifact, a
registry upload and an adopted dependency are separate facts. Release notes
record which languages were validated and where consumers can actually install
them; an unavailable registry does not make a package published.

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

[Nightseam #421](https://github.com/Bitspark/nightseam/issues/421) requires the
public Go/TypeScript handover for 0.6.0. Its other-language rollout is separately
scheduled upstream. All eight Bitwire bindings remain in scope; no future
runtime port or extra registry account silently becomes a prerequisite for the
agreed Go/TypeScript handover. A binding can exist before a complete runtime or
generator in that language.

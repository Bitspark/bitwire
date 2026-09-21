# Bitwire

[![ci](https://github.com/Bitspark/bitwire/actions/workflows/ci.yml/badge.svg)](https://github.com/Bitspark/bitwire/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

One contract for access through relative paths.

Bitwire defines the interface between a model's generated adapters and the
runtime that carries its interactions. A wire gives access to an origin;
selecting a path or mounting several origins must preserve that same interface.
The contract is shared across languages, generators and runtime implementations.

**Status: 0.2.0 candidate; [0.1.0 remains released](https://github.com/Bitspark/bitwire/releases/tag/v0.1.0).**
All eight bindings separate send access from receive attachment and closure.
A test-only Go/TypeScript composition experiment exercises shared dispatch,
relative paths and preservation. The earlier ten Nightseam cases remain a pinned
0.1.0 baseline. The [language matrix](docs/languages.md) records publication and
adoption separately. No production endpoint runtime is included.

## The interface

```typescript
interface Wire {
  send(path: Path, message: Message): void;
}

interface Endpoint extends Wire {
  receive(receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}

interface Receiver {
  message?: (path: Path, message: Message) => void | Promise<void>;
  closed?: (code: number, reason: string) => void;
}
```

Paths are sequences of opaque strings, relative to the wire's origin. `Message`
carries a request, response, event or cancellation and may hold a local return
capability. An Endpoint accepts one active receiver and returns its detach
function. Path registration and matching belong to a composed dispatcher;
selected receiving views share that owner. The [design decision](docs/decisions/0002-delivery-dispatch-and-ownership.md)
explains why access and ownership are separate capabilities.
The [contract](docs/wire/contract.md) gives these names their shared meaning.

Selection and mounting are governed by laws, not by the choice of carrier:

```text
at(at(w, a), b) ≃ at(w, a ++ b)
at(w, [])      ≃ w
```

These are contract laws. Runtime implementations supply `at` and `mount`;
Bitwire's independent cases check their observable behavior.

## Who owns what

| Project | Responsibility |
| --- | --- |
| **Bitwire** | Shared access contract, language declarations and independent conformance criteria. |
| **Nightseam** | Its runtime, carriers, peers, tunnels, live-reference machinery and generator. |
| **Bitlink** | Its planned protocol projections and generated adapters. |
| **Bitsystem** | Typed spaces and the kernel/system operations exposed through them. |

Sharing an interface is necessary for composition. Interoperability also requires
agreement on the message profile, operation addresses, contract identity and live
reference rules. The starting profile remains `nightseam.duplex/1`; creating this
repository does not rename it or establish a new on-the-network protocol.

The [ownership decision](docs/decisions/0001-shared-wire-contract.md) records the
scope. [Integration status](docs/integration.md) distinguishes the intended
dependency direction from today's implementations.

The complete scope includes Go, TypeScript, Python, Rust, Swift, C++, Java and
Haskell. See the [language bindings](docs/languages.md) and
[first delivery plan](docs/delivery.md) for package coordinates and readiness.

## Layout

| Path | Contents |
| --- | --- |
| [wire/go](wire/go/README.md) | Go contract declarations; standard library only. |
| [wire/ts](wire/ts/README.md) | TypeScript contract declarations; no runtime dependencies. |
| [wire/py](wire/py/README.md) | Typed Python contract and wheel/source package checks. |
| [wire/rs](wire/rs/README.md) | Rust contract crate and outside-checkout consumer. |
| [wire/swift](wire/swift/README.md) | SwiftPM `Bitwire` product and native contract. |
| [wire/cpp](wire/cpp/README.md) | C++20 header and installable `Bitwire::wire` CMake target. |
| [wire/java](wire/java/README.md) | Java 21 `dev.bitspark:bitwire` Maven artifact. |
| [wire/hs](wire/hs/README.md) | Haskell `Bitwire` module and Cabal source package. |
| [docs](docs/README.md) | Purpose, contract, profile boundary, decisions and integration plan. |
| [conformance](conformance/README.md) | Independent cases and pinned public Nightseam drivers. |
| [scripts](scripts/README.md) | Portable repository checks, also used in CI. |

Components contain their language presentations, following Nightseam and Archon.
There is one root Go module and a pnpm workspace. No generator or transport is a
dependency of the contract packages.

## Work on it

Use Go 1.26, Node.js 24 or later, and pnpm 12.4.1:

```console
pnpm install --frozen-lockfile
node scripts/check.mjs
```

The core check validates documentation, Go and TypeScript. Run
`node scripts/conformance.mjs` for executable access observations, and
`node scripts/smoke-packed.mjs` after building for installed npm/Go consumers.
The native package checks and required toolchains are documented in each
binding's README and exercised by CI. These commands need no private sibling
checkout or registry publishing credentials.

## Documentation and contributions

Start at the [documentation index](docs/README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md). [SECURITY.md](SECURITY.md) describes private
reporting; [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) describes participation.

## License

Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

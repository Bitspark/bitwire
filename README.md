# Bitwire

[![ci](https://github.com/Bitspark/bitwire/actions/workflows/ci.yml/badge.svg)](https://github.com/Bitspark/bitwire/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

One contract for access through relative paths.

Bitwire defines the interface between a model's generated adapters and the
runtime that carries its interactions. A wire gives access to an origin;
selecting a path or mounting several origins must preserve that same interface.
The contract is shared across languages, generators and runtime implementations.

**Status: initial scaffold.** Go and TypeScript declarations are present, adapted
from Nightseam's implemented Wire. The behavioral specification is a draft.
There is no endpoint runtime, completed behavioral conformance suite, released
package or consumer migration yet. The repository starts private; its sources
and development checks require no other private repository.

## The interface

```typescript
interface Wire {
  send(path: Path, message: Message): void;
  receive(path: Path, receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}
```

Paths are sequences of opaque strings, relative to the wire's origin. `Message`
carries a request, response, event or cancellation and may hold a local return
capability. `receive` installs a receiver and returns its detach function.
The [contract](docs/wire/contract.md) gives these names their shared meaning.

Selection and mounting are governed by laws, not by the choice of carrier:

```text
at(at(w, a), b) ≃ at(w, a ++ b)
at(w, [])      ≃ w
```

These are contract laws; this scaffold does not yet implement `at` or `mount`.

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
| [docs](docs/README.md) | Purpose, contract, profile boundary, decisions and integration plan. |
| [conformance](conformance/README.md) | Behavioral acceptance plan; executable runtime cases are still to come. |
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

The check validates local documentation links, Go formatting and compilation,
and the TypeScript declarations and build. It does **not** report wire behavior
as conforming: no runtime is exercised yet. No credentials or sibling checkout
are needed. The TypeScript package is marked private until its first release.

## Documentation and contributions

Start at the [documentation index](docs/README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md). [SECURITY.md](SECURITY.md) describes private
reporting; [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) describes participation.

## License

Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

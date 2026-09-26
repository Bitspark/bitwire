# Bitwire

[![ci](https://github.com/Bitspark/bitwire/actions/workflows/ci.yml/badge.svg)](https://github.com/Bitspark/bitwire/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Addressless interaction and complete, byte-keyed interaction trees.

Bitwire defines `Wire`, the primitive that sends one message, and
`WireTree = DeixisNode<Wire>`, the full structure that gives primitives
addresses. Bitstore uses the same construction: `Data.read(): Promise<Bytes>`
and `DataTree = DeixisNode<Data>`. [Decision 0012](docs/decisions/0012-explicit-data-and-wire-trees.md)
records the shared contract and the intentional breaking rename.

**Source status: 0.3.0 declarations; publication pending.** The last published
release is [0.2.0](https://github.com/Bitspark/bitwire/releases/tag/v0.2.0).
All eight source bindings distinguish the primitive, full tree and addressed
carrier. Historical evidence remains versioned separately; compiling these
interfaces does not prove runtime structural conformance. The
[language matrix](docs/languages.md) records each delivery boundary.
Production implementations belong to bitruntime under
[decision 0010](docs/decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md).

## The interface

```typescript
interface Wire {
  send(message: Message): void;
}

interface DeixisNode<T> {
  own(): T;
  children(): ReadonlyArray<readonly [Uint8Array, DeixisNode<T>]>;
  at(path: readonly Uint8Array[]): DeixisNode<T> | undefined;
  decompose(): Readonly<{
    own: T;
    children: ReadonlyArray<readonly [Uint8Array, DeixisNode<T>]>;
  }>;
}

type WireTree = DeixisNode<Wire>;
```

Trees are finite and acyclic, with an own value and a complete child map at
every node. Keys are exact arbitrary bytes. Empty path selects self; missing
selection differs from a Wire that refuses. Decomposition and reconstruction
preserve the complete structure and primitive identities.

For an existing path, the two lanes differ only in their own operation:

```text
send(tree, path, message) = select(tree, path).own().send(message)
read(tree, path)          = select(tree, path).own().read()
```

The old addressed surface has an explicit separate name:

```typescript
interface AddressedWire {
  send(path: Path, message: Message): void;
}

interface Endpoint extends AddressedWire {
  receive(receiver: Receiver): () => void;
  close(code?: number, reason?: string): void;
}

interface Receiver {
  message?: (path: Path, message: Message) => void | Promise<void>;
  closed?: (code: number, reason: string) => void;
}
```

`Endpoint` and `ReturnAddress.wire` retain addressed delivery and existing
string paths. The `bitwire/1` envelope, invocation paths, admission, attachment
and closure semantics are unchanged. An opaque addressed router cannot supply
the complete structure required of a `WireTree`. See the
[contract](docs/wire/contract.md), [migration guide](docs/migration-0.3.md)
and [composition guide](docs/composition.md).

## Who owns what

| Project | Responsibility |
| --- | --- |
| **Bitwire** | Primitive and full tree contracts, language declarations, protocol and carrier specifications, and independent conformance criteria. |
| [**bitruntime**](https://github.com/Bitspark/bitruntime) | The Go and TypeScript implementations: operators, carriers, protocol engine, dispatch, live references, tunnels ([decision 0010](docs/decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md)). Until it delivers, Nightseam v0.6.0, now frozen, is the implementation in use. |
| **Bitlink** | Its planned protocol projections and generated adapters. |
| **Bitsystem** | Typed spaces and the kernel/system operations exposed through them. |

Sharing an interface is necessary for composition. Interoperability also requires
agreement on the message profile, operation addresses, contract identity and live
reference rules. The profile is `nightseam.duplex/1`; decision 0007 moves its
specification here as `bitwire/1`, with the same bytes on the wire.

The [ownership decision](docs/decisions/0001-shared-wire-contract.md) records the
scope, [decision 0007](docs/decisions/0007-using-bitwire-never-requires-nightseam.md) that using Bitwire never requires Nightseam, and [decision 0010](docs/decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md) where the implementations live. [Integration status](docs/integration.md) distinguishes the intended
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
| [examples](examples/README.md) | Runnable use cases, their models, commands and implementation owners. |
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

## Source layout

Read [LAYOUT.md](LAYOUT.md) for the component-first, two-letter language
directory convention and this repository's adoption notes.

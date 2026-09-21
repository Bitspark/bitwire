# Releases

The first public release is `0.1.0`. A release identifies the shared contract revision,
native bindings and independent cases. The [language matrix](docs/languages.md)
records implementation, package validation, registry publication and consumer
adoption separately. A source tag does not claim an upload to every registry.

## Compatibility and readiness

Before 1.0, a breaking contract or native API change increments the minor version;
a compatible correction increments the patch version. Published artifacts and
tags are immutable. Preserve `nightseam.duplex/1` unless a separately specified
protocol change requires a new identifier. Published libraries do not depend on
Nightseam; test-only drivers use the public revision in `conformance/nightseam.json`.

The required core, behavioral, package and native-binding CI checks must pass.
Independent cases report their explicit scope and remaining obligations.
Package versions, licenses and provenance must agree. Consumers install prepared
artifacts outside the checkout; registry checks repeat installation from the
actual published versions. Merge the candidate and record the exact release SHA.

## Go, npm and Rust handover

The `release.yml` workflow rehearses on manual invocation and publishes only on
a `v*` tag push. Publication requires a successful public provenance rehearsal
of that exact commit and version.

1. Run `pnpm install --frozen-lockfile`, `node scripts/check.mjs`,
   `node scripts/conformance.mjs`, `node scripts/release-prepare.mjs v0.1.0`,
   `node scripts/smoke-packed.mjs` and `node wire/rs/check-package.mjs`.
2. Optionally rehearse the merged commit privately:
   `gh workflow run release.yml --ref main -f tag=v0.1.0 -f provenance=false`.
3. For the public launch, make the repository public and enable immutable
   GitHub releases. The organization's release-tag rule already protects `v*`.
   Run `gh workflow run release.yml --ref main -f tag=v0.1.0 -f provenance=true`.
   Verify the successful run's SHA and stored rehearsal receipt. A source change
   requires a new rehearsal; an earlier run does not validate a later commit.
4. Tag that exact merged commit as `v0.1.0` and push the tag once. The workflow
   repeats checks, publishes `@bitspark/bitwire` with provenance and the Rust
   crate when present, verifies public npm/Go/Rust installation and creates the
   GitHub release. Go's module `github.com/Bitspark/bitwire` is distributed by
   the tag; import `github.com/Bitspark/bitwire/wire/go`.
5. Send the verified version, source SHA and conformance invocation to
   [Nightseam #421](https://github.com/Bitspark/nightseam/issues/421), which owns
   imports/re-exports and post-adoption generated-adapter acceptance.

Both npm's registry and the `@bitspark` scope are explicitly set to
`https://registry.npmjs.org`; local GitHub Packages settings cannot redirect the
upload. Initial publication uses `NPM_TOKEN`; later trusted publishing can replace
it. Rust uses `CARGO_REGISTRY_TOKEN`. The npm workspace root remains private.

## Additional registries

Swift consumes the root SwiftPM package through the public Git URL and tag.
C++ consumes tagged source and the installed CMake package. Haskell consumes the
public Git release using Cabal's `source-repository-package`; see the
[installation instructions](wire/hs/README.md#install-from-git). Run
`node wire/hs/check-git.mjs` to verify the pinned release independently of the
local library. Hackage publication is deferred until uploader approval.
Additional registry
workflows select an existing stable immutable public release and build its exact
source. Account setup does not block the first Go/TypeScript handover.

| Workflow | Distribution | Actions configuration |
| --- | --- | --- |
| `publish-python.yml` | PyPI `bitspark-bitwire` | Environment `pypi`; trusted publishing preferred, optional `PYPI_API_TOKEN` |
| `publish-java.yml` | Maven Central `dev.bitspark:bitwire` | `MAVEN_CENTRAL_USERNAME`, `MAVEN_CENTRAL_PASSWORD`, `MAVEN_GPG_PRIVATE_KEY`, `MAVEN_GPG_PASSPHRASE` |
| `publish-haskell.yml` | Hackage `bitspark-bitwire` | Environment `hackage`; `HACKAGE_AUTH_TOKEN` |

Store credentials in repository Actions secrets for `Bitspark/bitwire`, never
source files. Maven credentials are the generated Central Portal token pair,
not a login password. Verify `dev.bitspark` through the `bitspark.dev` DNS
challenge and supply a signing key satisfying Central's signature requirements.

For a pending PyPI trusted publisher, use project `bitspark-bitwire`, owner
`Bitspark`, repository `bitwire`, workflow `publish-python.yml`, environment
`pypi`. This route needs no PyPI API token. The pending publisher does not reserve
the package name until publication. Binding READMEs describe package checks.

Hackage also requires the token's account to belong to its Uploaders group.
The first 0.1.0 upload was refused for that missing authorization; the server
directs the account owner to `hackage-trustees@haskell.org` for approval. See
[#11](https://github.com/Bitspark/bitwire/issues/11) before retrying. The operator
will request that approval later; Git consumption is the current delivery path.
Java 0.1.0 is published on Central with a verified public consumer; see
[#10](https://github.com/Bitspark/bitwire/issues/10). The Java workflow's optional
`diagnose` mode checks credential formatting, Maven substitution and a read-only
Portal status request without uploading artifacts or displaying credentials.

## Recovery

If publication partially succeeds, preserve the tag and existing artifacts.
Inspect registry state before retrying; npm compares existing integrity and Rust
verifies existing packaged content. Never replace a published version with changed
source. A failed consumer check after upload does not mean the upload failed.
Record existing artifacts and remaining work, and report a registry as available
only after its public installation check passes.

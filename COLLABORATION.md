# Collaborating on Bitwire

## The boundary

Bitwire owns the shared Wire contract, language presentations and independent
conformance criteria. A runtime implements it; a generator derives adapters to
it; a consumer supplies application meaning. The
[scope decision](docs/decisions/0001-shared-wire-contract.md) is the starting point.

A new primitive needs an observable requirement and an explanation of why
composition from the existing interface cannot satisfy it. Reuse alone does not
justify moving a runtime, type system or application policy into this repository.

## One meaning, eight language presentations

A shared contract change updates the specification, every delivered language
presentation and the applicable independent behavioral cases together. The target
languages are Go, TypeScript, Python, Rust, Swift, C++, Java and Haskell. Native
representations may differ while preserving the same observations. Track pending
implementation, validation, registry publication and consumer adoption separately
in the [language matrix](docs/languages.md). Do not label compilation as runtime
conformance or a draft as a released guarantee.

The packages have no runtime dependency on another Bitspark repository. Tests may
exercise a pinned external implementation without changing that package boundary.

## How a change lands

The initial scaffold bootstraps `main`. Subsequent work uses a dedicated branch
and, when working concurrently, its own Git worktree. Keep unrelated work separate.
Run `node scripts/check.mjs`, commit the complete change, open a pull request and
squash it after required checks pass. Resolve review findings before landing.
The main-branch rules are recorded in [.github/ruleset-main.json](.github/ruleset-main.json):
pull requests, both CI platforms, linear history, and protection from deletion
and force pushes. Apply the rules after the bootstrap push.

Commit and pull-request titles start with the area, such as `wire:`, `docs:` or
`ci:`, followed by a sentence describing the change. No attribution trailers are
needed. Record changes under Unreleased in [CHANGELOG.md](CHANGELOG.md).

Design choices are recorded in [docs/decisions](docs/decisions/README.md). When a
choice has already been made in the authorized task, record and implement it;
an additional approval ritual is not needed. Raise unresolved questions with
their alternatives and a recommendation.

## Public readiness

Use repository-relative links internally and public, pinned sources for external
provenance. No development or CI step may require a private sibling checkout or
organization secret. The repository is private initially; changing its visibility
and publishing packages are separate delivery steps from this scaffold.

# Checks and release

check.mjs checks links, independence, TypeScript declarations/build, the pinned
ontos mirror and vectors, envelope counterexamples, and Go format/vet/tests.
conformance.mjs runs independent fixtures, not a legacy RPC implementation.
smoke-packed.mjs checks the packed npm package and a file-proxy Go module outside
the checkout. release-prepare/publish/crates and smoke-registry retain immutable
release, exact-commit rehearsal and public-install requirements. publish-extra
supports the existing Python/Haskell delivery workflows. Native language checks
are in wire/<lang> and the bindings workflow.

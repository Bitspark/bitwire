# Release process

Use a reviewed green PR, squash to main, synchronize the primary checkout, and
hold all eight package versions to the candidate. Run release-prepare, core
checks, native packaged consumers and smoke-packed. Dispatch release.yml with
the candidate tag (for this release, v0.6.0) and provenance true on the exact main commit; this rehearsal never
publishes. Only after success create the annotated immutable vX.Y.Z tag and push
it. The tag workflow requires the successful exact-commit rehearsal, publishes
npm with provenance and the crate, verifies fresh public npm/Go installation,
and creates the GitHub release. Existing tags are never edited.

The configured publish-python and publish-java workflows publish their packages
from the immutable public release with installed-consumer checks. Haskell remains
public tagged source and sdist, with Hackage deferred by the existing uploader
policy. Swift/C++ are tagged source packages. Verify actual registry state and
native consumer evidence before claiming delivery. Raw messages use ontos-codec-v1; addressed messages use bitwire/addressed/1
and WebSocket negotiates bitwire.ontos.v2; no historical protocol is an active release gate.

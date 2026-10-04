# Release process

Use a reviewed green PR, squash to main, synchronize the primary checkout, and
hold all eight package versions to the candidate. Run release-prepare, core
checks, native packaged consumers and smoke-packed. Dispatch release.yml with
tag v0.4.0 and provenance true on the exact main commit; this rehearsal never
publishes. Only after success create the annotated immutable v0.4.0 tag and push
it. The tag workflow requires the successful exact-commit rehearsal, publishes
npm with provenance and the crate, verifies fresh public npm/Go installation,
and creates the GitHub release. Existing tags are never edited.

The configured publish-python and publish-java workflows publish their packages
from the immutable public release with installed-consumer checks. Haskell remains
public tagged source and sdist, with Hackage deferred by the existing uploader
policy. Swift/C++ are tagged source packages. Verify actual registry state and
native consumer evidence before claiming delivery. The current envelope format
is bitwire/envelope/1; no historical protocol is an active release gate.

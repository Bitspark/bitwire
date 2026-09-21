# Releases

There are no Bitwire releases yet. The repository starts private, and the
TypeScript package is deliberately marked `private: true`. CI builds and checks
the tree; it does not publish artifacts or change repository visibility.

## Before the first release

Establish the normative common contract and profile boundary, execute the agreed
behavioral cases against an implementation, and validate the packages from a
clean consumer checkout. Reconcile the ownership records with Nightseam and
record what integration has actually landed. See [integration](docs/integration.md).

Agree the initial compatibility promise before choosing a release version.
Versioned interface packages, specification and applicable conformance cases must
identify the same contract revision. A runtime's adoption version is a separate
fact and must be recorded explicitly.

Prepare package license/notice files, public metadata and release notes before
enabling package publication. A public repository does not by itself mean a
package has been published. Preserve the existing Nightseam profile identifier
unless a separately specified protocol change requires a new one.

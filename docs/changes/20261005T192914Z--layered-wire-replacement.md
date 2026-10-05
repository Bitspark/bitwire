# Layered wire replacement

Decision: [0015](../decisions/0015-addressless-wires-and-addressed-access.md).
Charter invariants W1-W6 restore the addressless/addressed/complete-tree split
without restoring RPC or compatibility support. The target was recorded before
runtime changes, with independent message byte fixtures and expected observations.

The 0.5.0 candidate updates all eight native presentations. Wire sends a ground
Value; Endpoint adds receive/close ownership; AddressedWire takes a separate path;
AddressedEndpoint shares the underlying lifecycle; WireTree has complete deixis
structure. Raw and addressed formats replace the mandatory generic envelope.
Service metadata moves to consumer protocols. The pinned ontos mirror is unchanged.

The local Go/TypeScript check passed at bbf6ef5: documentation links, dependency
independence, formatting, vet, native tests, TypeScript builds and all five
independent conformance groups. CI also passed the fresh npm/Go package consumers
and Java presentation at that revision; other jobs encountered GitHub hosted
runner-allocation failures before any step ran and require successful reruns.

The shared build executor was terminated after exhausting its 5 October daily
allowance; no job for this revision was submitted. Documented fallback retains
all native package and release checks. Merge requires the full current CI suite;
publication additionally requires the established exact-commit provenance
rehearsal and public registry verification. Development-only consumer checks with
a candidate tarball or temporary external Go replacement are not release evidence.

The agent reviewed the complete change against W1-W6 and decision 0015: all eight
presentations distinguish send, lifecycle, addressed access and complete structure;
message bytes and conformance are contract-owned; service fields and old decoders
are removed; the pinned ontos implementation remains unchanged. This self-review
is not independent architectural approval.

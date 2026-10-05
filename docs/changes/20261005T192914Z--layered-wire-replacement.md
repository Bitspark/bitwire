# Layered wire replacement

Decision: [0015](../decisions/0015-addressless-wires-and-addressed-access.md).
Charter invariants W1-W6 restore the addressless/addressed/complete-tree split
without restoring RPC or compatibility support. The target was recorded before
runtime changes, with independent message byte fixtures and expected observations.

The 0.5.0 candidate updates all eight native presentations. Wire sends a ground
Value; Endpoint adds receive/close ownership; AddressedWire takes a separate path;
AddressedEndpoint shares the underlying lifecycle; WireTree has complete Deixis
structure. Raw and addressed formats replace the mandatory generic envelope.
Service metadata moves to consumer protocols. The pinned Ontos mirror is unchanged.

Validation and release status: pending. No previous release's checks count for
this candidate. The shared build executor was terminated after exhausting its
5 October daily allowance; no job for this revision was submitted. Use the
service's documented fallback and retain all native package and release checks.

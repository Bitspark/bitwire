# Clean generic envelope replacement

Contract defined before implementation in commit
e490e7bfc7f2 (decision 0014, docs/wire/contract.md and carriers.md).
Owner explicitly adopted the replacement and prohibited compatibility baggage.
The shared cube boundary was independently committed as model
f0bfda81316664ba5a22cfb2d3f3e15b25c6b16f, system/WIRE-SHARED.md. That records
consumer adoption, not a production dependency of this contract package.

Expected observations are fixed in the contract: exact byte segments, no
ancestor/slash normalization, empty self versus empty-key child, opaque unknown
values, absence versus empty correlation, captured headers, local admission,
duplicate-ID delivery, single receive ownership, detached order, failure/limits
and released-resource termination. Canonical fixtures were calculated by an
independent Python encoder before runtime code. Pinned ontos source, hash reversal
and identity/codec/data vectors preserve the frozen value model.

Migration: remove all active historic RPC/JSON profiles, addressless/addressed
API splits, return-address objects, compatibility aliases and their active
conformance drivers. Replace all eight native presentations together, preserving
immutable old tags/history. Keep only necessary domain/carrier conversions;
bitruntime owns actual endpoints. No private checkout or registry dependency is
permitted. The measurable exit is current declarations, contract/package gates,
green native binding CI and freshly installed 0.4.0 artifacts; runtime adoption
is separately delivered and checked in bitruntime and system2.

Evidence so far: model definition/vector/link/gate checks passed; TypeScript/Go
contract/vector checks passed; Rust clippy, tests and an extracted crate consumer
passed. The Go package rehearsal caught an obsolete source filter that omitted the
new mirror even after staging. The file-proxy rehearsal now packages the complete
tracked module, matching the actual root-module distribution; its fresh consumer
checks both value and codec imports. The repeated isolated npm and Go consumers passed with the complete tracked module.
Python wheel/sdist and isolated typed consumer passed. C++ local CMake could not compile even its toolchain probe, so C++ validation is delegated to the required clean CI runner along with Swift/Java/Haskell. Those native package checks are pending. No old release's
conformance evidence is reused. Full integration review and actual release
verification are required before claiming completion.

Initial PR CI also passed Windows/Linux core, independent conformance, packages,
Rust, Python, Swift and Java. C++ exposed a consumer pin still asking for minor
0.3; Haskell exposed its consumer missing the direct bytestring dependency. Both
consumer manifests now match the current byte-path API. Required native CI must
pass on the updated commit before landing.

# 0004: Return origins and profile revisions make composition explicit

**Status:** accepted contract clarification, 2026-09-22. Native declarations are
unchanged. Executable evidence and outstanding acceptance are recorded in the
[current baseline](../../conformance/current/README.md).

## Questions

Can a return capability expose relative paths, and who assigns their meaning?
How can consumers agree on the profile when Nightseam 0.6.0 tightens request
serials without changing the string `nightseam.duplex/1`?

These are the two findings recorded in [PR26](https://github.com/Bitspark/bitwire/pull/26).
This decision supplies Bitwire's disposition; an upstream choice by itself did
not answer the shared-contract questions.

## A return capability has its own origin

The Wire held by a callable return capability is addressed access to an origin,
just like other Wire access. Its paths are relative to that origin, not to the
destination of the original request. The profile defines its accepted paths,
frame kinds, admission rules and lifetime. It may reserve part or all of that
origin's path space. This grants neither arbitrary application operations nor
another endpoint's receive or closure authority.

Nightseam 0.6.0 uses the empty path for the outcome and nonempty
`invocation.*` paths for lifecycle participation. These names belong to that
profile's invocation origin, not a global application namespace or the generic
Bitwire interface. Unknown lifecycle operations are refused by that profile.
Generic Wire does not imply lifecycle support: invocation-aware dispatch must
require supported participation and refuse unsupported use explicitly.

Pure routing preserves the original ReturnAddress identity and associated
context. Deriving a view for a participant to send through does not authorize
replacing the return address on the routed message. A carrier may establish a
new correlation scope and return capability, but then owns the mapping and
lifetime obligations. Local lifecycle verbs do not automatically cross physical
hops; a bridge implements its profile's mapping rather than serializing a local
capability object.

This interpretation follows the existing Wire-typed return field in all eight
bindings. Their documentation changes together; no native method, field or
profile-independent lifecycle API is added. The immutable 0.2.0 artifacts are
not rewritten.

## Compatibility is qualified by profile revision

**Superseded** by [decision 0008](0008-a-protocol-revision-has-its-own-identity.md)
on 2026-09-25: a protocol revision is a name, an immutable behavioral revision and
the hashes of its normative artifacts, never tightened in place. The section below
is unchanged history.

We accept Nightseam's
[recorded decision at v0.6.0](https://github.com/Bitspark/nightseam/blob/5cc9723a24646c40ed1861f892b2b23eb6d785d7/docs/decisions/request-serials-increase-in-publication-order.md)
as the explicit pre-1.0 compatibility disposition requested by ADR0003. It
versions the profile by release until 1.0 while retaining `nightseam.duplex/1`.
This accepts a named revision for integration; it does **not** establish
backward compatibility with every earlier sender using that profile string.

The new rule is observable: within one connection instance and direction,
published request serials strictly increase; gaps are allowed. Only requests
advance the receiver's mark. A non-increasing request ends the connection;
senders refuse before wrap; each carrier bridge owns its serial scope. This
prevents a newly arriving old control from identifying a newer invocation
without unbounded used-identifier history. Retaining an old invocation object
addresses the separate already-admitted-control race.

Our accepted executable baseline identifies Nightseam **v0.6.0 at
`5cc9723a24646c40ed1861f892b2b23eb6d785d7`**, Bitwire **v0.2.0**, and the
profile revision together. Historical references remain historical. Matching
the profile string, frame version, Wire methods or model digest alone is not
release negotiation. Deployment must establish the compatible profile revision
out of band; a mixed-release claim needs explicit evidence or a defined bridge.
The present packages do not add automatic negotiation. Future incompatible
profile changes require another explicit compatibility/version decision.

## What makes this composition rather than a signature match

Selecting or mounting access yields access that can be composed again.
Receiving views share an explicit receive owner. Under equivalent routing
policies, rearranging these views preserves paths, frames, return identity,
established context and borrowed ownership. An admitted invocation retains its
captured targets through detach/rebind; a timeout does not finish its body or
release a returned live value.

Cross-domain consumers additionally agree on declared operations and values,
contract identity, profile revision, reference scopes and authority. Bitwire
does not equate different domain meanings or grant permission from reachability.
Bitwire owns the access laws and independent expectations; Nightseam owns its
profile/runtime and generated-adapter acceptance; consumer repositories own
domain behavior and attachment rules.

## Evidence and remaining work

The [current conformance runner](../../scripts/conformance-current.mjs) executes
Bitwire's composition oracle against the released production drivers locally
and over WebSockets in both role directions. Separate Bitwire-authored lifecycle
inputs and expected observations exercise the public profile facility in Go and
TypeScript. Nightseam's two independent endpoint integrations, opaque wrapper,
race, serial and budget tests are supplementary upstream-owned evidence.

This settles the two contract findings, not every observation in
[#20](https://github.com/Bitspark/bitwire/issues/20). Full generated/live/context
acceptance, authority between lifecycle participants, shutdown while bodies
continue, and a real downstream attachment demonstration must be assessed at
their actual boundaries. The current baseline records these limits; neither a
green subset nor publication closes them by implication.

# 0008: A protocol revision has its own identity

**Status:** accepted, 2026-09-25, on the user's decision after bitsystem3's
carrier-stack research (its recommendations R15 and R16). Supersedes the
compatibility section of [decision 0004](0004-return-origins-and-profile-revisions.md#compatibility-is-qualified-by-profile-revision);
0004's return-origin section stands. Answers the versioning question that
[decision 0007](0007-using-bitwire-never-requires-nightseam.md) left open. It takes
effect when 0007's step 4 publishes the protocol.

## Question

Bitwire has identified the network profile by pointing at Nightseam commits.
Released Bitwire v0.2.0 cites Nightseam `1c63f1c`, which predates the rule that
request serials increase. The current baseline cites `5cc9723` (v0.6.0). Both
call the profile `nightseam.duplex/1`. Decision 0004 accepted this: the profile
was versioned by Nightseam release and tightened in place under an unchanged
name, so matching the name proved nothing.

Once Bitwire owns the protocol, what identifies a revision, and how do two peers
agree on one?

## Decision

**A revision is a name, an immutable behavioral revision, and the hashes of its
normative artifacts.**

- The identifier names the protocol and the revision: `bitwire/1`.
- The behavior is everything a peer sends, accepts and refuses, its close codes,
  its default bounds and its correlation rules.
- The normative artifacts fix that behavior: the specification text and its
  machine-readable tables. A manifest records the SHA-256 of each. Two parties
  implement the same revision when they name the same identifier and their
  artifacts have the same hashes.

**Revisions are immutable.** Any change to what a peer sends, accepts or refuses,
to close codes, or to default bounds is a new revision. A revision is never
tightened in place. Conformance scenarios are evidence, not normative artifacts.
Each names the revision it tests, and new scenarios may be added. A scenario
that contradicts its revision is a defect in the scenario.

**Releases are separate from revisions.** A Bitwire or runtime package release
states which revisions it implements. A release never changes a revision.

**Revision 1 is the accepted baseline.** `bitwire/1` is the behavior of Nightseam
v0.6.0 at `5cc9723a24646c40ed1861f892b2b23eb6d785d7`, the baseline decision 0004
accepted. `nightseam.duplex/1` at that release is another name for it. The move
in 0007's step 4 records the manifest. If Nightseam's text at the time of the
move differs from v0.6.0 in what it accepts or refuses, that difference is not
part of revision 1; it becomes a proposal for a later revision. Earlier releases
that used the name `nightseam.duplex/1`, including the one Bitwire v0.2.0 cites,
are not revision 1.

**Agreement.**
- **Revision 1:** peers agree out of band, as decision 0004 required. A handshake
  cannot be added to `bitwire/1`, because a v0.6.0 peer ends the connection with
  4011 on any frame it does not know.
- **From revision 2:** a bounded bootstrap exchange before normal traffic
  establishes the revision, roles, extensions and each direction's receive
  limit. Revision 2 must also define how it coexists with revision-1 peers.
  bitsystem3 reports a frame-limit mismatch between two components (1 MiB
  against 4 MiB) that directional limits in such an exchange would have exposed
  at connection time.

## Why

- **A commit is not an identity for behavior.** It identifies a repository
  snapshot that may contain unrelated changes, and two commits can carry the
  same wire behavior. Bitwire v0.2.0 shows the failure: it cites a commit whose
  behavior the current baseline no longer matches.
- **Tightening in place made the name meaningless.** Decision 0004 had to say
  that `nightseam.duplex/1` did not establish compatibility with earlier senders
  using the same string.
- **An immutable revision gives a second implementation something fixed to
  conform to.** Under decision 0007, Bitwire's carriers and Nightseam's must
  interoperate byte for byte; they need a target that does not move.
- **Hashes make "the same revision" checkable** rather than a claim.

## Consequences

- Decision 0004's compatibility section is superseded. Its return-origin section,
  including the `invocation.*` paths on a return capability's origin, stands.
- 0007's step 4 publishes revision 1 with its manifest. Bitwire's packages state
  the revisions they implement.
- Nightseam's release-based versioning of the profile
  ([request serials increase in publication order](https://github.com/Bitspark/nightseam/blob/5cc9723a24646c40ed1861f892b2b23eb6d785d7/docs/decisions/request-serials-increase-in-publication-order.md))
  stops governing the protocol once it moves. Each Nightseam release then states
  which Bitwire revisions it implements.
- Revision 2's bootstrap exchange is designed after 0007's step 5, together with
  its coexistence rule.

## Not decided here

- The manifest's format and location, and exactly which tables are normative.
- Revision 2's bootstrap exchange and its coexistence rule.
- Whether scenario sets carry versions of their own.

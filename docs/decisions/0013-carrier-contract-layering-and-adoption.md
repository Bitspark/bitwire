# 0013: The carrier contract is a separate, versioned claim above a protocol revision

**Status:** accepted, 2026-09-27, on the maintainer's decisions on
[#54](https://github.com/Bitspark/bitwire/issues/54) after
[research 0004](../../research-docs/0004-carrier-guarantees.md), an outside
consultation. It clarifies [decision 0008](0008-a-protocol-revision-has-its-own-identity.md)
and sets the order in which the [carrier contract](../wire/carriers.md) is
adopted. It changes no protocol revision.

## Context

Decision 0008 makes a protocol revision immutable: "Any change to what a peer
sends, accepts or refuses, to close codes, or to default bounds is a new
revision. A revision is never tightened in place."

The carrier contract (decision 0007) states what every carrier preserves.
Some of what it should require is visible on the network but already permitted
by `bitwire/1`. A queued-work drain before a close is one example; abort, rather
than 4011, for an operational failure is another. Requiring such behavior of
every `bitwire/1` peer would tighten the revision. Leaving it unstated leaves
carriers free to differ where their users need them not to.

## Decision

**Layering.** A separately identified and versioned carrier contract may add
local API guarantees. It may also constrain the implementations that claim it to
behaviors that a named protocol revision already permits. It does not change
that revision's standalone conformance requirements, defaults or normative test
suite. A requirement that needs a behavior the revision forbids, or that changes
what the revision itself requires, remains a protocol revision change under
decision 0008.

A conformance claim therefore names what it covers: "`bitwire/1`", or
"`bitwire/1` and carrier contract, edition N". A peer that conforms to
`bitwire/1` alone is not made nonconforming by a carrier contract.

A rule is classified by its observable effect, not by where its code lives. A
change described as in-process can still change what crosses the network. Moving
a quota check, adding a refusal, or reordering a shutdown are examples.

**Adoption order.** The carrier contract is adopted in the consultation's
sequence:
1. **Now:**
   - the local definitions of D4: close-code validity, capability and
     permission; invalid close requests; the closed classification and its
     termination record;
   - the complete `bitwire-stream/1` format (D5), with portable framing vectors.

   Nothing waits on a protocol revision here.
2. **Next:** the documented deviations of current implementations are fixed.
3. **Then:** D1 to D3 are adopted as a named additional claim. They are
   publication evidence, stable message ownership, and the queued-work drain
   with its barriers and one close deadline.

**Under `bitwire/1`,** a carrier that claims the contract:
- keeps 4011 for protocol violations and 1009 for an over-limit frame, as the
  revision binds;
- aborts when its write path has failed, and prefers an abort for other
  operational failures, such as overload or a stalled consumer.

A peer that claims `bitwire/1` alone keeps every choice the revision leaves
open. A dedicated operational-failure code waits for a later protocol revision,
or for another explicitly versioned claim like this one.
- The revision-1 tunnel keeps sending `channel.close` 1006 on abort under a
  normative compatibility exception: a carrier claiming the contract states that
  exception rather than claiming the unqualified rule. Revision 2 gives a channel
  abort a form of its own.

## Consequences

- `docs/wire/carriers.md` becomes normative for D4's local definitions and for
  `bitwire-stream/1`. D1 to D3 stay marked as the next adoption step.
- Edition 1 of the carrier contract is this adopted part. D1 to D3 will make a
  later edition.
- `bitwire-stream/1` is frozen on publication as an immutable bundle, as
  `bitwire/1` was. Until then, what implementing it exposes can still be
  corrected in place.
- bitruntime implements `bitwire-stream/1` against the specification and its
  vectors ([bitruntime#10](https://github.com/Bitspark/bitruntime/issues/10)).
- Conformance keeps separate suites: the envelope codec, the carrier and API
  boundary, stream framing, and each transport binding. A constrained adapter,
  such as one over the browser WebSocket API, declares the capabilities it lacks
  instead of weakening everyone's tests.
- Decision 0008 is unchanged in force. This decision only states which claims a
  carrier contract may add beside a revision.

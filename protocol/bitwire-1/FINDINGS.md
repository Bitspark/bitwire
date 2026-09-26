# bitwire/1 findings

**This register is informative. It is not part of revision 1's identity and
adds no obligation.** It records defects, ambiguities and divergences found in
the adopted text or in implementations of it, so that a later revision can
resolve them. A finding never changes what a revision-1 peer must do. Where a
finding touches conformance, the scope ([`SCOPE.md`](SCOPE.md)) already fixed
the reading before publication.

Each finding records:
- the revision it concerns (`bitwire/1` with the normative digest in
  [`manifest.json`](manifest.json));
- the affected location;
- what conflicts or is missing, and the evidence;
- the roles and transports affected, when not all of them;
- whether it changes revision-1 conformance expectations (by default, no);
- its status: `recorded`, `verified`, `rejected` or `held for revision 2`;
- a proposed resolution in a later revision.

## Text

| ID | Location | Finding | Changes rev. 1 conformance | Status | Proposed resolution |
| --- | --- | --- | --- | --- | --- |
| F1 | `vocabulary.md`, "How a change to the wire is made" | The upstream process says the page "is rewritten with the model, not kept stable against it". That contradicts an immutable revision. | No. `SCOPE.md` excludes the section. | verified | None needed. Decision 0008 governs revisions. |
| F2 | `tunnel.md`, "Limits and closes"; Nightseam v0.6.0 `tunnel/go/tunnel.go:638` | On abort, the upstream text says "the other side sees 1006". The v0.6.0 Go tunnel *transmits* `channel.close` with code 1006. Decision 0007 says a carrier never transmits 1006, which may only be observed. The TypeScript tunnel has no channel abort, and both accept any code in `channel.close`. | No. `SCOPE.md` keeps the v0.6.0 behavior. | held for revision 2 | The carrier contract ([#54](https://github.com/Bitspark/bitwire/issues/54)) splits sendable from observe-only codes. A later revision signals abort without transmitting 1006, and says what a receiver reports. |
| F3 | `profile.md`, "Relative paths on a Wire" | The canonical path encoding and the nonempty peer-root path have no table row and no archived scenario. The tables use plain method names only. | No. `SCOPE.md` fixes where the encoding applies. | recorded | Add evidence for encoding, canonical decoding and plain names in the bitwire conformance suite. Consider a table in a later revision. |
| F4 | `profile.md`, "Declaration identity at interpretation" | A whole section specifies another layer's exchange. | No. It is excluded. | verified | Bitlink specifies the identity exchange; bittype specifies canonical declaration identity. |
| F5 | `profile.md`, "The subprotocol" | A wire rule and an authentication hint (a browser ticket) are mixed in one section. | No. Scoped. | verified | An authentication layer specifies its own carriage. |
| F6 | `profile.md`, several sections | Runtime remarks (observer events, `Wire.Send`, option names, a browser's means of pacing) are mixed into the protocol text. | No. Scoped. | verified | A later revision states wire behavior only. |
| F7 | `vocabulary.md`, reserved prefixes | The prefix list mixes namespace facts with a code generator's refusal and a declaration-language mechanism. | No. The names stay reserved; the generator rule is informative. | verified | A later revision keeps a registry of reserved prefixes separate from tooling. |
| F8 | `tunnel.md`, `channel.open` | The `digest` member's admission is the tunnel's, but its meaning is declaration identity. | No. `SCOPE.md` splits carriage and admission from identity. | verified | bittype specifies what a digest identifies and how it is computed. |
| F9 | `conformance/scenario.schema.json`, runner code | The expectation-matching language (`$any`, `$bind:`, `$regex:`, `$sequence_by`, and more) is documented only in the upstream runner's code. The schema has no member that names a revision. | No. These are tooling, not protocol. | recorded | The bitwire conformance contract documents the language and names the protocol identity ([#53](https://github.com/Bitspark/bitwire/issues/53) follow-up). |
| F11 | `profile.md`, "The envelope" and "Relative paths on a Wire" | That a request's `method` and an event's `event` are nonempty is stated only as the nonempty peer-root path. Nightseam v0.6.0 refuses an empty name with 4011 in both languages. | No. `SCOPE.md` states the rule. | verified | A later revision states it in the envelope rules. |
| F12 | `tunnel.md`, "The operations"; upstream `docs/runtime/tunnel.md` | The default window of 32 appears only in examples and in a runtime document. | No. `SCOPE.md` states the default. | verified | A later revision lists the tunnel's defaults with its bounds. |
| F13 | `profile.md`, "Ids and correlation" | That a well-formed response naming no outstanding request is ignored is pinned only by table rows. | No. `SCOPE.md` states the rule. | verified | A later revision states it in the prose. |
| F10 | `conformance/tables/frames.json` | The table's description embeds harness procedure, and several `why` fields explain rules by citing Nightseam issue numbers. | No. `SCOPE.md` interprets the tables. | verified | None for revision 1. |

## Implementations

bitruntime's port of v0.6.0 surfaced these. None changes a frame. They are
recorded so that evidence observes the right point rather than weakening
assertions.

| ID | Behavior | Roles and transports | Changes rev. 1 conformance | Status | Note |
| --- | --- | --- | --- | --- | --- |
| I1 | A call through a peer's root that the peer's own end cut off was answered `cancelled` (Nightseam v0.6.0) where `disconnected` describes it. | Caller side, any transport | No. It is a local outcome. | recorded | bitruntime answers `disconnected`. |
| I2 | Cancelling a WebSocket peer's reader before closing let the peer's chosen close code arrive as 1006. | Both roles, WebSocket | No. The chosen code is what the protocol requires. This was an implementation defect. | recorded | Fixed in bitruntime. |
| I3 | The sender of an over-limit frame can observe 1006 instead of the receiver's 1009 over TCP WebSocket, because the close frame can be lost to the socket teardown. | Sender, WebSocket | No. The receiver's 1009 is the requirement; the sender's observation depends on the transport. | recorded | The carrier contract (#54) states what a sender may observe. |

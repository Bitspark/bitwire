# Exporting a Wire

**Status:** proposed, 7 October 2026, for review by Wire & Runtime
(`codex-communications`, the communication-contract reviewer). The protocol is
[exporting a Wire](../wire/export.md); its independent cases are
[export-vectors.json](../../conformance/export-vectors.json). No runtime code,
API or package version follows from this record alone. Number 0017 was the
withdrawn tree-routing proposal (#79), which never landed.

## Motivation and provenance

bitnode's first routed echo ([platform kickoff 02-3](https://github.com/Bitspark/platform/blob/5cfa6cea3172c132db6938930a1701b0511cb71b/planning/kickoffs/02-3-bitnode-first-route.md))
needs a reply. The first plan reused a private request/reply convention with
return addresses. The owner asked why, when a Wire can be sent over the wire for
the reply. Wire & Runtime decided on 7 October that the first routed reply uses an
exported send-only Wire, and that the 02-3 holder authors this record under its
review ([bitruntime#38](https://github.com/Bitspark/bitruntime/issues/38)). It
also accepted the construction sketch, with two corrections that this record
applies:
- a scope binding, so that no foreign or old reference can alias a live export;
- dependent-lifetime accounting for re-exports.

[Decision 0016](0016-communication-composition.md) already selected export as a
facility, and its [composition section](../wire/composition.md#exporting-an-existing-wire)
set the first scope: live, connection-scoped exports and explicit re-export.
Decision 0015's research obligations apply: crossing hops carries tokens, not
local objects (R3.2), and a forwarded request's reply path is not valid at another
hop (R3.4).

## Derivation

| Need | Existing concept used |
| --- | --- |
| Convey sending authority | A send-only `Wire` (W1, W4). Import yields one; nothing else is conveyed. |
| Address an export on a connection | The addressed facade (W2): routes under a declared root. |
| Build the importer's proxy | Released `Under` and `Bind`. |
| Refuse stale use | The export table's own state: ids are never reused within a scope. |
| Refuse foreign or old references | The connection's lifetime, as a scope token in the reference. |
| Cross several hops | Re-export of an import, the composition section's "re-export through another hop". |
| Keep a borrowed target intact | W4's rule that release never closes a borrowed target, applied to imports with several dependents. |

## Decision

1. **The reference** is the ground value `("bitwire/ref/1", scope, id)`. Only an
   opted-in binding interprets it.
2. **Exports are addressed routes** under an export root that each composition
   declares: `["send", scope, id]` and `["release", scope, id]`. The connection's
   dispatcher stays the single receive owner.
3. **Import** is `Bind(Under(sender, peerRoot), ["send", scope, id])` plus a
   release send. It grants send only.
4. **Scope.** Each side's table has a random 16-octet scope for its connection's
   lifetime, and ids are never reused within it. A foreign scope is refused
   `foreign-reference`, an unknown or released id `unknown-reference`, and any
   other route shape `malformed-route`. All refusals are observed by the
   exporting side only.
5. **Re-export** records its source import. It retires when the source connection
   ends and never follows a replacement. An import is released upstream once,
   when its last dependent is released.
6. **Independent cases first.** The encode bytes are hand-derived and checked
   against the released codec, and the delivery cases and observations precede
   any implementation.

## Alternatives

- **Return addresses and a request/reply envelope** (system2's private
  `service/2`). Rejected by Wire & Runtime: it compares a grammar with a grammar,
  not with the selected export concept, and nothing published depends on it.
- **A globally valid bearer reference** (a tree path plus an unguessable id).
  Rejected for the first scope: it needs no per-hop state, but anyone holding the
  bytes can send, and the composition section asks first for connection-scoped
  exports.
- **Ids alone as connection-scoped references.** Rejected in review: two tables
  can issue the same id, so copied bytes could alias a live export. The scope
  token closes that.
- **Releasing the import whenever one re-export is released.** Rejected in review:
  the same import may serve another branch or a local holder.
- **Use-once or reply-once exports.** Rejected as a protocol rule: a Wire is a
  general send capability. Replying once is a consumer's lifetime choice.
- **A duplex channel per export.** Not needed: an addressed route per export
  suffices, as the composition section allows.
- **Finding references by scanning payloads.** Rejected: payloads stay opaque. A
  composition declares where references travel.

## Consequences

- **bitruntime** realizes the export table, import, release and re-export
  accounting in Go and TypeScript, against the vectors and observations, with
  cross-language and multi-process evidence ([bitruntime#38](https://github.com/Bitspark/bitruntime/issues/38)).
  Go may land first, but the delivery is complete only with both languages. Names
  and signatures are bitruntime's to choose.
- **bitnode** declares, in its own profile, the export root on its routing links
  and where a routed message carries references. Its routers re-export declared
  references. Its first echo replies through an imported Wire.
- **Codec helpers.** Helpers for the reference value in bitwire's presentations
  are a separate change for this repository's reviewer.

## Consultation

The kickoff asks for a consultation before fixing new protocol. On 7 October 2026
the owner said: "no consultations for now, they are not available currently"
([quoted in bitspark-accounts](https://github.com/Bitspark/bitspark-accounts/blob/862ed7fddaa9f2badc535f7feb7ff834060c6cc7/docs/decisions/2026-10-07-generic-confirmation.md)).
So this record is decided without that advice, reviewed by Wire & Runtime
instead, with each alternative and its reason recorded. A later answer is
evaluated against what was built, and any change is a new decision.

## Charter invariants

- **W1** is unchanged: references and export messages are ordinary values.
- **W2** is reused: export routes are addressed paths, and import is `Under` and
  `Bind`.
- **W3** is respected: nothing enumerates or discovers exports.
- **W4** is applied: import grants send only, release never closes a target, and
  the dispatcher is the single receive owner.
- **W5** is applied per side: a send through an import is local admission only.
- **W6** is applied: the cases precede implementation.

## Evidence and limits

The encode vectors were derived by hand and match the released bitwire 0.5.0
encoder.

**An experiment.** A local experiment (unpublished, author-reported) shows a reply
crossing two re-export boundaries, release propagating back, retirement with the
source link, and bounds. It predates this record's scope token and dependent
accounting, which the realization must add.

No realization exists, and no required observation has been run.

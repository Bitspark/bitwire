# bitwire/1: scope of revision 1

This document is **normative**. It is part of revision 1's identity. It
identifies the revision, selects which requirements of the adopted upstream
text bind, supplies the few definitions that text leaves elsewhere, and
interprets the adopted tables. Nothing outside the files listed under
[Identity](#identity) redefines `bitwire/1`. That includes this directory's
`README.md`, its `FINDINGS.md`, the conformance scenarios, rendered pages and
later guidance.

## Identity

**Identifier:** `bitwire/1`.

**Adopted source.** Revision 1 is the network behavior published in
Nightseam **v0.6.0**:
- repository `https://github.com/Bitspark/nightseam`;
- tag `v0.6.0`;
- commit `5cc9723a24646c40ed1861f892b2b23eb6d785d7`.

The upstream files are copied byte for byte under `source/`, at their original
paths. Bitwire decisions 0007, 0008 and 0010 govern the adoption.

**Former name.** `bitwire/1` is `nightseam.duplex/1` *as published in Nightseam
v0.6.0 at that commit*. Earlier releases that used the name
`nightseam.duplex/1` are not revision 1. The name travels on no connection: an
envelope carries only `"version": 1`.

**Normative artifacts:**

| Path in this bundle | Origin |
| --- | --- |
| `SCOPE.md` | bitwire |
| `source/docs/wire/profile.md` | upstream |
| `source/docs/wire/vocabulary.md` | upstream |
| `source/docs/wire/tunnel.md` | upstream |
| `source/conformance/tables/frames.json` | upstream |
| `source/conformance/tables/serials.json` | upstream |
| `source/conformance/tables/unicode.json` | upstream |

Each file is hashed whole. Hash coverage identifies the exact artifact; this
document says which of its requirements bind.

**Digest procedure:**

```text
fileHash(p)     = lowercase hexadecimal SHA-256 of the exact bytes of p
entry(p)        = fileHash(p) + "  " + p + "\n"      (two ASCII spaces, one LF)
normativeDigest = lowercase hexadecimal SHA-256 of the entries of the
                  normative artifacts, concatenated in ascending byte order of p
```

Paths:
- are relative to this bundle directory, `protocol/bitwire-1/`;
- use `/`;
- contain only ASCII letters, digits, `.`, `_`, `-` and `/`;
- are compared byte for byte, case-sensitively;
- contain no empty, `.` or `..` segment.

No file is normalized before hashing. The manifest (`manifest.json`) records
every file with its hash, but its own bytes are not part of the digest.

**The revision's identity is the pair (`bitwire/1`, `normativeDigest`).** Two
parties implement the same revision when they name the same identifier and the
same digest.

Outside the digest, though listed in the manifest with their hashes:
- the upstream `LICENSE` and `NOTICE`;
- the linked rationale records;
- the runner files;
- the archived scenarios;
- this bundle's `README.md` and `FINDINGS.md`.

## Authority

1. **Scope.** Where this document selects, excludes, interprets or supplies a
   requirement, it governs.
2. **Everything else in the normative artifacts binds as written.** The
   selected prose and the tables are one baseline. **No blanket precedence
   applies:** neither prose over tables, nor tables over prose, nor any
   implementation's behavior over either. A sentence that describes "the
   runtime" or "the peer" doing something binds when that something is
   observable on the connection. Two examples: the runtime answering
   `method_not_found` on a handler's behalf, and a peer closing with 4011.
3. **Informative text is exactly the text this document marks informative or
   excluded.** It carries no obligation. It may explain a requirement but does
   not add one.
4. **Revision 1 is immutable.** A change to what a peer sends, accepts or
   refuses, to close codes or to default bounds is a new revision. A defect in
   revision 1 is recorded as a finding (see `FINDINGS.md`). A finding changes
   no revision-1 obligation.

## Conformance scopes

A claim of conformance names the identity pair and one of two scopes:

- **`bitwire/1`, core.** The protocol between two peers, over one frames
  connection: `profile.md` as scoped below, the layering and namespace rules
  of `vocabulary.md`, and all three tables.
- **`bitwire/1`, core and tunnel.** The core, plus the channel vocabulary of
  `tunnel.md`.

These are conformance scopes of one revision, not separate network
identifiers. A core claim does not establish tunnel support. A claim also
names:
- the roles it covers (client, server or both);
- the transports it covers;
- the configuration, when it departs from the default bounds.

## profile.md

Every section binds, with the exceptions and readings below. An *informative*
passage is explanation. An *excluded* passage belongs to another layer or to
one runtime's API.

### Opening paragraph

Informative.

### The connection beneath

Binds.
- A frame larger than the receiver's limit is refused before delivery. The
  receiver ends the connection with **1009** ("too large" in the close codes
  this section lists).
- What the sending side observes when that close is lost to the transport's
  teardown is the transport's (finding I3).

Informative:
- "every transport of a language is held to the seam's own suite";
- the sentence citing the shared binary-frame scenario, which is evidence.

### The subprotocol

The first paragraph binds. A peer offers nothing *by default*, selects nothing
*by default*, refuses nothing on that ground, and reads nothing into what was
selected.

The second and third paragraphs are informative. Naming a subprotocol is a
consumer's or deployment's configuration outside those defaults. They also
cover a gateway's inspection, a browser's ticket, and how a runtime exposes the
choice. Carrying authentication is excluded; it belongs to an authentication
layer.

### The envelope

Binds.
- **A request's `method` and an event's `event` are nonempty strings.** An
  empty one makes the frame malformed, and the connection ends with 4011, as
  for any malformed frame. Nightseam v0.6.0's peers enforce this in both
  languages. The upstream text states it only as the nonempty peer-root path,
  and this document states it here.
- "the generated validators read them" and "is refused by the validators"
  describe generated code and are informative. What binds is that the profile
  itself does not refuse such a payload value.

### Relative paths on a Wire

- The first two paragraphs bind, as clarified under [Paths](#paths).
- The third paragraph is informative. It covers local return capabilities,
  views, mounts, verified context and the consumer surface, which the bitwire
  contract governs locally.

### Ids and correlation

Binds.

A well-formed response names a request the receiver itself sent, so its `id`
carries the receiver's own role prefix. If it names no request the receiver
has outstanding, it is ignored, and the connection stays open, just as with a
cancel for an id that is not open. The `frames.json` rows "response" and
"response with error" pin this, and so does the `serials.json` row whose
`before` is a response. A response carrying the sender's own prefix is
malformed (the row "response to nobody").

### Serials increase in publication order

Binds, except one informative sentence: "The gate is what orders publication,
so it is also what `request.started` is told under, and no frame a request
draws can be observed ahead of the request itself; the one thing a Go observer
must not do from that callback is publish a request of its own on the peer it
is observing." It concerns the observer.

The order in which a request and the frames it draws are published binds
through the queue-order rule under [Limits and
backpressure](#limits-and-backpressure).

### Requests

Binds, with these readings:
- **`busy` binds in both of its clauses.**
  - A receiver at its limit of requests being handled answers `busy` on the
    wire.
  - A caller at its limit of outstanding calls refuses the next call without
    sending a frame. The caller-side clause binds for what it does to the
    network: that call sends nothing.
- **The caller's deadline binds:** 30 seconds by default. When it passes, the
  request is failed locally and a `cancel` is sent.
  - `request_timeout` is the caller's own error, "never a frame it received".
    Its name is local.
  - The receiver's handler deadline binds, and so does its `cancelled` answer.
- Informative: "An observer is told the outcome `timeout`", and "the family's
  declared errors are these, by name, in the generated packages".

### Events

Binds. An event whose name nothing handles is dropped.

### Limits and backpressure

**The default bounds bind:**
- 128 outgoing frames;
- 128 events waiting for their handlers;
- 128 calls outstanding;
- 64 requests being handled;
- frames of at most 1 MiB;
- a 30-second call deadline;
- a 10-second write deadline;
- a 30-second dial handshake.

These also bind:
- pacing for one write deadline, and disconnecting a consumer that has not
  drained;
- a full queue ending its carrier;
- reserved admission for cancellation;
- the queue order of accepted data and control frames;
- the busy and caller-limit distinction.

**Inbound pacing binds in one of two forms.** A peer that can pause its
transport stops reading: while the event queue is full, responses and
cancellations on that connection wait with the events. A peer that cannot pause
its transport holds the events instead. Both are within revision 1. The write
deadline, and what happens when it passes, bind in both.

Informative:
- "Each bound is one option under one name in both languages … the peer tables
  them";
- the sentence on structured `Wire.Send`, a local API;
- in the busy paragraph, "so no observer is told of one".

### Trace context

Binds, including the bullet list: a handler runs with an incoming trace; a
request or event sent from a context carries a child; one sent from no context
begins a trace; a response and a cancel carry their request's members.

Informative: the paragraph that begins "The default propagator mints". It
covers identifier generation, tracing-library adapters and imports.

### Request metadata

Binds, including:
- that a handler's own calls carry none of what arrived unless the handler says
  so;
- that a reserved key given to a sender is not sent.

Informative:
- the observer clause "an observer is told a frame's name, id, size and trace
  and never a `meta` key or value";
- the closing sentence naming the peer's operations.

"A relay forwards the member verbatim, as it forwards a member it does not
know" concerns an intermediary that carries a frame without being its receiving
peer. The peer that receives a frame applies the envelope's rule that an
unknown member makes it malformed.

### Declaration identity at interpretation

**Excluded.** The `identity.` exchange and its preparation lifecycle belong to
Bitlink. The canonical declaration identity the digest is computed over belongs
to bittype (decision 0010). The `identity.` prefix remains reserved (see
[vocabulary.md](#vocabularymd)). A revision-1 peer without that layer answers
an `identity.check` request as it answers any request without a handler.

### What the profile does not do

Binds.

### A frame, on the wire

An informative example.

### Observing it

Excluded. It covers the observer, one runtime's instrumentation.

## Paths

The canonical path encoding is how *addressed* traffic, sent at a path through
a Wire, is carried in the `method` of a request or the `event` of an event:
- each segment is written as its UTF-8 byte length in decimal, a colon and the
  segment;
- `[]` encodes as `""`.

A name is **canonical** when it decodes completely under that rule, and every
one of these holds:
- each length consists of decimal digits with no leading zero, except a single
  `0`;
- the length does not exceed the remaining bytes;
- every segment is valid UTF-8 of Unicode scalar values.

Because a `method` or `event` is never empty (see [The
envelope](#the-envelope)), the empty path cannot be sent at a peer root.

**The envelope does not require the canonical form.** Any nonempty `method` or
`event` string the envelope admits is valid, and the tables' plain names such
as `read` are valid envelopes. A receiver's addressed surface interprets only
canonical names as paths. Any other name is dispatched by that name. A request
that nothing handles is answered `method_not_found`, and an event that nothing
handles is dropped. Revision 1 does not reject plain names.

## vocabulary.md

- **Opening paragraph and "The test":** informative. They are design reasoning
  for evolving the protocol. Revision 1's envelope is exactly the one in
  `profile.md`.
- **A layer's own vocabulary:** binds, as follows.
  - The path-encoding paragraph binds, as clarified under [Paths](#paths).
  - **Reserved prefixes are namespace facts:** `channel.` (the tunnel),
    `live.`, `identity.` and `auth.`. A revision-1 peer does not assign these
    names to unrelated operations. Excluding a layer's function does not free
    its names. No receiver-side rejection follows from a code generator's rule.
    The sentences about the generator and `cmd/nightseam/testdata/reserved` are
    informative.
  - "Ordinary frames of the profile" binds.
  - "Imported, implicitly" is informative. It covers the declaration language
    and built-in families.
  - "Never across the layer's boundary" binds.
  - The closing paragraph on the invocation's vocabulary is informative. Those
    operations never cross a connection, and the bitwire contract governs them
    locally (decision 0004).
- **How a change to the wire is made:** **excluded.** It is Nightseam's
  process. Revision 1 is immutable under decision 0008.

## tunnel.md

This section binds for the **core and tunnel** scope.

### Opening paragraphs

- **The first** binds that:
  - a tunnel multiplexes channels over one peer;
  - either side opens a channel, saying the family it speaks;
  - a channel carries a raw frame connection;
  - the outer peer sees only the four operations.

  Informative: the consumer surfaces `Channel`, `Connection` and `Wire`, and the
  handle representation `{"channel": 12}` inside a family's own messages, which
  is a matter for a family's binding.
- **The second** binds: an inner path is encoded as on a socket, and no path or
  local return capability is added to `channel.open` or `channel.frame`.

### The operations

Bind.

**The `digest` member of `channel.open` binds as carriage and admission:**
- its shape: when present, exactly 64 lowercase hexadecimal characters;
  otherwise `channel_invalid`;
- its presence rules;
- the comparison with a locally known digest for the same family, made before
  admitting the channel or interpreting an inner frame;
- `contract_mismatch` for two differing nonempty digests;
- no refusal when either side has none.

What a digest identifies, and how it is computed, is canonical declaration
identity, which belongs to bittype (decision 0010). A digest is not
authentication, and it is not this revision's `normativeDigest`.

### Ids

Bind.

### Credit

Binds.

**Default window.** Unless a peer is configured otherwise, the `window` it
declares in `channel.open` and in the open's result is **32** frames. Nightseam
v0.6.0 uses 32 in both languages. The upstream text shows it in its examples,
and this document states it as the default.

Informative: "how each runtime makes a sender wait is its own".

### Limits and closes

Bind:
- the 1 MiB inner-frame limit, refused with 1009;
- 1002 for a frame beyond the window or of neither kind;
- 1001 when the outer connection closes;
- the hold one window deep;
- the accept capacity of 64.

On **abort**, revision 1 keeps v0.6.0's network behavior:
- An aborting side sends `channel.close` with code **1006** and an empty
  reason, and ends the channel at once.
- A receiver treats a `channel.close` carrying 1006 as an abnormal end of the
  channel.

Under decision 0008 revision 1 is v0.6.0's behavior. Decision 0007's rule that
a carrier never transmits 1006 therefore applies from the carrier contract
(#54) and later revisions, as recorded in finding F2.

### Observing it

Excluded. It covers the observer.

## Tables

Each table is a **finite set of normative constraints**. None is an exhaustive
definition of valid traffic. In every table:
- a row's `name` and `why`, and a table's `description`, are informative;
- an issue number is never the explanation of a requirement;
- new examples are added as evidence, never to these files.

### frames.json

Each row gives the receiving role (`to`: `server`, or `either` for a frame
that is valid or invalid at both roles) and an exact raw frame. The raw text is
sent as is, never parsed and re-serialized first.
- `valid: true` means the receiver admits the frame and the connection stays
  open. That does not mean its method exists or that a request succeeds.
- `valid: false` means the receiver refuses the frame and ends the connection
  with 4011.

### serials.json

Each row gives a receiving role, a frame `before`, and a `frame` sent after it
on the same connection and direction. `valid` says whether the receiver admits
the second request and keeps the connection open. `false` means it ends the
connection with 4011. This is sequence admission, not envelope validity: every
frame in the table is well formed on its own.

### unicode.json

Each row gives `raw` JSON text and whether the string domain of the envelope
admits it. The text is a JSON value or fragment, not necessarily a whole
envelope. A test embeds it in an otherwise valid envelope without normalizing
it. `valid` concerns the admitted string domain only.

## Links in the adopted documents

A link in a normative document is a pointer. It does not bring in the linked
document's content. Every relative link is disposed here:

| Link target (upstream path) | Disposition |
| --- | --- |
| `docs/wire/profile.md`, `docs/wire/vocabulary.md`, `docs/wire/tunnel.md` | Resolved locally: normative, under `source/` |
| `conformance/DRIVER.md` | Resolved locally: runner (conformance contract material), not a protocol requirement |
| `conformance/scenarios/peer/binary-frame-ends-the-connection.json` | Resolved locally: archived evidence |
| `docs/decisions/a-deadline-is-not-a-cancel.md`, `busy-is-a-refusal-not-a-failure.md`, `close-codes-are-the-websocket-registrys.md`, `credit-is-per-channel.md`, `envelope-members-are-what-the-peer-acts-on.md`, `meta-is-a-header-not-a-member.md`, `no-subprotocol-by-default.md`, `queues-are-paced-for-one-deadline.md`, `request-serials-increase-in-publication-order.md`, `strings-are-unicode-scalars.md` | Resolved locally: informative rationale |
| `docs/runtime/peer.md`, `docs/runtime/wire.md`, `docs/runtime/observer.md` | Not included; informative. They describe one runtime's API, option names and observer. The default bounds are stated in `profile.md`. |
| `docs/runtime/tunnel.md` | Not included; informative. Its one default this revision needs, the window of 32, is stated under [tunnel.md](#tunnelmd). |
| `docs/declaration/builtins/identity/README.md`, `docs/declaration/declaration-identity.md`, `docs/declaration/families.md` | Not included; excluded (declaration language and identity, owned by bittype and Bitlink) |
| `docs/auth/connection.md` | Not included; excluded (authentication layer) |
| `docs/admission.md`, `docs/decisions/a-tier-is-a-built-in-family.md`, `docs/decisions/an-invocation-is-a-wire-and-routing-is-composed-above-it.md`, `COLLABORATION.md` | Not included; informative (Nightseam's method, declaration language and local invocation vocabulary) |
| `https://github.com/Bitspark/nightseam/issues/339` | External; informative history of the excluded identity exchange |

No other linked document supplies a requirement that revision 1 needs.

## Evidence and conformance tooling

**Scenarios and the runner protocol are evidence and tooling, not protocol
requirements.** Three things are identified independently:

- **The protocol:** (`bitwire/1`, `normativeDigest`).
- **The conformance contract:** how a runner drives a testee and interprets
  scenarios. It is released separately with its own edition and hashes. The
  upstream `DRIVER.md` ("driver 1") and scenario schema are archived under
  `source/conformance/` as provenance. A testee keeps answering
  `hello.driver = 1` while the exchange stays compatible. The upstream
  statements that the runner and scenarios "remain Nightseam's", and that Go's
  testee is the reference, confer no authority over this revision.
- **Evidence sets:** scenarios with their content hashes, each naming the
  protocol identity it tests.

The upstream scenarios are archived unmodified under `source/conformance/`.
They cannot name a revision themselves, because the upstream schema does not
allow it. Of them:
- the `seam` and `peer` sets exercise the core;
- the `tunnel` set exercises the tunnel, including `tunnel/declaration-digest`.
  That scenario uses a locally configured digest map and exercises the tunnel's
  admission.
- the scenarios that need the observer exercise one runtime's instrumentation
  and support no core claim;
- `peer/declaration-identity.json` (the identity layer) and
  `peer/recorded-wire-head-and-order.json` (a test-only recorder) are out of
  scope.

A conformance report records:
- the identity pair and the scope;
- the roles, transports and configuration;
- the implementation's build;
- the runner and conformance-contract identities;
- the evidence set's identity;
- each case's result, including skips, unsupported cases and harness failures.

Passing a finite suite supports a claim. It does not prove that every
requirement was exercised.

## Provenance

**Artifact equality is checkable by anyone.** Each upstream-origin file under
`source/` is byte-identical to the file at the same path in the adopted commit.
`node scripts/protocol.mjs verify --source` re-fetches the public source and
compares it.

**Behavioral equivalence of the scoped publication is a reviewed claim, not a
proven one.** It rests on:
- this scope;
- the equality of the adopted bytes;
- the evidence available at publication: bitruntime's recorded transcripts
  equal Nightseam v0.6.0's, and it interoperates with Nightseam v0.6.0 peers in
  both roles.

The definitions this document supplies were checked against Nightseam v0.6.0's
Go and TypeScript sources: nonempty names, unsolicited responses, the 1009
over-limit close, the default window, canonical path decoding and the tunnel
abort. Matching hashes do not show that a scoping choice preserved every
behavior. Matching transcripts cover only the executions they record.

## Traceability

| Requirement area | Adopted text | Tables | Archived evidence |
| --- | --- | --- | --- |
| Connection, close codes, binary, malformed and over-limit refusal | `profile.md`, The connection beneath | `frames.json` | `seam/*`, `peer/binary-frame-ends-the-connection`, `peer/malformed-frame-ends-the-connection`, `peer/close-is-clean-when-chosen` |
| Subprotocol | `profile.md`, The subprotocol (first paragraph) | — | `peer/subprotocol-negotiated-at-the-handshake` |
| Envelope, nonempty names and string domain | `profile.md`, The envelope; [The envelope](#the-envelope) | `frames.json`, `unicode.json` | `peer/well-formed-frame-is-served`, `peer/malformed-frame-ends-the-connection` |
| Paths | `profile.md`, Relative paths on a Wire; [Paths](#paths) | — | none yet (finding F3) |
| Ids, serials, correlation, unsolicited responses | `profile.md`, Ids and correlation | `frames.json`, `serials.json` | `peer/request-serials-*`, `peer/call-and-reverse-call` |
| Requests, errors, cancel, deadlines | `profile.md`, Requests | `frames.json` | `peer/public-error`, `peer/cancellation-reaches-the-handler`, `peer/request-timeout`, `peer/outstanding-call-limit` |
| Events | `profile.md`, Events | `frames.json` | `peer/events-both-ways` |
| Bounds and backpressure | `profile.md`, Limits and backpressure | — | `seam/over-limit-refused`, `seam/send-past-the-bound-waits`, `peer/outstanding-call-limit`; observer-based pacing scenarios are diagnostics |
| Trace context | `profile.md`, Trace context | `frames.json` | `peer/trace-members-verbatim`; `peer/trace-propagation` needs the observer |
| Request metadata | `profile.md`, Request metadata | `frames.json` | `peer/meta-travels-with-a-call-and-an-event` |
| Layering and reserved names | `vocabulary.md`, A layer's own vocabulary | — | none |
| Tunnel, including digest admission and the default window | `tunnel.md`; [tunnel.md](#tunnelmd) | — | `tunnel/*` except `observer-sees-the-channels` |

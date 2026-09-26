# Research: Publishing an immutable protocol revision from another project's release

**ID:** 0003
**Date:** 26 September 2026
**Status:** evaluated
**Run-ID:** run_23f4568a-b763-403e-813e-3f71a76c47c3
**Document-ID:** doc_5d2c3b30-5276-4722-acb5-6eea3de6079d
**Reviewed:** https://github.com/Bitspark/bitwire/pull/58
**Author:** Julian Matschinske <julian@matschinske.com>
**Issue:** [bitwire#53](https://github.com/Bitspark/bitwire/issues/53)

## Question

We must publish revision 1 of a network protocol, `bitwire/1`, as an
immutable, hash-identified specification that implementations are tested
against. By prior decision, revision 1 *is* the on-the-wire behavior of one
specific, already released version of a different project, Nightseam v0.6.0.
We must preserve that behavior exactly: the frames sent, accepted and refused,
with the same meaning. The released documents that describe the behavior also
describe other layers that do not belong in the protocol, and remarks about
one runtime. They link to about twenty documents that will not travel with
them. In one place they say the text is "rewritten with the model, not kept
stable".

**How should revision 1's normative artifact set be drawn, identified and
published, and what belongs to the protocol's identity rather than to its
conformance evidence?** Normative artifacts define the revision; evidence only
tests it.

**What we need back:** a concrete recommendation we can implement now with the
tooling described below. It should cover:
- which structure the publication takes;
- exactly what the hash identity covers;
- where the tunnel vocabulary sits;
- where the line between specification, runner contract and scenarios falls;
- how known defects of the source text are carried.

The first two block publication; the rest can be staged. We lean toward
byte-identical copies with a separate scoping document (option A below), but we
hold that loosely.

**Scale and timing:**
- Two implementations target revision 1 today: Go and TypeScript, both in one
  runtime project, bitruntime.
- No outside implementer exists yet. The repositories are public so that one
  can.
- Revision 2 has no date. It follows a separate design of how received context
  is delivered, so it is months away, not weeks.
- Revision 1 must be citable exactly for as long as revision-1 peers exist.

## Terms

- **Wire.** bitwire's in-process messaging interface: send a request, event or
  cancel along a *path* (an array of strings), and receive them. "Wire
  behavior" in this document means only what crosses a network connection.
- **Profile.** Nightseam's word for its protocol, which it named
  `nightseam.duplex/1`.
- **Envelope.** One JSON object per network frame, with members `version`
  (always 1), `kind` and these per-kind members:
  - `request`: `id`, `method`, `params`;
  - `response`: `id` and exactly one of `result` or `error`, where an error is
    `{code, message, data?}`;
  - `event`: `event`, `data`;
  - `cancel`: `id`.

  Any kind may also carry W3C trace fields (`traceparent`, `tracestate`), and
  requests and events a flat string map, `meta`. Any other member makes the
  frame malformed.
- **Roles, ids, serials.** The side that dialed holds the *client* role, the
  other the *server* role. Either may send requests. A request id is `c:N` or
  `s:N` by the sender's role, and `N` is its *serial*, which must strictly
  increase per connection and direction.
- **Correlation.** Matching a response or cancel to its request by `id`.
- **Bounds.** Queue depths, the maximum frame size and deadlines.
- **Close codes.** The connection closes with a numeric code and a reason. The
  numbers are the WebSocket registry's on every transport, for example 1000
  normal, 1009 too large, 1006 abnormal. The protocol closes with **4011**
  when the other side broke it.
- **Layer, vocabulary, reserved prefix.** An optional feature set built on the
  protocol. Its operations are ordinary requests and events whose names start
  with the layer's own prefix. That set of names is its *vocabulary*. Examples:
  - the tunnel (`channel.`), which multiplexes *channels* over one connection
    with credit-based flow control;
  - live references (`live.`), remote handles to objects kept alive across the
    connection;
  - authentication (`auth.`);
  - declaration identity (`identity.`).
- **Declaration, declaration identity.** A *declaration* is an interface
  definition that code is generated from. Its *identity* is a SHA-256 over its
  canonical form, so two sides can check that they implement the same
  interface.
- **Observer.** A runtime callback reporting internal events such as "handler
  returned" or "backpressure applied". It is not visible on the connection.
- **Runner, testee, scenario, table.**
  - A *runner* is a test program that drives two *testees*.
  - A testee is a small program each implementation provides: a peer under
    remote control.
  - A *scenario* is a JSON script of runner commands with expected answers.
  - A *table* is a JSON list of inputs with expected verdicts, such as raw
    frames marked valid or invalid.
- **Numbering, which is easy to confuse:**
  - *v0.6.0* is Nightseam's release.
  - *`bitwire/1`* is the protocol revision.
  - *`version: 1`* is the envelope member, shared by both names.
  - *driver 1* is the runner protocol's version.
  - *bitwire 0.3.0* is a package release of the interface declarations.

## Context

### Who is who

- **Nightseam** was the original runtime. It shipped the protocol and
  implementations in several languages. Release **v0.6.0** is git commit
  `5cc9723a24646c40ed1861f892b2b23eb6d785d7`, licensed Apache-2.0. Nightseam
  is **discontinued** and will not release again.
- **bitwire** is a contract repository. It publishes interface declarations and
  *independent conformance cases*: expected observations written from the
  specification, never recorded from an implementation. Its cases so far cover
  the in-process interfaces, not the network protocol.
- **bitwire ships no production implementation.** It does ship test-only
  conformance tooling (runners, drivers, fixtures), and it may add more. No
  published bitwire package may depend on Nightseam or on bitruntime.
- **bitruntime** is the new Go and TypeScript implementation. It speaks the
  v0.6.0 protocol byte for byte: its recorded transcripts equal Nightseam
  v0.6.0's, and it interoperates with Nightseam v0.6.0 peers in both roles.
- **Bitlink** is a separate Bitspark project, not yet public. It owns the
  mapping from interfaces to the protocol: operation names, generated adapters
  and the declaration-identity check.

### Decisions already taken (binding)

**Decision 0007** moved the protocol from Nightseam to bitwire:

> Bitwire owns the specification that Nightseam publishes as
> `nightseam.duplex/1`, including the rule by which a layer adds its own
> vocabulary under a reserved prefix. Its first Bitwire revision is that
> profile unchanged: the same frames accepted and refused, the same close
> codes and the same bounds. […] The name never travels on a connection. An
> envelope carries only `version` `1`, and no WebSocket subprotocol is offered
> by default. […] Bitwire calls the revision `bitwire/1` and records
> `nightseam.duplex/1` as another name for it. Names inside it, such as the
> reserved `nightseam.` metadata prefix, change only in a later revision.

It also requires carriers never to *transmit* close code 1006, which may only
be observed. And the conformance runner protocol, tables and scenarios move
from Nightseam to bitwire as part of this work.

**Decision 0008** defined protocol identity:

> Bitwire has identified the network profile by pointing at Nightseam commits.
> […] Both call the profile `nightseam.duplex/1`. […] the profile was versioned
> by Nightseam release and tightened in place under an unchanged name, so
> matching the name proved nothing.
>
> **A revision is a name, an immutable behavioral revision, and the hashes of
> its normative artifacts.**
>
> - The identifier names the protocol and the revision: `bitwire/1`.
> - The behavior is everything a peer sends, accepts and refuses, its close
>   codes, its default bounds and its correlation rules.
> - The normative artifacts fix that behavior: the specification text and its
>   machine-readable tables. A manifest records the SHA-256 of each. Two
>   parties implement the same revision when they name the same identifier and
>   their artifacts have the same hashes.
>
> **Revisions are immutable.** Any change to what a peer sends, accepts or
> refuses, to close codes, or to default bounds is a new revision. A revision
> is never tightened in place. Conformance scenarios are evidence, not
> normative artifacts. Each names the revision it tests, and new scenarios may
> be added. A scenario that contradicts its revision is a defect in the
> scenario.
>
> **Revision 1 is the accepted baseline.** `bitwire/1` is the behavior of
> Nightseam v0.6.0 at `5cc9723…`. […] Earlier releases that used the name
> `nightseam.duplex/1`, including the one Bitwire v0.2.0 cites, are not
> revision 1.

**Decision 0010** assigned layered vocabularies:

> the wire-only ones (the envelope, tunnels) are specified with the protocol in
> Bitwire; the identity exchange belongs to Bitlink; the declarations a
> generator reads are derived from these specifications, or checked against
> them.

### Fixed, not up for debate

- **Revision 1 is v0.6.0's wire behavior**, including its default bounds and
  close codes. Nothing from after v0.6.0 enters it. Defects are recorded as
  findings, not repaired in place.
- **Revisions are immutable** and identified by name plus normative hashes.
- **No new mechanism in revision 1:** no handshake, no negotiation, no identity
  exchange. Peers agree on revision 1 out of band, because a v0.6.0 peer closes
  the connection on any frame it does not know.
- **The reserved metadata prefix stays spelled `nightseam.`** in revision 1.
- **The tunnel is specified in bitwire; identity belongs to Bitlink.**
- **An implementer outside Bitspark must be able to implement revision 1 from
  bitwire's publication alone,** without reading Nightseam.
- **Apache-2.0 on both sides.** Redistributed files carry the upstream NOTICE.

### Open

- Decision 0008 left three things open:
  - the manifest's format and location;
  - exactly which tables are normative;
  - whether scenario sets carry versions of their own.
- **The classification below is ours and is itself open.**
- Whether the tunnel shares `bitwire/1`'s identity or has its own.
- Where the runner contract sits, and who owns a runner.

### The released artifacts, classified

**Classes:**
- **a** is the core protocol.
- **b** is a layered vocabulary riding on it.
- **c** is out of scope: live, identity, authentication, code generation, or
  runtime APIs.
- **d(x)** is conformance evidence about class x.
- **mixed** means the file also contains text of other classes.

All files are LF-only UTF-8.

| File | Class | What it is |
| --- | --- | --- |
| `docs/wire/profile.md` (21 346 bytes) | a, mixed | The protocol: connection and close codes, subprotocol, envelope, path encoding, ids and serials, requests and error codes, events, limits and default bounds, trace fields, `meta` |
| `docs/wire/vocabulary.md` | a, mixed | The test for what belongs in the envelope, and the reserved-prefix rule for layers |
| `docs/wire/tunnel.md` | b, mixed | The tunnel's four operations under `channel.`: ids, credit, limits, close codes |
| `conformance/tables/frames.json` | a | 88 raw envelopes, each valid or invalid, with the role it is addressed to |
| `conformance/tables/serials.json` | a | 4 request-id orderings and whether the receiver admits them |
| `conformance/tables/unicode.json` | a | 20 strings and whether the envelope admits them. Only runtime unit tests use it. |
| `conformance/DRIVER.md` (51 271 bytes) | runner | The runner-to-testee protocol, "driver 1" |
| `conformance/scenario.schema.json` | runner | JSON Schema of a scenario |
| `conformance/profiles.json` | runner, c | Which scenario sets make up which promise, per language |
| `conformance/scenarios/seam/*` (5) | d(a) | The underlying connection: ordering, close, limits |
| `conformance/scenarios/peer/*` (27) | d(a); 2 are c | Two peers talking |
| `conformance/scenarios/tunnel/*` (7) | d(b); 1 is c | The tunnel |
| 10 decision records linked from the three documents | informative | Rationale for close codes, serials, strings, `meta`, subprotocol, deadlines, `busy`, pacing |
| `LICENSE`, `NOTICE` | notice | Apache-2.0. Section 4(d) requires the NOTICE to travel. |

Upstream's own statement of what an implementer needs opens `profile.md`:

> This page is the wire — what a peer of any language sends, accepts and
> refuses — and names no runtime […] A runtime for another language needs this
> page, the tunnel, how a layer speaks and the driver protocol, and nothing
> else.

A table row, and how tables carry runner semantics. From `frames.json`:

```json
{"name":"request with a reserved meta key","to":"server",
 "frame":"{\"version\":1,\"kind\":\"request\",\"id\":\"c:1\",\"method\":\"read\",\"params\":{},\"meta\":{\"nightseam.deadline\":\"2026-01-01T00:00:00Z\"}}",
 "valid":false,"why":"keys under nightseam. are the profile's and this version defines none"}
```

Its description says:

> A refused frame ends the connection; the harness sends each row over a raw
> connection to a peer of the named role and holds that the peer ended, or did
> not.

Several `why` fields cite Nightseam issue numbers.

### Where the documents mix in material that is not the protocol

**`profile.md`:**

- **"Declaration identity at interpretation"** is a whole section on the
  `identity.check` exchange that decision 0010 gives to Bitlink:

  > An adapter checks the declaration it will interpret through an ordinary
  > `identity.check` request, its first request before exposing the generated
  > model. […] Optional `digest` is exactly 64 lowercase hexadecimal SHA-256
  > characters. […] Different paths, or different specified digests for the
  > same path, are `contract_mismatch` […]

  Its second-to-last paragraph describes a runtime's preparation lifecycle. The
  last cites a Nightseam issue.
- **"The subprotocol"** mixes a wire rule with an authentication hint. The rule:
  offer none and select none by default. The hint: a browser client may use
  the subprotocol to carry an authentication ticket.
- **Runtime remarks.** The document contains several statements about a runtime
  rather than the wire:
  - which callback may not publish a request;
  - the observer's outcome names, and a closing section, "Observing it", listing
    the observer's ten events;
  - that the in-process `Wire.Send` refuses immediately;
  - that a browser peer "holds the events instead of the reading";
  - a paragraph on local return capabilities that are never serialized.
- **Two rows of the error table never appear on the wire:** `busy` "locally
  and without a frame", and `request_timeout`, the caller's own deadline.
- **The default bounds are in the text:**

  > 128 outgoing frames, 128 events waiting for their handlers, 128 calls
  > outstanding at once, 64 requests being handled at once, frames of at most
  > 1 MiB; a call's own deadline is 30 seconds, a full queue's write deadline
  > 10, and a dial's handshake 30.

  By decision 0008 these numbers are part of the behavior, and so normative.
  The runtime *option names* for them, in another document, are not.
- **Path encoding** is defined for traffic from the in-process Wire. A path such
  as `["work","read"]` is encoded into the `method` string as `4:work4:read`,
  and a peer-root request needs a nonempty path. The document's own example and
  all 22 `method` values in `frames.json` are plain names such as `work.start`
  or `read`. No table row tests the path encoding.
- **Links:** 24 links to 19 distinct documents, 8 of them decision records,
  plus a Nightseam issue. Four targets are in the copy set above.

**`vocabulary.md`:**

- It lists the prefixes of layers outside the protocol: `live.`, `identity.`
  and `auth.`.
- It describes Nightseam's code generator refusing consumer operations under
  those prefixes, and a declaration-language mechanism (`duplex.Envelope`,
  built-in families).
- It describes a local `invocation.*` vocabulary that never crosses a
  connection.
- Its last section is Nightseam's change process: "Directly and whole, in one
  lane […] this page is rewritten with the model, not kept stable against it."

**`tunnel.md`:** the tunnel's open request is

```json
{"channel": 12, "family": "chat", "digest": "68025e…9cb0", "window": 32}
```

> `digest`, when present, is the declaration digest, exactly 64 lowercase
> SHA-256 hex characters; an empty string, null or another shape is
> `channel_invalid`. A known local digest for the same family is compared
> before admitting the channel […] Two nonempty digests that differ are refused
> `contract_mismatch`, naming the family. An absent digest on either side is
> not refused by this rule; it makes no revision claim. The digest is generated
> declaration identity, not authentication or a compatibility policy.

So the digest's *syntax* check is wire behavior, and its *meaning* is identity.
The page also fixes bounds and close codes:
- a 1 MiB inner-frame limit, refused with 1009;
- 1002 for a frame beyond the credit window;
- 1001 when the outer connection closes;
- an accept capacity of 64;
- on abort, "the other side sees 1006", beside decision 0007's rule that 1006
  is never transmitted.

### The conformance runner and its evidence

The runner is Nightseam's Go program. It speaks JSON lines to each testee over
stdin and stdout, one command at a time:

```
→ {"id": 7, "op": "peer.dial", "url": "ws://127.0.0.1:41263", "observe": true}
← {"id": 7, "ok": {"handle": "p2"}}
```

- A testee first answers `hello` with its `driver` version, language, layers
  and features. "This is driver 1."
- `DRIVER.md` says "Go's testee is the reference: every scenario passes with Go
  on both sides before it is asked of anyone else", and "this driver protocol
  and the profile scenarios remain Nightseam's".
- Its `peer` command family includes `peer.identity` and `peer.check_identity`,
  which belong to the identity layer. Its later sections define commands for
  the live and generated-code layers.

A scenario header, and how scenarios consume tables:

```json
{"name": "…", "layer": "peer", "needs": ["peer"],
 "foreach": {"table": "tables/frames.json", "as": "row", "where": {"valid": false}},
 "steps": [ … ]}
```

The schema (`urn:nightseam:conformance:scenario:1`):
- allows only `name`, `layer`, `replaces`, `description`, `needs`, `mirror`,
  `foreach` and `steps`;
- has no member naming a revision. A byte-identical scenario therefore cannot
  "name the revision it tests", as decision 0008 asks.

Expected answers use a matching language:
- The schema documents one form, `$<as>.<member>`, which refers into a table
  row.
- All the rest appears only in a code comment in the Go runner: `$any`,
  `$string` and other type matchers, `$absent`, `$bind:`, `$not:`, `$regex:`,
  `$contains`, `$sequence_by`.
- The semantics of `repeat` and `foreach` are split across three places.

Upstream's `profiles.json` already sorts scenarios into promises:

```json
"core": {"layers": ["seam", "peer"], "promise": "wire"},
"tunnel": {"layers": ["tunnel"], "promise": "complete"},
"observability": {"needs": ["observer", "propagator"], "promise": "complete"}
```

Its runner rule is that "a profile by feature takes precedence over one by
layer". So the ten peer scenarios that assert through `peer.observed` (the
observer) fall outside the core promise. Two peer scenarios test out-of-scope
layers: `identity.check`, and a test-only frame recorder.

bitwire has no runner for these scenarios yet. bitruntime runs copies of the
v0.6.0 tables and scenarios that it keeps with their provenance.

### Known differences already found

bitruntime's port found implementation defects that change no frame:
- a call cut off by the peer's end was answered `cancelled` instead of
  `disconnected`;
- cancelling a reader before closing let the chosen close code arrive as 1006;
- over WebSocket, the sender of an over-limit frame can observe 1006 rather
  than 1009.

The text itself has the inconsistencies above: the change-process section, the
1006 wording, and untested path encoding.

### Prepared tooling

One script is ready. It:
- fetches the public source at the pinned commit and checks that the v0.6.0 tag
  still names it;
- copies the listed files byte for byte under `protocol/bitwire-1/source/`, at
  their original relative paths;
- writes a manifest listing, per file, its *category* (normative, informative,
  evidence, runner, notice), size and SHA-256, plus one `normativeDigest`: the
  SHA-256 of the sorted `sha256  path` lines of the normative files;
- verifies offline, and against a fresh upstream fetch in CI.

The copying and verification are settled. **Which files count as normative,
and what the digest covers, are drafts.** Question 1 asks about exactly that.
Today's draft marks the three documents and three tables normative, which gives
a digest of `973503e7…6375a549`.

### What we have considered

**Structure of the normative set:**
- **A. Byte-identical copies plus a scoping document.** The copies are
  normative. A bitwire-written scope document says which sections bind and
  which are informative, and resolves each dangling link.
  - *For:* bytes are provably preserved, and provenance is mechanical.
  - *Against:* the normative reading depends on two texts. Is the scope
    document inside the hash?
- **B. A bitwire-written restatement, with the copies as provenance.**
  - *For:* clean and self-contained.
  - *Against:* a restatement can drift in meaning, and revision 1's whole
    promise is that nothing changed.
- **C. Copies and scope document both normative, both hashed.**
  - *For:* precise.
  - *Against:* the identity then depends on text that exists nowhere upstream.

**The tunnel:**
- *Inside `bitwire/1`'s identity.* Simple, but a tunnel change forces a
  protocol revision.
- *A separate identifier such as `bitwire-tunnel/1`.* Independent evolution,
  but two identities to agree on out of band.
- *The reserved-prefix rule in `bitwire/1`, each layer identified separately.*
  This mirrors upstream's `profiles.json`.

**The runner:**
- *Copy `DRIVER.md` as-is and document the matching language in a bitwire
  note.* Cheap, but the note becomes a de facto second specification.
- *Write a new bitwire runner contract.* Clean, but new text to get right.
- *Publish scenarios only as evidence, and let each implementation's runner
  interpret them.* Least work, but it gives weak guarantees to an outside
  implementer.

## Questions for the Expert

1. **Drawing and identifying the normative set.** When a protocol's first
   standalone revision is, by decision, "exactly the behavior of release X",
   and X's documents mix that protocol with other layers and implementation
   remarks, how have comparable efforts drawn the normative set? Byte-identical
   copies with a scoping statement, a restatement with the copies as
   provenance, or another structure?
   - What should the hash identity cover (paths, any scoping text, license and
     NOTICE) so that "same identifier, same hashes" stays both true and useful?
   - How should the former name and pinned commit be recorded so that a later
     reader can prove equivalence without trusting us?
2. **Layered vocabularies under one wire revision.** The core protocol lets a
   layer add operations under a reserved name prefix. The tunnel does this
   under `channel.`, and its open request carries a member whose syntax is wire
   behavior but whose meaning is another project's. How do comparable protocol
   families decide which layered vocabularies share the core's revision
   identity and which are identified and versioned separately? Examples might
   be WebSocket subprotocols and extensions, HTTP/2 extension frames, or
   JSON-RPC-based ecosystems such as the Language Server Protocol. How would
   you treat such a member?
3. **Evidence, runner contract and an outside implementer.** Where do
   comparable conformance suites, such as the Web Platform Tests or Autobahn
   for WebSocket, draw the line between specification, runner contract and test
   cases? Picture an implementer outside Bitspark who has only our publication.
   - What would they need from us to show that they implement `bitwire/1`?
   - How should scenario sets and the runner contract be versioned relative to
     the protocol revision they test?
4. **Carrying known defects in an immutable baseline.** Revision 1 must
   preserve v0.6.0 even where its text contradicts immutability, leaves
   behavior defined only in code, or reads inconsistently. How do established
   specifications publish known defects next to a frozen text (RFC errata,
   W3C errata, ISO or Ecma corrigenda), so that implementers know what binds?
   What should a finding record, so that revision 2 can resolve it cleanly?
5. **What are we not seeing?** From efforts that turned a de facto protocol,
   specified by one implementation's documentation, into an independently
   owned specification: what are the typical failure modes, and what would you
   do first, before anything becomes immutable?

## Applied

**Evaluated against:** `0003-publishing-an-immutable-protocol-revision.submitted.md` (sha256 `8444feca…3db92e`), attempt 1, run `run_23f4568a-b763-403e-813e-3f71a76c47c3`; advice sha256 `aac1d7b8…4709998`, verified by `nightfall consult verify --output` (exit 0). Code at `ed6d1ed` (bitwire) and `5cc9723` (nightseam v0.6.0).
**Graded:** by the owner. This repository has no architecture seat; decisions 0007, 0008 and 0010 bound every row.

Two facts were checked in the released source before ruling:
- **Tunnel abort.** Go's `Connection.Abort` (`tunnel/go/tunnel.go:638`) *transmits* `channel.close` with code 1006. The TypeScript tunnel has no channel abort, and both implementations accept any code in `channel.close`.
- **Path boundary.** The structured Wire surface decodes a `method` only in canonical form (`runtime/go/wire.go:335`, `DecodePath`). A plain name is a valid envelope that reaches name-registered handlers or is answered `method_not_found`.

| # | Recommendation | Verdict | Action | Owner | Link | Validation |
|---|---|---|---|---|---|---|
| 1 | Option C: byte-identical copies plus a normative, hashed `SCOPE.md`. Seven normative files. | HOLDS | Write `protocol/bitwire-1/SCOPE.md` and mark it normative. The six upstream files stay normative. | bitwire-12 | #58 | `protocol.test.mjs`: the digest covers `SCOPE.md`; changing it changes the identity |
| 2 | Hash whole files, and scope portions by path, heading and sentence. | HOLDS | `SCOPE.md` states exclusions by file, heading and quoted sentence. | bitwire-12 | #58 | review of `SCOPE.md` against the source |
| 3 | Do not exclude the `busy` row or the deadline; exclude only the local caller refusal and the local name. | HOLDS (corrects the brief) | The receiver's `busy` stays normative. The caller-local refusal is informative. The deadline and its cancel stay normative, and `request_timeout` is a local name. | bitwire-12 | #58 | `SCOPE.md`, Requests |
| 4 | Keep reserved-prefix assignments as namespace facts; add no receiver-side rejection from generator rules. | HOLDS | `SCOPE.md`, Vocabulary. | bitwire-12 | #58 | review |
| 5 | Adopt the three tables as finite normative constraints, with interpretations in `SCOPE.md`. `why` and names are informative. New examples go to evidence. | HOLDS | `SCOPE.md`, Tables. | bitwire-12 | #58 | review |
| 6 | Give every outgoing link a disposition. No blanket precedence rule. | HOLDS | A link table in `SCOPE.md`. | bitwire-12 | #58 | `protocol.test.mjs` checks that every relative link in the three documents has a disposition |
| 7 | Digest over exact bytes, with paths relative to `protocol/bitwire-1/` including `source/`, restricted ASCII, entries of the form hash, two spaces, path, LF, ordered by path. Identity is (`bitwire/1`, digest), recorded in the hashed scope. The manifest is not in its own digest. | NEEDS ADAPTATION | The script used paths relative to `source/`. Change them to bundle-relative, validate the repertoire, and reject symlinks. The procedure is stated in `SCOPE.md`. | bitwire-12 | #58 | `protocol.test.mjs`: a known-answer test for the digest procedure, and path rejection |
| 8 | License, NOTICE, rationale, runner and scenarios are hashed in the manifest but outside the digest. | HOLDS | Already so. The test asserts it. | bitwire-12 | #58 | `protocol.test.mjs` |
| 9 | Distinguish upstream-origin files from bitwire-authored files; only upstream files are fetched and compared. | HOLDS | Manifest field `origin`: upstream or bitwire. | bitwire-12 | #58 | `protocol.mjs verify --source` |
| 10 | Record the full commit and the qualified former name, and keep provenance independent of upstream hosting. | NEEDS ADAPTATION | The commit, tag, paths and qualified alias go in `SCOPE.md`. The durable source archive is deferred (row 20). | bitwire-12 | #58 | review |
| 11 | State the difference between artifact equality and behavioral equivalence. | HOLDS | `SCOPE.md`, Provenance. | bitwire-12 | #58 | review |
| 12 | The tunnel is inside the `bitwire/1` identity, with conformance scopes "core" and "core and tunnel". | HOLDS | `SCOPE.md`, Conformance scopes. | bitwire-12 | #58 | review |
| 13 | The tunnel `digest`: bitwire specifies carriage and admission (shape, presence, comparison, timing, errors); Bitlink specifies what a digest identifies and how it is computed. | HOLDS (corrects the brief's "syntax only") | `SCOPE.md`, Tunnel. | bitwire-12 | #58 | review |
| 14 | 1006: distinguish action from observation, and inspect v0.6.0 abort. | HOLDS | Inspected: Go transmits `channel.close` 1006. Under decision 0008 revision 1 keeps this. Decision 0007's carrier rule applies to the carrier contract (#54) and later revisions, recorded as finding F2 (no change to revision-1 conformance). | bitwire-12 | #58, #54 | `SCOPE.md`, Tunnel; `FINDINGS.md` F2 |
| 15 | Path encoding: find exactly where it is required, and do not newly reject plain names. | HOLDS | Inspected: canonical encoding is the mapping of addressed traffic, and plain names are valid envelopes. Stated in `SCOPE.md`, Paths. | bitwire-12 | #58 | review; evidence gap recorded as F3 |
| 16 | Findings register: non-normative, outside the digest, with its fields; "changes conformance expectations: no" by default. | HOLDS | `protocol/bitwire-1/FINDINGS.md`. | bitwire-12 | #58 | review |
| 17 | Exclude the change-process sentence in the frozen scope. | HOLDS | `SCOPE.md`, Exclusions. | bitwire-12 | #58 | review |
| 18 | Local outcomes stay outside the identity when there is no network change. Examine observation points rather than weakening assertions. | HOLDS | `FINDINGS.md` I1–I3. | bitwire-12 | #58 | review |
| 19 | Permanent entry page naming the authoritative artifacts; no mutable reinterpretation. | HOLDS | `protocol/bitwire-1/README.md` as a non-normative entry page. `SCOPE.md` states that nothing outside the bundle redefines it. | bitwire-12 | #58 | review |
| 20 | Distribution integrity: an archive checksum or signature, plus a source archive or git bundle. | DEFERRED | Trigger: a bitwire release that carries `protocol/bitwire-1` exists (`gh release view` lists it). Attach the bundle archive, its checksum and a source bundle of `5cc9723` as release assets. | bitwire-12 | #53 | the release asset checksums |
| 21 | A bitwire-owned conformance contract (driver-1 subset, consolidated matcher semantics) and a test-only runner. | DEFERRED | Staged, as the advice allows. Trigger: the protocol bundle is merged (`protocol/bitwire-1/SCOPE.md` exists on main). Tracked in a new issue. | bitwire-12 | new issue | the runner's matcher examples, red and green |
| 22 | Scenario derivatives under a bitwire schema naming protocol and digest, with explicit, versioned selection; observer scenarios optional. | DEFERRED | Same trigger and issue as row 21. | bitwire-12 | new issue | — |
| 23 | Three independently identified releases (protocol, conformance contract, evidence); keep `hello.driver = 1`. | HOLDS | Stated in `SCOPE.md`, Evidence; delivered with rows 21–22. | bitwire-12 | #58 | review |
| 24 | Before sealing, check that the baseline is singular across languages and roles for disputed behavior. | NEEDS ADAPTATION | Checked for the three disputed points (tunnel abort, path boundary, `busy`) in Go and TypeScript. Anything wider is evidence work (rows 21–22). | bitwire-12 | #58 | this table |
| 25 | A traceability matrix from scoped requirement to source to evidence. | NEEDS ADAPTATION | A section-level matrix in `SCOPE.md`, Traceability, pointing to the archived scenarios. Case-level mapping comes with row 22. | bitwire-12 | #58 | review |

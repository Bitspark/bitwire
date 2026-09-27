# bitwire/1 conformance

This directory holds the conformance material for protocol revision
[`bitwire/1`](../../protocol/bitwire-1/README.md). It is identified and
released separately from the protocol. The protocol's
[scope](../../protocol/bitwire-1/SCOPE.md#evidence-and-conformance-tooling)
defines the separation, and nothing here changes a protocol requirement.

| What | Identity | Files |
| --- | --- | --- |
| Protocol | (`bitwire/1`, `normativeDigest`) | [`protocol/bitwire-1`](../../protocol/bitwire-1/README.md) |
| Conformance contract | Edition 1, released on 28 September 2026, compatible with driver 1 | [`CONTRACT.md`](CONTRACT.md), [`scenario.schema.json`](scenario.schema.json), [`selection.json`](selection.json); the release in [`editions.json`](editions.json) |
| Evidence set | These files' content hashes | [`scenarios/`](scenarios) |
| Runner | Its name, version and source revision | [`runner/go`](runner/go/main.go), test-only and never published |

## The evidence set

Most scenarios under `scenarios/` derive from the upstream scenarios archived
unmodified in the protocol bundle; bitwire authors the rest (below). The selection rules in
[`selection.json`](selection.json) decide which ones travel and with what
scope. A derivative keeps the upstream steps, table expansion and expectations
exactly as they are. It adds:
- the protocol identity it tests;
- its scope (**core**, or **tunnel** for core and tunnel);
- the archived source file and that file's SHA-256;
- an `optional` marker when it supports no conformance claim:
  - `observer` when it needs one runtime's observer;
  - `defect` when it expects more than `bitwire/1` requires. Each such case is
    listed in `selection.json` with its reason.

Two archived scenarios are out of scope and do not travel: the identity
exchange, and a test-only recorder. New evidence is added as new scenarios
under the bitwire schema. It is never added to the archived files or to the
normative tables.

```console
node scripts/protocol-scenarios.mjs verify     # derivatives match their archived sources
node scripts/protocol-scenarios.mjs generate   # rewrite them from the archive and selection.json
```

`verify` also prints the contract's `contractDigest` and the evidence set's
`evidenceDigest`, computed with the protocol's digest procedure
([CONTRACT.md §1](CONTRACT.md#1-identity-and-status)). Reports record both.

`node scripts/check.mjs` runs `scripts/protocol-scenarios.test.mjs`. It checks:
- that every derivative equals its archived source plus the labels;
- that its steps are unchanged;
- the selection;
- every scenario, authored or derived, against the load rules of
  [CONTRACT.md §5.5](CONTRACT.md#55-loading) that need no runner. Those rules
  cover the members and enums, the protocol identity, scope and layer, the
  observer marking, excluded ops and op families.

The runner applies every load rule, the schema included, whenever it loads the
evidence set.

## Known evidence defects

Three derivatives expect more than `bitwire/1` requires. By decision 0008 a
scenario that contradicts its revision is a defect in the scenario, not in the
protocol:

- `peer/trace-members-verbatim`: its regular expression assumes the envelope
  members `id`, `traceparent` and `tracestate` arrive in that order, on one line,
  with no whitespace after the colons. The envelope orders no members.
- `tunnel/declaration-digest`: it expects Nightseam Go's exact refusal message.
  The tunnel requires only that the refusal name the family.
- `peer/binary-frame-ends-the-connection`: its raw frames name the plain
  method `echo` and expect the request to be served. Serving a plain name needs
  a plain-name handler, which revision 1 does not require: a name nothing
  handles is answered `method_not_found` (`SCOPE.md`, Paths). Under
  [CONTRACT.md §4.3](CONTRACT.md#43-peer-peer-call-core), "Names", a driver's
  handler is the one-segment path `["echo"]`, carried as `4:echo`.

They stay faithful to their archived sources and are marked
`"optional": "defect"` through `selection.json`. They run and are reported,
but under the claim rule ([CONTRACT.md §8.1](CONTRACT.md#81-required-cases))
they count neither toward nor against a claim. Each has an authored
replacement that tests only what the revision requires.

## Authored scenarios

bitwire writes these from `SCOPE.md` and the text it adopts, never from an
implementation. They derive from no archived file, so they carry no `source`,
and a `description` names the requirement they test. They are required
evidence, and their raw frames name a driver's handler canonically (`4:echo`).

| Scenario | Tests | Requirement |
| --- | --- | --- |
| [`peer/trace-members-any-order`](scenarios/peer/trace-members-any-order.json) | A response carries its request's `traceparent` and `tracestate` byte for byte, wherever the envelope places its members and with any whitespace; a `tracestate` that arrived alone comes back alone. The `tracestate` keeps W3C's optional whitespace, so re-serializing it fails. Replaces `peer/trace-members-verbatim`. | "Trace context": "a response carries its request's members byte for byte" |
| [`tunnel/declaration-digest-names-the-family`](scenarios/tunnel/declaration-digest-names-the-family.json) | A differing declaration digest is refused `contract_mismatch`, read on the wire through a raw `channel.open`, naming the family in the message or the data. Every other step of `tunnel/declaration-digest` is kept. Replaces it. | `tunnel.md`: "refused `contract_mismatch`, naming the family" |
| [`peer/binary-frame-ends-the-connection-canonical`](scenarios/peer/binary-frame-ends-the-connection-canonical.json) | Every step of `peer/binary-frame-ends-the-connection`, with its raw frames naming `4:echo`. Replaces it. | A binary frame ends the connection with 4011, undispatched |
| [`peer/over-limit-frame-ends-with-1009`](scenarios/peer/over-limit-frame-ends-with-1009.json), [`…-client`](scenarios/peer/over-limit-frame-ends-with-1009-client.json) | A frame of exactly the receiving peer's limit is served; one byte over ends the connection with 1009, and never reaches its handler. Once with the peer as server, once as client. The sender's send may succeed or fail, and it then reads 1009 off the wire. | "The connection beneath": refused before delivery, with 1009 |
| [`peer/empty-method-ends-with-4011`](scenarios/peer/empty-method-ends-with-4011.json), [`peer/empty-event-name-ends-with-4011`](scenarios/peer/empty-event-name-ends-with-4011.json) | A request with an empty `method`, or an event with an empty `event`, ends the connection with 4011, as both sides observe it. | "The envelope": nonempty names |
| [`peer/plain-names-are-not-rejected`](scenarios/peer/plain-names-are-not-rejected.json) | A plain request name nothing handles is answered `method_not_found`; a plain event name is dropped; the connection lives. | "Paths": "Revision 1 does not reject plain names" |
| [`peer/only-canonical-names-reach-a-path`](scenarios/peer/only-canonical-names-reach-a-path.json) | `4:echo` reaches the path `["echo"]`; `04:echo`, `5:echo`, `4:echox` and `echo` are not canonical for it and are answered `method_not_found`. | "Paths": canonical decoding |

No archived scenario asserted 1009, the nonempty-name rule or the path
encoding (finding F3); the last two are covered here as far as driver 1
reaches. bitruntime's TypeScript peer answered 4011 for an over-limit frame
([bitruntime#21](https://github.com/Bitspark/bitruntime/issues/21)); bitruntime
v0.4.0 fixes it.

## The runner

[`runner/go`](runner/go/main.go) is bitwire's test-only implementation of the
contract. It is its own Go module and depends only on a JSON Schema validator. It
never speaks the protocol, and no implementation is its oracle. It verifies the
protocol bundle it reads tables from against the manifest, and refuses the whole
evidence set when any scenario fails a load rule
([§5.5](CONTRACT.md#55-loading)). Then it drives two testees over driver 1 and
writes a report ([section 9](CONTRACT.md#9-reports)).

```console
cd conformance/protocol/runner/go
go run . run -config run.json -report report.json   # exit 0: the claim is supported
go run . digests                                     # contractDigest, evidenceDigest, protocol
go run . load                                        # the expanded cases
```

A run configuration names one claim run: the scope (`core`, or
`core and tunnel`), the implementation under test and its counterparts, the
ordered pairings, and the claimed transports. For each implementation it gives
the release, source revision, language, toolchain, the artifacts whose digests
the report records, its configuration against the default bounds, whether it
accepts connections, and the testee command. A transport gives the environment
that configures a testee for it, and whether it negotiates subprotocols.
Optional diagnostics (`observer`, `defect`) run only when requested. In
paths, `{config}` is the configuration's directory, `{checkout}` the checkout
and `{exe}` `.exe` on Windows.

`node scripts/conformance-protocol.mjs` (the `conformance` CI job) runs the
runner's tests under the race detector. It also checks that the runner loads
every scenario and computes the same `contractDigest` and `evidenceDigest`
as `scripts/protocol-scenarios.mjs`. The tests hold the runner to:
- every example in `CONTRACT.md`;
- every load rule;
- each expansion branch of the runner ops;
- the exchange's failure modes, through a scripted fake testee;
- `repeat`, judging, binding, applicability and the claim rule.

**Edition 1 is released,** on 28 September 2026, with `contractDigest`
`310daabd…`. [`editions.json`](editions.json) records it, outside the files the
digest covers ([§1](CONTRACT.md#1-identity-and-status)). The release followed:
- this runner passing the contract's examples;
- the runs against bitruntime's released testees;
- the deliberately invalid testees below.

Nothing they exposed needed a change to the contract. A report says
`"status": "released"` when its (edition, `contractDigest`) is recorded, and
`"draft"` otherwise.

`node scripts/check.mjs` fails when the contract files match no recorded
digest, so edition 1 cannot change in place:
- an editorial correction is recorded as a new `contractDigest` of edition 1;
- any other change is a new edition.

The evidence set may still change within the edition, under a new
`evidenceDigest`.

## Runs against released bitruntime

`node scripts/conformance-protocol-runtime.mjs` runs this runner against
bitruntime's released driver-1 testees, in the runtime-conformance CI job. The
testees are pinned under [`testees`](testees/bitruntime.json), never taken from
a checkout:
- **Go.** The test-only module [`testees/go`](testees/go/go.mod) requires the
  public bitruntime module at the pinned release, and its `go.sum` must hold the
  pinned sums. The script builds `cmd/bitwire-testee/go` from it with
  `GOWORK=off` and `-mod=readonly`, under the race detector (required in CI).
- **TypeScript.** The private package [`testees/ts`](testees/ts/package.json)
  depends on the release asset `@bitspark/bitruntime-testee`, which brings
  `@bitspark/bitruntime` from the same release. The script downloads both
  assets and checks their SHA-256 and integrity against the pins and the
  lockfile, then installs with `npm ci` in scratch.

It makes two claims, one per language. Each is core scope over WebSockets and
covers the pairings of the language with itself and with the other language in
both orders. The script requires both claims to be supported, and prints the
identities each report records: the protocol, the contract edition and
`contractDigest`, the `evidenceDigest`, the runner revision, the pinned
release, and each claim's counts and toolchain.

At bitruntime v0.4.2, and this evidence set, both claims are supported locally:
345 required cases pass in each, and none fail, are unsupported, are skipped or
end in a harness failure. Edition 1's release followed these runs.

## Deliberately invalid testees

A supported claim means little unless the same evidence rejects an
implementation that breaks `bitwire/1`. [`mutants/go`](mutants/go/main.go) is a
test-only testee that wraps a valid driver-1 testee and changes one thing, in
one of two ways:
- **In the exchange.** It changes an argument the runner sends, or answers a
  request itself instead of forwarding it. An example is a peer given no limit.
- **On the wire.** It relays every WebSocket connection of the testee through a
  TCP relay. The handshake passes through byte for byte, with `Host` naming the
  endpoint. The relay then reads each frame and may change, drop, repeat or
  abort it. An example is 4011 sent where the testee closed with 1009.

`node scripts/conformance-protocol-runtime.mjs` runs each mutation around the
released Go testee as the implementation under test, paired with the valid Go
testee in both orders. It requires:
- the control, `none`, to be supported. It relays every connection frame by
  frame and changes nothing, so it shows that the proxy and relay are
  transparent.
- every other mutant not to be supported, with a required case of a scenario
  that the mutant names failing (not merely ending in a harness failure).

By the claim rule ([§8.4](CONTRACT.md#84-claim-rule)), one failing required case
rejects a claim. So a mutant runs only the scenarios it names, and
`--mutants-full` runs its whole claim instead. `--mutants=name,…` runs only
those mutants, and `--no-mutants` none.

A mutant changes only what the other side sees. One that changes a close code
turns the other side's answering close frame back into the testee's own code,
so the testee sees the handshake it expects, as a peer that chose that code
would.

| Mutant | Changes | Breaks | Rejected by a failing case of |
| --- | --- | --- | --- |
| `aborts-instead-of-closing` | wire: ends the connection instead of sending its close frame | a side that closes or refuses sends a close frame with its code, and a refusal reaches the other side as 4011 | [`peer/malformed-frame-ends-the-connection`](scenarios/peer/malformed-frame-ends-the-connection.json), [`peer/empty-method-ends-with-4011`](scenarios/peer/empty-method-ends-with-4011.json), [`seam/close-carries-code-and-reason`](scenarios/seam/close-carries-code-and-reason.json) |
| `accepts-non-canonical-names` | wire: rewrites a received name to its canonical encoding, as a lenient decoder would | only a name's canonical encoding reaches the path it encodes | [`peer/only-canonical-names-reach-a-path`](scenarios/peer/only-canonical-names-reach-a-path.json) |
| `accepts-repeated-serials` | wire: drops a received request whose serial does not increase | a request serial that does not increase ends the connection | [`peer/request-serials-increase-in-publication-order`](scenarios/peer/request-serials-increase-in-publication-order.json) |
| `closes-normally-as-going-away` | wire: sends 1001 where the testee closed with 1000 | a normal close is 1000, and the other side reports it clean; 1001 means going away | [`peer/well-formed-frame-is-served`](scenarios/peer/well-formed-frame-is-served.json), [`peer/request-serials-may-leave-gaps`](scenarios/peer/request-serials-may-leave-gaps.json) |
| `delivers-binary-as-text` | wire: delivers a received binary frame as text | a frame arrives with its kind; a binary frame is never an envelope | [`seam/order-and-whole`](scenarios/seam/order-and-whole.json), [`peer/binary-frame-ends-the-connection-canonical`](scenarios/peer/binary-frame-ends-the-connection-canonical.json) |
| `delivers-frames-twice` | wire: sends every data frame twice | frames arrive in order, whole and once | [`seam/order-and-whole`](scenarios/seam/order-and-whole.json) |
| `drops-error-data` | wire: removes `data` from the errors it sends | a public error reaches the caller with its code, message and data | [`peer/public-error`](scenarios/peer/public-error.json) |
| `drops-events` | wire: drops the events it sends | an emitted event reaches the other side | [`peer/events-both-ways`](scenarios/peer/events-both-ways.json) |
| `drops-meta` | wire: removes `meta` from what it sends | meta travels with a request and an event | [`peer/meta-travels-with-a-call-and-an-event`](scenarios/peer/meta-travels-with-a-call-and-an-event.json) |
| `ignores-call-deadline` | exchange: drops a call's `timeout_ms` and the peer's `request_timeout_ms` | a call whose deadline passes ends with request_timeout | [`peer/request-timeout`](scenarios/peer/request-timeout.json) |
| `ignores-cancel` | exchange: answers `call.cancel` without cancelling | a caller's cancellation reaches the handler, and the call ends cancelled | [`peer/cancellation-reaches-the-handler`](scenarios/peer/cancellation-reaches-the-handler.json) |
| `ignores-its-limit` | exchange: raises every receive limit to 64 MiB | a frame over the receiver's limit is refused, and the connection ended | [`seam/over-limit-refused`](scenarios/seam/over-limit-refused.json), [`peer/over-limit-frame-ends-with-1009`](scenarios/peer/over-limit-frame-ends-with-1009.json), [`peer/over-limit-frame-ends-with-1009-client`](scenarios/peer/over-limit-frame-ends-with-1009-client.json) |
| `ignores-pending-limit` | exchange: drops `max_pending_requests` | the call past max_pending_requests is refused busy | [`peer/outstanding-call-limit`](scenarios/peer/outstanding-call-limit.json) |
| `ignores-subprotocols` | exchange: drops the subprotocols of `peer.listen` and `peer.dial` | the handshake selects a subprotocol the client offered and the server accepts | [`peer/subprotocol-negotiated-at-the-handshake`](scenarios/peer/subprotocol-negotiated-at-the-handshake.json) |
| `refuses-over-limit-with-4011` | wire: sends 4011 where the testee refused with 1009 | an over-limit frame ends the connection with 1009, not 4011 (the defect of bitruntime#21) | [`peer/over-limit-frame-ends-with-1009`](scenarios/peer/over-limit-frame-ends-with-1009.json), [`peer/over-limit-frame-ends-with-1009-client`](scenarios/peer/over-limit-frame-ends-with-1009-client.json) |
| `replaces-invalid-unicode` | wire: replaces unpaired surrogates and invalid UTF-8 in received text | strings hold Unicode scalar values; a frame with an unpaired surrogate is refused | [`peer/malformed-frame-ends-the-connection`](scenarios/peer/malformed-frame-ends-the-connection.json) |
| `substitutes-its-close-code` | wire: sends another code than the one the testee closed with | a close carries the code its side chose | [`seam/close-carries-code-and-reason`](scenarios/seam/close-carries-code-and-reason.json) |

The mutants run only against the Go testee. Each change is one a defective
implementation of either language could make.

## Not yet here

Path-encoding evidence beyond one segment (finding F3) is not here. Driver 1
cannot reach it, so it needs a new driver and therefore a new edition
([#59](https://github.com/Bitspark/bitwire/issues/59)).

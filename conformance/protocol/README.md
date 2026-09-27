# bitwire/1 conformance

This directory holds the conformance material for protocol revision
[`bitwire/1`](../../protocol/bitwire-1/README.md). It is identified and
released separately from the protocol. The protocol's
[scope](../../protocol/bitwire-1/SCOPE.md#evidence-and-conformance-tooling)
defines the separation, and nothing here changes a protocol requirement.

| What | Identity | Files |
| --- | --- | --- |
| Protocol | (`bitwire/1`, `normativeDigest`) | [`protocol/bitwire-1`](../../protocol/bitwire-1/README.md) |
| Conformance contract | Edition 1, compatible with driver 1 | [`CONTRACT.md`](CONTRACT.md), [`scenario.schema.json`](scenario.schema.json), [`selection.json`](selection.json) |
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
| [`peer/over-limit-frame-ends-with-1009`](scenarios/peer/over-limit-frame-ends-with-1009.json), [`…-client`](scenarios/peer/over-limit-frame-ends-with-1009-client.json) | A frame of exactly the receiving peer's limit is served; one byte over ends the connection with 1009, and never reaches its handler. Once with the peer as server, once as client. The sender's observation is the transport's. | "The connection beneath": refused before delivery, with 1009 |
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

**Edition 1 is still a draft.** This runner passes the contract's examples, which
is the first condition for releasing it ([§1](CONTRACT.md#1-identity-and-status)).
The release follows the first runs against real testees, so that anything those
runs expose can still enter edition 1. Until then every report says
`"status": "draft"`.

## Not yet here

- The testees that drive bitruntime's Go and TypeScript peers.
- Reports against released implementations.
- Evidence for the path encoding (finding F3).

[#59](https://github.com/Bitspark/bitwire/issues/59) tracks each of these as a
separate increment.

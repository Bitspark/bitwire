# bitwire/1 conformance contract, edition 1

**Status: draft of edition 1, not yet released.** It is released once a runner
implementing it passes the examples in this document and the release records
the contract digest (see [Identity and status](#1-identity-and-status)).

This document is normative for the conformance tooling of protocol revision
`bitwire/1`. It defines:
- how a runner drives a testee;
- what a scenario means;
- how an answer is judged;
- what a report records.

It is not part of the protocol. It adds, removes and reinterprets no protocol
requirement. [`SCOPE.md`](../../protocol/bitwire-1/SCOPE.md) governs what
`bitwire/1` requires. A scenario's result is evidence about a requirement,
never its definition.

**Citations.** A citation in brackets, such as [expect.go:matchAt], names the
upstream runner code this edition documents, as `file:function` in
`conformance/go/` of nightseam at commit
`5cc9723a24646c40ed1861f892b2b23eb6d785d7` (tag `v0.6.0`). The upstream driver
protocol ("driver 1") is archived as
[`DRIVER.md`](../../protocol/bitwire-1/source/conformance/DRIVER.md). Citations
record provenance and confer no authority. Where this document and that code
differ, this document governs; every such place is listed under
[Differences from upstream](#10-differences-from-upstream).

"Must" is a requirement on the runner, the testee or a scenario, as the
sentence names.

## 1. Identity and status

| Item | Value |
| --- | --- |
| Name | `bitwire/1` conformance contract |
| Edition | 1 |
| Target protocol | (`bitwire/1`, `7797682b0f05f86c508eafbd3be23c2084acd2f5cfc766922f9372b652dc416e`), the pair in [`manifest.json`](../../protocol/bitwire-1/manifest.json) |
| Driver exchange | driver 1: a testee answers `hello` with `"driver": 1` |
| Contract files | `CONTRACT.md`, [`scenario.schema.json`](scenario.schema.json) and [`selection.json`](selection.json), in `conformance/protocol/` |
| Evidence set | every file under [`scenarios/`](scenarios) |

**Digests.** Both use the digest procedure of
[`SCOPE.md`](../../protocol/bitwire-1/SCOPE.md#identity), with paths relative
to `conformance/protocol/`:
- `contractDigest` covers the three contract files;
- `evidenceDigest` covers every file under `scenarios/`, e.g.
  `scenarios/peer/public-error.json`.

Neither digest is written into a file it covers. A release of the contract
records `contractDigest`, and every report records both.

**Identity.** The contract is identified by the pair (edition, `contractDigest`).
The evidence set is identified by its `evidenceDigest`.

**Relation to the protocol.** The contract files and the evidence set lie
outside `normativeDigest`. Releasing an edition, or changing the evidence set,
changes no protocol identity and no protocol obligation. An edition targets
exactly one protocol identity. Edition 1 targets only `bitwire/1` with the
digest above.

**What changes what:**

| Change | Result |
| --- | --- |
| Anything a testee sees or must answer: the request or answer form, `hello`, `reset` or `bye`, an op, argument, answer or error code, the handle rules | A new driver version, which testees answer `hello` with; therefore also a new edition |
| How a runner reads scenarios or judges answers: the scenario format, the matching language, step execution, `repeat`, runner deadlines, selection, result kinds, the claim rule, report content, a scope's command set | A new edition; the driver stays 1 while the exchange is unchanged |
| An editorial correction that changes no case's result and no report content | The same edition with a new `contractDigest` |
| Scenarios added, removed or changed within this edition's format and commands | A new `evidenceDigest`; the same edition |
| A new protocol revision | A new edition that targets it |

## 2. Roles

| Term | Meaning |
| --- | --- |
| Runner | The program that loads scenarios, starts testees, sends requests, judges answers and writes the report. It never speaks the protocol itself. |
| Testee | A program an implementation provides: one peer under remote control, speaking driver 1 on its standard streams. |
| Side | `a` or `b`, the two testees a scenario drives. |
| Implementation under test | The implementation a report makes its claim for. |
| Counterpart | An implementation on the other side of a pairing. It may be the implementation under test itself. |
| Pairing | An ordered pair: the implementation on side `a`, and the one on side `b`. |
| Scenario | A JSON file of steps, with what the runner holds against each answer. |
| Case | One execution: a scenario after table expansion, as written or mirrored, in one pairing, over one transport configuration. |
| Evidence set | The scenarios, identified by `evidenceDigest`. Each names the protocol identity it tests. |

**Expectations stay with the runner.** A testee receives only an op and its
substituted arguments [run.go:Run]. It never sees `expect`, `expect_error`,
`assert`, `bind`, `repeat` or `note`, never learns which scenario runs, and
cannot tell a case's result.

## 3. Transport and session

### 3.1 Streams

- The runner starts each testee as a child process. The start command, its
  environment, the transport it uses and its configuration lie outside the
  exchange (upstream: a `testee.json` recipe [driver.go:Recipes]). The report
  records them.
- Each message is one JSON object on one line of UTF-8, ended by LF. Requests go
  to the testee's stdin. The testee writes only answers to stdout, and flushes
  after every line.
- Stderr is free. The runner keeps it, discards it at each successful `reset`,
  and shows both sides' stderr with a failure [driver.go:Testee.Reset,
  run.go:Failure].
- The runner sends one request at a time and waits for its answer before the
  next. A testee never writes unasked.
- When one implementation is on both sides, the runner may use one process for
  both [suite.go:run]. The two sides then share one handle space, which the
  testee keeps apart, and `reset` is sent once per side.

### 3.2 Requests

A request is `{"id": n, "op": "…", …}`, with the op's arguments as further
members.
- `id` is an integer that the runner increments per process, starting at 1
  with `hello` [driver.go:Testee.Request].
- No op has an argument named `id` or `op`. A scenario that writes one is
  refused at load ([5.5](#55-loading)), and the runner's own `id` and `op`
  are the ones sent. The upstream runner let such an argument overwrite the
  request's own member.

### 3.3 Answers

An answer is `{"id": n, "ok": value}` or
`{"id": n, "error": {"code": "…", "message": "…", …}}`. The runner reads it as
follows [driver.go:Testee.Request]:

1. The line is a JSON object, and its `id` equals the request's.
2. When `error` is present, it is an object with a nonempty string `code`.
   `message` is read when it is a string. Every member is kept for matching. An
   error takes precedence over any `ok`.
3. Otherwise the answer is `ok`. An answer with no `ok` reads as `{}`; that is
   the upstream runner's reading, and a testee writes `ok` on every success,
   `{}` when there is nothing to say. An `ok` of `null` reads as null.
4. Numbers keep the spelling the testee wrote. They compare as values (see
   [Literals](#62-literals)).

An answer that breaks rule 1 or 2, or whose `ok` is not JSON, makes the testee
dead (see [3.8](#38-a-testee-that-fails-the-exchange)).

Edition 1 reads member names exactly (`id`, `ok`, `error`, `code`,
`message`), and only JSON whitespace (a CR, for instance) may follow the
object on its line. The upstream Go runner
also accepted other capitalizations and trailing data; a testee that relies on
either is outside driver 1. Invalid UTF-8, or an unpaired surrogate escape, in
an answer is decoded as U+FFFD before matching.

### 3.4 Error codes

| Code | Meaning |
| --- | --- |
| `unsupported` | The testee does not implement the op, or the feature its arguments ask for. The case's result is `unsupported` [run.go:Run]. |
| `timeout` | The op did not settle within its `within_ms`. |
| `unknown_handle` | `on` names nothing this testee minted. |
| `invalid` | The arguments are malformed, or `on` names a handle of the wrong kind. The upstream Go testee answers `unknown_handle` instead when `conn.accept` or `peer.accept` is given something that is not a listener. No edition-1 scenario depends on which of the two a testee answers. |
| `closed` | `conn.send`, `conn.close` or `conn.receive` on a connection a close ended. `conn.receive` adds `close_code` and `reason` when a close frame carried them. |
| `failed` | An op whose transport broke, or could not be reached: `conn.send`, `conn.close` and `conn.receive` on a broken transport, and `conn.dial`, `peer.dial` and `peer.over` that could not connect (the upstream Go testee's closeError). |
| `disconnected` | `peer.emit`, `peer.await_event`, `tunnel.open` or `tunnel.accept` after the peer's connection ended. |
| Any other | An op's own refusal, its code verbatim, such as `tunnel.open`'s `channel_refused` or `contract_mismatch`. |

**A call's outcome is not an error answer.** `call.await` answers `ok` with
`{"error": {"code", "message", "data"?}}`. The code is the remote's public
error code, or one the caller's side produced: `cancelled`, `request_timeout`,
`disconnected`, `busy` (the caller's own limit of outstanding calls) or
`failed`.

Every error answer except `unsupported` is judged by the step (see
[7.3](#73-judging-an-answer)).

### 3.5 hello, reset and bye

- **`hello`** is the first request and has no arguments. Its `ok` is
  `{"driver": 1, "language", "layers", "features"}`. The runner refuses a
  testee whose `ok` does not decode to that shape with `driver` exactly the
  integer 1 [driver.go:Start]. That is a harness failure of every case the
  testee was to run. An absent or null `language`, `layers` or `features`
  reads as empty, as upstream read it; a member of another type is refused.
  - `layers` names the op families it implements. Edition 1 reads `seam`,
    `peer` and `tunnel` and ignores the others.
  - `features` names any of `listen`, `pipe`, `lazy`, `propagator` and
    `observer`.
  - A need is met when either list names it [driver.go:Hello.Has].
- **`reset`** goes to each side before every case [run.go:Run]. The testee
  closes and forgets everything it holds: connections, listeners, peers,
  tunnels, channels and calls. It answers `{}` with nothing left running. An
  error answer is a harness failure.
- **`bye`** is the last request. The testee resets, answers and exits 0. The
  runner then closes stdin, waits 10 s for the exit, and otherwise kills the
  process [driver.go:Testee.Stop].

### 3.6 Handles

Everything a testee makes is a **handle**: a string it mints, and never reuses
within a process. Connections, listeners, peers, tunnels, channels and calls
are handles. The runner passes a handle back as `on`. A channel is also a
connection. Handles and `url` values are opaque to the runner, which only
binds and substitutes them.

### 3.7 Values, waiting and consumption

- **Payloads.** `params`, `data`, `value`, `result` and a frame's `text` are
  payloads. A testee hands a payload to its runtime without decoding and
  re-encoding it. What it receives is the runner's serialization of the
  scenario's value after substitution [expect.go:substitute,
  driver.go:Testee.Request]. That serialization keeps each number's spelling
  and each string's content, but not member order, whitespace or string
  escaping: the upstream runner sorts members, writes no whitespace and escapes
  `<`, `>` and `&` in strings. A case that needs exact wire bytes writes them
  as a raw frame's `text`. (DRIVER.md says the scenario's bytes pass
  unchanged; edition 1 states what the runner does.)
- Binary is base64 in a `base64` member. Durations are `_ms` integers. Times are
  never reported.
- **Waiting.** An op that can wait on the other side takes `within_ms`
  (default 5000) and answers `timeout` when it passes, never hanging. These
  ops are `conn.accept`, `conn.send`, `conn.receive`, `conn.close`,
  `conn.await_close`, `peer.accept`, `peer.emit`, `peer.await_event`,
  `peer.await_request`, `peer.await_close`, `call.await`, `tunnel.open` and
  `tunnel.accept`.
- **The testee is pull-based.** Per handle, it holds what arrived while the
  runner was not asking:
  - frames received on a connection;
  - events received on a peer;
  - the lifecycle of every request a canned handler served.

  An await op returns the first held entry that fits its arguments, and removes
  it. A close stays: every later `conn.receive` on that connection sees it.
  Nothing is reported unasked, and nothing is lost between asks.
- **Consumption.** A connection from `conn.listen`/`conn.accept`,
  `conn.dial` or `conn.pipe` is `"eager"` by default: it receives and holds
  frames as they arrive. A `"lazy"` connection receives nothing until
  `conn.receive` asks, which is what a scenario about credit needs; asking for
  one needs the `lazy` feature. **A channel from `tunnel.open` or
  `tunnel.accept` is `"lazy"` by default**, whether or not the testee has the
  `lazy` feature [testee/tunnel.go:lazyChannel].

### 3.8 A testee that fails the exchange

The runner holds a testee dead when any of these happens
[driver.go:Testee.Request]:
- writing to its stdin fails;
- no answer arrives within the runner's deadline (see [7.5](#75-deadlines));
- its stdout ends;
- a line is not an answer;
- the `id` differs from the request's;
- an error is not an object, or has no code;
- `ok` is not JSON.

The case it was in is a harness failure. The runner terminates that process and
starts a new one for the next case [suite.go:run].

## 4. Commands

In an argument list, **bold** marks a required argument. Every op that acts on
a handle takes `on`. Each op has one status in edition 1:

| Status | Meaning |
| --- | --- |
| core | May appear in cases of either scope. A testee claiming the core implements it. |
| tunnel | May appear in cases of the core-and-tunnel scope. |
| optional | Appears only in optional diagnostics (see [4.6](#46-optional-the-observer)). |
| excluded | Appears in no edition-1 scenario. A testee may answer `unsupported`. |

### 4.1 Runner ops

A scenario never says which side listens. It writes one of these ops with
`"on": "runner"`, and the runner expands it into testee ops from what the two
sides answered `hello` with [pair.go:expandPair]. For an implementation under
test that the report declares does not accept connections, the runner reads its
`hello` without `listen`, here and for needs ([8.2](#82-pairings-roles-and-transports)).
They are core.

| Op | Arguments | Binds (object form only) |
| --- | --- | --- |
| `pair.conns` | `limit_a`, `limit_b`, `consume_a`, `consume_b`: each side's own receive limit and consumption | `a`, `b`: the two connections |
| `pair.peers` | **`server`** (`"a"` or `"b"`), `server_options`, `client_options` | `server`, `client`: the two peers |
| `pair.peer_and_conn` | **`peer`** (`"a"` or `"b"`), **`role`** (`"client"` or `"server"`), `options` (the peer's), `limit` and `consume` (the raw side's) | `peer`, `conn` |

The expansion uses these conventions:
- N is the op's ordinal among the scenario's runner ops, from 1.
- `_pN_…` are the runner's own binding names. A scenario cannot write them,
  because a scenario's names start with a letter.
- A scenario name given in `bind` replaces the runner's name for that handle.
- `limit` is passed only when it is a number, and `consume` only when it is a
  nonempty string. Runner-op arguments are read before substitution, so a
  placeholder there is dropped [pair.go:number]; a scenario writes them as
  literals.
- A step marked **unsupported** ends the case with that result and the reason
  given.

**`pair.conns`.** L is `a` if `a` has `listen`, otherwise `b` if `b` has it.
When neither has it, the case is unsupported ("neither testee can listen"). D
is the other side.

1. L: `conn.listen {limit: limit_L}`, binding `handle`→`_pN_l`, `url`→`_pN_url`.
2. D: `conn.dial {url: $_pN_url, limit: limit_D, consume: consume_D}` → `bind.D`, else `_pN_cD`.
3. L: `conn.accept {on: $_pN_l, consume: consume_L}` → `bind.L`, else `_pN_cL`.

**`pair.peers`.** S is the server side and C the other.
- **If S has `listen`:**
  1. S: `peer.listen {options: server_options}` → `_pN_l`, `_pN_url`.
  2. C: `peer.dial {url: $_pN_url, options: client_options}` → `bind.client`, else `_pN_pc`.
  3. S: `peer.accept {on: $_pN_l}` → `bind.server`, else `_pN_ps`.
- **Otherwise,** if C lacks `listen`, the case is unsupported. If either side
  lacks `lazy`, it is unsupported. Otherwise:
  1. C: `conn.listen {limit: client_options.max_frame_bytes}`.
  2. S: `conn.dial {url, limit: server_options.max_frame_bytes, consume: "lazy"}` → `_pN_cS`.
  3. C: `conn.accept {on, consume: "lazy"}` → `_pN_cC`.
  4. C: `peer.over {on: $_pN_cC, role: "client", options: client_options}` → `bind.client`, else `_pN_pc`.
  5. S: `peer.over {on: $_pN_cS, role: "server", options: server_options}` → `bind.server`, else `_pN_ps`.

**`pair.peer_and_conn`.** P is the peer's side and R the raw side.
- **If P has `listen` and the role is `server`:**
  1. P: `peer.listen {options}`.
  2. R: `conn.dial {url, limit, consume}` → `bind.conn`, else `_pN_c`.
  3. P: `peer.accept {on}` → `bind.peer`, else `_pN_p`.
- **If P has `listen` and the role is `client`:** if P lacks `lazy`, the case is
  unsupported. Otherwise:
  1. P: `conn.listen {limit: options.max_frame_bytes}`.
  2. R: `conn.dial {url, limit, consume}` → `bind.conn`, else `_pN_cR`.
  3. P: `conn.accept {on, consume: "lazy"}` → `_pN_cP`.
  4. P: `peer.over {on: $_pN_cP, role: "client", options}` → `bind.peer`, else `_pN_p`.
- **Otherwise,** if R lacks `listen`, or P lacks `lazy`, the case is
  unsupported. Otherwise:
  1. R: `conn.listen {limit}`.
  2. P: `conn.dial {url, limit: options.max_frame_bytes, consume: "lazy"}` → `_pN_cP`.
  3. R: `conn.accept {on, consume}` → `bind.conn`, else `_pN_cR`.
  4. P: `peer.over {on: $_pN_cP, role, options}` → `bind.peer`, else `_pN_p`.

### 4.2 Seam: `conn.*` (core)

The frames connection beneath the profile.

| Op | Arguments | Answer |
| --- | --- | --- |
| `conn.listen` | `limit` (bytes, default 1 MiB) | `{"handle", "url"}`: a listener that accepts one connection at `url`. Needs `listen`. |
| `conn.accept` | **`on`** (listener), `consume`, `within_ms` | `{"handle"}`: the accepted connection |
| `conn.dial` | **`url`**, `limit`, `consume` | `{"handle"}` |
| `conn.pipe` | `limit`, `consume` | `{"a", "b"}`: two connected handles in one process. Needs `pipe`. |
| `conn.send` | **`on`**, **`kind`** (`"text"` or `"binary"`), `text` or `base64`, `within_ms` | `{}`; on an ended connection, `closed` or `failed` |
| `conn.receive` | **`on`**, `within_ms` | `{"kind", "text"}` or `{"kind", "base64"}`. On an ended connection, an error: `closed` with `close_code` and `reason`, or `failed`. |
| `conn.close` | **`on`**, `code` (default 1000), `reason`, `within_ms` | `{}`; on an ended connection, `closed` or `failed` |
| `conn.abort` | **`on`** | `{}` |
| `conn.await_close` | **`on`**, `within_ms` | `{"code", "reason"}` as the connection ended: a close frame's, or `1006` and `""` for an abort or a broken transport |

The transport of `conn.listen` and `conn.dial` is the testee's configured one
(upstream: a WebSocket).

### 4.3 Peer: `peer.*`, `call.*` (core)

| Op | Arguments | Answer |
| --- | --- | --- |
| `peer.listen` | `options`, `subprotocols` | `{"handle", "url"}`: a listener that accepts one peer at `url`, as the server. Needs `listen`. |
| `peer.accept` | **`on`** (listener), `within_ms` | `{"handle", "subprotocol"}`: the accepted peer, with the listener's `options` |
| `peer.dial` | **`url`**, `options`, `subprotocols` | `{"handle", "subprotocol"}`: the connected client peer |
| `peer.over` | **`on`** (connection or channel), **`role`** (`"client"` or `"server"`), `options` | `{"handle"}`: a peer speaking the profile over that connection. The connection must be lazily consumed; on an eager one the answer is `invalid` [testee/peer.go]. |
| `peer.handle` | **`on`**, **`method`**, **`behavior`** | `{}`: registers a canned handler (below) |
| `peer.on_event` | **`on`**, **`name`**, `behavior` (`record`, the default, `block` or `panic`) | `{}` |
| `peer.call` | **`on`**, **`method`**, `params` (absent sends `null`), `timeout_ms` (a deadline for this call alone; absent or 0 leaves only the peer's), `meta` | `{"handle"}`: a call in flight |
| `call.await` | **`on`**, `within_ms` | `{"result": …}` or `{"error": {"code", "message", "data"?}}` |
| `call.cancel` | **`on`** | `{}`. The caller gives up, and its `call.await` then ends `cancelled`. |
| `peer.emit` | **`on`**, **`event`**, `data` (absent sends `null`), `within_ms`, `meta` | `{}` |
| `peer.await_event` | **`on`**, **`name`**, `within_ms` | `{"data": …, "meta"?}` |
| `peer.await_request` | **`on`**, **`method`**, **`phase`** (`"started"` or `"ended"`), `within_ms` | `{"id", "method", "phase", "outcome", "meta"?}`. On `ended`, `outcome` is `ok`, `error`, `cancelled` or `panic`. The upstream Go testee answers `id` as `""` and omits `outcome` on `started`; scenarios hold neither. |
| `peer.close` | **`on`** | `{}` |
| `peer.await_close` | **`on`**, `within_ms` | `{"clean": bool, "code": int}` |

**Names.** An op's `method` (`peer.handle`, `peer.call`, `peer.await_request`),
`event` (`peer.emit`) and `name` (`peer.on_event`, `peer.await_event`) is a
one-segment path. The testee handles, sends or waits for it at that path, which
`bitwire/1` carries in its canonical encoding
([`SCOPE.md`, Paths](../../protocol/bitwire-1/SCOPE.md#paths)): `echo` travels
as `4:echo`. Answers report the driver's name, `echo`.
- A name that begins with the reserved prefix of a layer edition 1 covers,
  `channel.`, is that vocabulary's own plain name instead: the vocabulary is
  plain names by definition.
- A scenario's raw frames therefore name a driver's handler canonically.
  Serving a plain name needs a plain-name handler, which revision 1 does not
  require (a name nothing handles is answered `method_not_found`), so no
  required case depends on one.

**Calls.** `call.await` answers as the call ended:
- the remote's `result`;
- the remote's public error, with `code`, `message` and `data` verbatim;
- `cancelled` after `call.cancel`;
- `request_timeout` when the peer's deadline, or the call's `timeout_ms`,
  passed;
- `disconnected` when the connection ended first.

Messages of the driver's own codes are the testee's own.

**`meta`.** An object whose every value is a string, absent by default. A
testee sends it the way its language attaches carriage to a frame. It never
adds a member of its own, so a step that names none produces a frame without
`meta`. A key with the reserved `nightseam.` prefix is dropped before sending.
`peer.await_request` on `started`, and `peer.await_event`, report the `meta`
their frame carried, and omit the member when it carried none.

**`subprotocols`.** An array of tokens, empty or absent by default:
- on `peer.listen`, what the server selects from, in its order of preference;
- on `peer.dial`, what the client offers.

`subprotocol` in both answers is what the handshake selected, as that side
sees it, or `""` when nothing was. A testee whose transport cannot negotiate a
subprotocol answers `unsupported`.

**`peer.await_close`.** `code` is the code the connection ended under:
- **1000** where a side chose to close;
- **4011** where a peer refused a frame;
- **1009** where the receiver refused a frame over its limit;
- **1006** where a side aborted and sent nothing;
- otherwise whatever the remote sent when it closed first.

`clean` is `code == 1000`.

**`options`**, on `peer.listen`, `peer.dial` and `peer.over`:

| Member | Default | Means |
| --- | --- | --- |
| `max_frame_bytes` | the runtime's | A frame over it is refused and the connection ended. |
| `queue_capacity` | the runtime's | Inbound events held before the peer is stalled. |
| `max_pending_requests` | the runtime's | Calls outstanding at once. The one past it is refused `busy` without reaching the wire. |
| `request_timeout_ms` | the runtime's | A call's deadline. |
| `write_timeout_ms` | the runtime's | How long a send may wait, and how long a full queue is paced before its consumer is stalled. |
| `propagate` | `false` | The runtime's default propagator is in use: every request carries a trace, and a handler's callbacks are its children. Needs `propagator`. |
| `observe`, `families` | `false`, `{}` | Optional (see [4.6](#46-optional-the-observer)). |

**Canned behaviours** for `peer.handle`. Every canned handler records its
lifecycle for `peer.await_request`: `started` when it is invoked, and `ended`
with the outcome when it answers.

| `behavior` | Does |
| --- | --- |
| `{"kind": "echo"}` | Answers with its params. |
| `{"kind": "return", "value": …}` | Answers with `value`. |
| `{"kind": "fail", "code", "message", "data"}` | Answers with that public error. |
| `{"kind": "wait"}` | Answers nothing until the request is cancelled or the peer ends; then `ended` is `cancelled`. |
| `{"kind": "hold", "until": "<event>", "value": …}` | Holds the request until the remote emits `until`, whatever its cancellation signal says, then answers `value`. |
| `{"kind": "panic", "value": "…"}` | Gives up the way the language does (a panic or a throw), with that value. |
| `{"kind": "reverse", "method", "params"}` | Calls `method` on the remote from the request's own context, with `params` (or, when absent, its own params). Answers with what came back, or fails with it. |
| `{"kind": "emit", "event", "data", "then": …}` | Emits `event` from the request's context, then answers `then`. |

An event handler installed with `peer.on_event` does one of three things:
- `record` holds the event for `peer.await_event`;
- `block` never returns, which is how an inbound queue fills;
- `panic` gives up.

### 4.4 Tunnel: `tunnel.*` (tunnel)

| Op | Arguments | Answer |
| --- | --- | --- |
| `tunnel.over` | **`on`** (peer), `options`: `window` (default 32), `max_frame_bytes`, `accept_capacity` (default 64), `contracts` (a map from family to a 64-hex digest) | `{"handle"}` |
| `tunnel.open` | **`on`**, **`family`**, `digest`, `consume`, `within_ms` | `{"handle", "id"}`: the channel, a connection handle. A refused open answers an error with the refusal's code: `channel_invalid`, `channel_exists`, `contract_mismatch` or `channel_refused`. |
| `tunnel.accept` | **`on`**, `consume`, `within_ms` | `{"handle", "id", "family", "digest"}`, where `digest` is `""` when the open carried none |

- A channel takes every `conn.*` op, and `peer.over` makes a peer of it.
- **Digests are opaque.** `digest` and `contracts` are 64-character lowercase
  hexadecimal strings, used only for the tunnel's admission comparison. A
  testee computes no digest, and edition 1 attaches no meaning to one.
- **A frame beyond the window.** A scenario provokes a credit violation with
  `peer.emit` of a `channel.frame` event on the outer peer, naming the channel
  by the `id` that `tunnel.open` answered. A channel's own `conn.send` would
  wait for credit instead.

### 4.5 Excluded ops and arguments

| Op or argument | Reason |
| --- | --- |
| `peer.identity`, `peer.check_identity` | The identity exchange, which the scope excludes |
| `peer.recorded_wire_witness` | A test-only recorder, one runtime's instrumentation |
| `live.*`, and the canned behaviour `through` | The live layer |
| `gen.*`, `client.*`, `server.*` | Generated code |

The upstream tables other than the three normative ones (`validator`,
`naming`, `digests`, `declaration-digests`, `examples`,
`generic-composition`, `callable-identities`, `otel-events`, `recorded-wire`
and the `auth-*` tables) are not part of edition 1.

### 4.6 Optional: the observer

`peer.observed` (**`on`**, `trace`, `drain`, default `true`), the peer options
`observe` and `families`, and the `observer` feature are optional. They appear
only in scenarios marked `"optional": "observer"`. Those scenarios are
diagnostics of one runtime's instrumentation and support no claim.
- The answer is an array of events, shaped as `DRIVER.md` ("What an observer is
  told") describes. Each event names itself in a `type` member.
- A `peer.observed` step repeated until a match must set `"drain": false`, and
  the loader refuses one that does not [scenario.go:parseStep].
- The tunnel's observer events reach `peer.observed` on the tunnel's peer.

## 5. Scenario format

A scenario is one JSON file under `scenarios/<layer>/`, valid against
[`scenario.schema.json`](scenario.schema.json).

### 5.1 Members

| Member | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Nonempty. After expansion, unique within its layer. |
| `layer` | yes | `seam`, `peer` or `tunnel`. It equals the directory the file lies in [scenario.go:parse]. |
| `protocol` | yes | `{"revision": "bitwire/1", "normativeDigest": "<64 hex>"}`: the identity the scenario tests. A runner refuses a scenario whose pair differs from its target. |
| `scope` | yes | `"core"`, or `"tunnel"` for the core-and-tunnel scope. |
| `optional` | no | `"observer"`: the scenario is a diagnostic that needs the observer. |
| `source` | derivatives | `{"path", "sha256"}`: the archived upstream scenario this one derives from, byte-identical in the protocol bundle. Tooling verifies it (`node scripts/protocol-scenarios.mjs verify`); the runner does not need to. |
| `replaces`, `description` | no | Informative. |
| `needs` | yes, in effect | Layers and features the steps ask for (see [5.4](#54-needs)). |
| `mirror` | no | Default `false`. When `true`, the scenario also runs with `a` and `b` exchanged. |
| `foreach` | no | `{"table", "as", "where"?}`: expands the scenario once per selected row. |
| `steps` | yes | At least one step. |

A scenario that derives from no archived file omits `source`; the schema allows
that for scenarios bitwire authors, and requires `source` of no scenario.

### 5.2 Steps

| Member | Meaning |
| --- | --- |
| `on` | `"a"` or `"b"`, the testee that takes the op; or `"runner"` for a `pair.*` op. |
| `op` | Matches `^[a-z]+\.[a-z_]+$`. |
| `args` | An object: the op's arguments, substituted before sending (see [5.6](#56-argument-substitution)). |
| `bind` | A name, or an object from member to name. Names match `^[a-z][a-z0-9_]*$`. See [7.4](#74-bind). |
| `expect` | Any JSON value, matched against an `ok` answer (see [section 6](#6-the-matching-language)). Its presence counts, even when the value is `null`. |
| `expect_error` | An object, matched against an error answer. |
| `assert` | `{"absent"?: text, "present"?: text}`, held against the answer's rendering (see [7.3](#73-judging-an-answer)). |
| `repeat` | `{"max": n ≥ 1, "until"?: "ok", "error" or "match"}` (see [7.2](#72-repeat)). |
| `note` | Informative. It never affects execution. |

### 5.3 Layers

A step's op belongs to its layer or to one beneath it [scenario_test.go:
allowedAcross]:
- `seam` uses `conn`;
- `peer` uses `conn`, `peer` and `call`;
- `tunnel` uses `conn`, `peer`, `call` and `tunnel`.

`pair.*` is allowed in every layer.

### 5.4 Needs

The runner derives what each step asks of the side that runs it
[pair.go:needsOf]:

| Step | Adds |
| --- | --- |
| Op family `conn` | `seam` |
| Op family `peer` or `call` | `peer` |
| Op family `tunnel` | `tunnel` |
| `conn.listen`, `peer.listen` | `listen` |
| `conn.pipe` | `pipe` |
| `peer.observed` | `observer` |
| `args.consume` is `"lazy"` | `lazy` |
| `args.options.propagate` is `true` | `propagator` |
| `args.options.observe` is `true` | `observer` |
| `pair.conns` | `seam` on both sides |
| `pair.peers` | `peer` on both sides; option features from `server_options` on the server's side and from `client_options` on the other |
| `pair.peer_and_conn` | `peer` on the peer's side and `seam` on the other; option features from `options` on the peer's side |

A runner op does not add `listen` or `lazy`: those are the runner's choice. The
steps it expands into declare them. **The declared `needs` must equal the
union** of the derived needs over both sides, before expansion
[pair.go:holdDeclared].

### 5.5 Loading

A runner refuses the evidence set when any scenario fails one of these checks.
It then reports no claim from that set.
- the protocol bundle, whose tables `foreach` reads, has the target identity
  and verifies against its manifest;
- every file under `scenarios/` is a scenario;
- the schema;
- the layer and directory ([5.3](#53-layers));
- the declared needs ([5.4](#54-needs));
- the protocol identity;
- the runner-step rules [pair.go:checkRunnerStep]:
  - a `pair.*` op is written only `on` `runner`, and a runner step only uses a
    `pair.*` op;
  - `server` and `peer` are `"a"` or `"b"`;
  - `role` is `client` or `server`;
  - `bind`, when present, is an object;
  - a runner step has no `expect`, `expect_error`, `assert` or `repeat`;
- the observer repeat rule ([4.6](#46-optional-the-observer));
- `foreach` selects at least one row ([5.7](#57-foreach-and-where));
- no two expanded scenarios share a layer and name [scenario.go:Load];
- the scope matches the layer: `seam` and `peer` scenarios are `core`, and
  `tunnel` scenarios are `tunnel`;
- a scenario that needs `observer` is marked `"optional": "observer"`;
- no step uses an excluded op ([4.5](#45-excluded-ops-and-arguments)), and only an
  optional scenario uses `peer.observed` or the `observe` option;
- no step's `args` has a member named `id` or `op` ([3.2](#32-requests));
- no step binds a keyword of the matching language, through `bind` or
  `$bind:` ([6.5](#65-placeholders));
- each op family a step uses belongs to the scenario's layer or one beneath it:
  `conn.*` everywhere, `peer.*` and `call.*` in `peer` and `tunnel`, and
  `tunnel.*` only in `tunnel`. Upstream held this in a test
  [scenario_test.go:allowedAcross]; edition 1 makes it a load check.

### 5.6 Argument substitution

Before sending, the runner replaces placeholders throughout `args`, including
inside payloads and nested objects and arrays [expect.go:substitute]. Only a
whole string is a placeholder; there is no interpolation inside a string, and
member names are never substituted.

| String in `args` | Sent as |
| --- | --- |
| does not begin with `$` | itself |
| begins with `$$` | itself without the first `$` |
| `$path` | the bound value `path` resolves to (see [6.7](#67-bindings)), whatever its JSON type |

A path that does not resolve fails the step. There are no matchers in
arguments: `$any` in `args` refers to a binding named `any`.

| `args` | Bindings | Sent |
| --- | --- | --- |
| `{"on": "$pb"}` | `pb` = `"peer3"` | `{"on": "peer3"}` |
| `{"text": "$row.frame"}` | `row` = `{"frame": "{\"a\":1}"}` | `{"text": "{\"a\":1}"}` |
| `{"n": "$row.n"}` | `row.n` = `1e3` | `{"n": 1e3}` |
| `{"literal": "$$dollar"}` | none | `{"literal": "$dollar"}` |
| `{"on": "$nothing"}` | none | the step fails: `$nothing refers to nothing bound` |

### 5.7 foreach and where

`foreach.table` is one of `tables/frames.json`, `tables/serials.json` and
`tables/unicode.json`, relative to `protocol/bitwire-1/source/conformance/`.
The runner expands the scenario as follows [scenario.go:tableRows,
scenario.go:parse]:
1. It reads the table's `rows` array. Every row is an object.
2. It keeps a row when, for every member `k` of `where`, `where[k]` equals the
   row's `k` under value equality (see [6.7](#67-bindings)). A member missing
   from the row compares as `null`.
3. Selecting no row makes the scenario invalid.
4. Each kept row becomes one scenario named `name[label]`. `label` is the row's
   `name` when that is a string, and otherwise the row's index among the kept
   rows, from 0.
5. The row is bound under `as` before the first step.

### 5.8 mirror

With `"mirror": true`, the scenario runs as written and again mirrored, named
`name (mirrored)`. Mirroring comes after table expansion, so a row's mirror is
named `name[label] (mirrored)`. It changes only the following
[scenario.go:Scenario.Mirrored, pair.go:mirrorRunnerStep]:
- a testee step's `on` swaps `a` and `b`;
- in a runner step's arguments, `server` and `peer` swap `a` and `b`;
- a top-level argument name ending in `_a` changes to end in `_b`, and the
  reverse;
- in `pair.conns`, the `bind` keys `a` and `b` swap.

Arguments of testee steps, expectations and binding names are unchanged.

## 6. The matching language

### 6.1 General

`expect` is held against an `ok` answer, and `expect_error` against the error
object: its `code`, its `message` and whatever other members it has. The runner
walks the expected value [expect.go:matchAt]:
- it binds as it goes;
- it stops at the first mismatch;
- it reports where the values parted, e.g.
  `the answer.events[1].n: expected 1, got 2`.

A string beginning with `$` is always a placeholder (see [6.5](#65-placeholders));
any other value is a literal. **An expectation cannot express a literal string
beginning with `$`.** Unlike arguments, expectations have no `$$` escape.

### 6.2 Literals

| Expected | Holds when |
| --- | --- |
| a string not beginning with `$` | the actual value is a string with the same content |
| a number | the actual value is a number with the same text, or both parse as IEEE-754 binary64 numbers that are equal [expect.go:sameNumber] |
| `true` or `false` | the same boolean |
| `null` | the actual value is `null` |

For example, `{"n": 1000}` holds against `{"n": 1e3}`, and `{"a": null}`
refuses `{"a": 0}`. Because the comparison goes through binary64, two integers
beyond 2^53 that round alike compare equal. A number binary64 cannot represent,
such as `1e400`, equals only a number with the same text.

### 6.3 Objects

An expected object holds when the actual value is an object and every **named**
member holds. **Members the expectation does not name are ignored.** Named
members are held in ascending byte order of their names
[expect.go:matchAt].

| Member's expectation | Holds when |
| --- | --- |
| `"$absent"` | the actual object has no such member; a member present with any value, `null` included, fails |
| anything else | the member is present and its value holds against the expectation |

`$absent` stands only as an object member's expectation. Anywhere else it fails
the step. An object with a `$contains` member is not an object expectation
(see [6.6](#66-subsequences-contains-and-lanes)).

| Expected | Actual | Holds |
| --- | --- | --- |
| `{"a": 1, "b": "x"}` | `{"a": 1, "b": "x", "c": true}` | yes |
| `{"a": 1}` | `{}` | no, `a` is absent |
| `{"a": "$absent"}` | `{"b": 1}` | yes |
| `{"a": "$absent"}` | `{"a": null}` | no |
| `{"a": null}` | `{}` | no, a null member must be present |

### 6.4 Arrays

An expected array holds when the actual value is an array **of the same
length**, and each element holds against the expected element at its index. For
example, `[1, "two", null]` holds against the same array, and `[1]` refuses
`[1, 2]`. An ordered subsequence is written with `$contains`.

### 6.5 Placeholders

A placeholder is `$` followed by a keyword and, for some keywords, `:` and an
argument. The keyword is the text between `$` and the first `:`, and the
argument is everything after that colon [expect.go:matchPlaceholder]. A keyword
that takes no argument ignores any argument it is given, except `$absent`: only
the exact string `"$absent"` is the member rule, and `$absent:x` fails the step.

| Placeholder | Holds when | Example that holds |
| --- | --- | --- |
| `$any` | always (in an object, the member must be present; `null` holds) | `{"a": "$any"}` against `{"a": [1, 2]}` |
| `$string` | the value is a string | `{"a": "$string"}` against `{"a": "s"}` |
| `$int` | the value is a number written as a decimal integer in the signed 64-bit range; `7.5`, `1e3` and `1.0` fail | `{"a": "$int"}` against `{"a": 7}` |
| `$number` | the value is a number | `{"a": "$number"}` against `{"a": 7.5}` |
| `$odd`, `$even` | as `$int`, and of that parity | `"$odd"` against `3` |
| `$bool` | the value is `true` or `false` | `{"a": "$bool"}` against `{"a": false}` |
| `$absent` | only as an object member (see [6.3](#63-objects)) | `{"a": "$absent"}` against `{}` |
| `$bind:name` | always; binds `name` to the value, replacing any earlier value. An empty name fails. | `{"id": "$bind:first"}` against `{"id": "c:1"}` binds `first` |
| `$not:name` | `name` is bound, and the value does not equal it. `name` is looked up whole, without dotted paths. | with `first` = `"c:1"`, `{"id": "$not:first"}` against `{"id": "c:2"}` |
| `$regex:pattern` | the value is a string, and the RE2 `pattern` (the syntax of Go's `regexp`) matches somewhere in it. The pattern is not anchored and may contain `:`. A pattern that does not compile fails the step. | `{"a": "$regex:^c:[0-9]+$"}` against `{"a": "c:12"}` |
| `$path` (any other keyword) | `path` resolves (see [6.7](#67-bindings)) and the value equals what it resolves to | with `t` = `"abc"`, `{"parent": "$t"}` against `{"parent": "abc"}` |

Within an expectation, the keywords `any`, `string`, `int`, `number`, `odd`,
`even`, `bool`, `absent`, `bind`, `not` and `regex` take precedence over a
binding of the same name. A scenario must not bind these names, and the loader
refuses one that does.

A `$path` placeholder's path is everything after the `$`, colons included, so
a path that contains `:` never resolves [expect.go:matchPlaceholder].

### 6.6 Subsequences: `$contains` and lanes

An expected object with a `$contains` member expects an array. Its other
members are ignored, except `$sequence_by` [expect.go:matchContains]:

```text
wanted  = the $contains value, which must be an array
key     = the $sequence_by value when it is a nonempty string; otherwise none
cursor  = a position per lane, each starting at 0
for each wanted element w, in order:
  lane = render(w[key]) when key is set, w is an object and w has key; else ""
  scan the actual elements from cursor[lane] onward:
    when lane is not "", skip an element that is not an object, or whose
      render(element[key]) differs from lane (a missing member renders as null)
    the first element against which w holds is taken: cursor[lane] = its index + 1
  when none is taken, the step fails
```

`render` is the canonical rendering of [7.3](#73-judging-an-answer). These
consequences follow:
- Without `$sequence_by`, the wanted elements appear in the actual array in
  order, with anything between them.
- With `$sequence_by`, order is held **within each lane**, and lanes may
  interleave. Wanted elements that lack the key share lane `""`: they are
  ordered among themselves only, and matched against every element.
- The search is greedy. It takes the first element that holds and never
  backtracks.
- A lane is compared in rendered form, so the lane member of a wanted element
  must be a literal. A placeholder there never matches, and `1` and `1.0` are
  different lanes.
- A `$bind` written while trying an element that then fails is not undone. The
  element finally taken binds every name its expectation binds again.

| Expected | Actual | Holds |
| --- | --- | --- |
| `{"$contains": [{"k": "a"}, {"k": "c"}]}` | `[{"k": "a"}, {"k": "b"}, {"k": "c"}]` | yes |
| `{"$contains": [{"k": "c"}, {"k": "a"}]}` | the same | no, the order is wrong |
| `{"$contains": [{"id": "1", "s": 1}, {"id": "2", "s": 1}, {"id": "1", "s": 2}], "$sequence_by": "id"}` | `[{"id": "2", "s": 1}, {"id": "1", "s": 1}, {"id": "1", "s": 2}]` | yes, the lanes interleave |
| `{"$contains": [{"id": "1", "s": 2}, {"id": "1", "s": 1}], "$sequence_by": "id"}` | `[{"id": "1", "s": 1}, {"id": "1", "s": 2}]` | no, lane `"1"` is out of order |

### 6.7 Bindings

- **Scope and lifetime.** Bindings belong to one case. They start empty, plus
  the row under `as` for an expanded scenario [run.go:Run]. They persist from
  step to step, and are discarded when the case ends. A mirrored run and each
  row start afresh. There is one namespace for both sides.
- **Writers.** A name is bound by `$bind:` while matching (in `expect` or
  `expect_error`), by a step's `bind`, and by the runner's own expansion. A
  later write replaces an earlier one.
- **Resolution.** A path `n.m1.m2…` resolves as follows [expect.go:resolve]:
  1. It takes the value bound to `n`.
  2. It descends into member `m1`, then `m2`, each time through an object.
  3. It does not resolve when `n` is unbound, a step meets a non-object, or a
     member is missing. Arrays cannot be indexed.
- **Unbound references.** A reference that does not resolve fails the step: in
  `args` ("the arguments refer to something unbound"), and in an expectation
  ("… refers to nothing bound").
- **Value equality.** `$path`, `$not:` and `where` compare by value equality
  [expect.go:equal]:
  - numbers compare as in [6.2](#62-literals);
  - strings, booleans and `null` compare exactly;
  - arrays have equal length and equal elements;
  - **objects have the same member names and equal values.** Unlike an
    object expectation, equality refuses extra members.
- **Order within one expectation.** Members are held in byte order, array
  elements in index order and `$contains` elements in order. A reference to a
  name bound in the same expectation must therefore come later in that order.
  `{"a": "$bind:x", "b": "$x"}` works; `{"b": "$bind:x", "a": "$x"}` does not.

### 6.8 Embedded JSON: `$json`

A raw frame arrives as a string, such as the `text` of `conn.receive`. An
expected object with a `$json` member expects a string that holds exactly one
JSON value, and holds when that value, decoded as an answer is decoded
([3.3](#33-answers)), holds against the member's expectation. Its other members
are ignored. Nothing but JSON whitespace may follow the value. An object with both
`$json` and `$contains` fails the step. Bindings and every other rule apply
inside, so a frame's members are asserted structurally rather than by a pattern
over its text.

| Expected | Actual | Holds |
| --- | --- | --- |
| `{"$json": {"kind": "response", "id": "c:1"}}` | `"{\"id\":\"c:1\",\"kind\":\"response\",\"result\":{}}"` | yes |
| `{"$json": {"kind": "response"}}` | `"{\"kind\":\"request\"}"` | no |
| `{"$json": {"traceparent": "$string"}}` | `"{\"result\":{\"traceparent\":\"x\"}}"` | no, the member is nested |
| `{"$json": {"id": "$bind:id"}}` | `"{\"id\":\"c:7\"}"` | yes, and binds `id` |
| `{"$json": "$any"}` | `"not json"` | no |
| `{"$json": "$any"}` | `5` | no, not a string |

## 7. Executing a case

### 7.1 Order

For each case [run.go:Run]:

0. **Applicability.** A case that is not applicable to the report's declared
   transports or implementation ([8.2](#82-pairings-roles-and-transports)) is
   skipped before anything runs, and so is an optional case that was not
   requested.
1. **Expansion.** The runner expands the runner steps for this pairing
   ([4.1](#41-runner-ops)). A failure to arrange the pair ends the case
   `unsupported`.
2. **Needs.** It derives each side's needs from the expanded steps
   ([5.4](#54-needs)). A side whose `hello` lacks one ends the case
   `unsupported`, as in "the X testee, on side b, lacks lazy".
3. **Reset.** It sends `reset` to each side. A failed reset is a harness
   failure.
4. **Bindings.** It initializes them ([6.7](#67-bindings)).
5. **Steps.** For each step in order:
   1. It substitutes the arguments ([5.6](#56-argument-substitution)).
   2. It sends the request to the step's side, repeating as `repeat` says
      ([7.2](#72-repeat)).
   3. A dead testee ends the case as a harness failure.
   4. It judges the last answer ([7.3](#73-judging-an-answer)). The first step
      that fails ends the case `fail`, and no later step runs.
6. **Pass.** When every step held, the case passes.

### 7.2 repeat

| `until` | Behaviour [run.go:request, run.go:Run] |
| --- | --- |
| `"ok"`, or omitted | Sends up to `max` times with no pause, stopping at the first answer that is not an error. |
| `"error"` | Sends up to `max` times with no pause, stopping at the first error answer. |
| `"match"` | Sends once, then again after 50 ms pauses while the step's expectations do not hold, up to `max` requests in all. |

The step's expectations are then held against the **last** answer, as for a
step without `repeat`.

For `until: "match"`, whether the expectations hold is tested on a copy of the
bindings, so a failed poll binds nothing [run.go:holds]:
- **error answer:** it holds only when `expect_error` exists and matches; the
  `assert` is not consulted;
- **ok answer:** it holds when `expect` (if present) matches and the `assert`
  (if present) holds. So an `ok` answer to a step that has `expect_error` and
  no `expect` holds unless its `assert` fails; holding stops the polling, and
  the judgement then fails the step.

A read-only op, such as `peer.observed`, sees what is held at that moment. A
step that expects what the far side has yet to send therefore waits with
`until: "match"`.

### 7.3 Judging an answer

| Answer | Step has | Result of the step |
| --- | --- | --- |
| error, code `unsupported` | anything | The case ends `unsupported`. This is checked first, so `unsupported` can never be expected. |
| error | no `expect_error` | fail: "the op failed" |
| error | `expect_error` | holds when `expect_error` matches the error object. `bind` is not applied, but a `$bind:` inside `expect_error` binds. |
| ok | `expect_error` and no `expect` | fail: "expected an error, the op succeeded" |
| ok | `expect` | holds when `expect` matches `ok`; then `bind` applies |
| ok | neither | holds whatever `ok` is; then `bind` applies |

With both `expect` and `expect_error`, the step holds whichever kind of answer
arrives against the expectation written for that kind.

**`assert`** is then held against the answer's rendering. For an ok answer the
rendering is `render(ok)`. For an error answer it is `error ` followed by
`render(the error object)`.
- `absent`: the text must not occur in the rendering.
- `present`: it must occur.

Either failing fails the step.

**`render`** writes JSON the way Go 1.22 and later writes it with
`encoding/json` [expect.go:render]:
- no insignificant whitespace;
- object members in ascending byte order of their names;
- numbers as spelled in the answer;
- in strings: `"` and `\` escaped; `\b`, `\f`, `\n`, `\r` and `\t` escaped;
  other control characters as `\u00XX`; `<`, `>` and `&` as `\u003c`,
  `\u003e` and `\u0026`; U+2028 and U+2029 as `\u2028` and
  `\u2029`; invalid UTF-8 as `\ufffd`.

An `assert` therefore searches this rendering, not the testee's bytes. For
example, `"absent": "\"stalled\":true"` finds `"stalled": true` in any spacing.

### 7.4 bind

`bind` applies only to an ok answer, after `expect` has held [run.go:bind]:

| `bind` | Binds |
| --- | --- |
| a name | the answer's `handle` member when the answer is an object that has one, and otherwise the whole answer (a scalar, an array, or an object without `handle`) |
| `{"member": "name", …}` | each named member of the answer to its name. The answer must be an object that has every named member (`null` counts as present); otherwise the step fails. |

A `bind` name overwrites a `$bind:` of the same name made while matching the
same answer.

### 7.5 Deadlines

These are the runner's own deadlines. Missing one makes the testee dead
([3.8](#38-a-testee-that-fails-the-exchange)).

| Request | Deadline [driver.go, run.go:request] |
| --- | --- |
| `hello`, `reset`, `bye` | 10 s each |
| a step whose substituted arguments carry an integer `within_ms` | `within_ms` + 10 s |
| any other step | 15 s |
| the second and later requests of `until: "match"` | 15 s each, whatever `within_ms` says |
| exit after `bye` | 10 s, then the process is killed |

The testee's own `within_ms` default is 5000 ms. A testee answers `timeout`
when `within_ms` passes, well before the runner's deadline.

## 8. Scopes, results and claims

### 8.1 Required cases

A case is **required** for a scope when its scenario is not `optional` and:
- for the **core** scope, its `scope` is `core`;
- for the **core-and-tunnel** scope, its `scope` is `core` or `tunnel`.

[`selection.json`](selection.json) assigns scopes to the derivatives:
- `seam` and `peer` scenarios are core;
- `tunnel` scenarios are core and tunnel;
- a scenario needing the observer is optional;
- the identity-exchange and recorder scenarios are not carried over.

The `propagator` feature is part of the core. Optional diagnostics may run, and
are then reported, but never count toward or against a claim.

Scope follows the layer because each upstream layer is exactly one conformance
area: the seam and the peer make up the core, and the tunnel is the tunnel's.
The selection states this explicitly, and overrides it where a scenario needs
the observer or has a known defect.

**Defective scenarios.** `selection.json` lists scenarios that expect more than
`bitwire/1` requires, each with its reason. They are marked
`"optional": "defect"`, run when requested, and reported, but they never count
toward or against a claim. Removing one from that list is a new
`contractDigest`.

### 8.2 Pairings, roles and transports

- **Pairings.** A report lists its pairings. The implementation under test
  paired with itself exercises both roles in each case. Paired with another
  implementation, it should run in both orders: once on side `a`, and once on
  side `b`. The claim rule ([8.4](#84-claim-rule)) requires only that the
  pairings place it on each side at least once. Edition 1 makes claims for both
  roles, client and server. A claim for a single role needs selection rules
  that edition 1 does not define.
- **Accepting connections.** A report declares whether the implementation under
  test accepts connections. When it does not, the runner reads that
  implementation's `hello` without `listen` ([4.1](#41-runner-ops)), so that
  the other side listens where a runner op lets it.
- **Transports.** Each claimed transport is a separate run with the testee
  configured for it. `url` values are opaque, and `conn.pipe` cases run in
  process under every transport.
- **Two cases are not applicable**, and the runner skips them before running:
  - a case whose steps pass a nonempty `subprotocols` argument, under a
    transport the report declares cannot negotiate subprotocols;
  - a case whose **own** steps (not a runner expansion) write `conn.listen` or
    `peer.listen` on the side of the implementation under test, when the report
    declares that the implementation does not accept connections.

  A case the runner cannot arrange because neither side can listen is
  `unsupported`, not inapplicable.

### 8.3 Result kinds

| Result | When |
| --- | --- |
| `pass` | Every step held. |
| `fail` | A step's answer parted from the scenario: the op failed with no `expect_error`, the error was not the one expected, an error was expected and none came, `expect` did not hold, `bind` named a missing member, an `assert` failed, or a reference did not resolve. |
| `unsupported` | A testee answered `unsupported`, a side lacks a derived need, or the runner could not arrange the pair. |
| `skip` | The runner did not run the case: an optional diagnostic that was not requested; a `tunnel` case under a core claim ("outside the claimed scope"); a case the run did not select ("not selected for this run"); or a case that is not applicable ([8.2](#82-pairings-roles-and-transports)). The reason is recorded. Only a skip as not applicable can leave a claim supported. |
| `harness` | The exchange or the harness failed rather than the scenario's expectations: a dead testee ([3.8](#38-a-testee-that-fails-the-exchange)), a failed `reset`, a `hello` without driver 1, or a testee that could not be built or started. |

### 8.4 Claim rule

A claim for a scope is **supported** when every required case passed, in every
pairing and order the report lists and under every transport the claim names.
The report must list at least one pairing that places the implementation under
test on side `a` and one that places it on side `b` (pairing it with itself
does both); a report with no pairing supports nothing.
A required case may also be skipped as not applicable; the claim then names
that limitation. Any other result on a required case (`fail`, `unsupported`,
`harness`, or a skip for any other reason) means the claim is **not supported**
(compare [profiles.go:Matrix.Verdict]).

Passing a finite suite supports a claim. It does not prove that every
requirement was exercised
([SCOPE.md](../../protocol/bitwire-1/SCOPE.md#evidence-and-conformance-tooling)).

## 9. Reports

A report is one JSON object per claim run. It records what
[`SCOPE.md`](../../protocol/bitwire-1/SCOPE.md#evidence-and-conformance-tooling)
requires, with these members:

| Member | Content |
| --- | --- |
| `protocol` | `{"revision": "bitwire/1", "normativeDigest"}` |
| `scope` | `"core"`, or `"core and tunnel"`. (A scenario's `scope` names the area it tests, `core` or `tunnel`; a claim's names the conformance scope.) |
| `roles` | `["client", "server"]` in edition 1 |
| `transports` | For each claimed transport: its name, how the testee was configured for it, and whether it negotiates subprotocols |
| `configuration` | The implementation's configuration where it departs from the default bounds, or `"default"`. Whether it accepts connections (`listen`). |
| `implementation` | The implementation under test: name, release or version, source revision, digests of the artifacts run, language and toolchain, the testee command as run (its argv, working directory and the environment it adds), and its `hello` answer |
| `counterparts` | The same, for every other implementation in a pairing |
| `pairings` | Each ordered pairing run |
| `runner` | The runner's name, version and source revision |
| `contract` | `{"edition": 1, "contractDigest"}` |
| `evidence` | `{"evidenceDigest"}`, and whether optional diagnostics were requested |
| `cases` | One entry per case (below) |
| `claim` | `supported` or `not supported`, the counts per result kind over required cases, and the limitations named under [8.4](#84-claim-rule) |

Each **case entry** records:
- `id`: `<layer>/<expanded name>`, with a row label and any ` (mirrored)`
  suffix;
- the scenario's path under `conformance/protocol/` and its SHA-256;
- `scope`, and `optional` when present;
- the pairing and transport;
- `result`, one of the five kinds, and a `reason` for every result except
  `pass`.

A `fail` or `harness` entry adds:
- the failing step: its index in the scenario, and its position within the
  runner op's expansion when the step came from one;
- its `op` and side;
- the substituted request;
- the rendered answer;
- both sides' stderr since the last reset [run.go:Failure].

A harness failure at `reset` names no step; its reason names the testee.

The time and platform of the run may be added.

## 10. Differences from upstream

Each difference narrows, clarifies or adds to what the upstream runner does.
**None changes the driver-1 exchange.** A testee that serves the upstream
runner for these ops serves an edition-1 runner unchanged, and answers `hello`
with `"driver": 1`.

| # | Upstream (`DRIVER.md`, runner code) | Edition 1 | Kind |
| --- | --- | --- | --- |
| 1 | Defines `peer.identity`, `peer.check_identity`, `peer.recorded_wire_witness`, `live.*`, `gen.*`, `client.*`, `server.*`, the `through` behaviour and the non-normative tables | Excluded ([4.5](#45-excluded-ops-and-arguments)) | Narrowing |
| 2 | The observer is required of tier-1 languages [profiles.go:HoldToTier] | `peer.observed`, `observe` and `families` are optional diagnostics that support no claim ([4.6](#46-optional-the-observer)) | Narrowing |
| 3 | `profiles.json`: tiers, a reference language (Go), and placement of `propagator` scenarios in "observability" [profiles.go:Place] | No tiers, no reference implementation; claims by scope. Only `observer` makes a scenario optional, and `propagator` is core ([8.1](#81-required-cases)). | Narrowing |
| 4 | Scenarios name no protocol identity or scope; five layers; `foreach` tables under upstream `conformance/` | `protocol`, `scope` and `source` (for derivatives) are required, and `optional` is added. Layers are seam, peer and tunnel. `foreach` is restricted to the three normative tables in the bundle. A scenario naming another identity is refused. ([5.1](#51-members)) | Addition |
| 5 | `conn.listen` and `peer.listen` accept a WebSocket | The testee's configured transport; `url` is opaque; transport capabilities are declared per report ([8.2](#82-pairings-roles-and-transports)) | Clarification |
| 6 | Outcomes are only skipped or failed [run.go:Outcome]. A reset failure is reported as step 0 with no op. An unavailable testee is a skip. | Five result kinds, including `unsupported` and `harness`; applicability rules ([8.3](#83-result-kinds)) | Addition |
| 7 | `matrix.json` holds counts per language and profile [profiles.go:Matrix.Write] | A per-case report with the identities that [`SCOPE.md`](../../protocol/bitwire-1/SCOPE.md#evidence-and-conformance-tooling) requires ([section 9](#9-reports)) | Addition |
| 8 | A dead testee is replaced without being terminated [suite.go:run] | The runner terminates it ([3.8](#38-a-testee-that-fails-the-exchange)) | Clarification |
| 9 | Documented only in runner code: the matching language, reading a missing `ok` as `{}`, runner deadlines, what an omitted `until` means, the `$$` escape, `where` equality | Stated in sections 3 to 7 exactly as the runner behaves | Clarification |
| 10 | `DRIVER.md` lists `cancelled`, `request_timeout` and `disconnected` as answer error codes, and omits `failed` | `cancelled` and `request_timeout` are `call.await` outcomes inside `ok`; `disconnected` is both a call outcome and a top-level error of `peer.emit`, `peer.await_event` and `tunnel.*`; `failed` is the code of a broken or unreachable transport ([3.4](#34-error-codes)) | Clarification |
| 11 | `DRIVER.md` says payloads pass unchanged | The runner's re-serialization is stated ([3.7](#37-values-waiting-and-consumption)) | Clarification |
| 12 | The Go runner reads member names in any capitalization and ignores trailing data | Exact names, nothing after the object ([3.3](#33-answers)) | Narrowing |
| 13 | The layer and op-family rule is held in a test [scenario_test.go:allowedAcross]; scope, observer marking and excluded ops are not checked | Load checks ([5.5](#55-loading)) | Addition |
| 14 | No notion of a defective scenario | `"optional": "defect"` for scenarios that over-specify, listed with reasons in `selection.json` ([8.1](#81-required-cases)) | Addition |
| 15 | No applicability step, and no minimum pairings for a claim | Applicability before expansion ([7.1](#71-order)); both orders required ([8.4](#84-claim-rule)) | Addition |
| 16 | `DRIVER.md` lists `peer.await_close` codes 1000, 4011, 1006 and the remote's | Adds 1009 where the receiver refused a frame over its limit, which `SCOPE.md` binds ([4.3](#43-peer-peer-call-core)) | Clarification |
| 17 | An argument named `id` or `op` overwrites the request's own member [driver.go:Testee.Request] | Refused at load; the runner's own members are sent ([3.2](#32-requests)) | Narrowing |
| 18 | A binding may shadow a keyword and can then never be referenced | Refused at load ([6.5](#65-placeholders)) | Narrowing |
| 19 | `DRIVER.md` does not say whether an op's `method`, `event` or `name` is a plain name or a path; the upstream testees registered plain names | A one-segment path, carried canonically; a reserved vocabulary name stays plain ([4.3](#43-peer-peer-call-core)). One archived scenario that needs a plain name served is a known defect. | Clarification |
| 20 | Raw frames are matched by patterns over their text | `$json` asserts a string's JSON value structurally ([6.8](#68-embedded-json-json)) | Addition |

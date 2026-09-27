# Full-tree composition across carriers

These independent cases exercise the 0.3 contract of
[decision 0012](../../docs/decisions/0012-explicit-data-and-wire-trees.md) where
it matters to consumers. They cover `WireTree = DeixisNode<Wire>` built,
selected, decomposed and rebuilt locally, then exposed through the unchanged
`bitwire/1` addressed carrier, then composed across real carriers. They are
identified separately from the historical
[declared cases](../declared/README.md), which stay byte-identical with their gap
ledgers. [`disposition.json`](disposition.json) maps every historical observation
onto these cases or onto an explicit historical addressed limitation.

Run them with the released-runtime gate:

```console
node scripts/conformance-runtime.mjs
```

The oracle is [`cases.json`](cases.json). Its expectations were written from the
[contract](../../docs/wire/contract.md), decision 0012 and the `bitwire/1`
profile. They were not recorded from an implementation.

The runner gives each driver its inputs with every expectation withheld and with
keys already in hex. It compares complete observations itself: missing, extra,
duplicate and mismatched rows fail.

`node --test scripts/wiretree.test.mjs` needs no network and is part of
`node scripts/check.mjs`. It checks the notation, the withheld inputs, the
comparison and the disposition's coverage.

## What the cases observe

| Observation | Meaning |
| --- | --- |
| `["delivered", name, n]` | The named primitive admitted a message. It is that instance's nth admission. |
| `["refused"]` | The selected node's own primitive was invoked and refused. The primitive records this itself. |
| `["missing"]` | Selection found no node, no primitive was invoked, and the derived send was refused. |
| `["unreached"]` | The addressed bridge refused without invoking any primitive. |
| `["error", code]` | Across a carrier, the request was answered with that `bitwire/1` error code. |
| `partsExact` | Every construction returned exactly its own value and children. This held through `children()` and `decompose()`, and after the caller's input, keys and returned parts were altered. |
| `unchanged` | Every delivered message kept its frame and its own return capability. |
| `sendOnly` | The bridge exposed no receive, close, own, children, selection or decomposition. |
| `borrowedUsable` | After the dispatcher, the relay's forwarding and the addressed mount were all released, every carrier still delivered. |

A driver records any other outcome under its own name, such as `fallback`,
`refusedWithoutOwn` or `selectionDiffers`. That fails the case.

## Three kinds of evidence

| Family | What it establishes | How it runs |
| --- | --- | --- |
| `structure`, 19 cases | Covers, among others: <ul><li>own capability identity;</li><li>exact byte keys: empty, binary, U+FFFD, the literal `a/b` and both spellings of é;</li><li>complete children, and missing versus a present node whose own refuses;</li><li>the selection law, including chains that fail part-way;</li><li>both reconstruction directions and complete cuts;</li><li>retained and reset primitive state, substitution and alteration;</li><li>an acyclic child implemented outside the runtime;</li><li>construction refusing duplicate keys, missing children and cycles.</li></ul> | No carrier |
| `bridge`, 1 case | The explicit mapping to the unchanged carrier surface: <ul><li>the exact UTF-8 image;</li><li>refusal of an ill-formed segment before any primitive, including one that lossy decoding would turn into U+FFFD or the byte `ff`;</li><li>unreachable binary keys;</li><li>send-only access.</li></ul> | `AsAddressed`/`asAddressed`, no carrier |
| `carrier`, 7 cases | Full trees composed across bitruntime carriers, as described in [the test model](#the-carrier-test-model) below | The local pair; real WebSockets with the client sending; real WebSockets with the server sending |

Two realizations run every case in Go and TypeScript:
- **production** uses bitruntime's released `Compose`/`compose`,
  `Select`/`select`, `Send`/`send` and `AsAddressed`/`asAddressed`;
- **reference** is a test-only interpreter that shows the oracle can be met. It
  is never evidence about a runtime.

Carriers, dispatchers, `Forward`, `Mount` and `At` are always bitruntime's.

## The carrier test model

This section describes how the drivers compose trees across carriers. **It is a
test model, not part of the contract.** Remote structural discovery is not
specified.

The far side serves its tree through a bitruntime dispatcher that borrows the
endpoint. There is one exact route for every position whose keys are UTF-8, and
each route is bound to that position's own Wire. The near side declares the same
structure, and each of its own Wires sends at the corresponding far path. So the
near tree's `own`, `children`, selection and reconstruction are local, and the
carrier sees only paths.

Two facilities carry the model:

- **binding**: an addressless `Wire` that sends at one fixed `AddressedWire`
  path, copied when bound;
- **serving**: one exact dispatcher route for each position whose keys are
  UTF-8, bound to that position's own. Serving is replaced when the far tree is
  edited and released at teardown.

The production realization uses bitruntime's public facilities, released in
v0.3.0 for [bitruntime#15](https://github.com/Bitspark/bitruntime/issues/15):
`core.Bind` and `dispatch.Serve` in Go, `bind` and `serve` in TypeScript,
with `Update`/`update` for replacement and `Close`/`close` for teardown. The
reference realization uses test-only adapters that call only public
bitruntime API. Its replacement re-registers every route, which is not atomic;
bitruntime's replaces the routes in one step. So the production carrier results
are evidence that bitruntime's released binding and serving compose lawfully
with its carriers, dispatcher and trees.

The cases state what follows from this model:

- **The served tree has a nonempty prefix.** `bitwire/1` refuses a request at a
  peer root's empty path, so the far tree is served under `servedAt` (`["t"]`).
  An addressed request at `[]` is refused at admission.
- **A carrier path names a position, not a node.** Addressed access cannot
  reveal that two far positions share a node, so the near tree binds each
  position. If the far side replaces one of two positions that shared a node,
  the other position still reaches the original.
- **Missing and refusing stay distinct.**
  - A near path that does not exist is missing, and nothing is sent.
  - A far path without a route is answered `method_not_found` by the
    dispatcher. That is the profile's code for "no handler".
  - A far node whose own refuses records its refusal, and the request is
    answered `internal`. That is the profile's code for a handler that failed
    with a non-public error. It arises because serving answers a refused request
    with its refusal. bitruntime's `Serve` answers through `core.Respond` /
    `respond`, as `internal` unless the refusal is a public error. The reference
    adapter does the same in Go; in TypeScript it lets the error fail the
    receiver, and the carrier answers it. A refused event is dropped in both.
  - A binary key cannot be named over the carrier at all.
- **Captured cancellation survives replacement.**
  - The dispatcher captures each request's traversal on its invocation. After
    the far node that admitted a request is replaced and re-served, the
    requester's cancel frame, sent through the same near position, reaches the
    original node and not its replacement.
  - A late reply from the original node reaches the original return capability,
    even after the serving composition was torn down.

`method_not_found` and `internal` are defined in the pinned
[profile](https://github.com/Bitspark/nightseam/blob/5cc9723a24646c40ed1861f892b2b23eb6d785d7/docs/wire/profile.md).

## Unlawful realizations are rejected

The TypeScript driver also runs deliberately unlawful realizations. The runner
requires each to fail the case aimed at it:

| Realization | Violation | Must fail |
| --- | --- | --- |
| `fallback` | A missing descendant is sent to its nearest ancestor. | `missing-never-falls-back` |
| `wrapping-own` | The own capability is replaced by a forwarding wrapper. | `root-cut-reconstruction` |
| `normalizing` | UTF-8 keys are NFC-normalized. | `own-and-descendants` |
| `fabricating` | A missing path selects a fabricated refusing node. | `refusing-versus-missing` |
| `latin1-bridge` | The bridge names byte key `ff` with `"ÿ"`. | `bridge-exact-utf8-image` |
| `lossy-bridge` | The bridge encodes a lone surrogate as U+FFFD. | `bridge-exact-utf8-image` |
| `incomplete-children` | `children()` omits the empty key. | `own-and-descendants` |
| `retargeting-serve` | The far side routes by the tree that is current at delivery. | `carrier-cancel-across-replacement` |

## Disposition of the declared cases

[`disposition.json`](disposition.json) pins the historical fixture and both gap
ledgers by SHA-256. A changed historical file fails `scripts/check.mjs` until the
disposition is revisited.

**37 of the 39 cases have current counterparts:** `structure`, `bridge` or
`carrier` cases.
- Several meanings are sharpened. A path the addressed interpretation answered
  with a refusal is now *missing*, while a present node whose own refuses stays
  *refused*.
- Each row whose meaning changed says so.

**10 cases keep a historical addressed part:**
- *suffix delivery* (6 cases): an opaque child received the rest of the path. In
  a full tree that path is missing, and suffix delivery survives only as
  AddressedWire prefix binding.
- *path-observing interception* (4 cases): guards saw descendant paths, which an
  own Wire never does.
- *addressed views* (1 case).

Two of these cases have nothing else: `guard-around-composite` and
`guarded-child-complete-access`.

**The 19 recorded gaps:**
- The origin-bearing construction gap (16 cases) and the conflicting and
  missing-child gaps are met structurally by public `Compose`/`compose`. The
  origin-bearing gap's carrier members are met through the test-only adapters
  above.
- The invalid-segment gap changed meaning: no tree key is invalid, and the bridge
  refuses ill-formed segments.
- The ledger entries stay accurate about the addressed `Mount`, which is a
  child-only routing operator, not tree construction.

**The two recorded limitations:**
- Endpoint-typed children are dissolved: tree children are nodes with a
  send-only own.
- Owner-retained parts are superseded by public decomposition. A caller that must
  not see structure receives the bridge instead.

## Limits

- **Languages:** only Go and TypeScript run. The other six languages have
  declarations, not runtimes. The unlawful realizations are TypeScript only.
- **Schedules:** they are serial, and the carriers are connected, ordered and
  fault-free.
- **Carrier behavior:** concurrency, faults, backpressure and closure codes
  belong to the carrier contract,
  [#54](https://github.com/Bitspark/bitwire/issues/54).
- **Invocation retirement:** [#20](https://github.com/Bitspark/bitwire/issues/20).
- **Received-context evidence:**
  [#55](https://github.com/Bitspark/bitwire/issues/55).
- **Consumer acceptance:**
  [bitsystem3#11](https://github.com/Bitspark/bitsystem3/issues/11) and
  [bittree#53](https://github.com/Bitspark/bittree/issues/53).

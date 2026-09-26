# Full-tree composition across carriers

These independent cases exercise the 0.3 contract of
[decision 0012](../../docs/decisions/0012-explicit-data-and-wire-trees.md) where
it matters to consumers: `WireTree = DeixisNode<Wire>` built, selected,
decomposed and rebuilt locally, exposed through the unchanged `bitwire/1`
addressed carrier, and composed across real carriers. They are separately
identified from the historical [declared cases](../declared/README.md), which
stay byte-identical with their gap ledgers.
[`disposition.json`](disposition.json) maps every historical observation onto
these cases or onto an explicit historical addressed limitation.

Run them with the released-runtime gate:

```console
node scripts/conformance-runtime.mjs
```

The oracle is [`cases.json`](cases.json). Its expectations were written from the
contract, decision 0012 and the `bitwire/1` profile. They were not recorded from
an implementation. The runner gives each driver its inputs with every expectation
withheld and keys already converted to hex. It compares complete observations
itself: missing, extra, duplicate and mismatched rows fail.
`node --test scripts/wiretree.test.mjs`, part of `node scripts/check.mjs`, checks
the notation, the withheld inputs, the comparison and the disposition's
coverage. It needs no network.

## Three kinds of evidence

| Family | What it establishes | How it runs |
| --- | --- | --- |
| `structure`, 18 cases | Own capability identity, exact byte keys (empty, binary, the literal `a/b`, both spellings of é), complete children, missing versus a present node whose own refuses, selection chains, both reconstruction directions, complete cuts, retained and reset primitive state, substitution, alteration, and construction refusing duplicate keys, missing children and cycles | No carrier. Every construction also checks that neither the caller's input nor returned parts can change the tree. |
| `bridge`, 1 case | The explicit mapping to the unchanged carrier surface: the exact UTF-8 image, refusal of ill-formed segments before any primitive, unreachable binary keys, send-only access | `AsAddressed`/`asAddressed`, no carrier |
| `carrier`, 7 cases | A far tree served on an endpoint and a near tree whose own Wires are bound to carrier paths: routing, reconstruction on either side, a relay through `Forward`, access through an addressed `Mount`, a late reply and a requester's cancellation after the far node was replaced, teardown | On the local pair, and on real WebSockets with the client sending and with the server sending |

Two realizations run every case in Go and TypeScript. **production** uses
bitruntime's released `Compose`/`compose`, `Select`/`select`, `Send`/`send` and
`AsAddressed`/`asAddressed`. **reference** is a test-only interpreter that shows
the oracle can be met. It is never evidence about a runtime. Carriers,
dispatchers, `Forward`, `Mount` and `At` are always bitruntime's.

## The carrier model

The far side serves its tree through a bitruntime dispatcher that borrows the
endpoint. It registers an exact route for every node whose keys are UTF-8, and
each route is bound to that node's own Wire. The near side declares the same
structure. Each of its own Wires sends at the corresponding far path, so the
near tree's `own`, `children`, selection and reconstruction are local. The
carrier sees only paths.

Four observations follow, and the cases state each one:

- **The served tree needs a nonempty prefix.** `bitwire/1` refuses a request at
  a peer root's empty path. The far tree is served under `servedAt` (`["t"]`),
  and an addressed request at `[]` is refused at admission.
- **A carrier path names a position, not a node.** Addressed access cannot
  reveal that two far positions share a node. The near tree therefore binds each
  position separately. When the far side replaces one of two positions that
  shared a node, the other position keeps reaching the original node.
- **Missing and refusing stay distinct, as profile outcomes.** A path absent
  from the near tree is missing locally and sends nothing. A far path with no
  node answers `method_not_found`. A far node whose own refuses answers
  `internal`. Both codes come from the
  [pinned profile](https://github.com/Bitspark/nightseam/blob/5cc9723a24646c40ed1861f892b2b23eb6d785d7/docs/wire/profile.md).
  A binary key outside the UTF-8 image cannot be named over the carrier at all.
- **Captured cancellation survives replacement.** The dispatcher captures each
  request's traversal on its invocation. After the far node that admitted a
  request is replaced and re-served, the requester's cancel frame, sent through
  the same near tree position, reaches the original node and not its
  replacement. A late reply from the original node reaches the original return
  capability.

Two adapters in the drivers are **test-only**. bitruntime v0.2.0 has no public
facility for either, and
[bitruntime#15](https://github.com/Bitspark/bitruntime/issues/15) tracks them:

- `bind`: an addressless `Wire` that sends at one fixed `AddressedWire` path;
- `serve`: exact dispatcher registration of a tree's UTF-8 nodes, each bound to
  its node.

Everything the adapters call is public bitruntime API. The carrier results are
therefore evidence that bitruntime's carriers, dispatcher and trees compose
lawfully. They are not evidence of a shipped serving or binding API.

## Unlawful realizations are rejected

The TypeScript driver also runs deliberately unlawful realizations. The runner
requires each one to fail at least one case:

| Realization | Violation | Rejected by, among others |
| --- | --- | --- |
| `fallback` | A missing descendant is sent to its nearest ancestor | `missing-never-falls-back` |
| `wrapping-own` | The own capability is replaced by a forwarding wrapper | every identity and reconstruction case |
| `normalizing` | UTF-8 keys are NFC-normalized | construction of the two spellings of é |
| `fabricating` | A missing path selects a fabricated refusing node | `refusing-versus-missing` |
| `latin1-bridge` | The bridge names byte key `ff` with `"ÿ"` | `bridge-exact-utf8-image` |
| `incomplete-children` | `children()` omits the empty key | every `structure` render |
| `retargeting-serve` | The far side routes by the tree current at delivery | `carrier-cancel-across-replacement` |

## Disposition of the declared cases

[`disposition.json`](disposition.json) pins the historical fixture and both gap
ledgers by SHA-256. A changed historical file fails `scripts/check.mjs` until
someone revisits the disposition. The mapping:

- **37 of the 39 cases** have current `structure`, `bridge` or `carrier`
  counterparts. Several meanings are sharpened: a path that the addressed
  interpretation answered with a refusal is now *missing*, while a present node
  whose own refuses stays *refused*.
- **10 cases** keep a historical addressed part. Two of them have nothing else:
  `guard-around-composite` and `guarded-child-complete-access`. The reasons,
  recorded as limitations:
  - *suffix delivery* (6 cases): an opaque child received the rest of the path.
    In a full tree that path is missing, and suffix delivery survives only as
    AddressedWire prefix binding.
  - *path-observing interception* (4 cases): guards saw descendant paths, but an
    own Wire never sees a path.
  - *addressed views* (1 case): at(guard, [k]) produced an addressed view that
    repeated the guard's check when composed again.
- **The 19 recorded gaps:**
  - The origin-bearing construction gap (16 cases) and the conflicting and
    missing-child gaps are met structurally by public `Compose`/`compose`.
  - Invalid segments changed meaning: no tree key is invalid, and the bridge
    refuses ill-formed segments.
  - The ledger entries stay accurate about the addressed `Mount`, which is a
    child-only routing operator, not tree construction.
- **The two recorded limitations:**
  - Endpoint-typed children are dissolved: tree children are nodes with a
    send-only own.
  - Owner-retained parts are superseded by public decomposition. A caller that
    must not see structure receives the bridge instead.

## Limits

Only Go and TypeScript run. The other six languages have declarations, not
runtimes. The schedules are serial, and the carriers are connected, ordered
and fault-free. Concurrency, faults, backpressure and closure codes belong to
the carrier contract
([#54](https://github.com/Bitspark/bitwire/issues/54)). Invocation retirement
is [#20](https://github.com/Bitspark/bitwire/issues/20), and received-context
evidence is [#55](https://github.com/Bitspark/bitwire/issues/55). Remote
structural discovery is not specified. A near tree is declared, never inferred
from an opaque router. Consumer acceptance belongs to
[bitsystem3#11](https://github.com/Bitspark/bitsystem3/issues/11) and
[bittree#53](https://github.com/Bitspark/bittree/issues/53).

# Bitwire's public seam

The evidence base for [the poster](index.html). Every technical claim cites
`path:line` at commit `02846d5` (main, 2026-09-24). A refinement run re-derives
these facts before changing the page.

## What the repository ships

Bitwire is a **multi-language surface** over one written contract. It ships
**declarations only**: no endpoint runtime, carrier, codec or generator.

- "One contract for access through relative paths." `README.md:6`
- It defines "the interface between a model's generated adapters and the
  runtime that carries its interactions." `README.md:8-11`
- "No production endpoint runtime is included." `README.md:22`
- The TypeScript package "provides declarations and an empty JavaScript entry
  point. It does not implement endpoints, queues, transports or generated
  adapters." `wire/ts/README.md:50-52`
- The Go package has "no endpoint implementation". `wire/go/README.md:111`
- "No generator or transport is a dependency of the contract packages."
  `README.md:108-109`; packages have no runtime dependency on another Bitspark
  repository. `COLLABORATION.md:27-28`

It is not a library you call for behavior, not an engine and not an executable.
Its value is the shared meaning of a tiny interface, plus independent cases that
hold implementations (today Nightseam's) to it.

## The interface

TypeScript presentation, `wire/ts/src/index.ts`:

| Declaration | Shape | Cite |
| --- | --- | --- |
| `Path` | `readonly string[]` | `wire/ts/src/index.ts:10` |
| `Wire` | `send(path: Path, message: Message): void` | `wire/ts/src/index.ts:89-91` |
| `Endpoint extends Wire` | `receive(receiver: Receiver): () => void`; `close(code?: number, reason?: string): void` | `wire/ts/src/index.ts:100-103` |
| `Receiver` | `message?: (path, message) => void \| Promise<void>`; `closed?: (code, reason) => void` | `wire/ts/src/index.ts:78-81` |
| `Message` | `frame: ProfileFrame`; `return?: ReturnAddress` | `wire/ts/src/index.ts:69-72` |
| `ReturnAddress` | `wire: Wire` | `wire/ts/src/index.ts:59-61` |
| `ProfileFrame` | `version: 1`; `kind` request/response/event/cancel | `wire/ts/src/index.ts:36-49` |
| `ProfileError` | `code`, `message`, `data?` | `wire/ts/src/index.ts:23-27` |

Go presentation, `wire/go/wire.go`: `Wire.Send(path []string, message Message) error`
(`:80-82`); `Endpoint` adds `Receive(receiver Receiver) (detach func(), err error)`
and `Close(code Code, reason string) error` (`:89-93`); `ReturnAddress{Wire Wire}`
with stable pointer identity (`:51-56`); `Message{Frame, Return}` (`:62-65`);
`Receiver{Message, Closed}` (`:70-73`); `ProfileFrame` keeps payloads as
`json.RawMessage`, nil meaning absent and `null` meaning present JSON null (`:32-49`).

Contract summary table: `docs/wire/contract.md:11-15`.

### Capability split

- "`Wire` contains only Send. `Endpoint` extends Wire with Receive and Close.
  Passing Wire access does not require receiver or closure authority."
  `docs/wire/contract.md:17-19`
- Enforced attenuation needs a send-only facade; "a static type alone does not
  hide extra operations on an underlying object." `docs/wire/contract.md:19-21`,
  `docs/decisions/0002-delivery-dispatch-and-ownership.md:107-112`
- "A return address holds Wire access." `docs/wire/contract.md:20-21`; replying
  needs no control over the return endpoint. `docs/decisions/0002-delivery-dispatch-and-ownership.md:87-88`

### Paths

- A path is "a sequence of opaque Unicode scalar strings. There is no separator
  parsing, normalization or permission inheritance. `[]`, `[""]`, `["a/b"]` and
  `["a", "b"]` are different paths." `docs/wire/contract.md:38-41`
- Canonically equivalent Unicode spellings stay different. `docs/wire/contract.md:41-43`;
  `"\u00e9"` (precomposed) and `"e\u0301"` (combining accent) are different keys; `"a/b"` is one key.
  `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:289-291`
- Selection prepends its prefix to sent paths; a receiving view removes it from
  delivered paths. Mounting uses exactly one segment and removes it on delegation.
  The empty string is a valid child key; the mount has no destination at `[]`.
  `docs/wire/contract.md:45-50`
- Path validity is not a destination promise; Nightseam's profile refuses an
  empty request/event path at a peer root. `docs/wire/contract.md:53-57`

### Frames (the message vocabulary)

| Kind | Required | Optional |
| --- | --- | --- |
| Request | id, JSON params | trace fields, string metadata |
| Response | id, exactly one of JSON result or public error | trace fields |
| Event | JSON data | trace fields, string metadata |
| Cancel | id | trace fields |

`docs/wire/profile.md:12-17`. The Wire path is the operation name; frames have no
second name; all frames are version 1. `docs/wire/profile.md:19-23`. Absence and
JSON `null` differ; no silent coercion. `docs/wire/profile.md:25-32`.

## Behavioral rules (trust-critical)

1. **Send is admission, not completion.** "Send completes on admission or
   refusal; it does not await a response or execute destination application code
   on the sender's stack." `docs/wire/contract.md:61-65`; `wire/ts/src/index.ts:84-88`
2. **One receiver per endpoint.** "A second attachment is refused without
   replacing the first." No matching-path argument; delivery is not broadcast.
   `docs/wire/contract.md:67-71`. Attaching to a closed endpoint is refused; close
   notifies at most once. `docs/wire/contract.md:75-77`. Detach is idempotent.
   `docs/wire/contract.md:86-90`
3. **Routing policy lives above the primitive.** Exact/prefix matching,
   precedence and duplicates belong to a dispatcher; sibling views share it.
   `docs/wire/contract.md:79-84`; diagram `docs/decisions/0002-delivery-dispatch-and-ownership.md:127-132`
4. **Callback return is not invocation completion**; no generic terminal signal.
   `docs/wire/contract.md:92-93`. Invocation-aware dispatchers must use the
   profile's explicit lifecycle and refuse unmanaged invocations.
   `docs/wire/contract.md:106-112`, `docs/decisions/0003-public-invocation-lifecycle.md:21-27`
5. **Composition allocates nothing new.** "Selection and mounting create no new
   peer, channel, request correlation or message queue." `docs/wire/contract.md:152-156`
6. **Messages are passed, not rebuilt.** Composition must retain return
   capability identity (`docs/wire/contract.md:205-207`) and must not reconstruct
   a message from visible fields (`docs/wire/contract.md:216-218`). Contents stay
   immutable after admission. `docs/wire/contract.md:223-226`
7. **Local capabilities never cross a hop.** "Only profile fields cross a
   physical hop. Local capability objects and received context are never
   serialized." `docs/wire/contract.md:228-229`
8. **Borrowing is not owning.** A mount owns its attachments, not its children;
   closing it leaves children usable. `docs/wire/contract.md:236-240`,
   `docs/wire/contract.md:145-147`
9. **Metadata is not proof.** A caller-supplied context field does not establish
   verified context; Bitwire defines no authentication. `docs/wire/contract.md:218-221`

## Laws

```text
at(w, [])                  ≃ w
at(at(w, a), b)            ≃ at(w, a ++ b)
at(mount({k: w}), [k])     ≃ w    (routing and message observations)
```

`docs/wire/contract.md:136-140`; `README.md:52-55`. Equivalence means equal
routing, delivered relative paths, frame meaning, capability identity and
context, including admission/refusal; not the same language object.
`docs/wire/contract.md:142-146`. "Runtime implementations supply `at` and
`mount`; Bitwire's independent cases check their observable behavior."
`README.md:57-58`. A send-only selection "needs only the underlying Wire and a
prefix"; a receiving selection needs the shared dispatcher.
`docs/decisions/0002-delivery-dispatch-and-ownership.md:140-143`

## Declared composites (decision 0006)

- A composite's own value is its **origin**, the behavior at `[]`; each named
  child is complete Wire access, delegated unchanged. `docs/wire/contract.md:160-165`
- ```text
  send(compose(o, m), [],    x) = o(x)
  send(compose(o, m), k : p, x) = send(m[k], p, x)   when k ∈ dom m, else refused
  mount(m) ≃ compose(refuse, m)
  ```
  `docs/wire/contract.md:167-173`
- "The origin is never a fallback for a missing child." `docs/wire/contract.md:178-179`
- Construction refuses a missing origin/child, a segment outside the UTF-8 image
  and duplicates; it copies inputs. `docs/wire/contract.md:176-178`
- `parts` belongs to the construction owner; a send-only Wire gains no
  enumeration or unwrapping; an arbitrary Wire is not decomposable.
  `docs/wire/contract.md:184-186`; behavior may reveal which routes respond, never the retained assembly.
  `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:264-271`
- Guards are access composed around a node, not part of it.
  `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:394-417`
- Full law set S0–S3, O, R0, R1, M, H, A, V:
  `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:305-323`
- Relation to Deixis `Node[T] = T × FinMap[Bytes, Node[T]]`:
  `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:186-188`

## The eight doors

| Language | Consumer coordinate | Import | Cite |
| --- | --- | --- | --- |
| Go | `go get github.com/Bitspark/bitwire@v0.2.0` | `github.com/Bitspark/bitwire/wire/go` (package `wire`) | `wire/go/README.md:83-84,102`; `docs/languages.md:11` |
| TypeScript | `npm install @bitspark/bitwire@0.2.0` | `@bitspark/bitwire` | `wire/ts/README.md:29,33`; `wire/ts/package.json:2-3` |
| Python | `bitspark-bitwire==0.2.0` on PyPI | `bitwire` | `docs/languages.md:13,41`; `wire/py/pyproject.toml:6-7` |
| Rust | `bitwire = { package = "bitspark-bitwire", version = "0.2.0" }` | `bitwire` | `wire/rs/README.md:25-28` |
| Swift | `.package(url: "https://github.com/Bitspark/bitwire.git", exact: "0.2.0")` | `Bitwire` | `wire/swift/README.md:34-37`; `Package.swift:7` |
| C++ | `find_package(Bitwire 0.2 CONFIG REQUIRED)`, `Bitwire::wire` | `<bitwire/wire.hpp>` | `wire/cpp/README.md:71-74`; `docs/languages.md:16` |
| Java | `dev.bitspark:bitwire:0.2.0` | `dev.bitspark.bitwire` | `wire/java/pom.xml:6-8`; `docs/languages.md:17` |
| Haskell | Git tag `v0.2.0`, `subdir: wire/hs` (Hackage deferred) | `Bitwire` | `wire/hs/README.md:36-44`; `docs/languages.md:65-66` |

Native method spellings: Rust `wire/rs/src/lib.rs:129-144`, Python
`wire/py/src/bitwire/__init__.py:125-150`, Swift
`wire/swift/Sources/Bitwire/Wire.swift:117-131`, C++
`wire/cpp/include/bitwire/wire.hpp:74-86`, Java
`wire/java/src/main/java/dev/bitspark/bitwire/Wire.java:19`,
`.../Endpoint.java:14,26`, Haskell `wire/hs/src/Bitwire.hs:130-142`.

Which door is authoritative: the written contract is normative
(`docs/languages.md:95`); Go and TypeScript were the initial declarations and
the only ones with executed behavioral evidence (`docs/languages.md:78-82`,
`conformance/declared/README.md:84-85`). The other six carry the documented
obligations. Release: 0.2.0, 2026-09-21 (`CHANGELOG.md:29`), commit
`616a2fc5` (`docs/languages.md:32-33`); all eight have verified public delivery
evidence (`docs/languages.md:36-45`).

## Verified interactions

- Go, in-repo and executed by `go test`: a function type implements send-only
  Wire, is placed in a `ReturnAddress`, and sends an event; `// Output: [result] event`.
  `wire/go/wire_test.go:10-28`
- TypeScript, written for the poster and compiled (tsc strict,
  `exactOptionalPropertyTypes`) against `wire/ts/src/index.ts`, then run: a
  three-line send-only `at` over any Wire. The three sends
  `at(at(shop,['cart']),['add']).send([], m)`, `at(shop,['cart','add']).send([], m)`
  and `at(shop,[]).send(['cart','add'], m)` each print `[ 'cart', 'add' ] request`.
  Justified by `docs/decisions/0002-delivery-dispatch-and-ownership.md:140-141`.
  This is consumer-written selection; runtimes supply `at`/`mount` for receiving
  views (`README.md:57`).
- Runnable end to end in Nightseam (not in this repository): the bookshop. The
  shop's origin answers `Bookshop`; its `cart` child handles `list` and `add`;
  rebuilding with a `recommendations` child keeps the same cart. Output
  `before: book, pen` / `same cart capability: true` / `shop: Bookshop` /
  `after: book, pen, notebook` / `recommendations: pencil`. `examples/README.md:50-68`.
  Commands at pinned commit `dfacbb27…`: `examples/README.md:13-20`. The
  composition recipes need Nightseam's **unreleased** declared-composition API.
  `examples/README.md:42-46`

## Evidence and status

- Contract 0.2.0 released in all eight presentations. `docs/integration.md:138-140`
- Nightseam v0.6.0 (`5cc9723a`) adopted the Go/TypeScript types; no second native
  type family. `docs/integration.md:142-148`
- Current baseline: Bitwire's composition oracle against production local and
  WebSocket endpoints, five lifecycle cases. `conformance/current/README.md:26-32`
- Declared composites: 39 cases (`conformance/declared/cases.json`, counted);
  test-only reference meets all; released `Mount` meets 20 child-only cases and
  19 are exact recorded gaps. `conformance/README.md:17-22`
- Production gate: 39 cases through Nightseam's unreleased API (PR #713), 234
  executions (39 × 2 languages × 3 carriers), no gaps. `conformance/README.md:24-26`,
  `conformance/production/README.md:5-14`
- All three conformance runners are CI steps (`.github/workflows/ci.yml:49-51`);
  CI on main at `02846d5` succeeded (run 35940067917, 2026-09-24).
- Oracle is never relaxed to fit a runtime. `conformance/declared/README.md:20-23`;
  mutating the reference so a missing child falls back to the origin fails 3
  cases. `conformance/declared/README.md:62-63`
- Open: #20 full lifecycle acceptance review. `README.md:19-21`,
  `conformance/current/README.md:71-76`
- Evidence limits: only Go and TypeScript executed; serial schedules;
  nonfaulting carriers; Go/Go and TS/TS only. `conformance/declared/README.md:82-88`,
  `conformance/production/README.md:143-146`

## Negative space

- Not a carrier, codec, endpoint implementation, runtime or generator. Bitwire
  specifies the protocol and carriers; bitruntime implements them, and using
  Bitwire never requires Nightseam. `docs/decisions/0010-bitwire-holds-the-contract-and-bitruntime-implements-it.md`
- Not a new network protocol: the profile is `nightseam.duplex/1`, which decision
  0007 moves here as `bitwire/1` with the same bytes on the wire; until then
  importing Bitwire does not implement it. `docs/wire/profile.md:4-6`, `README.md:77-80`
- Not arbitrary-payload or profile-polymorphic. `docs/wire/contract.md:32-34`
- No routing policy in the primitive. `docs/wire/contract.md:79-81`
- No completion signal. `docs/wire/contract.md:92-93`
- No authentication; access is not proof of authority.
  `docs/wire/contract.md:220-221`, `docs/integration.md:203-204`
- No profile negotiation; deployment establishes the revision.
  `docs/wire/profile.md:76-79`, `docs/decisions/0004-return-origins-and-profile-revisions.md:214-218`
- A shared signature is not interoperability: operation paths, profile revision,
  value encoding, contract identity, reference scope and authority must also
  agree. `docs/wire/profile.md:114-123`, `docs/composition.md:98-102`
- An arbitrary Wire is not decomposable; no enumeration, undo or codec.
  `docs/decisions/0006-declared-composites-realize-deixis-nodes.md:419-427`
- A new primitive needs an observable requirement that composition cannot meet.
  `COLLABORATION.md:13-15`

## Ownership

| Project | Responsibility | Cite |
| --- | --- | --- |
| Bitwire | Shared access contract, language declarations, protocol and carrier specifications, independent conformance criteria | `README.md:72` |
| bitruntime | The Go and TypeScript implementations (chartered, no code yet); until it delivers, frozen Nightseam v0.6.0 | `README.md:73` |
| Bitlink | Planned protocol projections and generated adapters | `README.md:74` |
| Bitsystem | Typed spaces and kernel/system operations exposed through them | `README.md:75` |

Dependency direction: runtimes, adapters and consumer compositions point *to*
Bitwire. `docs/integration.md:193-197`

## Contributor surface (reference-only for the poster)

`pnpm install --frozen-lockfile` then `node scripts/check.mjs`; Go 1.26, Node
24+, pnpm 12.4.1. `README.md:113-118`. Conformance runners:
`node scripts/conformance-current.mjs` (`conformance/README.md:8`),
`node scripts/conformance-production.mjs` (`conformance/README.md:24`),
`node scripts/composition.mjs` (`conformance/README.md:32`). Decisions 0001–0006
in `docs/decisions/README.md:458-465` (0005 superseded).

## Editorial tiers

| Fact | Tier | Audience |
| --- | --- | --- |
| One method, `send(path, message)`, to an origin | Thesis-critical | consumer |
| Selecting/mounting returns the same interface; the three laws | Thesis-critical | consumer |
| Paths are opaque segment sequences (`[]`, `[""]`, `["a/b"]`, `["a","b"]`) | Differentiating proof | consumer |
| Wire vs Endpoint capability split | Thesis-critical | consumer |
| Eight languages, one written contract | Differentiating proof | consumer |
| Independent cases run against a real runtime; oracle never relaxed | Differentiating proof | consumer |
| Declared composite: origin at `[]`, complete children, no fallback | Differentiating proof | consumer |
| Install coordinates for Go/TypeScript | Attachment-critical | consumer |
| Six other coordinates | Attachment-critical, subordinate | consumer |
| Send-only `at` example | Attachment-critical | consumer |
| Send is admission; one receiver; no rebuilding; borrowing is not owning | Trust-critical | consumer |
| No runtime/transport/auth/new protocol; signature ≠ interoperability | Trust-critical | consumer |
| Ownership table (Nightseam supplies runtime) | Trust-critical | consumer |
| Status: 0.2.0, Nightseam v0.6.0 adoption, #20 open, unreleased construction API | Trust-critical | consumer, operator |
| Frame field table | Reference-only | consumer |
| Laws S0–V, key mapping, cuts | Reference-only | contributor |
| Invocation lifecycle obligations (0003), serials (0004) | Reference-only | contributor |
| Check and conformance commands | Reference-only | contributor |
| Historical 0.1 baseline, publication run links | Reference-only | contributor |

## Honest gaps

- No runnable composition example lives in this repository; the bookshop runs
  from Nightseam at a pinned commit, against unreleased API.
- The descent's assembly is illustrative: the outer `system` mount and the
  missing `gifts` child are not in the Nightseam example. Only the shop (origin
  `Bookshop`, children `cart` and `recommendations`) and the cart's `list`/`add`
  operations come from it (`examples/README.md:50-68`). The behavior each row
  shows is cited above.
- The poster's TypeScript `at` is written for the poster, not shipped. Its
  correctness rests on the contract statement that send-only selection needs
  only a Wire and a prefix.

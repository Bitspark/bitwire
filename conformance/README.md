# Conformance

**Historical evidence:** the observations and names below refer to the stated
0.1/0.2 addressed contract. In 0.3 that surface is `AddressedWire`; `Wire` is
addressless and `WireTree` is complete byte-keyed structure. These results do
not establish the new structural contract. See
[decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md).

**Status: current released 0.2 composition and scoped lifecycle evidence, a
test-only reference, bitruntime Go candidate and TypeScript release evidence
against the same cases, and a preserved historical 0.1.0 runtime baseline.**

## bitruntime runtime conformance

Run `node scripts/conformance-runtime.mjs`; `--language=go` or `--language=ts`
selects one half, and `--keep-scratch` retains the build and install tree. It
runs bitwire's existing independent cases against bitruntime's Go module and
TypeScript package, as the current baseline runs them against nightseam v0.6.0.
Both halves require bitwire v0.3.0 and the bitruntime artifacts pinned in
[bitruntime.json](runtime/bitruntime.json), never a local checkout or path. Each
driver receives its inputs with every expectation withheld, and one report gives
the case files' SHA-256s and every family's result in each language.

- **Go.** The test-only module [`runtime/go`](runtime/go/go.mod) requires the
  public bitruntime module at a pinned pre-release revision. The runner refuses
  any other module graph, revision or sum, and runs every driver with
  `GOWORK=off` under the race detector (required in CI).
- **TypeScript.** The private, test-only package
  [`runtime/ts`](runtime/ts/package.json) depends on bitruntime's v0.2.0
  release asset, `@bitspark/bitwire` 0.3.0 and `ws` 8.21.3, and its
  `.npmrc` takes the `@bitspark` scope from the public npm registry. The
  runner downloads the release asset and checks its SHA-256 and integrity and
  that tag v0.2.0 names the pinned revision. It refuses a lockfile entry that is
  not a public, integrity-pinned artifact or that names another bitruntime or
  bitwire, installs with `npm ci` in scratch, type-checks the drivers with
  TypeScript and runs them with Node 24's type stripping.

| Family | Driver and oracle | Carriers | Go at the pin | TypeScript at the pin |
| --- | --- | --- | --- | --- |
| Lifecycle | [Cases](current/lifecycle.json) through `Invocation` | none, public state | 5/5 | 5/5 |
| Composition | The six [reference](reference/expected.json) groups; drivers ported from nightseam's upstream ones | local pair, WebSocket client and server sending | 6/6 on each | 6/6 on each |
| Declared, reference | The 39 [declared](declared/cases.json) cases through the test-only interpreter over bitruntime's carriers | the same three | 39/39 on each | 39/39 on each |
| Declared, production | The same cases through bitruntime's child-only addressed mount, with its selection and forwarding | the same three | 20 conform; 19 match bitruntime's own [gap ledger](runtime/production-gaps.json) | the same |
| Trees | The [0.3 observations](trees/expected.json) through bitruntime's tree construction, selection, sending and addressed bridge | none, structural | 14/14 | 14/14 |

The Go drivers use `core.Invocation`, `core.NewPair`, the WebSocket engine,
`dispatch`, `core.At`, `core.Mount`, `core.Forward`, `core.Compose`,
`core.Select`, `core.Send` and `core.AsAddressed`. The TypeScript drivers
use the same facilities from `@bitspark/bitruntime`: `Invocation`, `pair`,
`at`, `mount`, `forward`, `compose`, `select`, `send` and
`asAddressed` from `/core`, `createDispatcher` from `/dispatch`, and
`Peer` from `/engine` over `webSocketConnection` from `/transports`.

As in the nightseam baseline, the two echoed `same-id` placeholders are
instantiated as `c:1`: bitruntime's `bitwire/1` is nightseam v0.6.0's profile
and refuses `same-id` as a request identifier on both carriers. Nothing else in
any oracle changes. bitruntime keeps its own gap ledger so a gap it closes is
removed there, never from nightseam's. Its observations equal nightseam's in
both languages: each mount is a renamed port, and bitruntime deliberately omits
the unreleased declared-composition API that decision 0012 supersedes. No case
reaches bitruntime's documented forwarding and disconnection changes, because
every refusal in these fixtures happens before a carrier or forwarder.

Lifecycle, composition and declared results remain evidence about the 0.2
addressed contract (`AddressedWire` in 0.3); trees is the 0.3 structural
contract.

## Current released runtime baseline

Run `node scripts/conformance-current.mjs`. The [current baseline](current/README.md)
pins Nightseam v0.6.0 and its released Bitwire v0.2.0 dependency. It compares
production local/WebSocket observations with Bitwire's composition oracle,
executes independent lifecycle cases in Go and TypeScript, and separately runs
upstream endpoint-integration, race, serial and budget tests. Its coverage table
identifies the remaining generated/live/authority and consumer acceptance work.

## Declared composites

The current runner also exercises [declared composites](declared/README.md):
an origin at every node beside complete named children, with parts retained by
their owner. The same 39 independent cases run through a test-only reference
interpreter and through released Nightseam's child-only `Mount`. The reference
meets every case. Production meets the 20 child-only cases; the other 19 are
exact recorded gaps. Reference evidence is not evidence of a production API.

`node scripts/conformance-production.mjs` separately checks all 39 cases against
Nightseam's new Go/TypeScript construction APIs at an unreleased public source
pin: 234 executions, with no gap allowances. The
[production evidence](production/README.md) distinguishes these results from
published-runtime adoption and links the earlier decision 0005 gate in history.

## Current 0.2 composition reference

Run `node scripts/composition.mjs` for the [Go and TypeScript reference proof](reference/README.md).
It exercises one receive owner, sibling and overlapping selections through an
explicit dispatcher, nested selection/mount/forward preservation, and borrowed
endpoint lifetime. Actual selected Endpoint views share that root attachment,
exercise nested receive/send paths, detach/rebind and closure notification, and
preserve a captured return capability after their teardown. This is test-only
composition evidence, not Nightseam adoption
or a claim about generated generic adapters. The reference's longest-prefix rule
is dispatcher policy; the primitive endpoint has no registration paths or matching
mode. The independent [oracle](reference/expected.json) is shared by both drivers.

## Historical 0.1.0 runtime baseline

The remaining sections describe the **unchanged 0.1.0 contract** at the pinned
Nightseam revision. Its registration precedence and close behavior are historical
observations, not obligations on Bitwire 0.2's send-only Wire. Keeping these cases
runnable prevents migration from silently rewriting the previous evidence.

Run the independent cases against the Go and TypeScript Nightseam implementations:

```sh
node scripts/conformance.mjs
```

The runner fetches the exact public revision in [nightseam.json](nightseam.json)
into a temporary directory. It checks that revision, installs its pinned
TypeScript dependencies, compiles the TypeScript driver, and runs both drivers.
It compares every observation with [the shared cases](cases/access.json) and
exits unsuccessfully on any missing, extra or mismatched result. No private
sibling checkout is used. Requirements are Git, Go 1.26+, Node 24+, pnpm 12.4.1
and access to public source/dependency registries. `--language=go` or
`--language=ts` selects a driver; `--keep-scratch` retains the fetched tree for
diagnosis. Temporary dependency files never become Bitwire package dependencies.

### What the historical baseline establishes

| Cases | Observable requirement |
| --- | --- |
| Empty, nested and concatenated selection | The request arrives at the declared root path, the callback sees a path relative to its view, and the response returns unchanged. |
| Selected mounted access and empty mount key | Mounting consumes one segment, including an empty key; the selected child remains the destination. |
| Opaque paths | Empty segments, embedded separators, split segments, composed/decomposed Unicode and scalar/NUL strings remain distinguishable in actual dispatch. |
| Exact and namespace routes | Exact match wins, otherwise the longest segment prefix wins; duplicate registration is refused. |
| Return access | Selection, mounting and forwarding preserve capability identity at their own boundaries. |
| Mount and registration lifetime | Detach is idempotent and releases registration; closing a mount notifies its own receiver once and frees its child registration; its borrowed child still answers. Closing a selected view closes its endpoint. |
| Forwarding lifetime | Requests and responses traverse two local carriers; detaching forwarding leaves both borrowed origins usable. |

The [Go driver](drivers/nightseam/go/main.go) and
[TypeScript driver](drivers/nightseam/ts/driver.ts) use the public runtime's real
local pairs, selection, mounts and forwarding. Their observers delegate every
operation; they supply no replacement routing, queue or return implementation.
Drivers record actual results. Expectations are authored separately in the
fixture and checked by [the runner](../scripts/conformance.mjs).

The fixture has four scenario kinds: `access` specifies prefixes, nested
selections, an optional mount key, a call path and payload; `routing` specifies
registrations and calls; `lifetime` follows the detach/close sequence above;
`forwarding` connects and detaches two real pairs. Each case has a unique `id`
and an `expected` observation object. Drivers ignore `expected`; only the runner
reads it. The same input and expected output are used in both languages.

### Profile boundaries exposed by the cases

Path validity does not guarantee admission of every frame. The retained
`nightseam.duplex/1` profile requires a nonempty root path for requests and
events. `[]` is a valid relative path but a root request there is refused;
`[""]` is a nonempty path and reaches its distinct registered operation. The
opaque-path case asserts both observations. Empty selection is tested with the
supported `['call']` operation; a selected nonempty prefix may use `[]` as a
suffix. See the pinned
[profile](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/docs/wire/profile.md).

Similarly, a new carrier may map a request's return capability to own its
correlation and lifetime. The identity requirements concern pure composition:
the observers compare before/after selection, mounting or forwarding, never
across a new local pair's admission boundary. The response itself is exercised
end to end through the mapped capability.

### What remains distinct

This is evidence about the pinned implementation **before adoption**. The Go
driver uses Nightseam's nominal native types. The TypeScript driver also imports
Nightseam's native declarations. Neither claims that Nightseam already imports
or re-exports published Bitwire types. Adoption needs separate checks using the
released artifacts and migrated consumer; then the drivers can use that version.

The baseline does not yet cover every frame field, asynchronous admission laws,
pending-request cancellation after detach, concurrent lifetime interleavings,
remote carriers, checked invocation context, scoped references or reference
release. Those are explicit remaining conformance/profile obligations, not
guarantees inferred from these ten cases. Runtime-specific coverage stays with
its owner. Declaration compilation alone is never behavioral conformance.

## Adapter integration still required

The next layer compares a declared model used directly and through local,
selected, mounted and remote wires. Generic cases vary a slot between data and
models with callable behavior. The same generic adapter must preserve behavior
without inspecting the particular slot implementation. That checks both access
composition and the generator's distinct type-substitution obligation.

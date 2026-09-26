# Conformance

**Historical evidence:** the observations and names below refer to the stated
0.1/0.2 addressed contract. In 0.3 that surface is `AddressedWire`; `Wire` is
addressless and `WireTree` is complete byte-keyed structure. These results do
not establish the new structural contract. See
[decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md).

**Status: current released 0.2 composition and scoped lifecycle evidence, a
test-only reference, and a preserved historical 0.1.0 runtime baseline.**

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

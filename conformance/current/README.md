# Current released composition baseline

Run from the repository root:

```sh
node scripts/conformance-current.mjs
```

The [pin](nightseam.json) fixes public Nightseam **v0.6.0** to
`5cc9723a24646c40ed1861f892b2b23eb6d785d7`, using released Bitwire **v0.2.0**.
The runner fetches the public tag into an isolated temporary checkout and checks
its commit. It verifies the Go contract version, source hash and module sum and
refuses module replacements. TypeScript uses the pinned release's frozen
lockfile and verifies the installed Bitwire version. The separate Go lifecycle
driver consumes public registry modules without a source replacement.

Requirements: Git, Go 1.26+, Node 24+, pnpm 12.4.1 and public dependency access.
`--language=go` or `--language=ts` selects a language; `--keep-scratch` retains
the temporary checkout for diagnosis. CI requires Go's race detector; a local
Go installation without CGO reports that limitation explicitly. No private
sibling checkout, production runtime in Bitwire or package dependency on
Nightseam is introduced.

## Evidence by implementation and scope

| Layer | Expectations and exercised implementation | Scope |
| --- | --- | --- |
| Shared composition | Bitwire's [oracle](../reference/expected.json), compared here against Nightseam's production drivers | Six observation groups in each language: local pairs, client-to-server WebSockets and server-to-client WebSockets. |
| Public lifecycle state | Bitwire's [cases](lifecycle.json), adapted by [Go](go/main.go) and [TypeScript](ts/lifecycle.ts) using public facilities only | Five independent cases: settlement/body completion, latched cancellation per traversal, total capture/body bounds, unsupported paths and old-capability isolation. |
| Declared admission composition | Bitwire's [fixtures and test-only interpreters](../declared/README.md), using released endpoints, selection, forwarding and invocation facilities | 27 cases per language on local pairs and WebSockets in both directions. Retained own behavior, inherited policies, complete cuts, shared state, counterexamples and a pending reply/cancellation after reconstruction. This is interpreter evidence, not a released runtime construction API. |
| Independent endpoint participation and runtime regressions | Pinned Nightseam tests, with expectations owned upstream | Two endpoint implementations without a shared private ledger, an opaque wrapper, detach/rebind, repeated traversal, sequential retirement, serial discipline and execution budgets. Go also runs queued-control races under the race detector. |

The composition drivers are
[Go](https://github.com/Bitspark/nightseam/blob/5cc9723a24646c40ed1861f892b2b23eb6d785d7/conformance/bitwire/go/main.go)
and
[TypeScript](https://github.com/Bitspark/nightseam/blob/5cc9723a24646c40ed1861f892b2b23eb6d785d7/conformance/ts/src/bitwire.ts).
They execute actual endpoints, dispatchers, selection, mounting and forwarding;
Bitwire's test-only reference implementations do not run as substitutes.
Observations include single receive ownership, siblings/overlap, opaque paths,
selected-view closure, preserved return/context associations and delayed replies
after route teardown. The same six groups run on every carrier. These are Go/Go
and TypeScript/TypeScript connections, not a cross-language pairing matrix.

One explicit profile instantiation changes the reference's two echoed
`same-id` placeholders to `c:1`, Nightseam's valid request-ID syntax. They have
distinct original return capabilities. This is not permission to reuse a serial
on a physical connection; each physical peer mints its own. No path, boolean,
ownership or lifetime expectation changes.

The lifecycle runner removes `expected` before supplying inputs to either
driver. Both adapters use the same operations and record actual public results;
only Bitwire's runner compares the observations. Missing, extra, duplicate and
mismatched observations fail. The drivers contain no lifecycle ledger. Their
small opaque send facades are test adapters to the public Invocation facility,
not claims to implement an independently conforming endpoint runtime.

The lifecycle cases deliberately isolate profile state from transport. They
measure retirement through the public observation, not heap usage or a carrier's
admission capacity. The upstream endpoint experiments remain a separate kind of
evidence and are not relabeled as independently authored Bitwire tests.

## Review and outstanding acceptance

[Decision 0004](../../docs/decisions/0004-return-origins-and-profile-revisions.md)
settles return-origin addressing and the release-qualified profile revision.
This baseline establishes current production composition and the listed
lifecycle observations. It does not automatically close
[#20](https://github.com/Bitspark/bitwire/issues/20).

| Remaining assessment | Owner and completion evidence |
| --- | --- |
| Generated models, callbacks, returned live values, generic substitution and verified context across carriers/tunnels | Nightseam: assess and link exact-release generated/live/profile acceptance separately from raw frame composition. A test-owned context marker is not authentication evidence. |
| Authority between lifecycle participants | Nightseam and Bitwire review: reconcile ADR0003's execution-owner requirement with the profile's shared return capability. Its verbs are not separate unforgeable authorities; knowing Wire paths is not proof of actual body completion. |
| Shutdown with a continuing body and fully asynchronous control drain | Nightseam and Bitwire review: assess actual carrier/queue ownership and retirement. The public-state cases here are deterministic and do not establish every concurrent interleaving. |
| Attachment and operation through a real domain consumer | The consumer repository: demonstrate the same declared capability locally and remotely, including returned child access, while preserving its own attachment, planning and authority rules. |

The [historical 0.1 baseline](../README.md#historical-010-runtime-baseline) stays
unchanged. Its older registration and selected-view ownership rules are not
used as 0.2 expectations. Other Bitwire language declarations remain aligned;
this current runtime baseline exercises Go and TypeScript only.

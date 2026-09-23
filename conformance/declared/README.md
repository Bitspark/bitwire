# Declared admission composition evidence

[Decision 0005](../../docs/decisions/0005-declared-composition-and-subtree-policy.md)
defines the interpretation. Run `node scripts/conformance-current.mjs` to
exercise its [fixtures](cases.json) in Go and TypeScript.

The runner supplies inputs without expected observations. A separate oracle
checks all case IDs and complete observations, refusing missing, extra,
duplicate and mismatched output. Deliberately incorrect compositions are
negative controls: raw-child selection bypasses a guard, reconstruction from a
bound child repeats it, and rebuilding policy state resets quota.

The interpreters in [Go](../current/go/declared/main.go) and
[TypeScript](../current/ts/declared.ts) are test-only realizations of the new
interpretation. They retain declaration parts and use the pinned Nightseam
v0.6.0 public `At/at`, asynchronous endpoints and forwarding. These tests are
**not** evidence that Nightseam exports a production declared-composition API.
No Bitwire package depends on this runtime or on a sibling checkout.

The same input cases run on local pairs and WebSockets in both directions.
The fixtures use serial admission schedules; they do not prove concurrent
policy-state synchronization. That remains an implementing runtime obligation.
They observe original local return identity and a local context association
before each carrier boundary; that association is a test marker, not verified
authentication. Carriers own subsequent identity/context mapping. Tests assume
connected, nonfaulting, ordered carriers and do not equate transport failure
with a local outcome.

Coverage includes own behavior and refusal; complete-cut reconstruction;
selection and nested selection; policy order and relative paths; shared quota,
shared child state and repeated policy occurrences; exact/empty/opaque paths;
missing destinations and malformed declarations; changed-child negative
controls; unchanged messages and borrowed endpoint usability after discarding
compositions. The existing [runtime baseline](../current/README.md) separately
checks delayed replies, detach/rebind, cancellation participation and retirement.

The policy-plus-invocation test additionally retains an actual pending request's
return capability across reconstruction and route replacement, then observes a
late reply and captured cancellation without another admission check. This
uses the receiving invocation's public return-origin lifecycle facility; it
does not claim generic cancellation through Q's new-admission entry, prove
authority of lifecycle participants or cover every concurrent race.

All eight native presentations share the contract; only Go and TypeScript have
this executable interpretation evidence. Production construction APIs, verified
authority, other language runtimes, fault injection, generated live-value
adapters and BitTree's full conversion cycles remain separate acceptance work.

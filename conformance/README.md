# Conformance

**Status: acceptance plan. No executable Wire behavior suite exists here yet.**

The repository command, `node scripts/check.mjs`, checks documentation and
language declarations. Passing it is not a statement that a runtime conforms.

## The intended cases

| Area | Observable requirement |
| --- | --- |
| Paths | Empty paths, empty segments and embedded separators remain distinct; scalar Unicode is preserved. |
| Selection | Nested selection agrees with concatenated selection; selecting the empty path preserves access. |
| Mounting | One segment selects a child; detaching or closing the mount leaves borrowed children usable. |
| Receiving | Exact match takes precedence over the longest namespace prefix; duplicate registration is refused. |
| Dispatch | Admission does not execute the destination handler on the sender's stack. |
| Return access | Selection, mounting and forwarding preserve local return identity. |
| Lifetime | Detach is idempotent; admitted requests retain their return/cancellation path. |
| Context and references | Composition retains checked context and scoped reference guarantees; closure is not binding release. |

Each future case supplies inputs and expected observations independently of an
implementation. Language drivers exercise an implementation through its public
surface. They must compare actual observations with the expected ones; matching
declarations or importing a shared type is not enough.

Runtime implementations and their queues, sockets and scopes remain outside this
repository. A driver may exercise Nightseam without making Nightseam a dependency
of either contract package. Implementation-specific cases stay with their owner.

## Adapter integration

The next layer compares a declared model used directly and through local,
selected, mounted and remote wires. Generic cases vary a slot between data and
models with callable behavior. The same generic adapter must preserve behavior
without inspecting the particular slot implementation. That checks both access
composition and the generator's distinct type-substitution obligation.

# Communication composition: target and ownership

**Status:** adopted documentation direction, 7 October 2026. Protocol design and
implementation remain pending. This record preserves W1-W6 and decision 0015's
released contract; it adds no Wire methods, mandatory envelope or runtime code.

## Motivation and provenance

The owner asked in Codex chat `01a10739-ce26-73c0-b27c-13b9146811a8`:

> OK, now just to be sure, those two repos should allow us to compose a tree of running instances ("runtimes") into a tree, route requests between them, and provide this multiplexing to allow wires to be sent over the wire. Right?

After asking whether that was documented, the owner instructed:

> Please make sure it is

These are a question about intended scope and a documentation instruction, not
approval of an unpresented frame grammar. The architectural conclusions below
are the implementation agent's decisions within that scope. The owner also asked:

> Why does deixis even mention anything like that? As foundational repo, it shouldn't know of any of those higher-level repos, should it?

The dependency direction, including authority, must remain explicit.

## Decision

[Communication composition](../wire/composition.md) is the canonical statement
of this target's meaning, boundaries, status and acceptance obligations.
bitwire specifies interoperable optional layers; bitruntime implements the live
mechanics. Applications choose and operate their topology. An executable such
as the draft bitnode host can assemble those reusable mechanics.

Addressing, multiplexing and exporting an existing Wire are distinct facilities.
Channel selection may reuse addressed access; allocation and lifecycle add
meaning beyond selection. Export is a scoped reference/forwarding operation and
does not grant ownership rights absent from the exported capability. Addressing
inside a multiplexed Endpoint and a multiplexer at an addressed destination are
different compositions; the latter needs an explicit bidirectional binding.

The runtime's process-local registries are separate from bitwire-svc's own
proposed durable allocation service. That distinction is grounded in the service's
own design, not assigned by deixis. No service is required merely to multiplex an
already established connection. Consumer designs quoted in a foundation are
context; their acceptance and changes belong to the affected consumers.

## Alternatives and consequences

- Putting portable multiplexing implementation in bitwire would turn the
  contract package into a live runtime and split endpoint machinery between two
  owners. Keep codecs/conformance here and production realization in bitruntime.
- A mandatory carrier-addressing-multiplexing tower would exclude valid
  compositions. Define each boundary and its composition requirements instead.
- Treating every exported Wire as a transferred duplex Endpoint would fabricate
  receive/close authority. Preserve the send-only boundary of W4.
- Treating a remote mount as complete DeixisNode structure would fabricate
  discovery and turn pure selection into I/O. Keep those observations separate.
- Treating a durable relay allocation and a live channel as the same identity
  would imply restoration and replay across reconnection. Their lifetime and
  service owners remain distinct.

No changes to language declarations, codecs, runtime APIs or package versions
follow from this documentation alone. There is no compatibility layer to keep.
Concrete protocol work must record its own choice, observable outcomes and
consumer consequences before implementation. Existing historical releases and
research remain evidence, not executable fallbacks.

## Evidence and limits

The current contracts and bitruntime implementation were inspected at bitwire
`5bf2737b16fa6ae8c1f5c955cdba658d5adce364` and bitruntime
`b19458f6f741a0f78729e89ef099bfd2869900a2`. The composition document links the exact
bitnode and bitwire-svc drafts used to check downstream ownership. Their presence
does not establish implementation or acceptance of this new plan by another
agent. Existing released endpoint evidence is distinguished from the unrun
composition observations. Documentation checks and PR review verify this record;
they do not supply runtime conformance evidence for the proposed facilities.

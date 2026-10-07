# Tree routing

**Status, 7 October 2026: proposed by [decision 0017](../decisions/0017-tree-routing.md).**
This is the first [composition](composition.md) protocol record: routing opaque
messages through a tree of runtime instances in one absolute namespace. It adds no
method to Wire, Endpoint or AddressedWire and no field to the raw or addressed
formats: links carry ordinary addressed values, and routing opts in to read their
messages as routing records. Multiplexing, wire export, suffix delegation and stream framing are not
part of it. bitruntime realizes it; a host such as bitnode decides topology and
admission.

## Terms

A **router** is a runtime instance with a fixed **location** `P`: an absolute
path in one tree namespace. The tree's root has location `[]`.

A router holds at most one **parent link** and a set of **bindings**. A binding
gives one exact child key `k` to one link, delegating every destination that
starts with `P ++ [k]` to it. A **link** is an Endpoint carrying routed values:
addressed values whose messages are routing records ([below](#what-a-link-carries)).
Whether the peer on a binding is another router, a service or a client is the
host's knowledge, not the router's: the forwarding rule is the same for all of them.
A router may also have an **own receiver** for destination `P` exactly.

Each installed parent link and binding has a **generation** that distinguishes it
from every earlier and later installation in that router.

## What a link carries

A link is used through the existing addressed facade (W2). Each value is an
addressed value whose path is the **destination** and whose message is a
**routing record**, the three-item tuple

```text
( "bitwire/routed/1", origin, payload )
```

The record header is the 16-octet ASCII atom `bitwire/routed/1`. The origin is a
tuple of atoms: an exact byte path in the tree namespace, with the same identity
rules as the destination. Payload is any ground value and is never interpreted
by routing.

The addressed facade keeps its message opaque. Routing is a higher protocol that
the host selects for a link; on such a link, every addressed message must be a
routing record. A value that is not addressed, or whose message is not a routing
record, is not valid on a routing link. The
[vectors](../../conformance/routing-vectors.json) give the bytes and the rejected shapes.

The origin names where the message comes from in the namespace. It is routing
metadata checked against the link it arrived on, never proof of who sent it: a
binding's authenticated peer and its scope are established by the host when it
installs the binding. Routing checks the origin, never an address named inside a
payload. A consumer that replies, or attributes a message, must use the checked
origin or verify its own claims against it; see [replies](#replies).

## Deciding one message

A router at `P` decides each routed value `(D, O, m)` from its source: the parent
link, a binding `k`, or its own sending. These steps run in order; the first that
applies ends the decision.

1. **Stale.** If the value arrived on a link whose generation is no longer
   installed, refuse it as `stale-binding`.
2. **Scope.**
   - From binding `k`: `O` must start with `P ++ [k]`, or refuse `origin-out-of-scope`.
   - From own sending: `O` must equal `P`, or refuse `origin-out-of-scope`. A
     realization may instead give own sending no origin parameter and always use
     `P`, which meets this step without the refusal.
   - From the parent link: `D` must start with `P`, or refuse `outside-subtree`.
     The origin is not checked; see [trust](#trust-and-its-limit).
3. **Own.** If `D` equals `P`, deliver `(D, O, m)` to the own receiver, or refuse
   `missing-route` if there is none.
4. **Down.** If `D` starts with `P`, take the next atom `k' = D[|P|]`. If a binding
   for exactly `k'` is installed, send the unchanged routed value on it;
   otherwise refuse `missing-route`. The own receiver never answers for a
   descendant.
5. **Up.** Otherwise `D` lies outside `P`'s subtree. Send the unchanged routed value
   on the parent link if one is installed; otherwise refuse `missing-route`.

If the send in step 4 or 5 is refused by the next link, refuse `not-admitted`.
A next link that is closing can therefore give `not-admitted` before its
binding's release is observed and `missing-route` after it. Both are correct, and
neither says more than that this hop did not forward the value.

In these steps, "the unchanged routed value" is the addressed value as it
arrived: the same destination and the same routing record.

Comparisons are atom-exact and segment-exact: `["a/b"]` is not `["a","b"]`, `[""]`
is not `[]`, and no string form, normalization or ancestor fallback exists. A
binding may receive a message addressed into its own subtree through its parent;
forwarding it back down is the ordinary rule, not a special case.

## Refusals and outcomes

A refusal is reported to the router's host with its reason, source, generation,
destination, origin and the refused payload, unchanged. The router owns the
receive slot, so this observation is the host's only access to a refused value.
It is **not** a message: routing sends nothing toward the
origin, and a consumer protocol decides whether and how a failure is reported to
anyone. The reasons are `stale-binding`, `origin-out-of-scope`, `outside-subtree`,
`missing-route` and `not-admitted`.

Every hop is its own local admission (W5). A successful forwarding send says only
that the next link admitted the value. A later refusal at another hop does not
turn an earlier admission into a refusal, and no hop learns whether the payload
was acted on. Routing does not retry, deduplicate, correlate or cancel.

## Bindings, generations and ownership

- **Installing.** The host installs a binding for a key after authenticating its
  peer and agreeing its location. A binding for a key with a live binding is
  refused, as is a second parent link, a parent link at the root, and a link whose
  receive slot is already owned. A binding limit refuses further bindings without
  affecting existing ones.
- **Receiving.** The router takes the receive slot of every link it installs
  (W4) and decides each arriving value in arrival order for that link.
- **Releasing.** Releasing a generation removes that binding only if it is still
  installed. A link's termination releases only its own generation. Old callbacks
  therefore cannot remove a replacement, and a value that arrived on an earlier
  generation is refused rather than forwarded through the replacement.
- **Closing.** The router never closes a link. The host that supplied a link closes
  it. Releasing the router detaches its receivers and refuses its own sending.
- **Reinstalling.** A link is installed at most once. A host never installs a
  released link again, because values it buffered while released cannot be
  attributed to any generation.
- **Bad input.** A value on a link that is not an addressed value carrying a
  routing record fails that link through handler failure, as the addressed facade
  does for a malformed addressed value.

## Order and resource bounds

Values arriving on one link are decided in arrival order, and those forwarded to
the same next link keep that order. Nothing is promised between different
arriving links, and nothing across a binding's replacement.

Routing adds no queue. A decision runs within the arriving link's dispatch and
ends in a send on one next link or in a refusal. The links' own message, queue and
depth limits therefore bound routing; a send refused by a full link is
`not-admitted`, with that link's own consequences. The binding table is bounded by
the host's binding limit.

## Why messages cannot loop

The host agrees each binding's location: a peer bound under key `k` sits at
`P ++ [k]`. Under that precondition, a message goes up only while its destination
lies outside the current router's subtree, so each step up shortens the location.
It goes down only into the binding whose prefix it extends, and a router never
sends a message from its parent upward. So a message rises to the lowest common
ancestor of its source and destination and then descends, in at most twice the
tree's depth in steps. No hop limit is needed. A host that installs a binding at
a location it has not agreed breaks this precondition.

## Replies

There is one namespace, so a reply needs no mapping: a peer replying to `O` sends
a routed value with destination `O` and its own origin. The origin a reply
targets was scope-checked at the hop where it entered the tree. Request identity
and correlation, if a consumer needs them, are part of its payload convention,
not of routing.

**This protects a reply only if the consumer replies to the checked origin.** A
client bound at `["client42"]` can send a request with the checked origin
`["client42"]` while its payload names `["client43"]` as a return address. Every
router accepts it, because routing never reads payloads. A service that replies
to the payload's address sends the reply to `client43`. A consumer protocol must
therefore take its reply target, and any source it attributes, from the checked
origin, or verify its own payload claims against it.

## Trust and its limit

Steps 1 to 5 apply the existing bindings and lifetimes: a binding may originate
only within its own prefix, own sending only at the router's location, and a
parent link is trusted to forward within the router's subtree. The parent's
origins are not checked because the parent is the trusted forwarder of the whole
tree above. Consequently a compromised ancestor can present any origin to its
descendants. A child's upward traffic stays confined to its prefix. Origin checks
bound where a value may claim to come from; they do not prove which key or
principal sent it. A receiver that needs an authenticated actor or principal
obtains it from the host's attachment and the native authority contracts, not
from an origin path.

## Not in this record

- Suffix delegation into a new root and mixed roots; this record defines only
  the shared absolute namespace.
- Multiplexing, exporting wires and stream framing.
- Discovery or enumeration of remote subtrees: a binding is opaque.
- Attachment authentication, location assignment and enrollment; these belong to the host.
- Request/reply kinds, identifiers, correlation, failure messages to the origin,
  retries and cancellation; these belong to consumer protocols.

## Required observations

A realization reports each of these separately, in Go and TypeScript, on local
pairs and WebSocket links, with both connection roles:

1. The [encode and reject vectors](../../conformance/routing-vectors.json).
2. Every decision vector, including each refusal reason, from a configured router.
3. The listed observations: exact forwarding, generations and release,
   installation refusals, order, refusal reporting, bad input, no added queue and
   no closing of links.
4. A multi-process tree in which a client reaches a service across at least two
   hops and a cross-branch route, and the reply returns to the client, with
   binary, empty and slash-containing atoms intact.

Passing raw, addressed or local-tree conformance establishes none of these.

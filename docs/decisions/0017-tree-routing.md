# Tree routing

**Status:** proposed, 7 October 2026, for review by Wire & Runtime
(`codex-communications`, the communication-contract reviewer). The protocol is
[tree routing](../wire/routing.md); its independent cases are
[routing-vectors.json](../../conformance/routing-vectors.json). No runtime code,
API or package version follows from this record alone.

## Motivation and provenance

[Decision 0016](0016-communication-composition.md) set the target: compose
runtime instances into a routing tree and route opaque messages through them.
It left the protocol pending and listed what a mount or forwarding boundary must
specify. bitruntime's [composition plan](https://github.com/Bitspark/bitruntime/blob/0bc971fd1512457d0591ace825e2ffd9dd0573cd/docs/COMPOSITION.md)
makes this record stage 1 of its routing component. The first consumer is
bitnode's first route ([platform kickoff 02-3](https://github.com/Bitspark/platform/blob/39fac67a6a32fb1b600c140d8971e6e17baa53d0/planning/kickoffs/02-3-bitnode-first-route.md),
claim [bitnode#2](https://github.com/Bitspark/bitnode/issues/2)), which needs a
bitnode echo service reached across a tree of runtime instances over local pairs.

On 7 October the operator asked for an implementation sprint, and Wire & Runtime
decided that this lane's implementer authors the routing record and its
bitruntime realization under its review, through each repository's own process.
That is the authority for this proposal. It does not make the choices below
settled until review accepts them.

## Derivation

The owner's 7 October method is to derive a case from existing concepts before
adding any; a new concept needs a concrete case the existing ones cannot handle.
Each obligation in [composition](../wire/composition.md#composing-runtime-instances-into-a-routing-tree)
maps onto an existing contract or a consumer's existing draft:

| Obligation | Existing concept that answers it |
| --- | --- |
| Destination of a message | The addressed path (W2): exact atoms, the same identity and comparison. |
| Routing root and matching | One absolute namespace, as the [bitnode draft](https://github.com/Bitspark/bitnode/blob/868acc63b014e950a833a6f8e01486460c91de84/docs/DESIGN.md#locations-and-paths) proposes; exact prefix comparison as for `under`. |
| Precedence of own, children and mounts | Exact selection (W3's `at`), applied one key at a time: own at `P`, the binding for the next key, otherwise the parent. No fallback. |
| Child versus mount | Not distinguished. A binding delegates a prefix; whether its peer is a router or a service changes nothing in forwarding. |
| Authorized attachment and generation | The host's admission and the endpoint's lifetime. A generation is a distinct installation, as the composition plan requires. |
| Allowed originating scope | The bitnode draft's subtree origin check, and its trust in an admitted parent. |
| Return routing | One namespace: a reply is a routed value to the origin. |
| Absence, refusal, stale binding, loops | W5's distinct outcomes, per hop. Loop freedom follows from location agreement. |
| Receive and close ownership | W4: the router owns receive slots; the supplier of a link closes it. |
| Bounds | The links' existing limits. Routing adds no queue. |

## The one addition: an origin path

The routed value is the addressed value with one more path. Without it, the scope
check cannot work beyond one hop. At the first router, the arriving link
identifies the binding, but the next router sees only a message from its child
`["a"]`. The only remaining place for a return address is the payload, which
routing must not read.

Then this happens: a client bound at `["client42"]` sends a request whose payload
names `["client43"]` as its return address. No router can check it, because the
payload is opaque, and the service replies to `client43`. One client can then
direct replies to another, or impersonate another origin to every service. With
the origin in the routed value, the root refuses that request at the client's
own binding, because `["client43"]` is outside `["client42"]`.

Carrying the origin adds no identity, kind, correlation or reply object, and it
does not prove who sent anything: it is metadata confined by bindings, exactly as
in the bitnode draft. Every other field of that draft's routing record is a
consumer convention and stays out of this protocol.

## Decision

1. **One optional layer, a separate format.** Links carry the four-item tuple
   `("bitwire/routed/1", destination, origin, payload)`, an ordinary ground value
   (W1). It is not an addressed value with a structured message: the addressed
   message stays opaque, and the two formats cannot be mistaken for each other.
2. **One absolute namespace.** Suffix delegation into a new root is not defined
   here. A later record can add it as a separate profile; it is not an
   interpretation of the same format.
3. **The decision procedure** of [tree routing](../wire/routing.md#deciding-one-message):
   stale, scope, own, down, up, with five refusal reasons reported to the host
   only.
4. **Bindings** are opaque prefixes with generations. The router owns their
   receive slots and never closes a link.
5. **Independent cases first.** The encode, reject and decision vectors and the
   listed observations are written before any implementation. The encode bytes
   are hand-derived from the ontos codec grammar.

## Alternatives

- **No origin; return address in the payload.** Rejected because of the
  `client43` case above.
- **Origin implied by the arriving link, not carried.** This works for one hop
  only. Any intermediate router would have to rewrite or wrap messages per hop,
  and there is nothing to rewrite them into without carrying a path.
- **Reuse the addressed format, with a message of `(origin, payload)`.** Rejected:
  routers would interpret an addressed message, which W2 keeps opaque, and an
  ordinary addressed value would become ambiguous with a routed one.
- **A hop count or time-to-live.** Not needed: location agreement already bounds
  every route at twice the tree's depth. It would add a field that every hop
  rewrites.
- **Failures sent to the origin as messages.** Rejected for the protocol. A
  failure message needs request identity and an exchange convention, which belong
  to consumers. A host can still send one under its own consumer protocol.
- **Distinguishing child routers from mounted outlets.** Not needed: forwarding
  is the same. The distinction remains the host's, at admission.

## Consequences

- **bitruntime** implements a router and a routed-value facade in Go and
  TypeScript against the vectors and observations, with cross-language and
  multi-process evidence, as its stage 2. Go may land first; stage 2 is complete
  only with both languages. Names and signatures are bitruntime's to choose. The
  realization needs only `Wire`, `Endpoint` and the codec, so it adds no
  dependency to this repository.
- **bitnode** chooses topology, authenticates attachments, agrees locations,
  assigns return keys, and defines its consumer exchange (identifiers, failure
  messages, service conventions) above routing.
- **Codec helpers.** This record does not add `packRouted` or `unpackRouted` to
  bitwire's eight presentations. The format is normative here, and its vectors
  judge any implementation. Whether bitwire later provides such helpers in every
  presentation, as it does for the addressed format, is a separate change for
  this repository's reviewer.

## Consultation

The kickoff asks for an expert consultation before fixing this profile. On 7
October 2026 the owner said: "no consultations for now, they are not available
currently" (quoted in [bitspark-accounts' generic confirmation decision](https://github.com/Bitspark/bitspark-accounts/blob/862ed7fddaa9f2badc535f7feb7ff834060c6cc7/docs/decisions/2026-10-07-generic-confirmation.md)).
So this record is decided without that advice. It is reviewed instead by Wire &
Runtime, and records each alternative weighed and its reason. If a consultation
later answers, its advice is evaluated against what was built, and any change is
a new decision.

## Charter invariants

W1 is unchanged: the routed value is an ordinary value on an addressless link.
W2 is unchanged: the same path identity is applied twice. W3 is respected: a
binding is opaque and enumerates nothing. W4 is applied: one receive owner per
link, and no closing by the router. W5 is applied per hop. W6 is applied: the
cases precede implementation.

## Evidence and limits

The encode vectors were checked against the released bitwire 0.5.0 codec, and
the decision vectors against a literal reading of the procedure. Neither check
is a routing implementation. Inspected sources are bitwire `10259bd`, bitruntime
`0bc971f` and v0.6.0 `b19458f`, and bitnode `868acc6`. No router exists yet, and
none of the required observations has been run.

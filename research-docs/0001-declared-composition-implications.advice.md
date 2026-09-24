# Advice for consult
**Research doc:** doc_0a1918b1-fe12-4e88-b3dc-7ac9567ad8c9.md
**Document:** doc_0a1918b1-fe12-4e88-b3dc-7ac9567ad8c9
**Advisor:** ChatGPT GPT-6 Pro
**Session:** nsess_4dfffe33-e170-4a62-a73d-9e155a600642
**Run:** run_345bdfe3-d76d-46b5-b0f5-161b0ba6c5c3
**Chat:** https://chatgpt.com/c/6ab4c6ec-ff04-83ed-8918-f6a91fcae1b8
**Verify:** nightfall consult verify run_345bdfe3-d76d-46b5-b0f5-161b0ba6c5c3 --output <this file>

## Overall recommendation

**Keep the immutable composite and the decision to make guards ordinary access wrappers. Do not ship the generated-service integration unchanged.** The core construction is coherent; the unresolved issues concern what the generated description promises, where admission becomes irreversible, and which runtime component remains responsible for an admitted invocation.

The most important distinction is:

> **Retaining an immutable route description preserves references to access. It does not, by itself, preserve an end-to-end routing decision or the lifetime needed to finish an invocation.**

That distinction should organize the release contract.

My assessment is based on the supplied excerpts and reported test results, not an independent execution of the repositories. The reported conformance results support the general composite; they do not yet establish the concurrent, failure, or generated-operation guarantees discussed below. 

## 1. What this object is

### A namespace assembled from capability facets

I would describe the general construction as **an immutable, assembler-owned namespace of complete send capabilities, with explicit behavior at its own address**.

The generated construction is more specifically **a bundle of operation facets over shared access**. It exposes selected routes to an underlying service; it does not decompose that service into independently owned implementations. That distinction matters because replacing one facet can break invariants shared with the remaining facets, even when its message types remain compatible. Your contextual substitution requirement already captures this correctly.  

The capability literature’s forwarding and revoking facets are a useful comparison: possession of a forwarding capability is deliberately separated from possession of the mechanism that changes its availability. Miller, Yee, and Shapiro’s *Capability Myths Demolished* gives a concrete account of this separation. ([Agoric Papers][1])

The Plan 9 analogy is also useful, but specifically for **locally assembling a naming environment over resources**, not as a reason to import filesystem resolution, enumeration, or fallback semantics. ([9P][2])

### The current generator constructs a prefix restriction—not an exact operation set

Let \(D\) be the generated set of names, including `identity.check`, and define:

$$
G_D(w)=\operatorname{compose}
\left(\operatorname{refuse},
\{k\mapsto\operatorname{at}(w,[k])\mid k\in D\}\right).
$$

Expanding your definitions gives, for valid paths:

$$
\operatorname{send}(G_D(w),p,x)=
\begin{cases}
\operatorname{send}(w,p,x),&
p=k:q,\ k\in D,\\
\operatorname{refused},&\text{otherwise}.
\end{cases}
$$

Consequently, the exposed domain is **all paths beginning with a declared name**, not just the one-segment operation paths. This is exactly the significance of your `["echo","x"]` example. 

Two useful derived laws, for these unguarded restrictions over the same retained access, are:

$$
G_D(G_E(w))\approx G_{D\cap E}(w)
$$

and therefore

$$
G_D(G_D(w))\approx G_D(w).
$$

These are good generator-independent conformance properties. They do **not** imply that duplicating an arbitrary guard is harmless.

**My release recommendation is to make generated operation children origin-only**, unless suffix forwarding is an intentional feature of the generated protocol. You can express this entirely using the existing construction:

$$
\operatorname{leaf}(v)=\operatorname{compose}(\operatorname{origin}(v),\{\}),
$$

then generate each child as:

$$
k\mapsto\operatorname{leaf}(\operatorname{at}(w,[k])).
$$

The child remains complete access: it accepts or refuses at its own address and refuses every nonempty suffix. No new `Wire` primitive is needed.

This would make “the complete operation domain” an accurate description of the enforced domain. The current prefix-preserving form remains useful as a separately identified namespace adapter.

### Three different meanings should remain separate

**The retained description is algebraic structure.** For fully declared trees, the initial-algebra framing supports structural induction. With opaque children, the relevant object is a finite description with opaque access at its boundary. Induction stops there; it establishes nothing about whether an opaque child loops, changes its target, or shares state elsewhere. Your description already distinguishes finite construction from a potentially cyclic routing graph. 

**The bound access has interactive behavior.** A state-transition model is appropriate for reasoning about its requests, controls, replies, shared state, and lifetime. A bisimulation argument would need to relate those states—not merely compare tree shape.

**The interpretation is not injective.** A refusing leaf and a refusing node with one refusing leaf child can produce identical send observations while having different declared shapes. Thus structural identity implies more information than behavior alone provides. There can be no general inverse from bound access back to parts, which agrees with your explicit distinction between missing children and existing refusing children. 

An interface-type framing is therefore helpful only with qualifications: the generated declaration witnesses an intended message interface and constructs a routing restriction. It does not prove that the target implements the interface, that every operation is available, or that separately rebound operations still form one coherent service.

### Names and live capabilities belong in different artifacts

I would keep live capabilities in the **bound, local assembly**, while optionally adding a portable manifest containing symbolic names, protocol declarations, and binding requirements:

$$
\operatorname{bind}(\text{manifest},\text{explicit authority environment})
\longrightarrow \text{retained declared assembly}.
$$

Knowing a manifest name should not itself grant access; the binding environment supplies that authority.

This resolves the names-versus-live-access tension without pretending that a live assembly is serializable or content-addressable. A manifest digest identifies the manifest, not the current guards, target objects, or behavior of its binding. This is a proposed separation of artifacts, rather than something the present implementation already provides.  

## 2. Work already in flight: the release-critical contract

### Admission, route capture, and execution are different moments

Your definition of admission is acceptance for delivery. The dispatcher’s capture happens later, after delivery and registration matching. Those are not interchangeable commitment points.  

Here is an important counterexample derived from the excerpts:

1. A request is accepted into a carrier.
2. Before delivery, the receiving dispatcher replaces the registration for `echo`.
3. The request arrives and captures the new registration.

The request was already **admitted**, but its handler had not yet been selected. The excerpt therefore supports “controls follow the captured traversal,” not “every request admitted before a rebind reaches the old handler.”

There is another qualification: an immutable composite retains the same child **object**, but an opaque child can itself contain mutable routing state. Retaining that object is not necessarily retaining its current destination.

I would distinguish four commitments:

| Commitment                            | What it establishes                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Caller captures a bound access value  | Subsequent replacement of an assembler’s root variable does not replace that value.      |
| A `Send` is admitted                  | The receiving component has accepted responsibility according to its admission contract. |
| A dynamic router captures a traversal | That traversal’s subsequent controls belong to the captured destination.                 |
| A handler begins execution            | Application effects may now occur; cancellation is not an undo operation.                |

The first is supplied by immutable assembly; the latter commitments need runtime rules.

### State a traversal-stability guarantee, not a global snapshot guarantee

I would put something like this in the contract:

> Reconstructing an assembly from retained parts does not retarget existing bound access. Once a runtime routing stage captures a request’s traversal, subsequent changes to that stage’s registrations do not retarget that traversal’s controls. An invocation’s replies remain associated with its original return capability. These guarantees do not freeze uncaptured downstream routing decisions, preserve closed resources, or guarantee completion after transport failure.

That matches the architecture more closely than an unrestricted promise about “work already admitted.”

A stronger guarantee—“every call belongs to one end-to-end assembly generation”—would require versioned routes, coordinated capture, or another explicit generation protocol. Several independently changing routers do not acquire a common snapshot merely because their local descriptions are immutable.

For a mutable root selector, define a precise atomic selection point. Herlihy and Wing’s linearizability framework is useful here: the **selection or admission operation** can have a well-defined instantaneous effect without claiming that the entire asynchronous application operation completes atomically. 

### Keep composites stateless; make invocation lifetime stateful in the runtime

Removing the composite-owned cancellation table was the right direction. But that does not eliminate the need to retain invocation-specific state. It places that state with the runtime’s invocation owner and dynamic routing stages.

The runtime should retain what is needed to identify an invocation, deliver its controls, settle its local outcome, and release associated resources. Your receive-side traversal capture already does part of this. The gap is that the sending path can become unusable while the invocation is still outstanding.  

The useful ownership pattern is:

**Stop admitting new business traffic, retain the paths and state owed to admitted work, then reclaim them.**

Linux RCU’s separation between removal and reclamation is a good analogy: publishing a replacement and making the previous version safe to destroy are distinct operations. This is an ownership analogy, not a recommendation to implement kernel-style RCU. ([Kernel Documentation][3])

There is a necessary qualification: holders of old bound access can continue starting calls unless a separate admission gate stops them. Merely publishing a new root does not start a finite drain.

I would provide a runtime-managed distinction between:

* **Graceful shutdown:** refuse new requests and events, preserve owed controls and required receive state, and detach after draining or reaching an explicit deadline.
* **Abort:** end local pending invocations with an appropriate failure outcome and release what can safely be released; do not imply that remote execution stopped.

This can sit above `Wire`. It does not require adding invocation bookkeeping to every composite. A low-level `Through.Close` may remain abrupt, but managed proxies must not mistake it for graceful completion.

### Cancellation needs delivery guarantees and limits—not just pass-through advice

For a profile-conforming admission guard, my recommended rule is:

> A decision to stop admitting new work must not, by itself, prevent delivery of valid controls belonging to previously admitted work.

An admission-only guard can pass cancel frames unchanged and leave correlation checks to the invocation runtime. A more selective guard needs runtime-established invocation state; it should not reconstruct authorization from sender-controlled metadata.

The runtime also needs explicit behavior for cancellation before admission finishes, before traversal capture, after completion, and concurrently with a reply. A pending cancellation may need to wait for admission or capture to resolve rather than disappear in the gap.

Preserve the original local `ReturnAddress` and its associated context. Your excerpts identify why replacing it is not a transparent wrapper operation. 

Even successful cancellation delivery does not prove that the handler stopped before producing effects. gRPC’s cancellation documentation makes the analogous distinction: the runtime generally cannot interrupt arbitrary handler code; the handler must cooperate. ([gRPC][4])

### Give synchronous refusal a strong, carefully bounded meaning

I recommend preserving synchronous refusal as proof of non-publication—but making the obligation explicit for **every admitted implementation of `Wire`**:

> Returning a synchronous refusal means this send has not made the request, or authority newly exported solely for it, available beyond its pre-admission machinery, and no deferred action from this send will publish it later.

That does not mean the guard performed no local bookkeeping or logging. It means that disposing of call-local exports is safe.

Once a component has crossed its publication boundary, a later transport error cannot truthfully become `Unpublished`. A carrier may need to admit into an owned queue and report subsequent failure through invocation completion, rather than return an ambiguous write failure as a synchronous refusal.

The distinction should look like this:

| Sender observation                                   | What may be concluded                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Synchronous refusal satisfying the contract          | This send was not published.                                                                           |
| Acceptance, followed by timeout or disconnection     | Publication was possible; remote effects may be unknown.                                               |
| An asynchronous `method_not_found` or other response | A published invocation received that response; this is not the same evidence as local non-publication. |

Your current callable cleanup makes this distinction operationally significant. **Do not erase it merely to make raw and declared access appear equivalent.** 

Nor should a generic error response authorize reclaiming every capability carried in the request. That needs the reference protocol’s release rules. Cap’n Proto’s protocol is a useful comparison because call completion, cancellation, and capability release are represented explicitly rather than inferred from an application error string. 

### A refused message must not ordinarily destroy its forwarder

**Change the forwarder’s refusal policy before release.**

A downstream `busy` or `no route` should normally produce a failure for that request, not detach the shared forwarding path and disrupt unrelated invocations. For an event, apply a documented discard/reporting policy. Reserve detachment for actual transport termination or a defined connection-fatal protocol violation.

Give locally generated routing refusals a deliberate public error representation rather than accidentally converting them to `internal`. The exact code is less important than its specified scope and meaning.

The supplied document reports detachment for `busy` and infers the same behavior for `ErrNoRoute`; that is sufficient reason to treat the policy as a release issue, while still testing the inferred branch directly. 

A downstream refusal remains asynchronous from an upstream sender that already published to the forwarder. It cannot retroactively restore that sender’s non-publication proof.

### Ordering and faults require narrower laws

Specify a partial order: sender program order where applicable, carrier ordering within its stated scope, and the lifecycle order of each invocation. Do not infer one global delivery order across independent carriers.

In particular, changing the transport path can allow a later call to overtake an earlier one. Cap’n Proto’s `Disembargo` protocol exists specifically to preserve ordering when capability resolution changes the path messages travel. Your system need not adopt that protocol, but it should either preserve such ordering deliberately or decline the guarantee across path changes. 

For equivalence, I would separate:

**Local assembly equivalence:** contextual equivalence for reconstruction using the same retained capabilities, shared state, and lifecycle resources.

**Transport realization correctness:** preservation of the logical protocol under stated carrier assumptions, with explicit mappings for return capabilities, context, and reference scopes.

**Fault behavior:** refinement of a lifecycle specification that permits uncertain remote outcomes but forbids miscorrelation, false `Unpublished` results, and multiple local terminal settlements.

Adding a carrier adds failure possibilities. Even without faults, comparable admission capacity and reference translation are additional obligations; “connected and ordered” alone is not a complete realization theorem. Your current relation already treats faults separately, which is the right starting point. 

The fundamental uncertainty is easy to exhibit: a disconnected caller may be unable to distinguish “the request never executed” from “it executed and the reply was lost.” Rebuilding a tree supplies no evidence that distinguishes those histories. Automatic retry therefore needs an application-level idempotency or deduplication contract.

## 3. Authority and interception

### Parts are authority-bearing, not merely descriptive

Retained parts include executable capabilities. They can allow an assembler to bypass an **outer** guard by rebuilding from the access inside it. Conversely, a guard retained as an opaque child remains part of that child’s authority boundary.

The practical rule should be:

> Delegate guarded bound access to consumers. Delegate parts only to parties authorized to assemble from the capabilities those parts actually contain.

Do not describe parts as harmless introspection. Also note that the Go origin is itself a `Wire`: its retained object may support nonempty paths that the composite never exposes. That extra authority matters when parts are delegated, even though it causes no problem when they remain with their original assembler.  

This separation should operate within an explicit trust model. The API controls which capabilities ordinary callers receive; it should not be advertised as isolation from arbitrary unsafe or reflective code in the same process.

### Guard placement determines both coverage and meaning

I would use three distinct interception locations.

**Admission guards around send access** govern outgoing requests and events traversing that access. A standard runtime helper should preserve the message and return capability, invoke admission policy exactly once per crossing, and handle lifecycle controls according to the rule above.

**Ingress enforcement before trusted dispatch** governs what an untrusted peer can make the server do. A client-side generated facade is not this boundary: a peer that can send raw frames need not use its local generated wrapper.

**Capability-aware gateways** govern references introduced by requests, replies, callbacks, and returned values.

The second point is an important consequence of your send-only limitation: a security-relevant restriction must be installed on every relevant path through the trusted exporter, not merely offered as a convenient client view. Your call trace establishes only which traffic traverses the shown tree. 

Guard location also changes the path it observes. A guard outside a selection sees the reconstructed prefix; a guard around the selected child sees the child-relative path. Moving one to the other location is not a neutral rewrite unless its policy is correspondingly transformed and its state effects preserved.

### This is not a membrane

A membrane mediates capabilities crossing its boundary, including capabilities carried in arguments and results. Cap’n Proto’s membrane documentation explains exactly why a simple revocable wrapper is insufficient: a capability passed through a call can establish a new path that bypasses that wrapper. 

Your live-reference mechanism has precisely that separate path: invocation and release use the connection directly, and cross-connection forwarding requires re-exporting descriptors. 

Therefore, promise **route-level attenuation**, not confinement or transitive revocation. An allowed operation may return broader authority or cause callbacks outside the tree.

A future membrane belongs where the runtime or generated converters understand capability-bearing payloads. It needs identity-preserving import/export tables, policy for references crossing in both directions, and explicit lifetime ownership.

It cannot be implemented as an ordinary transparent guard that replaces `ReturnAddress`. Such a gateway must participate in the invocation protocol and use an explicitly defined correspondence between its upstream and downstream calls.

### Treat `Through` as an asymmetric endpoint adapter

`Through(origin, access)` combines two independently supplied powers. It does not establish that they constitute a coherent service session. That can be useful, but the API should make the asymmetry prominent.

Because arbitrary access is opaque, attempting to verify by inspection that it “really routes to origin” conflicts with the abstraction. Legitimate fan-out also means there may be no single matching endpoint.

I would retain a clearly identified low-level adapter, while having generated proxies use a runtime-owned **session assembly** that records receive attachment, outgoing binding, callback routing, and shutdown ownership.

The single receiver slot is especially important: several selected service views cannot each independently borrow and own it. A runtime dispatcher or broker should own that attachment and provide appropriately scoped receiving views.  

Add a test that rebinds sends to a different carrier and then performs a **new callback-bearing call**. A delayed reply surviving a rebuild does not establish that callbacks and events from the new target reach the old `Through` origin.

### Narrow the confidentiality claim

Replace “send access reveals no structure” with:

> Send access provides no operation for enumerating or recovering the retained assembly. Its behavior may reveal facts about reachable routes and policy.

A refusal is not a reliable proof that a child is absent: an existing child or guard may refuse identically. Successful admission or distinguishable outcomes may nevertheless reveal information. Thus there is neither general structural introspection nor general structural secrecy.  

Given that family operation lists are public, this is largely a clarification of the abstraction—not a reason to discard useful synchronous refusal. 

## 4. Which consumer structure belongs in routes?

My criterion would be:

> Put stable, independently delegable access boundaries in declared routes. Put changing lookup mechanisms behind explicit dynamic access. Put domain navigation in request data unless making it a route provides a concrete authority or composition benefit.

A domain happens to be a tree is not, by itself, a reason to make every domain edge a messaging route.

### BitTree: retain the accepted separation

I recommend retaining BitTree’s flat service interface and passing repository addresses as request data.

The UTF-8 mismatch is solvable with an injective segment encoding—for example, a specified lowercase hexadecimal encoding of each complete byte key. But that solves only spelling. It does not make implicit body traversal, name/index lookup, numeric aliases, or deferred loading equivalent to exact one-segment routing. 

Do not quietly import those resolver rules into a Bitwire binder. Keep the domain resolver explicit.

A useful route-level capability would instead be **a repository- or snapshot-scoped service facet**. Its server-side resolver can be bound to the relevant repository or observation. Merely selecting a Wire prefix cannot scope addresses supplied independently in request data; your accepted design correctly says so. 

### Bitsystem: distinguish a space’s model interface from its child-space namespace

Bitsystem is a closer fit, but there is an additional distinction beyond the four listed differences: **an own model with several operations is not the same thing as one pathless origin behavior**. The generated family currently represents that model through operation children.  

I would introduce an explicit consumer-level route schema, conceptually:

```text
space
    own behavior
    ops       -> generated model interface
    children  -> child-space namespace
```

A model operation `plan` and a child space `plan` then occupy different namespaces. Typed adapters hide these routing conventions from the domain API.

This is a deliberate mapping from the space model to a routing tree, not a claim that the two trees are literally identical.

For growth, choose explicitly between:

**Retained generations.** Each published description is finite. Adding a child creates a new description; old bound access retains the old route domain.

**Live discovery.** A stable opaque child implements dynamic lookup. Its current internals are not available as retained Deixis parts unless its owner separately exposes a snapshot.

Both are legitimate. Combining them without naming the distinction is where trouble begins. In particular, an own model that lists children should either use the same generation as its routes or explicitly promise live listing semantics. Otherwise it may announce a child that its associated retained routes cannot reach.

Keep canonical parenthood in Bitsystem’s domain model. Mounting one access under two names creates two access paths, not necessarily two domain parents.

### Returned capabilities need their own ownership contract

A returned callable is a newly delegated capability with a lifetime, not automatically an attached child.

An assembler can later mount an adapter for it, but that requires explicit binding, interception, and ownership decisions. Until the live-reference path participates in those decisions, closing the route that originally returned the callable does not revoke it. 

Bitsystem’s goal of discovering a capability, invoking it, receiving another capability, and continuing composition is compatible with `Wire` as a foundation. It is not yet supplied by declared composition alone.

### Keep layer ownership as you have assigned it

Deixis should retain byte-key structure and its structural laws. Bitwire should specify exact segment encoding and the access interpretation. Nightseam should own protocol reservations, generated operation layout, carriers, and lifecycle. Each consumer should own the mapping of its domain names, addresses, and child structure into that interface. 

Do not make runtime-reserved operation prefixes a universal ban on arbitrary domain names at every depth.

For retained generations, attachment preserves old slots—not all observable aggregate behavior. Overlay still requires agreement at shared slots, including the root. Cuts must retain complete boundary capabilities, including their guards and shared state; cuts through opaque runtime internals are not justified by the declared-tree laws.  

## 5. Additional risks and the release gate

### A compatibility digest is not a description of the assembled service

Keep `identity.check` explicit. Distinguish **compatible**, **incompatible**, and **unverified because the check is unavailable**. Compatibility is not authentication.

More importantly, a digest obtained from the original target cannot certify the behavior of an assembly whose operations were individually rebound. Two implementations might share a declaration while one operation reads state A and another writes state B.

That does not prohibit rebinding. It means generated operation facets are not automatically independent substitution units. Your context-sensitive substitution rule should appear in generator documentation, not only in the foundational contract.  

### Message immutability needs an explicit boundary

The snippets retain the message while copying route containers and path slices. They do not establish when mutable payload or metadata storage becomes immutable or is copied.  

This matters for a guard that validates data later serialized asynchronously. Specify whether ownership transfers, callers must cease mutation, or the runtime snapshots profile fields. At a security boundary, the data checked and the data admitted must be the same snapshot, while the local return-capability identity remains intact.

### Finite descriptions do not provide resource bounds

Opaque routing can cycle, including before any dispatcher capture limit applies. A request-capture bound also says nothing by itself about event loops.  

Specify resource responsibilities for admitted runtime components: bounded queues, invocation/export limits, and an explicit policy for cyclic forwarding. Do not claim that the constructor can prove termination of arbitrary opaque access.

### The minimum additional conformance program

I would add the following focused scenario families rather than require an exhaustive cross-product before release:

| Scenario                         | Required observation                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Generated operation facets       | Guard exactly one operation, remount it under another key, test suffix behavior, and exercise identity success, mismatch, and unavailability.                               |
| Admission versus capture         | Pause after carrier acceptance but before dispatcher capture; rebind; verify the documented destination rule. Repeat after capture.                                         |
| Shutdown and controls            | Admit, stop new work, cancel, and deliver a delayed reply. Verify graceful drain separately from abrupt abort.                                                              |
| Refusal isolation                | A downstream `busy` or missing route fails only the affected request; unrelated in-flight and subsequent calls remain usable.                                               |
| Correlation races                | Concurrent calls with the same local frame ID but different return capabilities; controls before readiness, duplicate controls, late replies, and stale attachment endings. |
| Carrier and reference boundaries | Inject failure before and after admission; cross two connections with live references; check translation, release, context, and truthful publication evidence.              |
| Snapshot and input ownership     | Mutate caller-owned containers, exercise exact Unicode edge cases, and retain old access across growth without silently changing its declared domain.                       |

The same scenarios should distinguish **existing behavior**, **required behavior**, and **explicitly unsupported behavior**. In particular, “unsupported cross-connection live forwarding” should fail clearly rather than masquerade as transparent composition.

### What must be settled now, and what can wait

**Before release:** settle generated exact-versus-prefix domains; synchronous-refusal evidence; per-message versus connection-fatal forwarder errors; admission-versus-capture guarantees; cancellation and close ownership; the asymmetric scope of `Through`; and the non-membrane security claim. Test those decisions in Go and TypeScript through the independent contract suite where applicable.

**Later:** portable manifests, full membranes, transparent reference mobility, globally coordinated routing generations, stronger cross-path ordering, and broader formal verification. None is necessary to preserve the small send-only foundation—provided the release does not imply that it already supplies them.

The durable architectural boundary is this:

> **Declared trees decide where a send goes through the retained assembly. The invocation runtime decides what remains owed after admission. Capability-transfer machinery decides which new paths of authority a conversation creates.**

Keeping those responsibilities separate preserves the simplicity of Deixis and `Wire` without making their laws responsible for guarantees they cannot establish alone.

[1]: https://papers.agoric.com/assets/pdf/papers/capability-myths-demolished.pdf "capmyths-3.doc"
[2]: https://9p.io/sys/doc/names.html "The Use of Name Spaces in Plan 9"
[3]: https://docs.kernel.org/RCU/whatisRCU.html "What is RCU? -- “Read, Copy, Update” — The Linux Kernel documentation"
[4]: https://grpc.io/docs/guides/cancellation/ "Cancellation | gRPC"

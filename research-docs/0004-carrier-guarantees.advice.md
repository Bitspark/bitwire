# Advice for consult
**Research doc:** doc_90198353-fd44-4d82-9e19-1eb08ee241de.md
**Document:** doc_90198353-fd44-4d82-9e19-1eb08ee241de
**Advisor:** ChatGPT GPT-6 Pro
**Session:** nsess_4e7ba72c-0903-4b60-bfdc-b5b44b5590d2
**Run:** run_0433aa85-2cb9-4776-aeb8-18070e987502
**Chat:** https://chatgpt.com/c/6ab93687-2308-83eb-9eff-61faa1c09133
**Verify:** nightfall consult verify run_0433aa85-2cb9-4776-aeb8-18070e987502 --output <this file>

# Response to Research 0004

I would adopt **explicit publication evidence for D1, owned snapshots for D2, bounded queued-work draining for D3, structured termination information for D4, and strict incremental framing for D5**.

I would not adopt the packet unchanged. The important amendments are that publication evidence does not automatically compose across boundaries; draining must cover the public admission boundary rather than a particular internal queue; and a close code selected locally is not necessarily a close code written successfully or observed remotely.

For the implementation that is waiting, **D4’s local error and capability definitions and D5’s framing can proceed without settling a new operational-failure code for `bitwire/1`**. That code policy should not be introduced indirectly through an unqualified, supposedly revision-independent carrier requirement.

The recommendations below use the packet’s quotations of the binding decisions and its reported implementation behavior. I have not independently audited the complete content-addressed scope bundle or the implementation source. That matters particularly for the interpretation of decision 0008. The packet itself distinguishes the immutable protocol text from implementation precedent. :chatgpt-content-reference{index="0"}

I have also prepared :chatgpt-content-reference{index="16"}[a proposed conformance pack](sandbox:/mnt/data/bitwire-proposed-conformance-pack.zip): **88 byte-exact framing vectors, 32 controlled scenarios, and a harness guide**. These are proposed expectations, not observations recorded from bitruntime.

## 1. What a send promises: D1 and D2

### D1: adopt B, with stricter rules for the evidence

The central contract should be:

> A successful `Send` reports admission at that boundary, not delivery, processing, or completion of an application effect.
>
> An error from `Send` does not, by itself, establish non-publication.
>
> Non-publication evidence identifies one send attempt at one declared boundary. It certifies that the attempt has not crossed that boundary and that no retained or deferred action attributable to the attempt can cross it later.
>
> Evidence MUST NOT be inferred from a public error code, a timeout, disconnection, cancellation, an unrelated nested error, or the synchronous timing of an error.

Require roots and local pairs to provide this evidence for their ordinary pre-admission refusals. Do not require callers to know which implementation they are using to recognize it.

However, **“can never be forged” is too strong for arbitrary in-process implementations**. A dishonest or defective component can lie through any interface. An opaque local evidence object can prevent accidental manufacture from serialized error fields; it cannot make arbitrary code trustworthy. The guarantee ultimately rests on the component’s contract and conformance.

#### Composition must account for the outer attempt

Consider a tee:

```text
Outer Send
  ├─ branch A publishes successfully
  └─ branch B refuses with genuine Unpublished evidence
```

B’s evidence is valid for B’s attempt. It is not evidence that the outer attempt was unpublished.

The same problem arises when a wrapper publishes, then fails while updating bookkeeping or running another operation. Finding an `Unpublished` value anywhere in its error chain is not sufficient.

There is an additional boundary issue in your definition: handing a message to a component that may publish it already counts as publication. Therefore:

> A forwarding component may preserve evidence as evidence for the same boundary, or derive evidence for its own boundary when its complete forwarding behavior justifies that derivation. It MUST NOT silently relabel inner-boundary evidence as outer-boundary evidence.

A transparent forwarding chain can declare a shared admission domain. Otherwise, preserve the inner evidence as diagnostic detail, not as a certificate for the caller’s original send. The domain cannot be enlarged retrospectively after an error.

Use an opaque attempt token or equivalent local association. Reusing the same message object for a second send must not reuse the first attempt’s evidence.

#### The three-valued outcome is useful, but not a complete internal model

I would retain *unpublished*, *answered*, and *unknown* as a caller-facing summary, while representing two independent facts internally:

```text
Completion:           pending | response | local failure
Publication evidence: certified unpublished | no such certificate
```

This avoids several ambiguities:

A locally generated `busy` completion can coexist with non-publication evidence. A locally synthesized `disconnected` response is not evidence that the destination answered. A received application error named `disconnected` can be a genuine response without indicating that the local carrier closed.

For a terminal summary, give certified non-publication precedence; otherwise distinguish a genuine response from a locally terminated wait. While the call remains live, it is simply pending.

A later failure while sending a **cancel** must not become evidence about publication of the original **request**.

#### The local outstanding-call limit

**Require evidence for the local `busy` refusal; do not require synchronous timing in the generic carrier contract.**

A synchronous marked refusal is a good implementation choice when the carrier can atomically reserve the relevant quota before admission. But moving the check must preserve the revision’s quota definition, admission ordering, and overflow behavior. “No frame is sent” does not establish that every rearrangement of the admission pipeline is behaviorally neutral.

An asynchronous local refusal may carry equally strong evidence. That provides a staged path without first restructuring the engine.

The helper correction applies to **both languages**: the packet says both helpers infer non-publication from arbitrary synchronous errors, while TypeScript roots and pairs currently throw unmarked errors. Add evidence at the actual TypeScript admission boundary before removing the helper inference, so legitimate retry behavior does not disappear during migration. :chatgpt-content-reference{index="1"}

#### Comparable systems: useful distinctions, not interchangeable promises

HTTP/2’s `REFUSED_STREAM` and `GOAWAY` establish specified forms of **non-processing**, even though request bytes may already have reached the peer. They are not evidence of your stronger local non-publication property. gRPC likewise distinguishes requests that never left the client from requests that reached the server library but not application logic. RabbitMQ publisher confirms concern acceptance by the broker, separately from consumer acknowledgments. The lesson is to name precisely which boundary an acknowledgment or refusal covers—not to import their retry rules into bitwire. :chatgpt-content-reference{index="2"}

**Placement:** evidence, provenance, helper behavior, and local completion representation belong in the carrier/API contract. Retry decisions remain with applications.

### D2: specify stable ownership, not a physical copy at every layer

Recommended contract:

> The caller MUST keep mutable inputs stable while `Send` is executing.
>
> Before admission, the carrier MUST establish an owned, stable representation of the message and validate the representation it will use.
>
> After `Send` returns, subsequent mutation of caller-owned inputs MUST NOT change an admitted message or any bytes subsequently emitted for it.
>
> The original in-process return capability MUST retain its identity.

The stability requirement includes the path, nested payloads, metadata, trace fields, and mutable public-error data—not merely the top-level message structure.

The return capability is not payload to deep-copy. Preserving its identity is already part of decision 0007. :chatgpt-content-reference{index="3"}

Apply the same observable rule at the transport seam: after a send returns, later changes to the caller’s byte buffer cannot alter the queued frame.

**No, this does not require copying at every layer.** A stable representation can be transferred between internal layers, shared immutably, or exclusively owned. A synchronous writer may finish using caller storage before returning. What must not happen is an asynchronous layer retaining a mutable alias after returning without a lifetime agreement.

Also, “copy at the start of `Send`” does not make concurrent caller mutation safe. The caller-stability rule closes that gap.

For structured values, define snapshotting in terms of the existing codec’s value model. Do not let incidental `JSON.stringify` behavior—such as invoking `toJSON`, changing unsupported values, or applying an unspecified normalization—become the cross-language contract.

**Essential cases:** mutate every mutable input after return; hold downstream writing blocked; verify the original value and bytes; and independently verify return-capability identity.

**Placement:** carrier and transport ownership contracts now. Copy-elision techniques belong in implementations.

## 2. Closing: D3

### Adopt B, but call it a queued-work drain

Your B is not graceful completion of outstanding RPCs. It is:

> Stop admitting new locally initiated work, flush already-admitted outgoing work within a finite budget, then perform transport closing.

That is a useful guarantee. Do not describe it as finishing requests in flight.

The first correction is its scope. The packet says successful endpoint sends enter the **root queue**, before the output queue. Draining only the output queue would let two implementations provide different shutdown guarantees merely because they have different private queue arrangements. :chatgpt-content-reference{index="4"}

### Define two ordered barriers

The **admission barrier** stops new locally initiated requests and events. Every outgoing message admitted before it is covered by the drain, wherever it resides internally.

The **writer seal** is the final serialization point after which no additional message can enter the outgoing stream. Valid controls for existing invocations remain eligible before that seal. The close record follows all output admitted before the seal, unless draining fails.

This reconciles the need to stop new work with the earlier advice that closing must not immediately disable controls owed to admitted work.

A concurrent send must fall on one side of a defined boundary:

> If admitted before the applicable barrier, it is included in the drain obligation. If refused after the barrier, it is locally unpublished. No data may be written after the side’s close record.

### State separately what each kind of work is owed

| Work at shutdown | Recommended obligation |
|---|---|
| Admitted outgoing events and requests | Include them in the bounded output drain, including work still above the transport seam. |
| Responses and cancels already admitted for sending | Preserve their established ordering and include them in the drain. |
| A refusal already decided but awaiting local return delivery | Preserve the refusal; do not replace it with `disconnected`. |
| Local calls still unanswered when termination occurs | Settle once with a local closed failure, retaining cause and publication uncertainty. |
| Running handlers and inbound work requiring future application execution | Do not wait for their completion as part of B. Do not imply that cancellation stopped their effects. |

The “exactly once” promise should concern **local terminal settlement of a registered call**, not a guarantee that every remote request receives a response frame. A broken connection cannot support the latter.

Choose terminal outcomes atomically. A response or refusal already settled must not be overwritten by a simultaneous timeout or close. Late responses must not cause a second settlement.

When a receiver attachment ends, its `Closed` notification must be final for that attachment: no subsequent `Message` delivery. Establish pending local terminal outcomes before publishing final closure, without running arbitrary callbacks under shutdown locks.

### Bound the entire operation with one deadline

Use an absolute close deadline covering:

```text
drain + current write + close write + reply wait + bounded disposal
```

Each operation may also have its existing, shorter write deadline. Incremental progress must not restart the total budget.

On expiry, abort and report an unsuccessful close/drain. A successfully exchanged close can coexist with an incomplete local drain; represent those facts separately.

Because the endpoint API has no context parameter, its binding must define a finite construction-time close budget or introduce an explicit bounded-drain operation. Do not leave it to a library’s hidden timeout.

A successful drain proves only that the covered output reached the specified transport flush boundary. It does not prove application receipt or processing.

### Handle remote close differently from local drain

A received close can interrupt a local drain. I recommend:

> After processing a valid peer close, do not start another queued data record. Finish an already-started record only when necessary for framing integrity and possible within the remaining deadline; then reply, unless a local close was already committed.

Report abandoned queued output as an incomplete drain. Otherwise both sides can spend their closing budget flushing data that the other side has already stopped delivering.

While locally draining, continue required protocol receive processing. B does not establish a negotiated “no new incoming requests” state, and it must not introduce a third wire meaning for `busy`. A GOAWAY-like agreement belongs in revision 2.

### Overflow is not one universal rule

Preserve revision 1’s root-overflow termination rule. Also preserve the distinction between that immediate refusal and queues subject to pacing: the packet binds waiting for output capacity and stalled inbound consumers to a write deadline, while specifically excluding the root queue from pacing. :chatgpt-content-reference{index="5"}

Thus a full output queue must not automatically inherit the root queue’s immediate-failure policy.

Root-only isolation remains a revision-2 candidate. However, bounded internal storage for terminal settlement is not inherently a protocol change. Preserve the already-required cancel reservation now; do not use an unbounded cleanup queue or reorder accepted controls under the label of “reserved capacity.”

**Placement:** local settlement, explicit barriers, and truthful close results belong in the carrier contract. A mandatory wire-visible drain policy needs the separately identified conformance treatment discussed in section 5. GOAWAY and changed root-isolation semantics belong in a later revision.

## 3. Close codes and the closed classification: D4

### Separate numeric validity, capability, and semantic permission

These are three different questions:

```text
Is this number allowed in an encoded close?
Can this adapter emit it?
Does the selected protocol permit it for this condition and role?
```

For the proposed carrier/stream code vocabulary, adopt the packet’s numeric set:

```text
1000–1003, 1007–1014, 3000–4999
```

Reject 1004, 1005, 1006, 1015, and other excluded numbers. Freeze that set explicitly; do not make an immutable format’s acceptance behavior change whenever a registry changes.

Do not describe the entire permitted range as assigned or semantically interchangeable. IANA distinguishes registered values, unassigned values, and private-use space; 4000–4999 is private use. Numeric validity also does not override role-specific WebSocket restrictions. :chatgpt-content-reference{index="6"}

### An invalid close request must have no closing side effect

Recommended contract:

> Validate the code and reason before changing connection state.
>
> An invalid close request MUST return an argument error without sending anything or ending an otherwise-open connection.
>
> An adapter unable to emit a numerically valid requested code MUST report an unsupported-capability error. It MUST NOT substitute 1000, omit the code, or abort silently.

Use distinct concepts such as `UnsendableCode` and `UnsupportedCloseCode`.

Validate reason encoding and length too. Reject an oversized or unrepresentable reason; do not silently truncate it or replace malformed text.

A valid repeated close should join the existing ending rather than overwrite its parameters or send a second close. `Abort` should be idempotent and may interrupt an outstanding close.

### Which code should an operational failure use?

My recommendation is:

| Condition | Recommendation |
|---|---|
| Malformed `bitwire/1` envelope, or binary frame used as its envelope | Preserve **4011**. |
| Frame exceeds the receiver’s bound | Preserve **1009**. |
| Write path has failed, or a partially written record cannot be completed safely | **Abort; transmit no additional close record.** |
| Writable operational failure: overload, stalled consumer, root overflow | For revision-1 implementations, prefer **abort** as the conservative policy. Do not turn a new private-code mapping into a universal `bitwire/1` requirement through the carrier contract. |
| Future uniform operational-failure signal | Define it in a later protocol revision or an explicitly authorized behavior profile—for example, private code **4012**, meaning “carrier unavailable,” without implying retry safety. |

The packet’s normative extracts bind 4011 and 1009 but leave the operational-failure code unspecified. That permits an implementation choice; it does not by itself settle whether decision 0008 authorizes a new mandatory cross-implementation choice. :chatgpt-content-reference{index="7"}

I would stop using 4011 as the catch-all operational policy in new implementations, but I would not declare every existing operational use of it a revision-1 violation when the supplied scope leaves the choice open.

This does **not** block byte-stream implementation. The framer has its own defined errors, while the peer applies the selected protocol’s termination policy.

### The browser capability gap is larger than code selection

The browser API permits script-requested close codes only at 1000 and 3000–4999. Its `close()` also does not discard previously queued messages before closing, and its interface exposes no immediate abort operation. Therefore a wrapper around that API cannot simply promise a genuine bounded, immediate transport abort or reliable script-requested 1009 at a custom receive limit. :chatgpt-content-reference{index="8"}

A private operational code does not fix the mandatory 1009 problem.

Publish an explicit capability distinction. An adapter missing a required capability must not claim full conformance for a combination that requires it. Do not conceal the gap by remapping codes, and do not weaken the full seam to match the least capable API.

### Preserve a termination record, not one supposedly “real” code

I recommend one local closed classification accompanied by information equivalent to:

```text
ClosedError
  resource: kind and identity
  cause: original local cause
  localClose:
    selected code and reason, if any
    write status: none / partial / complete
  peerClose:
    first complete valid received code and reason, if any
  observedCode
  drainComplete
  handshakeComplete
```

A root error can identify the root while retaining a physical-connection error as its cause. A locally known operational cause must survive delivery through the call helper.

Do not try to preserve that information by serializing it into `ProfileError`. Provide a local-only completion/error-detail path in the bindings. The public projection may remain `disconnected`; the local error must still match the common closed classification.

Conversely, receiving a serialized public error named `disconnected` must not manufacture evidence that this local carrier closed.

For the legacy `Closed(code, reason)` callback, specify a deterministic projection: on a network transport, use the first valid peer close when one exists; otherwise use the transport’s no-peer-close observation. Keep local close selection separately accessible. A local pair can define its logical ending directly.

RFC 6455 explicitly allows the two endpoints to observe different codes; its received-close definition does not equate observation with the code locally selected. Its response-close code echo is typical behavior, not a universal equality guarantee. :chatgpt-content-reference{index="9"}

### Test actions and observations separately—not “1009 or 1006”

Use different controlled cases:

**Healthy path:** trigger the refusal with a functioning writer and cooperative reader. Assert the exact selected close action, complete encoded close, and peer observation.

**Interrupted path:** inject failure at a named point. Assert whether the close was not started, partially written, or completed. Then assert the peer’s observation from the bytes it actually received.

**Simultaneous close:** each endpoint reports the other endpoint’s code. Equality with its own code is not required.

For the refusal-during-write race, a byte-stream writer must finish the current record before writing 4011, provided it can do so within the deadline. If it cannot, it must abort. It must never append a close header inside an unfinished record body.

The local record should then preserve both facts: a protocol violation selected 4011, and output failure prevented a complete close. That is not the same as successfully sending 4011.

### The revision-1 tunnel needs a normative compatibility carve-out

The packet says revision 1 requires transmitting `channel.close` with 1006, while the new carrier guarantee forbids that transmission. Both cannot be satisfied by the same abort behavior. A findings-register entry documents the conflict; it does not, by itself, waive either requirement. :chatgpt-content-reference{index="10"} :chatgpt-content-reference{index="11"}

Keep legacy behavior under an explicitly qualified compatibility claim, or adopt a normative scope exception. Do not claim the unqualified new guarantee for that tunnel.

Revision 2 can define a channel-abort message whose receiver reports 1006 locally. Substituting another `channel.close` code in revision 1 would not preserve its required behavior.

**Placement:** classification, argument handling, and capability declarations now; protocol-condition mappings in revision-specific policy; changed tunnel abort encoding later.

## 4. Completing `bitwire-stream/1`: D5

### Fix a byte grammar and a layer boundary

I recommend the following exact forms. Quoted strings below mean case-sensitive ASCII bytes:

```text
length = "0" or a nonzero decimal digit followed by 0–14 decimal digits

text:
  "Frame: text\r\nContent-Length: " length "\r\n\r\n" body(length)

binary:
  "Frame: binary\r\nContent-Length: " length "\r\n\r\n" body(length)

close:
  "Frame: close\r\nCode: " four-digits
  "\r\nContent-Length: " length "\r\n\r\n" body(length)
```

There is **no delimiter after the body**. The next record starts immediately after its declared number of octets.

Reject duplicate, reordered, or additional headers; unknown kinds; alternate casing; tabs or extra spaces; bare LF; and a BOM or banner before the first header. Retain the 128-byte header cap, including the terminating empty line. The narrower grammar actually permits no syntactic header longer than 61 bytes, so do not invent a “valid 128-byte header” positive vector.

Compare the parsed length against the applicable limit before narrowing it to an allocation-sized integer or allocating body storage.

**My proposed codec boundary is byte-oriented:** the framer preserves data-body bytes and the `text`/`binary` tag. It does not parse JSON or replacement-decode Unicode. For the proposed `bitwire/1` stream binding, its envelope codec performs strict UTF-8 decoding and applies 4011 to malformed envelopes, including invalid text encoding. A binary record is framing-valid but invalid as a revision-1 envelope.

Close reasons are different: they are the framer’s own control data. Require valid UTF-8 and reject invalid close-reason encoding with 1002.

This boundary needs to be explicit in the TypeScript seam; a conversion to a string must not silently repair malformed bytes.

### Disposition of every tentative rule

The following confirms or amends each row of the packet’s gap table. These are proposed rules, not claims that the draft already specifies them. :chatgpt-content-reference{index="12"}

| Tentative rule | Recommendation |
|---|---|
| EOF inside a header or body → 1006 | **Confirm with qualification.** An incomplete valid prefix is truncation: no partial delivery, observation 1006, structured truncation detail. A syntax error already established before EOF remains a syntax error. |
| Partial-record write failure → abort | **Confirm.** After an unrecoverable partial write, submit no more bytes—not even a close record. |
| Four-digit `Code:` naming a sendable code | **Confirm.** Apply the frozen numeric set. Invalid codes request 1002. |
| Close body also consumes the data receive limit | **Amend.** Give close reasons a separate fixed **123-byte control receive limit**. A small or zero data budget should not prevent meaningful closing. Check either kind’s applicable limit before its body. |
| Oversize receiver drains input so sender necessarily sees 1009 | **Replace the guarantee.** Select and attempt 1009 before needing body bytes. Bounded terminal discard can improve delivery, but cannot guarantee it. |
| `Close` drains, sends close, waits; expiry → local 1006 | **Amend.** Bound the whole operation. Expiry fails the close and aborts. Use 1006 only if no valid peer close was received; never overwrite an already-received code with 1006. |
| Simultaneous closes report received codes | **Confirm.** One committed close per direction, no extra reply. |
| Send after own close record → closed/unpublished | **Confirm and strengthen.** Refuse after the writer seal, even before the close record has finished writing. |
| Alternate header case or LF-only endings → 1002 | **Confirm.** No normalization or recovery mode. |
| Stdio stdout only records; exit means EOF | **Confirm stdout discipline; qualify exit.** Read buffered output through actual pipe EOF. Exit status zero is not a protocol close, and process-exit notification must not discard buffered records. |

### Oversize handling needs a bounded closing state, not resynchronization

The oversize procedure should be:

1. Parse and validate the complete header, then determine that the declared body is too large. Stop normal data delivery and select 1009 without requiring any body byte.
2. Schedule the close through the serialized writer. Independently perform bounded terminal input disposal when useful.
3. If the declared length is trustworthy, discard exactly the remaining body before interpreting another record header. Never search the body for bytes spelling `Frame: close`.
4. Stop cleanup on its absolute deadline or explicit discard-byte budget, then dispose of the stream.

An attacker can declare an enormous body and never send it. A legitimate sender can also be blocked midway through a body. Neither permits an unconditional “sender finishes and reads 1009” promise.

When malformed headers destroy record alignment, do not try to locate a later close by scanning arbitrary bytes. Raw bounded disposal may still be useful, but it cannot establish a framed close acknowledgment.

Distinguish normal body reading from terminal disposal in the specification. A gated test should supply only the over-limit header and demonstrate that the close action does not await body input. Bounded read-ahead must not become an excuse to allocate or decode the rejected body.

### Writing and closing rules still needed

“Write each record whole” should mean **no interleaving**, not one system call. Resume a positive short write with no error. Treat an unrecoverable failure after publication-capable handoff as potentially published, including cases where an opaque API provides no trustworthy byte count.

A cancelled send waiting for capacity may be unpublished when no handoff occurred and no deferred write remains. Cancellation after a partial write requires abort.

Input and output must make independent progress during closing. Otherwise a sender blocked in `Send` can prevent the receive-side work needed to notice the peer’s close. A bounded internal read pump is one implementation; the contract need not mandate that architecture.

Half-close the write direction only after the final close record has been fully written. It is safe to half-close then while keeping input alive for the reply. Full disposal remains bounded.

Specify the following additional behavior before publication:

- Automatic replies echo the code with an **empty reason**; automatic framing-error closes also use empty reasons. This makes those vectors exact without reflecting arbitrary peer text.
- After the first valid peer close, deliver no further data and issue no second reply. Trailing bytes cannot replace the recorded ending.
- Cancellation of a `Receive` wait must preserve parser state and buffered bytes under the full seam. It is not an implicit `Abort`.
- Header/record-assembly timeout policy, close deadlines, and discard budgets must be explicit configuration or binding rules—not undocumented per-library defaults.

For stdio, descriptor ownership belongs in the transport binding. Killing, waiting for, and supervising the child belongs outside the carrier contract. Closing the framed connection does not prove that the process exited.

### What LSP contributes

LSP supplies a useful precedent for ASCII headers, CRLF separation, and `Content-Length` measured in bytes rather than characters. It does not specify your `Frame` kinds or your closing state machine. Use that framing precedent without inheriting unspecified parsing tolerances or confusing LSP’s application lifecycle messages with a transport close handshake. :chatgpt-content-reference{index="13"}

### Portable vectors should have two levels

**Framing vectors** should contain raw bytes, configured limits, chunking schedules, EOF events, delivered records, and requested close actions. Hexadecimal works for malformed headers, arbitrary binary bytes, and invalid UTF-8 without source-language escaping differences.

**Session scenarios** should control partial writes, blocked directions, deadlines, simultaneous operations, and transport failures. A byte sequence alone cannot specify those races.

For example, the essential oversize fixture is:

```json
{
  "data_receive_limit": 4,
  "input_ascii": "Frame: binary\r\nContent-Length: 5\r\n\r\n",
  "body_available": false,
  "expect": {
    "delivered_frames": [],
    "local_close_request": 1009
  }
}
```

That fixture deliberately does not assert a peer-observed code.

Run ordinary vectors as one read, one byte at a time, and at every two-chunk split. Also test APIs that return final bytes together with EOF: process those bytes before handling EOF.

The :chatgpt-content-reference{index="17"}[conformance pack](sandbox:/mnt/data/bitwire-proposed-conformance-pack.zip) implements this separation. Its guide identifies the proposed amendments, including the separate close-body budget and byte-oriented text boundary. The JSON, hexadecimal encodings, valid-record lengths, and archive integrity were checked; the cases have **not** been run against bitruntime.

**Placement:** framing and stream closing in `bitwire-stream/1`; protocol interpretation in a revision-specific binding; process supervision in implementations/applications.

## 5. Layering, immutability, and what is missing

### A separate conformance layer is possible—but compatibility is not sufficient authorization

There is a legitimate distinction between:

> “This peer conforms to `bitwire/1`.”

and:

> “This peer conforms to `bitwire/1` and additionally supplies carrier contract C.”

The second claim may provide stronger local guarantees and select a subset of behaviors the first permits. That need not redefine the first claim.

But decision 0008’s quoted wording is unusually broad: changes to what a peer sends, accepts or refuses, close codes, or default bounds require a new revision. **I would not silently interpret that as permission for a new mandatory wire policy merely because it is wire-compatible.** :chatgpt-content-reference{index="14"}

My recommendation is to adopt an explicit governance clarification:

> A separately identified and versioned carrier contract may add local API guarantees and may constrain implementations claiming that additional contract to behaviors already permitted by a named protocol revision. It does not change that protocol revision’s standalone conformance requirements, defaults, or normative test suite.
>
> Any requirement needing a behavior forbidden by the revision, or changing what the revision itself requires, remains a protocol revision change.

Until that clarification is accepted, keep disputed wire-visible policies as implementation recommendations rather than universal new carrier requirements.

That produces the following placement:

| Proposal | Placement |
|---|---|
| Attempt-scoped publication evidence; stable ownership; local closed classification | Carrier/API contract now. |
| Better local reporting of queued refusals and pending-call termination | Carrier/API contract now, without changing public envelope fields. |
| Bounded drain selecting only revision-permitted behavior | Separately identified carrier behavior claim, subject to the 0008 clarification—not a tightened `bitwire/1` test. |
| A newly mandatory operational-failure close code | Later revision, or an explicitly authorized behavior profile. |
| GOAWAY, root isolation, changed tunnel abort encoding | Later protocol revision. |
| New byte-stream grammar and handshake | `bitwire-stream/1`, frozen on publication. |

Crucially, **“happens in process” is not a sufficient layering test**. Moving a quota check, adding a refusal, or changing a shutdown race can change the resulting network behavior. Classify a change by its observable effects, not the source file containing it.

### Publish the seam in bitwire, but specify observable milestones

I agree with publishing the transport seam and classifications in the eight bindings. Specify language-neutral milestones—admission, ownership, writable progress, flush, peer close, and final termination—then give each binding an idiomatic API.

A blocking Go send and an immediate TypeScript send can both report admission. Their return timing must not accidentally imply equal physical-write completion. Likewise, a zero `buffered` value must have a stated local meaning; it must not stand in for peer acknowledgment.

The missing seam questions worth settling now are operation concurrency, receive cancellation, callback serialization, repeated close behavior, buffer lifetime, and ownership of underlying resources. Those affect correctness more immediately than adding more error-code names.

### Keep independent conformance claims separate

Publish separate suites for the envelope codec, the carrier/API boundary, stream framing, and each concrete transport/protocol binding.

That lets a binary record be valid under `bitwire-stream/1` while correctly rejected as a `bitwire/1` envelope. It also lets a constrained adapter state exactly which guarantees it lacks without weakening everyone else’s tests.

**The practical sequence is to publish the local D4 definitions and D5 format first, fix the already-documented deviations, and then adopt D1–D3 with the additional conformance claim clearly named.** None of that requires inventing revision 2 prematurely, and none requires treating the current implementation as the specification.
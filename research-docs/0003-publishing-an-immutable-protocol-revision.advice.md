# Advice for consult
**Research doc:** doc_5d2c3b30-5276-4722-acb5-6eea3de6079d.md
**Document:** doc_5d2c3b30-5276-4722-acb5-6eea3de6079d
**Advisor:** ChatGPT GPT-6 Pro
**Session:** nsess_847cbf4c-a352-4466-b6dc-60f8ab53bedd
**Run:** run_23f4568a-b763-403e-813e-3f71a76c47c3
**Chat:** https://chatgpt.com/c/6ab80ad2-b528-83eb-bd2f-2c1c1488fd83
**Verify:** nightfall consult verify run_23f4568a-b763-403e-813e-3f71a76c47c3 --output <this file>
**Citations:** 28 source marker(s) linked from the answer page by the controller

# Recommendation

**Choose option C: byte-identical upstream copies plus a normative, hashed scoping document.** Keep the tunnel’s revision-1 definition inside the same `bitwire/1` identity, while distinguishing core-only and core-plus-tunnel conformance claims. Publish the runner contract and scenario releases separately from the protocol identity.

This fits your binding decisions: revision 1 preserves the selected release’s behavior, normative artifacts fix that behavior, and scenarios may grow without changing the revision. It also makes the publication independent of Nightseam without undertaking a full restatement. [file: research.md] [file: research.md]

**Do not publish the provisional digest as the final identity.** It does not yet cover the text that determines which inherited requirements apply. A scope document outside the hash would let someone change the effective protocol while retaining the same identifier and normative hashes—the precise failure decision 0008 is intended to prevent.

I checked several pinned upstream files as well as the external precedents below. This is a publication-design recommendation, not an executed conformance audit or a proof of behavioral equivalence.

## 1. Drawing and identifying the normative set

### Use incorporation with explicit scope, not a wholesale restatement

Options A and C become the same sound approach once you recognize that **selecting normative clauses is itself normative**. The objection to C—that some identity-defining text exists nowhere upstream—is not a reason to reject it. Bitwire is making a new, independently owned publication; its statement identifying the adopted behavior necessarily originates in Bitwire.

I would begin with **seven normative files**:

| Artifact | Normative contribution |
|---|---|
| `SCOPE.md` | Revision identification, adopted source, exact scope, authority rules, table interpretation, necessary dependency resolutions, and conformance boundaries. |
| Upstream `docs/wire/profile.md` | Selected core-protocol requirements, including default bounds and network-visible consequences of local actions. |
| Upstream `docs/wire/vocabulary.md` | Selected layering, namespace, routing, and reserved-prefix requirements. |
| Upstream `docs/wire/tunnel.md` | Selected revision-1 tunnel requirements. |
| Upstream `conformance/tables/frames.json` | Explicit envelope-validity constraints for the listed inputs and receiving roles. |
| Upstream `conformance/tables/serials.json` | Explicit admission constraints for the listed frame sequences. |
| Upstream `conformance/tables/unicode.json` | Explicit constraints on the admitted JSON string domain. |

This adopts your proposed three documents and three tables, but adds the missing authority-defining artifact. The inventory in the brief supports that starting set; whether a table currently has a scenario consumer should not determine its normative status. [file: research.md]

The source copies remain untouched. **Hash each whole file, even where only designated portions are normative.** Hash coverage and normative authority are different: the former identifies an exact artifact; the latter states which requirements it contributes. This avoids fragile paragraph-level hashing.

A suitable layout is:

```text
protocol/bitwire-1/
  SCOPE.md
  manifest.json
  source/
    docs/wire/profile.md
    docs/wire/vocabulary.md
    docs/wire/tunnel.md
    conformance/tables/frames.json
    conformance/tables/serials.json
    conformance/tables/unicode.json
    ... archived runner files, scenarios, rationale, LICENSE, NOTICE
```

The seven-file set can remain sufficient by incorporating any short, otherwise missing behavioral definitions into `SCOPE.md`. A substantial necessary dependency should instead be copied locally and added to the normative inventory before publication.

### Make the scope precise enough to constrain an implementation

Do not write merely “runtime material is informative.” That would leave too much interpretation to each reader.

Identify exclusions by source path, heading, and exact paragraph or sentence boundary. Because the source bytes are fixed, line ranges or byte ranges are also usable. Mixed paragraphs and table rows need sentence-level treatment.

There is an important correction to the brief here: **do not exclude the entire `busy` row.** The pinned `profile.md` includes both a receiver-generated `busy` response and a caller-local refusal without a frame. It repeats this distinction in the bounds section. Excluding the whole row would remove required wire behavior. [GitHub](https://raw.githubusercontent.com/Bitspark/nightseam/5cc9723a24646c40ed1861f892b2b23eb6d785d7/docs/wire/profile.md)

Apply the same discipline elsewhere:

- Exclude observer callback names and runtime API requirements, but retain any surrounding requirements governing emitted frames, ordering, propagation, or close behavior.
- Exclude the local name `request_timeout` as an implementation API requirement, but preserve the deadline and its required cancellation behavior.
- Exclude the declaration-identity exchange, runtime preparation lifecycle, generator machinery, authentication-ticket advice, and upstream change process from the protocol’s requirements.

These are finer distinctions than classifying entire sections as “runtime” or “wire.” Your listed default bounds remain normative regardless of whether their enforcement uses internal queues or timers. [file: research.md]

For the namespace rules, retain existing reserved-prefix assignments as namespace facts without importing those layers’ implementations. Excluding `identity.` or `auth.` functionality must not silently make their names available to unrelated consumers. Equally, a generator’s prohibition must not be converted into a new receiver-side rejection rule.

### Give the tables a protocol-level interpretation

I recommend deliberately adopting all three tables as **finite normative constraints**, not as an exhaustive definition of valid traffic.

Their interpretations belong in `SCOPE.md`, not solely in the runner:

**`frames.json`:** identify the receiving role, the exact raw frame, and what `valid` means at the envelope-validation boundary. An envelope being valid does not imply that its method exists or that an application request succeeds. Preserve the raw frame representation rather than parsing and reserializing it before delivery.

**`serials.json`:** interpret `before` followed by `frame` on the same connection and direction. The pinned table expressly distinguishes sequence admission from structural envelope validity. Its `valid` field is not another frame-schema predicate. [GitHub](https://raw.githubusercontent.com/Bitspark/nightseam/5cc9723a24646c40ed1861f892b2b23eb6d785d7/conformance/tables/serials.json)

**`unicode.json`:** interpret its `raw` inputs at the JSON string-validation boundary. They include JSON values and structures, not necessarily complete protocol envelopes. A valid row does not mean its raw text is a valid network frame. A runner can embed suitable raw fragments into otherwise valid envelopes without normalizing away the condition being tested. [GitHub](https://raw.githubusercontent.com/Bitspark/nightseam/5cc9723a24646c40ed1861f892b2b23eb6d785d7/conformance/tables/unicode.json)

Designate names, issue references, and explanatory `why` fields as informative unless a particular sentence is explicitly needed to define the requirement. Extract any such necessary meaning into the normative table-interpretation text.

A useful precedent is Unicode’s UCD: it expressly distinguishes normative from informative data, and it designates several conformance-test files as normative. Their normative status is intentional, rather than an automatic consequence of being machine-readable or consumed by tests. Unicode also publishes stable, unchanged version directories. [Unicode: UAX #44: Unicode Character Database (+1 more source)](https://www.unicode.org/reports/tr44/tr44-34.html)

Once these tables are frozen, **add new examples to the evidence set, not to these normative files**. A newly discovered example can test an existing rule without becoming another identity-defining artifact.

### Close the normative dependencies, not every hyperlink

Give every outgoing source link a recorded disposition: locally resolved, informative historical reference, or necessary normative dependency.

A dangling rationale link can remain historical. A missing document that supplies an indispensable acceptance rule cannot. Copy the needed definition into the publication and hash the artifact containing it. An issue number inside `why` must never be the only explanation of a requirement.

`SCOPE.md` should control selection and explicitly documented interpretations. The selected prose and table constraints should otherwise agree. **Do not introduce a blanket “tables win,” “prose wins,” or “Go wins” rule.** Such a rule could silently discard part of the adopted baseline.

Restatement is a legitimate publication strategy, but it has a different review burden. YAML’s specification revision 1.2.2, for example, changed source format, clarified wording and examples, corrected errata, fixed links, and retained older specifications. That is a useful model for a separately reviewed editorial republication—not a reason to assume rewritten text preserves every detail automatically. [yaml.org: YAML Ain’t Markup Language (YAML™) revision 1.2.2](https://yaml.org/spec/1.2.2/ext/changes/)

### Define the digest over exact bytes and stable paths

Retain the existing aggregate-hash approach. The inspected script already orders entries by path; formalize that convention rather than leaving “sorted lines” ambiguous. [GitHub](https://raw.githubusercontent.com/Bitspark/bitwire/ed6d1ed/scripts/protocol.mjs)

Specify:

```text
fileHash(p) = lowercase hexadecimal SHA-256 of the file's exact bytes

entry(p) = UTF-8(fileHash(p) + two ASCII spaces + p + LF)

normativeDigest =
    lowercase hexadecimal SHA-256 of the concatenated entries,
    ordered by canonical relative path
```

Use paths relative to `protocol/bitwire-1/`, including `source/` where applicable. Restrict publication paths to a simple ASCII repertoire, use `/`, compare case-sensitively without locale rules, and reject duplicates, absolute paths, traversal components, backslashes, and symlinks. Each entry has exactly one terminating LF.

Do not normalize document text or JSON before hashing. Do not hash rendered HTML, ZIP metadata, filesystem permissions, or timestamps as protocol identity.

The identity is:

```text
("bitwire/1", normativeDigest)
```

Retain the individual file hashes as well. Record the identifier, adopted commit, qualified former name, normative inventory, and digest procedure in the hashed `SCOPE.md`; then manifest metadata cannot become an alternative, unhashed interpretation of those facts.

Keep `LICENSE`, `NOTICE`, rationale, runner artifacts, and scenarios in the manifest with their own sizes and hashes, but **outside `normativeDigest`**. License compliance is required for distribution; it is not a network-protocol rule. Apache-2.0 separately requires delivery of the license, preservation of applicable notices, and notices of modifications where relevant. [Apache Software Foundation: Apache License, Version 2.0 | Apache Software Foundation](https://www.apache.org/licenses/LICENSE-2.0)

Do not include the manifest’s own bytes in the digest it contains. Protect the complete distribution with a separate archive checksum or detached signature. That distribution-integrity identity may cover notices, evidence, and manifest formatting without making them part of protocol identity.

Your importer needs one modest structural extension: distinguish **upstream-origin files** from **Bitwire-authored files**. Both are hashed locally; only upstream-origin files are fetched and compared against upstream paths.

### Be exact about provenance and equivalence

Record the complete commit:

```text
5cc9723a24646c40ed1861f892b2b23eb6d785d7
```

Qualify the former name as **`nightseam.duplex/1` as published in Nightseam v0.6.0 at that commit**. Do not declare every historical use of `nightseam.duplex/1` equivalent; your decisions expressly exclude earlier releases under that name. [file: research.md]

Keep the upstream repository identity, tag, original paths, import procedure, and source-verification results. Preserve a source archive or Git bundle so future verification does not depend on Nightseam remaining hosted. Preserve an upstream signature where one exists; do not imply that one exists merely because a tag does.

Finally, distinguish two claims:

**Artifact equality** can be independently checked against the pinned source.

**Behavioral equivalence of the scoped publication** requires reviewing scope and interpretation, supported by tests. Matching hashes of copied documents does not prove that the scoping choices preserved every behavior, and matching transcripts cover only the executions represented.

That distinction should appear in the provenance statement.

## 2. Tunnel identity and layered vocabularies

### Keep the tunnel in the revision-1 identity

For this release, I recommend one identity covering the core and its revision-1 tunnel specification, with explicit conformance claims such as:

```text
bitwire/1 — core only
bitwire/1 — core and tunnel
```

These are conformance scopes, not new network identifiers. Include the same full normative digest in either claim. A core-only claim does not establish tunnel support.

This avoids introducing another independently evolving identity before you have an outside implementation or an actual independent tunnel release. The cost is real and should be accepted explicitly: **a behavioral tunnel change requires a new identity under this arrangement**, even if the core envelope remains unchanged. Given the scale and timing described, I would accept that cost rather than design a two-dimensional compatibility scheme now. [file: research.md]

Separate identification is reasonable when a layer has an independent release lifecycle and independently meaningful compatibility promises. It is not required merely because the layer uses ordinary core messages.

The comparisons illuminate different choices:

WebSocket distinguishes the base protocol from application subprotocols and extensions. HTTP/2 permits extension frames partly because it defines how unknown frame types are discarded, with specified exceptions. LSP layers its own messages over JSON-RPC and uses capability exchange for feature compatibility. None of these mechanisms should be imported into revision 1: your unknown-envelope behavior and prohibition on new negotiation remain controlling. [RFC Editor: www.rfc-editor.org (+2 more sources)](https://www.rfc-editor.org/rfc/rfc6455.html) [file: research.md]

### Keep the digest’s admission semantics, not just its syntax

The tunnel’s `digest` field should not be divided into “syntax belongs to Bitwire; everything else belongs to Bitlink.”

**The comparison and refusal behavior also belong to the tunnel contract.** The supplied text requires malformed present digests to produce `channel_invalid`, differing known nonempty digests for the same family to produce `contract_mismatch`, comparison before admission, and absence on either side not to trigger that mismatch rule. Removing comparison would change what the tunnel accepts. [file: research.md]

The ownership boundary should be:

**Bitwire specifies carriage and admission:** field shape, presence rules, equality comparison, when comparison occurs, and resulting errors.

**Bitlink specifies declaration identity:** which declaration is represented, canonicalization, generation of its digest, and the separate `identity.check` exchange.

An independently written tunnel can accept a locally supplied family-to-digest mapping and implement the complete conditional comparison without containing a declaration compiler. Implementing Bitlink’s generation or interpretation promises is a separate undertaking.

The declaration digest is also **not** the protocol’s `normativeDigest`. Neither establishes authorization.

## 3. Specification, runner contract, and evidence

### Preserve three separate kinds of authority

The protocol specification says what network behavior is required.

The runner contract says how testees are controlled and how scenarios are interpreted.

Evidence says which requirements were tested, under which conditions, with which results.

The runner contract can be normative **for a conforming testee or runner** without being normative **for a `bitwire/1` network peer**.

WPT makes this separation concrete: its review checklist requires the specification to support expected test behavior and rejects reliance on proprietary features. Its harness documentation separately defines testing APIs. Autobahn likewise provides a protocol-testing tool with per-case reports; those reports are evidence about tested behavior, not a replacement for the protocol specification. [Web Platform Tests: Review Checklist — web-platform-tests documentation (+2 more sources)](https://web-platform-tests.org/reviewing-tests/checklist.html)

### Publish a Bitwire-owned conformance contract

Keep upstream `DRIVER.md` byte-identical as provenance, but do not make an implementer reconcile it indefinitely with scattered correction notes.

Publish a scoped Bitwire contract that preserves the compatible driver-1 message exchange while explicitly defining the supported command subset. It should exclude the identity, live, generated-code, and runtime-observability promises from core protocol conformance. The inherited ownership statement and Go-reference statement must not become Bitwire authority rules. [file: research.md]

That contract must consolidate the currently scattered semantics: placeholder expansion, all matchers, binding lifetime, absent-versus-null handling, object matching, array ordering, `repeat`, `foreach`, filtering, error reporting, and timeouts. Where these exist only in runner code, document the actual behavior and test the interpreter against examples before releasing it. The brief shows why merely shipping the scenario schema is insufficient. [file: research.md]

Bitwire should own a test-only runner implementing that contract. Adapting the existing Go runner is a sensible starting point, provided its dependencies and expected verdicts do not make Nightseam or bitruntime the protocol oracle. Your repository policy already permits test-only conformance tooling while forbidding published package dependencies on those runtimes. [file: research.md]

### Version the contract and evidence independently

Use three independently identifiable releases:

| Release | What identifies it |
|---|---|
| Protocol | `bitwire/1` plus normative digest. |
| Conformance contract | Contract edition and artifact hashes, stating supported driver and scenario-format versions. |
| Evidence set | Suite release or commit plus content hashes, targeting an exact protocol identity. |

Keep `hello.driver = 1` where the runner-to-testee exchange remains compatible. A new documentation edition or additional scenario does not require a new driver version. An incompatible command-contract change does.

For scenarios, retain the unmodified upstream files as archived evidence, but publish **active Bitwire derivatives** under a Bitwire schema that permits an explicit protocol identifier and normative digest. This directly satisfies decision 0008’s requirement that each scenario name its target. The current schema cannot express that requirement. [file: research.md]

The active selection rules must also be explicit and versioned. Do not infer a core promise from directory names. The existing feature-over-layer precedence moves observer-based peer scenarios out of the core promise, and some selected directories contain out-of-scope cases. [file: research.md]

Observer assertions can remain useful optional diagnostics. Core conformance must not require an implementation to reproduce Nightseam’s internal observer vocabulary.

### What an outside implementer needs

The publication should provide an unambiguous starting point: the protocol bundle, a core/tunnel applicability statement, a testee contract, executable runner instructions, an evidence release, and a report format.

A meaningful report should record the protocol identifier and digest; claimed layers, roles, and transports; implementation build and configuration; runner and contract identities; suite identity; and individual results, including skips, unsupported cases, and harness failures.

Do not collapse these into “passed revision 1.” A successful finite suite is evidence supporting a conformance claim, not proof that every requirement has been exercised. Default settings need dedicated coverage even when stress tests use smaller configured bounds.

## 4. Carrying defects without changing the baseline

### Separate frozen interpretations from later findings

Use two channels.

**Before publication**, put every interpretation necessary to define the adopted behavior into the hashed scope. That includes the exclusion of the source’s change-process language and any established resolution of a material ambiguity.

**After publication**, maintain a clearly non-normative findings register outside the protocol digest. It may explain defects, link reproductions, record confidence, and propose revision-2 changes. It must not introduce new revision-1 obligations.

RFC practice is a useful precedent: published RFCs remain unchanged, while errata have explicit statuses including Reported, Verified, Rejected, and Held for Document Update. W3C similarly requires public error records identifying affected text and permits separately marked candidate corrections. Your behavioral immutability policy should be stricter than any process that eventually incorporates substantive corrections into the same named specification. [RFC Editor: Errata in RFCs | RFC Editor (+2 more sources)](https://www.rfc-editor.org/series/rfc-errata/)

A finding should record its identifier, target revision and digest, exact affected location, conflicting statements or observations, reproduction conditions, affected roles and transports, behavioral consequence, evidence, disposition, and proposed revision-2 resolution. Crucially, state whether it changes conformance expectations; for a revision-1 finding, the default answer is **no**.

### Treat the identified problems differently

**The change-process sentence** is historical publication policy, not network behavior. Exclude it explicitly in the frozen scope. There is no need to retain an upstream permission to rewrite Bitwire’s revision.

**The 1006 wording** requires an action-versus-observation distinction. RFC 6455 prohibits transmitting 1006 in a WebSocket Close control frame and recognizes that endpoints can observe different close codes. Your decision extends the no-transmission requirement to carriers generally. Preserve that rule without claiming that a remote endpoint always observes the close code a sender selected. [RFC Editor: www.rfc-editor.org](https://www.rfc-editor.org/rfc/rfc6455.html) [file: research.md]

For the tunnel, specifically inspect what v0.6.0 does on abort. The prose “the other side sees 1006” does not establish how that observation is conveyed. If actual serialized behavior contradicts a binding decision, record a release-blocking inconsistency; do not silently change the implementation, invent an interpretation, or demand both incompatible behaviors. [file: research.md]

**The path-encoding issue** is a coverage and boundary question, not automatically proof that the plain-name examples are wrong. Your brief distinguishes traffic originating from the structured Wire interface from the raw envelope examples. Establish exactly where canonical encoding is required and where raw operation names are accepted. Do not newly reject plain names merely to make the examples look consistent. [file: research.md]

**Local outcomes such as `cancelled` versus `disconnected`** belong outside protocol identity when they truly change no network behavior. Conversely, a change described as an internal cleanup can still alter transmitted closes or timing consequences. Classify the observable effect, not the implementation label. The reported over-limit 1006 observation is a reason to examine test observation points—not to weaken every close-code assertion to accept either value. [file: research.md]

A new finding must not quietly become a rule that an implementation must pass. Add scenarios freely for already specified requirements; where the specification itself is defective, report that defect rather than disguising a repair as “more coverage.”

## 5. What to do before anything becomes immutable

The most consequential risks are not cryptographic.

**First, the adopted baseline might be less singular than its name suggests.** Check whether the relevant released languages, roles, transports, and default configurations agree on the disputed behavior. Do not let the inherited “Go first” practice silently resolve disagreements. Cross-implementation transcript equality is useful evidence, but it does not cover untested malformed inputs, races, boundaries, or timing conditions.

**Second, scoping can remove obligations accidentally.** The `busy` distinction illustrates this. The same risk applies to trace propagation, ordering, queue saturation, cancellation, and tunnel admission: implementation-specific wording may surround a real network requirement.

**Third, operational details can remain hidden in the test machinery.** A table’s state assumptions, a matcher’s treatment of extra fields, or a test’s timeout can determine verdicts. Protocol-relevant interpretation belongs in the frozen specification; measurement and control semantics belong in the separately identified runner contract.

**Fourth, immutable bytes can still be published through a mutable interpretation.** A live README, changing profile selector, rendered page, or “clarification” must not redefine the meaning of the frozen bundle. The permanent entry page should identify the authoritative artifacts and distinguish later guidance and evidence.

**Fifth, known source contradictions cannot be deferred indiscriminately.** You can stage a complete runner and broader scenarios. You cannot stage a decision that changes which files are hashed, which clauses bind, or how an otherwise unresolved acceptance rule is interpreted.

I would implement this in three steps:

1. **Complete the scope-and-dependency audit.** Produce the seven-file candidate set and a small traceability matrix linking each scoped requirement to its source, normative artifact, and evidence. Investigate the path boundary, tunnel abort behavior, mixed `busy` semantics, and table interpretation first.
2. **Seal and publish the protocol bundle.** Extend the manifest to handle local and upstream origins, freeze canonical paths and hashing rules, verify all bytes offline and against the pinned source, and publish the final full digest with durable provenance. Do not retain the provisional digest as the release identity.
3. **Release conformance tooling independently.** Publish the Bitwire runner contract, revision-labelled scenario derivatives, explicit profile selection, and reproducible reports. Expand evidence without editing the normative bundle.

**The publication boundary should be simple: everything required to determine revision-1 behavior is frozen and hashed; everything used to exercise, observe, explain, or report that behavior is separately identified.** That preserves the baseline without turning Nightseam’s runtime, its runner, or Bitwire’s future findings into an unversioned second specification.
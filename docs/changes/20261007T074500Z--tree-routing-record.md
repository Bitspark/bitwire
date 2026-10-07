# Tree routing record

Decision: [0017](../decisions/0017-tree-routing.md), proposed.

This change adds the [tree routing](../wire/routing.md) protocol record and its
independent cases in [routing-vectors.json](../../conformance/routing-vectors.json).
The record covers one absolute namespace, links that carry ordinary addressed
values whose messages are routing records (an origin and an opaque payload), the
per-hop decision procedure, five refusal reasons reported to the host with the
refused payload, and generation-scoped bindings. Charter invariants W1 to W6
are unchanged. No language declaration, codec, runtime API or package version
changes.

The four encode vectors were hand-derived from the codec grammar and then checked
against the released 0.5.0 encoder. The 28 decision vectors were checked against
a literal reading of the procedure. `contract.test.mjs` now checks the encode
vectors with this repository's codec. The reject and decision vectors judge future
implementations; no routing implementation exists.

Revised after review at `edf13d6`: the routing record now travels inside the
existing addressed value instead of a second four-item format; the `client43`
case states the consumer's obligation to reply to the checked origin; and the
refusal observation carries the refused payload.

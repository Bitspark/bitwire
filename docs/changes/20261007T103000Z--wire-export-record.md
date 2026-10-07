# Wire export record

Decision: [0018](../decisions/0018-wire-export.md), proposed.

This change adds the [export](../wire/export.md) protocol record and its
independent cases in [export-vectors.json](../../conformance/export-vectors.json).
It covers live, connection-scoped export of a send-only Wire over addressed
reference routes:
- references `("bitwire/ref/1", scope, id)` bound to a connection's random scope;
- `send` and `release` routes under a declared export root;
- import by `Under` and `Bind`;
- three refusal reasons, observed by the exporter only;
- re-export through another hop, with source retirement and dependent-lifetime
  accounting.

Charter invariants W1 to W6 are unchanged. No language declaration, codec,
runtime API or package version changes.

The encode vectors were hand-derived and then checked against the released 0.5.0
encoder, and `contract.test.mjs` checks them with this repository's codec. The
delivery cases and observations judge future implementations; no realization
exists.

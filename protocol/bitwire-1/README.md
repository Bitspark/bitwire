# bitwire/1

This page is informative. It is the entry point to protocol revision
`bitwire/1`. **[`SCOPE.md`](SCOPE.md) is authoritative**: it identifies the
revision, lists its normative artifacts, and says which of their requirements
bind. This page restates nothing and redefines nothing.

## Identity

`bitwire/1` is identified by the pair (`bitwire/1`, `normativeDigest`):

```text
normativeDigest = c3b9a38b2e88691488742e140004b3180ed37e4c46844bdecdec97abf905bec0
```

The digest covers seven files:
- `SCOPE.md`;
- `source/docs/wire/profile.md`, `vocabulary.md` and `tunnel.md`;
- `source/conformance/tables/frames.json`, `serials.json` and `unicode.json`.

The upstream files are byte-identical copies from Nightseam v0.6.0 (commit
`5cc9723a24646c40ed1861f892b2b23eb6d785d7`). Revision 1 is that release's
network behavior, formerly named `nightseam.duplex/1`.

[`manifest.json`](manifest.json) lists every file in this directory, with its
category, origin, size and SHA-256. Verify the bundle:

```console
node scripts/protocol.mjs verify            # offline
node scripts/protocol.mjs verify --source   # also against the public upstream source
```

## What else is here

| Path | Category |
| --- | --- |
| `source/docs/decisions/*.md` | Informative rationale linked from the adopted text |
| `source/conformance/DRIVER.md`, `scenario.schema.json`, `profiles.json` | Runner material, archived as provenance. The bitwire conformance contract is released separately. |
| `source/conformance/scenarios/{seam,peer,tunnel}/*` | Archived evidence. It is unmodified and names no revision. |
| `source/LICENSE`, `source/NOTICE` | Apache-2.0 and Nightseam's notice, which travel with the copied files |
| [`FINDINGS.md`](FINDINGS.md) | Informative register of defects and divergences. It never changes a revision-1 obligation. |

A conformance claim names the identity pair and a scope: **core**, or **core
and tunnel**. The scopes are defined in `SCOPE.md`.

## Relation to the rest of bitwire

- **In-process interfaces.** The `Wire`, `WireTree` and `AddressedWire`
  declarations and their contract live in [`docs/wire`](../../docs/wire). They
  are versioned as bitwire package releases, independently of this protocol
  revision. [Decision 0008](../../docs/decisions/0008-a-protocol-revision-has-its-own-identity.md)
  separates the two.
- **Implementations.** bitruntime implements `bitwire/1` in Go and TypeScript.

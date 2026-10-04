# Checked consumer mirror of ontos

Pinned v0.9.0 at 5eed85de5697f53397407f9f82f3b310648827f7, frozen
ontos-codec-v1. This is the documented credential-free consumer-vendoring path,
not a standalone ontos distribution or a changed model. The manifest records
upstream bytes, adapted bytes and exact import-only replacements. All sources
come from the release commit, not a private working tree. Identity/codec/data
vectors travel with the mirror and checks replay them. Updates replace the
whole release pin and evidence together. Do not edit value or codec semantics.

The public consumer contains the mirror; it does not require access to private
ontos packages. Other languages provide native presentations of the same L0
contract. Runtime package consumers import this TypeScript value family to avoid
nominally incompatible duplicate classes. JSON fixtures are test notation,
never the wire encoding or identity rule.

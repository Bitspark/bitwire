# Checked consumer mirror of ontos

Pinned v0.9.0 at 5eed85de5697f53397407f9f82f3b310648827f7, frozen
ontos-codec-v1. This is the documented credential-free consumer-vendoring path,
not a standalone ontos distribution or a changed model. The manifest records
upstream bytes, adapted bytes and exact import-only replacements. All sources
come from the release commit, not a private working tree. Identity/codec/data
vectors travel with the mirror and checks replay them. Updates replace the
whole release pin and evidence together. Do not edit value or codec semantics.

Go and TypeScript now consume public ontos 0.16.0 directly. Their copied sources
and import aliases have been removed; the manifest retains only files still
present. Other language presentations keep this frozen mirror. All presentations
continue checking the independent identity/codec/data vectors, including Go and
TypeScript through the public packages. JSON fixtures remain test notation,
never the wire encoding or identity rule.

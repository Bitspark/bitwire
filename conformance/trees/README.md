# Full-tree reference observations

These independent cases exercise the 0.3 structural contract from
[decision 0012](../../docs/decisions/0012-explicit-data-and-wire-trees.md):
`WireTree = DeixisNode<Wire>`, addressless own sending, exact byte keys,
complete children, partial selection and decomposition/reconstruction.

Run from the repository root:

```console
node scripts/trees.mjs
```

The runner compares Go and TypeScript test-only interpreters with an independent
oracle. The same core check also compiles the native declarations. Reference
construction is deliberately scoped test infrastructure; it is not a shipped
production tree runtime, carrier implementation or proof of downstream adoption.
bitruntime owns production construction and derived operators.

The older [declared cases](../declared/README.md) exercise retained owner parts
and addressed forwarding. Their pinned release names and observations remain
historical evidence and do not substitute for these structural laws.

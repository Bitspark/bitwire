# Repository checks

After `pnpm install --frozen-lockfile`, run:

```console
node scripts/check.mjs
```

The command uses shell-free child processes and resolves the checkout from its
own location. It runs identically on Windows and Linux:

1. Check repository-relative Markdown links against tracked and unignored files.
2. Check Go formatting, then run `go vet` and `go test` to compile the declarations.
3. Check and build the TypeScript declarations using the pinned compiler.

The link check checks local destinations, not remote URLs or heading fragments.
The command does not claim behavioral conformance; see the
[conformance plan](../conformance/README.md).

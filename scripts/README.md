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

`node scripts/conformance.mjs` executes independent access cases through pinned
public Nightseam implementations. `node scripts/smoke-packed.mjs` installs npm
and Go artifacts outside the checkout. These are separate from declaration checks.
The [release procedure](../RELEASING.md) describes rehearsal and public registry
verification; native binding READMEs describe their package-consumer checks.

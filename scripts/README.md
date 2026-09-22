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
4. Run `scripts/composition.mjs`, comparing Go and TypeScript reference composition
   observations to a shared independent oracle for the 0.2 contract.

The link check checks local destinations and heading fragments, not remote URLs.
The experiment is test-only evidence, not production runtime conformance; see the
[conformance plan](../conformance/README.md).

`node scripts/conformance.mjs` executes the historical 0.1 independent access
cases through pinned public Nightseam implementations.
`node scripts/conformance-current.mjs` executes the current released production
composition and scoped lifecycle baseline, described in
[current conformance](../conformance/current/README.md). Both run in the required
conformance CI job. `node scripts/smoke-packed.mjs` installs npm
and Go artifacts outside the checkout. These are separate from declaration checks.
The [release procedure](../RELEASING.md) describes rehearsal and public registry
verification; native binding READMEs describe their package-consumer checks.

`verify-source.mjs` powers the manual `verify-source.yml` workflow. It resolves
an immutable public release and runs anonymous Swift, C++ and Haskell source
consumers against its exact SHA, separately from pre-release local package checks.

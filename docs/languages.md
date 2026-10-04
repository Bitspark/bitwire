# Language delivery and evidence

| Language | Distribution | Current validation |
|---|---|---|
| Go | root version tag, public module proxy | contract vectors, vet/test and isolated packaged consumer |
| TypeScript | @bitspark/bitwire on public npm | declarations, independent vectors and isolated packed/registry consumer |
| Rust | bitspark-bitwire on crates.io | fmt/clippy/test and extracted crate consumer |
| Python | bitspark-bitwire on PyPI | wheel/sdist, installed typed consumer |
| Swift | public tagged source | Swift package tests and isolated source consumer |
| C++ | public tagged source | CMake package tests and installed consumer |
| Java | dev.bitspark:bitwire on Maven Central | JAR tests and fresh repository consumer |
| Haskell | public tagged source/sdist | Cabal tests and isolated source consumer; Hackage deferred |

These are intended gates for 0.4.0, pending the new release's actual run and
registry verification. Declarations compiling do not establish endpoint behavior.
Only bitruntime's delivered Go and TypeScript endpoints claim runtime coverage,
against independently owned bitwire observations. No old release's evidence is
reused as evidence for this breaking replacement.

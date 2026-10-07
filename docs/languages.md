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

The 0.6.0 hydrated addition must pass every declaration/package lane and fresh
installed consumers before release. All eight presentations declare the live
value and interaction contract; Go and TypeScript additionally provide the pure
frame/body/reference codec. Stateful hydration is qualified in bitruntime. Historical PR 74 results describe 0.4.0 only. Declarations
compiling do not establish endpoint behavior. Only bitruntime's delivered Go and
TypeScript implementations claim runtime coverage, against bitwire-owned observations.
See the current change record for exact revision and release evidence.

# Layout

Use component-first paths with two-letter language directories: go, ts, py, rs,
swift, cpp, java, hs. Wire declarations are in wire/<lang>. The checked ontos
consumer mirror has its provenance/vectors under ontos/, with native Go sources
under ontos/go and packaged TypeScript/Python/Rust sources in their bindings.
Runtime endpoint implementations belong in bitruntime, not this repository.

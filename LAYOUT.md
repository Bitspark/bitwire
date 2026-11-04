# Layout

Use component-first paths with two-letter language directories: go, ts, py, rs,
swift, cpp, java, hs. Wire declarations are in wire/<lang>. Go and TypeScript
consume public ontos packages, including its optional native wire value model.
The other presentations retain their checked ontos consumer mirror, with
provenance and independent vectors under ontos/ and sources in their bindings.
Runtime endpoint implementations belong in bitruntime, not this repository.

# Independent contract observations

The envelope-vectors.json bytes are calculated from the published grammar by
an independent Python LEB128 encoder. Test JSON is authoring notation, not the
wire encoding. contract.test.mjs checks them and the pinned ontos vectors against
the packaged TypeScript presentation. Go replays the same envelope observations.
The packaged /conformance cases accept a consumer-supplied local-pair factory
and exercise delivery/ownership/termination without depending on bitruntime.
These cases are expectations, not a reference runtime. Native declarations and
published installation are different claims from behavioral conformance.

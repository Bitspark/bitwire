# Haskell Wire contract

`bitspark-bitwire` presents the shared Wire contract through the `Bitwire` module.
The package contains declarations and a local return-identity constructor. It
contains no endpoint runtime, router, transport, codec or generated adapters.

The source package is prepared for version 0.1.0. Its presence here does not
claim publication on Hackage or adoption by a Nightseam Haskell implementation.

```haskell
import Bitwire

-- An application receives access from an implementation of this record:
-- send    :: Wire -> Path -> Message -> IO ()
-- receive :: Wire -> Path -> Receiver -> IO (IO ())
-- close   :: Wire -> Code -> Text -> IO ()
```

## Representation

- A `Wire` is a record of `IO` operations. Admission and registration refusals
  are observable as exceptions in `IO`. Receiving returns an `IO ()` detach
  action; the implementation must make that action idempotent.
- Receiver callbacks also run in `IO`. The endpoint implementation schedules
  them; `send` must not run destination application code on its caller's stack.
- `Path` is `[Text]`, a sequence of Unicode-scalar strings using `text >= 2.0`.
  Empty segments, slashes, dots, supplementary characters and distinct Unicode
  normalization forms retain their exact meaning. At a byte or Haskell `String`
  boundary, reject invalid scalar input before constructing `Text`; lossy text
  decoding or replacement must not silently change a caller's path.
- `JsonPayload` holds encoded UTF-8 JSON bytes. This avoids floating-point loss
  for large integers and precise decimals. Its constructor does not validate
  JSON; the implementation checks the profile at its admission/encoding boundary.
- `ProfileBody` distinguishes request, response, event and cancellation. A
  response contains `Either ProfileError JsonPayload`; request and event names
  come from the send path. The represented profile version is one.
- `newReturnAddress` allocates an opaque local identity using `Data.Unique`.
  Copying or forwarding the value preserves equality. Two separately created
  addresses remain distinct even when they refer to the same `Wire`. Function
  equality and serialization are unnecessary; the constructor is hidden and
  `returnWire` exposes the access capability. Local routing must also preserve
  received invocation context privately associated with that identity by an
  implementation. Neither the capability nor received context is serialized;
  a caller's data does not establish verified context.

The contract and profile are documented in the
[Bitwire specification](https://github.com/Bitspark/bitwire/tree/main/docs/wire).
This binding was written from that shared specification, rather than extracted
from a Nightseam Haskell implementation.

## Build and package checks

From this directory, with GHC and cabal-install available:

```text
cabal check
cabal build all
cabal test all
cabal sdist
```

The test suite checks representation and consumer use, including return identity,
opaque Unicode paths, profile variants and precision-preserving JSON values.
These checks do not establish runtime dispatch or composition conformance.

`test/consumer` is a separate Cabal consumer. To check an actual source artifact,
unpack the source distribution outside this checkout, copy that consumer to a
second directory, and create a `cabal.project` listing the unpacked package and
consumer. `cabal run bitwire-consumer` must work using only those copies. Release
verification should repeat the consumer check against the published Hackage
version with no source override.

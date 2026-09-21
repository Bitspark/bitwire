# Haskell Wire contract

`bitspark-bitwire` presents the shared Wire contract through the `Bitwire` module.
The package contains declarations and a local return-identity constructor. It
contains no endpoint runtime, router, transport, codec or generated adapters.

Version 0.1.0 is available as a public Git dependency. Hackage publication is
deferred; it is not needed for the installation below. This package does not
claim adoption by a Nightseam Haskell implementation.

## Install from Git

Add the release commit to your application's `cabal.project`:

```cabal
packages: .

source-repository-package
  type: git
  location: https://github.com/Bitspark/bitwire.git
  tag: 9f45a2e0e9dc576db34237e5ad3aaaa0266a276b
  subdir: wire/hs
```

This is the commit of immutable release `v0.1.0`. Add
`bitspark-bitwire == 0.1.0` to your executable or library's `build-depends` in
its `.cabal` file, then run `cabal build`. No Hackage publisher account or GitHub
credentials are required. Cabal may still download other dependencies from
Hackage. The repository location belongs in the consuming project's
`cabal.project`; a library's `build-depends` alone does not tell downstream
projects where to fetch an unpublished dependency.

[Cabal's source dependency documentation](https://cabal.readthedocs.io/en/stable/cabal-project-description-file.html#taking-a-dependency-from-a-source-code-repository)
describes this supported installation mechanism.

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

With Node.js, GHC, cabal-install and `tar` available, the repository check is:

```text
node wire/hs/check.mjs
```

It runs the following commands in this directory:

```text
cabal check
cabal build all
cabal test all
cabal sdist
```

The test suite checks representation and consumer use, including return identity,
opaque Unicode paths, profile variants and precision-preserving JSON values.
These checks do not establish runtime dispatch or composition conformance.

`test/consumer` is a separate Cabal consumer. The check script unpacks the actual
source distribution into a temporary directory outside the checkout and copies
that packaged consumer to a second directory. A `cabal.project` lists only the
unpacked package and consumer, and `cabal run bitwire-consumer` verifies those
copies. The script safely removes its own temporary directory afterward.

To retain the exact validated archive for publication, provide an empty artifact
directory. The script leaves that directory intact:

```text
node wire/hs/check.mjs --artifact-dir /path/to/artifacts
```

To verify the public Git installation with the existing release pin:

```text
node wire/hs/check-git.mjs
```

This check copies only the consumer fixture into a temporary directory, uses a
fresh Cabal configuration and store, disables inherited Git configuration and
credentials, and builds Bitwire from the pinned public repository. CI runs it
alongside the current source-package check. These checks serve different
purposes: one verifies today's source artifact, the other the released Git
dependency. A future Hackage publication will additionally verify a registry
consumer without the Git source declaration.

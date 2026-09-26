# Bitwire for Haskell

Version 0.3.0 is available through the public Git release. A fresh anonymous
Git consumer passed with an isolated Cabal store in the
[source verification workflow](https://github.com/Bitspark/bitwire/actions/runs/36232682234).
Hackage publication remains deferred.
See the [delivery matrix](https://github.com/Bitspark/bitwire/blob/main/docs/languages.md#version-030-delivery)
for the separately verified distribution and runtime boundaries.

**Contract: 0.3.0.** `Wire` is the addressless
primitive `send(message)`. `WireTree = DeixisNode<Wire>` provides the complete
finite, acyclic structure: own value, complete byte-keyed children, partial
selection and decomposition. Keys are exact arbitrary bytes, including empty
and non-UTF-8 keys. Empty path selects self; a missing edge is distinct from a
present refusing primitive. Recomposition preserves own and child identities.

This is symmetric with Bitstore's `Data.read()` primitive and
`DataTree = DeixisNode<Data>`. Derived sending selects the node and invokes its
own Wire. Construction and derived operators belong in bitruntime; these
packages publish declarations and criteria, not a production tree runtime.
See [decision 0012](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0012-explicit-data-and-wire-trees.md)
and the [migration guide](https://github.com/Bitspark/bitwire/blob/main/docs/migration-0.3.md).

`AddressedWire` explicitly names the former `Wire.send(path, message)` surface.
It is not a full WireTree. `Endpoint` extends AddressedWire, and return
capabilities retain AddressedWire so the existing response/lifecycle path
space, local identity, received context and closure rules remain intact.
Carrier paths remain exact Unicode-scalar strings under unchanged `bitwire/1`;
they do not imply support for arbitrary tree byte keys on that carrier.

The following addressed-carrier examples use the **0.3 contract names**. Older
0.2.0 artifacts used `Wire` for the addressed interface; their release evidence
does not validate the renamed declarations or full structural trees.

`bitspark-bitwire` presents the shared AddressedWire contract through the `Bitwire` module.
The package contains declarations and a local return-identity constructor. It
contains no endpoint runtime, router, transport, codec or generated adapters.

The current source is 0.3.0; its release availability is recorded in the
repository delivery documentation. Hackage publication remains deferred.
The already published 0.1.0 Git release is checked separately as historical
delivery evidence. This package does not claim Nightseam Haskell adoption.

## Install from Git

Add the immutable 0.3.0 release tag to your
application's `cabal.project`:

```cabal
packages: .

source-repository-package
  type: git
  location: https://github.com/Bitspark/bitwire.git
  tag: v0.3.0
  subdir: wire/hs
```

The exact release tag selects the 0.3.0 source. Add
`bitspark-bitwire == 0.3.0` to your executable or library's `build-depends` in
its `.cabal` file, then run `cabal build`. No Hackage publisher account or GitHub
credentials are required. Cabal may still download other dependencies from
Hackage. The repository location belongs in the consuming project's
`cabal.project`; a library's `build-depends` alone does not tell downstream
projects where to fetch an unpublished dependency.

[Cabal's source dependency documentation](https://cabal.readthedocs.io/en/stable/cabal-project-description-file.html#taking-a-dependency-from-a-source-code-repository)
describes this supported installation mechanism.

```haskell
import Bitwire

-- Primitive and structural access share the generic tree contract:
-- send         :: Wire -> Message -> IO ()
-- own          :: DeixisNode a -> a
-- at           :: DeixisNode a -> TreePath -> Maybe (DeixisNode a)
-- type WireTree = DeixisNode Wire
-- Addressed-carrier access and endpoint control remain distinct records:
-- sendAddressed :: AddressedWire -> Path -> Message -> IO ()
-- endpointWire :: Endpoint -> AddressedWire
-- receive      :: Endpoint -> Receiver -> IO (IO ())
-- close        :: Endpoint -> Code -> Text -> IO ()
```

## Representation

- `AddressedWire` contains only send access. `Endpoint` bundles an `AddressedWire` with receive
  attachment and closure. Admission and attachment refusals are observable as
  exceptions in `IO`. Receive attaches one receiver and refuses another while
  it is active. Its `IO ()` detach action must be idempotent. Receiver callbacks
  see the relative path and complete message; dispatch policy is separate.
- Receiver callbacks also run in `IO`. The endpoint implementation schedules
  them; neither `send` nor `sendAddressed` runs destination application code on
  its caller's stack.
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
  addresses remain distinct even when they refer to the same `AddressedWire`. Function
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

To verify the already published 0.1.0 Git release (historical evidence):

```text
node wire/hs/check-git.mjs
```

To repeat the verified 0.3.0 public-interface check explicitly:

```text
node wire/hs/check-git.mjs --tag v0.3.0 --version 0.3.0
```

This check copies only the matching consumer fixture into a temporary directory, uses a
fresh Cabal configuration and store, disables inherited Git configuration and
credentials, and builds Bitwire from the pinned public repository. CI runs it
alongside the current source-package check. These checks serve different
purposes: one verifies today's source artifact, the other the released Git
dependency. A future Hackage publication will additionally verify a registry
consumer without the Git source declaration.

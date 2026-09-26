# Bitwire for Python

Version 0.3.0 is published on PyPI. Public installed-package tests passed in the
[publication workflow](https://github.com/Bitspark/bitwire/actions/runs/36232678897).
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

`bitspark-bitwire` provides the shared relative-path AddressedWire contract as the Python
module `bitwire`. It requires Python 3.11 or newer and has no runtime dependencies.
The package contains typed declarations and supporting values; endpoint runtimes,
carriers, codecs and routing helpers belong to implementations.

```python
from bitwire import Endpoint, Message, Receiver, ReturnAddress, AddressedWire


def call(endpoint: AddressedWire, replies: AddressedWire) -> None:
    endpoint.send(
        ["cells", "get"],
        Message(
            {"version": 1, "kind": "request", "id": "request-1", "params": {}},
            return_address=ReturnAddress(replies),
        ),
    )


def listen(endpoint: Endpoint):
    def receive(path, message):
        print(path, message.frame)

    return endpoint.receive(Receiver(message=receive))
```

`AddressedWire` is a send-only structural `Protocol`; implementations do not need to inherit
from it. `send` accepts or refuses synchronously; the implementation schedules
delivery. `Endpoint` extends it with `receive(receiver)` and `close`, keeping
attachment and closure authority separate from send access. One receive attachment
is allowed at a time; duplicates are refused. Receivers may return an awaitable.
`receive` returns an idempotent detach function that cannot remove a replacement.
Path matching belongs to routing compositions, not to these interfaces.
Paths are sequences of opaque Unicode-scalar strings and retain empty segments.
Receiver paths are relative to the attached endpoint.

`ReturnAddress` uses object identity, including when its AddressedWire cannot be compared
or hashed. Preserve this object during routing. The return address is local
capability data and must never be serialized into the profile envelope. Profile
payloads must follow the JSON profile despite their Python `object` annotation.
Runtime-owned received context associated with the return identity must survive
routing. Application-supplied context or metadata does not establish verified
invocation context; that verification remains the runtime's responsibility.

The [AddressedWire contract](https://github.com/Bitspark/bitwire/blob/main/docs/wire/contract.md)
and [profile boundary](https://github.com/Bitspark/bitwire/blob/main/docs/wire/profile.md)
define the behavior. Runtime protocol checks verify only the presence of methods;
they cannot establish conformance.

## Packaging and checks

From this directory:

```sh
python -m pip install -r requirements-dev.txt
python check.py
```

This builds a source distribution and a wheel from it, verifies the distribution
contents, installs the wheel into a temporary virtual environment, and runs both
consumer tests and static typing checks against that installed package. The test
endpoint is a recording fixture, not a Bitwire runtime or conformance driver.

For release artifacts at a chosen location:

```sh
python -m build --outdir dist
```

## Optional PyPI publication

The manual `publish-python.yml` workflow publishes an existing immutable public
release tag. It is separate from the Go/TypeScript release and does not gate that
handover. Its default authentication is a PyPI trusted publisher. Configure these
fields under the PyPI account's **Publishing** page for a pending project:

| Field | Value |
| --- | --- |
| PyPI project name | `bitspark-bitwire` |
| Owner | `Bitspark` |
| Repository name | `bitwire` |
| Workflow name | `publish-python.yml` |
| Environment name | `pypi` |

For an existing project, add the same publisher under the project's publishing
settings. As a bootstrap fallback, store an API token in the repository or `pypi`
environment secret named `PYPI_API_TOKEN`, then select `api-token` when dispatching
the workflow from `main`. Tokens are passed only to publication steps. Revoke the
bootstrap token after trusted publishing is configured. The workflow verifies the
packaged artifact before upload and installs the published PyPI package afterward.

The binding is adapted from Nightseam's Python AddressedWire declarations at commit
[`1c63f1c4`](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/duplex/py/nightseam/duplex/wire.py)
under Apache-2.0. See the included `LICENSE` and `NOTICE` files.

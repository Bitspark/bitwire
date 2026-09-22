# Bitwire for Python

A callable return capability holds Wire access to its own relative-path origin.
The selected profile defines supported paths, frame kinds and lifetime, and may
reserve that origin's paths for invocation operations. This grants no endpoint
receive or closure authority. Pure routing preserves the original return
capability and associated context; generic Wire alone does not imply lifecycle
support. Consumers must agree on a profile revision as well as its name; see
[the shared decision](https://github.com/Bitspark/bitwire/blob/main/docs/decisions/0004-return-origins-and-profile-revisions.md).

`bitspark-bitwire` provides the shared relative-path Wire contract as the Python
module `bitwire`. It requires Python 3.11 or newer and has no runtime dependencies.
The package contains typed declarations and supporting values; endpoint runtimes,
carriers, codecs and routing helpers belong to implementations.

```python
from bitwire import Endpoint, Message, Receiver, ReturnAddress, Wire


def call(endpoint: Wire, replies: Wire) -> None:
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

`Wire` is a send-only structural `Protocol`; implementations do not need to inherit
from it. `send` accepts or refuses synchronously; the implementation schedules
delivery. `Endpoint` extends it with `receive(receiver)` and `close`, keeping
attachment and closure authority separate from send access. One receive attachment
is allowed at a time; duplicates are refused. Receivers may return an awaitable.
`receive` returns an idempotent detach function that cannot remove a replacement.
Path matching belongs to routing compositions, not to these interfaces.
Paths are sequences of opaque Unicode-scalar strings and retain empty segments.
Receiver paths are relative to the attached endpoint.

`ReturnAddress` uses object identity, including when its Wire cannot be compared
or hashed. Preserve this object during routing. The return address is local
capability data and must never be serialized into the profile envelope. Profile
payloads must follow the JSON profile despite their Python `object` annotation.
Runtime-owned received context associated with the return identity must survive
routing. Application-supplied context or metadata does not establish verified
invocation context; that verification remains the runtime's responsibility.

The [Wire contract](https://github.com/Bitspark/bitwire/blob/main/docs/wire/contract.md)
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

The binding is adapted from Nightseam's Python Wire declarations at commit
[`1c63f1c4`](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/duplex/py/nightseam/duplex/wire.py)
under Apache-2.0. See the included `LICENSE` and `NOTICE` files.

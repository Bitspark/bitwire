# Message profile and interoperability

Bitwire 0.2 defines shared relative-path access and its structured message
vocabulary. The network profile remains **`nightseam.duplex/1`**. No
`bitwire.duplex/1` profile is introduced, and importing Bitwire alone does not
implement the network profile, declaration interpretation or live references.

## Structured messages

The shared frame vocabulary is:

| Kind | Required content | Optional content |
| --- | --- | --- |
| Request | request identifier and JSON parameters | trace fields and string metadata |
| Response | request identifier and exactly one of a JSON result or public error | trace fields |
| Event | JSON data | trace fields and string metadata |
| Cancel | request identifier | trace fields |

A public error contains its code, message and optional JSON data. Requests and
events take their operation name from the Wire path, so a structured frame has
no competing method or event name. All frames belong to version 1. A native
presentation can represent that fixed version implicitly; an encoder must emit
1 and a decoder must reject unsupported versions.

Payloads are JSON values. Absence and present JSON `null` differ. Native optional
fields or sum types must retain that distinction. Go keeps encoded payloads as
`json.RawMessage`; TypeScript uses `unknown`, which does not validate JSON or
make `undefined`, arbitrary objects or imprecise numbers admissible values.
Encoded JSON and decoded JSON are both possible native presentations. They must
preserve represented values; serialization whitespace and object member order
are not part of the shared access contract. A binding must not silently coerce a
value it cannot represent accurately.

Strings contain Unicode scalar values. Paths, metadata keys and values retain
their scalar sequences without normalization. A native type system can exclude
invalid frames statically, or its profile implementation can reject them at the
boundary. Permissive record declarations are not permission to send invalid
combinations. The complete validation and numeric acceptance rules are in the
pinned network profile below.

`Message` is a local delivery object. Its structured frame is profile data; its
return capability and received context are local access. These local fields are
never network envelope members. The
[access contract](contract.md#local-capabilities-and-context) requires their
preservation and explains how native presentations can carry them.

## Ownership of the specifications

| Bitwire specifies | The selected Nightseam profile supplies |
| --- | --- |
| Relative paths, single receive attachment, admission surface and detach | Physical framing, canonical path encoding, carrier behavior and close codes |
| Structured frame vocabulary and preservation of represented data | Complete envelope validation, id minting/correlation, cancellation and configured bounds |
| Stable local capability identity and received-context preservation | Creation, validation and recognition of invocation context, tracing and observation |
| Selection/mount/forwarding observations and borrowed endpoint lifetime | Declaration identity checks, preparation, live-value conversion, scopes and release barriers |
| Native binding types and independent conformance expectations | Concrete runtimes, generators and any optional authority profile |

The pinned profile sources are:

- [Relative-path access and runtime obligations](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/docs/runtime/wire.md).
- [Network profile and interpretation identity](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/docs/wire/profile.md).
- [Live-reference profile](https://github.com/Bitspark/nightseam/blob/1c63f1c4d7e4b5987d4bd32e294177645c92ed8f/docs/wire/live.md).

These public references version the retained profile obligations. Their older
path-based receive registration is superseded by the 0.2 access contract; handler
matching belongs to a composed dispatcher. They are not package
dependencies. Bitwire conformance cases may exercise a pinned Nightseam driver;
Bitwire libraries do not depend on its runtime.

## Publication evidence

Value conversion can allocate live bindings before sending. It may undo those
allocations only when the runtime establishes that publication did not occur;
an ordinary failure after possible publication has different consequences.
Neither a public error code nor a caller-set flag proves non-publication.

The admitting runtime owns such evidence, its validation and conversion
rollback. A binding may preserve an opaque local error association, but must
not turn untrusted error data into proof. Public frame errors contain only
profile data. Extracting their declarations into Bitwire does not require moving
Nightseam's verification or rollback implementation here. A native local error
presentation may retain a provider assertion such as Rust's `unpublished`
marker. Such a publicly constructible marker is not self-authenticating evidence:
the admitting runtime establishes meaning from its own direct observation and
clears application, handler, response and already-admitted forwarding assertions.
The marker is absent from serialized profile errors.

## What two adapters must agree on

| Agreement | Why the Wire signature alone is insufficient |
| --- | --- |
| Operation paths and frame grammar | A receiver must understand the operation and its arguments. |
| Value encoding | Both sides must preserve the declared values. |
| Contract identity | Both sides must interpret access as the same closed contract. |
| Reference representation and scope | A live value must reach the correct binding under its owner and lifetime. |

A nominal family name, a structural digest, an access path and a live reference
are distinct. None substitutes for another. A new declaration language does not
become interoperable simply because its generated code imports Bitwire. Raw
forwarding preserves messages; generated value converters translate live
references between distinct scopes.

Release evidence must distinguish common access observations from additional
profile coverage and record which native bindings and implementations were
exercised. A published package is a usable contract artifact, not evidence that
every language runtime or generator has adopted it.

# Message profile and interoperability

The first declarations retain Nightseam's logical frame vocabulary: request,
response, event and cancellation. Payloads are JSON values. Go retains encoded
payloads as `json.RawMessage`; TypeScript uses `unknown`, which is a language
boundary and does not by itself validate JSON or establish numeric interoperability.

`Message` is a local delivery object. Its frame is profile data; its return
capability is local access. A request's method or event's name is supplied by the
Wire path, so the logical frame contains no competing operation name. Physical
encoding and request correlation remain the profile implementation's concern.

## Starting point

The network profile remains **`nightseam.duplex/1`**. The pinned baseline is:

- [Nightseam Wire surface](https://github.com/Bitspark/nightseam/blob/5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515/docs/runtime/wire.md).
- [Profile and interpretation identity](https://github.com/Bitspark/nightseam/blob/5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515/docs/wire/profile.md).
- [Live-reference profile](https://github.com/Bitspark/nightseam/blob/5217cc60fdf8dd8d6b88e7ebb15bfcc98bb1d515/docs/wire/live.md).

These references identify existing semantics. They are not build dependencies,
and this scaffold does not claim that the full specification has been extracted.
No `bitwire.duplex/1` profile is introduced.

## What two adapters must agree on

| Agreement | Why the Wire signature alone is insufficient |
| --- | --- |
| Operation paths and frame grammar | A receiver must understand the operation and its arguments. |
| Value encoding | Both sides must preserve the declared values. |
| Contract identity | Both sides must interpret access as the same closed contract. |
| Reference representation and scope | A live value must reach the correct binding under its owner and lifetime. |

A nominal family name, a structural digest, an access path and a live reference
are distinct. None substitutes for another. A new declaration language does not
become interoperable simply because its generated code imports Bitwire.

## Extraction boundary

Before a stable release, the shared access and required message rules must have
one normative home and executable conformance cases. Profile-specific rules that
remain in Nightseam must be versioned and referenced explicitly. Contract identity
and live references must retain their present checks during adoption. This is an
extraction and integration task, not a reason to introduce another type language,
protocol framework or authentication dependency into Bitwire.

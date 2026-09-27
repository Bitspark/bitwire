# `bitwire-stream/1` framing vectors

**Status:** vectors for the adopted format
([decision 0013](../../docs/decisions/0013-carrier-contract-layering-and-adoption.md)),
before its publication. They are checked against bitwire's test-only reference
receivers. No implementation claims them yet: bitruntime implements the format
under [bitruntime#10](https://github.com/Bitspark/bitruntime/issues/10). The
format and these vectors are frozen when they are published as an immutable
bundle. Until then, what implementing them exposes can still be corrected.

[`vectors.json`](vectors.json) holds portable vectors for the receiving side of
[`bitwire-stream/1`](../../docs/wire/carriers.md#the-framed-byte-stream-bitwire-stream1).
Each one says what one side does with the bytes it reads, never what the far
side observes. Session behavior is out of their reach, and needs scenarios that
are not written yet: partial writes, blocked directions, deadlines,
simultaneous closes and transport failures.

## A vector

| Member | Meaning |
| --- | --- |
| `id`, `why` | A unique kebab-case name, and the rule the vector holds. |
| `limit` | The receive limit for text and binary bodies, in bytes. A close reason always has its own limit of 123 bytes. |
| `input` | The bytes read, as a list of parts (below). |
| `eof` | Whether the input ends after these bytes. When it is `false`, more input could follow. |
| `expect.frames` | The frames delivered, in order: `kind` (`text` or `binary`) and `body`. |
| `expect.peerClose` | The close record received: `code`, and `reason` as parts. |
| `expect.send` | The close record this side sends: its `code`. Its reason is always empty. |
| `expect.end` | How the input ended (below). |

A byte sequence is a list of parts, concatenated:
- a string of ASCII, limited to tab, LF, CR and the printable characters, whose
  bytes are its characters;
- `{"hex": "…"}`, lowercase hexadecimal bytes;
- `{"fill": "a", "count": 123}`, one printable character repeated.

| `end` | The side | Sends |
| --- | --- | --- |
| `open` | has consumed its input and waits for more. | nothing |
| `eof` | reached the end of input between records, without a close record, and observes 1006. | nothing |
| `truncated` | reached the end of input inside a record whose bytes so far are a valid prefix, and observes 1006. Nothing of the partial record is delivered. | nothing |
| `closed` | received a valid close record. Anything after it is discarded. | the reply: the received code, with an empty reason |
| `refused` | refused what it read. | 1002 or 1009, with an empty reason |

## Running a vector

A harness runs each vector under every read schedule:
- as one read;
- one byte per read;
- split into two reads at every point.

When `eof` is `true`, the end of input is delivered both on its own after the
last read and together with it, for APIs that return final bytes with the end.
Every schedule must produce the same outcome.

The vectors are written so that any parser architecture reaches the same
outcome, whether it decides byte by byte or buffers a header block first. A
vector that expects a refusal includes the whole header block through its
empty line, 128 bytes of it, or the end of input.

## Checks here

`node scripts/check.mjs` runs `scripts/stream.test.mjs`. It holds the vector
file to its shape, and runs every vector under every schedule against two
test-only reference receivers, [`scripts/stream-lib.mjs`](../../scripts/stream-lib.mjs):
- one that decides byte by byte;
- one that buffers a header block, up to its empty line, 128 bytes or the end
  of input.

Both must meet every vector. They differ in how they read a header block and
decide it: the byte-by-byte one has its own parser, and the buffering one has
its own whole-block match and prefix test. The rest of their code is shared:
- close-code validity;
- both limits;
- the UTF-8 check of a close reason;
- the handling after a close or a refusal.

Their agreement therefore checks decision timing and header parsing, not the
shared rules. Those rules are checked by the vectors' expectations, which are
written from the specification.

The test also runs sixteen deliberately wrong receivers, and each must fail at
least one vector:
- case-insensitive headers;
- bare LF line endings;
- skipping bytes before the first record;
- leading zeros;
- a 16-digit length;
- a length narrowed to 32 bits;
- an over-limit length refused before its block is complete;
- an over-limit record refused only once its body arrives;
- a close reason held to the data limit;
- any close code from 1000 to 4999;
- a close code checked before its header block is complete;
- an echoed reason;
- delivery after a close;
- a valid prefix at the end of input refused as syntax;
- text validated by the framer;
- bytes dropped when they arrive with the end of input.

The reference is written from the specification alone. It is not an
implementation of the format, and nothing bitwire publishes contains it.

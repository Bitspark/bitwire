/*
 * ontos canonical binary codec — ontos-codec-v1 (frozen).
 *
 *   Atom(bytes)   = 0x00 || uvarint(len(bytes)) || bytes
 *   Tuple(values) = 0x01 || uvarint(arity)      || encode(each child)
 *
 * uvarint is unsigned LEB128 in shortest/canonical form over the u64 domain
 * [0, 2^64 - 1] (ontos-codec.md §3.1 / §4). The decoder rejects unknown tags,
 * trailing bytes, non-canonical uvarints, uvarints outside the u64 domain
 * (uvarint_overflow), and inputs exceeding the configured/native limits
 * (limit_exceeded).
 *
 * This codec is kept beside the model (it depends on ontos-core, never the
 * reverse). The byte mapping is frozen (any change ships as a new version).
 * Conformance is pinned by vectors/codec.json (codec: ontos-codec-v1).
 *
 * This imports the model from "./core.js". In the monorepo that name
 * resolves to core/ts via npm workspaces, so the source and the published build
 * carry the identical import (see docs/design/0006-distribution.md).
 */

import { Atom, Tuple, atom, tuple, type BytesLike, type Value, copyBytes, bytesEqual } from "./core.js";

const TAG_ATOM = 0x00;
const TAG_TUPLE = 0x01;
const DEFAULT_MAX_DEPTH = 1024;

// uvarint integer domain (spec: ontos-codec.md §3.1 / §4): unsigned values in
// [0, 2^64 - 1]. A canonical uvarint is shortest-form and at most 10 bytes.
const MAX_UVARINT_BYTES = 10;
const UVARINT_CEILING = 1n << 64n; // 2^64: exclusive upper bound of the u64 domain.
// A valid u64 above this cannot be materialized as a JS number without precision
// loss, so it is rejected as limit_exceeded (a resource-limit class).
const MAX_SAFE_INTEGER_BIG = BigInt(Number.MAX_SAFE_INTEGER);

export interface DecodeOptions {
  readonly maxDepth?: number;
  readonly maxAtomBytes?: number;
  readonly maxTupleArity?: number;
}

/** Stable rejection categories. The `code` is normative (matches vectors/codec.json). */
export type DecodeErrorCode =
  | "unexpected_eof"
  | "trailing_bytes"
  | "unknown_tag"
  | "non_canonical_uvarint"
  | "uvarint_overflow"
  | "limit_exceeded";

export class DecodeError extends Error {
  readonly code: DecodeErrorCode;
  constructor(code: DecodeErrorCode, message: string) {
    super(message);
    this.name = "DecodeError";
    this.code = code;
  }
}

export function encode(value: Value): Uint8Array {
  const pieces: Uint8Array[] = [];
  encodeInto(value, pieces);
  return concat(pieces);
}

export function decode(input: BytesLike, options: DecodeOptions = {}): Value {
  const bytes = copyBytes(input);
  const state = { pos: 0 };
  const limits = normalizeDecodeOptions(options);
  const value = readValue(bytes, state, 0, limits);
  if (state.pos !== bytes.length) {
    throw new DecodeError("trailing_bytes", `trailing bytes at offset ${state.pos}`);
  }
  return value;
}

export function encodeUvarint(n: number): Uint8Array {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`uvarint requires a non-negative safe integer, got ${n}`);
  }
  return encodeUvarintBig(BigInt(n));
}

// Shortest-form LEB128 encoding of a bigint in the u64 domain. Shared by the
// public encoder and the decoder's canonicality check so both agree byte-for-byte.
function encodeUvarintBig(value: bigint): Uint8Array {
  if (value < 0n || value >= UVARINT_CEILING) {
    throw new RangeError(`uvarint requires a value in [0, 2^64 - 1], got ${value}`);
  }
  let v = value;
  const out: number[] = [];
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v !== 0n) byte |= 0x80;
    out.push(byte);
  } while (v !== 0n);
  return Uint8Array.from(out);
}

function encodeInto(value: Value, out: Uint8Array[]): void {
  if (value instanceof Atom) {
    const b = value.bytes();
    out.push(Uint8Array.of(TAG_ATOM), encodeUvarint(b.length), b);
  } else {
    const items = value.items();
    out.push(Uint8Array.of(TAG_TUPLE), encodeUvarint(items.length));
    for (const item of items) encodeInto(item, out);
  }
}

function readValue(
  bytes: Uint8Array,
  state: { pos: number },
  depth: number,
  limits: Required<DecodeOptions>,
): Value {
  if (depth > limits.maxDepth) {
    throw new DecodeError("limit_exceeded", `maximum decode depth exceeded: ${limits.maxDepth}`);
  }
  if (state.pos >= bytes.length) {
    throw new DecodeError("unexpected_eof", "unexpected end of input while reading tag");
  }

  const offset = state.pos;
  const tag = bytes[state.pos];
  state.pos += 1;

  if (tag === TAG_ATOM) {
    const length = readUvarint(bytes, state);
    if (length > limits.maxAtomBytes) {
      throw new DecodeError("limit_exceeded", `atom byte length ${length} exceeds limit ${limits.maxAtomBytes}`);
    }
    if (state.pos + length > bytes.length) {
      throw new DecodeError("unexpected_eof", "unexpected end of input while reading atom bytes");
    }
    const start = state.pos;
    state.pos += length;
    return atom(bytes.subarray(start, state.pos));
  }

  if (tag === TAG_TUPLE) {
    const arity = readUvarint(bytes, state);
    if (arity > limits.maxTupleArity) {
      throw new DecodeError("limit_exceeded", `tuple arity ${arity} exceeds limit ${limits.maxTupleArity}`);
    }
    // Every encoded value is at least two bytes (tag + zero uvarint), so an arity
    // larger than half the remaining bytes is impossible. Guards malformed input.
    const maxPossibleChildren = Math.floor((bytes.length - state.pos) / 2);
    if (arity > maxPossibleChildren) {
      throw new DecodeError("unexpected_eof", "unexpected end of input while reading tuple items");
    }
    const items: Value[] = [];
    for (let i = 0; i < arity; i += 1) {
      items.push(readValue(bytes, state, depth + 1, limits));
    }
    return tuple(items);
  }

  throw new DecodeError(
    "unknown_tag",
    `unknown value tag 0x${(tag ?? 0).toString(16).padStart(2, "0")} at offset ${offset}`,
  );
}

function readUvarint(bytes: Uint8Array, state: { pos: number }): number {
  const start = state.pos;
  // Accumulate in bigint so the full u64 domain [0, 2^64 - 1] is representable
  // during decode without precision loss (spec: ontos-codec.md §3.1 / §4).
  let result = 0n;
  let shift = 0n;
  let length = 0;

  while (true) {
    if (state.pos >= bytes.length) {
      throw new DecodeError("unexpected_eof", "unexpected end of input while reading uvarint");
    }
    const byte = bytes[state.pos] ?? 0;
    state.pos += 1;
    length += 1;
    result |= BigInt(byte & 0x7f) << shift;
    // Any decoded value at or above 2^64 is outside the u64 domain. This catches
    // a 10th byte whose high bits push the value past the 64-bit ceiling.
    if (result >= UVARINT_CEILING) {
      throw new DecodeError("uvarint_overflow", `uvarint exceeds the u64 domain at offset ${start}`);
    }
    if ((byte & 0x80) === 0) break;
    shift += 7n;
    // A canonical uvarint is at most 10 bytes; an 11th continuation byte can only
    // encode a value >= 2^64, so it is a u64-domain overflow.
    if (length >= MAX_UVARINT_BYTES) {
      throw new DecodeError("uvarint_overflow", `uvarint exceeds 10 bytes at offset ${start}`);
    }
  }

  const canonical = encodeUvarintBig(result);
  const actual = bytes.subarray(start, state.pos);
  if (!bytesEqual(canonical, actual)) {
    throw new DecodeError("non_canonical_uvarint", `non-canonical uvarint at offset ${start}`);
  }

  // result is a valid u64. If it exceeds this implementation's native
  // materialization width (Number.MAX_SAFE_INTEGER) it is a RESOURCE-LIMIT
  // failure (limit_exceeded), NOT an overflow of the u64 domain.
  if (result > MAX_SAFE_INTEGER_BIG) {
    throw new DecodeError("limit_exceeded", `uvarint ${result} exceeds Number.MAX_SAFE_INTEGER at offset ${start}`);
  }

  // Safe to materialize as a JS number: guarded by the limit check above.
  return Number(result);
}

function normalizeDecodeOptions(options: DecodeOptions): Required<DecodeOptions> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxAtomBytes = options.maxAtomBytes ?? Number.MAX_SAFE_INTEGER;
  const maxTupleArity = options.maxTupleArity ?? Number.MAX_SAFE_INTEGER;
  for (const [name, value] of [
    ["maxDepth", maxDepth],
    ["maxAtomBytes", maxAtomBytes],
    ["maxTupleArity", maxTupleArity],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative safe integer`);
    }
  }
  return { maxDepth, maxAtomBytes, maxTupleArity };
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

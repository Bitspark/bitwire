// Canonical raw messages and the separate addressed representation.
import { Atom, Tuple, atom, tuple, assertValue, type Value } from './ontos/core.js';
import { encode, decode } from './ontos/codec.js';
import type { Path } from './index.js';

const addressedVersion = atom(new TextEncoder().encode('bitwire/addressed/1'));
export const WEBSOCKET_PROTOCOL = 'bitwire.ontos.v2';
export const MAX_MESSAGE_DEPTH = 4096;
export const DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

function limit(n: number): number {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('limit must be a positive safe integer');
  return n;
}
export function capturePath(value: Path): Path {
  if (!Array.isArray(value)) throw new TypeError('path must be an array of atoms');
  const captured: Atom[] = [];
  for (const key of value) {
    if (!(key instanceof Atom)) throw new TypeError('path key must be an atom');
    captured.push(key);
  }
  return Object.freeze(captured);
}
export function pathEqual(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((key, i) => key.equals(b[i]!));
}
export function pathStartsWith(a: Path, prefix: Path): boolean {
  return a.length >= prefix.length && prefix.every((key, i) => key.equals(a[i]!));
}
export function packAddressed(path: Path, message: Value): Value {
  assertValue(message);
  return tuple([addressedVersion, tuple(capturePath(path)), message]);
}
export function unpackAddressed(value: Value): Readonly<{path: Path; message: Value}> {
  assertValue(value);
  if (!(value instanceof Tuple) || value.length !== 3 || !addressedVersion.equals(value.at(0)!))
    throw new TypeError('addressed version or arity');
  const path = value.at(1)!;
  if (!(path instanceof Tuple)) throw new TypeError('addressed path must be a tuple');
  return Object.freeze({path: capturePath(path.items() as Path), message: value.at(2)!});
}
function varintLength(n: number): number {
  let length = 1;
  while (n >= 128) { n = Math.floor(n / 128); length++; }
  return length;
}
function bounded(root: Value, max: number): void {
  const pending = [{value: root, depth: 0}];
  let size = 0;
  while (pending.length) {
    const {value, depth} = pending.pop()!;
    if (depth > MAX_MESSAGE_DEPTH) throw new RangeError('message depth limit');
    size += 1 + varintLength(value.length);
    if (value instanceof Atom) size += value.length;
    else {
      if (size + value.length * 2 > max) throw new RangeError('message byte limit');
      for (const child of value.items()) pending.push({value: child, depth: depth + 1});
    }
    if (size > max) throw new RangeError('message byte limit');
  }
}
export function encodeMessage(message: Value, maxBytes = DEFAULT_MAX_MESSAGE_BYTES): Uint8Array {
  limit(maxBytes); assertValue(message); bounded(message, maxBytes);
  return encode(message);
}
export function decodeMessage(bytes: Uint8Array, maxBytes = DEFAULT_MAX_MESSAGE_BYTES): Value {
  limit(maxBytes);
  if (bytes.byteLength > maxBytes) throw new RangeError('message byte limit');
  return decode(bytes, {maxDepth: MAX_MESSAGE_DEPTH, maxAtomBytes: bytes.byteLength,
    maxTupleArity: Math.floor(bytes.byteLength / 2)});
}

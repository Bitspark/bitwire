// Canonical envelope representation; no service or transport implementation.
import { Atom, Tuple, atom, tuple, assertValue, type Value } from './ontos/core.js';
import { encode, decode } from './ontos/codec.js';
import type { Envelope, Path } from './index.js';
const version = atom(new TextEncoder().encode('bitwire/envelope/1'));
export const WEBSOCKET_PROTOCOL = 'bitwire.ontos.v1';
export const MAX_ENVELOPE_DEPTH = 4096;
export const DEFAULT_MAX_ENVELOPE_BYTES = 16 * 1024 * 1024;
function limit(n: number): number {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('limit must be a positive safe integer');
  return n;
}
function path(value: unknown): Path {
  if (!Array.isArray(value)) throw new TypeError('path must be an array of atoms');
  const out: Atom[] = [];
  for (const key of value) {
    if (!(key instanceof Atom)) throw new TypeError('path key must be an atom');
    out.push(key);
  }
  return Object.freeze(out);
}
export function pathEqual(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((key, i) => key.equals(b[i]!));
}
export function pathStartsWith(a: Path, prefix: Path): boolean {
  return a.length >= prefix.length && prefix.every((key, i) => key.equals(a[i]!));
}
export function captureEnvelope(e: Envelope): Envelope {
  if (!e || typeof e !== 'object') throw new TypeError('envelope must be a record');
  const prototype = Object.getPrototypeOf(e);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('envelope must be a plain record');
  const d = Object.getOwnPropertyDescriptors(e);
  const fields = ['source', 'destination', 'id', 'payload', 'correlation'];
  for (const k of Reflect.ownKeys(d)) {
    if (typeof k !== 'string' || !fields.includes(k) || !Object.hasOwn(d[k]!, 'value'))
      throw new TypeError('unknown envelope field or accessor');
  }
  for (const k of fields.slice(0, 4)) if (!Object.hasOwn(d, k)) throw new TypeError('missing envelope field');
  const source = path(d.source!.value), destination = path(d.destination!.value);
  const id: unknown = d.id!.value, correlation: unknown = d.correlation?.value;
  if (!(id instanceof Atom) || (correlation !== undefined && !(correlation instanceof Atom)))
    throw new TypeError('ID and correlation must be atoms');
  const payload: unknown = d.payload!.value; assertValue(payload);
  return Object.freeze({ source, destination, id, payload,
    ...(correlation === undefined ? {} : { correlation }) });
}
function varintLength(n: number): number {
  let length = 1; while (n >= 128) { n = Math.floor(n / 128); length++; } return length;
}
function bounded(v: Value, max: number): void {
  const pending: { value: Value; depth: number }[] = [{ value: v, depth: 0 }];
  let size = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (depth > MAX_ENVELOPE_DEPTH) throw new RangeError('envelope depth limit');
    size += 1 + varintLength(value.length);
    if (value instanceof Atom) size += value.length;
    else {
      if (size + value.length * 2 > max) throw new RangeError('envelope byte limit');
      for (const child of value.items()) pending.push({ value: child, depth: depth + 1 });
    }
    if (size > max) throw new RangeError('envelope byte limit');
  }
}
export function encodeEnvelope(e: Envelope, maxBytes = DEFAULT_MAX_ENVELOPE_BYTES): Uint8Array {
  limit(maxBytes); const c = captureEnvelope(e);
  const v = tuple([version, tuple(c.source), tuple(c.destination), c.id,
    tuple(c.correlation === undefined ? [] : [c.correlation]), c.payload]);
  bounded(v, maxBytes); return encode(v);
}
export function decodeEnvelope(bytes: Uint8Array, maxBytes = DEFAULT_MAX_ENVELOPE_BYTES): Envelope {
  limit(maxBytes);
  if (bytes.byteLength > maxBytes) throw new RangeError('envelope byte limit');
  // Every child costs at least two encoded bytes. Impossible length claims
  // must fail before a native decoder allocates a tuple from the prefix.
  const v = decode(bytes, { maxDepth: MAX_ENVELOPE_DEPTH, maxAtomBytes: bytes.byteLength, maxTupleArity: Math.floor(bytes.byteLength / 2) });
  if (!(v instanceof Tuple) || v.length !== 6 || !version.equals(v.at(0)!)) throw new TypeError('envelope version or arity');
  const s = v.at(1)!, d = v.at(2)!, id = v.at(3)!, correlation = v.at(4)!;
  if (!(s instanceof Tuple) || !(d instanceof Tuple) || !(id instanceof Atom)
    || !(correlation instanceof Tuple) || correlation.length > 1) throw new TypeError('invalid envelope header');
  return captureEnvelope({ source: s.items() as Path, destination: d.items() as Path, id,
    ...(correlation.length ? { correlation: correlation.at(0) as Atom } : {}), payload: v.at(5)! });
}

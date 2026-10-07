// Pure bitwire/hydrated/1 data and grammar. Live endpoints and registries belong to bitruntime.
import { Atom, Tuple, atom, tuple, type Value } from './ontos/core.js';
import { capturePath } from './message.js';
import type { Path } from './index.js';

export interface HydratedCodecLimits { readonly nodes: number; readonly depth: number; readonly bytes: number }
export class HydratedCodecError extends Error {
  readonly kind: 'malformed' | 'limit';
  constructor(kind: 'malformed' | 'limit') {
    super(`hydrated codec: ${kind}`);
    this.name = 'HydratedCodecError'; this.kind = kind;
  }
}
function malformed(): never { throw new HydratedCodecError('malformed'); }
function limited(): never { throw new HydratedCodecError('limit'); }
const data = new WeakSet<object>();
const HEADER = atom(new TextEncoder().encode('bitwire/hydrated/1'));
const TUPLE = atom([1]), REFERENCE = atom([2]);
const atomLength = Object.getOwnPropertyDescriptor(Atom.prototype, 'length')!.get!;
const tupleLength = Object.getOwnPropertyDescriptor(Tuple.prototype, 'length')!.get!;
function requireGround(value: unknown): asserts value is Value {
  if (value === null || typeof value !== 'object') malformed();
  const prototype = Object.getPrototypeOf(value);
  try {
    if (prototype === Atom.prototype) { atomLength.call(value); return; }
    if (prototype === Tuple.prototype) { tupleLength.call(value); return; }
  } catch { malformed(); }
  malformed();
}
function requireAtom(value: unknown): asserts value is Atom {
  requireGround(value);
  if (!(value instanceof Atom)) malformed();
}

export class HydratedDataAtom {
  readonly kind = 'atom';
  readonly value: Atom;
  constructor(value: Atom) {
    if (new.target !== HydratedDataAtom) malformed();
    requireAtom(value);
    this.value = value; data.add(this); Object.freeze(this);
  }
}
export class HydratedDataTuple {
  readonly kind = 'tuple';
  readonly #items: readonly HydratedData[];
  constructor(items: readonly HydratedData[]) {
    if (new.target !== HydratedDataTuple || !Array.isArray(items)) malformed();
    const copy: HydratedData[] = [];
    for (const item of items) { requireData(item); copy.push(item); }
    this.#items = Object.freeze(copy); data.add(this); Object.freeze(this);
  }
  get length(): number { return this.#items.length; }
  items(): readonly HydratedData[] { return this.#items; }
  at(index: number): HydratedData | undefined { return this.#items[index]; }
}
/** A data descriptor, never a live Wire. Scope and id validity imply no liveness. */
export class HydratedReference {
  readonly kind = 'reference';
  readonly path: Path;
  readonly scope: Atom;
  readonly id: Atom;
  constructor(path: Path, scope: Atom, id: Atom) {
    if (new.target !== HydratedReference) malformed();
    requireToken(scope); requireToken(id);
    try { this.path = capturePath(path); } catch { malformed(); }
    for (const key of this.path) requireAtom(key);
    this.scope = scope; this.id = id; data.add(this); Object.freeze(this);
  }
}
export type HydratedData = HydratedDataAtom | HydratedDataTuple | HydratedReference;
export interface HydratedFrame { readonly scope: Atom; readonly id: Atom; readonly body: HydratedData }

function requireData(value: unknown): asserts value is HydratedData {
  if (typeof value !== 'object' || value === null || !data.has(value)) malformed();
}
function requireToken(value: unknown): asserts value is Atom {
  requireAtom(value);
  if (value.length !== 16) malformed();
}
function options(value: HydratedCodecLimits): HydratedCodecLimits {
  const captured = { nodes: value?.nodes, depth: value?.depth, bytes: value?.bytes };
  for (const n of Object.values(captured)) {
    if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('hydrated codec limits must be positive safe integers');
  }
  return captured;
}
function varintSize(value: number): number {
  let size = 1;
  while (value >= 128) { value = Math.floor(value / 128); size++; }
  return size;
}
const atomSize = (value: Atom) => 1 + varintSize(value.length) + value.length;
const FRAME_OVERHEAD = 2 + atomSize(HEADER) + 18 + 18;

class Budget {
  nodes = 0;
  valueBytes = 0;
  encodedBytes = 0;
  constructor(readonly limits: HydratedCodecLimits) {}
  node(depth: number): void {
    if (this.nodes >= this.limits.nodes || depth > this.limits.depth) limited();
    this.nodes++;
  }
  payload(bytes: number): void {
    if (bytes > this.limits.bytes - this.valueBytes) limited();
    this.valueBytes += bytes;
  }
  encoded(bytes: number): void {
    if (bytes > this.limits.bytes - this.encodedBytes) limited();
    this.encodedBytes += bytes;
  }
}
function referenceBudget(ref: HydratedReference, budget: Budget, tagged: boolean): void {
  // Reference metadata contributes bytes, not additional semantic nodes/depth.
  budget.payload(32);
  budget.encoded((tagged ? 5 : 0) + 2 + 36 + 1 + varintSize(ref.path.length));
  for (const key of ref.path) { budget.payload(key.length); budget.encoded(atomSize(key)); }
}
function measure(root: HydratedData, limits: HydratedCodecLimits, prefix = 0, referenceOnly = false): void {
  const budget = new Budget(limits);
  budget.encoded(prefix);
  const pending = [{ node: root, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    requireData(node); budget.node(depth);
    if (node instanceof HydratedDataAtom) {
      budget.payload(node.value.length); budget.encoded(atomSize(node.value));
    } else if (node instanceof HydratedReference) {
      referenceBudget(node, budget, !referenceOnly);
    } else {
      budget.encoded(6 + varintSize(node.length));
      if (node.length > limits.nodes - budget.nodes - pending.length) limited();
      for (const child of node.items()) pending.push({ node: child, depth: depth + 1 });
    }
  }
}
/** Count raw ontos bytes without allocating an encoded byte buffer. */
function checkEncoded(value: Value, maxBytes: number): void {
  requireGround(value);
  let size = 0;
  const pending = [value];
  while (pending.length) {
    const next = pending.pop()!;
    requireGround(next);
    const cost = 1 + varintSize(next.length) + (next instanceof Atom ? next.length : 0);
    if (cost > maxBytes - size) limited();
    size += cost;
    if (next instanceof Tuple) {
      if (next.length > Math.floor((maxBytes - size) / 2) - pending.length) limited();
      for (const child of next.items()) pending.push(child);
    }
  }
}
function referenceValue(ref: HydratedReference): Tuple {
  return tuple([tuple(ref.path), ref.scope, ref.id]);
}
function readReference(value: Value): HydratedReference {
  if (!(value instanceof Tuple) || value.length !== 3) malformed();
  const [path, scope, id] = value.items();
  if (!(path instanceof Tuple)) malformed();
  requireToken(scope); requireToken(id);
  return new HydratedReference(path.items() as Path, scope, id);
}

/** Construct ground values after the entire structural value has passed bounds. */
function buildBody(root: HydratedData, groundOnly = false): Value {
  const results = new Map<HydratedData, Value>();
  const pending = [{ node: root, visited: false }];
  while (pending.length) {
    const { node, visited } = pending.pop()!;
    requireData(node);
    if (results.has(node)) continue;
    if (node instanceof HydratedDataAtom) results.set(node, node.value);
    else if (node instanceof HydratedReference) {
      if (groundOnly) malformed();
      results.set(node, tuple([REFERENCE, referenceValue(node)]));
    } else if (!visited) {
      pending.push({ node, visited: true });
      for (let i = node.length - 1; i >= 0; i--) pending.push({ node: node.at(i)!, visited: false });
    } else {
      const children = tuple(node.items().map(child => results.get(child)!));
      results.set(node, groundOnly ? children : tuple([TUPLE, children]));
    }
  }
  return results.get(root)!;
}
function readBody(root: Value, limits: HydratedCodecLimits, groundOnly = false): HydratedData {
  const budget = new Budget(limits);
  const results = new Map<Value, HydratedData>();
  const pending: { value: Value; depth: number; children?: readonly Value[] }[] = [{ value: root, depth: 0 }];
  while (pending.length) {
    const { value, depth, children } = pending.pop()!;
    if (children) {
      results.set(value, new HydratedDataTuple(children.map(child => results.get(child)!)));
      continue;
    }
    requireGround(value);
    budget.node(depth);
    if (value instanceof Atom) {
      budget.payload(value.length); budget.encoded(atomSize(value));
      results.set(value, new HydratedDataAtom(value));
      continue;
    }
    if (!(value instanceof Tuple)) malformed();
    let nested: readonly Value[];
    if (groundOnly) nested = value.items(); // explicit ground-value embedding
    else {
      if (value.length !== 2) malformed();
      const [tag, payload] = value.items();
      if (!(tag instanceof Atom)) malformed();
      if (tag.equals(REFERENCE)) {
        const ref = readReference(payload!);
        referenceBudget(ref, budget, true);
        results.set(value, ref);
        continue;
      }
      if (!tag.equals(TUPLE) || !(payload instanceof Tuple)) malformed();
      nested = payload.items();
    }
    budget.encoded(6 + varintSize(nested.length));
    if (nested.length > limits.nodes - budget.nodes) limited();
    pending.push({ value, depth, children: nested });
    for (let i = nested.length - 1; i >= 0; i--) pending.push({ value: nested[i]!, depth: depth + 1 });
  }
  return results.get(root)!;
}

export function hydratedDataFromGround(value: Value, limits: HydratedCodecLimits): HydratedData {
  requireGround(value);
  return readBody(value, options(limits), true);
}
export function hydratedDataToGround(value: HydratedData, limits: HydratedCodecLimits): Value {
  measure(value, options(limits));
  return buildBody(value, true);
}

export function packHydratedBody(value: HydratedData, limits: HydratedCodecLimits): Value {
  measure(value, options(limits));
  return buildBody(value);
}
export function unpackHydratedBody(value: Value, limits: HydratedCodecLimits): HydratedData {
  const captured = options(limits);
  checkEncoded(value, captured.bytes);
  return readBody(value, captured);
}
export function packHydratedReference(value: HydratedReference, limits: HydratedCodecLimits): Value {
  requireData(value);
  if (!(value instanceof HydratedReference)) malformed();
  measure(value, options(limits), 0, true);
  return referenceValue(value);
}
export function unpackHydratedReference(value: Value, limits: HydratedCodecLimits): HydratedReference {
  const captured = options(limits);
  checkEncoded(value, captured.bytes);
  const ref = readReference(value);
  measure(ref, captured, 0, true);
  return ref;
}
export function packHydratedFrame(frame: HydratedFrame, limits: HydratedCodecLimits): Value {
  const captured = options(limits);
  requireToken(frame?.scope); requireToken(frame?.id);
  measure(frame.body, captured, FRAME_OVERHEAD);
  return tuple([HEADER, frame.scope, frame.id, buildBody(frame.body)]);
}
export function unpackHydratedFrame(value: Value, limits: HydratedCodecLimits): HydratedFrame {
  const captured = options(limits);
  checkEncoded(value, captured.bytes);
  if (!(value instanceof Tuple) || value.length !== 4 || !HEADER.equals(value.at(0)!)) malformed();
  const [, scope, id, body] = value.items();
  requireToken(scope); requireToken(id);
  return Object.freeze({ scope, id, body: readBody(body!, captured) });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  Atom, Tuple, atom, tuple, encodeMessage, decodeMessage, packAddressed, unpackAddressed,
  HydratedDataAtom, HydratedDataTuple, HydratedReference, HydratedCodecError,
  hydratedDataFromGround, hydratedDataToGround, packHydratedBody, unpackHydratedBody,
  packHydratedReference, unpackHydratedReference, packHydratedFrame, unpackHydratedFrame,
} from '../wire/ts/dist/index.js';

const vectors = JSON.parse(readFileSync(new URL('./hydrated-vectors.json', import.meta.url)));
const limits = { nodes: 10000, depth: 100, bytes: 1000000 };
const hexAtom = hex => atom(Buffer.from(hex, 'hex'));
const textAtom = value => atom(new TextEncoder().encode(value));
const a = value => new HydratedDataAtom(textAtom(value));
const t = (...values) => new HydratedDataTuple(values);
const r = (path = [], scope = 'S', id = 'I1') => new HydratedReference(path.map(textAtom), hexAtom(vectors.scopes[scope]), hexAtom(vectors.ids[id]));
const ground = value => 'atom' in value ? hexAtom(value.atom) : tuple(value.tuple.map(ground));
const hex = value => Buffer.from(encodeMessage(value)).toString('hex');
const shape = value => value instanceof HydratedDataAtom ? { atom: value.value.toJSON().atom }
  : value instanceof HydratedReference ? { path: value.path.map(x => x.toJSON().atom), scope: value.scope.toJSON().atom, id: value.id.toJSON().atom }
  : { tuple: value.items().map(shape) };
const failure = kind => error => error instanceof HydratedCodecError && error.kind === kind;

// Constructed independently of the encoded bodies and the decoder under test.
const client = r(['client42']);
const fixtures = [
  a('hello'), a(''), new HydratedDataAtom(atom([1])), new HydratedDataAtom(atom([2])),
  t(), t(a('a'), a('b')), client, r(),
  new HydratedReference([atom([]), atom([255, 47])], hexAtom(vectors.scopes.S2), hexAtom(vectors.ids.I7)),
  t(a('echo'), a('hello'), client),
  t(a('hello'), t(r(['a', 'b', 'service2'], 'S2', 'I7'), r(['client42'], 'S', 'I2'))),
  t(client, client),
  t(new HydratedDataAtom(atom([2])), t(t(a('client42')), new HydratedDataAtom(hexAtom(vectors.scopes.S)), new HydratedDataAtom(hexAtom(vectors.ids.I1)))),
  t(new HydratedDataAtom(atom([1])), t()),
];
test('public codec matches all independently derived body vectors in both directions', () => {
  assert.equal(fixtures.length, vectors.encode.length);
  vectors.encode.forEach((c, i) => {
    assert.equal(hex(packHydratedBody(fixtures[i], limits)), c.hex, c.name);
    assert.deepEqual(shape(unpackHydratedBody(ground(c.body), limits)), shape(fixtures[i]), c.name);
  });
});
test('public codec matches all independently derived addressed frame vectors', () => {
  const bodies = [fixtures[9], t(a('hello'), r(['a', 'b', 'service2'], 'S2', 'I8')), a('ping')];
  vectors.frames.forEach((c, i) => {
    const frame = { scope: hexAtom(c.scope), id: hexAtom(c.id), body: bodies[i] };
    assert.equal(hex(packAddressed(c.path.map(hexAtom), packHydratedFrame(frame, limits))), c.hex, c.name);
    const decoded = unpackHydratedFrame(unpackAddressed(decodeMessage(Buffer.from(c.hex, 'hex'))).message, limits);
    assert.ok(decoded.scope.equals(frame.scope)); assert.ok(decoded.id.equals(frame.id));
    assert.deepEqual(shape(decoded.body), shape(frame.body));
  });
});
test('all malformed corpus bodies and frames refuse without a partial result', () => {
  for (const c of vectors.rejectBody) assert.throws(() => unpackHydratedBody(ground(c.value), limits), failure('malformed'), c.name);
  for (const c of vectors.rejectFrame) assert.throws(() => unpackHydratedFrame(ground(c.value), limits), failure('malformed'), c.name);
});
test('ground conversion never recognizes reference-shaped ordinary data', () => {
  const ordinary = tuple([atom([2]), tuple([tuple(client.path), client.scope, client.id])]);
  const structural = hydratedDataFromGround(ordinary, limits);
  assert.ok(hydratedDataToGround(unpackHydratedBody(packHydratedBody(structural, limits), limits), limits).equals(ordinary));
  assert.throws(() => hydratedDataToGround(t(a('ok'), client), limits), failure('malformed'));
});
test('tuple and reference construction capture caller storage and expose no mutable storage', () => {
  const bytes = new Uint8Array(16), keys = [atom([255])];
  const ref = new HydratedReference(keys, atom(bytes), atom(bytes));
  const children = [ref], value = new HydratedDataTuple(children);
  bytes.fill(255); keys.length = 0; children.length = 0;
  assert.equal(value.length, 1); assert.equal(ref.path.length, 1); assert.equal(ref.scope.bytes()[0], 0);
  assert.throws(() => value.items().push(a('bad')), TypeError);
  assert.throws(() => ref.path.pop(), TypeError);
  assert.equal(value.at(1), undefined);
});
test('exact and one-over bounds agree for body, frame and reference operations', () => {
  // Empty reference body = 45 bytes; tuple wrapper = 7; frame wrapper = 58.
  const ref = r(), value = t(ref, ref, ref);
  const exact = { nodes: 4, depth: 1, bytes: 142 };
  const body = packHydratedBody(value, exact);
  assert.equal(encodeMessage(body).length, 142);
  assert.deepEqual(shape(unpackHydratedBody(body, exact)), shape(value));
  for (const bound of [{ ...exact, nodes: 3 }, { ...exact, bytes: 141 }]) {
    assert.throws(() => packHydratedBody(value, bound), failure('limit'));
    assert.throws(() => unpackHydratedBody(body, bound), failure('limit'));
  }
  const frame = { scope: ref.scope, id: ref.id, body: value };
  const frameBounds = { ...exact, bytes: 200 };
  const encoded = packHydratedFrame(frame, frameBounds);
  assert.equal(encodeMessage(encoded).length, 200);
  unpackHydratedFrame(encoded, frameBounds);
  assert.throws(() => packHydratedFrame(frame, { ...frameBounds, bytes: 199 }), failure('limit'));
  assert.throws(() => unpackHydratedFrame(encoded, { ...frameBounds, bytes: 199 }), failure('limit'));
  const payload = packHydratedReference(ref, { nodes: 1, depth: 1, bytes: 40 });
  assert.equal(encodeMessage(payload).length, 40);
  assert.deepEqual(shape(unpackHydratedReference(payload, { nodes: 1, depth: 1, bytes: 40 })), shape(ref));
  assert.throws(() => packHydratedReference(ref, { nodes: 1, depth: 1, bytes: 39 }), failure('limit'));
  assert.throws(() => unpackHydratedReference(payload, { nodes: 1, depth: 1, bytes: 39 }), failure('limit'));
});
test('root depth, metadata path length, empty leaves and varint transitions have fixed meanings', () => {
  const value = t(t(r(['', '', '', '', ''])));
  const exact = { nodes: 3, depth: 2, bytes: 69 }; // 2*7 + 45 + 5*2
  const body = packHydratedBody(value, exact);
  assert.equal(encodeMessage(body).length, 69); unpackHydratedBody(body, exact);
  for (const fn of [() => packHydratedBody(value, { ...exact, depth: 1 }), () => unpackHydratedBody(body, { ...exact, depth: 1 })]) assert.throws(fn, failure('limit'));
  for (const count of [0, 127, 128]) {
    const data = t(...Array(count).fill(a('')));
    const size = 6 + (count < 128 ? 1 : 2) + count * 2;
    const bounds = { nodes: count + 1, depth: 1, bytes: size };
    const packed = packHydratedBody(data, bounds);
    assert.equal(encodeMessage(packed).length, size); unpackHydratedBody(packed, bounds);
    assert.throws(() => packHydratedBody(data, { ...bounds, bytes: size - 1 }), failure('limit'));
    assert.throws(() => unpackHydratedBody(packed, { ...bounds, bytes: size - 1 }), failure('limit'));
  }
});
test('very deep inputs are iterative and compact shared trees remain bounded', () => {
  let value = a(''), ordinary = atom([]);
  for (let i = 0; i < 20000; i++) { value = t(value); ordinary = tuple([ordinary]); }
  const deep = { nodes: 20001, depth: 20000, bytes: 140002 };
  const packed = packHydratedBody(value, deep);
  let unpacked = unpackHydratedBody(packed, deep), n = 0;
  while (unpacked instanceof HydratedDataTuple) { n++; unpacked = unpacked.at(0); }
  assert.equal(n, 20000);
  hydratedDataFromGround(ordinary, deep);
  assert.throws(() => unpackHydratedBody(packed, { ...deep, depth: 19999 }), failure('limit'));
  let shared = a(''), sharedGround = atom([]);
  for (let i = 0; i < 80; i++) { shared = t(shared, shared); sharedGround = tuple([sharedGround, sharedGround]); }
  assert.throws(() => packHydratedBody(shared, limits), failure('limit'));
  assert.throws(() => hydratedDataFromGround(sharedGround, limits), failure('limit'));
});
test('foreign objects, prototype forgeries, subclass hooks, cycles and invalid options refuse', () => {
  let invoked = false;
  const foreign = { kind: 'reference', send() { invoked = true; } };
  assert.throws(() => packHydratedBody(foreign, limits), failure('malformed'));
  assert.throws(() => new HydratedDataTuple([foreign]), failure('malformed'));
  assert.throws(() => packHydratedBody(Object.create(HydratedDataTuple.prototype), limits), failure('malformed'));
  assert.throws(() => new HydratedDataAtom(Object.create(Atom.prototype)), failure('malformed'));
  class ForeignTuple extends Tuple { items() { invoked = true; return [this]; } }
  assert.throws(() => unpackHydratedBody(new ForeignTuple([]), limits), failure('malformed'));
  class ForeignData extends HydratedDataTuple { items() { invoked = true; return [this]; } }
  assert.throws(() => new ForeignData([]), failure('malformed'));
  const cyclic = []; cyclic.push(cyclic);
  assert.throws(() => new HydratedDataTuple(cyclic), failure('malformed'));
  assert.equal(invoked, false);
  for (const n of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    for (const key of ['nodes', 'depth', 'bytes']) assert.throws(() => packHydratedBody(a(''), { ...limits, [key]: n }), RangeError);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Atom, Tuple, atom, tuple, encodeEnvelope, decodeEnvelope, captureEnvelope, pathEqual } from '../wire/ts/dist/index.js';
import { encode, decode, encodeUvarint } from '../wire/ts/dist/ontos/codec.js';
import * as data from '../wire/ts/dist/ontos/data.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const from=v=>'atom' in v ? atom(Buffer.from(v.atom,'hex')) : tuple(v.tuple.map(from));
const fixture=e=>({source:e.source.map(k=>atom(Buffer.from(k,'hex'))),destination:e.destination.map(k=>atom(Buffer.from(k,'hex'))),id:atom(Buffer.from(e.id,'hex')),payload:from(e.payload),...('correlation' in e ? {correlation:atom(Buffer.from(e.correlation,'hex'))}:{})});
const hex=b=>Buffer.from(b).toString('hex');
test('pinned consumer mirror has reversible import-only adaptations',()=>{
 const m=json('../ontos/manifest.json'); assert.equal(m.release,'v0.9.0'); assert.equal(m.commit,'5eed85de5697f53397407f9f82f3b310648827f7');
 for(const [p,f] of Object.entries(m.files)) {
  const bytes=readFileSync(new URL('../'+p,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.localSha256,p);
  let source=bytes.toString('utf8'); for(const [before,after] of Object.entries(f.replacements)) source=source.replaceAll(after,before);
  assert.equal(createHash('sha256').update(source).digest('hex'),f.upstreamSha256,p);
 }
});
test('ontos independent structural identity and codec vectors',()=>{
 for(const c of json('../ontos/vectors/identity.json').cases) assert.equal(from(c.left).equals(from(c.right)),c.equal,c.name);
 const v=json('../ontos/vectors/codec.json');
 for(const c of v.uvarint) assert.equal(hex(encodeUvarint(c.n)),c.hex);
 for(const c of v.encode) {assert.equal(hex(encode(from(c.value))),c.hex,c.name);assert.ok(decode(Buffer.from(c.hex,'hex')).equals(from(c.value)),c.name);}
 for(const c of v.reject) assert.throws(()=>decode(Buffer.from(c.hex,'hex')),e=>e.code===c.code,c.name);
});
test('ontos registered data vectors remain optional ground values',()=>{
 const read={int:data.readInt,'utf8-text':data.readText,bool:data.readBool,list:data.readList,map:data.readMap,set:data.readSet,decimal:data.readDecimal,null:data.readNull};
 for(const c of json('../ontos/vectors/data.json').encode) {
  const value=from(c.value); assert.equal(hex(encode(value)),c.hex,c.name);
  const kind=new TextDecoder().decode(value.at(0).bytes()); assert.ok(read[kind],c.name); read[kind](value);
 }
 for(const c of json('../ontos/vectors/data.json').reject) { const kind=c.kind==='text'?'utf8-text':c.kind; assert.throws(()=>read[kind](from(c.value)),c.name); }
});
test('independent envelope vectors and malformed headers',()=>{
 const v=json('./envelope-vectors.json');
 for(const c of v.encode) {
  const e=fixture(c.envelope); assert.equal(hex(encodeEnvelope(e)),c.hex,c.name);
  const d=decodeEnvelope(Buffer.from(c.hex,'hex')); assert.ok(pathEqual(d.source,e.source));assert.ok(pathEqual(d.destination,e.destination));assert.ok(d.id.equals(e.id));assert.ok(d.payload.equals(e.payload));assert.equal(d.correlation===undefined,e.correlation===undefined); if(e.correlation)assert.ok(d.correlation.equals(e.correlation));
 }
 for(const c of v.reject) assert.throws(()=>decodeEnvelope(Buffer.from(c.hex,'hex')),c.name);
});
test('capture refuses language serialization hooks; ownership and cost are explicit',()=>{
 const e=fixture(json('./envelope-vectors.json').encode[0].envelope); const keys=[atom([])]; const c=captureEnvelope({...e,destination:keys}); keys.length=0; assert.equal(c.destination.length,1);
 assert.throws(()=>captureEnvelope({...e,get id(){throw new Error('getter invoked');}}),/accessor/);
 assert.throws(()=>captureEnvelope({...e,extra:1}),/unknown/);
 assert.throws(()=>captureEnvelope({...e,destination:['text']}),/atom/);
 assert.throws(()=>decodeEnvelope(Buffer.from('01ffffff07','hex')),err=>err.code==='limit_exceeded');
 assert.throws(()=>encodeEnvelope(e,1),/limit/);
 assert.throws(()=>decodeEnvelope(encodeEnvelope(e),1),/limit/);
 assert.ok(!pathEqual([], [atom([])])); assert.ok(!pathEqual([atom([97,47,98])],[atom([97]),atom([98])]));
 assert.ok(!atom([]).equals(tuple([]))); assert.ok(new Atom([255]).equals(atom([255]))); assert.ok(new Tuple([]).equals(tuple([])));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Atom, Tuple, atom, tuple, encodeMessage, decodeMessage, packAddressed, unpackAddressed, pathEqual } from '../wire/ts/dist/index.js';
import { encode, decode, encodeUvarint } from '../wire/ts/dist/ontos/codec.js';
import * as data from '../wire/ts/dist/ontos/data.js';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const from=v=>'atom' in v ? atom(Buffer.from(v.atom,'hex')) : tuple(v.tuple.map(from));
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
test('independent raw and addressed vectors',()=>{
 const v=json('./message-vectors.json');
 for(const c of v.encode) {
  const value=from(c.value); assert.equal(hex(encodeMessage(value)),c.hex,c.name);
  assert.ok(decodeMessage(Buffer.from(c.hex,'hex')).equals(value),c.name);
 }
 for(const c of v.addressed) {
  const path=c.path.map(k=>atom(Buffer.from(k,'hex'))), message=from(c.message);
  assert.equal(hex(encodeMessage(packAddressed(path,message))),c.hex,c.name);
  const d=unpackAddressed(decodeMessage(Buffer.from(c.hex,'hex')));
  assert.ok(pathEqual(d.path,path),c.name); assert.ok(d.message.equals(message),c.name);
 }
 for(const c of v.reject) assert.throws(()=>decodeMessage(Buffer.from(c.hex,'hex')),c.name);
 for(const c of v.rejectAddressed) {
  const raw=from(c.value);
  assert.ok(decodeMessage(encodeMessage(raw)).equals(raw),'raw layer interpreted addressed grammar');
  assert.throws(()=>unpackAddressed(raw),c.name);
 }
});

test('path capture, ground identity and preallocation bounds',()=>{
 const keys=[atom([])]; const value=packAddressed(keys,atom([255])); keys.length=0;
 assert.equal(unpackAddressed(value).path.length,1);
 assert.throws(()=>packAddressed(['text'],atom([])),/atom/);
 assert.throws(()=>encodeMessage({toJSON(){throw new Error('hook called');}}),/value/i);
 assert.throws(()=>decodeMessage(Buffer.from('01ffffff07','hex')),err=>err.code==='limit_exceeded');
 assert.throws(()=>encodeMessage(atom([]),1),/limit/);
 assert.throws(()=>decodeMessage(Buffer.from('0000','hex'),1),/limit/);
 assert.ok(!pathEqual([], [atom([])])); assert.ok(!pathEqual([atom([97,47,98])],[atom([97]),atom([98])]));
 assert.ok(!atom([]).equals(tuple([]))); assert.ok(new Atom([255]).equals(atom([255]))); assert.ok(new Tuple([]).equals(tuple([])));
});

// Decision 0019: a test-local reading of the bitwire/hydrated/1 grammar,
// so the independent vectors judge a future codec rather than describe one.
const atomOf=(v,min,max)=>{if(!(v instanceof Atom)||v.length<min||v.length>max) throw new Error('hydrated: atom'); return v;};
const tupleOf=(v,n)=>{if(!(v instanceof Tuple)||(n!==undefined&&v.length!==n)) throw new Error('hydrated: tuple'); return v;};
const hydratedBody=v=>{
 if(v instanceof Atom) return v;
 const [tag,payload]=tupleOf(v,2).items(), t=atomOf(tag,1,1).bytes()[0];
 if(t===1) return {tuple:tupleOf(payload).items().map(hydratedBody)};
 if(t===2) {const [p,scope,id]=tupleOf(payload,3).items(); return {wire:{path:tupleOf(p).items().map(a=>atomOf(a,0,Infinity)),scope:atomOf(scope,16,16),id:atomOf(id,16,16)}};}
 throw new Error('hydrated: tag');
};
const hydratedFrame=v=>{const [h,scope,id,body]=tupleOf(v,4).items(); assert.ok(atomOf(h,0,Infinity).equals(atom(Buffer.from('bitwire/hydrated/1'))),'header'); atomOf(scope,16,16); atomOf(id,16,16); return hydratedBody(body);};
const wires=h=>h instanceof Atom?0:'wire' in h?1:h.tuple.reduce((n,c)=>n+wires(c),0);
test('independent hydrated body and frame vectors (decision 0019)',()=>{
 const v=json('./hydrated-vectors.json');
 for(const c of v.encode) {
  const body=from(c.body); assert.equal(hex(encodeMessage(body)),c.hex,c.name);
  assert.ok(decodeMessage(Buffer.from(c.hex,'hex')).equals(body),c.name);
  assert.equal(wires(hydratedBody(body)),(c.live.match(/wire\{/g)??[]).length,c.name);
 }
 for(const c of v.frames) {
  const path=c.path.map(k=>atom(Buffer.from(k,'hex'))), f=tuple([atom(Buffer.from('bitwire/hydrated/1')),atom(Buffer.from(c.scope,'hex')),atom(Buffer.from(c.id,'hex')),from(c.body)]);
  assert.equal(hex(encodeMessage(packAddressed(path,f))),c.hex,c.name);
  const d=unpackAddressed(decodeMessage(Buffer.from(c.hex,'hex'))); assert.ok(pathEqual(d.path,path),c.name); hydratedFrame(d.message);
 }
 for(const c of v.rejectBody) assert.throws(()=>hydratedBody(from(c.value)),c.name);
 for(const c of v.rejectFrame) assert.throws(()=>hydratedFrame(from(c.value)),c.name);
});

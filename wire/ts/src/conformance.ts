// Consumer-supplied endpoints are judged by contract-owned observations.
import { atom, tuple, pathEqual, type Endpoint, type Value, type Path, type AddressedEndpoint } from './index.js';
export interface PairLimits { maxMessageBytes?: number; maxQueuedBytes?: number; maxQueuedMessages?: number }
export type PairFactory = (limits?: PairLimits) => readonly [Endpoint, Endpoint];
function check(value: unknown, message: string): void { if (!value) throw new Error(message); }
const turn = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export async function checkWirePair(create: PairFactory): Promise<readonly string[]> {
 const observations: string[] = [];
 {
  const [a,b]=create(); const seen: Value[]=[];
  const raw=atom([47,255,0]), opaque=tuple([tuple([]),atom([128])]);
  await a.send(raw); await a.send(raw); await a.send(opaque);
  await turn(); check(seen.length===0,'detached queue delivered');
  const detach=b.receive(x=>seen.push(x));
  check(seen.length===0,'attachment dispatched inline');
  let owned=false; try { b.receive(()=>{}); } catch { owned=true; }
  check(owned,'second receive owner accepted');
  await turn(); check(seen.length===3,'queued admissions missing or deduplicated');
  check(seen[0]!.equals(raw)&&seen[1]!.equals(raw),'bare atoms changed');
  check(seen[2]!.equals(opaque),'opaque message changed');
  detach(); detach(); await a.send(atom([])); await turn(); check(seen.length===3,'detached handler called');
  b.receive(x=>seen.push(x)); await turn(); check(seen.length===4,'reattachment lost queue');
  const replies:Value[]=[]; a.receive(x=>replies.push(x)); await b.send(tuple([])); await turn();
  check(replies.length===1&&replies[0]!.equals(tuple([])),'duplex delivery absent');
  await a.close(); await b.closed; await a.closed; await a.close();
  let refused=false; try { await b.send(raw); } catch {refused=true;}
  check(refused,'send accepted after close');
  observations.push('bare/opaque messages, repeated admissions, detached order, receive ownership, duplex close');
 }
 {
  const [a,b]=create(); b.receive(()=>{throw new Error('expected handler failure');});
  await a.send(atom([])); check((await b.closed).kind==='failed','throwing handler did not fail endpoint'); await a.closed;
  observations.push('handler failure terminates');
 }
 {
  const [a,b]=create({maxQueuedMessages:1}); await a.send(atom([]));
  let refused=false; try {await a.send(atom([1]));} catch {refused=true;}
  check(refused,'overflowing local admission accepted');
  check((await b.closed).kind==='failed','overflow did not fail receiver'); await a.closed;
  observations.push('finite detached queue');
 }
 {
  const [a,b]=create({maxMessageBytes:2});
  let refused=false; try {await a.send(atom([1]));} catch {refused=true;}
  check(refused,'oversized message admitted');
  const seen:Value[]=[]; b.receive(v=>seen.push(v)); await a.send(atom([])); await turn();
  check(seen.length===1&&seen[0]!.equals(atom([])),'outgoing refusal damaged healthy endpoint');
  await a.close(); await b.closed;
  observations.push('outgoing refusal preserves subsequent valid admission');
 }
 return Object.freeze(observations);
}

// The same observations apply to any carrier; the caller owns establishment/cleanup.
export async function checkAddressedEndpoints(a: Endpoint, b: Endpoint,
  adapt: (endpoint: Endpoint) => AddressedEndpoint): Promise<void> {
  const left = adapt(a), right = adapt(b);
  const probe = b.receive(() => {}); probe(); // Construction must not attach.
  check(left.closed === a.closed && right.closed === b.closed, 'addressed lifetime changed');
  const paths: Path[] = [], messages: Value[] = [];
  let finish!: () => void;
  const received = new Promise<void>(resolve => { finish = resolve; });
  const detach = right.receive((path, message) => {
    paths.push(path); messages.push(message); if (paths.length === 3) finish();
  });
  let owned = false; try { b.receive(() => {}); } catch { owned = true; }
  check(owned, 'raw and addressed receive owners overlapped');
  const keys = [atom([255,47]), atom([])], opaque = tuple([atom([128]),tuple([])]);
  const sending = left.send(keys, opaque); keys.length = 0; await sending;
  await left.send([], atom([])); await left.send([atom([])], atom([]));
  await received;
  check(pathEqual(paths[0]!, [atom([255,47]),atom([])]), 'path capture or byte keys changed');
  check(pathEqual(paths[1]!, []) && pathEqual(paths[2]!, [atom([])]), 'self and empty child merged');
  check(messages[0]!.equals(opaque) && messages[1]!.equals(atom([])) && messages[2]!.equals(atom([])), 'message changed');
  detach(); detach();
  await left.close(); await a.closed; await b.closed;
  let refused = false; try { await left.send([], opaque); } catch { refused = true; }
  check(refused, 'addressed admission survived endpoint closure');
}

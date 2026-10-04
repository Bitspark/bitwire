// Consumer-supplied endpoints are tested against contract-owned observations.
import { atom, tuple, type Envelope, type Wire } from './index.js';
export interface PairLimits { maxEnvelopeBytes?: number; maxQueuedBytes?: number; maxQueuedEnvelopes?: number }
export type PairFactory = (limits?: PairLimits) => readonly [Wire, Wire];
function check(value: unknown, message: string): void { if (!value) throw new Error(message); }
const turn = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const envelope = (n: number): Envelope => ({ source: [], destination: [atom([])], id: atom([n]), payload: tuple([atom([255,0])]) });
export async function checkWirePair(create: PairFactory): Promise<readonly string[]> {
 const observations: string[] = [];
 {
  const [a,b]=create(); const seen: Envelope[]=[];
  const keys=[atom([47,255])]; const e={...envelope(1),destination:keys};
  await a.send(e); keys.length=0; await a.send(envelope(1));
  await turn(); check(seen.length===0,'detached queue delivered');
  const detach=b.receive(x=>seen.push(x));
  let owned=false; try { b.receive(()=>{}); } catch { owned=true; }
  check(owned,'second receive owner accepted');
  await turn(); check(seen.length===2,'queued admissions missing or deduplicated');
  check(seen[0]!.destination[0]!.equals(atom([47,255])),'header snapshot changed');
  check(seen[1]!.payload.equals(envelope(1).payload),'opaque payload changed');
  detach(); detach(); await a.send(envelope(2)); await turn(); check(seen.length===2,'detached handler called');
  b.receive(x=>seen.push(x)); await turn(); check(seen.length===3,'reattachment lost queue');
  const replies:Envelope[]=[]; a.receive(x=>replies.push(x)); await b.send(envelope(3)); await turn();
  check(replies.length===1,'duplex delivery absent');
  await a.close(); await b.closed; await a.closed; await a.close();
  let refused=false; try { await b.send(envelope(4)); } catch {refused=true;}
  check(refused,'send accepted after close');
  observations.push('duplex, snapshot, detached order, duplicate IDs, receive ownership, close');
 }
 {
  const [a,b]=create(); b.receive(()=>{throw new Error('expected handler failure');});
  await a.send(envelope(1)); check((await b.closed).kind==='failed','throwing handler did not fail endpoint'); await a.closed;
  observations.push('handler failure terminates');
 }
 {
  const [a,b]=create({maxQueuedEnvelopes:1}); await a.send(envelope(1));
  try {await a.send(envelope(2));} catch {}
  check((await b.closed).kind==='failed','overflow did not fail receiver'); await a.closed;
  observations.push('finite detached queue');
 }
 return Object.freeze(observations);
}

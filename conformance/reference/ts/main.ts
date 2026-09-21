import type { Endpoint, Message, Path, Receiver, ReturnAddress, Wire } from '../../../wire/ts/src/index.ts';

// Test-only admission scheduler. No code here is a shipped runtime.
class Scheduler {
  readonly tasks: (() => void)[] = [];
  drain(): void { while (this.tasks.length) this.tasks.shift()!(); }
}

class TestEndpoint implements Endpoint {
  peer!: TestEndpoint;
  private receiver?: Receiver;
  private ended = false;
  private readonly scheduler: Scheduler;
  constructor(scheduler: Scheduler) { this.scheduler = scheduler; }
  send(path: Path, message: Message): void {
    if (this.ended || this.peer.ended) throw new Error('closed');
    const segments = [...path];
    this.scheduler.tasks.push(() => this.peer.receiver?.message?.(segments, message));
  }
  receive(receiver: Receiver): () => void {
    if (this.ended) throw new Error('closed');
    if (this.receiver) throw new Error('receive attachment already owned');
    this.receiver = receiver;
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      if (this.receiver === receiver) this.receiver = undefined;
    };
  }
  close(code = 0, reason = ''): void {
    if (this.ended) return;
    this.ended = true;
    const receiver = this.receiver;
    this.receiver = undefined;
    this.scheduler.tasks.push(() => receiver?.closed?.(code, reason));
  }
}

function pair(scheduler: Scheduler): [TestEndpoint, TestEndpoint] {
  const a = new TestEndpoint(scheduler), b = new TestEndpoint(scheduler);
  a.peer = b; b.peer = a;
  return [a, b];
}

function at(wire: Wire, prefix: Path): Wire {
  const origin = [...prefix];
  return { send: (path, message) => wire.send([...origin, ...path], message) };
}

function mount(children: ReadonlyMap<string, Wire>): Wire {
  return { send(path, message) {
    if (!path.length || !children.has(path[0]!)) throw new Error('no mounted destination');
    children.get(path[0]!)!.send(path.slice(1), message);
  } };
}

function prefixOf(prefix: Path, path: Path): boolean {
  return prefix.length <= path.length && prefix.every((part, i) => part === path[i]);
}

// An explicit optional routing policy: unique prefixes, longest prefix wins,
// and callbacks see suffixes relative to their selected view. Wire does not
// require this policy. Exactly one router owns the endpoint attachment.
class TestRouter {
  private readonly routes = new Map<string, { prefix: Path; receiver: Receiver }>();
  private readonly detachRoot: () => void;
  private readonly endpoint: Endpoint;
  private readonly views = new Set<SelectedEndpoint>();
  ended = false;
  constructor(endpoint: Endpoint) {
    this.endpoint = endpoint;
    this.detachRoot = endpoint.receive({ message: (path, message) => {
      const matching = [...this.routes.values()].filter(route => prefixOf(route.prefix, path));
      matching.sort((a, b) => b.prefix.length - a.prefix.length);
      const selected = matching[0];
      return selected?.receiver.message?.(path.slice(selected.prefix.length), message);
    }, closed: (code, reason) => this.finish(code, reason) });
  }
  bind(prefix: Path, receiver: Receiver): () => void {
    if (this.ended) throw new Error('dispatcher ended');
    const key = JSON.stringify(prefix);
    if (this.routes.has(key)) throw new Error('duplicate prefix');
    const route = { prefix: [...prefix], receiver };
    this.routes.set(key, route);
    let detached = false;
    return () => {
      if (detached) return;
      detached = true;
      if (this.routes.get(key) === route) this.routes.delete(key);
    };
  }
  select(prefix: Path): SelectedEndpoint {
    const view = new SelectedEndpoint(this, this.endpoint, prefix);
    this.views.add(view);
    return view;
  }
  private finish(code: number, reason: string): void {
    if (this.ended) return;
    this.ended = true;
    for (const view of this.views) view.close(code, reason);
    this.routes.clear();
  }
  detach(): void { this.detachRoot(); this.finish(0, 'dispatcher detached'); }
}

// A selected receiving Endpoint owns only its route and attachment. Every view
// shares the same root dispatcher; even nested selection creates no root receiver.
class SelectedEndpoint implements Endpoint {
  private readonly router: TestRouter;
  private readonly access: Wire;
  private readonly prefix: Path;
  private attachment?: { receiver: Receiver; detachRoute: () => void };
  private ended = false;
  constructor(router: TestRouter, root: Wire, prefix: Path) {
    this.router = router; this.prefix = [...prefix]; this.access = at(root, prefix);
  }
  select(suffix: Path): SelectedEndpoint { return this.router.select([...this.prefix, ...suffix]); }
  send(path: Path, message: Message): void {
    if (this.ended || this.router.ended) throw new Error('view closed');
    this.access.send(path, message);
  }
  receive(receiver: Receiver): () => void {
    if (this.ended || this.router.ended) throw new Error('view closed');
    if (this.attachment) throw new Error('view receive attachment already owned');
    const attachment = { receiver, detachRoute: this.router.bind(this.prefix, receiver) };
    this.attachment = attachment;
    return () => {
      attachment.detachRoute();
      if (this.attachment === attachment) this.attachment = undefined;
    };
  }
  close(code = 0, reason = ''): void {
    if (this.ended) return;
    this.ended = true;
    const attachment = this.attachment;
    this.attachment = undefined;
    attachment?.detachRoute();
    attachment?.receiver.closed?.(code, reason);
  }
}

const scheduler = new Scheduler();
const event: Message = { frame: { version: 1, kind: 'event', data: null } };
const [client, server] = pair(scheduler);
const router = new TestRouter(server);
const deliveries: string[] = [];
const detachA = router.bind(['a'], { message: path => { deliveries.push(`a:${path.join('/')}`); } });
router.bind(['b'], { message: path => { deliveries.push(`b:${path.join('/')}`); } });
let duplicateEndpointAttachmentRefused = false;
try { server.receive({}); } catch { duplicateEndpointAttachmentRefused = true; }
at(client, ['a']).send(['run'], event);
at(client, ['b']).send(['run'], event);
const receiverRanDuringSend = deliveries.length !== 0;
scheduler.drain();
detachA(); detachA();
at(client, ['a']).send(['ignored'], event);
at(client, ['b']).send(['after-detach'], event);
scheduler.drain();
router.detach();
let attachmentReusableAfterDetach = false;
const replacement = server.receive({ message: () => { attachmentReusableAfterDetach = true; } });
router.detach(); // A stale detach must not remove the replacement attachment.
client.send(['replacement'], event); scheduler.drain(); replacement();

const [overlapClient, overlapServer] = pair(scheduler);
const overlapRouter = new TestRouter(overlapServer);
const overlapDeliveries: string[] = [];
overlapRouter.bind(['a'], { message: path => { overlapDeliveries.push(`parent:${path.join('/')}`); } });
const detachDeep = overlapRouter.bind(['a', 'b'], { message: path => { overlapDeliveries.push(`deep:${path.join('/')}`); } });
let duplicateRouteRefused = false;
try { overlapRouter.bind(['a'], {}); } catch { duplicateRouteRefused = true; }
overlapClient.send(['a', 'b', 'run'], event); scheduler.drain();
detachDeep();
overlapClient.send(['a', 'b', 'run'], event); scheduler.drain();

const [forwardClient, forwardServer] = pair(scheduler);
const [destinationClient, destinationServer] = pair(scheduler);
const destinationRouter = new TestRouter(destinationServer);
let reply = '';
const returnAddress: ReturnAddress = { wire: { send: (_path, message) => {
  if (message.frame.kind === 'response') reply = String(message.frame.result);
} } };
const context = new WeakMap<object, object>();
const privateContext = {};
context.set(returnAddress, privateContext);
const request: Message = { frame: {
  version: 1, kind: 'request', id: 'request-1', params: { nested: [null, 42, 'value'] },
  traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
  tracestate: 'vendor=opaque', meta: { key: 'value' },
}, return: returnAddress };
let deliveredPath: Path = [], framePreserved = false, returnIdentityPreserved = false, associatedContextPreserved = false;
let capturedReturn: ReturnAddress | undefined;
const destinationView = destinationRouter.select(['a']).select(['b']);
const detachDestination = destinationView.receive({ message: (path, message) => {
  deliveredPath = path;
  // Strict identity catches reconstruction that loses private message associations.
  framePreserved = message === request && message.frame === request.frame;
  returnIdentityPreserved = message.return === returnAddress;
  associatedContextPreserved = context.get(message.return!) === privateContext;
  capturedReturn = message.return;
} });
const detachForwarder = forwardServer.receive({ message: (path, message) => destinationClient.send(path, message) });
const composed = at(mount(new Map([['', at(at(forwardClient, ['a']), ['b'])]])), ['']);
composed.send(['run', ''], request); scheduler.drain();
detachForwarder(); detachForwarder();
detachDestination(); destinationView.close();
// The admitted request's captured reply survives both receiving-view teardown
// and forwarder detach. It is not looked up through either registration table.
capturedReturn!.wire.send([], { frame: { version: 1, kind: 'response', id: 'request-1', result: 'answer' } });
let sourceStillUsable = false, targetStillUsable = false;
const stopSource = forwardServer.receive({ message: () => { sourceStillUsable = true; } });
destinationRouter.bind(['probe'], { message: () => { targetStillUsable = true; } });
forwardClient.send(['probe'], event); destinationClient.send(['probe'], event); scheduler.drain(); stopSource();

const [opaqueClient, opaqueServer] = pair(scheduler);
const opaqueRouter = new TestRouter(opaqueServer);
const opaquePaths: string[] = [];
for (const [path, label] of [[[''], 'empty'], [['a/b'], 'slash'], [['a', 'b'], 'split'], [['é'], 'composed'], [['e\u0301'], 'decomposed']] as const) {
  opaqueRouter.bind(path, { message: () => { opaquePaths.push(label); } });
  opaqueClient.send(path, event);
}
scheduler.drain();

const [viewClient, viewRoot] = pair(scheduler);
const viewRouter = new TestRouter(viewRoot);
const aView = viewRouter.select(['scope']).select(['a']);
const bView = viewRouter.select(['scope', 'b']);
const detachedView = viewRouter.select(['detached']);
const notifications = { active: 0, detached: 0, sibling: 0 };
let nestedPath: Path = [], selectedSendPath: Path = [], siblingAfterViewClose = false, routeReusable = false;
const initialDetach = aView.receive({ message: () => { throw new Error('detached receiver ran'); } });
let duplicateReceiveRefused = false;
try { aView.receive({}); } catch { duplicateReceiveRefused = true; }
initialDetach(); initialDetach();
aView.receive({ message: path => { nestedPath = path; }, closed: () => { notifications.active++; } });
initialDetach(); // Does not detach the newly installed receiver.
bView.receive({ message: () => { siblingAfterViewClose = true; }, closed: () => { notifications.sibling++; } });
const detachUnused = detachedView.receive({ closed: () => { notifications.detached++; } });
detachUnused(); detachedView.close(); detachedView.close();
viewClient.receive({ message: path => { selectedSendPath = path; } });
viewClient.send(['scope', 'a', 'in'], event); aView.send(['out'], event); scheduler.drain();
aView.close(); aView.close();
let closedReceiveRefused = false, closedSendRefused = false;
try { aView.receive({}); } catch { closedReceiveRefused = true; }
try { aView.send(['ignored'], event); } catch { closedSendRefused = true; }
const replacementView = viewRouter.select(['scope', 'a']);
const stopReplacement = replacementView.receive({ message: () => { routeReusable = true; } });
viewClient.send(['scope', 'a', 'replacement'], event);
viewClient.send(['scope', 'b', 'sibling'], event); scheduler.drain(); stopReplacement();
viewRoot.close(); viewRoot.close(); scheduler.drain();
let rootReceiveRefused = false, viewAfterRootCloseRefused = false;
try { viewRoot.receive({}); } catch { rootReceiveRefused = true; }
try { bView.receive({}); } catch { viewAfterRootCloseRefused = true; }
bView.close(); // Does not notify a second time after root closure.
if (Object.keys(composed).join(',') !== 'send') throw new Error('Selected access must not grant endpoint ownership');
console.log(JSON.stringify({
  siblings: { deliveries, receiverRanDuringSend, duplicateEndpointAttachmentRefused, attachmentReusableAfterDetach },
  overlap: { deliveries: overlapDeliveries, duplicateRouteRefused },
  composition: { deliveredPath, framePreserved, returnIdentityPreserved, associatedContextPreserved, reply,
    borrowedEndpointUsableAfterDetach: sourceStillUsable && targetStillUsable },
  opaquePaths,
  selectedEndpoints: { nestedPath, selectedSendPath, duplicateReceiveRefused, notifications,
    closedReceiveRefused, closedSendRefused, rootReceiveRefused, viewAfterRootCloseRefused,
    siblingAfterViewClose, routeReusable },
}));

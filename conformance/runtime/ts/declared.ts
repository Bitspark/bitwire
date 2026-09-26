// Declared-composite driver for ADR0006 against bitruntime: a port of
// ../../current/ts/declared.ts, which runs this harness over nightseam v0.6.0.
// Two realizations share one harness: a test-only reference interpreter and
// bitruntime's child-only addressed mount. Both use bitruntime's at, forward,
// local pairs and WebSocket peers. Neither is a bitwire API, and the reference
// is not evidence about a production runtime.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import type { AddressedWire, Endpoint, Message, Path, ReturnAddress } from '@bitspark/bitwire';
import { InvalidPathError, MissingPathError, at, forward, mount } from '@bitspark/bitruntime/core';
import { CODE_NORMAL } from '@bitspark/bitruntime/transports';
import { connected, kind } from './carrier.ts';

/** A node's own value: behavior at its empty relative path. Refusal is a value. */
interface Origin { readonly name: string; readonly instance: number; handle(message: Message): void }
const refuse: Origin = { name: '', instance: 0, handle() { throw new MissingPathError(); } };
type Entry = readonly [string, AddressedWire | undefined];

/** Constructs declared composites; parts are the construction owner's retained description. */
interface Realization {
  compose(own: Origin, entries: readonly Entry[]): AddressedWire;
  parts(composite: AddressedWire): [Origin, Entry[]] | undefined;
  expose(composite: AddressedWire): AddressedWire;
  teardown(): void;
}
class Unsupported extends Error {}

function wellFormed(segment: string): boolean {
  for (let i = 0; i < segment.length; i++) {
    const unit = segment.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = segment.charCodeAt(++i);
      if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

// ---- Reference realization: a test-only interpreter of ADR0006 ----
class Reference implements Realization {
  private readonly retained = new Map<AddressedWire, { own: Origin; children: ReadonlyMap<string, AddressedWire> }>();
  compose(own: Origin, entries: readonly Entry[]): AddressedWire {
    if (!own) throw new Error('A composite requires its own value');
    const children = new Map<string, AddressedWire>();
    for (const [key, child] of entries) {
      if (!wellFormed(key)) throw new Error('Segment outside the exact UTF-8 key image');
      if (!child) throw new Error('Missing child access');
      if (children.has(key)) throw new Error('Conflicting child segment');
      children.set(key, child);
    }
    const send = (path: Path, message: Message): void => {
      if (path.length === 0) return own.handle(message);
      const child = children.get(path[0]!);
      if (!child) throw new MissingPathError();
      child.send(path.slice(1), message);
    };
    const access: AddressedWire = { send(path, message) {
      if (!path.every(wellFormed)) throw new InvalidPathError();
      send(path, message);
    } };
    this.retained.set(access, { own, children });
    return access;
  }
  parts(w: AddressedWire): [Origin, Entry[]] | undefined {
    const found = this.retained.get(w);
    return found && [found.own, [...found.children]];
  }
  expose(w: AddressedWire): AddressedWire { return w; }
  teardown(): void {}
}

// ---- Production realization: bitruntime's child-only addressed mount ----
class Production implements Realization {
  private readonly retained = new Map<AddressedWire, Entry[]>();
  private readonly mounts: Endpoint[] = [];
  compose(own: Origin, entries: readonly Entry[]): AddressedWire {
    if (own !== refuse) throw new Unsupported('origin-bearing composite');
    const routes = new Map<string, Endpoint>();
    for (const [key, child] of entries) {
      const endpoint = child && 'receive' in child && 'close' in child ? child as Endpoint
        : child && { send: (path: Path, message: Message) => child.send(path, message),
          receive(): () => void { throw new Error('Send-only child'); }, close() {} };
      routes.set(key, endpoint as Endpoint);
    }
    const mounted = mount(routes);
    routes.clear(); // A retained description must not depend on the caller's map.
    this.retained.set(mounted, [...entries]);
    this.mounts.push(mounted);
    return mounted;
  }
  parts(w: AddressedWire): [Origin, Entry[]] | undefined {
    const found = this.retained.get(w);
    return found && [refuse, [...found]];
  }
  expose(w: AddressedWire): AddressedWire { return at(w, []); }
  teardown(): void { for (const mounted of this.mounts) mounted.close(CODE_NORMAL, 'released'); }
}

// ---- Instrumented child access and interception used by the fixtures ----
interface Forwarded { path: string[]; count: number }
class Env {
  expected?: Message;
  readonly contexts = new Map<ReturnAddress, object>();
  readonly marker = {};
  unchanged = true;
  last?: Forwarded;
  readonly trace: unknown[] = [];
  private readonly instances = new Map<string, number>();
  readonly sender: AddressedWire;
  constructor(sender: AddressedWire) { this.sender = sender; }
  verify(message: Message): void {
    this.unchanged &&= !!this.expected && isDeepStrictEqual(message.frame, this.expected.frame)
      && message.return === this.expected.return && !!message.return && this.contexts.get(message.return) === this.marker;
  }
  next(name: string): number {
    const value = (this.instances.get(name) ?? 0) + 1;
    this.instances.set(name, value);
    return value;
  }
  newOrigin(name: string): Origin {
    let count = 0;
    return { name, instance: this.next(name), handle: message => {
      this.verify(message);
      this.last = { path: [name], count: ++count };
      at(this.sender, [name]).send([], message);
    } };
  }
  newAccess(name: string): Access { return new Access(name, this.next(name), this); }
}
/** Complete, stateful child access with its own instance counter. */
class Access implements AddressedWire {
  count = 0;
  readonly name: string;
  readonly instance: number;
  private readonly env: Env;
  constructor(name: string, instance: number, env: Env) { this.name = name; this.instance = instance; this.env = env; }
  send(path: Path, message: Message): void {
    this.env.verify(message);
    this.env.last = { path: [this.name, ...path], count: ++this.count };
    at(this.env.sender, [this.name]).send(path, message);
  }
}
interface Policy { id: string; instance: number; limit: number; remaining: number }
/** Interception composed around access; it is not a node value. */
class Guard implements AddressedWire {
  readonly policy: Policy;
  readonly inner: AddressedWire;
  private readonly env: Env;
  constructor(policy: Policy, inner: AddressedWire, env: Env) { this.policy = policy; this.inner = inner; this.env = env; }
  send(path: Path, message: Message): void {
    this.env.trace.push(['check', this.policy.id, [...path]]);
    if (this.policy.remaining === 0) throw new Error('Guard refused');
    if (this.policy.remaining > 0) this.policy.remaining--;
    this.inner.send(path, message);
  }
}

// ---- Fixture interpretation ----
interface Declaration { id: string; origin?: string | null; children?: [string, string][]; access?: string }
interface Step {
  op: string; path?: string[]; keep?: string[][]; selections?: string[][]; via?: string;
  key?: string; to?: string; node?: string; mode?: string; id?: string; origin?: string | null; limit?: number;
}
interface Case { id: string; kind?: string; root: string; fault?: string; steps?: Step[]; relay?: boolean; mount?: boolean }
interface Fixture { declarations: Declaration[]; cases: Case[] }

const utf8 = new TextEncoder();
function byteOrder(a: string, b: string): number {
  const x = utf8.encode(a), y = utf8.encode(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
}
function sameEntries(got: readonly Entry[], want: readonly Entry[]): boolean {
  if (got.length !== want.length) return false;
  const index = new Map(want);
  for (const [key, child] of got) {
    if (!index.has(key) || index.get(key) !== child) return false;
    index.delete(key);
  }
  return index.size === 0;
}

class Harness {
  readonly env: Env;
  private readonly declarations = new Map<string, Declaration>();
  private readonly built = new Map<string, AddressedWire>();
  private readonly origins = new Map<string, Origin>();
  root!: AddressedWire;
  view?: AddressedWire;
  partsExact = true;
  readonly R: Realization;
  constructor(R: Realization, fixture: Fixture, sender: AddressedWire) {
    this.R = R;
    this.env = new Env(sender);
    for (const d of fixture.declarations) {
      if (this.declarations.has(d.id)) throw new Error('Duplicate declaration');
      this.declarations.set(d.id, d);
    }
  }
  /** Records R1 and mutates the caller's input afterward: the composite keeps its own copy. */
  construct(own: Origin, entries: readonly Entry[]): AddressedWire {
    const input: Entry[] = [...entries];
    const w = this.R.compose(own, input);
    input.fill(['mutated', undefined]);
    let found = this.R.parts(w);
    let exact = !!found && found[0] === own && sameEntries(found[1], entries);
    if (exact && found![1].length) {
      found![1][0] = ['mutated', undefined]; // Returned parts are a copy of the retained description.
      found = this.R.parts(w);
      exact = !!found && found[0] === own && sameEntries(found[1], entries);
    }
    this.partsExact &&= exact;
    return w;
  }
  private origin(name: string): Origin {
    let found = this.origins.get(name);
    if (!found) this.origins.set(name, found = this.env.newOrigin(name));
    return found;
  }
  build(id: string, fault = '', rootID = '', visiting = new Set<string>()): AddressedWire {
    const found = this.built.get(id);
    if (found) return found;
    const d = this.declarations.get(id);
    if (!d) throw new Error('Missing declaration');
    if (d.access) {
      const w = this.env.newAccess(d.access);
      this.built.set(id, w);
      return w;
    }
    if (visiting.has(id)) throw new Error('Cyclic declaration');
    visiting.add(id);
    const children = [...(d.children ?? [])];
    if (id === rootID && fault === 'cycle') children.push(['loop', rootID]);
    const entries: Entry[] = children.map(([key, child]) => [key, this.build(child, fault, rootID, visiting)]);
    if (id === rootID && fault === 'duplicate') entries.push(['a', this.build('leaf')]);
    if (id === rootID && fault === 'invalidKey') entries.push(['\ud800', this.build('leaf')]);
    if (id === rootID && fault === 'missingChild') entries.push(['hole', undefined]);
    const w = this.construct(d.origin == null ? refuse : this.origin(d.origin), entries);
    visiting.delete(id);
    this.built.set(id, w);
    return w;
  }
  caller(): AddressedWire { return this.root instanceof Guard ? this.root : this.R.expose(this.root); }
  render(w: AddressedWire): unknown {
    const found = this.R.parts(w);
    if (found) {
      const [own, entries] = found;
      return {
        origin: own === refuse ? null : [own.name, own.instance],
        children: entries.sort(([a], [b]) => byteOrder(a, b)).map(([key, child]) => [key, this.render(child!)]),
      };
    }
    if (w instanceof Access) return { access: [w.name, w.instance] };
    if (w instanceof Guard) return { guard: [w.policy.id, w.policy.instance], inner: this.render(w.inner) };
    return 'opaque';
  }
  structure(w: AddressedWire, path: readonly string[]): unknown {
    if (!path.length) return this.render(w);
    const found = this.R.parts(w);
    if (!found) throw new Error('Structure path leaves the declared composites');
    const child = found[1].find(([key]) => key === path[0]);
    return child ? this.structure(child[1]!, path.slice(1)) : 'missing';
  }
  /** Rebuilds declared ancestors from retained parts; a guard keeps its policy instance. */
  replaceAt(w: AddressedWire, path: readonly string[], f: (w: AddressedWire) => AddressedWire): AddressedWire {
    if (w instanceof Guard && path.length) return new Guard(w.policy, this.replaceAt(w.inner, path, f), this.env);
    if (!path.length) return f(w);
    const found = this.R.parts(w);
    if (!found) throw new Error('Edit path leaves the declared composites');
    return this.construct(found[0], found[1].map(([key, child]) => [key, key === path[0] ? this.replaceAt(child!, path.slice(1), f) : child]));
  }
  /** One complete cut: kept subtrees are reused whole; other declared composites are rebuilt from parts. */
  rebuild(w: AddressedWire, where: readonly string[], keep: readonly (readonly string[])[]): AddressedWire {
    if (keep.some(path => isDeepStrictEqual([...path], [...where]))) return w;
    if (w instanceof Guard) return new Guard(w.policy, this.rebuild(w.inner, where, keep), this.env);
    const found = this.R.parts(w);
    if (!found) return w; // Opaque child access is retained whole.
    return this.construct(found[0], found[1].map(([key, child]) => [key, this.rebuild(child!, [...where, key], keep)]));
  }
  copy(w: AddressedWire): AddressedWire {
    if (w instanceof Access) return this.env.newAccess(w.name);
    const found = this.R.parts(w);
    if (!found) throw new Error('Cannot copy opaque access');
    const own = found[0] === refuse ? refuse : this.env.newOrigin(found[0].name);
    return this.construct(own, found[1].map(([key, child]) => [key, this.copy(child!)]));
  }
}

function mailbox<T>() {
  const values: T[] = [];
  let pending: ((value: T) => void) | undefined;
  return {
    put(value: T) {
      if (pending) { const resolve = pending; pending = undefined; resolve(value); }
      else values.push(value);
    },
    async take(): Promise<T> {
      if (values.length) return values.shift()!;
      if (pending) throw new Error('Concurrent mailbox reads');
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => { pending = undefined; reject(new Error('Delivery deadline exceeded')); }, 5000);
        pending = value => { clearTimeout(timer); resolve(value); };
      });
    },
  };
}
type Deliveries = ReturnType<typeof mailbox<{ path: Path; message: Message }>>;
class Scope {
  cleanups: (() => void)[] = [];
  close(): void { for (const cleanup of this.cleanups.reverse()) cleanup(); }
  pair(): Promise<[Endpoint, Endpoint]> {
    return connected(release => this.cleanups.push(release));
  }
  async carriers(test: Case): Promise<[Endpoint, AddressedWire, Endpoint]> {
    const [source, first] = await this.pair();
    let sender: AddressedWire = source, receiver = first;
    if (test.mount) {
      const mounted = mount(new Map([['mounted', source]]));
      sender = at(mounted, ['mounted']);
      this.cleanups.push(() => mounted.close(CODE_NORMAL, 'done'));
    }
    if (test.relay) {
      const [outgoing, target] = await this.pair();
      this.cleanups.push(forward(receiver, outgoing));
      receiver = target;
    }
    return [source, sender, receiver];
  }
}
const event = (value: string): Message => ({ frame: { version: 1, kind: 'event', data: value } });
const refuseWire: AddressedWire = { send() { throw new MissingPathError(); } };

async function send(h: Harness, w: AddressedWire, path: Path, message: Message, deliveries: Deliveries): Promise<void> {
  h.env.expected = message;
  h.env.last = undefined;
  try { w.send(path, message); } catch {
    if (h.env.last) throw new Error('A destination accepted a refused send');
    h.env.trace.push(['refused']);
    return;
  }
  const got = await deliveries.take();
  if (!isDeepStrictEqual(got.message.frame, message.frame)) throw new Error('Message changed or unexpected delivery');
  const last = h.env.last as Forwarded | undefined;
  if (!last || !isDeepStrictEqual([...got.path], last.path)) throw new Error('Delivery does not match its declared destination');
  h.env.trace.push(['delivered', [...got.path], last.count]);
}
function marked(h: Harness, value: string): Message {
  const message: Message = { ...event(value), return: { wire: refuseWire } };
  h.env.contexts.set(message.return!, h.env.marker);
  return message;
}
async function borrowed(sender: AddressedWire, deliveries: Deliveries): Promise<boolean> {
  try { sender.send(['borrowed'], event('borrowed')); } catch { return false; }
  const got = await deliveries.take();
  return isDeepStrictEqual(got.path, ['borrowed']) && got.message.frame.kind === 'event' && got.message.frame.data === 'borrowed';
}
function refusal(error: unknown): unknown {
  return error instanceof Unsupported ? { unsupported: 'originBearingComposite' } : { construction: 'refused' };
}

async function apply(h: Harness, test: Case, index: number, s: Step, deliveries: Deliveries): Promise<void> {
  const edit = (f: (own: Origin, entries: Entry[]) => AddressedWire) => (w: AddressedWire): AddressedWire => {
    const found = h.R.parts(w);
    if (!found) throw new Error('Edit of opaque access');
    return f(found[0], found[1]);
  };
  const policy = (id: string, limit: number): Policy => ({ id, instance: h.env.next(`policy:${id}`), limit, remaining: limit });
  switch (s.op) {
    case 'send':
    case 'invalidPath': {
      let w = h.caller();
      if (s.via === 'view') {
        if (!h.view) throw new Error('No captured view');
        w = h.view;
      }
      for (const prefix of s.selections ?? []) w = at(w, prefix);
      await send(h, w, s.op === 'invalidPath' ? ['\ud800'] : s.path!, marked(h, `${test.id}:${index}`), deliveries);
      break;
    }
    case 'direct': await send(h, h.build(s.node!), s.path!, marked(h, `${test.id}:${index}`), deliveries); break;
    case 'structure': {
      const root = h.root instanceof Guard && s.path!.length ? h.root.inner : h.root;
      h.env.trace.push(['structure', h.structure(root, s.path!)]);
      break;
    }
    case 'rebuild': h.root = h.rebuild(h.root, [], s.keep!); break;
    case 'origin':
      h.root = h.replaceAt(h.root, s.path!, edit((own, entries) =>
        h.construct(s.origin == null ? refuse : h.env.newOrigin(own.name), entries)));
      break;
    case 'substitute':
      h.root = h.replaceAt(h.root, s.path!, w => s.mode === 'copy' ? h.copy(w) : h.rebuild(w, [], []));
      break;
    case 'omit':
    case 'rename':
    case 'add':
      h.root = h.replaceAt(h.root, s.path!, edit((own, entries) => {
        const next: Entry[] = entries.filter(([key]) => !(key === s.key && s.op === 'omit'))
          .map(([key, child]) => [key === s.key && s.op === 'rename' ? s.to! : key, child]);
        if (s.op === 'add') next.push([s.key!, h.build(s.node!)]);
        return h.construct(own, next);
      }));
      break;
    case 'replace': h.root = h.replaceAt(h.root, s.path!, () => h.build(s.node!)); break;
    case 'view':
      h.view = h.caller();
      for (const prefix of s.selections ?? []) h.view = at(h.view, prefix);
      break;
    case 'guard': h.root = new Guard(policy(s.id!, s.limit!), h.root, h.env); break;
    case 'freshGuard': {
      const g = h.root as Guard;
      h.root = new Guard(policy(g.policy.id, g.policy.limit), g.inner, h.env);
      break;
    }
    case 'guardChild':
      h.root = h.replaceAt(h.root, [...s.path!, s.key!], w => new Guard(policy(s.id!, s.limit!), w, h.env));
      break;
    case 'rebuildFromViews': {
      const g = h.root as Guard;
      const found = h.R.parts(g.inner);
      if (!found) throw new Error('Guarded access is not a composite');
      h.root = new Guard(g.policy, h.construct(found[0], found[1].map(([key]) => [key, at(g, [key])])), h.env);
      break;
    }
    case 'teardown': h.R.teardown(); break;
    default: throw new Error('Unknown step: ' + s.op);
  }
}

async function observe(R: Realization, fixture: Fixture, test: Case): Promise<unknown> {
  const scope = new Scope();
  try {
    const [source, sender, receiver] = await scope.carriers(test);
    const deliveries: Deliveries = mailbox();
    scope.cleanups.push(receiver.receive({ message(path, message) { deliveries.put({ path: [...path], message }); } }));
    const h = new Harness(R, fixture, sender);
    try { h.root = h.build(test.root, test.fault, test.root); } catch (error) { return refusal(error); }
    for (const [index, step] of (test.steps ?? []).entries()) await apply(h, test, index, step, deliveries);
    const caller = h.caller();
    const sendOnly = !('receive' in caller) && !('close' in caller);
    R.teardown();
    return { trace: h.env.trace, partsExact: h.partsExact, unchanged: h.env.unchanged, sendOnly, borrowedUsable: await borrowed(source, deliveries) };
  } finally { scope.close(); }
}

/** Admits a real request, then rebuilds, rebinds and tears down before its late reply and captured cancel. */
async function pending(R: Realization, fixture: Fixture, test: Case): Promise<unknown> {
  const scope = new Scope();
  try {
    const [source, sender, receiver] = await scope.carriers(test);
    const captured = mailbox<Message>(), cancelled = mailbox<string>(), replies = mailbox<string>();
    const deliveries: Deliveries = mailbox();
    scope.cleanups.push(receiver.receive({ message(path, message) {
      if (message.frame.kind === 'event') { deliveries.put({ path: [...path], message }); return; }
      const lifecycle = message.return!.wire;
      lifecycle.send(['invocation.capture', 'old'], {
        frame: { version: 1, kind: 'event', data: null },
        return: { wire: { send(path, message) {
          if (path.length || message.frame.kind !== 'cancel') throw new Error('Invalid captured control');
          cancelled.put('old');
        } } },
      });
      lifecycle.send(['invocation.ready', 'old'], event('ready'));
      lifecycle.send(['invocation.begin', 'old'], event('begin'));
      captured.put(message);
    } }));
    const h = new Harness(R, fixture, sender);
    try { h.root = h.build(test.root, '', test.root); } catch (error) { return refusal(error); }
    const original: ReturnAddress = { wire: { send(path, message) {
      if (path.length || message.frame.kind !== 'response' || message.frame.error || typeof message.frame.result !== 'string') throw new Error('Unexpected reply');
      replies.put(message.frame.result);
    } } };
    const request: Message = { frame: { version: 1, kind: 'request', id: 'c:1', params: null }, return: original };
    h.env.contexts.set(original, h.env.marker);
    h.env.expected = request;
    at(at(h.caller(), ['a']), ['b']).send([], request);
    const old = await captured.take();
    if (old.frame.kind !== 'request') throw new Error('Expected request');
    h.root = h.rebuild(h.root, [], []);
    for (const path of [['a', 'b'], ['alias']]) await apply(h, test, 0, { op: 'replace', path, node: 'replacement' }, deliveries);
    await send(h, at(h.caller(), ['alias']), [], marked(h, 'new'), deliveries);
    R.teardown();
    old.return!.wire.send([], { frame: { version: 1, kind: 'response', id: old.frame.id, result: 'old' } });
    const lateReply = await replies.take();
    old.return!.wire.send(['invocation.control'], { frame: { version: 1, kind: 'cancel', id: old.frame.id } });
    const controls = [await cancelled.take()];
    old.return!.wire.send(['invocation.release', 'old'], event('release'));
    old.return!.wire.send(['invocation.done', 'old'], event('done'));
    return { trace: h.env.trace, lateReply, cancelled: controls, unchanged: h.env.unchanged, borrowedUsable: await borrowed(source, deliveries) };
  } finally { scope.close(); }
}

kind();
const [realization, inputPath] = process.argv.slice(2);
if (!['reference', 'production'].includes(realization ?? '') || !inputPath) throw new Error('Usage: declared.ts reference|production inputs.json');
const fixture = JSON.parse(readFileSync(inputPath, 'utf8')) as Fixture;
const output = [];
for (const test of fixture.cases) {
  const R = realization === 'production' ? new Production() : new Reference();
  output.push({ id: test.id, observations: await (test.kind === 'pending' ? pending(R, fixture, test) : observe(R, fixture, test)) });
}
process.stdout.write(JSON.stringify(output) + '\n');

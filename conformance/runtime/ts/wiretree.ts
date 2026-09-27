// Full-tree driver for ../../wiretree/cases.json, run by scripts/conformance-runtime.mjs.
// Expectations are withheld: this file only interprets inputs and records what
// happened. Two realizations share one harness. "production" is bitruntime's
// compose, select, send and asAddressed; "reference" is a test-only structural
// interpreter that is never evidence about a runtime. Carrier cases always use
// bitruntime's carriers, dispatcher, forward, at and mount. How a Wire is bound
// to a carrier path and a tree served on a dispatcher follows the realization:
// production uses bitruntime's bind and serve (v0.3.0, bitruntime#15); the
// reference keeps small test-only adapters, so the oracle stays satisfiable
// without them.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import type { AddressedWire, Child, DeixisNode, Endpoint, Key, Message, Parts, Path, ReturnAddress, TreePath, Wire, WireTree } from '@bitspark/bitwire';
import { asAddressed, at, bind, compose, forward, mount, select, send } from '@bitspark/bitruntime/core';
import { createDispatcher, serve, type Dispatcher, type Served } from '@bitspark/bitruntime/dispatch';
import { CODE_NORMAL } from '@bitspark/bitruntime/transports';
import { connected, kind } from './carrier.ts';

// ---- Realizations of the structural operations ----
interface Trees {
  compose(own: Wire, children: readonly Child<Wire>[]): WireTree;
  select(tree: WireTree, path: TreePath): WireTree | undefined;
  send(tree: WireTree, path: TreePath, message: Message): void;
  asAddressed(tree: WireTree): AddressedWire;
}
const production: Trees = { compose, select, send, asAddressed };

const hex = (key: Key): string => Buffer.from(key).toString('hex');
const bytes = (text: string): Key => Uint8Array.from(Buffer.from(text, 'hex'));
const utf8 = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

/** Test-only interpreter of the contract: complete, exact, immutable, acyclic. */
class Node implements WireTree {
  readonly #own: Wire;
  readonly #children: readonly Child<Wire>[];
  constructor(own: Wire, children: readonly Child<Wire>[]) {
    const names = new Set<string>();
    const copied: Child<Wire>[] = [];
    for (const [key, child] of children) {
      if (!(key instanceof Uint8Array) || !child || typeof child.children !== 'function') throw new Error('invalid child');
      if (names.has(hex(key))) throw new Error('duplicate key');
      names.add(hex(key));
      copied.push(Object.freeze([Uint8Array.from(key), child] as const));
    }
    const active = new Set<WireTree>();
    const visit = (node: WireTree): void => {
      if (node instanceof Node) return;
      if (active.has(node)) throw new Error('cycle');
      active.add(node);
      for (const [, child] of node.children()) visit(child);
      active.delete(node);
    };
    for (const [, child] of copied) visit(child);
    this.#own = own;
    this.#children = Object.freeze(copied);
  }
  own(): Wire { return this.#own; }
  children(): Child<Wire>[] { return this.#children.map(([key, child]) => [Uint8Array.from(key), child] as const); }
  at(path: TreePath): WireTree | undefined { return reference.select(this, path); }
  decompose(): Parts<Wire> { return { own: this.#own, children: this.children() }; }
}
const reference: Trees = {
  compose: (own, children) => new Node(own, children),
  select(tree, path) {
    let current: WireTree | undefined = tree;
    for (const key of path) current = current?.children().find(([candidate]) => hex(candidate) === hex(key))?.[1];
    return current;
  },
  send(tree, path, message) {
    const node = reference.select(tree, path);
    if (!node) throw new Error('missing');
    node.own().send(message);
  },
  asAddressed(tree) {
    return { send(path: Path, message: Message) {
      if (!path.every(segment => segment.isWellFormed())) throw new Error('invalid path');
      reference.send(tree, path.map(segment => encoder.encode(segment)), message);
    } };
  },
};

// ---- Deliberately unlawful realizations: each must fail the oracle ----
const refusingNode = (): WireTree => new Node({ send() { throw new Error('refused'); } }, []);
const mutants: Record<string, Trees> = {
  /** A missing descendant is sent to its deepest present ancestor. */
  fallback: { ...reference, send(tree, path, message) {
    let node = tree;
    for (const key of path) node = node.children().find(([candidate]) => hex(candidate) === hex(key))?.[1] ?? node;
    node.own().send(message);
  } },
  /** The own capability is replaced by a forwarding wrapper. */
  'wrapping-own': { ...reference, compose: (own, children) => new Node({ send: message => own.send(message) }, children) },
  /** UTF-8 keys are NFC-normalized, conflating distinct byte keys. */
  normalizing: { ...reference, compose: (own, children) => new Node(own, children.map(([key, child]) => {
    let text: string;
    try { text = utf8.decode(key); } catch { return [key, child] as const; }
    return [encoder.encode(text.normalize('NFC')), child] as const;
  })) },
  /** A missing path selects a fabricated refusing node. */
  fabricating: { ...reference, select: (tree, path) => reference.select(tree, path) ?? refusingNode() },
  /** The bridge encodes segments as Latin-1 when it can, so "ÿ" names the byte key ff. */
  'latin1-bridge': { ...reference, asAddressed: tree => ({ send(path: Path, message: Message) {
    reference.send(tree, path.map(segment => [...segment].every(c => c.charCodeAt(0) < 256) ? Uint8Array.from([...segment].map(c => c.charCodeAt(0))) : encoder.encode(segment)), message);
  } }) },
  /** The bridge encodes segments without checking them, so a lone surrogate becomes U+FFFD. */
  'lossy-bridge': { ...reference, asAddressed: tree => ({ send(path: Path, message: Message) {
    reference.send(tree, path.map(segment => encoder.encode(segment)), message);
  } }) },
  /** children() omits the empty key, so the child map is incomplete. */
  'incomplete-children': { ...reference, compose: (own, children) => {
    const node = new Node(own, children);
    return Object.assign(Object.create(node), {
      own: () => node.own(), at: (path: TreePath) => node.at(path), decompose: () => node.decompose(),
      children: () => node.children().filter(([key]) => key.length > 0),
    }) as WireTree;
  } },
};

// ---- Inputs ----
interface Declaration { id: string; own: string | null; children: [string, string][] }
interface Step {
  op: string; path?: string[]; keep?: string[][]; selections?: string[][]; paths?: string[][];
  via?: string; key?: string; to?: string; node?: string; mode?: string; own?: string | null; side?: string;
  utf16?: string[]; utf8?: string;
}
interface Case { id: string; family: string; root: string; fault?: string; foreign?: boolean; relay?: boolean; mount?: boolean; steps: Step[] }
interface Inputs { servedAt: string[]; declarations: Declaration[]; cases: Case[] }
type Trace = unknown[][];

function mailbox<T>() {
  const values: T[] = [];
  let waiting: ((value: T) => void) | undefined;
  return {
    put(value: T) {
      if (waiting) { const resolve = waiting; waiting = undefined; resolve(value); } else values.push(value);
    },
    take(): Promise<T> {
      if (values.length) return Promise.resolve(values.shift()!);
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => { waiting = undefined; reject(new Error('delivery deadline exceeded')); }, 5000);
        waiting = value => { clearTimeout(timer); resolve(value); };
      });
    },
  };
}

// ---- Instrumented primitives and structural editing ----
class Harness {
  readonly trace: Trace = [];
  unchanged = true;
  partsExact = true;
  expected?: Message;
  readonly names = new Map<Wire, [string, number]>();
  readonly refusing = new Set<Wire>();
  readonly counts = new Map<Wire, number>();
  private readonly instances = new Map<string, number>();
  private readonly shared = new Map<string, Wire>();
  private readonly built = new Map<string, WireTree>();
  readonly declarations: Map<string, Declaration>;
  readonly T: Trees;
  readonly handle: (self: Wire, name: string, message: Message) => void;
  constructor(T: Trees, inputs: Inputs, handle: (self: Wire, name: string, message: Message) => void) {
    this.T = T;
    this.handle = handle;
    this.declarations = new Map(inputs.declarations.map(d => [d.id, d]));
  }
  /** One stateful primitive per name and case; fresh instances only when a step asks. */
  primitive(name: string, fresh = false): Wire {
    if (!fresh && this.shared.has(name)) return this.shared.get(name)!;
    const instance = (this.instances.get(name) ?? 0) + 1;
    this.instances.set(name, instance);
    const self: Wire = { send: (message: Message) => this.handle(self, name, message) };
    this.names.set(self, [name, instance]);
    this.counts.set(self, 0);
    if (!fresh) this.shared.set(name, self);
    return self;
  }
  /** A present node's refusal is observed where it happens: the refusing primitive records it. */
  refuser(): Wire {
    const self: Wire = { send: () => { this.trace.push(['refused']); throw new Error('refused'); } };
    this.refusing.add(self);
    return self;
  }
  count(self: Wire): number {
    const next = this.counts.get(self)! + 1;
    this.counts.set(self, next);
    return next;
  }
  /** Constructs, then shows that neither the input nor the returned parts can change the tree. */
  construct(own: Wire, children: readonly Child<Wire>[]): WireTree {
    const want = children.map(([key, child]) => [hex(key), child] as const);
    const input: [Key, WireTree][] = children.map(([key, child]) => [Uint8Array.from(key), child]);
    const tree = this.T.compose(own, input);
    for (const [key] of input) key.fill(0x7a);
    input.length = 0;
    const same = (got: readonly Child<Wire>[]): boolean => got.length === want.length
      && want.every(([key, child]) => got.some(([k, c]) => hex(k) === key && c === child));
    const exact = (): boolean => {
      const parts = tree.decompose();
      return parts.own === own && tree.own() === own && same(parts.children) && same(tree.children());
    };
    let ok = exact();
    for (const returned of [tree.children(), tree.decompose().children] as [Key, WireTree][][]) {
      for (const [key] of returned) key.fill(0x7a);
      try { returned.length = 0; } catch { /* A frozen collection protects the tree too. */ }
    }
    ok &&= exact();
    this.partsExact &&= ok;
    return tree;
  }
  /** An acyclic DeixisNode implemented by the driver rather than the realization. */
  foreign(name: string, children: Child<Wire>[]): WireTree {
    const own = this.primitive(name);
    const node: WireTree = {
      own: () => own,
      children: () => children.map(([key, child]) => [Uint8Array.from(key), child] as const),
      at: path => reference.select(node, path),
      decompose: () => ({ own, children: node.children() }),
    };
    return node;
  }
  build(id: string, fault = '', rootID = '', foreign = false): WireTree {
    const found = this.built.get(id);
    if (found) return found;
    const d = this.declarations.get(id)!;
    const children: Child<Wire>[] = d.children.map(([key, child]) => [bytes(key), this.build(child, fault, rootID)]);
    if (id === rootID && fault === 'duplicate') children.push([encoder.encode('a'), this.build('leaf')]);
    if (id === rootID && fault === 'missingChild') children.push([encoder.encode('hole'), undefined as unknown as WireTree]);
    if (id === rootID && fault === 'cycle') {
      const loop: WireTree = {
        own: () => this.refuser(),
        children: () => [[encoder.encode('again'), loop]],
        at: () => undefined,
        decompose: () => ({ own: this.refuser(), children: [[encoder.encode('again'), loop]] }),
      };
      children.push([encoder.encode('loop'), loop]);
    }
    if (id === rootID && foreign) children.push([encoder.encode('foreign'), this.foreign('foreign', [[encoder.encode('inner'), this.foreign('inner', [])]])]);
    const tree = this.construct(d.own === null ? this.refuser() : this.primitive(d.own), children);
    this.built.set(id, tree);
    return tree;
  }
  render(tree: WireTree): unknown {
    const own = tree.own();
    return {
      own: this.refusing.has(own) ? null : this.names.get(own) ?? 'unknown',
      children: tree.children().map(([key, child]) => [hex(key), this.render(child)]),
    };
  }
  rebuild(tree: WireTree, where: string[], keep: string[][]): WireTree {
    if (keep.some(path => isDeepStrictEqual(path, where))) return tree;
    const parts = tree.decompose();
    return this.construct(parts.own, parts.children.map(([key, child]) => [key, this.rebuild(child, [...where, hex(key)], keep)]));
  }
  replaceAt(tree: WireTree, path: string[], f: (tree: WireTree) => WireTree): WireTree {
    if (!path.length) return f(tree);
    const parts = tree.decompose();
    if (!parts.children.some(([key]) => hex(key) === path[0])) throw new Error('edit path leaves the tree');
    return this.construct(parts.own, parts.children.map(([key, child]) => [key, hex(key) === path[0] ? this.replaceAt(child, path.slice(1), f) : child]));
  }
  copy(tree: WireTree): WireTree {
    const own = tree.own();
    const fresh = this.refusing.has(own) ? this.refuser() : this.primitive(this.names.get(own)![0], true);
    return this.construct(fresh, tree.children().map(([key, child]) => [key, this.copy(child)]));
  }
  edit(tree: WireTree, s: Step, build: (id: string) => WireTree): WireTree {
    switch (s.op) {
      case 'rebuild': return this.rebuild(tree, [], s.keep!);
      case 'replace': return this.replaceAt(tree, s.path!, () => build(s.node!));
      case 'own': return this.replaceAt(tree, s.path!, node => {
        const own = node.own();
        return this.construct(s.own === null ? this.refuser() : this.primitive(this.names.get(own)![0], true), node.children());
      });
      case 'substitute': return this.replaceAt(tree, s.path!, node => s.mode === 'copy' ? this.copy(node) : this.rebuild(node, [], []));
      case 'omit': case 'rename': case 'add': return this.replaceAt(tree, s.path!, node => {
        const next: Child<Wire>[] = node.children()
          .filter(([key]) => !(s.op === 'omit' && hex(key) === s.key))
          .map(([key, child]) => [s.op === 'rename' && hex(key) === s.key ? bytes(s.to!) : key, child]);
        if (s.op === 'add') next.push([bytes(s.key!), build(s.node!)]);
        return this.construct(node.own(), next);
      });
      default: throw new Error('unknown edit ' + s.op);
    }
  }
  verify(message: Message): void {
    this.unchanged &&= !!this.expected && isDeepStrictEqual(message.frame, this.expected.frame) && message.return === this.expected.return;
  }
}

/**
 * Applies a selection chain with each node's own at. From the root, the chain
 * followed by path must select exactly what the concatenation selects, including
 * when a selection in the chain fails.
 */
function chain(h: Harness, start: WireTree, selections: string[][], path: string[], fromRoot: boolean): WireTree | undefined {
  let node: WireTree | undefined = start;
  for (const selection of selections) {
    node = node?.at(selection.map(bytes));
    if (!node) break;
  }
  if (fromRoot && h.T.select(start, [...selections.flat(), ...path].map(bytes)) !== (node && h.T.select(node, path.map(bytes)))) {
    h.trace.push(['selectionDiffers']);
  }
  return node;
}

/**
 * Derived sending. A present node's own primitive records its admission or
 * refusal itself. A missing path invokes no primitive and the send is refused;
 * anything else is recorded as the violation it is.
 */
function derived(h: Harness, base: WireTree | undefined, path: string[], message: Message): void {
  if (!base) { h.trace.push(['missing']); return; }
  const present = h.T.select(base, path.map(bytes)) !== undefined;
  const before = h.trace.length;
  h.expected = message;
  let refused = false;
  try { h.T.send(base, path.map(bytes), message); } catch { refused = true; }
  const invoked = h.trace.length !== before;
  if (present && !invoked) h.trace.push([refused ? 'refusedWithoutOwn' : 'admittedWithoutOwn']);
  if (!present && invoked) h.trace.push(['fallback']);
  if (!present && !invoked) h.trace.push([refused ? 'missing' : 'missingAdmitted']);
}

// Each event carries its own return capability, so identity preservation is per message.
const event = (data: string): Message => ({ frame: { version: 1, kind: 'event', data }, return: { wire: { send() { throw new Error('not a reply target'); } } } });

// ---- Local families: structure and the addressed bridge ----
function local(T: Trees, inputs: Inputs, test: Case): unknown {
  const h: Harness = new Harness(T, inputs, (self, name, message) => {
    h.verify(message);
    h.trace.push(['delivered', name, h.count(self)]);
  });
  let root: WireTree;
  try { root = h.build(test.root, test.fault, test.root, test.foreign); } catch { return { construction: 'refused' }; }
  if (test.fault) return { construction: 'accepted' };
  let view: WireTree | undefined;
  let sendOnly = true;
  for (const [index, s] of test.steps.entries()) {
    const message = event(`${test.id}:${index}`);
    switch (s.op) {
      case 'structure': {
        const node = T.select(root, s.path!.map(bytes));
        h.trace.push(['structure', node ? h.render(node) : 'missing']);
        break;
      }
      case 'send': {
        const start = s.via === 'view' ? view : root;
        derived(h, start && chain(h, start, s.selections ?? [], s.path!, s.via !== 'view'), s.path!, message);
        break;
      }
      case 'same': {
        const [a, b] = s.paths!.map(path => T.select(root, path.map(bytes))?.own());
        h.trace.push(['same', a !== undefined && a === b]);
        break;
      }
      case 'view': view = chain(h, root, s.selections!, [], true); break;
      case 'bridge': case 'bridgeInvalid': {
        const bridge = T.asAddressed(root);
        sendOnly &&= typeof bridge.send === 'function'
          && ['receive', 'close', 'own', 'children', 'at', 'decompose'].every(name => !(name in bridge));
        // The ill-formed segment comes from the fixture: UTF-16 code units here.
        const path = s.op === 'bridgeInvalid' ? [String.fromCharCode(...s.utf16!.map(unit => parseInt(unit, 16)))] : s.path!;
        const before = h.trace.length;
        h.expected = message;
        let refused = false;
        try { bridge.send(path, message); } catch { refused = true; }
        // A refusal the bridge makes without reaching any primitive.
        if (h.trace.length === before) h.trace.push([refused ? 'unreached' : 'admittedWithoutOwn']);
        break;
      }
      default: root = h.edit(root, s, id => h.build(id));
    }
  }
  return test.family === 'bridge'
    ? { trace: h.trace, sendOnly, unchanged: h.unchanged }
    : { trace: h.trace, partsExact: h.partsExact, unchanged: h.unchanged };
}

// ---- Carrier family ----
/** How a realization binds a Wire to a carrier path and serves a tree. */
interface Carriage {
  bind(access: AddressedWire, path: Path): Wire;
  serve(dispatcher: Dispatcher, prefix: Path, tree: WireTree): Pick<Served, 'update' | 'close'>;
}

/** bitruntime's public facilities (v0.3.0). */
const published: Carriage = { bind, serve };

/**
 * Test-only adapters for the reference: exact dispatcher routes for every
 * position whose keys are all UTF-8, each bound to that position's own. A
 * refused event is dropped, as an event nothing handles is. update re-registers
 * every route, which is not atomic; bitruntime's serve is.
 */
const testOnly: Carriage = {
  bind: (access, path) => {
    const fixed = [...path];
    return Object.freeze({ send: (message: Message) => access.send([...fixed], message) });
  },
  serve(dispatcher, prefix, tree) {
    let detach: (() => void)[] = [];
    const install = (served: WireTree) => {
      const visit = (node: WireTree, path: string[]): void => {
        const own = node.own();
        detach.push(dispatcher.register([...prefix, ...path], { message: (_path, message) => {
          try { own.send(message); } catch (error) { if (message.frame.kind === 'request') throw error; }
        } }));
        for (const [key, child] of node.children()) {
          let segment: string;
          try { segment = utf8.decode(key); } catch { continue; }
          visit(child, [...path, segment]);
        }
      };
      visit(served, []);
    };
    const close = () => { for (const release of detach) release(); detach = []; };
    install(tree);
    return { update(next: WireTree) { close(); install(next); }, close };
  },
};

/**
 * Unlawful on purpose: one prefix route resolved against the tree current at
 * delivery, so a captured cancellation reaches whatever node replaced the one
 * that admitted it.
 */
const retargeting: Carriage = {
  bind: testOnly.bind,
  serve(dispatcher, prefix, tree) {
    let current = tree;
    const release = dispatcher.registerPrefix([...prefix], { message: (path: Path, message: Message) =>
      reference.asAddressed(current).send(path.slice(prefix.length), message) });
    return { update(next: WireTree) { current = next; }, close: release };
  },
};

async function carrier(T: Trees, C: Carriage, inputs: Inputs, test: Case): Promise<unknown> {
  const cleanups: (() => void)[] = [];
  try {
    const [near, first] = await connected(release => cleanups.push(release));
    let far = first;
    const carriers: [Endpoint, Endpoint][] = [[near, first]];
    const compositions: (() => void)[] = [];
    if (test.relay) {
      const [outgoing, target] = await connected(release => cleanups.push(release));
      compositions.push(forward(first, outgoing));
      carriers.push([outgoing, target]);
      far = target;
    }
    let access: AddressedWire = near;
    if (test.mount) {
      const mounted = mount(new Map<string, Endpoint>([['mounted', near]]));
      compositions.push(() => mounted.close(CODE_NORMAL, 'done'));
      access = at(mounted, ['mounted']);
    }

    // The far side: an instrumented tree served on a dispatcher that borrows the endpoint.
    let hold = false;
    let held: { message: Message; name: string } | undefined;
    const signals = mailbox<string>();
    const h: Harness = new Harness(T, inputs, (self, name, message) => {
      const frame = message.frame;
      h.unchanged &&= !!h.expected && frame.kind === h.expected.frame.kind
        && (frame.kind !== 'request' || isDeepStrictEqual(frame.params, (h.expected.frame as { params?: unknown }).params))
        && !!message.return;
      if (frame.kind === 'cancel') {
        h.trace.push(['cancelled', name]);
        signals.put('cancelled');
        return;
      }
      const count = h.count(self);
      if (frame.kind === 'event') { h.trace.push(['delivered', name, count]); return; }
      if (frame.kind !== 'request') throw new Error('unexpected frame');
      if (hold) {
        hold = false;
        held = { message, name };
        h.trace.push(['held', name, count]);
        signals.put('held');
        return;
      }
      h.trace.push(['delivered', name, count]);
      message.return!.wire.send([], { frame: { version: 1, kind: 'response', id: frame.id, result: name } });
    });
    let farTree = h.build(test.root);
    let dispatcher: Dispatcher | undefined = createDispatcher(far);
    let served: Pick<Served, 'update' | 'close'> | undefined = C.serve(dispatcher, inputs.servedAt, farTree);

    // The near side: the same declared structure, each own Wire bound to its far
    // carrier path. A carrier path names a far position, and addressed access
    // cannot show that two positions share a node, so every position is bound.
    const mirror = (id: string, path: string[]): WireTree => {
      const d = h.declarations.get(id)!;
      const children: Child<Wire>[] = [];
      for (const [key, child] of d.children) {
        let segment: string;
        try { segment = utf8.decode(bytes(key)); } catch { continue; }
        children.push([bytes(key), mirror(child, [...path, segment])]);
      }
      return T.compose(C.bind(access, [...inputs.servedAt, ...path]), children);
    };
    let nearTree = mirror(test.root, []);
    const segments = (path: string[]) => path.map(key => utf8.decode(bytes(key)));

    let serial = 0;
    const request = (label: string) => {
      const replies = mailbox<Message>();
      const original: ReturnAddress = { wire: { send(path: Path, message: Message) {
        if (path.length || message.frame.kind !== 'response') throw new Error('unexpected reply');
        replies.put(message);
      } } };
      const message: Message = { frame: { version: 1, kind: 'request', id: `c:${++serial}`, params: label }, return: original };
      return { message, replies };
    };
    const outcome = async (replies: ReturnType<typeof request>['replies']) => {
      const reply = (await replies.take()).frame as { error?: { code: string } };
      if (reply.error) h.trace.push(['error', reply.error.code]);
    };
    let pending: ReturnType<typeof request> | undefined;

    for (const [index, s] of test.steps.entries()) {
      const label = `${test.id}:${index}`;
      switch (s.op) {
        case 'send': case 'hold': case 'cancel': {
          const base = chain(h, nearTree, s.selections ?? [], s.path!, true);
          const target = base && T.select(base, s.path!.map(bytes));
          if (!target) { h.trace.push(['missing']); break; }
          if (s.op === 'cancel') {
            const cancel: Message = { frame: { version: 1, kind: 'cancel', id: (pending!.message.frame as { id: string }).id }, return: pending!.message.return };
            h.expected = cancel;
            T.send(base, s.path!.map(bytes), cancel);
            await signals.take();
            break;
          }
          const call = request(label);
          h.expected = call.message;
          if (s.op === 'hold') hold = true;
          try { T.send(base, s.path!.map(bytes), call.message); } catch { hold = false; h.trace.push(['refused']); break; }
          if (s.op === 'hold') { pending = call; await signals.take(); } else await outcome(call.replies);
          break;
        }
        case 'sendAddressed': {
          const call = request(label);
          h.expected = call.message;
          try { access.send(s.path!, call.message); } catch { h.trace.push(['refused']); break; }
          await outcome(call.replies);
          break;
        }
        case 'release': {
          held!.message.return!.wire.send([], { frame: { version: 1, kind: 'response', id: (held!.message.frame as { id: string }).id, result: held!.name } });
          const reply = (await pending!.replies.take()).frame as { result?: unknown };
          h.trace.push(['late', reply.result]);
          break;
        }
        case 'structure': {
          const node = T.select(farTree, s.path!.map(bytes));
          h.trace.push(['structure', node ? h.render(node) : 'missing']);
          break;
        }
        case 'direct': derived(h, farTree, s.path!, event(label)); break;
        case 'teardown': served!.close(); served = undefined; dispatcher!.close(); dispatcher = undefined; break;
        default:
          if (s.side === 'far') {
            farTree = h.edit(farTree, s, id => h.build(id));
            served!.update(farTree);
          } else {
            nearTree = h.edit(nearTree, s, id => mirror(id, segments(s.path!)));
          }
      }
    }

    // Every borrowed endpoint outlives each composition over it: the dispatcher,
    // the relay's forwarding and the addressed mount.
    served?.close();
    dispatcher?.close();
    for (const release of compositions) release();
    let borrowedUsable = true;
    for (const [sender, receiver] of carriers) {
      const borrowed = mailbox<Message>();
      try {
        cleanups.push(receiver.receive({ message(path, message) { if (path.join('/') === 'borrowed') borrowed.put(message); } }));
        sender.send(['borrowed'], event('borrowed'));
        borrowedUsable &&= (await borrowed.take()).frame.kind === 'event';
      } catch { borrowedUsable = false; }
    }
    return { trace: h.trace, unchanged: h.unchanged, borrowedUsable };
  } finally {
    for (const cleanup of cleanups.reverse()) cleanup();
  }
}

const [realization = '', scope, inputPath] = process.argv.slice(2);
const mutant = realization.startsWith('mutant:') ? realization.slice('mutant:'.length) : undefined;
if (!(['reference', 'production'].includes(realization) || (mutant && (mutant in mutants || mutant === 'retargeting-serve')))
  || !['local', 'carrier'].includes(scope ?? '') || !inputPath) {
  throw new Error('Usage: wiretree.ts reference|production|mutant:<name> local|carrier inputs.json');
}
const T = realization === 'production' ? production : mutant && mutant in mutants ? mutants[mutant]! : reference;
const C = realization === 'production' ? published : mutant === 'retargeting-serve' ? retargeting : testOnly;
const inputs = JSON.parse(readFileSync(inputPath, 'utf8')) as Inputs;
if (scope === 'carrier') kind();
const output = [];
for (const test of inputs.cases) {
  if ((scope === 'carrier') !== (test.family === 'carrier')) continue;
  let observations: unknown;
  try {
    observations = scope === 'carrier' ? await carrier(T, C, inputs, test) : local(T, inputs, test);
  } catch (error) {
    if (!mutant) throw error;
    observations = { failed: String(error) }; // A mutant may break the harness; that is a failed case too.
  }
  output.push({ id: test.id, observations });
}
process.stdout.write(JSON.stringify(output) + '\n');

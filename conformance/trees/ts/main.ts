// Test-only structural interpreter. No constructor or sending runtime is shipped.
import type { Child, DeixisNode, Key, Message, Parts, TreePath, Wire, WireTree } from '../../../wire/ts/src/index.ts';
class Node<T> implements DeixisNode<T> {
  #own: T;
  #children: Child<T>[];
  constructor(own: T, children: readonly Child<T>[] = []) {
    this.#own = own;
    this.#children = children.map(([key, child]) => [key.slice(), child]);
    if (new Set(this.#children.map(([k]) => hex(k))).size !== children.length) throw new Error('duplicate key');
  }
  own(): T { return this.#own; }
  children(): Child<T>[] { return this.#children.map(([key, child]) => [key.slice(), child]); }
  at(path: TreePath): DeixisNode<T> | undefined {
    let current: DeixisNode<T> = this;
    for (const key of path) {
      const child = current.children().find(([candidate]) => hex(candidate) === hex(key));
      if (!child) return undefined;
      current = child[1];
    }
    return current;
  }
  decompose(): Parts<T> { return { own: this.#own, children: this.children() }; }
}
const hex = (key: Key): string => [...key].map(b => b.toString(16).padStart(2, '0')).join('');
const key = (...bytes: number[]): Key => new Uint8Array(bytes);
const admissions: string[] = [];
const primitive = (name: string): Wire => ({ send(message: Message) { admissions.push(`${name}:${message.frame.kind}`); } });
const names = new Map<Wire, string>();
const node = (name: string, children: Child<Wire>[] = []): WireTree => {
  const own = primitive(name); names.set(own, name); return new Node(own, children);
};
const refusing = new Node<Wire>({ send() { throw new Error('refused'); } });
const leaf = node('leaf');
const tree = node('root', [[key(), node('empty')], [key(255), node('binary')], [key(97,47,98), refusing], [key(97), node('branch', [[key(98), leaf]])]]);
const label = (path: TreePath) => names.get(tree.at(path)!.own());
const parts = tree.decompose();
const rebuilt = new Node(parts.own, parts.children);
const exposed = tree.children(); exposed[1]![0][0] = 0;
const message: Message = { frame: { version: 1, kind: 'event', data: null } };
tree.at([key(255)])!.own().send(message);
let refusingSend = false;
try { tree.at([key(97,47,98)])!.own().send(message); } catch { refusingSend = true; }
console.log(JSON.stringify({
 self: tree.at([]) === tree, binary: label([key(255)]), emptyKey: label([key()]), missing: tree.at([key(0)]) === undefined,
 nested: label([key(97),key(98)]), nestedLaw: tree.at([key(97)])!.at([key(98)]) === tree.at([key(97),key(98)]),
 children: tree.children().map(([k]) => hex(k)).sort(), slashIsLiteral: tree.at([key(97,47,98)]) !== tree.at([key(97),key(98)]),
 partsIdentity: parts.own === tree.own() && parts.children[1]![1] === tree.at([key(255)]),
 rebuildIdentity: rebuilt.at([key(97),key(98)])!.own() === leaf.own(), keyCopy: label([key(255)]) === 'binary',
 refusingExists: tree.at([key(97,47,98)]) !== undefined, refusingSend, admissions,
}));

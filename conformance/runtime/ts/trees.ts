// Produces the observation object of ../../trees/ts/main.ts through
// bitruntime's production tree operations instead of the test-only
// interpreter: compose constructs every node, select and the node's at select,
// and send is the derived sending. Where a send is refused and its path lies in
// the UTF-8 image, asAddressed must refuse it too; that strengthens an
// observation without adding one. Expectations stay in ../../trees/expected.json
// and are compared only by bitwire's runner. The same operations as ../go/trees.
import type { Child, Key, Message, TreePath, Wire, WireTree } from '@bitspark/bitwire';
import { asAddressed, compose, select, send } from '@bitspark/bitruntime/core';

const hex = (key: Key): string => [...key].map(b => b.toString(16).padStart(2, '0')).join('');
const key = (...bytes: number[]): Key => new Uint8Array(bytes);
const utf8 = (text: string): Key => new TextEncoder().encode(text);
function refused(action: () => void): boolean {
  try { action(); return false; } catch { return true; }
}

const admissions: string[] = [];
const names = new Map<Wire, string>();
const node = (name: string, children: Child<Wire>[] = []): WireTree => {
  const own: Wire = { send(message: Message) { admissions.push(`${name}:${message.frame.kind}`); } };
  names.set(own, name);
  return compose(own, children);
};
const leaf = node('leaf');
const refusing = compose<Wire>({ send() { throw new Error('refused'); } });
const tree = node('root', [
  [key(), node('empty')], [key(255), node('binary')],
  [utf8('a/b'), refusing], [utf8('a'), node('branch', [[utf8('b'), leaf]])],
]);
const at = (path: TreePath): WireTree => {
  const found = select(tree, path);
  if (!found) throw new Error('missing');
  return found;
};
const label = (path: TreePath) => names.get(at(path).own());
const parts = tree.decompose();
const rebuilt = compose(parts.own, parts.children);
const exposed = tree.children();
exposed[1]![0][0] = 0;
const event: Message = { frame: { version: 1, kind: 'event', data: null } };
send(tree, [key(255)], event);
const refusingSend = refused(() => send(tree, [utf8('a/b')], event))
  && refused(() => asAddressed(tree).send(['a/b'], event));
const missing = select(tree, [key(0)]) === undefined
  && refused(() => send(tree, [key(0)], event))
  && refused(() => asAddressed(tree).send(['\x00'], event));
console.log(JSON.stringify({
  self: select(tree, []) === tree && tree.at([]) === tree,
  binary: label([key(255)]),
  emptyKey: label([key()]),
  missing,
  nested: label([utf8('a'), utf8('b')]),
  nestedLaw: at([utf8('a')]).at([utf8('b')]) === at([utf8('a'), utf8('b')]),
  children: tree.children().map(([k]) => hex(k)).sort(),
  slashIsLiteral: at([utf8('a/b')]) !== at([utf8('a'), utf8('b')]),
  partsIdentity: parts.own === tree.own() && parts.children[1]![1] === at([key(255)]),
  rebuildIdentity: select(rebuilt, [utf8('a'), utf8('b')])?.own() === leaf.own(),
  keyCopy: label([key(255)]) === 'binary',
  refusingExists: select(tree, [utf8('a/b')]) !== undefined,
  refusingSend,
  admissions,
}));

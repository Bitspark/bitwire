import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
function scan(path) {
 for (const file of readdirSync(path, { withFileTypes: true })) {
  const p=join(path,file.name);
  if(file.isDirectory()) scan(p);
  else if(/\.(?:ts|go|rs|py|java|swift|hpp|hs)$/.test(p)) {
   const s=readFileSync(p,'utf8');
   assert.doesNotMatch(s, /(?:from|import|require).*['"](?:@bitspark\/(?:bitruntime|nightseam)|github\.com\/Bitspark\/(?:bitruntime|nightseam))/);
   assert.doesNotMatch(s, /\b(?:ProfileFrame|ReturnAddress|ProfileKind)\b/);
  }
 }
}
scan('wire');
const npm=JSON.parse(readFileSync('wire/ts/package.json','utf8'));
assert.deepEqual(Object.keys(npm.dependencies ?? {}).sort(), ['@bitspark/ontos-codec', '@bitspark/ontos-core', '@bitspark/ontos-wire']);
assert.ok(Object.values(npm.dependencies).every(v => v === '0.16.0'));
assert.doesNotMatch(readFileSync('go.mod','utf8'), /^replace\s/m);
console.log('Generic contract is independent of runtime, legacy profiles and private dependencies.');

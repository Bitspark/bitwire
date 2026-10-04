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
   assert.doesNotMatch(s, /\b(?:AddressedWire|ProfileFrame|ReturnAddress|ProfileKind|WireTree)\b/);
  }
 }
}
scan('wire');
const npm=JSON.parse(readFileSync('wire/ts/package.json','utf8'));
assert.deepEqual(npm.dependencies ?? {}, {});
assert.doesNotMatch(readFileSync('go.mod','utf8'), /^replace\s/m);
console.log('Generic contract is independent of runtime, legacy profiles and private dependencies.');

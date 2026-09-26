import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const expected = JSON.parse(readFileSync(new URL('../conformance/trees/expected.json', import.meta.url), 'utf8'));
const run = (cmd,args) => execFileSync(cmd,args,{cwd:root,encoding:'utf8',timeout:120000});
run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--allowImportingTsExtensions','--skipLibCheck','conformance/trees/ts/main.ts']);
for (const [language,cmd,args] of [
 ['Go','go',['run','./conformance/trees/go']],
 ['TypeScript',process.execPath,['--experimental-strip-types','conformance/trees/ts/main.ts']],
]) {
 assert.deepEqual(JSON.parse(run(cmd,args)),expected,`${language}: full tree observations differ from independent oracle`);
 console.log(`PASS ${language}: binary keys, empty/missing paths, complete children, partial selection, decomposition, identity and derived sending`);
}
console.log('Test-only Bitwire 0.3 structural evidence, not production runtime or carrier adoption.');

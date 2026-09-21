import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = JSON.parse(readFileSync(join(root, 'conformance/reference/expected.json'), 'utf8'));
function run(command, args) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'inherit'] });
}
run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--allowImportingTsExtensions', '--skipLibCheck', 'conformance/reference/ts/main.ts']);
for (const [language, command, args] of [
  ['Go', 'go', ['run', './conformance/reference/go']],
  ['TypeScript', process.execPath, ['--experimental-strip-types', 'conformance/reference/ts/main.ts']],
]) {
  const actual = JSON.parse(run(command, args));
  assert.deepEqual(actual, expected, `${language}: composition observations differ from independent oracle`);
  console.log(`PASS ${language}: receive ownership, selected Endpoint attachment/closure, sibling and overlapping selections, forwarding, mounting, delayed captured reply and opaque paths`);
}
console.log('Test-only composition evidence for Bitwire 0.2. Not Nightseam adoption, generated-adapter transparency or full runtime conformance.');

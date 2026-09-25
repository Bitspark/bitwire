import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { nightseamDependencies } from './independence-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(Boolean);
const found = nightseamDependencies(files, path => readFileSync(join(root, path), 'utf8'));
if (found.length) {
  const lines = found.map(({ path, line, text }) => `${path}:${line}: ${text}`).join('\n');
  throw new Error(`Published packages must not depend on Nightseam (decision 0007):\n${lines}`);
}
console.log('Published packages do not depend on Nightseam.');

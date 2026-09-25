import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { forbiddenDependencies } from './independence-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(Boolean);
const found = forbiddenDependencies(files, path => readFileSync(join(root, path), 'utf8'));
if (found.length) {
  const lines = found.map(({ path, line, text }) => `${path}:${line}: ${text}`).join('\n');
  throw new Error(`Published packages must not depend on Nightseam or bitruntime (decisions 0007 and 0010):\n${lines}`);
}
console.log('Published packages depend on neither Nightseam nor bitruntime.');

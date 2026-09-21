import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, posix } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(Boolean));
const destinations = new Set(['', ...files]);
for (const path of files) {
  for (let dir = posix.dirname(path); dir !== '.'; dir = posix.dirname(dir)) destinations.add(dir);
}

const problems = [];
let count = 0;
for (const file of files) {
  if (!file.endsWith('.md')) continue;
  const markdown = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(join(root, file)));
  let fence;
  for (const [lineNumber, raw] of markdown.split('\n').entries()) {
    const marker = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      continue;
    }
    if (marker) { fence = marker[1]; continue; }
    const line = raw.replace(/`[^`]*`/g, '');
    for (const match of line.matchAll(/\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
      const path = target.split('#')[0];
      const destination = path ? posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(path))) : file;
      if (!destinations.has(destination.replace(/\/+$/, ''))) {
        problems.push(`${file}:${lineNumber + 1}: missing local destination ${target}`);
      }
      count++;
    }
  }
}
if (problems.length) throw new Error(problems.join('\n'));
console.log(`Documentation: ${count} local link destinations checked.`);

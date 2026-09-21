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

const read = (path) => new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(join(root, path)));

// Each line outside a fenced block, with its one-based number.
function* prose(markdown) {
  let fence;
  for (const [index, raw] of markdown.split('\n').entries()) {
    const marker = raw.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      continue;
    }
    if (marker) { fence = marker[1]; continue; }
    yield [index + 1, raw];
  }
}

// The heading anchors GitHub derives: inline formatting removed, lowercased,
// punctuation dropped, spaces hyphenated, repeats suffixed in document order.
const anchorCache = new Map();
function anchors(path) {
  const cached = anchorCache.get(path);
  if (cached) return cached;
  const slugs = new Set();
  const used = new Map();
  for (const [, raw] of prose(read(path))) {
    const heading = raw.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!heading) continue;
    const base = heading[1]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    const repeat = used.get(base) ?? 0;
    used.set(base, repeat + 1);
    slugs.add(repeat ? `${base}-${repeat}` : base);
  }
  anchorCache.set(path, slugs);
  return slugs;
}

const problems = [];
let count = 0;
let fragments = 0;
for (const file of files) {
  if (!file.endsWith('.md')) continue;
  for (const [lineNumber, raw] of prose(read(file))) {
    const line = raw.replace(/`[^`]*`/g, '');
    for (const match of line.matchAll(/\]\(([^\s)]+)\)/g)) {
      const target = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) continue;
      const hash = target.indexOf('#');
      const path = hash === -1 ? target : target.slice(0, hash);
      const fragment = hash === -1 ? '' : decodeURIComponent(target.slice(hash + 1));
      const destination = path ? posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(path))) : file;
      count++;
      if (!destinations.has(destination.replace(/\/+$/, ''))) {
        problems.push(`${file}:${lineNumber}: missing local destination ${target}`);
        continue;
      }
      // Only Markdown headings carry anchors this check can derive.
      if (!fragment || !destination.endsWith('.md') || !files.has(destination)) continue;
      fragments++;
      if (!anchors(destination).has(fragment)) {
        problems.push(`${file}:${lineNumber}: missing heading anchor ${target}`);
      }
    }
  }
}
if (problems.length) throw new Error(problems.join('\n'));
console.log(`Documentation: ${count} local link destinations and ${fragments} heading anchors checked.`);

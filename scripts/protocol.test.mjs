import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import test from 'node:test';
import { bundle, normativeDigest, validPath, validateManifest, verifyBundle } from './protocol.mjs';

const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'));
const text = path => readFileSync(join(bundle, path), 'utf8');
const zeros = digit => digit.repeat(64);

test('the digest procedure matches independently computed answers', () => {
  // printf '%s  a\n%s  b/x\n' 111… 000… | sha256sum: entries in byte order of path, whatever the listing order.
  assert.equal(normativeDigest([
    { path: 'b/x', category: 'normative', sha256: zeros('0') },
    { path: 'a', category: 'normative', sha256: zeros('1') },
    { path: 'z', category: 'evidence', sha256: zeros('9') },
  ]), 'b07360cd3fdf1d786557128dca945566cf81eb0a00223162ba7d2fde493747cb');
  // Byte order, not locale order: "A" (0x41) precedes "a" (0x61).
  assert.equal(normativeDigest([
    { path: 'a', category: 'normative', sha256: zeros('3') },
    { path: 'A', category: 'normative', sha256: zeros('2') },
  ]), 'de0af77536fa48b5e4061028890584ab0dd132cb07a9ffe0fe158601ab53c7f4');
});

test('bundle paths are restricted, and only upstream files live under source/', () => {
  for (const path of ['SCOPE.md', 'source/docs/wire/profile.md', 'source/conformance/tables/frames.json']) assert.ok(validPath(path), path);
  for (const path of ['/abs', 'a/../b', './a', 'a//b', 'a\\b', 'é.md', 'a b', '', 'a/']) assert.ok(!validPath(path), path);
  validateManifest(manifest);
  const moved = structuredClone(manifest);
  moved.source.commit = '0'.repeat(40);
  assert.throws(() => validateManifest(moved));
  const noNotice = structuredClone(manifest);
  noNotice.files = noNotice.files.filter(file => file.path !== 'source/NOTICE');
  assert.throws(() => validateManifest(noNotice));
  const misplaced = structuredClone(manifest);
  misplaced.files.find(file => file.path === 'SCOPE.md').origin = 'upstream';
  assert.throws(() => validateManifest(misplaced));
  const unscoped = structuredClone(manifest);
  unscoped.files.find(file => file.path === 'SCOPE.md').category = 'informative';
  assert.throws(() => validateManifest(unscoped));
});

test('the identity covers SCOPE.md and the adopted normative files, and nothing else', () => {
  verifyBundle(manifest);
  const normative = manifest.files.filter(file => file.category === 'normative').map(file => file.path).sort();
  assert.deepEqual(normative, [
    'SCOPE.md',
    'source/conformance/tables/frames.json', 'source/conformance/tables/serials.json', 'source/conformance/tables/unicode.json',
    'source/docs/wire/profile.md', 'source/docs/wire/tunnel.md', 'source/docs/wire/vocabulary.md',
  ]);
  const digest = manifest.normativeDigest;
  const change = (path, files = manifest.files) => files.map(file => (file.path === path ? { ...file, sha256: zeros('0') } : file));
  assert.notEqual(normativeDigest(change('SCOPE.md')), digest, 'a change to the scope is a new identity');
  assert.notEqual(normativeDigest(change('source/docs/wire/tunnel.md')), digest);
  for (const path of ['README.md', 'FINDINGS.md', 'source/NOTICE', 'source/conformance/DRIVER.md']) {
    assert.equal(normativeDigest(change(path)), digest, `${path} is outside the identity`);
  }
  assert.throws(() => verifyBundle(manifest, path => Buffer.concat([readFileSync(join(bundle, path)), Buffer.from(path === 'SCOPE.md' ? ' ' : '')])), /SCOPE\.md/);
});

test('SCOPE.md states the identity the manifest records, and the entry page agrees', () => {
  const scope = text('SCOPE.md');
  assert.match(scope, /\*\*Identifier:\*\* `bitwire\/1`/);
  assert.ok(scope.includes(manifest.source.commit));
  for (const file of manifest.files.filter(entry => entry.category === 'normative')) {
    assert.ok(scope.includes(`| \`${file.path}\` |`), `SCOPE.md lists ${file.path} as normative`);
  }
  assert.ok(text('README.md').includes(`normativeDigest = ${manifest.normativeDigest}`), 'README.md states the current digest');
});

test('every relative link in the adopted documents has a disposition in SCOPE.md', () => {
  const scope = text('SCOPE.md');
  const disposed = scope.slice(scope.indexOf('## Links in the adopted documents'), scope.indexOf('## Evidence and conformance tooling'));
  for (const document of ['docs/wire/profile.md', 'docs/wire/vocabulary.md', 'docs/wire/tunnel.md']) {
    let fenced = false;
    for (const line of text(`source/${document}`).split('\n')) {
      if (/^```/.test(line)) { fenced = !fenced; continue; }
      if (fenced) continue;
      for (const [, target] of line.replace(/`[^`]*`/g, '').matchAll(/\]\(([^\s)]+)\)/g)) {
        if (/^https?:/.test(target)) {
          assert.ok(disposed.includes(target), `${document}: ${target} has no disposition`);
          continue;
        }
        const path = target.split('#')[0];
        const resolved = path ? posix.normalize(posix.join(posix.dirname(document), path)) : document;
        assert.ok(disposed.includes(`\`${resolved}\``) || disposed.includes(`\`${posix.basename(resolved)}\``),
          `${document}: ${target} (${resolved}) has no disposition`);
      }
    }
  }
});

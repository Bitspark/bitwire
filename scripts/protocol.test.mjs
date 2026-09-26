import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normativeDigest, validateManifest } from './protocol.mjs';

const manifest = JSON.parse(readFileSync(new URL('../protocol/bitwire-1/manifest.json', import.meta.url)));

test('the manifest names the released baseline and carries its NOTICE', () => {
  validateManifest(manifest);
  const moved = structuredClone(manifest);
  moved.source.commit = '0'.repeat(40);
  assert.throws(() => validateManifest(moved));
  const noNotice = structuredClone(manifest);
  noNotice.files = noNotice.files.filter(file => file.path !== 'NOTICE');
  assert.throws(() => validateManifest(noNotice));
  const escaping = structuredClone(manifest);
  escaping.files.push({ path: '../outside', role: 'evidence', bytes: 0, sha256: '' });
  assert.throws(() => validateManifest(escaping));
});

test('the normative digest covers exactly the normative files, in path order', () => {
  const digest = normativeDigest(manifest.files);
  assert.equal(digest, manifest.normativeDigest);
  assert.equal(normativeDigest([...manifest.files].reverse()), digest, 'order of listing does not matter');
  const evidence = manifest.files.map(file => (file.role === 'evidence' ? { ...file, sha256: '0'.repeat(64) } : file));
  assert.equal(normativeDigest(evidence), digest, 'evidence does not enter the identity');
  const changed = manifest.files.map(file => (file.path === 'docs/wire/profile.md' ? { ...file, sha256: '0'.repeat(64) } : file));
  assert.notEqual(normativeDigest(changed), digest, 'a normative byte change is a different revision');
});

// The immutable bitwire/1 bundle under protocol/bitwire-1: upstream files
// copied byte for byte from the released Nightseam v0.6.0 under source/, and
// bitwire-authored files beside them. protocol/bitwire-1/SCOPE.md is
// normative and states the identity and the digest procedure this script
// implements.
//
//   node scripts/protocol.mjs verify            offline: bytes, hashes, digest
//   node scripts/protocol.mjs verify --source   also re-fetch the upstream files
//   node scripts/protocol.mjs import            fetch upstream files, rehash all
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const bundle = join(root, 'protocol/bitwire-1');
const manifestPath = join(bundle, 'manifest.json');
const categories = new Set(['normative', 'informative', 'evidence', 'runner', 'notice']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** A bundle path: relative, '/'-separated, ASCII letters, digits, '.', '_' and '-', with no empty, '.' or '..' segment. */
export function validPath(path) {
  return /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(path) && !path.split('/').some(segment => segment === '.' || segment === '..');
}

/**
 * SCOPE.md's procedure: the SHA-256 of `sha256 + "  " + path + "\n"` entries of
 * the normative files, in ascending byte order of path.
 */
export function normativeDigest(files) {
  const entries = files.filter(file => file.category === 'normative')
    .map(file => [Buffer.from(file.path, 'utf8'), `${file.sha256}  ${file.path}\n`])
    .sort(([a], [b]) => Buffer.compare(a, b))
    .map(([, entry]) => entry);
  return sha256(entries.join(''));
}

export function validateManifest(manifest) {
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.revision, 'bitwire/1');
  assert.equal(manifest.source.repository, 'https://github.com/Bitspark/nightseam');
  assert.equal(manifest.source.tag, 'v0.6.0');
  assert.equal(manifest.source.commit, '5cc9723a24646c40ed1861f892b2b23eb6d785d7');
  const paths = new Set();
  for (const file of manifest.files) {
    assert.ok(validPath(file.path), `invalid bundle path ${file.path}`);
    assert.ok(!paths.has(file.path), `${file.path} listed twice`);
    assert.notEqual(file.path, 'manifest.json', 'the manifest is not part of itself');
    assert.ok(categories.has(file.category), `${file.path}: unknown category ${file.category}`);
    assert.ok(['upstream', 'bitwire'].includes(file.origin), `${file.path}: unknown origin ${file.origin}`);
    assert.equal(file.path.startsWith('source/'), file.origin === 'upstream', `${file.path}: upstream files, and only they, live under source/`);
    paths.add(file.path);
  }
  const normative = manifest.files.filter(file => file.category === 'normative').map(file => file.path);
  assert.ok(normative.includes('SCOPE.md'), 'SCOPE.md is normative');
  assert.ok(paths.has('source/NOTICE'), 'the upstream NOTICE travels with its files');
  return paths;
}

function listed(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = lstatSync(path);
    assert.ok(!stat.isSymbolicLink(), `${relative} is a symbolic link`);
    if (stat.isDirectory()) out.push(...listed(path, relative));
    else out.push(relative);
  }
  return out;
}

export function verifyBundle(manifest, read = path => readFileSync(join(bundle, path))) {
  const paths = validateManifest(manifest);
  for (const file of manifest.files) {
    const bytes = read(file.path);
    assert.equal(bytes.length, file.bytes, `${file.path}: size differs from the manifest`);
    assert.equal(sha256(bytes), file.sha256, `${file.path}: bytes differ from the manifest`);
  }
  assert.equal(normativeDigest(manifest.files), manifest.normativeDigest, 'normativeDigest does not match the normative files');
  return paths;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

/** The released source, fetched publicly at the pinned commit; the tag must still name it. */
function fetchSource(manifest) {
  const { repository, tag, commit } = manifest.source;
  const remote = git(['ls-remote', repository, `refs/tags/${tag}^{}`, `refs/tags/${tag}`], root).toString('utf8')
    .trim().split(/\r?\n/).map(line => line.split('\t'));
  const peeled = remote.find(([, ref]) => ref.endsWith('^{}')) ?? remote[0];
  assert.equal(peeled?.[0], commit, `${tag} no longer names ${commit}`);
  const scratch = mkdtempSync(join(tmpdir(), 'bitwire-protocol-'));
  git(['init', '-q'], scratch);
  git(['fetch', '-q', '--depth', '1', repository, commit], scratch);
  const show = path => git(['show', `${commit}:${path}`], scratch);
  const dispose = () => {
    assert.ok(basename(scratch).startsWith('bitwire-protocol-'));
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  };
  return { show, dispose };
}
const upstreamPath = file => file.path.slice('source/'.length);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, ...flags] = process.argv.slice(2);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (operation === 'import') {
    validateManifest(manifest);
    const source = fetchSource(manifest);
    try {
      rmSync(join(bundle, 'source'), { recursive: true, force: true });
      for (const file of manifest.files.filter(file => file.origin === 'upstream')) {
        const target = join(bundle, file.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source.show(upstreamPath(file)));
      }
    } finally { source.dispose(); }
    for (const file of manifest.files) {
      const bytes = readFileSync(join(bundle, file.path));
      file.bytes = bytes.length;
      file.sha256 = sha256(bytes);
    }
    manifest.normativeDigest = normativeDigest(manifest.files);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  } else if (operation !== 'verify') {
    throw new Error('Usage: node scripts/protocol.mjs verify [--source] | import');
  }
  const paths = verifyBundle(manifest);
  const extra = listed(bundle).filter(path => path !== 'manifest.json' && !paths.has(path));
  assert.deepEqual(extra, [], 'files in protocol/bitwire-1 that the manifest does not list');
  if (flags.includes('--source')) {
    const source = fetchSource(manifest);
    try {
      for (const file of manifest.files.filter(file => file.origin === 'upstream')) {
        assert.equal(sha256(source.show(upstreamPath(file))), file.sha256, `${file.path} differs from ${manifest.source.tag}`);
      }
    } finally { source.dispose(); }
  }
  const count = category => manifest.files.filter(file => file.category === category).length;
  console.log(`bitwire/1: ${manifest.files.length} files (${count('normative')} normative), normativeDigest ${manifest.normativeDigest}; upstream files byte-identical to ${manifest.source.tag} (${manifest.source.commit})${flags.includes('--source') ? ', re-fetched from the public source' : ''}`);
}

// The immutable bitwire/1 artifacts: byte-identical copies of the released
// nightseam v0.6.0 files named in protocol/bitwire-1/manifest.json, under
// protocol/bitwire-1/source/ at their original relative paths.
//
//   node scripts/protocol.mjs verify            offline: copies, hashes, digest
//   node scripts/protocol.mjs verify --source   also re-fetch the public source
//   node scripts/protocol.mjs import            fetch and (re)write the copies
//
// Decision 0008: a revision is its identifier plus the SHA-256 of its normative
// artifacts. normativeDigest is the SHA-256 of `sha256  path` lines of the
// normative files in path order, the format sha256sum prints.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = join(root, 'protocol/bitwire-1');
const manifestPath = join(home, 'manifest.json');
const sourceDir = join(home, 'source');
const roles = new Set(['normative', 'informative', 'evidence', 'runner', 'notice']);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function normativeDigest(files) {
  const lines = files.filter(file => file.role === 'normative')
    .map(file => `${file.sha256}  ${file.path}\n`).sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1));
  return sha256(lines.join(''));
}

export function validateManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.revision, 'bitwire/1');
  assert.equal(manifest.source.repository, 'https://github.com/Bitspark/nightseam');
  assert.equal(manifest.source.tag, 'v0.6.0');
  assert.equal(manifest.source.commit, '5cc9723a24646c40ed1861f892b2b23eb6d785d7');
  const paths = new Set();
  for (const file of manifest.files) {
    assert.ok(roles.has(file.role), `${file.path}: unknown role ${file.role}`);
    assert.ok(/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(file.path) && !file.path.split('/').includes('..'), `invalid path ${file.path}`);
    assert.ok(!paths.has(file.path), `${file.path} listed twice`);
    paths.add(file.path);
  }
  assert.ok(manifest.files.some(file => file.role === 'normative'), 'no normative artifact');
  assert.ok(manifest.files.some(file => file.role === 'notice' && file.path === 'NOTICE'), 'the source NOTICE travels with its files');
  return paths;
}

function listed(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listed(path));
    else out.push(relative(sourceDir, path).split('\\').join('/'));
  }
  return out;
}

function verifyCopies(manifest) {
  const paths = validateManifest(manifest);
  for (const file of manifest.files) {
    const bytes = readFileSync(join(sourceDir, file.path));
    assert.equal(bytes.length, file.bytes, `${file.path}: size differs from the manifest`);
    assert.equal(sha256(bytes), file.sha256, `${file.path}: bytes differ from the manifest`);
  }
  const extra = listed(sourceDir).filter(path => !paths.has(path));
  assert.deepEqual(extra, [], 'files under source/ that the manifest does not list');
  assert.equal(normativeDigest(manifest.files), manifest.normativeDigest, 'normativeDigest does not match the normative files');
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

const [operation, ...flags] = process.argv.slice(2);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (operation === 'import') {
    validateManifest(manifest);
    const source = fetchSource(manifest);
    try {
      rmSync(sourceDir, { recursive: true, force: true });
      for (const file of manifest.files) {
        const bytes = source.show(file.path);
        const target = join(sourceDir, file.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, bytes);
        file.bytes = bytes.length;
        file.sha256 = sha256(bytes);
      }
    } finally { source.dispose(); }
    manifest.normativeDigest = normativeDigest(manifest.files);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    verifyCopies(manifest);
    console.log(`Imported ${manifest.files.length} files; normativeDigest ${manifest.normativeDigest}`);
  } else if (operation === 'verify') {
    assert.ok(existsSync(sourceDir), 'run import first');
    verifyCopies(manifest);
    if (flags.includes('--source')) {
      const source = fetchSource(manifest);
      try {
        for (const file of manifest.files) assert.equal(sha256(source.show(file.path)), file.sha256, `${file.path} differs from ${manifest.source.tag}`);
      } finally { source.dispose(); }
    }
    const normative = manifest.files.filter(file => file.role === 'normative').length;
    console.log(`bitwire/1: ${manifest.files.length} files byte-identical to ${manifest.source.tag} (${manifest.source.commit})${flags.includes('--source') ? ', re-fetched from the public source' : ''}; ${normative} normative, normativeDigest ${manifest.normativeDigest}`);
  } else {
    throw new Error('Usage: node scripts/protocol.mjs verify [--source] | import');
  }
}

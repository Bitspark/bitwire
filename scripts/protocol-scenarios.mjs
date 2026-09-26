// bitwire/1 evidence: derives revision-labelled scenarios from the archived
// upstream scenarios in protocol/bitwire-1, by the versioned rules in
// conformance/protocol/selection.json. A derivative keeps the upstream steps
// unchanged and adds the protocol identity, its scope, an optional marker
// and its archived source.
//
//   node scripts/protocol-scenarios.mjs verify      derivatives match their sources
//   node scripts/protocol-scenarios.mjs generate    (re)write the derivatives
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const home = join(root, 'conformance/protocol');
const archive = 'protocol/bitwire-1/source/conformance/scenarios';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => readFileSync(join(root, path));

const upstreamMembers = ['name', 'layer', 'replaces', 'description', 'needs', 'mirror', 'foreach', 'steps'];

/** One derivative: identity, scope and source first, then the upstream members as they were. */
export function derive(upstream, sourcePath, sourceSha, digest, selection) {
  assert.deepEqual(Object.keys(upstream).filter(key => !upstreamMembers.includes(key)), [], `${sourcePath}: unknown member`);
  const scope = selection.scopeByLayer[upstream.layer];
  assert.ok(scope, `${sourcePath}: no scope for layer ${upstream.layer}`);
  const optional = (upstream.needs ?? []).map(need => selection.optionalWhenNeeds[need]).find(Boolean);
  const out = {
    name: upstream.name,
    layer: upstream.layer,
    protocol: { revision: 'bitwire/1', normativeDigest: digest },
    scope,
    ...(optional ? { optional } : {}),
    source: { path: sourcePath, sha256: sourceSha },
  };
  for (const key of upstreamMembers.slice(2)) if (upstream[key] !== undefined) out[key] = upstream[key];
  return out;
}

/**
 * The digest procedure of protocol/bitwire-1/SCOPE.md over files under
 * conformance/protocol/, with paths relative to it: contractDigest over the
 * contract files, evidenceDigest over every file under scenarios/.
 */
export function digests() {
  const digest = paths => sha256(paths.map(path => [Buffer.from(path, 'utf8'), `${sha256(read(`conformance/protocol/${path}`))}  ${path}
`])
    .sort(([a], [b]) => Buffer.compare(a, b)).map(([, entry]) => entry).join(''));
  const evidence = listed(join(home, 'scenarios'), 'scenarios');
  return {
    contractDigest: digest(['CONTRACT.md', 'scenario.schema.json', 'selection.json']),
    evidenceDigest: digest(evidence),
  };
}

/** The archived in-scope scenarios and their derivatives, by derivative path. */
export function expected() {
  const manifest = JSON.parse(read('protocol/bitwire-1/manifest.json'));
  const selection = JSON.parse(read('conformance/protocol/selection.json'));
  assert.equal(selection.edition, 1);
  const files = new Map(manifest.files.map(file => [`protocol/bitwire-1/${file.path}`, file]));
  const excluded = new Set(selection.excluded.map(entry => entry.path));
  for (const path of excluded) assert.ok(files.has(path), `excluded ${path} is not archived`);
  const out = new Map();
  for (const [path, file] of files) {
    if (!path.startsWith(`${archive}/`) || !path.endsWith('.json') || excluded.has(path)) continue;
    const bytes = read(path);
    assert.equal(sha256(bytes), file.sha256, `${path} differs from the manifest`);
    const upstream = JSON.parse(bytes.toString('utf8'));
    out.set(`conformance/protocol/scenarios/${path.slice(archive.length + 1)}`, derive(upstream, path, file.sha256, manifest.normativeDigest, selection));
  }
  return out;
}

function listed(dir, prefix) {
  let out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`;
    out = entry.isDirectory() ? [...out, ...listed(join(dir, entry.name), path)] : [...out, path];
  }
  return out;
}

export function verify() {
  const want = expected();
  const have = listed(join(home, 'scenarios'), 'conformance/protocol/scenarios').sort();
  assert.deepEqual(have, [...want.keys()].sort(), 'derivatives and in-scope archived scenarios differ');
  for (const [path, derivative] of want) {
    assert.ok(isDeepStrictEqual(JSON.parse(read(path).toString('utf8')), derivative), `${path} does not match its archived source`);
  }
  return want;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation] = process.argv.slice(2);
  if (operation === 'generate') {
    rmSync(join(home, 'scenarios'), { recursive: true, force: true });
    for (const [path, derivative] of expected()) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(derivative, null, 2) + '\n');
    }
  } else if (operation !== 'verify') {
    throw new Error('Usage: node scripts/protocol-scenarios.mjs verify | generate');
  }
  const scenarios = [...verify().values()];
  const count = predicate => scenarios.filter(predicate).length;
  const { contractDigest, evidenceDigest } = digests();
  console.log(`bitwire/1 evidence: ${scenarios.length} scenarios (${count(s => s.scope === 'core' && !s.optional)} core, ${count(s => s.scope === 'tunnel' && !s.optional)} tunnel, ${count(s => s.optional)} optional diagnostics), each labelled with its protocol identity and archived source`);
  console.log(`contract edition 1: contractDigest ${contractDigest}; evidenceDigest ${evidenceDigest}`);
}

// bitwire/1 evidence: derives revision-labelled scenarios from the archived
// upstream scenarios in protocol/bitwire-1, by the versioned rules in
// conformance/protocol/selection.json, and checks every scenario, derived or
// authored, against the load rules of CONTRACT.md §5.5. A derivative keeps the
// upstream steps unchanged and adds the protocol identity, its scope, an
// optional marker and its archived source.
//
//   node scripts/protocol-scenarios.mjs verify      scenarios, derivatives, digests
//   node scripts/protocol-scenarios.mjs generate    (re)write the derivatives only
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
const excludedOps = [/^peer\.identity$/, /^peer\.check_identity$/, /^peer\.recorded_wire_witness$/, /^live\./, /^gen\./, /^client\./, /^server\./];
const familiesByLayer = { seam: ['conn', 'pair'], peer: ['conn', 'pair', 'peer', 'call'], tunnel: ['conn', 'pair', 'peer', 'call', 'tunnel'] };

/** One derivative: identity, scope and source first, then the upstream members as they were. */
export function derive(upstream, sourcePath, sourceSha, digest, selection) {
  assert.deepEqual(Object.keys(upstream).filter(key => !upstreamMembers.includes(key)), [], `${sourcePath}: unknown member`);
  const scope = selection.scopeByLayer[upstream.layer];
  assert.ok(scope, `${sourcePath}: no scope for layer ${upstream.layer}`);
  const defect = (selection.defective ?? []).some(entry => entry.path === sourcePath);
  const optional = defect ? 'defect' : (upstream.needs ?? []).map(need => selection.optionalWhenNeeds[need]).find(Boolean);
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

const observes = value => value && typeof value === 'object'
  && (Array.isArray(value) ? value.some(observes) : Object.entries(value).some(([key, member]) => (key === 'observe' && member === true) || observes(member)));

/** The load rules of CONTRACT.md §5.5 that this repository can hold without a runner. */
export function loadCheck(path, scenario, digest, selection) {
  const schema = JSON.parse(read('conformance/protocol/scenario.schema.json'));
  for (const key of schema.required) assert.ok(key in scenario, `${path}: missing ${key}`);
  for (const key of Object.keys(scenario)) assert.ok(key in schema.properties, `${path}: ${key} is not in the schema`);
  assert.deepEqual(scenario.protocol, { revision: 'bitwire/1', normativeDigest: digest }, `${path}: names another protocol identity`);
  assert.ok(schema.properties.layer.enum.includes(scenario.layer), `${path}: layer`);
  assert.ok(path.startsWith(`conformance/protocol/scenarios/${scenario.layer}/`), `${path}: lies outside its layer's directory`);
  assert.equal(scenario.scope, selection.scopeByLayer[scenario.layer], `${path}: scope does not match the layer`);
  if ((scenario.needs ?? []).includes('observer')) assert.ok(scenario.optional, `${path}: needs the observer but is not optional`);
  if (scenario.optional) assert.ok(schema.properties.optional.enum.includes(scenario.optional), `${path}: optional`);
  if (scenario.foreach) assert.ok(schema.properties.foreach.properties.table.enum.includes(scenario.foreach.table), `${path}: foreach table`);
  for (const need of scenario.needs ?? []) assert.ok(schema.properties.needs.items.enum.includes(need), `${path}: need ${need}`);
  assert.ok(Array.isArray(scenario.steps) && scenario.steps.length > 0, `${path}: no steps`);
  for (const [index, step] of scenario.steps.entries()) {
    assert.ok(['a', 'b', 'runner'].includes(step.on), `${path}: step ${index} on`);
    assert.match(step.op, /^[a-z]+\.[a-z_]+$/, `${path}: step ${index} op`);
    assert.ok(!excludedOps.some(pattern => pattern.test(step.op)), `${path}: step ${index} uses excluded ${step.op}`);
    assert.ok(familiesByLayer[scenario.layer].includes(step.op.split('.')[0]), `${path}: step ${index} ${step.op} does not belong to layer ${scenario.layer}`);
    if (!scenario.optional) {
      assert.notEqual(step.op, 'peer.observed', `${path}: step ${index} observes in a required scenario`);
      assert.ok(!observes(step.args), `${path}: step ${index} asks for the observer in a required scenario`);
    }
  }
}

/**
 * The digest procedure of protocol/bitwire-1/SCOPE.md over files under
 * conformance/protocol/, with paths relative to it: contractDigest over the
 * contract files, evidenceDigest over every file under scenarios/.
 */
export function digests() {
  const digest = paths => sha256(paths.map(path => [Buffer.from(path, 'utf8'), `${sha256(read(`conformance/protocol/${path}`))}  ${path}\n`])
    .sort(([a], [b]) => Buffer.compare(a, b)).map(([, entry]) => entry).join(''));
  return {
    contractDigest: digest(['CONTRACT.md', 'scenario.schema.json', 'selection.json']),
    evidenceDigest: digest(listed(join(home, 'scenarios'), 'scenarios')),
  };
}

function context() {
  const manifest = JSON.parse(read('protocol/bitwire-1/manifest.json'));
  const selection = JSON.parse(read('conformance/protocol/selection.json'));
  assert.equal(selection.edition, 1);
  return { manifest, selection };
}

/** The archived in-scope scenarios and their derivatives, by derivative path. */
export function expected() {
  const { manifest, selection } = context();
  const files = new Map(manifest.files.map(file => [`protocol/bitwire-1/${file.path}`, file]));
  const excluded = new Set(selection.excluded.map(entry => entry.path));
  for (const path of [...excluded, ...(selection.defective ?? []).map(entry => entry.path)]) assert.ok(files.has(path), `${path} is not archived`);
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

/** Every scenario on disk: derivatives match their sources; authored ones pass the load rules too. */
export function verify() {
  const { manifest, selection } = context();
  const want = expected();
  const all = new Map(listed(join(home, 'scenarios'), 'conformance/protocol/scenarios')
    .map(path => [path, JSON.parse(read(path).toString('utf8'))]));
  const derived = [...all].filter(([, scenario]) => scenario.source);
  assert.deepEqual(derived.map(([path]) => path).sort(), [...want.keys()].sort(), 'derivatives and in-scope archived scenarios differ');
  for (const [path, scenario] of derived) assert.ok(isDeepStrictEqual(scenario, want.get(path)), `${path} does not match its archived source`);
  for (const [path, scenario] of all) loadCheck(path, scenario, manifest.normativeDigest, selection);
  const names = [...all.values()].map(scenario => `${scenario.layer}/${scenario.name}`);
  assert.equal(new Set(names).size, names.length, 'two scenarios share a layer and name');
  return all;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation] = process.argv.slice(2);
  if (operation === 'generate') {
    for (const path of listed(join(home, 'scenarios'), 'conformance/protocol/scenarios')) {
      if (JSON.parse(read(path).toString('utf8')).source) rmSync(join(root, path));
    }
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
  console.log(`bitwire/1 evidence: ${scenarios.length} scenarios (${count(s => s.scope === 'core' && !s.optional)} core, ${count(s => s.scope === 'tunnel' && !s.optional)} tunnel, ${count(s => s.optional === 'observer')} observer diagnostics, ${count(s => s.optional === 'defect')} known defects)`);
  const released = JSON.parse(readFileSync(join(root, 'conformance/protocol/editions.json'), 'utf8')).editions
    .find(entry => entry.edition === 1 && entry.contractDigest === contractDigest);
  console.log(`contract edition 1: contractDigest ${contractDigest} (${released ? `released ${released.released}` : 'not a released edition'}); evidenceDigest ${evidenceDigest}`);
}

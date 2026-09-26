// Runs Bitwire's existing independent cases against bitruntime's Go
// implementation. Expectations come only from Bitwire's case files; drivers
// receive inputs without them. bitruntime is consumed as a pinned public module
// with no replacement, never as a local checkout.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCases, compareProduction, declaredInputs, lifecycleInputs, nightseamCompositionExpected } from './conformance-results.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const module = join(root, 'conformance/runtime/go');
const bytes = path => readFileSync(join(root, path));
const read = path => JSON.parse(bytes(path));
const pin = read('conformance/runtime/bitruntime.json');
assert.equal(pin.repository, 'https://github.com/Bitspark/bitruntime');
assert.equal(pin.module, 'github.com/Bitspark/bitruntime');
assert.match(pin.revision, /^[a-f0-9]{40}$/);
assert.ok(pin.version.endsWith(`-${pin.revision.slice(0, 12)}`) || /^v\d+\.\d+\.\d+$/.test(pin.version), 'version names the pinned revision');
const args = process.argv.slice(2);
if (args.some(arg => !['--keep-scratch'].includes(arg))) {
  throw new Error('Usage: node scripts/conformance-runtime.mjs [--keep-scratch]');
}

// The oracle files, exactly as this checkout holds them.
const files = {
  lifecycle: 'conformance/current/lifecycle.json',
  declared: 'conformance/declared/cases.json',
  composition: 'conformance/reference/expected.json',
  trees: 'conformance/trees/expected.json',
  gaps: 'conformance/runtime/production-gaps.json',
};
const sha256 = path => createHash('sha256').update(bytes(path)).digest('hex');
const lifecycle = read(files.lifecycle);
const declared = read(files.declared);
// bitwire/1 admits only role-prefixed decimal request IDs, as Nightseam v0.6.0's
// profile does; the two echoed placeholders are instantiated as c:1 there too.
const composition = nightseamCompositionExpected(read(files.composition));
const trees = read(files.trees);
const gaps = read(files.gaps);
const carriers = [['local', '0'], ['peer', '0'], ['peer', '1']];
const scratch = mkdtempSync(join(tmpdir(), 'bitwire-runtime-'));

function run(command, arguments_, env = {}, cwd = module) {
  try {
    return execFileSync(command, arguments_, {
      cwd, encoding: 'utf8', timeout: 600_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOWORK: 'off', GOFLAGS: '-mod=readonly', ...env },
    });
  } catch (error) {
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}

// Exactly the pinned public modules, with no replacement anywhere in the graph.
function verifyModules() {
  const graph = run('go', ['list', '-m', '-f', '{{.Path}}\t{{.Version}}\t{{with .Replace}}{{.Path}} {{.Version}}{{end}}', 'all'])
    .trim().split(/\r?\n/).map(line => line.split('\t'));
  assert.deepEqual(graph[0].slice(0, 1), ['bitwire.conformance/runtime']);
  for (const [path, , replacement] of graph) assert.equal(replacement ?? '', '', `${path} must not be replaced`);
  const version = path => graph.find(([name]) => name === path)?.[1];
  assert.equal(version(pin.module), pin.version, 'bitruntime is not the pinned candidate');
  assert.equal(version('github.com/Bitspark/bitwire'), pin.bitwireVersion, 'Bitwire is not the pinned contract');
  for (const [path, version_, revision, sum] of [
    [pin.module, pin.version, pin.revision, pin.sum],
    ['github.com/Bitspark/bitwire', pin.bitwireVersion, pin.bitwireRevision, pin.bitwireSum],
  ]) {
    const artifact = JSON.parse(run('go', ['mod', 'download', '-json', `${path}@${version_}`]));
    assert.equal(artifact.Origin?.Hash, revision, `${path}@${version_} is not ${revision}`);
    assert.equal(artifact.Sum, sum, `${path}@${version_} changed`);
  }
  run('go', ['mod', 'verify']);
}

function build(name) {
  const program = join(scratch, process.platform === 'win32' ? `${name}.exe` : name);
  run('go', ['build', ...(race ? ['-race'] : []), '-o', program, `./${name}`]);
  return program;
}
const carrierEnv = (carrier, reverse) => ({ BITRUNTIME_CARRIER: carrier, BITRUNTIME_REVERSE: reverse });

const race = run('go', ['env', 'CGO_ENABLED']).trim() === '1';
if (!race && process.env.CI) throw new Error('CI must run the bitruntime drivers under the race detector');
const results = [];
function pass(label, detail) {
  results.push(`${label}: ${detail}`);
  console.log(`PASS ${label}: ${detail}`);
}

const checkout = run('git', ['rev-parse', 'HEAD'], {}, root).trim();
const modified = run('git', ['status', '--porcelain', '--', ...Object.values(files)], {}, root).trim() !== '';
console.log(`bitruntime ${pin.version} (${pin.revision}) against Bitwire ${pin.bitwireVersion}; scratch ${scratch}`);
try {
  verifyModules();
  const programs = Object.fromEntries(['lifecycle', 'composition', 'declared', 'trees'].map(name => [name, build(name)]));

  const lifecycleInput = join(scratch, 'lifecycle-inputs.json');
  writeFileSync(lifecycleInput, JSON.stringify(lifecycleInputs(lifecycle)));
  compareCases(lifecycle, JSON.parse(run(programs.lifecycle, [lifecycleInput])), 'go/lifecycle');
  pass('go/lifecycle', `${lifecycle.cases.length}/${lifecycle.cases.length} independent cases through core.Invocation`);

  for (const [carrier, reverse] of carriers) {
    const label = `go/composition/${carrier}/${reverse}`;
    assert.deepEqual(JSON.parse(run(programs.composition, [], carrierEnv(carrier, reverse))), composition, `${label}: composition differs from Bitwire's oracle`);
    pass(label, `${Object.keys(composition).length}/${Object.keys(composition).length} composition groups through NewPair/peers, dispatch, At, Mount and Forward`);
  }

  // The reference interpreter must meet every expectation. Production runs
  // bitruntime's addressed Mount and may differ only by a gap in its own ledger.
  const declaredInput = join(scratch, 'declared-inputs.json');
  writeFileSync(declaredInput, JSON.stringify(declaredInputs(declared)));
  const total = declared.cases.length;
  for (const realization of ['reference', 'production']) {
    for (const [carrier, reverse] of carriers) {
      const label = `go/declared/${realization}/${carrier}/${reverse}`;
      const actual = JSON.parse(run(programs.declared, [realization, declaredInput], carrierEnv(carrier, reverse)));
      if (realization === 'reference') {
        compareCases(declared, actual, label);
        pass(label, `${total}/${total} cases (test-only reference interpreter over bitruntime carriers)`);
      } else {
        const result = compareProduction(declared, actual, gaps, 'go', label);
        pass(label, `${result.conforming.length}/${total} conform through core.Mount/At/Forward; ${result.gaps.length} match bitruntime's recorded gaps`);
      }
    }
  }

  assert.deepEqual(JSON.parse(run(programs.trees, [])), trees, 'go/trees: full tree observations differ from Bitwire\'s oracle');
  pass('go/trees', `${Object.keys(trees).length}/${Object.keys(trees).length} observations through core.Compose/Select/Send/AsAddressed`);

  console.log('\nReport');
  console.log(`  Bitwire contract: ${pin.bitwireVersion} (github.com/Bitspark/bitwire at ${pin.bitwireRevision})`);
  console.log(`  Bitwire cases:    checkout ${checkout}${modified ? ' with local changes to the case files' : ''}`);
  for (const [name, path] of Object.entries(files)) console.log(`    ${sha256(path)}  ${path}${name === 'gaps' ? ' (bitruntime gap ledger)' : ''}`);
  console.log(`  Implementation:   ${pin.module} ${pin.version} (${pin.revision}), ${pin.profile}, Go only`);
  console.log(`  Toolchain:        ${run('go', ['env', 'GOVERSION']).trim()}${race ? ' with race detector' : ' (race detector unavailable locally)'}`);
  console.log('  Carriers:         local = core.NewPair; peer/0 = WebSocket client sends; peer/1 = WebSocket server sends (engine/websocket)');
  for (const line of results) console.log(`    ${line}`);
  console.log('Historical 0.2 addressed evidence (lifecycle, declared, composition) and 0.3 structural evidence (trees). TypeScript follows bitruntime\'s TS package.');
} finally {
  if (args.includes('--keep-scratch')) console.log(`Retained scratch: ${scratch}`);
  else {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(basename(scratch).startsWith('bitwire-runtime-'));
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  }
}

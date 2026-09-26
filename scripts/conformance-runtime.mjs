// Runs bitwire's existing independent cases against bitruntime's Go and
// TypeScript implementations. Expectations come only from bitwire's case files;
// drivers receive inputs without them. bitruntime is consumed as a pinned public
// Go module with no replacement and as a pinned public release tarball, never as
// a local checkout.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCases, compareProduction, declaredInputs, lifecycleInputs, nightseamCompositionExpected } from './conformance-results.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const module = join(root, 'conformance/runtime/go');
const tsModule = join(root, 'conformance/runtime/ts');
const bytes = path => readFileSync(join(root, path));
const read = path => JSON.parse(bytes(path));
const pin = read('conformance/runtime/bitruntime.json');
assert.equal(pin.repository, 'https://github.com/Bitspark/bitruntime');
assert.equal(pin.module, 'github.com/Bitspark/bitruntime');
assert.match(pin.revision, /^[a-f0-9]{40}$/);
assert.ok(pin.version.endsWith(`-${pin.revision.slice(0, 12)}`) || /^v\d+\.\d+\.\d+$/.test(pin.version), 'version names the pinned revision');
assert.equal(pin.npm.package, '@bitspark/bitruntime');
assert.match(pin.npm.version, /^\d+\.\d+\.\d+$/);
assert.equal(pin.npm.tag, `v${pin.npm.version}`);
assert.match(pin.npm.revision, /^[a-f0-9]{40}$/);
assert.equal(pin.npm.tarball, `${pin.repository}/releases/download/${pin.npm.tag}/bitspark-bitruntime-${pin.npm.version}.tgz`, 'bitruntime is the public release asset');
assert.match(pin.npm.sha256, /^[a-f0-9]{64}$/);
assert.match(pin.npm.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
assert.equal(`v${pin.npm.bitwireVersion}`, pin.bitwireVersion, 'Go and TypeScript run against the same contract');
const args = process.argv.slice(2);
if (args.some(arg => !['--language=go', '--language=ts', '--keep-scratch'].includes(arg))) {
  throw new Error('Usage: node scripts/conformance-runtime.mjs [--language=go|ts] [--keep-scratch]');
}
const choice = args.find(arg => arg.startsWith('--language='))?.split('=')[1];
const languages = choice ? [choice] : ['go', 'ts'];
if (languages.includes('ts') && !process.features.typescript) throw new Error('Node 24 or later with type stripping is required');

// The oracle files, exactly as this checkout holds them.
const files = {
  lifecycle: 'conformance/current/lifecycle.json',
  declared: 'conformance/declared/cases.json',
  composition: 'conformance/reference/expected.json',
  trees: 'conformance/trees/expected.json',
  gaps: 'conformance/runtime/production-gaps.json',
};
const digest = (algorithm, data, encoding = 'hex') => createHash(algorithm).update(data).digest(encoding);
const sha256 = path => digest('sha256', bytes(path));
const lifecycle = read(files.lifecycle);
const declared = read(files.declared);
// bitwire/1 admits only role-prefixed decimal request IDs, as nightseam v0.6.0's
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
  assert.equal(version(pin.module), pin.version, 'bitruntime is not the pinned version');
  assert.equal(version('github.com/Bitspark/bitwire'), pin.bitwireVersion, 'bitwire is not the pinned contract');
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

// npm ships beside node; running its CLI through node needs no shell on Windows.
function npm(arguments_, cwd) {
  const cli = [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(existsSync);
  if (cli) return run(process.execPath, [cli, ...arguments_], {}, cwd);
  if (process.platform === 'win32') throw new Error('Cannot find npm beside node.');
  return run('npm', arguments_, {}, cwd);
}

// The TypeScript module is installed in scratch from its own manifest,
// lockfile and registry configuration; the checkout gains no node_modules.
async function installTypeScript() {
  const target = join(scratch, 'ts');
  mkdirSync(target);
  for (const name of readdirSync(tsModule)) {
    if (['package.json', 'package-lock.json', '.npmrc', 'tsconfig.json'].includes(name) || name.endsWith('.ts')) {
      cpSync(join(tsModule, name), join(target, name));
    }
  }
  // The release asset itself, as go mod download checks a module's origin and sum.
  const response = await fetch(pin.npm.tarball, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  assert.equal(response.status, 200, `cannot fetch ${pin.npm.tarball}`);
  const tarball = Buffer.from(await response.arrayBuffer());
  assert.equal(digest('sha256', tarball), pin.npm.sha256, `${pin.npm.tarball} changed`);
  assert.equal(`sha512-${digest('sha512', tarball, 'base64')}`, pin.npm.integrity, `${pin.npm.tarball} changed`);
  const tag = run('git', ['ls-remote', pin.repository, `refs/tags/${pin.npm.tag}^{}`], {}, root).trim().split('\t')[0];
  assert.equal(tag, pin.npm.revision, `${pin.npm.tag} is not ${pin.npm.revision}`);

  // The manifest and lockfile name exactly the pinned public artifacts.
  const manifest = JSON.parse(readFileSync(join(target, 'package.json'), 'utf8'));
  assert.equal(manifest.private, true);
  assert.equal(manifest.dependencies[pin.npm.package], pin.npm.tarball, 'package.json does not pin the bitruntime release');
  assert.equal(manifest.dependencies['@bitspark/bitwire'], pin.npm.bitwireVersion, 'package.json does not pin the bitwire contract');
  const lock = JSON.parse(readFileSync(join(target, 'package-lock.json'), 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') continue;
    assert.ok(!entry.link && /^https:\/\//.test(entry.resolved ?? '') && entry.integrity, `${path} is not a public, integrity-pinned artifact`);
    assert.ok(path === 'node_modules/@bitspark/bitwire' || !path.endsWith('/@bitspark/bitwire'), 'a second bitwire copy is installed');
  }
  const entry = path => { const { version, resolved, integrity } = lock.packages[path]; return { version, resolved, integrity }; };
  assert.deepEqual(entry(`node_modules/${pin.npm.package}`), { version: pin.npm.version, resolved: pin.npm.tarball, integrity: pin.npm.integrity });
  assert.deepEqual(entry('node_modules/@bitspark/bitwire'), { version: pin.npm.bitwireVersion, resolved: pin.npm.bitwireTarball, integrity: pin.npm.bitwireIntegrity });

  npm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], target);
  npm(['ls', '--all'], target);
  const installed = name => JSON.parse(readFileSync(join(target, 'node_modules', name, 'package.json'), 'utf8'));
  const runtime = installed(pin.npm.package);
  assert.deepEqual([runtime.name, runtime.version], [pin.npm.package, pin.npm.version], 'bitruntime is not the pinned release');
  assert.equal(runtime.dependencies['@bitspark/bitwire'], pin.npm.bitwireVersion);
  assert.equal(installed('@bitspark/bitwire').version, pin.npm.bitwireVersion, 'bitwire is not the pinned contract');
  return target;
}

const race = languages.includes('go') && run('go', ['env', 'CGO_ENABLED']).trim() === '1';
if (languages.includes('go') && !race && process.env.CI) throw new Error('CI must run the bitruntime drivers under the race detector');
const results = [];
function pass(label, detail) {
  results.push(`${label}: ${detail}`);
  console.log(`PASS ${label}: ${detail}`);
}

const checkout = run('git', ['rev-parse', 'HEAD'], {}, root).trim();
const modified = run('git', ['status', '--porcelain', '--', ...Object.values(files)], {}, root).trim() !== '';
console.log(`bitruntime ${pin.version} (${pin.revision}) and ${pin.npm.package} ${pin.npm.version} (${pin.npm.revision}) against bitwire ${pin.bitwireVersion}; scratch ${scratch}`);
try {
  const lifecycleInput = join(scratch, 'lifecycle-inputs.json');
  writeFileSync(lifecycleInput, JSON.stringify(lifecycleInputs(lifecycle)));
  const declaredInput = join(scratch, 'declared-inputs.json');
  writeFileSync(declaredInput, JSON.stringify(declaredInputs(declared)));
  const total = declared.cases.length;
  const toolchain = [];

  // Each language runs the same families on the same carriers with the same
  // withheld inputs; only the invocation of a driver differs.
  for (const language of languages) {
    let driver, facilities;
    if (language === 'go') {
      verifyModules();
      const programs = Object.fromEntries(['lifecycle', 'composition', 'declared', 'trees'].map(name => [name, build(name)]));
      driver = (name, arguments_ = [], env = {}) => run(programs[name], arguments_, env);
      facilities = {
        lifecycle: 'core.Invocation', composition: 'NewPair/peers, dispatch, At, Mount and Forward',
        production: 'core.Mount/At/Forward', trees: 'core.Compose/Select/Send/AsAddressed',
      };
      toolchain.push(`${run('go', ['env', 'GOVERSION']).trim()}${race ? ' with race detector' : ' (race detector unavailable locally)'}`);
    } else {
      const target = await installTypeScript();
      const compiler = join(target, 'node_modules/typescript/bin/tsc');
      run(process.execPath, [compiler, '-p', 'tsconfig.json'], {}, target);
      driver = (name, arguments_ = [], env = {}) => run(process.execPath, [`${name}.ts`, ...arguments_], env, target);
      facilities = {
        lifecycle: 'Invocation', composition: 'pair/Peer, createDispatcher, at, mount and forward',
        production: 'mount/at/forward', trees: 'compose/select/send/asAddressed',
      };
      const typescript = run(process.execPath, [compiler, '--version'], {}, target).trim().replace(/^Version /, '');
      toolchain.push(`node ${process.version} with type stripping, checked by TypeScript ${typescript}`);
    }

    compareCases(lifecycle, JSON.parse(driver('lifecycle', [lifecycleInput])), `${language}/lifecycle`);
    pass(`${language}/lifecycle`, `${lifecycle.cases.length}/${lifecycle.cases.length} independent cases through ${facilities.lifecycle}`);

    for (const [carrier, reverse] of carriers) {
      const label = `${language}/composition/${carrier}/${reverse}`;
      assert.deepEqual(JSON.parse(driver('composition', [], carrierEnv(carrier, reverse))), composition, `${label}: composition differs from bitwire's oracle`);
      pass(label, `${Object.keys(composition).length}/${Object.keys(composition).length} composition groups through ${facilities.composition}`);
    }

    // The reference interpreter must meet every expectation. Production runs
    // bitruntime's addressed mount and may differ only by a gap in its own ledger.
    for (const realization of ['reference', 'production']) {
      for (const [carrier, reverse] of carriers) {
        const label = `${language}/declared/${realization}/${carrier}/${reverse}`;
        const actual = JSON.parse(driver('declared', [realization, declaredInput], carrierEnv(carrier, reverse)));
        if (realization === 'reference') {
          compareCases(declared, actual, label);
          pass(label, `${total}/${total} cases (test-only reference interpreter over bitruntime carriers)`);
        } else {
          const result = compareProduction(declared, actual, gaps, language, label);
          pass(label, `${result.conforming.length}/${total} conform through ${facilities.production}; ${result.gaps.length} match bitruntime's recorded gaps`);
        }
      }
    }

    assert.deepEqual(JSON.parse(driver('trees')), trees, `${language}/trees: full tree observations differ from bitwire's oracle`);
    pass(`${language}/trees`, `${Object.keys(trees).length}/${Object.keys(trees).length} observations through ${facilities.trees}`);
  }

  console.log('\nReport');
  console.log(`  bitwire contract: ${pin.bitwireVersion} (github.com/Bitspark/bitwire at ${pin.bitwireRevision}; npm @bitspark/bitwire ${pin.npm.bitwireVersion})`);
  console.log(`  bitwire cases:    checkout ${checkout}${modified ? ' with local changes to the case files' : ''}`);
  for (const [name, path] of Object.entries(files)) console.log(`    ${sha256(path)}  ${path}${name === 'gaps' ? ' (bitruntime gap ledger)' : ''}`);
  if (languages.includes('go')) console.log(`  Go:               ${pin.module} ${pin.version} (${pin.revision}), ${pin.profile}`);
  if (languages.includes('ts')) {
    console.log(`  TypeScript:       ${pin.npm.package} ${pin.npm.version} (${pin.npm.tag} at ${pin.npm.revision}), ${pin.profile}`);
    console.log(`    ${pin.npm.sha256}  ${pin.npm.tarball}`);
    console.log(`    ${sha256('conformance/runtime/ts/package-lock.json')}  conformance/runtime/ts/package-lock.json`);
  }
  console.log(`  Toolchain:        ${toolchain.join('; ')}`);
  console.log('  Carriers:         local = the local pair (Go core.NewPair, TypeScript pair); peer/0 = WebSocket client sends;');
  console.log('                    peer/1 = WebSocket server sends (Go engine/websocket; TypeScript engine Peer over ws)');
  for (const line of results) console.log(`    ${line}`);
  console.log('Historical 0.2 addressed evidence (lifecycle, declared, composition) and 0.3 structural evidence (trees).');
} finally {
  if (args.includes('--keep-scratch')) console.log(`Retained scratch: ${scratch}`);
  else {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(basename(scratch).startsWith('bitwire-runtime-'));
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  }
}

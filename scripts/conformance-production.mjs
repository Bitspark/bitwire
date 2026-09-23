import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCases, declaredInputs } from './conformance-results.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const pin = read('conformance/production/nightseam.json');
assert.equal(pin.repository, 'https://github.com/Bitspark/nightseam.git');
assert.match(pin.revision, /^[a-f0-9]{40}$/);
assert.equal(pin.status, 'unreleased-source');
const args = process.argv.slice(2);
if (args.some(arg => !['--language=go', '--language=ts', '--keep-scratch'].includes(arg))) {
  throw new Error('Usage: node scripts/conformance-production.mjs [--language=go|ts] [--keep-scratch]');
}
const choice = args.find(arg => arg.startsWith('--language='))?.split('=')[1];
// The same independent decision 0006 cases as the released baseline; no gap is accepted here.
const bytes = readFileSync(join(root, 'conformance/declared/cases.json'));
assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.fixtureSHA256, 'independent fixture changed');
const fixture = JSON.parse(bytes);
const scratch = mkdtempSync(join(tmpdir(), 'bitwire-production-'));
const source = join(scratch, 'nightseam');

function run(command, arguments_, env = {}) {
  try {
    return execFileSync(command, arguments_, {
      cwd: source, encoding: 'utf8', timeout: 600_000, maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GOWORK: 'off', ...env },
    });
  } catch (error) {
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}

function pnpm(arguments_) {
  if (process.platform !== 'win32') return run('pnpm', arguments_);
  const shims = execFileSync('where.exe', ['pnpm.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/);
  for (const shim of shims) {
    const executable = join(dirname(shim), 'node_modules/pnpm/pnpm.exe');
    if (existsSync(executable)) return run(executable, arguments_);
    for (const suffix of ['pnpm/bin/pnpm.cjs', 'corepack/dist/pnpm.js']) {
      const entry = join(dirname(shim), 'node_modules', suffix);
      if (existsSync(entry)) return run(process.execPath, [entry, ...arguments_]);
    }
  }
  throw new Error('Cannot find pnpm beside its Windows shim.');
}

console.log(`Production API baseline: unreleased Nightseam ${pin.revision}; scratch ${scratch}`);
try {
  mkdirSync(source);
  run('git', ['init', '--quiet']);
  run('git', ['fetch', '--quiet', '--depth=1', pin.repository, pin.revision]);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD']);
  assert.equal(run('git', ['rev-parse', 'HEAD']).trim(), pin.revision);
  const dependency = JSON.parse(run('go', ['list', '-m', '-json', 'github.com/Bitspark/bitwire']));
  assert.equal(dependency.Version, pin.bitwireVersion);
  assert.equal(dependency.Replace, undefined, 'the shared contract must not be replaced');
  const artifact = JSON.parse(run('go', ['mod', 'download', '-json', `github.com/Bitspark/bitwire@${pin.bitwireVersion}`]));
  assert.equal(artifact.Origin.Hash, pin.bitwireRevision);
  assert.equal(artifact.Sum, pin.bitwireSum);
  const upstream = JSON.parse(readFileSync(join(source, 'conformance/declared/upstream.json'), 'utf8'));
  assert.equal(upstream.sha256, pin.fixtureSHA256);
  const inputPath = join(scratch, 'declared-inputs.json');
  writeFileSync(inputPath, JSON.stringify(declaredInputs(fixture)));

  for (const language of choice ? [choice] : ['go', 'ts']) {
    let program, driverArgs;
    if (language === 'go') {
      const race = run('go', ['env', 'CGO_ENABLED']).trim() === '1';
      if (!race && process.env.CI) throw new Error('CI must exercise Go production admission with the race detector');
      program = join(scratch, process.platform === 'win32' ? 'declared.exe' : 'declared');
      run('go', ['build', ...(race ? ['-race'] : []), '-o', program, './conformance/declared/go']);
      driverArgs = [inputPath];
      run('go', ['test', ...(race ? ['-race'] : []), '-count=1', '-timeout=180s', './duplex/go', '-run', '^TestDeclared']);
      console.log(`PASS upstream production construction/attachment tests${race ? ' with race detector' : ' (CGO disabled; no local race evidence)'}`);
    } else {
      pnpm(['install', '--frozen-lockfile']);
      const installed = JSON.parse(readFileSync(join(source, 'conformance/ts/node_modules/@bitspark/bitwire/package.json'), 'utf8'));
      assert.equal(installed.version, pin.bitwireVersion.slice(1));
      run(process.execPath, [join(source, 'node_modules/typescript/bin/tsc'), '-p', 'conformance/ts/tsconfig.check.json']);
      run(process.execPath, ['--experimental-strip-types', '--test', 'duplex/ts/src/declared.test.ts']);
      program = process.execPath;
      driverArgs = ['--experimental-strip-types', 'conformance/ts/src/declared.ts', inputPath];
      console.log('PASS upstream TypeScript production construction/attachment tests');
    }
    for (const [carrier, reverse] of [['local', '0'], ['peer', '0'], ['peer', '1']]) {
      const label = `${language}/production/${carrier}/${reverse}`;
      const actual = JSON.parse(run(program, driverArgs, {
        NIGHTSEAM_BITWIRE_CARRIER: carrier, NIGHTSEAM_BITWIRE_REVERSE: reverse,
      }));
      compareCases(fixture, actual, label);
      console.log(`PASS ${label}: ${fixture.cases.length} independent cases through production construction, parts and binding`);
    }
  }
  console.log('Production declared composition passed; released-package adoption and other consumers remain distinct.');
} finally {
  if (args.includes('--keep-scratch')) console.log(`Retained scratch: ${scratch}`);
  else {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(basename(scratch).startsWith('bitwire-production-'));
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  }
}

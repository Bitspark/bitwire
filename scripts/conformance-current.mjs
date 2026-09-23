import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCases, declaredInputs, lifecycleInputs, nightseamCompositionExpected } from './conformance-results.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const pin = read('conformance/current/nightseam.json');
assert.equal(pin.repository, 'https://github.com/Bitspark/nightseam.git');
assert.match(pin.revision, /^[a-f0-9]{40}$/);
assert.match(pin.release, /^v\d+\.\d+\.\d+$/);
const args = process.argv.slice(2);
if (args.some(arg => !['--language=go', '--language=ts', '--keep-scratch'].includes(arg))) {
  throw new Error('Usage: node scripts/conformance-current.mjs [--language=go|ts] [--keep-scratch]');
}
const choice = args.find(arg => arg.startsWith('--language='))?.split('=')[1];
const scratch = mkdtempSync(join(tmpdir(), 'bitwire-current-'));
const source = join(scratch, 'nightseam');
const fixture = read('conformance/current/lifecycle.json');
const expected = nightseamCompositionExpected(read('conformance/reference/expected.json'));
const inputs = join(scratch, 'lifecycle-inputs.json');
writeFileSync(inputs, JSON.stringify(lifecycleInputs(fixture)));
const declared = read('conformance/declared/cases.json');
const declaredInputPath = join(scratch, 'declared-inputs.json');
writeFileSync(declaredInputPath, JSON.stringify(declaredInputs(declared)));

function run(command, arguments_, cwd = source, env = {}) {
  try {
    return execFileSync(command, arguments_, {
      cwd, encoding: 'utf8', timeout: 600_000, maxBuffer: 16 * 1024 * 1024,
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

function verifyBitwire(cwd) {
  const dependency = JSON.parse(run('go', ['list', '-m', '-json', 'github.com/Bitspark/bitwire'], cwd));
  assert.equal(dependency.Version, pin.bitwireVersion);
  assert.equal(dependency.Replace, undefined, 'the shared contract must not be replaced');
  const artifact = JSON.parse(run('go', ['mod', 'download', '-json', `github.com/Bitspark/bitwire@${pin.bitwireVersion}`], cwd));
  assert.equal(artifact.Origin.Hash, pin.bitwireRevision);
  assert.equal(artifact.Sum, pin.bitwireSum);
}

console.log(`Current baseline: Nightseam ${pin.release} at ${pin.revision}; scratch ${scratch}`);
try {
  mkdirSync(source);
  run('git', ['init', '--quiet']);
  run('git', ['fetch', '--quiet', '--depth=1', pin.repository, `refs/tags/${pin.release}`]);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD']);
  assert.equal(run('git', ['rev-parse', 'HEAD']).trim(), pin.revision, 'release tag moved');
  verifyBitwire(source);

  for (const language of choice ? [choice] : ['go', 'ts']) {
    let program, driverArgs;
    if (language === 'go') {
      program = join(scratch, process.platform === 'win32' ? 'composition.exe' : 'composition');
      run('go', ['build', '-o', program, './conformance/bitwire/go']);
      driverArgs = [];
    } else {
      pnpm(['install', '--frozen-lockfile']);
      const installed = JSON.parse(readFileSync(join(source, 'conformance/ts/node_modules/@bitspark/bitwire/package.json'), 'utf8'));
      assert.equal(installed.version, pin.bitwireVersion.slice(1));
      cpSync(join(root, 'conformance/current/ts/lifecycle.ts'), join(source, 'conformance/ts/src/bitwire-lifecycle.ts'));
      cpSync(join(root, 'conformance/current/ts/declared.ts'), join(source, 'conformance/ts/src/bitwire-declared.ts'));
      run(process.execPath, [join(source, 'node_modules/typescript/bin/tsc'), '-p', 'conformance/ts/tsconfig.check.json']);
      program = process.execPath;
      driverArgs = ['--experimental-strip-types', 'conformance/ts/src/bitwire.ts'];
    }
    for (const [carrier, reverse] of [['local', '0'], ['peer', '0'], ['peer', '1']]) {
      const label = `${language}/${carrier}/${reverse}`;
      const actual = JSON.parse(run(program, driverArgs, source, {
        NIGHTSEAM_BITWIRE_CARRIER: carrier, NIGHTSEAM_BITWIRE_REVERSE: reverse,
      }));
      assert.deepEqual(actual, expected, `${label}: composition differs from Bitwire's oracle`);
      console.log(`PASS ${label}: six Bitwire composition groups`);
    }

    let output, declaredProgram, declaredArgs;
    if (language === 'go') {
      const driver = join(scratch, 'lifecycle-go');
      cpSync(join(root, 'conformance/current/go'), driver, { recursive: true });
      verifyBitwire(driver);
      const runtime = JSON.parse(run('go', ['list', '-m', '-json', 'github.com/Bitspark/nightseam'], driver));
      assert.equal(runtime.Version, pin.release);
      assert.equal(runtime.Replace, undefined);
      const artifact = JSON.parse(run('go', ['mod', 'download', '-json', `github.com/Bitspark/nightseam@${pin.release}`], driver));
      assert.equal(artifact.Origin.Hash, pin.revision);
      output = run('go', ['run', '-mod=readonly', '.', inputs], driver);
      declaredProgram = join(scratch, process.platform === 'win32' ? 'declared.exe' : 'declared');
      run('go', ['build', '-mod=readonly', '-o', declaredProgram, './declared'], driver);
      declaredArgs = [declaredInputPath];
    } else {
      output = run(process.execPath, ['--experimental-strip-types', 'conformance/ts/src/bitwire-lifecycle.ts', inputs]);
      declaredProgram = process.execPath;
      declaredArgs = ['--experimental-strip-types', 'conformance/ts/src/bitwire-declared.ts', declaredInputPath];
    }
    compareCases(fixture, JSON.parse(output), `${language}/lifecycle`);
    console.log(`PASS ${language}: ${fixture.cases.length} independent lifecycle cases`);

    for (const [carrier, reverse] of [['local', '0'], ['peer', '0'], ['peer', '1']]) {
      const label = `${language}/declared/${carrier}/${reverse}`;
      const actual = JSON.parse(run(declaredProgram, declaredArgs, source, {
        NIGHTSEAM_BITWIRE_CARRIER: carrier, NIGHTSEAM_BITWIRE_REVERSE: reverse,
      }));
      compareCases(declared, actual, label);
      console.log(`PASS ${label}: ${declared.cases.length} independent declared-composition cases (test-only interpreter, released carriers)`);
    }

    // These are supplementary upstream-owned tests, explicitly not the oracle
    // above. They include the two independent endpoint integrations and races.
    if (language === 'go') {
      const selection = 'Test(IndependentEndpoint|CapturedTraversal|EachTraversal|LatchedCancellation|InvocationBounds|RetirementWaits|SequentialCompletions|ATraversal|ADispatcherRefusesAnInvocation|ASecondIntegration|ForwardingPreservesLifecycle|AQueuedControl|AResponseRacing|CaptureBound|TheSerialTable|ConcurrentCallsPublishSerials|ACarrierBridge|LocalWirePairDeadline|WireCancellationRetains)';
      const race = run('go', ['env', 'CGO_ENABLED']).trim() === '1';
      if (!race && process.env.CI) throw new Error('CI must exercise Go lifecycle races with CGO enabled');
      run('go', ['test', ...(race ? ['-race'] : []), '-count=1', '-timeout=180s', './runtime/go', '-run', selection]);
      console.log(`PASS upstream Go endpoint integrations, lifecycle, serial and budget tests${race ? ' with race detector' : ' (race detector unavailable locally)'}`);
    } else {
      run(process.execPath, ['--experimental-strip-types', '--test', '--test-timeout=20000',
        ...['invocation', 'invocation-experiment', 'serial', 'wire-pair'].map(name => `runtime/ts/src/${name}.test.ts`)]);
      console.log('PASS upstream TypeScript endpoint integrations, lifecycle, serial and budget tests');
    }
  }
  console.log('Current composition and scoped lifecycle evidence passed; full generated/live/authority acceptance remains separately recorded.');
} finally {
  if (args.includes('--keep-scratch')) console.log(`Retained scratch: ${scratch}`);
  else {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(basename(scratch).startsWith('bitwire-current-'));
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  }
}

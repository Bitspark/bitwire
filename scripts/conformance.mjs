import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pin = JSON.parse(readFileSync(join(root, 'conformance/nightseam.json'), 'utf8'));
assert.match(pin.revision, /^[a-f0-9]{40}$/);
assert.equal(pin.repository, 'https://github.com/Bitspark/nightseam.git');
const args = process.argv.slice(2);
const choice = args.find(arg => arg.startsWith('--language='))?.split('=')[1];
if (args.some(arg => !['--language=go', '--language=ts', '--keep-scratch'].includes(arg))) {
  throw new Error('Usage: node scripts/conformance.mjs [--language=go|ts] [--keep-scratch]');
}
const scratch = mkdtempSync(join(tmpdir(), 'bitwire-conformance-'));
const source = join(scratch, 'nightseam');
const fixturePath = join(root, 'conformance/cases/access.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
assert.equal(fixture.schemaVersion, 1);
assert.ok(fixture.cases.length > 0);
assert.equal(new Set(fixture.cases.map(test => test.id)).size, fixture.cases.length);

function run(command, arguments_, cwd, capture = false) {
  return execFileSync(command, arguments_, {
    cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    timeout: 600_000, maxBuffer: 8 * 1024 * 1024,
  });
}
// On Windows invoke the installed pnpm executable or JavaScript entry rather than
// constructing a shell command around a temporary path.
function pnpm(arguments_, cwd) {
  if (process.platform !== 'win32') return run('pnpm', arguments_, cwd);
  const matches = execFileSync('where.exe', ['pnpm.cmd'], { encoding: 'utf8' }).trim().split(/\r?\n/);
  for (const shim of matches) {
    const executable = join(dirname(shim), 'node_modules/pnpm/pnpm.exe');
    if (existsSync(executable)) return run(executable, arguments_, cwd);
    const entry = join(dirname(shim), 'node_modules/pnpm/bin/pnpm.cjs');
    if (existsSync(entry)) return run(process.execPath, [entry, ...arguments_], cwd);
    const corepack = join(dirname(shim), 'node_modules/corepack/dist/pnpm.js');
    if (existsSync(corepack)) return run(process.execPath, [corepack, ...arguments_], cwd);
  }
  throw new Error('Could not find the pnpm JavaScript entry point beside its Windows shim.');
}

function compare(language, output) {
  const actual = JSON.parse(output);
  assert.ok(Array.isArray(actual), `${language}: driver must return an observations array`);
  assert.equal(actual.length, fixture.cases.length, `${language}: missing or extra case observations`);
  const observations = new Map(actual.map(row => [row.id, row.observations]));
  assert.equal(observations.size, actual.length, `${language}: duplicate observations`);
  for (const test of fixture.cases) {
    assert.deepEqual(observations.get(test.id), test.expected, `${language}: ${test.id}`);
    console.log(`PASS ${language}: ${test.id}`);
  }
}

console.log(`Nightseam ${pin.revision} (${pin.status}); scratch ${scratch}`);
try {
  mkdirSync(source);
  run('git', ['init', '--quiet'], source);
  run('git', ['fetch', '--quiet', '--depth=1', pin.repository, pin.revision], source);
  run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], source);
  assert.equal(run('git', ['rev-parse', 'HEAD'], source, true).trim(), pin.revision);

  if (!choice || choice === 'go') {
    const driver = join(scratch, 'go-driver');
    cpSync(join(root, 'conformance/drivers/nightseam/go'), driver, { recursive: true });
    run('go', ['mod', 'edit', '-require=github.com/Bitspark/nightseam@v0.0.0', `-replace=github.com/Bitspark/nightseam=${source}`], driver);
    run('go', ['mod', 'tidy'], driver);
    compare('go', run('go', ['run', '.', fixturePath], driver, true));
  }
  if (!choice || choice === 'ts') {
    pnpm(['install', '--frozen-lockfile'], source);
    const driver = join(source, 'bitwire-conformance-driver.mts');
    cpSync(join(root, 'conformance/drivers/nightseam/ts/driver.ts'), driver);
    const compiler = join(source, 'node_modules/typescript/bin/tsc');
    writeFileSync(join(source, 'tsconfig.bitwire-conformance.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
        strict: true, noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true, types: ['node'],
      }, files: ['bitwire-conformance-driver.mts'],
    }, null, 2));
    run(process.execPath, [compiler, '-p', 'tsconfig.bitwire-conformance.json'], source);
    compare('ts', run(process.execPath, ['--experimental-strip-types', driver, fixturePath], source, true));
  }
  console.log(`Behavioral observations match ${fixture.cases.length} independent cases per selected driver.`);
  console.log('Historical 0.1.0 runtime evidence, including its dispatcher policy; not Bitwire 0.2 conformance, published-package adoption or full profile conformance.');
} finally {
  if (args.includes('--keep-scratch')) console.log(`Retained scratch: ${scratch}`);
  else {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(basename(scratch).startsWith('bitwire-conformance-'));
    rmSync(scratch, { recursive: true, force: true });
  }
}

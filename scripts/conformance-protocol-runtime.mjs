// Runs bitwire's bitwire/1 conformance runner (conformance/protocol/runner/go)
// against bitruntime's released driver-1 testees, pinned in
// conformance/protocol/testees: the Go testee built from the pinned module,
// and the TypeScript testee installed from the pinned release asset. It makes
// two claims, one per language, each core scope over WebSockets, in every
// pairing with itself and with the other language in both orders. Both must
// be supported.
//
//   node scripts/conformance-protocol-runtime.mjs [--keep-scratch]
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const home = join(root, 'conformance/protocol/testees');
const runnerDir = join(root, 'conformance/protocol/runner/go');
const pins = JSON.parse(readFileSync(join(home, 'bitruntime.json'), 'utf8'));
const exe = process.platform === 'win32' ? '.exe' : '';
const goEnv = { ...process.env, GOWORK: 'off', GOFLAGS: '-mod=readonly' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });

// The pins agree with the Go module, the lockfile and the public assets.
function verifyPins() {
  const goMod = readFileSync(join(home, 'go/go.mod'), 'utf8');
  assert.ok(goMod.includes(`require ${pins.go.module} ${pins.go.version}\n`), 'go.mod requires another bitruntime');
  const goSum = readFileSync(join(home, 'go/go.sum'), 'utf8');
  assert.ok(goSum.includes(`${pins.go.module} ${pins.go.version} ${pins.go.sum}\n`), 'go.sum holds another bitruntime module sum');
  assert.ok(goSum.includes(`${pins.go.module} ${pins.go.version}/go.mod ${pins.go.goModSum}\n`), 'go.sum holds another bitruntime go.mod sum');
  const lock = JSON.parse(readFileSync(join(home, 'ts/package-lock.json'), 'utf8'));
  for (const asset of [pins.ts.testee, pins.ts.runtime]) {
    const entry = lock.packages[`node_modules/${asset.package}`];
    assert.ok(entry, `package-lock.json has no ${asset.package}`);
    assert.equal(entry.resolved, asset.tarball, `${asset.package} resolves elsewhere`);
    assert.equal(entry.integrity, asset.integrity, `${asset.package} has another integrity`);
  }
}

async function verifyAssets() {
  for (const asset of [pins.ts.testee, pins.ts.runtime]) {
    const response = await fetch(asset.tarball);
    assert.ok(response.ok, `${asset.tarball}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(sha256(bytes), asset.sha256, `${asset.tarball} has another SHA-256`);
    assert.equal(`sha512-${createHash('sha512').update(bytes).digest('base64')}`, asset.integrity, `${asset.tarball} has another integrity`);
  }
}

function npmCli() {
  // npm 12 refuses remote tarball dependencies by default; the node-bundled npm installs them.
  const cli = [join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')].find(existsSync);
  assert.ok(cli, 'no npm next to node');
  return cli;
}

verifyPins();
await verifyAssets();
const race = run('go', ['env', 'CGO_ENABLED'], { env: goEnv }).trim() === '1';
if (!race && process.env.CI) throw new Error('CI must build the Go testee under the race detector');
const scratch = mkdtempSync(join(tmpdir(), 'bitwire-protocol-'));
try {
  const goTestee = join(scratch, `bitwire-testee-go${exe}`);
  run('go', ['build', ...(race ? ['-race'] : []), '-o', goTestee, pins.go.testee], { cwd: join(home, 'go'), env: goEnv, stdio: ['ignore', 'inherit', 'inherit'] });
  const runner = join(scratch, `runner${exe}`);
  run('go', ['build', '-o', runner, '.'], { cwd: runnerDir, env: goEnv, stdio: ['ignore', 'inherit', 'inherit'] });

  const ts = join(scratch, 'ts');
  cpSync(join(home, 'ts'), ts, { recursive: true });
  run(process.execPath, [npmCli(), 'ci', '--no-audit', '--no-fund'], { cwd: ts, stdio: ['ignore', 'ignore', 'inherit'] });
  const tsTestee = join(ts, 'node_modules', pins.ts.testee.package, pins.ts.testee.bin);
  assert.ok(existsSync(tsTestee), `no ${tsTestee}`);

  const goVersion = run('go', ['env', 'GOVERSION'], { env: goEnv }).trim();
  const implementations = {
    go: {
      name: 'bitruntime (Go)', version: pins.release, revision: pins.revision, language: 'go',
      toolchain: `${goVersion}${race ? ' with race detector' : ''}`,
      artifacts: [goTestee], testee: { argv: [goTestee] },
    },
    ts: {
      name: 'bitruntime (TypeScript)', version: pins.release, revision: pins.revision, language: 'typescript',
      toolchain: `node ${process.version}`,
      artifacts: [tsTestee, join(ts, 'package-lock.json')], testee: { argv: [process.execPath, tsTestee] },
    },
  };
  const claims = [
    ['go', [['go', 'go'], ['go', 'ts'], ['ts', 'go']]],
    ['ts', [['ts', 'ts'], ['ts', 'go'], ['go', 'ts']]],
  ];
  const lines = [];
  for (const [implementation, pairings] of claims) {
    const config = join(scratch, `run-${implementation}.json`);
    const report = join(scratch, `report-${implementation}.json`);
    writeFileSync(config, JSON.stringify({ scope: 'core', implementation, implementations, pairings, transports: [{ name: 'websocket', subprotocols: true }] }, null, 2));
    const result = spawnSync(runner, ['run', '-config', config, '-report', report, '-quiet', '-checkout', root], { encoding: 'utf8' });
    process.stderr.write(result.stderr);
    const parsed = JSON.parse(readFileSync(report, 'utf8'));
    const failing = parsed.cases.filter(entry => entry.required && entry.result !== 'pass');
    for (const entry of failing.slice(0, 20)) console.log(`  ${entry.result} ${entry.id} [${entry.pairing.a} | ${entry.pairing.b}]: ${entry.reason}`);
    assert.equal(result.status, 0, `the ${implementation} claim is not supported`);
    lines.push({ implementation, report: parsed });
  }

  const [{ report: first }] = lines;
  console.log('\nReport');
  console.log(`  protocol:   ${first.protocol.revision} (${first.protocol.normativeDigest})`);
  console.log(`  contract:   edition ${first.contract.edition}, ${first.contract.status}, contractDigest ${first.contract.contractDigest}`);
  console.log(`  evidence:   evidenceDigest ${first.evidence.evidenceDigest}`);
  console.log(`  runner:     ${first.runner.name} ${first.runner.version} at ${first.runner.revision}${first.runner.modified ? ' (modified)' : ''}`);
  console.log(`  bitruntime: ${pins.release} at ${pins.revision}; Go ${pins.go.module} ${pins.go.sum}; TypeScript ${pins.ts.testee.tarball} (sha256 ${pins.ts.testee.sha256})`);
  for (const { implementation, report } of lines) {
    const counts = report.claim.counts;
    console.log(`  claim ${implementation}: ${report.claim.result}; required ${counts.pass} pass, ${counts.fail} fail, ${counts.unsupported} unsupported, ${counts.skip} skip, ${counts.harness} harness; pairings ${report.pairings.map(p => `${p.a}/${p.b}`).join(', ')}; ${report.implementation.toolchain}`);
  }
  console.log('Released-runtime evidence for bitwire/1, core scope, over WebSockets. Edition 1 of the contract is a draft.');
} finally {
  if (process.argv.includes('--keep-scratch')) console.log(`Retained scratch: ${scratch}`);
  else {
    assert.equal(dirname(resolve(scratch)), resolve(tmpdir()));
    assert.ok(basename(scratch).startsWith('bitwire-protocol-'));
    rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
  }
}

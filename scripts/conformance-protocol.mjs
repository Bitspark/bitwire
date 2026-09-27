// The bitwire/1 conformance runner (conformance/protocol/runner/go): its own
// tests, which hold it to the examples of conformance/protocol/CONTRACT.md,
// and a cross-check of what it loads and the identities it computes against
// scripts/protocol-scenarios.mjs, an independent reading of the same files.
// Also the tests of the deliberately invalid testees
// (conformance/protocol/mutants/go), whose runs need released testees and are
// made by scripts/conformance-protocol-runtime.mjs.
//
//   node scripts/conformance-protocol.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digests } from './protocol-scenarios.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runner = join(root, 'conformance/protocol/runner/go');
const mutants = join(root, 'conformance/protocol/mutants/go');
const env = { ...process.env, GOWORK: 'off', GOFLAGS: '-mod=readonly' };
const go = (args, options = {}) => execFileSync('go', args, { cwd: runner, env, encoding: 'utf8', ...options });

const race = go(['env', 'CGO_ENABLED']).trim() === '1';
if (!race && process.env.CI) throw new Error('CI must test the runner under the race detector');
go(['vet', './...'], { stdio: 'inherit' });
go(['test', ...(race ? ['-race'] : []), '-count=1', './...'], { stdio: 'inherit' });
go(['vet', './...'], { cwd: mutants, stdio: 'inherit' });
go(['test', ...(race ? ['-race'] : []), '-count=1', './...'], { cwd: mutants, stdio: 'inherit' });

const run = args => JSON.parse(go(['run', '.', ...args, '-checkout', root]));
const identities = run(['digests']);
const expected = digests();
assert.equal(identities.contractDigest, expected.contractDigest, 'the runner and the tooling compute different contract digests');
assert.equal(identities.evidenceDigest, expected.evidenceDigest, 'the runner and the tooling compute different evidence digests');
assert.equal(identities.edition, 1);

const cases = run(['load']);
const files = new Set(cases.map(entry => entry.file));
const scenarios = readdirSync(join(root, 'conformance/protocol/scenarios'), { recursive: true }).filter(path => String(path).endsWith('.json'));
assert.equal(files.size, scenarios.length, 'the runner loads a different number of scenario files than lie under scenarios/');
const optional = cases.filter(entry => entry.optional).length;

console.log(`PASS runner and mutant tests${race ? ' under the race detector' : ' (race detector unavailable locally)'}, including every example of CONTRACT.md`);
console.log(`PASS the runner loads all ${files.size} scenarios as ${cases.length} cases (${optional} optional), contractDigest ${identities.contractDigest}, evidenceDigest ${identities.evidenceDigest}, as the tooling computes them`);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { derive, expected, loadCheck, verify } from './protocol-scenarios.mjs';

const root = new URL('../', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const manifest = json('protocol/bitwire-1/manifest.json');
const selection = json('conformance/protocol/selection.json');
const digest = manifest.normativeDigest;
const bySource = () => new Map([...expected().values()].map(scenario => [scenario.source.path.split('/').slice(-2).join('/'), scenario]));

test('every derivative matches its archived source and names the published identity', () => {
  const scenarios = new Map([...verify()].filter(([, scenario]) => scenario.source));
  assert.equal(scenarios.size, 37);
  for (const [path, scenario] of scenarios) {
    assert.equal(scenario.protocol.normativeDigest, digest, path);
    const source = json(scenario.source.path);
    assert.deepEqual(scenario.steps, source.steps, `${path}: steps are the upstream steps, unchanged`);
    assert.deepEqual(scenario.foreach, source.foreach, `${path}: table expansion is unchanged`);
  }
});

test('authored scenarios name the identity, derive from nothing and replace each known defect', () => {
  const authored = [...verify()].filter(([, scenario]) => !scenario.source);
  const paths = authored.map(([path]) => path).sort();
  assert.deepEqual(paths, [
    'conformance/protocol/scenarios/peer/over-limit-frame-ends-with-1009.json',
    'conformance/protocol/scenarios/peer/trace-members-any-order.json',
    'conformance/protocol/scenarios/tunnel/declaration-digest-names-the-family.json',
  ]);
  for (const [path, scenario] of authored) {
    assert.equal(scenario.protocol.normativeDigest, digest, path);
    assert.equal(scenario.optional, undefined, `${path} is required evidence`);
  }
  for (const entry of selection.defective) {
    const name = entry.path.split('/').slice(-2).join('/').replace('.json', '');
    assert.ok(authored.some(([, scenario]) => scenario.description?.includes(name)), `no authored replacement names ${name}`);
  }
});

test('the selection excludes, marks diagnostics and marks known defects', () => {
  const paths = [...expected().values()].map(scenario => scenario.source.path);
  for (const entry of selection.excluded) assert.ok(!paths.includes(entry.path), `${entry.path} is excluded`);
  const scenarios = bySource();
  assert.equal(scenarios.get('peer/trace-propagation.json').optional, 'observer');
  assert.equal(scenarios.get('tunnel/observer-sees-the-channels.json').optional, 'observer');
  assert.equal(scenarios.get('peer/trace-members-verbatim.json').optional, 'defect', 'a propagator alone is core; this one is a known defect');
  assert.equal(scenarios.get('tunnel/declaration-digest.json').optional, 'defect');
  assert.equal(scenarios.get('tunnel/declaration-digest.json').scope, 'tunnel');
  assert.equal(scenarios.get('seam/order-and-whole.json').scope, 'core');
  assert.equal(scenarios.get('peer/call-and-reverse-call.json').optional, undefined);
});

test('the load rules refuse what CONTRACT.md §5.5 refuses, for authored scenarios too', () => {
  const authored = {
    name: 'a plain name reaches a name-registered handler',
    layer: 'peer',
    protocol: { revision: 'bitwire/1', normativeDigest: digest },
    scope: 'core',
    needs: ['peer'],
    steps: [{ on: 'runner', op: 'pair.peers', args: { server: 'a' } }, { on: 'b', op: 'peer.call', args: { on: '$pb', method: 'read' } }],
  };
  const check = (scenario, path = 'conformance/protocol/scenarios/peer/x.json') => loadCheck(path, scenario, digest, selection);
  check(authored);
  assert.throws(() => check({ ...authored, protocol: { revision: 'bitwire/1', normativeDigest: '0'.repeat(64) } }), /another protocol identity/);
  assert.throws(() => check({ ...authored, scope: 'tunnel' }), /scope does not match/);
  assert.throws(() => check(authored, 'conformance/protocol/scenarios/seam/x.json'), /outside its layer/);
  assert.throws(() => check({ ...authored, needs: ['peer', 'observer'] }), /not optional/);
  assert.throws(() => check({ ...authored, steps: [{ on: 'a', op: 'peer.identity' }] }), /excluded/);
  assert.throws(() => check({ ...authored, steps: [{ on: 'a', op: 'tunnel.open' }] }), /does not belong/);
  assert.throws(() => check({ ...authored, steps: [{ on: 'a', op: 'peer.observed' }] }), /observes/);
  assert.throws(() => check({ ...authored, steps: [{ on: 'runner', op: 'pair.peers', args: { server_options: { observe: true } } }] }), /asks for the observer/);
  assert.throws(() => check({ ...authored, invented: 1 }), /not in the schema/);
});

test('derivation refuses an upstream member or layer it does not know', () => {
  assert.throws(() => derive({ name: 'x', layer: 'peer', steps: [], invented: true }, 'p', 's', 'd', selection), /unknown member/);
  assert.throws(() => derive({ name: 'x', layer: 'live', steps: [] }, 'p', 's', 'd', selection), /no scope/);
});

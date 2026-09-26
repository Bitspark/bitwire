import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { derive, expected, verify } from './protocol-scenarios.mjs';

const root = new URL('../', import.meta.url);
const json = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const manifest = json('protocol/bitwire-1/manifest.json');
const selection = json('conformance/protocol/selection.json');
const schema = json('conformance/protocol/scenario.schema.json');

test('every derivative matches its archived source and names the published identity', () => {
  const scenarios = verify();
  assert.equal(scenarios.size, 37);
  for (const [path, derivative] of scenarios) {
    assert.equal(derivative.protocol.normativeDigest, manifest.normativeDigest, path);
    const source = json(derivative.source.path);
    assert.deepEqual(derivative.steps, source.steps, `${path}: steps are the upstream steps, unchanged`);
    assert.deepEqual(derivative.foreach, source.foreach, `${path}: table expansion is unchanged`);
  }
});

test('the selection excludes out-of-scope scenarios and marks observer diagnostics optional', () => {
  const paths = [...expected().values()].map(scenario => scenario.source.path);
  for (const entry of selection.excluded) assert.ok(!paths.includes(entry.path), `${entry.path} is excluded`);
  const byName = new Map([...expected().values()].map(scenario => [scenario.source.path.split('/').slice(-2).join('/'), scenario]));
  assert.equal(byName.get('peer/trace-propagation.json').optional, 'observer');
  assert.equal(byName.get('peer/trace-members-verbatim.json').optional, undefined, 'a propagator is a testee capability, not a diagnostic');
  assert.equal(byName.get('tunnel/declaration-digest.json').scope, 'tunnel', 'tunnel admission is in scope');
  assert.equal(byName.get('tunnel/observer-sees-the-channels.json').optional, 'observer');
  assert.equal(byName.get('seam/order-and-whole.json').scope, 'core');
});

test('derivatives satisfy the bitwire scenario schema', () => {
  const required = schema.required;
  const top = Object.keys(schema.properties);
  for (const [path, scenario] of expected()) {
    for (const key of [...required, 'source']) assert.ok(key in scenario, `${path}: missing ${key}`);
    for (const key of Object.keys(scenario)) assert.ok(top.includes(key), `${path}: ${key} is not in the schema`);
    assert.ok(schema.properties.layer.enum.includes(scenario.layer), path);
    assert.ok(schema.properties.scope.enum.includes(scenario.scope), path);
    assert.match(scenario.source.path, new RegExp(schema.properties.source.properties.path.pattern), path);
    if (scenario.foreach) assert.ok(schema.properties.foreach.properties.table.enum.includes(scenario.foreach.table), path);
    for (const need of scenario.needs ?? []) assert.ok(schema.properties.needs.items.enum.includes(need), `${path}: need ${need}`);
  }
});

test('derivation refuses an upstream member it does not know', () => {
  assert.throws(() => derive({ name: 'x', layer: 'peer', steps: [], invented: true }, 'p', 's', 'd', selection), /unknown member/);
  assert.throws(() => derive({ name: 'x', layer: 'live', steps: [] }, 'p', 's', 'd', selection), /no scope/);
});

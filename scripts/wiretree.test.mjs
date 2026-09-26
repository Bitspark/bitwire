import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareWiretree, keyHex, validateDisposition, wiretreeExpected, wiretreeFailures, wiretreeInputs } from './wiretree-lib.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const fixture = JSON.parse(read('conformance/wiretree/cases.json'));
const disposition = JSON.parse(read('conformance/wiretree/disposition.json'));
const conforming = families => fixture.cases.filter(item => families.includes(item.family))
  .map(item => ({ id: item.id, observations: structuredClone(wiretreeExpected(fixture).get(item.id)) }));

test('keys denote exact bytes and never normalize', () => {
  assert.equal(keyHex(''), '');
  assert.equal(keyHex('a/b'), '612f62');
  assert.equal(keyHex('é'), 'c3a9');
  assert.equal(keyHex('é'), '65cc81');
  assert.equal(keyHex({ hex: 'ff' }), 'ff');
  assert.throws(() => keyHex('\ud800'));
  assert.throws(() => keyHex({ hex: 'f' }));
  assert.throws(() => keyHex({ hex: 'FF' }));
});

test('drivers receive inputs, never the oracle', () => {
  const inputs = wiretreeInputs(fixture);
  assert.equal(inputs.cases.length, fixture.cases.length);
  const text = JSON.stringify(inputs);
  assert.ok(!text.includes('"expected"') && !text.includes('"$render"') && !text.includes('"renders"'));
  for (const item of inputs.cases) assert.ok(!('expected' in item));
  const binary = inputs.declarations.find(d => d.id === 'root').children.find(([, child]) => child === 'binary');
  assert.deepEqual(binary, ['ff', 'binary']);
});

test('missing, extra, duplicate and incorrect observations fail the gate', () => {
  const families = ['structure', 'bridge'];
  assert.equal(compareWiretree(fixture, conforming(families).reverse(), families, 'valid'), 20);
  assert.throws(() => compareWiretree(fixture, conforming(families).slice(1), families, 'missing'));
  assert.throws(() => compareWiretree(fixture, [...conforming(families), conforming(families)[0]], families, 'duplicate'));
  assert.throws(() => compareWiretree(fixture, [...conforming(families), conforming(['carrier'])[0]], families, 'extra'));
  const wrong = conforming(families);
  wrong[3].observations.trace[0] = ['refused'];
  assert.throws(() => compareWiretree(fixture, wrong, families, 'missing reported as refused'));
  assert.deepEqual(wiretreeFailures(fixture, wrong, families), [wrong[3].id]);
});

test('child order has no meaning, but child keys and owns do', () => {
  const rows = conforming(['structure']);
  const row = rows.find(item => item.id === 'own-and-descendants');
  row.observations.trace[0][1].children.reverse();
  compareWiretree(fixture, rows, ['structure'], 'reordered');
  row.observations.trace[0][1].children[0][0] = '00';
  assert.throws(() => compareWiretree(fixture, rows, ['structure'], 'renamed key'));
});

test('every historical case, gap and limitation is disposed against a current case', () => {
  const result = validateDisposition(disposition, fixture, read);
  assert.deepEqual(result, { declared: 39, gaps: 4, gapCases: 19, limitations: 2, uncited: [] });
  const dropped = structuredClone(disposition);
  dropped.cases.pop();
  assert.throws(() => validateDisposition(dropped, fixture, read));
  const unknown = structuredClone(disposition);
  unknown.cases[0].requirements[0].cases = ['not-a-case'];
  assert.throws(() => validateDisposition(unknown, fixture, read));
  const misfiled = structuredClone(disposition);
  misfiled.cases[0].requirements[0].kind = 'carrier';
  assert.throws(() => validateDisposition(misfiled, fixture, read));
  const edited = path => path === 'conformance/declared/cases.json' ? Buffer.concat([read(path), Buffer.from(' ')]) : read(path);
  assert.throws(() => validateDisposition(disposition, fixture, edited), /changed/);
});

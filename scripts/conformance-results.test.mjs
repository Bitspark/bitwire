import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareCases, compareProduction, decision0005Inputs, declaredInputs, lifecycleInputs, nightseamCompositionExpected } from './conformance-results.mjs';

const fixture = JSON.parse(readFileSync(new URL('../conformance/current/lifecycle.json', import.meta.url)));
const observations = () => fixture.cases.map(({ id, expected }) => ({ id, observations: structuredClone(expected) }));

test('the lifecycle driver receives inputs, never the oracle', () => {
  const input = lifecycleInputs(fixture);
  assert.equal(input.cases.length, fixture.cases.length);
  for (const item of input.cases) assert.deepEqual(Object.keys(item), ['id', 'limits', 'steps']);
});

test('missing, extra, duplicate and incorrect observations fail the gate', () => {
  compareCases(fixture, observations().reverse(), 'valid');
  assert.throws(() => compareCases(fixture, observations().slice(1), 'missing'));
  assert.throws(() => compareCases(fixture, [...observations(), observations()[0]], 'extra'));
  const duplicate = observations();
  duplicate[1] = duplicate[0];
  assert.throws(() => compareCases(fixture, duplicate, 'duplicate'));
  const wrong = observations();
  wrong[0].observations[0].retired = true;
  assert.throws(() => compareCases(fixture, wrong, 'premature retirement'));
  const unknown = observations();
  unknown[0].id = 'not-a-case';
  assert.throws(() => compareCases(fixture, unknown, 'unknown case'));
});

test('profile instantiation changes only the two placeholder reply identifiers', () => {
  const reference = JSON.parse(readFileSync(new URL('../conformance/reference/expected.json', import.meta.url)));
  const expected = nightseamCompositionExpected(reference);
  assert.deepEqual(reference.sameIDDelayedReplies.replyIDs, ['same-id', 'same-id']);
  assert.deepEqual(expected.sameIDDelayedReplies.replyIDs, ['c:1', 'c:1']);
  expected.sameIDDelayedReplies.replyIDs = ['same-id', 'same-id'];
  assert.deepEqual(expected, reference);
  reference.sameIDDelayedReplies.replyIDs[0] = 'changed-input';
  assert.throws(() => nightseamCompositionExpected(reference));
});

const declared = JSON.parse(readFileSync(new URL('../conformance/declared/cases.json', import.meta.url)));
const ledger = JSON.parse(readFileSync(new URL('../conformance/declared/production-gaps.json', import.meta.url)));
const expectedRows = () => declared.cases.map(({ id, expected }) => ({ id, observations: structuredClone(expected) }));
// Production rows that reproduce every recorded gap exactly and meet all other expectations.
const productionRows = language => {
  const gaps = new Map(ledger.gaps.flatMap(gap => gap.cases.map(id => [id, gap.observed[language]])));
  return expectedRows().map(row => gaps.has(row.id) ? { id: row.id, observations: structuredClone(gaps.get(row.id)) } : row);
};

test('declared composition inputs exclude the oracle and malformed results fail', () => {
  const inputs = declaredInputs(declared);
  assert.deepEqual(inputs.declarations, declared.declarations);
  assert.equal(inputs.cases.length, declared.cases.length);
  for (const item of inputs.cases) {
    assert.deepEqual(Object.keys(item), ['id', 'kind', 'root', 'fault', 'steps', 'relay', 'mount']);
  }
  compareCases(declared, expectedRows(), 'declared');
  assert.throws(() => compareCases(declared, expectedRows().slice(1), 'missing'));
  assert.throws(() => compareCases(declared, [...expectedRows(), expectedRows()[0]], 'extra'));
  const duplicate = expectedRows(); duplicate[1] = duplicate[0];
  assert.throws(() => compareCases(declared, duplicate, 'duplicate'));
  const fallback = expectedRows();
  fallback.find(row => row.id === 'missing-never-falls-back').observations.trace[0] = ['delivered', ['root'], 1];
  assert.throws(() => compareCases(declared, fallback, 'origin fallback'));
  const reset = expectedRows();
  reset.find(row => row.id === 'mount-shared-child-state').observations.trace[2] = ['delivered', ['leaf'], 1];
  assert.throws(() => compareCases(declared, reset, 'reset child state'));
  const added = expectedRows(); added[0].unexpected = true;
  assert.throws(() => compareCases(declared, added, 'extra result field'));
  const unknown = expectedRows(); unknown[0].id = 'unknown';
  assert.throws(() => compareCases(declared, unknown, 'unknown case'));
  const invalid = structuredClone(declared); invalid.cases[0].id = '';
  assert.throws(() => declaredInputs(invalid));
  const twice = structuredClone(declared); twice.declarations.push(twice.declarations[0]);
  assert.throws(() => declaredInputs(twice));
});

test('superseded decision 0005 inputs keep their shape and exclude the oracle', () => {
  const superseded = JSON.parse(readFileSync(new URL('../conformance/production/decision-0005-cases.json', import.meta.url)));
  const inputs = decision0005Inputs(superseded);
  assert.deepEqual(inputs.nodes, superseded.nodes);
  for (const item of inputs.cases) assert.deepEqual(Object.keys(item), ['id', 'kind', 'fault', 'limits', 'steps', 'relay', 'mount']);
  assert.throws(() => decision0005Inputs(declared));
  assert.throws(() => declaredInputs(superseded));
});

test('production differs from the oracle only by exactly recorded gaps', () => {
  for (const language of ['go', 'ts']) {
    const result = compareProduction(declared, productionRows(language), ledger, language, language);
    assert.equal(result.gaps.length, ledger.gaps.reduce((sum, gap) => sum + gap.cases.length, 0));
    assert.equal(result.conforming.length + result.gaps.length, declared.cases.length);
  }
  // An unrecorded divergence fails, even for a case outside every gap.
  const drift = productionRows('go');
  drift.find(row => row.id === 'mount-routing').observations.trace[1] = ['delivered', ['leaf'], 1];
  assert.throws(() => compareProduction(declared, drift, ledger, 'go', 'drift'));
  // A gap whose observation changes fails rather than silently passing.
  const changed = productionRows('go');
  changed.find(row => row.id === 'invalid-key').observations.trace = [];
  assert.throws(() => compareProduction(declared, changed, ledger, 'go', 'changed gap'));
  // A gap that now conforms must be removed from the ledger.
  const closed = productionRows('ts');
  const invalidKey = declared.cases.find(test => test.id === 'invalid-key');
  closed.find(row => row.id === 'invalid-key').observations = structuredClone(invalidKey.expected);
  assert.throws(() => compareProduction(declared, closed, ledger, 'ts', 'closed gap'), /now conforms/);
  // The ledger can neither record an expectation nor hide a case twice.
  const relaxed = structuredClone(ledger); relaxed.gaps[1].observed.go = structuredClone(declared.cases.find(test => test.id === 'conflicting-children').expected);
  assert.throws(() => compareProduction(declared, productionRows('go'), relaxed, 'go', 'relaxed'));
  const repeated = structuredClone(ledger); repeated.gaps[1].cases.push('invalid-key');
  assert.throws(() => compareProduction(declared, productionRows('go'), repeated, 'go', 'repeated'));
  assert.throws(() => compareProduction(declared, productionRows('go').slice(1), ledger, 'go', 'missing'));
});

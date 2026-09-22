import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compareCases, lifecycleInputs, nightseamCompositionExpected } from './conformance-results.mjs';

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

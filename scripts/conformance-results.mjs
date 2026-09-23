import assert from 'node:assert/strict';

// Expected values never go to the implementation-side lifecycle adapters.
export function lifecycleInputs(fixture) {
  validateCases(fixture);
  return { cases: fixture.cases.map(({ id, limits, steps }) => ({ id, limits, steps })) };
}

function validateCases(fixture) {
  assert.equal(fixture.schemaVersion, 1);
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length > 0);
  assert.ok(fixture.cases.every(test => typeof test.id === 'string' && test.id.length > 0));
  assert.equal(new Set(fixture.cases.map(test => test.id)).size, fixture.cases.length);
}

export function declaredInputs(fixture) {
  validateCases(fixture);
  assert.ok(Array.isArray(fixture.nodes) && fixture.nodes.length > 0);
  return {
    nodes: fixture.nodes,
    cases: fixture.cases.map(({ id, kind, fault, limits, steps, relay, mount }) => ({ id, kind, fault, limits, steps, relay, mount })),
  };
}

export function compareCases(fixture, actual, label) {
  validateCases(fixture);
  assert.ok(Array.isArray(actual), `${label}: expected an observations array`);
  assert.equal(actual.length, fixture.cases.length, `${label}: missing or extra observations`);
  for (const row of actual) assert.deepEqual(Object.keys(row).sort(), ['id', 'observations'], `${label}: invalid result record`);
  const rows = new Map(actual.map(row => [row.id, row.observations]));
  assert.equal(rows.size, actual.length, `${label}: duplicate observations`);
  for (const test of fixture.cases) {
    assert.ok(rows.has(test.id), `${label}: missing ${test.id}`);
    assert.deepEqual(rows.get(test.id), test.expected, `${label}: ${test.id}`);
  }
}

export function nightseamCompositionExpected(reference) {
  const expected = structuredClone(reference);
  // Instantiate only the two echoed placeholder IDs in independent return
  // scopes. This never permits same-connection serial reuse or changes a law.
  assert.deepEqual(expected.sameIDDelayedReplies.replyIDs, ['same-id', 'same-id']);
  expected.sameIDDelayedReplies.replyIDs = ['c:1', 'c:1'];
  return expected;
}

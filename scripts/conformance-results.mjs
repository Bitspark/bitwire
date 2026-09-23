import assert from 'node:assert/strict';

// Expected values never go to the implementation-side lifecycle adapters.
export function lifecycleInputs(fixture) {
  validateCases(fixture, 1);
  return { cases: fixture.cases.map(({ id, limits, steps }) => ({ id, limits, steps })) };
}

function validateCases(fixture, schemaVersion) {
  assert.equal(fixture.schemaVersion, schemaVersion);
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length > 0);
  assert.ok(fixture.cases.every(test => typeof test.id === 'string' && test.id.length > 0));
  assert.equal(new Set(fixture.cases.map(test => test.id)).size, fixture.cases.length);
}

export function declaredInputs(fixture) {
  validateCases(fixture, 2);
  assert.ok(Array.isArray(fixture.declarations) && fixture.declarations.length > 0);
  assert.equal(new Set(fixture.declarations.map(d => d.id)).size, fixture.declarations.length);
  return {
    declarations: fixture.declarations,
    cases: fixture.cases.map(({ id, kind, root, fault, steps, relay, mount }) => ({ id, kind, root, fault, steps, relay, mount })),
  };
}

function observationRows(fixture, actual, label) {
  assert.ok(Array.isArray(actual), `${label}: expected an observations array`);
  assert.equal(actual.length, fixture.cases.length, `${label}: missing or extra observations`);
  for (const row of actual) assert.deepEqual(Object.keys(row).sort(), ['id', 'observations'], `${label}: invalid result record`);
  const rows = new Map(actual.map(row => [row.id, row.observations]));
  assert.equal(rows.size, actual.length, `${label}: duplicate observations`);
  for (const test of fixture.cases) assert.ok(rows.has(test.id), `${label}: missing ${test.id}`);
  return rows;
}

export function compareCases(fixture, actual, label) {
  validateCases(fixture, fixture.schemaVersion);
  const rows = observationRows(fixture, actual, label);
  for (const test of fixture.cases) assert.deepEqual(rows.get(test.id), test.expected, `${label}: ${test.id}`);
}

// A production gap is accepted only when the implementation still produces the
// exact recorded observation. The oracle is never relaxed to fit a runtime, and
// a gap that starts conforming must be removed from the ledger.
export function productionGaps(fixture, ledger, language) {
  assert.equal(ledger.schemaVersion, 1);
  const cases = new Map(fixture.cases.map(test => [test.id, test]));
  const recorded = new Map();
  for (const gap of ledger.gaps) {
    assert.ok(typeof gap.id === 'string' && gap.requirement && gap.evidence, `gap ${gap.id}: incomplete record`);
    assert.ok(gap.cases.length > 0, `gap ${gap.id}: no cases`);
    assert.ok(Object.hasOwn(gap.observed, language), `gap ${gap.id}: no ${language} observation`);
    for (const id of gap.cases) {
      assert.ok(cases.has(id), `gap ${gap.id}: unknown case ${id}`);
      assert.ok(!recorded.has(id), `gap ${gap.id}: ${id} recorded twice`);
      assert.notDeepEqual(gap.observed[language], cases.get(id).expected, `gap ${gap.id}: ${id} records the expectation`);
      recorded.set(id, { gap: gap.id, observed: gap.observed[language] });
    }
  }
  return recorded;
}

export function compareProduction(fixture, actual, ledger, language, label) {
  validateCases(fixture, fixture.schemaVersion);
  const recorded = productionGaps(fixture, ledger, language);
  const rows = observationRows(fixture, actual, label);
  const result = { conforming: [], gaps: [] };
  for (const test of fixture.cases) {
    const got = rows.get(test.id), gap = recorded.get(test.id);
    if (!gap) {
      assert.deepEqual(got, test.expected, `${label}: ${test.id}`);
      result.conforming.push(test.id);
      continue;
    }
    assert.notDeepEqual(got, test.expected, `${label}: ${test.id} now conforms; remove it from gap ${gap.gap}`);
    assert.deepEqual(got, gap.observed, `${label}: ${test.id} no longer matches recorded gap ${gap.gap}`);
    result.gaps.push(test.id);
  }
  return result;
}

export function nightseamCompositionExpected(reference) {
  const expected = structuredClone(reference);
  // Instantiate only the two echoed placeholder IDs in independent return
  // scopes. This never permits same-connection serial reuse or changes a law.
  assert.deepEqual(expected.sameIDDelayedReplies.replyIDs, ['same-id', 'same-id']);
  expected.sameIDDelayedReplies.replyIDs = ['c:1', 'c:1'];
  return expected;
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { loadVectors, run, schedules } from './stream-lib.mjs';

const vectors = loadVectors(JSON.parse(readFileSync(new URL('../conformance/stream/vectors.json', import.meta.url), 'utf8')));

// Every way a vector is read: each schedule, with the end of input delivered
// separately and, when the vector has one, together with the last read.
function* readings(vector) {
  for (const schedule of schedules(vector.input)) {
    yield { ...schedule, eofWithLast: false };
    if (vector.eof && schedule.chunks.length) yield { ...schedule, name: `${schedule.name}, end with last read`, eofWithLast: true };
  }
}

test('the vector file is well formed', () => {
  assert.ok(vectors.length >= 70, `${vectors.length} vectors`);
  const ends = new Set(vectors.map(v => v.expect.end));
  for (const end of ['open', 'eof', 'truncated', 'closed', 'refused']) assert.ok(ends.has(end), `no vector ends ${end}`);
  for (const code of [1002, 1009]) assert.ok(vectors.some(v => v.expect.send?.code === code && v.expect.end === 'refused'), `no refusal with ${code}`);
});

for (const buffering of [false, true]) {
  test(`the ${buffering ? 'buffering' : 'byte-by-byte'} reference meets every vector under every schedule`, () => {
    for (const vector of vectors) {
      for (const reading of readings(vector)) {
        const got = run(vector, reading.chunks, { buffering, eofWithLast: reading.eofWithLast });
        assert.deepEqual(got, vector.expect, `${vector.id} (${reading.name})`);
      }
    }
  });
}

// Realizations the vectors must reject: each fails at least one vector under at
// least one schedule, in the parser architecture it is written for.
const mutants = [
  ['lenient-case', 'header names and kinds matched without case'],
  ['lf-endings', 'bare LF accepted as a line ending'],
  ['skips-preamble', 'bytes before the first record skipped'],
  ['leading-zeros', 'a length with a leading zero accepted'],
  ['sixteen-digits', 'a 16-digit length accepted'],
  ['narrow-length', 'the length narrowed to 32 bits before the limit check'],
  ['limit-before-grammar', 'an over-limit length refused before its header block is complete'],
  ['waits-for-body', 'an over-limit record refused only once its body arrived'],
  ['close-counts-data-limit', 'a close reason held to the data limit'],
  ['registry-codes', 'any close code from 1000 to 4999 accepted'],
  ['early-code-check', 'a close code checked before its header block is complete'],
  ['echoes-reason', 'the reply echoes the received reason'],
  ['delivers-after-close', 'records after a close delivered'],
  ['eof-in-header-is-error', 'end of input inside a valid header prefix refused as syntax'],
  ['validates-text', 'text bodies validated as UTF-8 by the framer'],
  ['drops-final-bytes', 'bytes arriving with the end of input dropped'],
];

for (const [mutant, description] of mutants) {
  test(`the vectors reject a receiver: ${description}`, () => {
    const caught = vectors.find(vector => {
      for (const reading of readings(vector)) {
        const got = run(vector, reading.chunks, { mutants: [mutant], eofWithLast: reading.eofWithLast });
        if (!isDeepStrictEqual(got, vector.expect)) return true;
      }
      return false;
    });
    assert.ok(caught, `no vector rejects ${mutant}`);
  });
}

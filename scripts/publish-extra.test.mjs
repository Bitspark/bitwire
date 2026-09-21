import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanup, scratch } from './release-lib.mjs';

const sha = '1234567890abcdef1234567890abcdef12345678';
const base = 'https://api.github.com/repos/Bitspark/bitwire';
const responses = {
  [base]: { private: false, visibility: 'public' },
  [`${base}/releases/tags/v0.1.0`]: { tag_name: 'v0.1.0', draft: false, prerelease: false, published_at: '2026-09-21T00:00:00Z', immutable: true },
  [`${base}/git/ref/tags/v0.1.0`]: { object: { type: 'commit', sha } },
};

for (const language of ['python', 'haskell']) {
  test(`${language} preflight requests the repository root without a trailing slash`, () => {
    const directory = scratch('preflight-test');
    try {
      const output = join(directory, 'github-output');
      const mock = `const responses = ${JSON.stringify(responses)};
globalThis.fetch = async (url, options) => {
  if (options.headers.Authorization) throw new Error('The test must be anonymous.');
  const response = responses[url];
  return new Response(JSON.stringify(response ?? { message: 'Not Found' }), { status: response ? 200 : 404 });
};`;
      const result = execFileSync(process.execPath, [
        '--import', `data:text/javascript,${encodeURIComponent(mock)}`,
        fileURLToPath(new URL('./publish-extra.mjs', import.meta.url)), 'resolve', language, 'v0.1.0',
      ], { encoding: 'utf8', env: { GITHUB_REPOSITORY: 'Bitspark/bitwire', GITHUB_OUTPUT: output } });
      assert.match(result, /Verified immutable public release v0\.1\.0/);
      assert.equal(readFileSync(output, 'utf8'), `sha=${sha}\nversion=0.1.0\n`);
    } finally {
      cleanup(directory);
    }
  });
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { npmInstallReady, publicJSON } from './release-lib.mjs';

const name = '@bitspark/bitwire';
const version = '0.1.0';
const release = { name, version, dist: { tarball: 'https://registry.npmjs.org/@bitspark/bitwire/-/bitwire-0.1.0.tgz', integrity: 'sha512-example' } };

test('wait for the exact install metadata representation, including its released version', async () => {
  const responses = [undefined, { versions: {} }, { versions: { [version]: release } }];
  const readJSON = async (url, absentOK, headers) => {
    assert.equal(url, 'https://registry.npmjs.org/@bitspark%2fbitwire');
    assert.equal(absentOK, true);
    assert.equal(headers.Accept, 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*');
    return responses.shift();
  };
  // Publication can expose /name/version before either of the first two states
  // of the separate install endpoint. Only the third state admits installation.
  assert.equal(await npmInstallReady(name, version, readJSON), false);
  assert.equal(await npmInstallReady(name, version, readJSON), false);
  assert.equal(await npmInstallReady(name, version, readJSON), true);
});

test('invalid metadata and registry failures remain errors', async () => {
  await assert.rejects(npmInstallReady(name, version, async () => ({})), /no versions map/);
  await assert.rejects(npmInstallReady(name, version, async () => ({ versions: { [version]: { ...release, dist: {} } } })), /metadata is invalid/);
  const failure = new Error('HTTP 403');
  await assert.rejects(npmInstallReady(name, version, async () => { throw failure; }), error => error === failure);
});

test('registry requests forward the install Accept header and only allow absent metadata', async t => {
  const statuses = [404, 403, 200];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Accept, 'application/vnd.npm.install-v1+json');
    return new Response(JSON.stringify({ versions: {} }), { status: statuses.shift() });
  });
  const headers = { Accept: 'application/vnd.npm.install-v1+json' };
  assert.equal(await publicJSON('https://registry.npmjs.org/example', true, headers), undefined);
  await assert.rejects(publicJSON('https://registry.npmjs.org/example', true, headers), /HTTP 403/);
  assert.deepEqual(await publicJSON('https://registry.npmjs.org/example', true, headers), { versions: {} });
});

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkTag, cleanup, manifest, npm, npmRegistry, output, pack, publicJSON, scratch, version } from './release-lib.mjs';

checkTag(process.argv[2]);
const dryRun = process.argv.includes('--dry-run');
const provenance = process.argv.includes('--provenance');
if (!dryRun) {
  assert.equal(process.env.GITHUB_REPOSITORY, 'Bitspark/bitwire');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Only a tag push may publish.');
  assert.equal(process.env.GITHUB_REF, `refs/tags/v${version}`);
  assert.ok(provenance, 'Public publication requires provenance.');
  const visibility = output('gh', ['repo', 'view', 'Bitspark/bitwire', '--json', 'visibility', '--jq', '.visibility']);
  assert.equal(visibility, 'PUBLIC', 'Make the source public before publishing.');
  const runs = JSON.parse(output('gh', ['api', '--method', 'GET', 'repos/Bitspark/bitwire/actions/workflows/release.yml/runs', '-f', 'event=workflow_dispatch', '-f', 'status=success', '-f', `head_sha=${process.env.GITHUB_SHA}`, '-f', 'per_page=100']));
  let rehearsed = false;
  for (const run of runs.workflow_runs.filter(run => run.head_sha === process.env.GITHUB_SHA)) {
    const artifacts = JSON.parse(output('gh', ['api', `repos/Bitspark/bitwire/actions/runs/${run.id}/artifacts`]));
    rehearsed ||= artifacts.artifacts.some(artifact => !artifact.expired && artifact.name === `provenance-rehearsal-v${version}-${process.env.GITHUB_SHA}`);
  }
  assert.ok(rehearsed, 'A successful public provenance rehearsal of this exact commit is required before publication.');
}
const directory = scratch('publish');
try {
  const artifact = pack(join(directory, 'npm'));
  const existing = await publicJSON(`${npmRegistry}/${encodeURIComponent(manifest.name)}/${version}`, true);
  if (existing) {
    assert.equal(existing.dist?.integrity, artifact.integrity, 'This immutable npm version already exists with different contents.');
    console.log(`${manifest.name}@${version} already contains this exact package; no upload needed.`);
  } else {
    if (!dryRun) {
      const packageExists = await publicJSON(`${npmRegistry}/${encodeURIComponent(manifest.name)}`, true);
      assert.ok(packageExists || process.env.NODE_AUTH_TOKEN, 'First publication requires the configured bootstrap NPM_TOKEN.');
    }
    npm(['publish', artifact.path, '--registry', npmRegistry, `--@bitspark:registry=${npmRegistry}`, '--access', 'public', '--ignore-scripts', ...(dryRun ? ['--dry-run'] : []), ...(provenance ? ['--provenance'] : [])]);
  }
} finally {
  cleanup(directory);
}

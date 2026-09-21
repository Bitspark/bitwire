import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTag, cleanup, publicJSON, run, scratch, version } from './release-lib.mjs';

checkTag(process.argv[2]);
const dryRun = process.argv.includes('--dry-run');
if (!dryRun) {
  assert.equal(process.env.GITHUB_REPOSITORY, 'Bitspark/bitwire');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Only a tag push may publish.');
  assert.equal(process.env.GITHUB_REF, `refs/tags/v${version}`);
}
const directory = scratch('crate');
try {
  const target = join(directory, 'target');
  run('cargo', ['package', '--locked', '-p', 'bitspark-bitwire', '--target-dir', target]);
  const crate = join(target, 'package', `bitspark-bitwire-${version}.crate`);
  const checksum = createHash('sha256').update(readFileSync(crate)).digest('hex');
  const url = `https://crates.io/api/v1/crates/bitspark-bitwire/${version}`;
  const existing = await publicJSON(url, true);
  if (existing) {
    assert.equal(existing.version?.checksum, checksum, 'The immutable crate version already exists with different contents.');
    console.log(`bitspark-bitwire@${version} already contains this exact crate; no upload needed.`);
  } else {
    run('cargo', ['publish', '--locked', '-p', 'bitspark-bitwire', ...(dryRun ? ['--dry-run'] : [])]);
  }
  if (!dryRun) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (!(await publicJSON(url, true))) {
      if (Date.now() >= deadline) throw new Error('Published crate did not propagate to crates.io.');
      console.log('Waiting for bitspark-bitwire on crates.io.');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    const consumer = join(directory, 'consumer');
    mkdirSync(join(consumer, 'src'), { recursive: true });
    writeFileSync(join(consumer, 'Cargo.toml'), `[package]\nname = "bitwire-registry-consumer"\nversion = "0.0.0"\nedition = "2024"\n\n[dependencies]\nbitwire = { package = "bitspark-bitwire", version = "=${version}" }\n`);
    writeFileSync(join(consumer, 'src/main.rs'), readFileSync(new URL('../wire/rs/examples/consumer.rs', import.meta.url)));
    run('cargo', ['run', '--manifest-path', join(consumer, 'Cargo.toml')], { cwd: consumer, env: { ...process.env, CARGO_HOME: join(directory, 'cargo-home'), CARGO_TARGET_DIR: join(directory, 'consumer-target') } });
    console.log('The public crate installed and linked outside the checkout.');
  }
} finally {
  cleanup(directory);
}

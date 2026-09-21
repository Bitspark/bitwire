import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTag, manifest, moduleName, npmRegistry, output, root, version } from './release-lib.mjs';

const tag = process.argv[2];
checkTag(tag);
assert.equal(manifest.name, '@bitspark/bitwire');
assert.notEqual(manifest.private, true, 'The leaf package must permit publication.');
assert.equal(manifest.publishConfig?.registry, npmRegistry);
assert.equal(manifest.publishConfig?.access, 'public');
assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).private, true, 'Keep the workspace root private.');
assert.match(readFileSync(join(root, 'go.mod'), 'utf8'), new RegExp(`^module ${moduleName.replaceAll('.', '\\.')}\\s`, 'm'));
assert.doesNotMatch(readFileSync(join(root, 'go.mod'), 'utf8'), /^replace\s/m, 'A release cannot depend on a local Go replacement.');
for (const name of ['LICENSE', 'NOTICE']) {
  assert.equal(readFileSync(join(root, name), 'utf8'), readFileSync(join(root, 'wire/ts', name), 'utf8'), `${name} differs from its packaged copy.`);
}
for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const [name, constraint] of Object.entries(manifest[field] ?? {})) {
    assert.ok(!/^(?:file:|link:|workspace:|git\+|https?:)/.test(constraint), `${name} has an unpublished dependency: ${constraint}`);
  }
}
if (existsSync(join(root, 'wire/rs/Cargo.toml'))) {
  const metadata = JSON.parse(output('cargo', ['metadata', '--manifest-path', 'wire/rs/Cargo.toml', '--no-deps', '--format-version', '1']));
  const crate = metadata.packages.find(item => item.name === 'bitspark-bitwire');
  assert.equal(crate?.version, version, 'Rust and npm contract versions must agree.');
  assert.ok(!crate.publish || crate.publish.includes('crates-io'), 'Rust publication is disabled.');
}
if (process.argv.includes('--require-tag')) {
  const head = output('git', ['rev-parse', 'HEAD']);
  const remoteTags = output('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`]);
  const refs = new Map(remoteTags.split('\n').filter(Boolean).map(line => { const [sha, ref] = line.split(/\s+/); return [ref, sha]; }));
  assert.equal(refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`), head, 'The remote release tag must name exactly HEAD.');
  output('git', ['merge-base', '--is-ancestor', head, 'origin/main']);
}
console.log(`${tag}: release metadata, package notices and ${process.argv.includes('--require-tag') ? 'immutable remote tag' : 'candidate version'} agree.`);

// Verify the documented release dependency, independently of the local library.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, scratch } from '../../scripts/release-lib.mjs';

const source = fileURLToPath(new URL('./', import.meta.url));
// Default CI evidence remains the already published 0.1.0 release. After a new
// immutable tag exists, explicitly verify it with --tag v0.2.0 --version 0.2.0.
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 4 || args[0] !== '--tag' || args[2] !== '--version')) {
  throw new Error('Usage: node wire/hs/check-git.mjs [--tag <tag-or-sha> --version <version>]');
}
const version = args[3] ?? '0.1.0';
const revision = args[1] ?? '9f45a2e0e9dc576db34237e5ad3aaaa0266a276b';
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version) || !/^(?:v[0-9]+\.[0-9]+\.[0-9]+|[a-f0-9]{40})$/.test(revision)) {
  throw new Error('Expected an exact release version and a release tag or full commit SHA.');
}
const directory = scratch('haskell-git');
try {
  const fixture = version === '0.1.0' ? 'test/consumer-010'
    : version === '0.2.0' ? 'test/consumer-020' : 'test/consumer';
  cpSync(join(source, fixture), join(directory, 'consumer'), { recursive: true });
  const consumerManifest = join(directory, 'consumer/bitwire-consumer.cabal');
  writeFileSync(consumerManifest, readFileSync(consumerManifest, 'utf8').replace(/bitspark-bitwire == [0-9.]+/, `bitspark-bitwire == ${version}`));
  writeFileSync(join(directory, 'cabal.project'), readFileSync(join(source, 'test/git-consumer.project'), 'utf8').replace(/  tag: .*/, `  tag: ${revision}`));
  const cabalDirectory = join(directory, 'cabal');
  mkdirSync(cabalDirectory);
  const config = join(cabalDirectory, 'config');
  writeFileSync(config, 'repository hackage.haskell.org\n  url: https://hackage.haskell.org/\n  secure: True\n');

  // Do not inherit repository credentials, Git URL rewrites, or a Cabal store
  // that could make an unavailable public dependency appear installable.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !/^(?:GIT_|GH_TOKEN$|GITHUB_TOKEN$|CABAL_)/i.test(name)));
  Object.assign(env, {
    CABAL_DIR: cabalDirectory,
    CABAL_CONFIG: config,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'credential.helper',
    GIT_CONFIG_VALUE_0: '',
    GIT_TERMINAL_PROMPT: '0',
  });
  const run = args => execFileSync('cabal', args, { cwd: directory, env, stdio: 'inherit' });
  run(['update']);
  run(['run', 'bitwire-consumer', '--project-file=cabal.project']);
  const plan = JSON.parse(readFileSync(join(directory, 'dist-newstyle/cache/plan.json'), 'utf8'));
  const library = plan['install-plan'].filter(pkg => pkg['pkg-name'] === 'bitspark-bitwire');
  assert.ok(library.length > 0, 'The consumer must build Bitwire.');
  assert.ok(library.every(pkg => pkg['pkg-version'] === version), `The consumer must resolve Bitwire ${version}.`);
  console.log(`Haskell public Git consumer passed: release ${version}, fresh Cabal store, no local library override or Git credentials.`);
} finally {
  cleanup(directory);
}

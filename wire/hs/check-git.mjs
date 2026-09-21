// Verify the documented release dependency, independently of the local library.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, scratch } from '../../scripts/release-lib.mjs';

const source = fileURLToPath(new URL('./', import.meta.url));
const directory = scratch('haskell-git');
try {
  cpSync(join(source, 'test/consumer'), join(directory, 'consumer'), { recursive: true });
  cpSync(join(source, 'test/git-consumer.project'), join(directory, 'cabal.project'));
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
  assert.ok(library.every(pkg => pkg['pkg-version'] === '0.1.0'), 'The consumer must resolve Bitwire 0.1.0.');
  console.log('Haskell public Git consumer passed: release 0.1.0, fresh Cabal store, no local library override or Git credentials.');
} finally {
  cleanup(directory);
}

// Read-only verification of immutable public source releases. No publish operation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, scratch } from './release-lib.mjs';

const [operation, tag, expectedSha, language] = process.argv.slice(2);
const match = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(tag ?? '');
assert.ok(match, 'Expected a stable release tag such as v0.2.0.');
const version = match[1];
const repository = 'Bitspark/bitwire';
const url = `https://github.com/${repository}.git`;

if (operation === 'resolve') {
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  const api = path => JSON.parse(execFileSync('gh', ['api', `repos/${repository}${path ? `/${path}` : ''}`], { encoding: 'utf8' }));
  const repo = api('');
  assert.equal(repo.private, false, 'Source consumers require a public repository.');
  const release = api(`releases/tags/${tag}`);
  assert.ok(release.tag_name === tag && release.immutable === true && release.published_at
    && !release.draft && !release.prerelease, 'Expected a published immutable stable release.');
  let object = api(`git/ref/tags/${tag}`).object;
  for (let depth = 0; object.type === 'tag' && depth < 5; depth += 1) {
    object = api(`git/tags/${object.sha}`).object;
  }
  assert.ok(object.type === 'commit' && /^[a-f0-9]{40}$/.test(object.sha), 'Release must resolve to a commit.');
  assert.ok(process.env.GITHUB_OUTPUT, 'Missing workflow output file.');
  appendFileSync(process.env.GITHUB_OUTPUT, `sha=${object.sha}\nversion=${version}\n`);
  console.log(`Immutable public release ${tag}: ${object.sha}`);
} else if (operation === 'verify') {
  assert.match(expectedSha ?? '', /^[a-f0-9]{40}$/);
  assert.ok(['swift', 'cpp', 'haskell'].includes(language));
  const directory = scratch(`source-${language}`);
  try {
    // The verification fetches and package managers receive neither credentials
    // nor inherited Git configuration, a netrc file, or a populated user cache.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
      !/^(?:GIT_|GH_|GITHUB_TOKEN$|CABAL_|SWIFTPM_|SSH_|CMAKE_PREFIX_PATH$|CMAKE_TOOLCHAIN_FILE$|CPATH$|CPLUS_INCLUDE_PATH$)/i.test(name)));
    const home = join(directory, 'home');
    mkdirSync(home);
    Object.assign(env, {
      HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache'),
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'credential.helper', GIT_CONFIG_VALUE_0: '', GIT_TERMINAL_PROMPT: '0',
    });
    const run = (command, args, cwd = directory) => execFileSync(command, args, { cwd, env, stdio: 'inherit' });
    const output = (command, args, cwd = directory) => execFileSync(command, args, { cwd, env, encoding: 'utf8' }).trim();
    const source = join(directory, 'source');
    run('git', ['clone', '--depth', '1', '--branch', tag, '--single-branch', url, source]);
    assert.equal(output('git', ['rev-parse', 'HEAD'], source), expectedSha, 'Anonymous tag checkout must match immutable preflight commit.');
    assert.equal(JSON.parse(readFileSync(join(source, 'wire/ts/package.json'), 'utf8')).version, version);

    if (language === 'swift') {
      const consumer = join(directory, 'consumer');
      cpSync(join(source, 'wire/swift/consumer'), consumer, { recursive: true });
      writeFileSync(join(consumer, 'Package.swift'), `// swift-tools-version: 6.0\nimport PackageDescription\nlet package = Package(name: "BitwireConsumer", platforms: [.macOS(.v13)], products: [], dependencies: [.package(url: "${url}", exact: "${version}")], targets: [.executableTarget(name: "Smoke", dependencies: [.product(name: "Bitwire", package: "bitwire")])], swiftLanguageModes: [.v6])\n`);
      run('swift', ['run', '--package-path', consumer, '--jobs', '2', 'Smoke']);
      const resolved = JSON.parse(readFileSync(join(consumer, 'Package.resolved'), 'utf8'));
      const pin = resolved.pins.find(item => item.identity === 'bitwire');
      assert.equal(pin?.location, url);
      assert.equal(pin?.state.version, version);
      assert.equal(pin?.state.revision, expectedSha, 'SwiftPM must resolve the exact immutable release commit.');
    } else if (language === 'cpp') {
      const cmake = readFileSync(join(source, 'CMakeLists.txt'), 'utf8');
      assert.equal(/project\(Bitwire VERSION ([0-9.]+)/.exec(cmake)?.[1], version);
      const build = join(directory, 'build');
      run('cmake', ['-S', source, '-B', build, '-DCMAKE_BUILD_TYPE=Release']);
      run('cmake', ['--build', build, '--config', 'Release']);
      // Existing CTest package check installs headers/config, copies the consumer
      // out of the source tree and configures it using only that install prefix.
      run('ctest', ['--test-dir', build, '-C', 'Release', '--output-on-failure']);
    } else {
      const cabal = readFileSync(join(source, 'wire/hs/bitspark-bitwire.cabal'), 'utf8');
      assert.equal(/^version:\s*(\S+)\s*$/m.exec(cabal)?.[1], version);
      run(process.execPath, [join(source, 'wire/hs/check-git.mjs'), '--tag', expectedSha, '--version', version], source);
    }
    console.log(`Verified anonymous ${language} source consumer: ${tag}, ${expectedSha}.`);
  } finally {
    cleanup(directory);
  }
} else {
  throw new Error('Usage: node scripts/verify-source.mjs resolve <tag> | verify <tag> <sha> <swift|cpp|haskell>');
}

// Verify the actual crate archive with a consumer outside this checkout.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--allow-dirty')) {
  throw new Error('Usage: node wire/rs/check-package.mjs [--allow-dirty]');
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const metadata = JSON.parse(execFileSync('cargo', [
  'metadata', '--format-version', '1', '--no-deps', '--locked',
], { cwd: root, encoding: 'utf8' }));
const version = metadata.packages.find(pkg => pkg.name === 'bitspark-bitwire')?.version;
if (!version) throw new Error('Missing bitspark-bitwire workspace package.');

// mkdtemp supplies a fresh absolute directory; cleanup targets only that directory.
const temporary = mkdtempSync(join(tmpdir(), 'bitwire-rust-package-'));
function run(command, parameters, cwd = root) {
  execFileSync(command, parameters, { cwd, stdio: 'inherit' });
}
try {
  const target = join(temporary, 'target');
  run('cargo', [
    'package', '--locked', '-p', 'bitspark-bitwire', '--target-dir', target, ...args,
  ]);
  const source = join(temporary, 'source');
  mkdirSync(source);
  run('tar', ['-xzf', join(target, 'package', `bitspark-bitwire-${version}.crate`), '-C', source]);

  const consumer = join(temporary, 'consumer');
  mkdirSync(join(consumer, 'src'), { recursive: true });
  writeFileSync(join(consumer, 'Cargo.toml'), [
    '[package]',
    'name = "bitwire-packaged-consumer"',
    'version = "0.0.0"',
    'edition = "2024"',
    'publish = false',
    '',
    '[dependencies]',
    `bitwire = { package = "bitspark-bitwire", path = "../source/bitspark-bitwire-${version}" }`,
    '',
  ].join('\n'));
  cpSync(join(source, `bitspark-bitwire-${version}`, 'examples', 'consumer.rs'), join(consumer, 'src', 'main.rs'));
  run('cargo', ['run', '--offline', '--target-dir', target], consumer);
  console.log(`Rust package ${version}: independent consumer passed using the extracted crate.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

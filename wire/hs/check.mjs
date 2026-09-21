import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--artifact-dir')) {
  throw new Error('Usage: node wire/hs/check.mjs [--artifact-dir <empty-directory>]');
}

const tempParent = realpathSync(tmpdir());
let checkout = source;
for (let directory = source; ; directory = dirname(directory)) {
  if (existsSync(join(directory, '.git'))) {
    checkout = directory;
    break;
  }
  if (dirname(directory) === directory) break;
}
const tempFromCheckout = relative(realpathSync(checkout), tempParent);
if (tempFromCheckout === '' || (tempFromCheckout !== '..'
  && !tempFromCheckout.startsWith(`..${sep}`) && !isAbsolute(tempFromCheckout))) {
  throw new Error('The system temporary directory must be outside the source checkout.');
}
const tempPrefix = 'bitwire-haskell-check-';
const scratch = mkdtempSync(join(tempParent, tempPrefix));
const retainedArtifactDir = args.length === 2 ? resolve(args[1]) : undefined;

function run(command, commandArgs, cwd) {
  execFileSync(command, commandArgs, { cwd, stdio: 'inherit' });
}

function cleanScratch() {
  // Only remove the exact temporary directory created above. In particular,
  // never recursively remove an externally supplied artifact destination.
  const target = realpathSync(scratch);
  if (dirname(target) !== tempParent || !basename(target).startsWith(tempPrefix)) {
    throw new Error(`Refusing to clean unexpected Haskell check directory: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
}

try {
  const manifest = readFileSync(join(source, 'bitspark-bitwire.cabal'), 'utf8');
  const packageName = /^name:\s*([a-z0-9-]+)\s*$/m.exec(manifest)?.[1];
  const version = /^version:\s*([0-9]+(?:\.[0-9]+)*)\s*$/m.exec(manifest)?.[1];
  if (packageName !== 'bitspark-bitwire' || !version) {
    throw new Error('Cannot determine the Haskell source package name and version.');
  }
  const packageId = `${packageName}-${version}`;
  const artifactDir = retainedArtifactDir ?? join(scratch, 'artifact');
  mkdirSync(artifactDir, { recursive: true });
  if (readdirSync(artifactDir).length !== 0) {
    throw new Error(`Haskell artifact destination must be empty: ${artifactDir}`);
  }

  run('cabal', ['check'], source);
  run('cabal', ['build', 'all', '--enable-tests'], source);
  run('cabal', ['test', 'all'], source);
  run('cabal', ['sdist', `--output-directory=${artifactDir}`], source);

  const archive = join(artifactDir, `${packageId}.tar.gz`);
  if (!existsSync(archive) || readdirSync(artifactDir).length !== 1) {
    throw new Error(`Expected exactly one source artifact: ${archive}`);
  }
  const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .trim().split(/\r?\n/);
  for (const entry of entries) {
    const normalized = posix.normalize(entry);
    if (entry.includes('\\') || entry.includes(':') || posix.isAbsolute(entry)
      || entry.split('/').includes('..')
      || (normalized !== packageId && !normalized.startsWith(`${packageId}/`))) {
      throw new Error(`Unexpected source artifact member: ${entry}`);
    }
  }

  const extracted = join(scratch, 'package');
  mkdirSync(extracted);
  run('tar', ['-xzf', archive, '-C', extracted], scratch);
  cpSync(join(extracted, packageId, 'test', 'consumer'), join(scratch, 'consumer'), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  writeFileSync(join(scratch, 'cabal.project'), [
    `packages: package/${packageId} consumer`,
    '',
  ].join('\n'));
  run('cabal', ['run', 'bitwire-consumer', '--project-file=cabal.project'], scratch);

  console.log('Haskell checks passed: package metadata, build, values, and a standalone source-artifact consumer.');
  if (retainedArtifactDir) console.log(`Validated source artifact retained at ${archive}`);
} finally {
  cleanScratch();
}

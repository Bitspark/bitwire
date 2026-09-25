import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}

const compiler = join(root, 'node_modules/typescript/bin/tsc');
if (!existsSync(compiler)) {
  throw new Error('Install the pinned compiler with pnpm install --frozen-lockfile.');
}

run(process.execPath, ['scripts/links.mjs']);
run(process.execPath, ['scripts/independence.mjs']);
run(process.execPath, ['--test', 'scripts/registry-readiness.test.mjs', 'scripts/publish-extra.test.mjs', 'scripts/conformance-results.test.mjs', 'scripts/independence.test.mjs']);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  cwd: root, encoding: 'utf8',
}).split('\0').filter(path => path.endsWith('.go'));
const unformatted = execFileSync('gofmt', ['-l', ...files], { cwd: root, encoding: 'utf8' }).trim();
if (unformatted) throw new Error(`Run gofmt on:\n${unformatted}`);
run('go', ['vet', './...']);
run('go', ['test', './...']);
run(process.execPath, [compiler, '-p', 'wire/ts/tsconfig.check.json']);
run(process.execPath, [compiler, '-p', 'wire/ts/tsconfig.build.json']);
run(process.execPath, ['scripts/composition.mjs']);
console.log('Core checks passed: documentation, Go and TypeScript declarations.');
console.log('Runtime conformance and native package installation are separate CI gates.');

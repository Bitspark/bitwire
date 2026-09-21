import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const npmRegistry = 'https://registry.npmjs.org';
export const moduleName = 'github.com/Bitspark/bitwire';
export const packageDir = join(root, 'wire/ts');
export const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
export const version = manifest.version;

export function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
}

export function output(command, args, options = {}) {
  return run(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }).trim();
}

// Resolve the CLI rather than invoking npm.cmd through a shell on Windows.
export function npm(args, options = {}) {
  if (process.platform !== 'win32') return run('npm', args, options);
  for (const directory of [dirname(process.execPath), ...(process.env.PATH ?? '').split(delimiter)]) {
    const candidate = join(directory, 'node_modules/npm/bin/npm-cli.js');
    if (existsSync(candidate)) return run(process.execPath, [candidate, ...args], options);
  }
  throw new Error('Cannot locate npm/bin/npm-cli.js; install Node.js with npm.');
}

export function npmJSON(args, options = {}) {
  return JSON.parse(npm(args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }));
}

export function scratch(prefix) {
  const directory = mkdtempSync(join(tmpdir(), `bitwire-${prefix}-`));
  if (realpathSync(directory).startsWith(realpathSync(root) + sep)) throw new Error('Consumer must be outside the checkout.');
  return directory;
}

export function cleanup(directory) {
  const target = resolve(directory);
  const base = resolve(tmpdir());
  if (!target.startsWith(base + sep) || !target.slice(base.length + 1).startsWith('bitwire-')) {
    throw new Error(`Refusing to remove unexpected scratch directory: ${target}`);
  }
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export function writeJSON(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

export function checkTag(tag) {
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag ?? '')) throw new Error('Expected a version tag such as v0.1.0.');
  if (tag !== `v${version}`) throw new Error(`Tag ${tag} disagrees with npm version ${version}.`);
}

export async function publicJSON(url, absentOK = false, headers = {}) {
  const response = await fetch(url, { headers: { 'User-Agent': 'bitwire-release (github.com/Bitspark/bitwire)', ...headers }, signal: AbortSignal.timeout(30000) });
  if (absentOK && response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

// npm installs use a separately cached abbreviated packument. A visible version
// endpoint alone does not establish that the install metadata has propagated.
export async function npmInstallReady(name, requiredVersion, readJSON = publicJSON) {
  const metadata = await readJSON(`${npmRegistry}/${name.replace('/', '%2f')}`, true, {
    Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
  });
  if (!metadata) return false;
  if (!metadata.versions || typeof metadata.versions !== 'object') throw new Error('npm install metadata has no versions map.');
  const release = metadata.versions[requiredVersion];
  if (!release) return false;
  if (release.name !== name || release.version !== requiredVersion || !release.dist?.tarball || !release.dist?.integrity) {
    throw new Error(`npm install metadata is invalid for ${name}@${requiredVersion}.`);
  }
  return true;
}

export function pack(directory) {
  mkdirSync(directory, { recursive: true });
  const [artifact] = npmJSON(['pack', '--json', '--ignore-scripts', '--pack-destination', directory], { cwd: packageDir });
  for (const path of ['package.json', 'dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE', 'NOTICE']) {
    if (!artifact.files.some(file => file.path === path)) throw new Error(`npm package omits ${path}.`);
  }
  if (artifact.files.some(file => /(?:^|\/)(?:node_modules|\.env|\.git)(?:\/|$)/.test(file.path))) {
    throw new Error('npm package contains private or workspace state.');
  }
  if (artifact.name !== manifest.name || artifact.version !== version) throw new Error('Packed identity differs from the manifest.');
  return { ...artifact, path: join(directory, artifact.filename) };
}

export function checkNpmConsumer(directory, dependency) {
  mkdirSync(directory, { recursive: true });
  const compilerVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).devDependencies.typescript;
  writeJSON(join(directory, 'package.json'), { name: 'bitwire-package-consumer', private: true, type: 'module', dependencies: { [manifest.name]: dependency }, devDependencies: { typescript: compilerVersion } });
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry', npmRegistry, `--@bitspark:registry=${npmRegistry}`], { cwd: directory });
  const installed = join(directory, 'node_modules/@bitspark/bitwire');
  if (!realpathSync(installed).startsWith(realpathSync(directory) + sep)) throw new Error('Consumer resolved a checkout link.');
  const actual = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  if (actual.version !== version) throw new Error(`Consumer installed ${actual.version}, expected ${version}.`);
  writeJSON(join(directory, 'tsconfig.json'), { compilerOptions: { target: 'ES2022', module: 'NodeNext', strict: true, skipLibCheck: false, outDir: 'dist' }, include: ['index.ts'] });
  writeFileSync(join(directory, 'index.ts'), `import type { Wire, Path, Message, Receiver, ProfileFrame, ProfileKind, ProfileError, ReturnAddress } from '@bitspark/bitwire';
const frame: ProfileFrame = { version: 1, kind: 'event', data: null };
const path: Path = ['example', ''];
const message: Message = { frame };
const receiver: Receiver = { message: (_path, _message) => {} };
const kind: ProfileKind = frame.kind;
const error: ProfileError = { code: 'example', message: 'example' };
function consume(wire: Wire): ReturnAddress { const detach = wire.receive(path, receiver); wire.send(path, message); detach(); wire.close(); return { wire }; }
void [kind, error, consume];
await import('@bitspark/bitwire');
console.log('Installed Bitwire declarations and runtime entry point loaded.');
`);
  run(process.execPath, [join(directory, 'node_modules/typescript/bin/tsc'), '-p', join(directory, 'tsconfig.json')], { cwd: directory });
  run(process.execPath, ['dist/index.js'], { cwd: directory });
}

export function checkGoConsumer(directory, requiredVersion, environment = {}) {
  mkdirSync(directory, { recursive: true });
  const goVersion = readFileSync(join(root, 'go.mod'), 'utf8').match(/^go\s+(\S+)/m)?.[1];
  writeFileSync(join(directory, 'go.mod'), `module example.com/bitwire-consumer\n\ngo ${goVersion}\n\nrequire ${moduleName} ${requiredVersion}\n`);
  writeFileSync(join(directory, 'main.go'), `package main
import (
  "fmt"
  wire "github.com/Bitspark/bitwire/wire/go"
)
func main() {
  frame := wire.ProfileFrame{Version: 1, Kind: wire.ProfileEvent}
  message := wire.Message{Frame: frame}
  receiver := wire.Receiver{Message: func(path []string, message wire.Message) {}}
  var endpoint wire.Wire
  _ = wire.ReturnAddress{Wire: endpoint}
  _ = wire.ProfileError{Code: "example", Message: "example"}
  _ = wire.Code(0)
  fmt.Println("Installed Bitwire Go declarations loaded.", message.Frame.Version, receiver.Namespace)
}
`);
  const env = { ...process.env, GOENV: 'off', GOWORK: 'off', GOPRIVATE: '', GONOPROXY: 'none', GONOSUMDB: 'none', GOFLAGS: '-modcacherw', GOMODCACHE: join(directory, 'module-cache'), ...environment };
  run('go', ['mod', 'download', moduleName], { cwd: directory, env });
  run('go', ['run', '-mod=readonly', '.'], { cwd: directory, env });
  const resolved = JSON.parse(output('go', ['list', '-m', '-json', moduleName], { cwd: directory, env }));
  if (resolved.Replace || resolved.Version !== requiredVersion) throw new Error('Go consumer did not resolve the exact packaged module.');
}

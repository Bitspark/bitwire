// Swift compilation and a consumer outside the checkout. This verifies the
// source-package boundary, not behavior of an endpoint implementation.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const binding = dirname(fileURLToPath(import.meta.url));
const root = resolve(binding, '../..');
const scratch = mkdtempSync(join(tmpdir(), 'bitwire-swift-'));

function swift(args) {
  const result = spawnSync('swift', args, { cwd: scratch, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`swift ${args[0]} failed (${result.status})`);
}

try {
  swift(['--version']);
  const packaged = join(scratch, 'bitwire');
  mkdirSync(join(packaged, 'wire/swift'), { recursive: true });
  cpSync(join(root, 'Package.swift'), join(packaged, 'Package.swift'));
  for (const name of ['LICENSE', 'NOTICE', 'README.md']) {
    cpSync(join(root, name), join(packaged, name));
  }
  for (const name of ['Sources', 'Tests', 'LICENSE', 'NOTICE', 'README.md']) {
    cpSync(join(binding, name), join(packaged, 'wire/swift', name), { recursive: true });
  }
  swift(['test', '--package-path', packaged, '--jobs', '2']);
  const consumer = join(scratch, 'consumer');
  cpSync(join(binding, 'consumer'), consumer, { recursive: true });
  swift(['run', '--package-path', consumer, '--jobs', '2', 'Smoke']);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

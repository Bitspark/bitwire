import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nightseamDependencies } from './independence-lib.mjs';

const check = (files) => nightseamDependencies(Object.keys(files), path => files[path]);

test('a dependency or an import in any published package language fails', () => {
  const files = {
    'go.mod': 'module github.com/Bitspark/bitwire\n\nrequire github.com/Bitspark/nightseam v0.6.0\n',
    'wire/ts/package.json': '{ "dependencies": { "@nightseam/duplex": "0.6.0" } }',
    'wire/go/wire.go': 'import "github.com/Bitspark/nightseam/duplex/go"\n',
    'wire/ts/src/index.ts': "import { pipe } from '@nightseam/duplex';\n",
    'wire/py/src/bitwire/carrier.py': 'from nightseam.duplex import wire\n',
    'wire/rs/src/carrier.rs': 'use nightseam_duplex::Pipe;\n',
    'wire/swift/Sources/Bitwire/Carrier.swift': 'import NightseamDuplex\n',
    'wire/cpp/include/bitwire/carrier.hpp': '#include <nightseam/duplex.hpp>\n',
    'wire/java/src/main/java/dev/bitspark/bitwire/Carrier.java': 'import dev.bitspark.nightseam.duplex.Pipe;\n',
    'wire/hs/src/Carrier.hs': 'import qualified Nightseam.Duplex as D\n',
    'transport/go/ws/go.mod': 'require github.com/Bitspark/nightseam v0.6.0\n',
  };
  assert.deepEqual(check(files).map(({ path }) => path), Object.keys(files));
  assert.deepEqual(check(files)[0], { path: 'go.mod', line: 3, text: 'require github.com/Bitspark/nightseam v0.6.0' });
});

test('prose, attribution and test-only evidence may name Nightseam', () => {
  const files = {
    'wire/go/wire.go': '// Frames follow the nightseam.duplex/1 profile.\n',
    'wire/rs/src/profile.rs': '/// Adapted from Nightseam at commit 1c63f1c4.\n',
    'wire/java/src/main/java/dev/bitspark/bitwire/package-info.java': ' * the nightseam.duplex/1 profile\n',
    'wire/ts/NOTICE': 'Portions adapted from Nightseam.\n',
    'wire/go/README.md': 'Nightseam implements endpoints.\n',
    'conformance/current/go/go.mod': 'require github.com/Bitspark/nightseam v0.6.0\n',
    'scripts/conformance.mjs': "const source = 'https://github.com/Bitspark/nightseam';\n",
  };
  assert.deepEqual(check(files), []);
});

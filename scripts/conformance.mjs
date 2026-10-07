import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['--test', 'conformance/contract.test.mjs', 'conformance/hydrated-codec.test.mjs'], { stdio: 'inherit' });

import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, ['--test', 'conformance/contract.test.mjs'], { stdio: 'inherit' });

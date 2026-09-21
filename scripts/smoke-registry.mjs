import { join } from 'node:path';
import { checkGoConsumer, checkNpmConsumer, checkTag, cleanup, manifest, npmInstallReady, npmRegistry, publicJSON, scratch, version } from './release-lib.mjs';

const tag = process.argv[2];
checkTag(tag);
const deadline = Date.now() + 30 * 60 * 1000;
const npmURL = `${npmRegistry}/${encodeURIComponent(manifest.name)}/${version}`;
const goURL = `https://proxy.golang.org/github.com/!bitspark/bitwire/@v/${tag}.info`;
while (true) {
  const states = await Promise.all([publicJSON(npmURL, true), npmInstallReady(manifest.name, version), publicJSON(goURL, true)]);
  if (states.every(Boolean)) break;
  const status = `npm version=${!!states[0]}, npm install metadata=${!!states[1]}, Go=${!!states[2]}`;
  if (Date.now() >= deadline) throw new Error(`Registry propagation timed out: ${status}`);
  console.log(`Waiting for ${tag}: ${status}`);
  await new Promise(resolve => setTimeout(resolve, 30000));
}
const directory = scratch('registry');
try {
  checkNpmConsumer(join(directory, 'npm-consumer'), version);
  checkGoConsumer(join(directory, 'go-consumer'), tag, { GOPROXY: 'https://proxy.golang.org', GOSUMDB: 'sum.golang.org' });
  console.log(`${tag}: public npm and Go installations passed without checkout replacements.`);
} finally {
  cleanup(directory);
}

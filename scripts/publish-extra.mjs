// Shared gates for optional registry publication. This script never publishes.
import { appendFileSync, readFileSync } from 'node:fs';

const [operation, language, tag] = process.argv.slice(2);
if (!['python', 'haskell'].includes(language)) throw new Error('Choose python or haskell.');
const match = /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(tag ?? '');
if (!match) throw new Error('Use an existing stable release tag, such as v0.1.0.');
const version = match[1];

if (operation === 'resolve') {
  const repository = process.env.GITHUB_REPOSITORY;
  if (repository !== 'Bitspark/bitwire') throw new Error('Registry publication belongs to Bitspark/bitwire.');
  async function get(path) {
    const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
        ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
      },
    });
    if (!response.ok) throw new Error(`Release preflight failed: GitHub HTTP ${response.status}.`);
    return response.json();
  }
  const repo = await get('');
  if (repo.private !== false || repo.visibility !== 'public') throw new Error('Publish the repository before registry artifacts.');
  const release = await get(`releases/tags/${encodeURIComponent(tag)}`);
  if (release.tag_name !== tag || release.draft || release.prerelease || !release.published_at || release.immutable !== true) {
    throw new Error('The tag must have an existing published, immutable, stable GitHub release.');
  }
  let object = (await get(`git/ref/tags/${encodeURIComponent(tag)}`)).object;
  for (let depth = 0; object.type === 'tag' && depth < 5; depth += 1) {
    object = (await get(`git/tags/${object.sha}`)).object;
  }
  if (object.type !== 'commit' || !/^[a-f0-9]{40}$/.test(object.sha)) throw new Error('The release tag must resolve to a commit.');
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing GitHub Actions output file.');
  appendFileSync(process.env.GITHUB_OUTPUT, `sha=${object.sha}\nversion=${version}\n`);
  console.log(`Verified immutable public release ${tag} at ${object.sha}.`);
} else if (operation === 'verify') {
  const file = language === 'python' ? 'wire/py/pyproject.toml' : 'wire/hs/bitspark-bitwire.cabal';
  const source = readFileSync(file, 'utf8');
  const expected = language === 'python'
    ? /^version\s*=\s*"([^"]+)"\s*$/m.exec(source.split('[project]')[1]?.split('\n[')[0] ?? '')?.[1]
    : /^version:\s*(\S+)\s*$/m.exec(source)?.[1];
  if (expected !== version) throw new Error(`${file} must declare version ${version}; found ${expected ?? 'none'}.`);
  console.log(`${language} manifest matches ${tag}.`);
} else {
  throw new Error('Choose resolve or verify.');
}

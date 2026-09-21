import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkGoConsumer, checkNpmConsumer, cleanup, moduleName, output, pack, root, run, scratch, version, writeJSON } from './release-lib.mjs';

const directory = scratch('packed');
try {
  const artifact = pack(join(directory, 'npm'));
  checkNpmConsumer(join(directory, 'npm-consumer'), artifact.path);

  // A file module proxy exercises the actual Go distribution shape without a
  // temporary public tag, a replace directive, or the developer's module cache.
  const revision = output('git', ['rev-parse', '--short=12', 'HEAD']);
  const rehearsalVersion = `v${version}${version.includes('-') ? '.' : '-'}rehearsal.${revision}`;
  const proxy = join(directory, 'proxy');
  const escapedModule = moduleName.replace(/[A-Z]/g, letter => `!${letter.toLowerCase()}`);
  const versions = join(proxy, escapedModule, '@v');
  mkdirSync(versions, { recursive: true });
  const files = output('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(file => file === 'go.mod' || file === 'LICENSE' || file === 'NOTICE' || /^wire\/go\/[^/]+\.go$/.test(file));
  const fileList = join(directory, 'files.json');
  writeJSON(fileList, files);
  const helper = join(directory, 'package.go');
  writeFileSync(helper, `package main
import ("archive/zip"; "encoding/json"; "os"; "path/filepath")
func main() {
  data, err := os.ReadFile(os.Args[3]); if err != nil { panic(err) }
  var files []string; if err = json.Unmarshal(data, &files); err != nil { panic(err) }
  file, err := os.Create(os.Args[1]); if err != nil { panic(err) }
  archive := zip.NewWriter(file)
  for _, path := range files {
    data, err = os.ReadFile(filepath.Join(os.Args[2], filepath.FromSlash(path))); if err != nil { panic(err) }
    entry, err := archive.Create(os.Args[4] + "/" + path); if err != nil { panic(err) }
    if _, err = entry.Write(data); err != nil { panic(err) }
  }
  if err = archive.Close(); err != nil { panic(err) }; if err = file.Close(); err != nil { panic(err) }
}
`);
  run('go', ['run', helper, join(versions, `${rehearsalVersion}.zip`), root, fileList, `${moduleName}@${rehearsalVersion}`]);
  writeFileSync(join(versions, `${rehearsalVersion}.mod`), readFileSync(join(root, 'go.mod')));
  writeJSON(join(versions, `${rehearsalVersion}.info`), { Version: rehearsalVersion, Time: output('git', ['show', '-s', '--format=%cI', 'HEAD']) });
  writeFileSync(join(versions, 'list'), rehearsalVersion + '\n');
  checkGoConsumer(join(directory, 'go-consumer'), rehearsalVersion, { GOPROXY: pathToFileURL(proxy).href, GOSUMDB: 'off' });
  console.log(`Packed npm and Go consumers passed outside the checkout (${artifact.integrity}).`);
} finally {
  cleanup(directory);
}

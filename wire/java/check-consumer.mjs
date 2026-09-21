import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Package first with `mvn -B -f wire/java/pom.xml verify`. This check resolves
// only the resulting JAR/POM into a fresh repository, outside the checkout.
const root = fileURLToPath(new URL('.', import.meta.url));
const version = readFileSync(join(root, 'pom.xml'), 'utf8').match(/<version>([^<]+)<\/version>/)[1];
const temporaryRoot = realpathSync(tmpdir());
const taskDirectory = mkdtempSync(join(temporaryRoot, 'bitwire-java-consumer-'));
const localRepository = join(taskDirectory, 'repository');
const consumer = join(taskDirectory, 'consumer');
const command = process.env.MAVEN_CMD || (process.platform === 'win32' ? 'mvn.cmd' : 'mvn');

function maven(args, cwd) {
  const fullArgs = ['-B', '-ntp', `-Dmaven.repo.local=${localRepository}`, ...args];
  if (process.platform === 'win32') {
    // cmd scripts need a shell; quote arguments and refuse shell expansion so
    // even a checkout or temporary directory containing spaces stays one value.
    const quote = value => {
      if (/["%\r\n]/.test(value)) throw new Error('Unsupported character in Maven invocation path.');
      return `"${value}"`;
    };
    execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/v:off', '/s', '/c', `"${[command, ...fullArgs].map(quote).join(' ')}"`],
      { cwd, stdio: 'inherit', windowsVerbatimArguments: true });
  } else {
    execFileSync(command, fullArgs, { cwd, stdio: 'inherit' });
  }
}

try {
  cpSync(join(root, 'examples/consumer'), consumer, { recursive: true });
  maven(['org.apache.maven.plugins:maven-install-plugin:3.1.4:install-file',
    `-Dfile=${join(root, 'target', `bitwire-${version}.jar`)}`, `-DpomFile=${join(root, 'pom.xml')}`], taskDirectory);
  maven([`-Dbitwire.version=${version}`, 'package'], consumer);
  const artifact = join(localRepository, 'com/bitspark/bitwire', version, `bitwire-${version}.jar`);
  execFileSync('java', ['-cp', [join(consumer, 'target/classes'), artifact].join(delimiter), 'example.Consumer'],
    { cwd: consumer, stdio: 'inherit' });
} finally {
  if (dirname(resolve(taskDirectory)) !== temporaryRoot) {
    throw new Error('Refusing to remove a consumer directory outside the temporary root.');
  }
  rmSync(taskDirectory, { recursive: true, force: true });
}

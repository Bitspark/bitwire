// Decisions 0007 and 0010: using Bitwire never requires Nightseam, and the
// contract never depends on bitruntime, the repository that implements it.
// Published packages may name either in prose or attribution, but may not
// depend on them or import them.

// Test-only evidence about implementations, and the documentation and tooling around it.
const outside = ['.github/', 'conformance/', 'docs/', 'examples/', 'poster/', 'research-docs/', 'scripts/'];

// A dependency manifest or lock file may not mention either at all.
const manifest = /(^|\/)(go\.(mod|sum)|package\.json|Cargo\.(toml|lock)|pyproject\.toml|Package\.(swift|resolved)|CMakeLists\.txt|[^/]+\.cmake|pom\.xml|[^/]+\.cabal)$/;
const named = /nightseam|bitruntime/i;

// A source file may not import either, in any language with a Bitwire package.
const imports = [
  [/\.go$/, /"github\.com\/Bitspark\/(nightseam|bitruntime)[/"]/i],
  [/\.[cm]?[jt]s$/, /(\bfrom|\bimport|\brequire\s*\()\s*\(?\s*['"](@nightseam\/|@bitspark\/bitruntime)/],
  [/\.py$/, /^\s*(from|import)\s+(nightseam|bitruntime)\b/],
  [/\.rs$/, /\b(nightseam|bitruntime)\w*::|\bextern\s+crate\s+(nightseam|bitruntime)/],
  [/\.swift$/, /^\s*(@testable\s+)?import\s+(Nightseam|BitRuntime|Bitruntime)/],
  [/\.(h|hh|hpp|c|cc|cpp|cxx)$/, /#\s*include\s*[<"](nightseam|bitruntime)/i],
  [/\.java$/, /^\s*import\s+(static\s+)?[\w.]*\b(nightseam|bitruntime)\b[\w.*]*\s*;/],
  [/\.hs$/, /^\s*import\s+(qualified\s+)?(Nightseam|BitRuntime|Bitruntime)/],
];

export function forbiddenDependencies(files, read) {
  const found = [];
  for (const path of files) {
    if (outside.some(prefix => path.startsWith(prefix))) continue;
    const pattern = manifest.test(path) ? named : imports.find(([file]) => file.test(path))?.[1];
    if (!pattern) continue;
    for (const [index, text] of read(path).split('\n').entries()) {
      if (pattern.test(text)) found.push({ path, line: index + 1, text: text.trim() });
    }
  }
  return found;
}

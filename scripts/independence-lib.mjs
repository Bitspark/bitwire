// Decision 0007: using Bitwire never requires Nightseam. Published packages may
// name Nightseam in prose or attribution, but may not depend on it or import it.

// Test-only evidence about Nightseam, and the documentation and tooling around it.
const outside = ['.github/', 'conformance/', 'docs/', 'examples/', 'poster/', 'research-docs/', 'scripts/'];

// A dependency manifest or lock file may not mention Nightseam at all.
const manifest = /(^|\/)(go\.(mod|sum)|package\.json|Cargo\.(toml|lock)|pyproject\.toml|Package\.(swift|resolved)|CMakeLists\.txt|[^/]+\.cmake|pom\.xml|[^/]+\.cabal)$/;

// A source file may not import it, in any language with a Bitwire package.
const imports = [
  [/\.go$/, /"github\.com\/Bitspark\/nightseam[/"]/i],
  [/\.[cm]?[jt]s$/, /(\bfrom|\bimport|\brequire\s*\()\s*\(?\s*['"]@nightseam\//],
  [/\.py$/, /^\s*(from|import)\s+nightseam\b/],
  [/\.rs$/, /\bnightseam\w*::|\bextern\s+crate\s+nightseam/],
  [/\.swift$/, /^\s*(@testable\s+)?import\s+Nightseam/],
  [/\.(h|hh|hpp|c|cc|cpp|cxx)$/, /#\s*include\s*[<"]nightseam/i],
  [/\.java$/, /^\s*import\s+(static\s+)?[\w.]*\bnightseam\b[\w.*]*\s*;/],
  [/\.hs$/, /^\s*import\s+(qualified\s+)?Nightseam/],
];

export function nightseamDependencies(files, read) {
  const found = [];
  for (const path of files) {
    if (outside.some(prefix => path.startsWith(prefix))) continue;
    const pattern = manifest.test(path) ? /nightseam/i : imports.find(([file]) => file.test(path))?.[1];
    if (!pattern) continue;
    for (const [index, text] of read(path).split('\n').entries()) {
      if (pattern.test(text)) found.push({ path, line: index + 1, text: text.trim() });
    }
  }
  return found;
}

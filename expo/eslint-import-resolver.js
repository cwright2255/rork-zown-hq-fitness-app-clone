// Tells eslint-plugin-import where an import points (see eslint.config.js).
//
// The app's own files are looked up on disk: "@/lib/x" means <this folder>/lib/x, and "./x" and "../x" are relative to the
// file that imports them. A package name such as "react" or "expo-router" is taken as present, because installing the
// dependencies puts it there, and checking it would make the result depend on what happens to be installed.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// Same order of guesses as babel.config.js and Metro: the name as written first, then with each extension.
const EXTENSIONS = ['', '.js', '.jsx', '.json', '.ios.js', '.android.js', '.native.js', '.web.js'];

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolveBase(base) {
  for (const ext of EXTENSIONS) if (isFile(base + ext)) return base + ext;
  for (const ext of EXTENSIONS.slice(1)) if (isFile(path.join(base, `index${ext}`))) return path.join(base, `index${ext}`);
  return null;
}

module.exports = {
  // eslint-plugin-import's second resolver interface: resolve(source, importerFile) -> { found, path }
  interfaceVersion: 2,
  resolve(source, file) {
    let base;
    if (source.startsWith('@/')) base = path.join(ROOT, source.slice(2));
    else if (source.startsWith('.')) base = path.resolve(path.dirname(file), source);
    else return { found: true, path: null };
    const hit = resolveBase(base);
    return hit ? { found: true, path: hit } : { found: false };
  },
};

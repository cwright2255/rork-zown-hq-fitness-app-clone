// A screen or store that imports a file which is not there crashes the first time that screen is opened, and the
// tests only find out if one of them happens to load it. This reads every file the app is made of and checks that each
// local import (./x, ../x, @/x) points at a real file. It is what makes it safe to delete a file: if something still
// imports it, this fails and names the importer.
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_DIRS = ['app', 'components', 'constants', 'data', 'hooks', 'lib', 'services', 'src', 'store', 'types', 'utils'];
const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '.ios.js', '.android.js', '.native.js', '.web.js', '.ios.jsx', '.android.jsx', '.ios.ts', '.android.ts', '.ios.tsx', '.android.tsx'];
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g;

// Imports that were already broken before this check existed and that nothing loads. Delete a line when its file is fixed.
const KNOWN_BROKEN = [];

const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function resolves(base) {
  if (EXTENSIONS.some((ext) => isFile(base + ext))) return true;
  return isDir(base) && EXTENSIONS.slice(1).some((ext) => isFile(path.join(base, `index${ext}`)));
}

function sourceFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (isDir(full)) sourceFiles(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Every local import under `root` that points at nothing, as "path/of/importer: ./specifier". */
function unresolvedImports(root, dirs = APP_DIRS) {
  const missing = [];
  for (const dir of dirs) {
    if (!isDir(path.join(root, dir))) continue;
    for (const file of sourceFiles(path.join(root, dir))) {
      const code = fs.readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' ')) // /* ... */ comments, keeping the lines
        .split('\n').map((line) => (/^\s*\/\//.test(line) ? '' : line)).join('\n'); // whole-line // comments
      for (const [, , spec] of code.matchAll(IMPORT)) {
        let base = null;
        if (spec.startsWith('./') || spec.startsWith('../')) base = path.resolve(path.dirname(file), spec);
        else if (spec.startsWith('@/')) base = path.join(root, spec.slice(2));
        else if (spec.includes('/') && dirs.includes(spec.split('/')[0])) base = path.join(root, spec); // babel's root alias
        if (base && !resolves(base)) missing.push(`${path.relative(root, file).split(path.sep).join('/')}: ${spec}`);
      }
    }
  }
  return missing;
}

describe('the checker', () => {
  let root;
  const write = (rel, text = 'export default 1;\n') => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'imports-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('finds nothing wrong when every import points at a file', () => {
    write('lib/a.js'); write('lib/b.jsx'); write('lib/data.json', '{}'); write('lib/pic.png', 'x');
    write('lib/folder/index.js'); write('lib/native.ios.js'); write('store/s.ts');
    write('app/screen.jsx', [
      "import a from '../lib/a';", "import b from '@/lib/b';", "import d from '../lib/data.json';",
      "import pic from '../lib/pic.png';", "import f from '../lib/folder';", "import n from '../lib/native';",
      "import s from 'store/s';", "import React from 'react';", "import X from '@expo/vector-icons';",
      "const c = require('../lib/a');", "const lazy = () => import('../lib/b');", "export { default as A } from '../lib/a';",
    ].join('\n'));
    expect(unresolvedImports(root)).toEqual([]);
  });

  it('names the file and the import for each one that points at nothing', () => {
    write('lib/a.js');
    write('app/screen.jsx', [
      "import a from '../lib/a';", "import gone from '../components/Gone';", "import alias from '@/store/gone';",
      "import root from 'services/gone';", "const c = require('./nope');", "const lazy = () => import('../lib/later');",
      "export { default as Z } from '../lib/zzz';", "import '../lib/side-effect';",
    ].join('\n'));
    expect(unresolvedImports(root).sort()).toEqual([
      'app/screen.jsx: ../components/Gone', 'app/screen.jsx: ../lib/later', 'app/screen.jsx: ../lib/side-effect',
      'app/screen.jsx: ../lib/zzz', 'app/screen.jsx: ./nope', 'app/screen.jsx: @/store/gone', 'app/screen.jsx: services/gone',
    ]);
  });

  it('catches a file that was deleted while something still imports it', () => {
    write('components/Card.jsx'); write('app/home.jsx', "import Card from '../components/Card';\n");
    expect(unresolvedImports(root)).toEqual([]);
    fs.unlinkSync(path.join(root, 'components', 'Card.jsx'));
    expect(unresolvedImports(root)).toEqual(['app/home.jsx: ../components/Card']);
  });

  it('ignores imports in comments and packages from node_modules', () => {
    write('app/screen.jsx', [
      "// import old from '../lib/old';", "/* import older from '../lib/older';", "   import oldest from '../lib/oldest'; */",
      "import React from 'react';", "import { x } from 'react-native/Libraries/Foo';",
    ].join('\n'));
    write('lib/node_modules/pkg/index.js', "import z from './nothing';\n");
    expect(unresolvedImports(root)).toEqual([]);
  });

  it('looks only in the directories it is given', () => {
    write('scripts/tool.js', "import z from './nothing';\n");
    expect(unresolvedImports(root)).toEqual([]);
    expect(unresolvedImports(root, ['scripts'])).toEqual(['scripts/tool.js: ./nothing']);
  });
});

describe('the app', () => {
  it('has no import that points at a missing file', () => {
    const root = path.join(__dirname, '..');
    const missing = unresolvedImports(root).filter((entry) => !KNOWN_BROKEN.includes(entry));
    expect(missing).toEqual([]);
  });

  it('does not list a known-broken import that is no longer broken', () => {
    const still = unresolvedImports(path.join(__dirname, '..'));
    for (const entry of KNOWN_BROKEN) expect(still).toContain(entry);
  });
});

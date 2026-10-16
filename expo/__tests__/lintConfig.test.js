// `npm run lint` (ESLint, run by the Tests workflow on GitHub) reads every file in the app and reports mistakes that
// would otherwise only show up when someone opens that screen. A check like that is only worth having if it keeps
// working: if someone declares every name as known to quiet it, or an update changes what a rule does, it would keep
// printing "all clear" and catch nothing. So this feeds the real eslint.config.js small pieces of good and bad code
// and checks that it says what it should, and checks that the pieces it is wired from are still there.
//
// The whole app being clean is not checked here, because the workflow does it (npm run lint). This is about the checker.
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const expoDir = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(expoDir, 'package.json'), 'utf8'));
const config = require('../eslint.config.js');
const resolver = require('../eslint-import-resolver.js');

const linter = new Linter({ configType: 'flat', cwd: expoDir });

/** The rules that complain about `code` when it sits in `file` (a path inside this folder), in the order reported. */
function problems(code, file = 'app/probe.jsx') {
  return linter.verify(code, config, { filename: path.join(expoDir, file) }).map((m) => m.ruleId || `PARSE ERROR: ${m.message}`);
}

const SCREEN = (body, imports = '') => [
  "import React, { useState } from 'react';",
  "import { View, Text } from 'react-native';",
  imports,
  'export default function Probe({ items }) {',
  body,
  '}',
].join('\n');

describe('the lint setup', () => {
  it('is a script, with the tools it needs listed as dev dependencies', () => {
    expect(pkg.scripts.lint).toBe('eslint . --max-warnings 0');
    for (const name of ['eslint', '@eslint/js', 'eslint-plugin-react', 'eslint-plugin-react-hooks', 'eslint-plugin-import', 'globals']) {
      expect(pkg.devDependencies[name]).toBeTruthy();
    }
    // The React and import plugins do not work with ESLint 10 yet, so stay on 9 until they do.
    expect(pkg.devDependencies.eslint).toMatch(/^\^9\./);
    expect(pkg.devDependencies['@eslint/js']).toMatch(/^\^9\./);
  });

  it('does not leave out any folder the app is made of', () => {
    const ignored = config.filter((entry) => entry.ignores && !entry.files).flatMap((entry) => entry.ignores);
    for (const dir of ['app', 'components', 'services', 'store', 'lib', 'hooks', 'utils', 'src', 'constants', 'data', '__tests__', 'functions/src']) {
      expect(ignored.filter((pattern) => pattern === dir || pattern.startsWith(`${dir}/`))).toEqual([]);
    }
  });

  it('names only files that still exist where it allows browser-only and node-only things', () => {
    const block = config.find((entry) => entry.languageOptions && entry.languageOptions.globals && 'document' in entry.languageOptions.globals);
    expect(block.files.length).toBeGreaterThan(0);
    for (const file of block.files) expect(fs.existsSync(path.join(expoDir, file))).toBe(true);
  });

  it('checks its own configuration files too', () => {
    for (const file of ['eslint.config.js', 'eslint-import-resolver.js']) {
      expect(problems(fs.readFileSync(path.join(expoDir, file), 'utf8'), file)).toEqual([]);
    }
  });
});

describe('what it lets through', () => {
  it('ordinary screen code', () => {
    const code = SCREEN(
      '  const [n] = useState(0);\n  return <View>{items.length > 0 && <Text>{formatDistance(n)}</Text>}</View>;',
      "import { formatDistance } from '@/lib/distanceUnits';",
    );
    expect(problems(code)).toEqual([]);
  });

  it('the things the phone has: __DEV__, fetch, window, timers', () => {
    expect(problems('export const a = [__DEV__, typeof fetch, window, setTimeout, new URL("https://x.test"), new AbortController()];')).toEqual([]);
  });

  it('jest in the tests and node in the build files', () => {
    expect(problems("describe('x', () => { it('y', () => { expect(jest.fn()).toBeDefined(); }); });", '__tests__/probe.test.js')).toEqual([]);
    expect(problems("const fs = require('fs'); module.exports = { dir: __dirname, fs };", 'metro.config.js')).toEqual([]);
  });

  it('tidiness it leaves to a person: unused names, empty catch blocks, odd escapes', () => {
    const code = [
      "import unusedThing from 'somewhere-in-node-modules';",
      'export function f(obj, kind) {',
      '  const unused = 1;',
      '  try { obj.go(); } catch (e) {}',
      '  switch (kind) { case 1: const inCase = 2; break; default: break; }',
      "  return obj.hasOwnProperty('x') && /\\-/.test(kind);",
      '}',
    ].join('\n');
    expect(problems(code)).toEqual([]);
  });

  it('a "// eslint-disable" comment for a rule that is not switched on', () => {
    expect(problems('// eslint-disable-next-line global-require\nexport const a = require("x");')).toEqual([]);
  });

  it('browser-only things in the few files that check for them first', () => {
    expect(problems('export const a = typeof Buffer !== "undefined" ? Buffer.from("x") : null;', 'lib/meshCache.js')).toEqual([]);
    expect(problems('export const t = () => { document.title = "x"; };', 'components/RunningMap.jsx')).toEqual([]);
  });
});

describe('what it reports', () => {
  it('a name that is used and never defined', () => {
    expect(problems('export const total = () => itemz.length + 1;')).toEqual(['no-undef']);
    expect(problems(SCREEN('  return <Text>{typo}</Text>;'))).toEqual(['no-undef']);
  });

  it('a component that is used and never imported', () => {
    expect(problems(SCREEN('  return <View><Unknown /></View>;'))).toEqual(['react/jsx-no-undef']);
  });

  it('a browser-only or node-only thing in a file that is not one of the few allowed', () => {
    expect(problems('export const t = () => { document.title = "x"; };')).toEqual(['no-undef']);
    expect(problems('export const b = Buffer.from("x");')).toEqual(['no-undef']);
    expect(problems('describe("x", () => {});')).toEqual(['no-undef']);
  });

  it('a hook called where hooks may not be called', () => {
    expect(problems(SCREEN('  if (items) {\n    const [x] = useState(0);\n  }\n  return <View />;'))).toEqual(['react-hooks/rules-of-hooks']);
  });

  it('an import of something the file does not export, from a .js file and from a .jsx file', () => {
    expect(problems("import { nothingHere } from '@/lib/runStats';\nexport const a = nothingHere;")).toEqual(['import/named']);
    expect(problems("import { nope } from '@/components/StreakCalendar';\nexport const a = nope;")).toEqual(['import/named']);
    expect(problems("import runStats from '@/lib/runStats';\nexport const a = runStats;")).toEqual(['import/default']);
    expect(problems("import * as runStats from '@/lib/runStats';\nexport const a = runStats.nothingHere;")).toEqual(['import/namespace']);
  });

  it('an import that points at no file, written with @/ or as a relative path', () => {
    expect(problems("import x from '@/lib/doesNotExist';\nexport const a = x;")).toEqual(['import/no-unresolved']);
    expect(problems("import x from '../lib/doesNotExist';\nexport const a = x;")).toEqual(['import/no-unresolved']);
    expect(problems("import x from './nowhere';\nexport const a = x;")).toEqual(['import/no-unresolved']);
    expect(problems("const x = require('@/lib/doesNotExist');\nexport const a = x;")).toEqual(['import/no-unresolved']);
  });

  it('a name used before the line that creates it, and ===/throw that cannot be what was meant', () => {
    expect(problems('const a = b;\nconst b = 1;\nexport default a;')).toEqual(['no-use-before-define']);
    expect(problems('export const f = (x) => x === x;')).toEqual(['no-self-compare']);
    expect(problems('export function f() { throw "failed"; }')).toEqual(['no-throw-literal']);
    // calling a function that is written further down is fine
    expect(problems('export const run = () => helper();\nfunction helper() { return 1; }')).toEqual([]);
  });

  it('a prop called children, and changing this.state directly', () => {
    expect(problems(SCREEN('  return <View children="x" />;'))).toEqual(['react/no-children-prop']);
    expect(problems("import React from 'react';\nexport class A extends React.Component {\n  go() { this.state.n = 1; }\n  render() { return null; }\n}")).toEqual(['react/no-direct-mutation-state']);
  });

  it('{list.length && <X />}, which shows a bare 0 for an empty list and makes React Native throw', () => {
    expect(problems(SCREEN('  return <View>{items.length && <Text>rows</Text>}</View>;'))).toEqual(['no-restricted-syntax']);
  });

  it('text that was meant as a comment inside JSX', () => {
    expect(problems(SCREEN('  return <View><Text>// shown on the screen</Text></View>;'))).toEqual(['react/jsx-no-comment-textnodes']);
  });

  it('the same prop twice, and a map that forgets to return', () => {
    expect(problems(SCREEN('  return <View style={1} style={2} />;'))).toEqual(['react/jsx-no-duplicate-props']);
    expect(problems('export const ids = (list) => list.map((i) => { i.id; });')).toEqual(['array-callback-return']);
  });

  it('a key written twice in one object, and code after a return', () => {
    expect(problems('export const s = { a: 1, a: 2 };')).toEqual(['no-dupe-keys']);
    expect(problems('export function f() { return 1; console.log(2); }')).toEqual(['no-unreachable']);
  });

  it('a file it cannot read, instead of skipping it', () => {
    expect(problems('export const = ;')[0]).toMatch(/^PARSE ERROR/);
  });
});

describe('the import resolver', () => {
  const importer = path.join(expoDir, 'app', 'profile', 'help.jsx');

  it('finds the app\'s own files by @/ and by relative path, with or without the extension', () => {
    expect(resolver.resolve('@/lib/runStats', importer)).toEqual({ found: true, path: path.join(expoDir, 'lib', 'runStats.js') });
    expect(resolver.resolve('@/components/StreakCalendar', importer)).toEqual({ found: true, path: path.join(expoDir, 'components', 'StreakCalendar.jsx') });
    expect(resolver.resolve('../../lib/runStats.js', importer)).toEqual({ found: true, path: path.join(expoDir, 'lib', 'runStats.js') });
    expect(resolver.resolve('./help', path.join(expoDir, 'app', 'profile', 'streak.jsx'))).toEqual({ found: true, path: importer });
  });

  it('finds a folder by its index file', () => {
    expect(resolver.resolve('@/components/ui-kit', importer)).toEqual({ found: true, path: path.join(expoDir, 'components', 'ui-kit', 'index.js') });
  });

  it('says a file is missing when it is', () => {
    expect(resolver.resolve('@/lib/doesNotExist', importer)).toEqual({ found: false });
    expect(resolver.resolve('./nowhere', importer)).toEqual({ found: false });
  });

  it('takes a package as present without looking for it, including @scoped ones, which are not "@/"', () => {
    for (const name of ['react', 'react-native', 'expo-router', '@expo/vector-icons', 'firebase/functions']) {
      expect(resolver.resolve(name, importer)).toEqual({ found: true, path: null });
    }
  });
});

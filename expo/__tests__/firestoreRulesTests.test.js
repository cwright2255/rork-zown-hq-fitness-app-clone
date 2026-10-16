// expo/firestore.rules decides who can read and write what in the database, and nothing else checks it: the app's own tests
// never read that file. expo/rules-tests runs the real rules in the Firestore emulator and tries reads and writes as different
// people (npm run test:rules, and the "Firestore rules" job on GitHub). Those tests cannot run here, in the normal suite,
// because there is no emulator, so this checks what can be checked without one: that every rule has a test, that the tests are
// written so a mistake cannot make them pass without checking anything, and that the pieces that run them are all in place.
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const expoDir = path.join(__dirname, '..');
const rulesDir = path.join(expoDir, 'rules-tests');
const read = (...parts) => fs.readFileSync(path.join(expoDir, ...parts), 'utf8');
const { PROJECT_ID, RULES_FILE } = require('../rules-tests/config');

const rulesText = read('firestore.rules');
const pkg = JSON.parse(read('package.json'));
const testFiles = fs.readdirSync(rulesDir).filter((name) => name.endsWith('.test.js')).sort();
const testSources = Object.fromEntries(testFiles.map((name) => [name, fs.readFileSync(path.join(rulesDir, name), 'utf8')]));

/** "/users/{userId}/devices/{deviceId}" -> "/users/{}/devices/{}": the variable names do not matter. */
const normalise = (rulePath) => rulePath.replace(/\{[^}]*\}/g, '{}');

/** Every path a `match` in a rules file covers, written out in full, without the /databases/{database}/documents start. */
function rulePaths(text) {
  const code = text.replace(/\/\/.*$/gm, '');
  const token = /match\s+(\S+)\s*\{|function\s+\w+\s*\([^)]*\)\s*\{|service\s+[\w.]+\s*\{|\}/g;
  const open = [];
  const paths = [];
  let m;
  while ((m = token.exec(code))) {
    if (m[0] === '}') { open.pop(); continue; }
    open.push(m[1] || '');
    const full = open.join('').replace('/databases/{database}/documents', '');
    if (m[1] && full) paths.push(normalise(full));
  }
  return paths;
}

/** Every rule path written out as a string in the tests, such as the name of a describe: '/users/{userId}'. */
function pathsInTests(sources) {
  const found = new Set();
  const literal = /(['"`])(\/[A-Za-z][A-Za-z0-9/{}]*)\1/g;
  for (const source of sources) {
    let m;
    while ((m = literal.exec(source))) found.add(normalise(m[2]));
  }
  return found;
}

/** Calls of ok(...) / no(...) in a test file that are not awaited: the test would pass without waiting for the answer. */
function unawaited(source) {
  const bad = [];
  const call = /(?<![\w.$])(ok|no)\(/g;
  let m;
  while ((m = call.exec(source))) {
    if (!/(await|return)\s$/.test(source.slice(Math.max(0, m.index - 7), m.index))) {
      bad.push(`line ${source.slice(0, m.index).split('\n').length}`);
    }
  }
  return bad;
}

describe('every rule has a test', () => {
  const inRules = rulePaths(rulesText);
  const tested = pathsInTests(Object.values(testSources));

  it('reads the paths out of a rules file, including folders inside folders and rules inside functions', () => {
    const sample = [
      "rules_version = '2';",
      'service cloud.firestore {',
      '  match /databases/{database}/documents {',
      '    // match /commented/{out} { }',
      '    match /users/{userId} {',
      '      allow read: if request.auth.uid == userId;',
      '      match /devices/{deviceId} { allow read: if true; }',
      '      match /stats/{docId} { allow write: if false; }',
      '    }',
      '    match /raceEntries/{entryId} {',
      '      function valid() { return request.auth != null; }',
      '      allow create: if valid();',
      '    }',
      '    match /leaderboard/{uid} { allow read: if true; }',
      '  }',
      '}',
    ].join('\n');
    expect(rulePaths(sample)).toEqual(['/users/{}', '/users/{}/devices/{}', '/users/{}/stats/{}', '/raceEntries/{}', '/leaderboard/{}']);
  });

  it('finds the paths of the real rules', () => {
    expect(inRules.length).toBeGreaterThan(25);
    for (const p of ['/users/{}', '/users/{}/devices/{}', '/communityPosts/{}/comments/{}', '/conversations/{}/messages/{}', '/raceEntries/{}', '/duels/{}']) {
      expect(inRules).toContain(p);
    }
    expect(new Set(inRules).size).toBe(inRules.length);
  });

  it('has a describe, in expo/rules-tests, named for each path (add one when you add a rule)', () => {
    expect(inRules.filter((p) => !tested.has(p))).toEqual([]);
  });

  it('names no path the rules do not have (a typo, or a rule that was removed)', () => {
    const known = new Set(inRules);
    expect([...tested].filter((p) => p.includes('{}') && !known.has(p))).toEqual([]);
  });

  it('notices a path that has no test, and one that has no rule', () => {
    const tests = pathsInTests(["describe('/users/{userId}', () => {});", "describe('/userz/{userId}', () => {});"]);
    expect(tests.has('/users/{}')).toBe(true);
    expect(tests.has('/userz/{}')).toBe(true);
    expect(tests.has('/duels/{}')).toBe(false);
  });
});

describe('the tests are written so they check something', () => {
  it('is several files, each loading the rules through rulesEnv()', () => {
    expect(testFiles.length).toBeGreaterThanOrEqual(5);
    for (const [name, source] of Object.entries(testSources)) expect([name, source.includes('= rulesEnv();')]).toEqual([name, true]);
  });

  it('awaits every ok(...) and no(...): without await, a test passes before the answer comes back', () => {
    const problems = Object.entries(testSources).flatMap(([name, source]) => unawaited(source).map((where) => `${name} ${where}`));
    expect(problems).toEqual([]);
  });

  it('notices a call that is not awaited', () => {
    expect(unawaited('await ok(doc.get());\nawait no(doc.set({}));\nreturn no(x);')).toEqual([]);
    expect(unawaited('await ok(doc.get());\nno(doc.set({}));')).toEqual(['line 2']);
    expect(unawaited('const x = ok(doc.get());')).toEqual(['line 1']);
    expect(unawaited('const { ok, no } = require("./helpers");\nrulesEnv.ok(1);')).toEqual([]);
  });

  it('tries both sides: something allowed and something refused, in every file', () => {
    for (const [name, source] of Object.entries(testSources)) {
      expect([name, /await no\(/.test(source)]).toEqual([name, true]);
      // The file about paths that have no rule has nothing that is allowed to try.
      if (name !== 'default-deny.test.js') expect([name, /await ok\(/.test(source)]).toEqual([name, true]);
    }
  });
});

describe('the pieces that run them', () => {
  it('load the rules file the app is deployed with, which firebase.json names', () => {
    expect(RULES_FILE).toBe(path.join(expoDir, 'firestore.rules'));
    expect(fs.existsSync(RULES_FILE)).toBe(true);
    const firebaseJson = JSON.parse(read('firebase.json'));
    expect(firebaseJson.firestore.rules).toBe('firestore.rules');
    expect(firebaseJson.emulators.firestore.port).toBeGreaterThan(0);
    expect(read('rules-tests', 'helpers.js')).toMatch(/readFileSync\(RULES_FILE/);
  });

  it('are started by npm run test:rules, for the same project the tests use, with the settings of their own', () => {
    const script = pkg.scripts['test:rules'];
    expect(script).toMatch(/\bfirebase emulators:exec\b/);
    expect(script).toMatch(/--only firestore\b/);
    expect(script).toContain(`--project ${PROJECT_ID}`);
    expect(PROJECT_ID).toMatch(/^demo-/); // a demo- project never touches a real one
    expect(script).toMatch(/jest --config jest\.rules\.config\.js\b/);
    expect(script).toMatch(/--runInBand/);
  });

  it('are left out of the normal jest run, which has no emulator', () => {
    const main = require('../jest.config.js');
    const aRulesTest = path.join(rulesDir, testFiles[0]);
    expect(main.testPathIgnorePatterns.some((pattern) => new RegExp(pattern).test(aRulesTest))).toBe(true);
  });

  it('are the only thing the rules jest config runs, in plain node, one file at a time', () => {
    const config = require('../jest.rules.config.js');
    expect(config.testEnvironment).toBe('node');
    expect(config.roots).toEqual(['<rootDir>/rules-tests']);
    expect(config.testMatch).toEqual(['<rootDir>/rules-tests/**/*.test.js']);
    expect(config.maxWorkers).toBe(1);
    // None of the app's own set-up, which replaces Firebase with stand-ins.
    expect(config.preset).toBeUndefined();
    expect(config.setupFiles).toBeUndefined();
    expect(config.setupFilesAfterEnv).toBeUndefined();
    expect(config.globalSetup).toBeUndefined();
  });

  it('use a rules-testing library that goes with the firebase version, and the lockfile has it', () => {
    // @firebase/rules-unit-testing 5 needs firebase 12, 6 needs firebase 13 (and Node 24). Update this when firebase moves.
    const wanted = { 11: 4, 12: 5, 13: 6 };
    const major = (range) => Number(/\d+/.exec(range)[0]);
    expect(wanted[major(pkg.dependencies.firebase)]).toBe(major(pkg.devDependencies['@firebase/rules-unit-testing']));
    expect(read('bun.lock')).toContain('"@firebase/rules-unit-testing"');
  });

  it('keep the emulator\'s log files out of git', () => {
    const ignored = read('.gitignore');
    for (const name of ['firebase-debug.log', 'firestore-debug.log', 'ui-debug.log']) expect(ignored).toContain(name);
  });

  it('are checked by ESLint like the rest of the code, with jest\'s names known', () => {
    const linter = new Linter({ configType: 'flat', cwd: expoDir });
    const code = "const { rulesEnv, ok, no } = require('./helpers');\nconst env = rulesEnv();\ndescribe('x', () => { it('y', async () => { await ok(env.anon().doc('a/b').get()); expect(1).toBe(1); }); });";
    const found = linter.verify(code, require('../eslint.config.js'), { filename: path.join(rulesDir, 'probe.test.js') });
    expect(found.map((m) => m.ruleId || m.message)).toEqual([]);
  });
});

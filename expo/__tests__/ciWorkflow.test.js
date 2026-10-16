// .github/workflows/tests.yml runs this very suite on every pull request, and on every push to main by way of
// .github/workflows/expo-publish.yml, which publishes only if it passes. If someone edits either so that tests no longer
// install from the lockfile, run the wrong folder, quietly stop running jest, or stop gating the publish, nothing would
// say so: a workflow that never fails looks the same as a workflow that tests nothing. This keeps the important lines in place.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const expoDir = path.join(__dirname, '..');
const workflowsDir = path.join(expoDir, '..', '.github', 'workflows');
const workflow = fs.readFileSync(path.join(workflowsDir, 'tests.yml'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(expoDir, 'package.json'), 'utf8'));
const withoutComments = (text) => text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
const active = withoutComments(workflow);

const OTHER_LOCKFILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json'];

/**
 * The lockfiles in `dir` that a fresh checkout would contain besides bun.lock. A file that git ignores does not count: this
 * folder's .gitignore leaves out package-lock.json, so any machine where someone ran `npm install` has one, and the
 * workflow never sees it. Where git cannot say (a download with no .git folder), every file that is there counts.
 */
function strayLockfiles(dir) {
  try {
    const tracked = execFileSync('git', ['ls-files', '--', ...OTHER_LOCKFILES], {
      cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).split('\n').filter(Boolean);
    return OTHER_LOCKFILES.filter((name) => tracked.includes(name));
  } catch {
    return OTHER_LOCKFILES.filter((name) => fs.existsSync(path.join(dir, name)));
  }
}

describe('the tests workflow', () => {
  it('runs on pull requests, by hand, and when another workflow calls it, but not on a push of its own', () => {
    const triggers = active.slice(active.search(/^on:/m), active.search(/^concurrency:/m));
    expect(triggers).toMatch(/^on:\n\s+pull_request:/m);
    expect(triggers).toMatch(/^\s+workflow_dispatch:/m);
    expect(triggers).toMatch(/^\s+workflow_call:/m);
    // Expo Publish calls this workflow on every push to main. A push trigger here would run everything twice.
    expect(triggers).not.toMatch(/^\s+push:/m);
  });

  it('works in the expo folder, where package.json and jest.config.js are', () => {
    expect(active).toMatch(/working-directory: expo\b/);
    expect(fs.existsSync(path.join(expoDir, 'jest.config.js'))).toBe(true);
  });

  it('installs exactly what the lockfile says, and the repo has that lockfile and no other', () => {
    expect(active).toMatch(/run: bun install --frozen-lockfile/);
    expect(fs.existsSync(path.join(expoDir, 'bun.lock'))).toBe(true);
    expect(strayLockfiles(expoDir)).toEqual([]);
  });

  it('runs jest, the same command as npm test', () => {
    expect(pkg.scripts.test).toBe('jest');
    expect(active).toMatch(/run: npx jest --ci\b/);
  });

  it('checks the code with ESLint after installing and before the tests, and still runs the tests when the check fails', () => {
    expect(pkg.scripts.lint).toBe('eslint . --max-warnings 0');
    const installAt = active.indexOf('run: bun install --frozen-lockfile');
    const lintAt = active.indexOf('run: npm run lint');
    const jestAt = active.indexOf('run: npx jest --ci');
    expect(installAt).toBeGreaterThan(-1);
    expect(lintAt).toBeGreaterThan(installAt);
    expect(jestAt).toBeGreaterThan(lintAt);
    // The step that runs the tests, from its "- name:" line on, must not be skipped because the check before it failed.
    const testsStep = active.slice(active.lastIndexOf('- name:', jestAt));
    expect(testsStep).toMatch(/if: \$\{\{ !cancelled\(\) \}\}/);
  });

  it('cannot be left running forever, and can only read the repository', () => {
    expect(active).toMatch(/timeout-minutes: \d+/);
    expect(active).toMatch(/permissions:\n\s+contents: read/);
  });

  it('needs no secrets, so it can run on pull requests from anyone', () => {
    expect(active).not.toMatch(/\$\{\{\s*secrets\./);
    expect(active).not.toMatch(/\bEXPO_TOKEN\b/);
  });
});

describe('the Firestore rules job', () => {
  // From the "rules:" job to the end of the file (it is the last job).
  const job = active.slice(active.search(/^ {2}rules:\n/m));
  const step = (text) => job.slice(job.indexOf(text));

  it('exists, as a job of its own, so a problem with the emulator does not hide the lint and test results', () => {
    expect(active).toMatch(/^jobs:\n\s+checks:/m);
    expect(active).toMatch(/^ {2}rules:\n\s+name: Firestore rules/m);
    expect(active.indexOf('\n  rules:')).toBeGreaterThan(active.indexOf('\n  checks:'));
  });

  it('works in the expo folder, cannot be left running forever, and needs no secrets', () => {
    expect(job).toMatch(/working-directory: expo\b/);
    expect(job).toMatch(/timeout-minutes: \d+/);
    expect(job).not.toMatch(/\$\{\{\s*secrets\./);
  });

  it('installs from the lockfile, then sets up Java, which the emulator needs, and a pinned Firebase CLI', () => {
    const installAt = job.indexOf('run: bun install --frozen-lockfile');
    const javaAt = job.indexOf('uses: actions/setup-java@v4');
    const cliAt = job.search(/run: npm install --global firebase-tools@\d+\.\d+\.\d+\s*$/m);
    expect(installAt).toBeGreaterThan(-1);
    expect(javaAt).toBeGreaterThan(installAt);
    expect(step('uses: actions/setup-java@v4')).toMatch(/java-version: '?(2\d|[3-9]\d)'?/);
    expect(cliAt).toBeGreaterThan(javaAt);
  });

  it('runs npm run test:rules last, the same command as on your own machine', () => {
    const runAt = job.indexOf('run: npm run test:rules');
    expect(runAt).toBeGreaterThan(job.search(/firebase-tools@\d/));
    expect(job.slice(runAt).trim().split('\n')).toHaveLength(1);
    expect(pkg.scripts['test:rules']).toMatch(/emulators:exec/);
  });

  it('is not run by the main job, which has no emulator', () => {
    const checks = active.slice(active.indexOf('\n  checks:'), active.indexOf('\n  rules:'));
    expect(checks).not.toMatch(/test:rules/);
    expect(checks).toMatch(/run: npx jest --ci/);
  });
});

describe('the publish workflow', () => {
  const publishText = fs.readFileSync(path.join(workflowsDir, 'expo-publish.yml'), 'utf8');
  const publish = withoutComments(publishText);
  // The text of one job: from its "  name:" line to the next job, or to the end of the file.
  const job = (name) => {
    const found = publish.match(new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}[\\w-]+:\\n|(?![\\s\\S]))`, 'm'));
    return found ? found[1] : '';
  };

  it('publishes after every push to main', () => {
    expect(publish).toMatch(/^on:\n\s+push:\n\s+branches:\n\s+- main\n/m);
  });

  it('runs the whole Tests workflow first, as a job of its own that is given no secrets', () => {
    expect(job('tests')).toMatch(/^\s+uses: \.\/\.github\/workflows\/tests\.yml\s*$/m);
    expect(job('tests')).not.toMatch(/secrets/);
    expect(job('tests')).not.toMatch(/EXPO_TOKEN/);
    expect(fs.existsSync(path.join(workflowsDir, 'tests.yml'))).toBe(true);
  });

  it('publishes only if those tests passed, and publishes the commit they ran on', () => {
    const publishJob = job('publish');
    expect(publishJob).toMatch(/^\s+needs: (tests|\[tests\])\s*$/m);
    // always(), failure() or !cancelled() would run the publish even though the tests failed.
    expect(publishJob).not.toMatch(/^\s+if:.*(always|failure|cancelled)\(\)/m);
    expect(publishJob).not.toMatch(/^\s+continue-on-error:/m);
    expect(publishJob).not.toMatch(/^\s+ref:/m);
  });

  it('still publishes the update, to the development channel, with the token only the publish job holds', () => {
    expect(job('publish')).toMatch(/run: eas update --channel development\b/);
    expect(job('publish')).toMatch(/EXPO_TOKEN: \$\{\{ secrets\.EXPO_TOKEN \}\}/);
  });

  it('tells you where to look when an update has to be undone', () => {
    expect(publishText).toContain('expo/docs/ROLLBACK.md');
    expect(fs.existsSync(path.join(expoDir, 'docs', 'ROLLBACK.md'))).toBe(true);
  });
});

describe('the lockfile check', () => {
  const hasGit = (() => { try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
  const gitIt = hasGit ? it : it.skip;
  let root;
  const put = (name, text = '{}\n') => fs.writeFileSync(path.join(root, name), text);
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  beforeEach(() => { root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lockfiles-'))); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  gitIt('does not count a lockfile that sits in the folder but is not in the repository', () => {
    git('init', '-q'); put('bun.lock'); git('add', 'bun.lock'); put('package-lock.json');
    expect(strayLockfiles(root)).toEqual([]);
  });

  gitIt('does not count one the .gitignore leaves out, as in this app, where npm install makes package-lock.json', () => {
    git('init', '-q'); put('.gitignore', 'package-lock.json\n'); put('bun.lock'); put('package-lock.json');
    git('add', '.');
    expect(strayLockfiles(root)).toEqual([]);
  });

  gitIt('names every other lockfile the repository does contain', () => {
    git('init', '-q'); put('bun.lock');
    for (const name of ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json']) put(name);
    git('add', '.');
    expect(strayLockfiles(root)).toEqual(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json']);
  });

  gitIt('looks only at this folder, not at the functions folder beside it', () => {
    git('init', '-q'); put('bun.lock'); fs.mkdirSync(path.join(root, 'functions'));
    fs.writeFileSync(path.join(root, 'functions', 'package-lock.json'), '{}\n');
    git('add', '.');
    expect(strayLockfiles(root)).toEqual([]);
  });

  it('counts every lockfile that is there when the folder is not a git checkout', () => {
    const before = process.env.GIT_CEILING_DIRECTORIES;
    process.env.GIT_CEILING_DIRECTORIES = path.dirname(root); // do not let git find a repository further up
    try {
      put('bun.lock'); put('yarn.lock'); put('pnpm-lock.yaml'); put('npm-shrinkwrap.json'); put('package-lock.json');
      expect(strayLockfiles(root)).toEqual(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'npm-shrinkwrap.json']);
    } finally {
      if (before === undefined) delete process.env.GIT_CEILING_DIRECTORIES; else process.env.GIT_CEILING_DIRECTORIES = before;
    }
  });
});

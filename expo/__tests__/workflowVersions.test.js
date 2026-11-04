// The build and test workflows (.github/workflows) must not pick up whatever version of a tool is newest that day. A new release of bun
// or eas-cli can break a build with no change of yours, and nothing in the repo would show why. So bun and eas-cli are pinned to
// one exact version each, the same in every workflow, and moving to a newer one is a change to these files.
// Also held here: the Build and Submit workflow defaults to iOS (eas.json submits only iOS), and the preview workflow no longer
// triggers on the old light-theme branches.
const fs = require('fs');
const path = require('path');

const workflowsDir = path.join(__dirname, '..', '..', '.github', 'workflows');
const EXACT = /^\d+\.\d+\.\d+$/;
const active = (text) => text.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

/** The versions a workflow asks for: { bun: [...], eas: [...] }, as written (so "latest" and "^1" show up as they are). */
function versionsIn(text) {
  const body = active(text);
  return {
    bun: [...body.matchAll(/bun-version:\s*['"]?([^\s'"#]+)['"]?/g)].map((m) => m[1]),
    eas: [
      ...[...body.matchAll(/eas-version:\s*['"]?([^\s'"#]+)['"]?/g)].map((m) => m[1]),
      ...[...body.matchAll(/eas-cli@([^\s'"#]+)/g)].map((m) => m[1]),
    ],
  };
}

/** What is wrong with the way a workflow names its tools, in words. */
function problems(text) {
  const { bun, eas } = versionsIn(text);
  return [
    ...bun.filter((v) => !EXACT.test(v)).map((v) => `bun-version is "${v}", not one exact version`),
    ...eas.filter((v) => !EXACT.test(v)).map((v) => `eas-cli is "${v}", not one exact version`),
  ];
}

describe('the checker', () => {
  it('reads bun and eas-cli versions from the usual places, and ignores comments', () => {
    const text = [
      '# bun-version: latest',
      '        with:',
      '          bun-version: 1.2.3',
      '          eas-version: 16.0.1',
      '        run: npx eas-cli@16.0.1 build --platform ios',
      '        run: npm install -g eas-cli@16.0.1',
    ].join('\n');
    expect(versionsIn(text)).toEqual({ bun: ['1.2.3'], eas: ['16.0.1', '16.0.1', '16.0.1'] });
    expect(problems(text)).toEqual([]);
  });

  it('finds "latest", a range and a half-written version', () => {
    const text = ['bun-version: latest', 'bun-version: ^1.2', 'eas-version: latest', 'run: npx eas-cli@latest build', 'run: npm i -g eas-cli@16'].join('\n');
    expect(problems(text)).toEqual([
      'bun-version is "latest", not one exact version',
      'bun-version is "^1.2", not one exact version',
      'eas-cli is "latest", not one exact version',
      'eas-cli is "latest", not one exact version',
      'eas-cli is "16", not one exact version',
    ]);
  });
});

describe('the workflows', () => {
  const files = fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name)).sort();
  const text = Object.fromEntries(files.map((name) => [name, fs.readFileSync(path.join(workflowsDir, name), 'utf8')]));

  it('are all read (so a new file is held to the same rules)', () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const name of ['tests.yml', 'expo-publish.yml', 'eas-preview.yml', 'eas-build-submit.yml', 'eas-production-build.yml', 'eas-development-build.yml', 'eas-device-build.yml']) {
      expect(files).toContain(name);
    }
  });

  it.each(files)('%s names its tools by exact version', (name) => {
    expect(problems(text[name])).toEqual([]);
  });

  it('use one bun version and one eas-cli version between them, and use each somewhere', () => {
    const all = files.map((name) => versionsIn(text[name]));
    const bun = new Set(all.flatMap((v) => v.bun));
    const eas = new Set(all.flatMap((v) => v.eas));
    expect([...bun]).toHaveLength(1);
    expect([...eas]).toHaveLength(1);
  });

  it('install eas-cli by version wherever a workflow runs it', () => {
    for (const name of files) {
      const body = active(text[name]);
      const runsEas = /\beas-cli@|\beas (build|update|submit)\b/.test(body) || /eas-version:/.test(body);
      if (runsEas) expect(versionsIn(text[name]).eas.length).toBeGreaterThan(0);
    }
  });

  it('has Build and Submit start from iOS, the only platform eas.json submits', () => {
    const body = active(text['eas-build-submit.yml']);
    expect(body).toMatch(/default:\s*ios\b/);
    expect(body).not.toMatch(/default:\s*all\b/);
    const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'eas.json'), 'utf8'));
    expect(Object.keys(eas.submit?.production || {})).toEqual(['ios']);
  });

  it('has the preview workflow trigger on pull requests to main only, not on the old light-theme branches', () => {
    const body = active(text['eas-preview.yml']);
    expect(body).not.toContain('fitleus');
    expect(body).toMatch(/pull_request:\s*\n\s*branches:\s*\n\s*- main\s*\n/);
    expect(body).not.toMatch(/^\s*push:/m);
  });
});

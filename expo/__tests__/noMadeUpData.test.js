// The rule: if the app has no real data, it says "no data", never a plausible number.
//
// Made-up data got into the app in a few ways, and each one is checked for here so it cannot come back unnoticed:
//   - Math.random() standing in for a measurement (a heart rate, a step count, a number of viewers, a GPS position)
//   - a short list of made-up foods, places or notifications shown when the real thing could not be loaded
//   - files that exist only to produce that kind of data and are used by nothing
//   - a health reading written into the screen as text (a heart rate, a blood oxygen level, a health score and the time it was
//     "updated"), which looked like a measurement and was not one
// Math.random() is fine for an id, a React key, a shuffle or a pick of one song, so the places that do that are listed below
// with their reason. A new use anywhere else fails this test: either it is not a measurement, and gets added to the list with
// its reason, or it is, and should not be there.
const fs = require('fs');
const path = require('path');
const { Linter } = require('eslint');

const expoDir = path.join(__dirname, '..');
const SOURCE_DIRS = ['app', 'components', 'constants', 'data', 'hooks', 'lib', 'services', 'src', 'store', 'utils'];

// Where Math.random() is used, how many times, and what for. None of these is a number shown to the person as a measurement.
const RANDOM_ALLOWED = {
  'app/coach.jsx': [1, 'id of a chat message'],
  'app/profile/running-log.jsx': [1, 'React key for a run that has no id'],
  'app/profile/workout-history.jsx': [1, 'React key for a workout that has no id'],
  'store/appleMusicStore.js': [1, 'shuffles the order of songs'],
  'store/spotifyStore.js': [1, 'shuffles the order of tracks'],
  'lib/customFood.js': [1, 'default source of randomness for a new food id'],
  'lib/foodLog.js': [1, 'default source of randomness for a new log id'],
  'lib/mealCopy.js': [1, 'default source of randomness for ids of copied foods'],
  'lib/mealPlan.js': [1, 'default source of randomness for a plan entry id'],
  'lib/scheduleUtils.js': [1, 'id of a scheduled event'],
  'services/authService.js': [1, 'fallback id for a user shape'],
  'services/calorieApiService.js': [1, 'id for a food that came back without one'],
  'services/spotifyService.js': [11, 'sign-in state and code verifier, and picking or shuffling songs to play'],
};

// Names with mock / fake / dummy in them. The shop still has its sample products; it is not part of this change.
const MOCK_NAMES_ALLOWED = {
  'store/shopStore.js': 'sample products for the shop',
  'services/shopifyService.js': 'sample products for the shop',
};

// Files that were deleted because all they did was produce made-up data, and nothing used them.
const DELETED = [
  'services/workoutStreamingService.js', // made-up live streams: random viewers, likes and comments
  'services/smartRestService.js', // made-up heart rate during rest
  'services/locationService.js', // simulated GPS movement and a made-up current location
  'services/mapboxService.js', // a copy of radarService with made-up locations
];

// Words and numbers the Health screen once showed with nothing behind them: a health score "updated today at 9:15 AM", blood oxygen,
// a stress level, a heart rate typed in as "72 bpm", and a canned tip dressed up as the AI's advice. A heart rate that is measured is
// built from the reading, so its number never sits in the same piece of text as "bpm".
const FABRICATED_TEXT = 'Blood Oxygen|Stress Level|Your Health Score|Updated today at|SpO2|\\d\\s*bpm|consider adding a 10-minute stretch';

const RANDOM = 'Math.random() used as a source of numbers';
const MOCK_NAME = 'a name that says it is mock, fake or dummy data';
const FABRICATED = 'a health reading, or a sentence about one, written in as text instead of measured';
const linter = new Linter({ configType: 'flat', cwd: expoDir });
const detector = [{
  files: ['**/*.js', '**/*.jsx'],
  // A "// eslint-disable" comment must not be able to hide a finding.
  linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: {
    'no-restricted-syntax': ['error',
      { selector: "MemberExpression[object.name='Math'][property.name='random']", message: RANDOM },
      { selector: 'Identifier[name=/mock|fake|dummy/i]', message: MOCK_NAME },
      { selector: `Literal[value=/${FABRICATED_TEXT}/i]`, message: FABRICATED },
      { selector: `JSXText[value=/${FABRICATED_TEXT}/i]`, message: FABRICATED },
      { selector: `TemplateElement[value.raw=/${FABRICATED_TEXT}/i]`, message: FABRICATED },
    ],
  },
}];

/** What the detector finds in `code`, as the messages above, in order (comments and strings are not code, so they never count). */
function findings(code, filename = 'probe.js') {
  return linter.verify(code, detector, { filename: path.join(expoDir, filename) }).filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

const scanned = {}; // relative path -> findings
for (const dir of SOURCE_DIRS) {
  if (!fs.existsSync(path.join(expoDir, dir))) continue;
  for (const file of walk(path.join(expoDir, dir))) {
    const found = findings(fs.readFileSync(file, 'utf8'), path.relative(expoDir, file));
    if (found.length > 0) scanned[path.relative(expoDir, file).split(path.sep).join('/')] = found;
  }
}
const countIn = (scan, file, message) => (scan[file] || []).filter((m) => m === message).length;
const count = (file, message) => countIn(scanned, file, message);

/** Files that use Math.random() more often than `allowed` says ({ file: [times, reason] }). */
function overused(scan, allowed) {
  return Object.keys(scan)
    .filter((file) => countIn(scan, file, RANDOM) > (allowed[file] ? allowed[file][0] : 0))
    .map((file) => `${file}: ${countIn(scan, file, RANDOM)} use(s), ${allowed[file] ? allowed[file][0] : 0} allowed`);
}

/** Entries of `allowed` that are out of date: the file uses Math.random() a different number of times than listed. */
function stale(scan, allowed) {
  return Object.entries(allowed)
    .filter(([file, [times]]) => countIn(scan, file, RANDOM) !== times)
    .map(([file, [times]]) => `${file}: lists ${times}, has ${countIn(scan, file, RANDOM)}`);
}

describe('the app does not make up data', () => {
  it('uses Math.random() only where it is listed, as many times as listed', () => {
    expect(overused(scanned, RANDOM_ALLOWED)).toEqual([]);
  });

  it('keeps its list of allowed Math.random() uses exact: a file that no longer uses it is taken off', () => {
    expect(stale(scanned, RANDOM_ALLOWED)).toEqual([]);
  });

  it('has no mock, fake or dummy data outside the shop', () => {
    const files = Object.keys(scanned).filter((file) => scanned[file].includes(MOCK_NAME) && !(file in MOCK_NAMES_ALLOWED));
    expect(files).toEqual([]);
  });

  it('keeps its list of allowed mock names exact', () => {
    expect(Object.keys(MOCK_NAMES_ALLOWED).filter((file) => count(file, MOCK_NAME) === 0)).toEqual([]);
  });

  it('has no health reading written in as text', () => {
    expect(Object.keys(scanned).filter((file) => scanned[file].includes(FABRICATED))).toEqual([]);
  });

  it('no longer has the files that only made data up', () => {
    expect(DELETED.filter((file) => fs.existsSync(path.join(expoDir, file)))).toEqual([]);
  });

  it('has nothing that refers to the deleted files', () => {
    const names = DELETED.map((file) => path.basename(file, '.js'));
    const sources = [];
    for (const dir of [...SOURCE_DIRS, '__tests__']) {
      if (fs.existsSync(path.join(expoDir, dir))) sources.push(...walk(path.join(expoDir, dir)));
    }
    const mentions = sources
      .filter((file) => path.basename(file) !== path.basename(__filename))
      .filter((file) => {
        const code = fs.readFileSync(file, 'utf8');
        return names.some((name) => new RegExp(`services/${name}['"]|\\./${name}['"]`).test(code));
      })
      .map((file) => path.relative(expoDir, file));
    expect(mentions).toEqual([]);
  });
});

describe('the check itself', () => {
  it('finds Math.random() however it is used', () => {
    expect(findings('export const bpm = 60 + Math.floor(Math.random() * 40);')).toEqual([RANDOM]);
    expect(findings('export const pick = (a) => a[Math.floor(Math.random() * a.length)];')).toEqual([RANDOM]);
    expect(findings('export function newId(random = Math.random) { return random(); }')).toEqual([RANDOM]);
    expect(findings('const m = Math; export const x = Math.random();')).toEqual([RANDOM]);
  });

  it('counts each use', () => {
    expect(findings('export const a = [Math.random(), Math.random(), Math.random()];')).toEqual([RANDOM, RANDOM, RANDOM]);
  });

  it('finds data named as mock, fake or dummy', () => {
    expect(findings('const mockData = { steps: 1 }; export default mockData;')).toEqual([MOCK_NAME, MOCK_NAME]);
    expect(findings('export const getMockFallback = () => [];')).toEqual([MOCK_NAME]);
    expect(findings('const FAKE_VIEWERS = 5; export default FAKE_VIEWERS;')).toEqual([MOCK_NAME, MOCK_NAME]);
    expect(findings('export const dummyUser = {};')).toEqual([MOCK_NAME]);
  });

  it('finds a health reading written in as text, in a string, in JSX or in a template', () => {
    expect(findings("export const tile = { val: '72', unit: 'bpm', label: 'Blood Oxygen' };")).toEqual([FABRICATED]);
    expect(findings("export const label = 'Stress Level';")).toEqual([FABRICATED]);
    expect(findings('export default () => <Text>Your Health Score</Text>;', 'probe.jsx')).toEqual([FABRICATED]);
    expect(findings('export default () => <Text>Updated today at 9:15 AM</Text>;', 'probe.jsx')).toEqual([FABRICATED]);
    expect(findings('export default () => <Text>72 bpm</Text>;', 'probe.jsx')).toEqual([FABRICATED]);
    expect(findings('export const line = `Resting 72 bpm`;')).toEqual([FABRICATED]);
    expect(findings("export const tip = 'Based on your activity, consider adding a 10-minute stretch.';")).toEqual([FABRICATED]);
    expect(findings("export const o2 = 'SpO2 98';")).toEqual([FABRICATED]);
    expect(findings("export const shout = 'BLOOD OXYGEN';")).toEqual([FABRICATED]);
  });

  it('leaves a heart rate that is built from a reading alone', () => {
    expect(findings('export const line = (hr) => `resting heart rate ${Math.round(hr)} bpm`;')).toEqual([]);
    expect(findings('export default ({ hr }) => <Text>{Math.round(hr)} bpm</Text>;', 'probe.jsx')).toEqual([]);
    expect(findings("export const unit = 'bpm';")).toEqual([]);
    expect(findings('// 72 bpm, Blood Oxygen and Stress Level are not measured here\nexport const a = 1;')).toEqual([]);
    expect(findings('export const n = 98;')).toEqual([]);
  });

  it('is not fooled by an eslint-disable comment', () => {
    expect(findings('// eslint-disable-next-line no-restricted-syntax\nexport const x = Math.random();')).toEqual([RANDOM]);
    expect(findings('/* eslint-disable */\nexport const x = Math.random();')).toEqual([RANDOM]);
  });

  it('leaves comments and text alone, and ordinary code', () => {
    expect(findings('// the old Math.random() mock is gone\nexport const a = 1;')).toEqual([]);
    expect(findings('/* mock */ export const note = "no more Math.random() or fake data";')).toEqual([]);
    expect(findings('export const total = (xs) => xs.reduce((a, b) => a + b, 0);')).toEqual([]);
    expect(findings('export const round = Math.round(2.5) + Math.floor(1.2);')).toEqual([]);
  });

  it('reports a file that uses Math.random() more often than it is allowed to, or that is not listed at all', () => {
    const scan = { 'a.js': [RANDOM, RANDOM], 'b.js': [RANDOM], 'c.js': [MOCK_NAME] };
    expect(overused(scan, { 'a.js': [1, 'an id'] })).toEqual(['a.js: 2 use(s), 1 allowed', 'b.js: 1 use(s), 0 allowed']);
    expect(overused(scan, { 'a.js': [2, 'ids'], 'b.js': [1, 'an id'] })).toEqual([]);
  });

  it('reports a list entry that is out of date, in either direction', () => {
    const scan = { 'a.js': [RANDOM, RANDOM] };
    expect(stale(scan, { 'a.js': [2, 'ids'] })).toEqual([]);
    expect(stale(scan, { 'a.js': [3, 'ids'] })).toEqual(['a.js: lists 3, has 2']);
    expect(stale(scan, { 'a.js': [1, 'ids'] })).toEqual(['a.js: lists 1, has 2']);
    expect(stale(scan, { 'gone.js': [1, 'ids'] })).toEqual(['gone.js: lists 1, has 0']);
  });

  it('reads JSX files too', () => {
    expect(findings('export default () => <View key={Math.random()} />;', 'probe.jsx')).toEqual([RANDOM]);
  });

  it('looks at the folders the app is made of', () => {
    for (const dir of ['app', 'components', 'services', 'store', 'lib']) {
      expect(SOURCE_DIRS).toContain(dir);
      expect(fs.existsSync(path.join(expoDir, dir))).toBe(true);
    }
    expect(Object.keys(scanned).length).toBeGreaterThan(5);
  });
});

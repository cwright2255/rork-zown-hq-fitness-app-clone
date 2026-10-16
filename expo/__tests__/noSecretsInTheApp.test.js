// Anything named EXPO_PUBLIC_ is copied into the app itself when it is built, and anyone can read it back out of the
// installed app. So a secret must never be read from one. The keys for RapidAPI, TrailAPI, Google Places, Spoonacular,
// the Calorie API, Passio and Spotify live in the cloud functions (functions/src/index.js) and the app asks those. This
// fails if code in the app reads one again. (Public values such as the Firebase web config and the Radar publishable key
// are meant to be in the app and are not on this list.)
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const APP_DIRS = ['app', 'components', 'constants', 'data', 'hooks', 'lib', 'services', 'src', 'store', 'types', 'utils'];
const SECRET_NAME = /EXPO_PUBLIC_(?:[A-Z0-9_]*(?:SECRET|PRIVATE|PASSWORD)[A-Z0-9_]*|(?:RAPIDAPI|TRAILAPI|GOOGLE_PLACES|SPOONACULAR|CALORIE_API|PASSIO)[A-Z0-9_]*)/g;

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
function sources(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (isDir(full)) sources(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');

/** "path: NAME" for every secret-looking public variable that code (not a comment) under `base` mentions. */
function secretReads(base) {
  const found = [];
  for (const dir of APP_DIRS) {
    if (!isDir(path.join(base, dir))) continue;
    for (const file of sources(path.join(base, dir))) {
      for (const name of new Set(code(fs.readFileSync(file, 'utf8')).match(SECRET_NAME) || [])) {
        found.push(`${path.relative(base, file).split(path.sep).join('/')}: ${name}`);
      }
    }
  }
  return found;
}

describe('the checker', () => {
  let base;
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), text); };
  beforeEach(() => { base = fs.mkdtempSync(path.join(os.tmpdir(), 'secrets-')); });
  afterEach(() => { fs.rmSync(base, { recursive: true, force: true }); });

  it('names each secret that code reads', () => {
    write('services/a.js', 'const s = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;\nconst k = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;\n');
    write('app/b.jsx', 'const g = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY; const x = process.env.EXPO_PUBLIC_ROOK_SECRET;\n');
    write('lib/c.js', 'const t = process.env.EXPO_PUBLIC_TRAILAPI_KEY, p = process.env.EXPO_PUBLIC_PASSIO_API_KEY, c = process.env.EXPO_PUBLIC_CALORIE_API_KEY, n = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY;\n');
    expect(secretReads(base).sort()).toEqual([
      'app/b.jsx: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY', 'app/b.jsx: EXPO_PUBLIC_ROOK_SECRET',
      'lib/c.js: EXPO_PUBLIC_CALORIE_API_KEY', 'lib/c.js: EXPO_PUBLIC_PASSIO_API_KEY',
      'lib/c.js: EXPO_PUBLIC_SPOONACULAR_API_KEY', 'lib/c.js: EXPO_PUBLIC_TRAILAPI_KEY',
      'services/a.js: EXPO_PUBLIC_RAPIDAPI_KEY', 'services/a.js: EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET',
    ].sort());
  });

  it('leaves public values and comments alone', () => {
    write('src/config/firebase.js', 'const k = process.env.EXPO_PUBLIC_FIREBASE_API_KEY, r = process.env.EXPO_PUBLIC_RADAR_PUBLISHABLE_KEY, i = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;\n');
    write('services/old.js', '// previously read process.env.EXPO_PUBLIC_RAPIDAPI_KEY\n/* and EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET */\nexport const x = 1;\n');
    write('backend/hono.js', 'const s = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;\n'); // not part of the app
    expect(secretReads(base)).toEqual([]);
  });
});

describe('the app', () => {
  it('reads no secret from an EXPO_PUBLIC_ variable', () => {
    expect(secretReads(root)).toEqual([]);
  });

  it('has no setup note that tells you to put a secret in an EXPO_PUBLIC variable', () => {
    const notes = fs.readdirSync(root).filter((name) => name.endsWith('.md'));
    expect(notes.length).toBeGreaterThan(0);
    const offenders = notes.filter((name) => /EXPO_PUBLIC_[A-Z0-9_]*SECRET[A-Z0-9_]*\s*=/.test(fs.readFileSync(path.join(root, name), 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('gets the Spotify app token from the cloud function, not from a secret in the app', () => {
    const service = fs.readFileSync(path.join(root, 'services', 'spotifyService.js'), 'utf8');
    expect(service).toContain("callProxy('getSpotifyAppToken'");
    const index = fs.readFileSync(path.join(root, 'functions', 'src', 'index.js'), 'utf8');
    expect(index).toMatch(/export const getSpotifyAppToken = onCall\(/);
  });
});

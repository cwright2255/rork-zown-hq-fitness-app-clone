// The app used to act on a command in any link that reached it: zownhq://admin?cmd=logout signed the person out,
// setOnboarded sent them back through onboarding. Nothing checked who sent it (the "token" was only written to the log),
// and nothing in the app read what the other commands saved. An admin screen beside it reset local data. All of it is
// gone. This keeps it gone: the only thing an incoming link may do is finish a Spotify login.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'hooks', 'lib', 'services', 'src', 'store', 'utils'];

function sources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sources(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const code = (file) => fs.readFileSync(file, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');

const all = DIRS.filter((d) => fs.existsSync(path.join(root, d))).flatMap((d) => sources(path.join(root, d)));

describe('links into the app', () => {
  it('have no admin screen or link handler left', () => {
    expect(fs.existsSync(path.join(root, 'services', 'remoteAdminService.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app', 'admin.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app', 'admin.jsx'))).toBe(false);
  });

  it('are not read for commands anywhere', () => {
    const offenders = all
      .filter((file) => /processAdminLink|remoteAdminService|zown-admin-config|zown-admin-logo-url|queryParams\??\.(cmd|command)\b/.test(code(file)))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });

  it('are used by the layout only to finish a Spotify login', () => {
    const layout = code(path.join(root, 'app', '_layout.jsx'));
    const handler = layout.slice(layout.indexOf('const handleDeepLink'), layout.indexOf('useEffect', layout.indexOf('const handleDeepLink')));
    expect(handler).toContain('connectSpotifyImplicit');
    expect(handler).toContain('connectSpotify(authCode)');
    expect(handler).not.toMatch(/logout|setState|AsyncStorage|router\./);
  });
});

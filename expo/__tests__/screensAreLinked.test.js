// A screen that nothing opens is either dead weight or, worse, made-up content that never got wired in: the old Progress
// screen sold a "Premium" upgrade that charged nothing, and an admin screen could be driven by a link with no login.
// This finds every screen under app/ that no other file points at, by the path in a string (router.push('/x'), href,
// `/x/${id}`), counting a screen as reached only when something that is itself reached points at it. The layout does not
// count: it names every screen to set it up and tests paths to hide the tab bar, which is not a way to open one. A new
// screen that nothing opens fails here until it is linked, deleted, or listed below with the reason it stays.
const fs = require('fs');
const os = require('os');
const path = require('path');

const SOURCE_DIRS = ['app', 'components', 'constants', 'data', 'hooks', 'lib', 'services', 'src', 'store', 'utils'];

// Screens that are not opened by a path in the code, with why they stay. Delete a line when its screen gets a link.
const KNOWN_UNLINKED = {
  '/spotify-callback': 'where Spotify sends the person back after logging in (zownhq://spotify-callback)',
  '/spotify-integration': 'opened only by the two Spotify return pages, once login has finished',
  '/spotify-redirect': 'where Spotify sends the person back after logging in (a web address, not a link in the app)',
  '/messaging': 'a redirect to /messages, kept for any old link',
  '/workout/create': 'a redirect to the Quick Workout, kept for any old link',
  '/running/program/[id]': 'a redirect to /running/[id], kept for any old link',
  '/exp-dashboard': 'real data, not linked yet',
  '/recipes/import-from-share': 'real, but the share-sheet setup it needs is not in app.json yet',
  '/shop/cart': 'the Shop is still sample products; its screens are not wired together',
  '/shop/category/[category]': 'the Shop is still sample products; its screens are not wired together',
  '/shop/collection/[id]': 'the Shop is still sample products; its screens are not wired together',
  '/shop/product/[id]': 'only opened from the two Shop screens above',
  '/shop/try-on': 'only opened from the Shop product screen',
};

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };

function files(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (isDir(full)) files(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text of a file with whole-line comments and block comments taken out. */
function code(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');
}

/** A pattern that finds `route` written as a path in a string: '/x', "/x", `/x`, '/x?a=1', '/x/${id}', and for [id] any text. */
function routePattern(route) {
  const body = escapeRx(route).replace(/\\\[[^\]]+\\\]/g, '[^/\'"`?\\s]+');
  return new RegExp(`['"\`]${body}(?:[?'"\`/]|$)`, 'm');
}

/** The routes of the screens under `root`/app that are not reached, as { route: "app/file" }. */
function unreachedScreens(root) {
  const appDir = path.join(root, 'app');
  const screens = {};
  for (const file of files(appDir)) {
    const rel = path.relative(appDir, file).split(path.sep).join('/');
    const name = path.basename(rel);
    if (name.startsWith('_layout') || name.startsWith('+')) continue;
    let route = `/${rel.replace(/\.(js|jsx|ts|tsx)$/, '')}`;
    if (route.endsWith('/index')) route = route.slice(0, -6) || '/';
    screens[route] = file;
  }
  const screenFiles = new Set(Object.values(screens));
  const text = {};
  for (const dir of SOURCE_DIRS) {
    if (isDir(path.join(root, dir))) {
      for (const file of files(path.join(root, dir))) if (!path.basename(file).startsWith('_layout')) text[file] = code(file);
    }
  }
  const patterns = Object.fromEntries(Object.keys(screens).map((route) => [route, routePattern(route)]));
  const mentions = (file, route) => patterns[route].test(text[file] || '');

  // Reached: pointed at from anything that is not a screen (the layout, a component, a store), or from a reached screen.
  const reached = new Set(['/']); // the first screen
  for (const route of Object.keys(screens)) {
    if (Object.keys(text).some((file) => !screenFiles.has(file) && mentions(file, route))) reached.add(route);
  }
  for (let grew = true; grew;) {
    grew = false;
    for (const route of Object.keys(screens)) {
      if (reached.has(route)) continue;
      if ([...reached].some((from) => screens[from] && mentions(screens[from], route))) { reached.add(route); grew = true; }
    }
  }
  return Object.fromEntries(Object.keys(screens).filter((r) => !reached.has(r)).sort()
    .map((r) => [r, path.relative(root, screens[r]).split(path.sep).join('/')]));
}

describe('the checker', () => {
  let root;
  const write = (rel, text = 'export default function S() { return null; }\n') => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'screens-')); write('app/index.jsx'); write('app/_layout.jsx'); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('finds a screen that nothing points at', () => {
    write('app/orphan.jsx');
    expect(unreachedScreens(root)).toEqual({ '/orphan': 'app/orphan.jsx' });
  });

  it('counts a screen as reached when a component, a store or another reached screen points at it', () => {
    write('app/a.jsx'); write('app/b.jsx'); write('app/c.jsx'); write('app/d.jsx');
    write('components/Nav.jsx', "export const x = () => router.push('/a');\n");
    write('store/s.js', "export const go = () => router.replace(\"/b\");\n");
    write('app/index.jsx', 'export default () => <Link href={`/c?tab=1`} />;\n');
    write('app/c.jsx', "router.push('/d')\n");
    expect(unreachedScreens(root)).toEqual({});
  });

  it('does not count the layout, which only names screens and tests their paths', () => {
    write('app/hidden.jsx');
    write('app/_layout.jsx', "const bar = pathname !== '/hidden' && !pathname.startsWith('/hidden/');\n");
    expect(unreachedScreens(root)).toEqual({ '/hidden': 'app/hidden.jsx' });
  });

  it('does not count a pointer from a screen that is itself not reached', () => {
    write('app/dead.jsx', "router.push('/dead'); router.push('/other');\n"); write('app/other.jsx');
    expect(unreachedScreens(root)).toEqual({ '/dead': 'app/dead.jsx', '/other': 'app/other.jsx' });
  });

  it('matches a screen with a [param] in its path against a path built with ${...}', () => {
    write('app/item/[id].jsx'); write('app/item/index.jsx'); write('app/item/list/[kind].jsx');
    write('components/Row.jsx', "router.push(`/item/${id}`); router.push(`/item/list/${kind}`); router.push('/item');\n");
    expect(unreachedScreens(root)).toEqual({});
  });

  it('is not fooled by a longer path, a comment, or a path that is only a prefix', () => {
    write('app/shop.jsx'); write('app/news.jsx');
    write('components/Row.jsx', [
      "router.push('/shopping');", "// router.push('/news')", '/* router.push("/news") */', "router.push('/newsletter');",
    ].join('\n'));
    expect(unreachedScreens(root)).toEqual({ '/shop': 'app/shop.jsx', '/news': 'app/news.jsx' });
  });
});

describe('the app', () => {
  const unreached = unreachedScreens(path.join(__dirname, '..'));

  it('has no screen that nothing opens, except the ones listed above with a reason', () => {
    const unexplained = Object.entries(unreached).filter(([route]) => !(route in KNOWN_UNLINKED)).map(([route, file]) => `${route} (${file})`);
    expect(unexplained).toEqual([]);
  });

  it('does not list a screen as unlinked once it has a link, or once it is gone', () => {
    const stale = Object.keys(KNOWN_UNLINKED).filter((route) => !(route in unreached));
    expect(stale).toEqual([]);
  });
});

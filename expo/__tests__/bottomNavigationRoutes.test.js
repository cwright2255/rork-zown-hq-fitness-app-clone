// The floating bottom navigation is hidden on some screens (lib/bottomNavigationRoutes.js). Before Build 13 that was one
// 1,230-character condition in app/_layout.jsx. The list that replaced it must hide the bar on exactly the same paths, so the old
// condition is kept below, copied exactly as it was, and both are run on every screen in app/ and on the edge cases around each rule.
const fs = require('fs');
const path = require('path');
const {
  showsBottomNavigation, HIDDEN_ON, HIDDEN_ON_PATHS_STARTING_WITH, HIDDEN_ON_PATTERNS,
} = require('../lib/bottomNavigationRoutes');

const expoDir = path.join(__dirname, '..');

// The condition app/_layout.jsx had before Build 13, exactly as it was (true = the bar shows).
const oldCondition = (pathname) => !!(
     !pathname.startsWith('/auth/')
  && pathname !== '/start'
  && pathname !== '/'
  && pathname !== '/index'
  && !/^\/workout\/.+$/.test(pathname)
  && !/^\/running\/(?!program)[^/]+$/.test(pathname)
  && !pathname.startsWith('/body-scan')
  && !pathname.startsWith('/messages')
  && !pathname.startsWith('/profile/edit')
  && !pathname.startsWith('/profile/settings')
  && !pathname.startsWith('/profile/terms')
  && !pathname.startsWith('/profile/privacy-policy')
  && !pathname.startsWith('/profile/blocked')
  && !pathname.startsWith('/profile/licenses')
  && !pathname.startsWith('/profile/running-log')
  && !pathname.startsWith('/profile/workout-history')
  && !pathname.startsWith('/profile/calorie-history')
  && !pathname.startsWith('/running/hiking')
  && !pathname.startsWith('/running/run/')
  && !pathname.startsWith('/running/races/')
  && !pathname.startsWith('/running/journeys/')
  && !pathname.startsWith('/profile/notifications')
  && !pathname.startsWith('/profile/help')
  && !pathname.startsWith('/coach')
  && !pathname.startsWith('/shop/product')
  && !pathname.startsWith('/shop/cart')
  && !pathname.startsWith('/shop/try-on')
  && !pathname.startsWith('/nutrition/scan')
  && !pathname.startsWith('/nutrition/barcode-scan')
  && !pathname.startsWith('/paywall')
);

/** The routes of every screen file under app/: app/profile/[id].jsx is /profile/abc, app/hq.jsx is /hq, app/x/index.jsx is /x. */
function appRoutes(dir = path.join(expoDir, 'app'), prefix = '') {
  const routes = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { routes.push(...appRoutes(full, `${prefix}/${name.replace(/\[[^\]]+\]/g, 'abc')}`)); continue; }
    if (!/\.(jsx?|tsx?)$/.test(name) || name.startsWith('_layout') || name.startsWith('+')) continue;
    const base = name.replace(/\.(jsx?|tsx?)$/, '').replace(/\[[^\]]+\]/g, 'abc');
    routes.push(base === 'index' ? (prefix || '/') : `${prefix}/${base}`);
  }
  return routes;
}

// Screens that Build 13 deleted: nothing opens them any more, but the list must still answer the same for them.
const DELETED_IN_BUILD_13 = ['/badges', '/exp-dashboard', '/messaging', '/workout/create', '/running/program/abc'];

// Paths next to each rule, on both sides of it.
const EDGE_CASES = [
  '', '/', '/index', '/start', '/start/', '/start2', '/hq', '/hq/', '/home', '/profile', '/profile/',
  '/workout', '/workout/', '/workout/x', '/workout/x/y', '/workouts', '/workouts/x',
  '/running', '/running/', '/running/x', '/running/x/', '/running/x/y', '/running/program', '/running/program/', '/running/program/x',
  '/running/programs', '/running/programme', '/running/active', '/running/import', '/running/week/1', '/running/session/abc',
  '/running/hiking', '/running/hikingx', '/running/hiking/saved', '/running/run', '/running/run/', '/running/run/abc', '/running/runs',
  '/running/races', '/running/races/', '/running/races/local-5k', '/running/journeys', '/running/journeys/', '/running/journeys/abc',
  '/auth', '/auth/', '/auth/login', '/authx', '/messages', '/messages/abc', '/messages2', '/message',
  '/shop', '/shop/', '/shop/product', '/shop/product/abc', '/shop/products', '/shop/cart', '/shop/carts', '/shop/try-on', '/shop/category/abc',
  '/nutrition', '/nutrition/search', '/nutrition/scan', '/nutrition/scanner', '/nutrition/barcode-scan', '/nutrition/barcode', '/nutrition/food/abc',
  '/profile/edit', '/profile/edit-photo', '/profile/settings', '/profile/settings/abc', '/profile/terms', '/profile/privacy-policy',
  '/profile/privacy', '/profile/blocked', '/profile/licenses', '/profile/running-log', '/profile/workout-history', '/profile/calorie-history',
  '/profile/notifications', '/profile/help', '/profile/helpful', '/profile/achievements', '/profile/streak',
  '/coach', '/coach/x', '/coaching', '/paywall', '/paywall/x', '/body-scan', '/body-scan/abc', '/body-scans',
];

/** Every path worth comparing: the screens, the deleted screens, the edge cases, and each list entry with things added or taken off. */
function candidatePaths() {
  const paths = new Set([...appRoutes(), ...DELETED_IN_BUILD_13, ...EDGE_CASES]);
  for (const route of [...paths]) { paths.add(`${route}/`); paths.add(`${route}/x`); paths.add(`${route}/x/y`); paths.add(`${route}x`); }
  for (const entry of [...HIDDEN_ON, ...HIDDEN_ON_PATHS_STARTING_WITH]) {
    for (const p of [entry, `${entry}x`, `${entry}/x`, `${entry}/x/y`, `${entry}-x`, entry.slice(0, -1), entry.replace(/\/$/, '')]) paths.add(p);
  }
  return [...paths];
}

describe('the bottom navigation list', () => {
  const paths = candidatePaths();

  it('hides the bar on exactly the paths the old condition did, and shows it on exactly the same ones', () => {
    const different = paths.filter((p) => showsBottomNavigation(p) !== oldCondition(p)).map((p) => `${p}: now ${showsBottomNavigation(p)}, was ${oldCondition(p)}`);
    expect(different).toEqual([]);
  });

  it('compares a real spread of paths, with the bar shown on some and hidden on others (so the comparison cannot pass by being empty)', () => {
    const shown = paths.filter(oldCondition);
    expect(paths.length).toBeGreaterThan(400);
    expect(shown.length).toBeGreaterThan(80);
    expect(paths.length - shown.length).toBeGreaterThan(200);
  });

  it('covers every screen in app/ (so a screen added later is compared too)', () => {
    const routes = appRoutes();
    expect(routes.length).toBeGreaterThan(80);
    for (const route of ['/hq', '/workout/active', '/running/active', '/auth/login', '/onboarding', '/profile/settings']) expect(routes).toContain(route);
  });

  it('shows the bar on the tabs and hides it on sign-in, onboarding\'s start, and the active workout', () => {
    for (const tab of ['/hq', '/workouts', '/nutrition', '/shop', '/profile', '/community', '/analytics', '/running/program']) expect(showsBottomNavigation(tab)).toBe(true);
    for (const hidden of ['/', '/start', '/auth/login', '/auth/register', '/workout/active', '/workout/complete', '/paywall', '/messages/abc']) expect(showsBottomNavigation(hidden)).toBe(false);
  });

  it('has the same answer for the screens that Build 13 deleted', () => {
    for (const gone of DELETED_IN_BUILD_13) expect(showsBottomNavigation(gone)).toBe(oldCondition(gone));
  });

  it('has no entry written twice, none that another entry already covers, and every path starts with a slash', () => {
    const all = [...HIDDEN_ON, ...HIDDEN_ON_PATHS_STARTING_WITH];
    expect(new Set(all).size).toBe(all.length);
    for (const entry of all) expect(entry.startsWith('/')).toBe(true);
    const covered = HIDDEN_ON_PATHS_STARTING_WITH.filter((entry) => HIDDEN_ON_PATHS_STARTING_WITH.some((other) => other !== entry && entry.startsWith(other)));
    expect(covered).toEqual([]);
    expect(HIDDEN_ON_PATTERNS.length).toBe(2);
  });
});

describe('app/_layout.jsx', () => {
  const layout = fs.readFileSync(path.join(expoDir, 'app', '_layout.jsx'), 'utf8');

  it('asks the list, and does not carry a condition of its own for the bar', () => {
    expect(layout).toContain("import { showsBottomNavigation } from '@/lib/bottomNavigationRoutes';");
    expect(layout).toMatch(/\{showsBottomNavigation\(pathname\) && <BottomNavigation \/>\}/);
    expect((layout.match(/<BottomNavigation/g) || []).length).toBe(1);
    expect(layout.split('\n').filter((line) => line.includes('pathname') && line.length > 300)).toEqual([]);
  });

  it('no longer names the five unused things, or the screens that were deleted', () => {
    expect(layout).not.toMatch(/^import .*\b(LottieView|TouchableOpacity|tokens|Constants)\b/m);
    expect(layout).not.toMatch(/\bconst (Head|IS_EXPO_GO)\b/);
    // The branch that could never run: the effect returns early on '/start', so '/start' never reached the "onboarded person on /start" case.
    expect(layout).not.toMatch(/isOnboarded && pathname === '\/start'/);
    for (const gone of ['"messaging"', '"exp-dashboard"', '"workout/create"', '"running/program/[id]"']) expect(layout).not.toContain(`<Stack.Screen name=${gone}`);
  });

  it('has a Stack.Screen only for a screen that exists (deleting a screen file must take its entry out too)', () => {
    const names = [...layout.matchAll(/<Stack\.Screen name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(40);
    const exists = (name) => ['.jsx', '.js', '/index.jsx', '/index.js'].some((ending) => fs.existsSync(path.join(expoDir, 'app', `${name}${ending}`)));
    expect(names.filter((name) => !exists(name))).toEqual([]);
  });
});

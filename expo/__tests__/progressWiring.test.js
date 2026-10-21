// The lifetime totals, achievements, badges and Battle Pass claims are the server's: the root layout starts following them when a person
// signs in and stops when they sign out, and nothing in the app decides an unlock or writes one. This reads the sources, the way
// xpCallSites.test.js does, because the screens and the layout need the whole app around them to render.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  if (['node_modules', '__tests__', 'functions', 'rules-tests', '.git', 'ios', 'android'].includes(entry.name)) return [];
  const rel = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(rel);
  return /\.(js|jsx)$/.test(entry.name) ? [rel] : [];
});

describe('the root layout', () => {
  const layout = read('app/_layout.jsx');
  const afterSignIn = layout.slice(layout.indexOf('onAuthStateChanged(auth'));
  const signedIn = afterSignIn.slice(0, afterSignIn.indexOf('} else {'));
  const signedOut = afterSignIn.slice(afterSignIn.indexOf('} else {'), afterSignIn.indexOf('setStoresReady(true);\n    });'));

  it('gets the sync from the progress sync service', () => {
    expect(layout).toMatch(/import \{ startProgressSync, stopProgressSync \} from '@\/services\/progressSync';/);
  });

  it('starts following when a person signs in, after the stores have loaded', () => {
    const loaded = signedIn.indexOf(']);');
    expect(loaded).toBeGreaterThan(-1);
    expect(signedIn.indexOf('startProgressSync(uid)')).toBeGreaterThan(loaded);
  });

  it('stops following, and clears what was shown, when the person signs out', () => {
    expect(signedOut).toContain('stopProgressSync();');
  });
});

describe('nothing on the phone decides an unlock or writes one', () => {
  const sources = walk('.').filter((file) => !/^(babel|metro|jest|eslint|app\.config)/.test(path.basename(file)));

  it('looks at the whole app, not an empty list', () => {
    expect(sources.length).toBeGreaterThan(100);
    ['store/badgeStore.js', 'app/battlepass.jsx', 'app/workout/active.jsx', 'services/raceBoard.js'].forEach((file) => expect(sources).toContain(file));
  });

  it('has no call that unlocks a badge or an achievement, or checks for one', () => {
    const offenders = sources.filter((file) => /\b(unlockBadge|checkAchievements|unlockAchievement|updateAchievementProgress)\b/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('never writes the achievements, badges or Battle Pass documents (the rules turn it away, so it could only fail)', () => {
    const offenders = sources.filter((file) => /(setDoc|updateDoc|deleteDoc)\([^)]*'(achievements|badges|battlePass)'/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('claims a Battle Pass tier only through the server', () => {
    expect(read('store/battlePassStore.js')).toContain("callProxy('claimBattlePassTier'");
    expect(read('store/battlePassStore.js')).not.toMatch(/setDoc|updateDoc/);
  });
});

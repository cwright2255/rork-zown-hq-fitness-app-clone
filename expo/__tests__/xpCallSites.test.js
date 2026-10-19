// The XP record is the server's: the phone files claims and follows the ledger, and writes only a name and picture on the
// leaderboard. These read the sources of the places that have to line up with that (the screens are too big to render here, the way
// signInLoadsHikes reads the root layout), so a screen that goes back to writing scores itself, or stops giving the claim what it
// needs, is caught.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(rel);
  return /\.(js|jsx)$/.test(entry.name) ? [rel] : [];
});

describe('the root layout', () => {
  const layout = read('app/_layout.jsx');
  const afterSignIn = layout.slice(layout.indexOf('onAuthStateChanged(auth'));
  const signedIn = afterSignIn.slice(0, afterSignIn.indexOf('} else {'));
  const signedOut = afterSignIn.slice(afterSignIn.indexOf('} else {'), afterSignIn.indexOf('setStoresReady(true);\n    });'));

  it('gets the sync from the sync service and the profile write from the visibility service', () => {
    expect(layout).toMatch(/import \{ startXpSync, stopXpSync \} from '@\/services\/xpSync';/);
    expect(layout).toMatch(/import \{ publishMyProfile \} from '@\/services\/leaderboardVisibility';/);
  });

  it('starts following the ledger once the stores have loaded, because the streak days come from them', () => {
    const loaded = signedIn.indexOf(']);');
    expect(loaded).toBeGreaterThan(-1);
    expect(signedIn.indexOf('startXpSync(uid)')).toBeGreaterThan(loaded);
  });

  it('puts the person\'s name and picture on the leaderboard after sign-in, and nothing else', () => {
    expect(signedIn).toContain('publishMyProfile({ user: useUserStore.getState().user });');
  });

  it('stops following when the person signs out', () => {
    expect(signedOut).toContain('stopXpSync();');
  });
});

describe('the screens that earn XP give the claim what the server needs', () => {
  it('a run says what it was: the activity, the distance and the time', () => {
    const source = read('app/running/active.jsx');
    const block = source.slice(source.indexOf('baseExp: xpFor(activity, summary.distance)'));
    expect(block.slice(0, 400)).toContain('activity,');
    expect(block.slice(0, 400)).toContain('distanceKm: summary.distance,');
    expect(block.slice(0, 400)).toContain('durationSec: summary.duration,');
  });

  it('a hike says how far and how long, as well as how hard', () => {
    const source = read('app/running/hiking/monitor.jsx');
    const block = source.slice(source.indexOf("type: 'hiking'")).slice(0, 700);
    expect(block).toContain('distanceKm: km,');
    expect(block).toContain('durationSec: seconds,');
    expect(block).toMatch(/multiplier:/);
  });

  it('a form check is a form check, not a side mission', () => {
    expect(read('app/workout/form-check.jsx')).toContain("kind: 'formcheck'");
  });
});

describe('nothing on the phone writes a score to the leaderboard', () => {
  const sources = ['app', 'components', 'constants', 'data', 'hooks', 'lib', 'services', 'src', 'store', 'utils']
    .flatMap((dir) => (fs.existsSync(path.join(root, dir)) ? walk(dir) : []));

  it('has none of the old ways of writing one', () => {
    const offenders = sources.filter((file) => /publishMyXp|_syncLeaderboardEntry|_syncDistanceEntry|publishMyDistance|services\/distanceBoard/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('has no distance board service any more', () => {
    expect(fs.existsSync(path.join(root, 'services', 'distanceBoard.js'))).toBe(false);
  });

  it('writes only a name, a picture and a time on the entry in the leaderboard store', () => {
    const source = read('store/leaderboardStore.js');
    const write = source.slice(source.indexOf('_syncProfile:'), source.indexOf('_syncProfile:') + 1800);
    expect(write).toContain('updatedAt');
    expect(write).not.toMatch(/\bxp\b\s*[:,]|\blevel\b\s*[:,]|\bstreak\b\s*[:,]|\bdistance\b\s*[:,]/);
  });

  it('is the server that fills in a score: the rules refuse it from the phone', () => {
    const rules = read('firestore.rules');
    const board = rules.slice(rules.indexOf('match /leaderboard/{uid}'));
    expect(board.slice(0, 1500)).toMatch(/function knownKeys\(\) \{\s*return \['name', 'avatar', 'updatedAt'\];/);
  });
});

describe('the claim files the server reads', () => {
  it('can be created by the person and never changed or deleted by them', () => {
    const rules = read('firestore.rules');
    const claims = rules.slice(rules.indexOf('match /xpClaims/{claimId}'));
    const block = claims.slice(0, claims.indexOf('\n    }') > 0 ? claims.indexOf('\n    }') : 1500);
    expect(block).toContain('allow create:');
    expect(block).toMatch(/allow update, delete: if false;/);
  });

  it('is kept in step with the copy the functions deploy with', () => {
    expect(read('functions/src/xpRules.js')).toBe(read('lib/xpRules.js'));
  });
});

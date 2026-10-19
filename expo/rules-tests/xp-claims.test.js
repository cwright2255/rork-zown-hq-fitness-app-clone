// XP. The app does not write a score anywhere. It files a claim for what it earned under users/{uid}/xpClaims, and the XP ledger
// function (functions/src/xpLedger.js) checks it and adds it to the ledger at users/{uid}/stats/xp. These tests are about what the
// rules let the person do with the two: file claims, read both, and change neither once they are made. (What a claim is worth is
// tested in __tests__/xpRules.test.js; the leaderboard entry the function writes is in social.test.js.)
const { rulesEnv, ok, no } = require('./helpers');

const env = rulesEnv();

const claim = (over = {}) => ({ kind: 'workout', day: '2026-10-19', baseExp: 200, ...over });
const claimDoc = (uid, id) => env.as(uid).doc(`users/${uid}/xpClaims/${id}`);

describe('/users/{uid}/xpClaims/{claimId}', () => {
  it('lets a person file each kind of claim for themselves', async () => {
    await ok(claimDoc('alice', 'c1').set(claim()));
    await ok(claimDoc('alice', 'c2').set({ kind: 'run', day: '2026-10-19', activity: 'run', distanceKm: 5.2, durationSec: 1800 }));
    await ok(claimDoc('alice', 'c3').set({ kind: 'hike', day: '2026-10-19', distanceKm: 8, durationSec: 7200, multiplier: 1.4 }));
    await ok(claimDoc('alice', 'c4').set({ kind: 'meal', day: '2026-10-19', baseExp: 44, foodKey: 'banana' }));
    await ok(claimDoc('alice', 'c5').set({ kind: 'hydration', day: '2026-10-19', tier: 3 }));
    await ok(claimDoc('alice', 'c6').set({ kind: 'steps', day: '2026-10-19', steps: 4500 }));
    await ok(claimDoc('alice', 'c7').set({ kind: 'plan', day: '2026-10-19', baseExp: 1125 }));
    await ok(claimDoc('alice', 'c8').set({ kind: 'journey', day: '2026-10-19', baseExp: 500 }));
    await ok(claimDoc('alice', 'c9').set({ kind: 'import', day: '2026-10-19', total: 12000, activeDays: ['2026-10-18', '2026-10-19'] }));
  });

  it('does not let anyone file a claim for someone else, or a visitor file one at all', async () => {
    await no(env.as('bob').doc('users/alice/xpClaims/c1').set(claim()));
    await no(env.anon().doc('users/alice/xpClaims/c1').set(claim()));
  });

  it('can be read by the person who filed it, and by nobody else', async () => {
    await env.seed({ 'users/alice/xpClaims/c1': claim() });
    await ok(claimDoc('alice', 'c1').get());
    await ok(env.as('alice').collection('users/alice/xpClaims').get());
    await no(env.as('bob').doc('users/alice/xpClaims/c1').get());
    await no(env.as('bob').collection('users/alice/xpClaims').get());
    await no(env.anon().doc('users/alice/xpClaims/c1').get());
  });

  it('cannot be changed, overwritten under the same name, or removed once filed', async () => {
    await env.seed({ 'users/alice/xpClaims/c1': claim() });
    const mine = claimDoc('alice', 'c1');
    await no(mine.update({ baseExp: 3000 }));
    await no(mine.set(claim({ baseExp: 3000 })));
    await no(mine.set(claim(), { merge: true }));
    await no(mine.delete());
  });

  it('cannot carry what the function writes back, so a claim cannot say it was dealt with', async () => {
    await no(claimDoc('alice', 'c1').set(claim({ processedAt: '2026-10-19T12:00:00.000Z' })));
    await no(claimDoc('alice', 'c2').set(claim({ result: 'awarded' })));
    await no(claimDoc('alice', 'c3').set(claim({ amount: 99999 })));
    await no(claimDoc('alice', 'c4').set(claim({ reason: null })));
  });

  it('cannot carry a score, a level or anything else that is not part of a claim', async () => {
    await no(claimDoc('alice', 'c1').set(claim({ xp: 5000000 })));
    await no(claimDoc('alice', 'c2').set(claim({ level: 100 })));
    await no(claimDoc('alice', 'c3').set(claim({ streak: 5000 })));
    await no(claimDoc('alice', 'c4').set(claim({ ids: ['x'] })));
  });

  it('needs a kind from the list and a day written as YYYY-MM-DD', async () => {
    await no(claimDoc('alice', 'c1').set({ day: '2026-10-19', baseExp: 200 }));
    await no(claimDoc('alice', 'c2').set(claim({ kind: 'bonus' })));
    await no(claimDoc('alice', 'c3').set(claim({ kind: 7 })));
    await no(claimDoc('alice', 'c4').set({ kind: 'workout', baseExp: 200 }));
    await no(claimDoc('alice', 'c5').set(claim({ day: '19-10-2026' })));
    await no(claimDoc('alice', 'c6').set(claim({ day: 20261019 })));
    // Ten characters, but not a day written as YYYY-MM-DD.
    await no(claimDoc('alice', 'c7').set(claim({ day: '2026/10/19' })));
    await no(claimDoc('alice', 'c8').set(claim({ day: 'abcdefghij' })));
    await no(claimDoc('alice', 'c9').set(claim({ day: '2026-10-1x' })));
    await no(claimDoc('alice', 'd1').set(claim({ day: '2026-1-019' })));
    await no(claimDoc('alice', 'd2').set(claim({ day: '' })));
    await ok(claimDoc('alice', 'd3').set(claim({ day: '2026-10-19' })));
  });

  it('holds each number to a sensible limit and the right kind', async () => {
    await no(claimDoc('alice', 'c1').set(claim({ baseExp: -1 })));
    await no(claimDoc('alice', 'c2').set(claim({ baseExp: 10001 })));
    await no(claimDoc('alice', 'c3').set(claim({ baseExp: '200' })));
    await no(claimDoc('alice', 'c4').set(claim({ multiplier: 11 })));
    await no(claimDoc('alice', 'c5').set({ kind: 'run', day: '2026-10-19', activity: 'run', distanceKm: 1001, durationSec: 100 }));
    await no(claimDoc('alice', 'c6').set({ kind: 'run', day: '2026-10-19', activity: 'run', distanceKm: -2, durationSec: 100 }));
    await no(claimDoc('alice', 'c7').set({ kind: 'run', day: '2026-10-19', activity: 'run', distanceKm: 5, durationSec: 1000001 }));
    await no(claimDoc('alice', 'c8').set({ kind: 'run', day: '2026-10-19', activity: 'x'.repeat(11), distanceKm: 5, durationSec: 100 }));
    await no(claimDoc('alice', 'c9').set({ kind: 'meal', day: '2026-10-19', baseExp: 44, foodKey: 'x'.repeat(81) }));
    await no(claimDoc('alice', 'd1').set({ kind: 'hydration', day: '2026-10-19', tier: 6 }));
    await no(claimDoc('alice', 'd2').set({ kind: 'hydration', day: '2026-10-19', tier: 2.5 }));
    await no(claimDoc('alice', 'd3').set({ kind: 'steps', day: '2026-10-19', steps: 100001 }));
    await no(claimDoc('alice', 'd4').set({ kind: 'steps', day: '2026-10-19', steps: 10.5 }));
    await no(claimDoc('alice', 'd5').set({ kind: 'import', day: '2026-10-19', total: 5000001 }));
    await no(claimDoc('alice', 'd6').set({ kind: 'import', day: '2026-10-19', total: 5, activeDays: new Array(401).fill('2026-10-19') }));
    await no(claimDoc('alice', 'd7').set({ kind: 'import', day: '2026-10-19', total: 5, activeDays: 'nope' }));
  });

  it('accepts the limits themselves', async () => {
    await ok(claimDoc('alice', 'c1').set(claim({ baseExp: 10000, multiplier: 10 })));
    await ok(claimDoc('alice', 'c2').set({ kind: 'steps', day: '2026-10-19', steps: 100000 }));
    await ok(claimDoc('alice', 'c3').set({ kind: 'import', day: '2026-10-19', total: 5000000, activeDays: new Array(400).fill('2026-10-19') }));
  });

  it('is named with letters, digits, dashes and underscores, up to 100 of them', async () => {
    await ok(claimDoc('alice', 'workout-1760900000000').set(claim()));
    await ok(claimDoc('alice', 'meal_Banana-2').set(claim()));
    await ok(claimDoc('alice', 'a'.repeat(100)).set(claim()));
    await no(claimDoc('alice', 'a'.repeat(101)).set(claim()));
    await no(claimDoc('alice', 'has.dot').set(claim()));
    await no(claimDoc('alice', 'has space').set(claim()));
  });
});

describe('/users/{uid}/stats/xp, the ledger', () => {
  const ledger = { total: 1200, level: 2, streak: 3 };

  it('can be read by its owner and by nobody else', async () => {
    await env.seed({ 'users/alice/stats/xp': ledger });
    await ok(env.as('alice').doc('users/alice/stats/xp').get());
    await no(env.as('bob').doc('users/alice/stats/xp').get());
    await no(env.anon().doc('users/alice/stats/xp').get());
  });

  it('cannot be written by anyone, not even its owner, so XP can only come from the function', async () => {
    const mine = env.as('alice').doc('users/alice/stats/xp');
    await no(mine.set({ total: 5000000, level: 100, streak: 5000 }));
    await env.seed({ 'users/alice/stats/xp': ledger });
    await no(mine.update({ total: 5000000 }));
    await no(mine.set({ total: 5000000 }, { merge: true }));
    await no(mine.delete());
    await no(env.as('bob').doc('users/alice/stats/xp').set({ total: 0 }));
    await no(env.anon().doc('users/alice/stats/xp').set({ total: 0 }));
  });
});

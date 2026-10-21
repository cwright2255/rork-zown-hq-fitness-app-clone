import {
  BATTLE_PASS_TIERS, claimTier, claimWasAccepted, gatherFacts, hikeFactsFromClaims, hikeFactsFromRecord, runUnlocks,
} from '../functions/src/unlocks';
import { xpRequiredForLevel } from '../lib/xpRules';

// A small in-memory stand-in for the Firestore pieces unlocks.js and lifetimeTotals.js use: db.doc(path) with get() and
// set(data, { merge }), db.collection(path).where(...).select(...).get(), and db.runTransaction, whose transaction has get(ref) and
// set(ref, data, { merge }). Writes are applied when the transaction function returns, and a read after a write (which Firestore
// refuses) throws, so the real order is enforced too.
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isMap = (x) => x && typeof x === 'object' && !Array.isArray(x);
const merge = (base, data) => {
  const out = { ...base };
  Object.keys(data).forEach((k) => { out[k] = isMap(data[k]) && isMap(base[k]) ? merge(base[k], data[k]) : data[k]; });
  return out;
};
function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed).map(([path, data]) => [path, clone(data)]));
  const log = [];
  const snapOf = (path, fields) => ({
    id: path.split('/').pop(),
    exists: docs.has(path),
    data: () => {
      if (!docs.has(path)) return undefined;
      const all = clone(docs.get(path));
      return fields ? Object.fromEntries(fields.filter((f) => f in all).map((f) => [f, all[f]])) : all;
    },
  });
  const apply = (path, data, options) => docs.set(path, options && options.merge ? merge(docs.get(path) || {}, clone(data)) : clone(data));
  const query = (collection, filters = [], fields = null) => ({
    where: (field, op, value) => query(collection, [...filters, [field, op, value]], fields),
    select: (...names) => query(collection, filters, names),
    get: async () => {
      log.push(['query', collection, filters, fields]);
      const prefix = `${collection}/`;
      const matches = (doc, [f, op, v]) => (op === '==' ? doc[f] === v : op === 'in' ? v.includes(doc[f]) : false);
      const paths = [...docs.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .filter((p) => filters.every((f) => matches(docs.get(p), f)));
      return { docs: paths.map((p) => snapOf(p, fields)) };
    },
  });
  return {
    docs,
    log,
    doc: (path) => ({
      path,
      get: async () => { log.push(['get', path]); return snapOf(path); },
      set: async (data, options) => { log.push(['set', path]); apply(path, data, options); },
    }),
    collection: (name) => query(name),
    runTransaction: async (fn) => {
      log.push(['transaction']);
      const writes = [];
      const tx = {
        get: async (ref) => {
          if (writes.length > 0) throw new Error('reads must come before writes in a transaction');
          return snapOf(ref.path);
        },
        set: (ref, data, options) => { writes.push(() => { log.push(['tx-set', ref.path]); apply(ref.path, data, options); }); },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
}

const STAMP = '2026-10-21T12:00:00.000Z';
const LATER = '2026-10-22T09:00:00.000Z';
const ACH = 'users/alice/data/achievements';
const BADGES = 'users/alice/data/badges';
const PASS = 'users/alice/data/battlePass';
const LEDGER = 'users/alice/stats/xp';
const HIKES = 'users/alice/data/hikes';
const workout = (over = {}) => ({ userId: 'alice', completed: true, duration: 1800, caloriesBurned: 300, ...over });
const claim = (kind, over = {}) => ({ kind, day: '2026-10-20', result: 'awarded', ...over });

describe('claimWasAccepted', () => {
  it('accepts a claim that was paid, and one that was valid but found the day already full', () => {
    expect(claimWasAccepted({ result: 'awarded' })).toBe(true);
    expect(claimWasAccepted({ result: 'rejected', reason: 'daily-cap' })).toBe(true);
    expect(claimWasAccepted({ result: 'rejected', reason: 'too-many' })).toBe(true);
  });

  it('does not accept one turned away as wrong, one not dealt with yet, or nothing', () => {
    ['invalid', 'too-fast', 'bad-day', 'repeat', 'nothing-new', 'already-imported', 'bad-distance', 'something-new', undefined].forEach((reason) => {
      expect(claimWasAccepted({ result: 'rejected', reason })).toBe(false);
    });
    expect(claimWasAccepted({ kind: 'race' })).toBe(false);
    expect(claimWasAccepted({ result: 'rejected' })).toBe(false);
    expect(claimWasAccepted(null)).toBe(false);
    expect(claimWasAccepted(undefined)).toBe(false);
  });
});

describe('hike facts', () => {
  it('reads the count, distance and strenuous hikes from the hikes the person recorded', () => {
    const f = hikeFactsFromRecord({ hikes: [
      { distanceKm: 4, difficultyTier: 'Easy' },
      { distanceKm: 6.5, difficultyTier: 'Strenuous' },
      { distanceKm: 2, difficultyTier: 'Very Strenuous' },
      { distanceKm: 3, difficultyTier: 'Challenging' },
      null,
    ] });
    expect(f).toEqual({ count: 4, km: 15.5, strenuous: 2 });
  });

  it('ignores a distance that is not a usable number', () => {
    expect(hikeFactsFromRecord({ hikes: [{ distanceKm: '5' }, { distanceKm: -3 }, { distanceKm: NaN }, {}] })).toEqual({ count: 4, km: 0, strenuous: 0 });
  });

  it('copes with no record', () => {
    expect(hikeFactsFromRecord(null)).toEqual({ count: 0, km: 0, strenuous: 0 });
    expect(hikeFactsFromRecord({})).toEqual({ count: 0, km: 0, strenuous: 0 });
    expect(hikeFactsFromRecord({ hikes: 'x' })).toEqual({ count: 0, km: 0, strenuous: 0 });
  });

  it('reads the same from the XP claims for hikes the server accepted, a multiplier of 2.2 or more being Strenuous', () => {
    const f = hikeFactsFromClaims([
      claim('hike', { distanceKm: 5, multiplier: 1 }),
      claim('hike', { distanceKm: 7, multiplier: 2.2 }),
      claim('hike', { distanceKm: 2, multiplier: 2.6, result: 'rejected', reason: 'daily-cap' }),
      claim('hike', { distanceKm: 50, multiplier: 2.6, result: 'rejected', reason: 'too-fast' }),
      claim('hike', { distanceKm: 40, multiplier: 2.6, result: undefined }),
      claim('race', { distanceKm: 99 }),
    ]);
    expect(f).toEqual({ count: 3, km: 14, strenuous: 2 });
  });

  it('does not take a multiplier just under 2.2 for Strenuous', () => {
    expect(hikeFactsFromClaims([claim('hike', { distanceKm: 1, multiplier: 1.8 })]).strenuous).toBe(0);
    expect(hikeFactsFromClaims([claim('hike', { distanceKm: 1, multiplier: 2.19 })]).strenuous).toBe(0);
  });
});

describe('gatherFacts', () => {
  it('has nothing to report for a person with no records, and counts their totals', async () => {
    const db = makeDb();
    const { facts, totals } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts).toEqual({
      finishedWorkouts: 0, bestCalories: 0, streak: 0, level: 1, xp: 0,
      hikeCount: 0, hikeMiles: 0, strenuousHikes: 0, raceFinishes: 0, journeyFinishes: 0,
    });
    expect(totals.totalWorkouts).toBe(0);
    expect(db.docs.has('users/alice/stats/totals')).toBe(true);
  });

  it('reads finished workouts and the best calories from the workout totals', async () => {
    const db = makeDb({
      'workouts/w1': workout({ caloriesBurned: 640 }),
      'workouts/w2': workout({ caloriesBurned: 1100 }),
      'workouts/w3': workout({ completed: false, caloriesBurned: 5000 }),
      'workouts/w4': workout({ userId: 'bob', caloriesBurned: 9000 }),
    });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.finishedWorkouts).toBe(2);
    expect(facts.bestCalories).toBe(1100);
  });

  it('uses the totals already stored when they are up to date', async () => {
    const db = makeDb({
      'users/alice/stats/totals': { v: 2, totalWorkouts: 300, finishedWorkouts: 290, totalSeconds: 1, totalCalories: 1, bestCalories: 1500 },
      'workouts/w1': workout(),
    });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.finishedWorkouts).toBe(290);
    expect(facts.bestCalories).toBe(1500);
  });

  it('reads XP, level and streak from the XP ledger', async () => {
    const total = xpRequiredForLevel(5);
    const db = makeDb({ [LEDGER]: { total, streak: 12 } });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.xp).toBe(total);
    expect(facts.level).toBe(5);
    expect(facts.streak).toBe(12);
  });

  it('turns hike kilometres into miles', async () => {
    const db = makeDb({ [HIKES]: { hikes: [{ distanceKm: 16.1 }, { distanceKm: 8.05 }] } });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.hikeMiles).toBeCloseTo(24.15 * 0.621371, 5);
    expect(facts.hikeMiles).toBeGreaterThan(15);
    expect(facts.hikeMiles).toBeLessThan(15.1);
  });

  it('counts hikes from the record and from accepted claims, whichever shows more', async () => {
    const db = makeDb({
      [HIKES]: { hikes: [{ distanceKm: 8, difficultyTier: 'Easy' }, { distanceKm: 8, difficultyTier: 'Easy' }] },
      'users/alice/xpClaims/c1': claim('hike', { distanceKm: 20, multiplier: 2.2 }),
    });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.hikeCount).toBe(2);
    expect(facts.hikeMiles).toBeCloseTo(20 * 0.621371, 5);
    expect(facts.strenuousHikes).toBe(1);
  });

  it('counts a hike the record does not show yet from its accepted claim', async () => {
    const db = makeDb({ 'users/alice/xpClaims/c1': claim('hike', { distanceKm: 3, multiplier: 1.4 }) });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.hikeCount).toBe(1);
  });

  it('counts accepted race and journey claims, and none turned away as wrong or not yet dealt with', async () => {
    const db = makeDb({
      'users/alice/xpClaims/r1': claim('race', { baseExp: 750 }),
      'users/alice/xpClaims/r2': claim('race', { result: 'rejected', reason: 'invalid' }),
      'users/alice/xpClaims/r3': claim('race', { result: undefined }),
      'users/alice/xpClaims/j1': claim('journey', { baseExp: 500, result: 'rejected', reason: 'daily-cap' }),
      'users/alice/xpClaims/j2': claim('journey', { result: 'rejected', reason: 'repeat' }),
    });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.raceFinishes).toBe(1);
    expect(facts.journeyFinishes).toBe(1);
  });

  it('asks only for the person\'s own hike, race and journey claims', async () => {
    const db = makeDb({
      'users/alice/xpClaims/r1': claim('race'),
      'users/bob/xpClaims/r1': claim('race'),
      'users/bob/xpClaims/j1': claim('journey'),
      'users/alice/xpClaims/w1': claim('workout'),
    });
    const { facts } = await gatherFacts({ db, uid: 'alice', stamp: STAMP });
    expect(facts.raceFinishes).toBe(1);
    expect(facts.journeyFinishes).toBe(0);
    const claimQueries = db.log.filter((l) => l[0] === 'query' && l[1].includes('xpClaims'));
    expect(claimQueries).toEqual([['query', 'users/alice/xpClaims', [['kind', 'in', ['hike', 'race', 'journey']]], null]]);
  });
});

describe('runUnlocks', () => {
  const progress = () => ({
    [LEDGER]: { total: xpRequiredForLevel(5) + 10, streak: 7 },
    'workouts/w1': workout({ caloriesBurned: 1200 }),
    'users/alice/xpClaims/r1': claim('race', { baseExp: 750 }),
  });

  it('writes what is newly earned, with the time, to the achievements and the badges', async () => {
    const db = makeDb(progress());
    const r = await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(r.achievements).toEqual(['first-workout', 'workout-streak-7', 'calories-1000', 'level-5', 'xp-1000']);
    expect(r.badges).toEqual(['badge-1', 'badge-14']);
    expect(db.docs.get(ACH)).toEqual({ unlocked: {
      'first-workout': STAMP, 'workout-streak-7': STAMP, 'calories-1000': STAMP, 'level-5': STAMP, 'xp-1000': STAMP,
    } });
    expect(db.docs.get(BADGES)).toEqual({ unlocked: { 'badge-1': STAMP, 'badge-14': STAMP } });
  });

  it('hands back what it worked from', async () => {
    const db = makeDb(progress());
    const r = await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(r.facts.level).toBe(5);
    expect(r.totals.finishedWorkouts).toBe(1);
  });

  it('adds to what is already unlocked and keeps its time', async () => {
    const db = makeDb({
      ...progress(),
      [ACH]: { unlocked: { 'first-workout': '2026-09-01T00:00:00.000Z' } },
      [BADGES]: { unlocked: { 'badge-1': '2026-09-01T00:00:00.000Z' } },
    });
    const r = await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(r.achievements).toEqual(['workout-streak-7', 'calories-1000', 'level-5', 'xp-1000']);
    expect(r.badges).toEqual(['badge-14']);
    expect(db.docs.get(ACH).unlocked['first-workout']).toBe('2026-09-01T00:00:00.000Z');
    expect(db.docs.get(ACH).unlocked['level-5']).toBe(STAMP);
    expect(db.docs.get(BADGES).unlocked['badge-1']).toBe('2026-09-01T00:00:00.000Z');
    expect(db.docs.get(BADGES).unlocked['badge-14']).toBe(STAMP);
  });

  it('changes nothing the second time', async () => {
    const db = makeDb(progress());
    await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    const before = clone([...db.docs.entries()]);
    const writes = db.log.filter((l) => l[0] === 'tx-set').length;
    const again = await runUnlocks({ db, uid: 'alice', stamp: LATER });
    expect(again.achievements).toEqual([]);
    expect(again.badges).toEqual([]);
    expect(db.log.filter((l) => l[0] === 'tx-set')).toHaveLength(writes);
    expect(clone([...db.docs.entries()])).toEqual(before);
  });

  it('writes only the document that has something new', async () => {
    const db = makeDb({ [LEDGER]: { total: xpRequiredForLevel(5) + 1, streak: 0 } });
    const r = await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(r.achievements).toEqual(['level-5', 'xp-1000']);
    expect(r.badges).toEqual([]);
    expect(db.log.filter((l) => l[0] === 'tx-set')).toEqual([['tx-set', ACH]]);
    expect(db.docs.has(BADGES)).toBe(false);
  });

  it('writes nothing for a person who has earned nothing', async () => {
    const db = makeDb();
    const r = await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(r.achievements).toEqual([]);
    expect(db.log.filter((l) => l[0] === 'tx-set')).toEqual([]);
  });

  it('never takes an unlock away, even when what earned it is no longer there', async () => {
    const db = makeDb({ [ACH]: { unlocked: { 'workouts-100': '2026-08-01T00:00:00.000Z' } }, [BADGES]: { unlocked: { 'badge-12': '2026-08-01T00:00:00.000Z' } } });
    await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(db.docs.get(ACH).unlocked['workouts-100']).toBe('2026-08-01T00:00:00.000Z');
    expect(db.docs.get(BADGES).unlocked['badge-12']).toBe('2026-08-01T00:00:00.000Z');
  });

  it('keeps any other field the achievements document holds', async () => {
    const db = makeDb({ ...progress(), [ACH]: { unlocked: {}, note: 'keep me' } });
    await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(db.docs.get(ACH).note).toBe('keep me');
  });

  it('only ever writes under the person\'s own folder', async () => {
    const db = makeDb({ ...progress(), 'users/bob/stats/xp': { total: 9999999, streak: 99 } });
    await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(db.log.filter((l) => l[0] === 'tx-set' || l[0] === 'set').every((l) => l[1].startsWith('users/alice/'))).toBe(true);
    expect(db.docs.has('users/bob/data/achievements')).toBe(false);
  });

  it('earns the hiking badges from the hikes the person recorded', async () => {
    const db = makeDb({ [HIKES]: { hikes: [{ distanceKm: 17, difficultyTier: 'Strenuous' }] } });
    const r = await runUnlocks({ db, uid: 'alice', stamp: STAMP });
    expect(r.badges).toEqual(['badge-11', 'badge-12', 'badge-13']);
  });
});

describe('claimTier', () => {
  const ledgerAt = (level) => ({ [LEDGER]: { total: xpRequiredForLevel(level) } });

  it('claims a tier the level has reached, and records it with the time', async () => {
    const db = makeDb(ledgerAt(5));
    const r = await claimTier({ db, uid: 'alice', tier: 3, stamp: STAMP });
    expect(r).toEqual({ status: 'claimed', claimedTiers: [3], level: 5 });
    expect(db.docs.get(PASS)).toEqual({ claimedTiers: [3], updatedAt: STAMP });
  });

  it('claims the tier at exactly the level, and refuses the next one', async () => {
    const db = makeDb(ledgerAt(5));
    expect((await claimTier({ db, uid: 'alice', tier: 5, stamp: STAMP })).status).toBe('claimed');
    const locked = await claimTier({ db, uid: 'alice', tier: 6, stamp: STAMP });
    expect(locked).toEqual({ status: 'locked', claimedTiers: [5], level: 5 });
    expect(db.docs.get(PASS).claimedTiers).toEqual([5]);
  });

  it('refuses a tier when there is no ledger yet, except tier 1', async () => {
    const db = makeDb();
    expect((await claimTier({ db, uid: 'alice', tier: 2, stamp: STAMP })).status).toBe('locked');
    expect(db.docs.has(PASS)).toBe(false);
    expect((await claimTier({ db, uid: 'alice', tier: 1, stamp: STAMP })).status).toBe('claimed');
  });

  it('adds to the tiers already claimed, in order', async () => {
    const db = makeDb({ ...ledgerAt(9), [PASS]: { claimedTiers: [4, 1] } });
    const r = await claimTier({ db, uid: 'alice', tier: 2, stamp: STAMP });
    expect(r.claimedTiers).toEqual([1, 2, 4]);
    expect(db.docs.get(PASS).claimedTiers).toEqual([1, 2, 4]);
  });

  it('says so, and writes nothing, when the tier was already claimed', async () => {
    const db = makeDb({ ...ledgerAt(9), [PASS]: { claimedTiers: [1, 2], updatedAt: 'old' } });
    const r = await claimTier({ db, uid: 'alice', tier: 2, stamp: STAMP });
    expect(r).toEqual({ status: 'already', claimedTiers: [1, 2], level: 9 });
    expect(db.docs.get(PASS)).toEqual({ claimedTiers: [1, 2], updatedAt: 'old' });
    expect(db.log.filter((l) => l[0] === 'tx-set')).toEqual([]);
  });

  it('keeps a tier claimed even when the level is lower than it now', async () => {
    const db = makeDb({ ...ledgerAt(3), [PASS]: { claimedTiers: [7] } });
    expect((await claimTier({ db, uid: 'alice', tier: 7, stamp: STAMP })).status).toBe('already');
  });

  it('turns away a tier that is not a whole number from 1 to 20', async () => {
    const db = makeDb(ledgerAt(20));
    for (const tier of [0, -1, 21, 1.5, '3', null, undefined, NaN, Infinity, [], {}]) {
      // eslint-disable-next-line no-await-in-loop
      expect(await claimTier({ db, uid: 'alice', tier, stamp: STAMP })).toEqual({ status: 'invalid' });
    }
    expect(db.docs.has(PASS)).toBe(false);
  });

  it('allows the first and the last tier, and keeps both once claimed', async () => {
    const db = makeDb(ledgerAt(20));
    expect(BATTLE_PASS_TIERS).toBe(20);
    expect((await claimTier({ db, uid: 'alice', tier: 1, stamp: STAMP })).status).toBe('claimed');
    const last = await claimTier({ db, uid: 'alice', tier: 20, stamp: STAMP });
    expect(last).toEqual({ status: 'claimed', claimedTiers: [1, 20], level: 20 });
    expect(db.docs.get(PASS).claimedTiers).toEqual([1, 20]);
    expect((await claimTier({ db, uid: 'alice', tier: 20, stamp: STAMP })).status).toBe('already');
  });

  it('puts the tiers in number order, not in the order of their digits', async () => {
    const db = makeDb({ ...ledgerAt(15), [PASS]: { claimedTiers: [10, 2] } });
    const r = await claimTier({ db, uid: 'alice', tier: 3, stamp: STAMP });
    expect(r.claimedTiers).toEqual([2, 3, 10]);
    expect(db.docs.get(PASS).claimedTiers).toEqual([2, 3, 10]);
  });

  it('treats a stored list that is not a list as nothing claimed yet', async () => {
    for (const stored of ['abc', 7, { 0: 1 }, true]) {
      const db = makeDb({ ...ledgerAt(5), [PASS]: { claimedTiers: stored } });
      // eslint-disable-next-line no-await-in-loop
      expect(await claimTier({ db, uid: 'alice', tier: 2, stamp: STAMP })).toEqual({ status: 'claimed', claimedTiers: [2], level: 5 });
    }
  });

  it('adds to the battle pass document and leaves any other field on it alone', async () => {
    const db = makeDb({ ...ledgerAt(5), [PASS]: { claimedTiers: [1], note: 'keep me' } });
    await claimTier({ db, uid: 'alice', tier: 2, stamp: STAMP });
    expect(db.docs.get(PASS)).toEqual({ claimedTiers: [1, 2], updatedAt: STAMP, note: 'keep me' });
  });

  it('drops anything in the stored list that is not a tier', async () => {
    const db = makeDb({ ...ledgerAt(9), [PASS]: { claimedTiers: [3, 3, '4', 0, 99, 2.5, null, 1] } });
    const r = await claimTier({ db, uid: 'alice', tier: 2, stamp: STAMP });
    expect(r.claimedTiers).toEqual([1, 2, 3]);
  });

  it('works on the person\'s own folder only', async () => {
    const db = makeDb({ ...ledgerAt(2), 'users/bob/stats/xp': { total: xpRequiredForLevel(20) } });
    expect((await claimTier({ db, uid: 'alice', tier: 10, stamp: STAMP })).status).toBe('locked');
  });
});

import { TOTALS_VERSION, currentTotals, ensureTotals, refreshTotals, summarizeWorkouts } from '../functions/src/lifetimeTotals';

// A small in-memory stand-in for the Firestore pieces lifetimeTotals.js uses: db.doc(path) with get() and set(data, { merge }), and
// db.collection(name).where(...).select(...).get() over the documents directly under that collection. Every query is logged.
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const merge = (base, data) => {
  const out = { ...base };
  Object.keys(data).forEach((k) => {
    const isMap = (x) => x && typeof x === 'object' && !Array.isArray(x);
    out[k] = isMap(data[k]) && isMap(base[k]) ? merge(base[k], data[k]) : data[k];
  });
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
  const query = (collection, filters = [], fields = null) => ({
    where: (field, op, value) => query(collection, [...filters, [field, op, value]], fields),
    select: (...names) => query(collection, filters, names),
    get: async () => {
      log.push(['query', collection, filters, fields]);
      const prefix = `${collection}/`;
      const paths = [...docs.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .filter((p) => filters.every(([f, op, v]) => op === '==' && docs.get(p)[f] === v));
      return { docs: paths.map((p) => snapOf(p, fields)) };
    },
  });
  return {
    docs,
    log,
    doc: (path) => ({
      path,
      get: async () => { log.push(['get', path]); return snapOf(path); },
      set: async (data, options) => {
        log.push(['set', path]);
        docs.set(path, options && options.merge ? merge(docs.get(path) || {}, clone(data)) : clone(data));
      },
    }),
    collection: (name) => query(name),
  };
}

const workout = (uid, over = {}) => ({ userId: uid, completed: true, duration: 1800, caloriesBurned: 300, ...over });
const TOTALS = 'users/alice/stats/totals';
const STAMP = '2026-10-21T12:00:00.000Z';

describe('summarizeWorkouts', () => {
  it('counts every saved record, and the finished ones separately', () => {
    const t = summarizeWorkouts([workout('a'), workout('a'), workout('a', { completed: false })]);
    expect(t.totalWorkouts).toBe(3);
    expect(t.finishedWorkouts).toBe(2);
  });

  it('counts only a record marked completed as finished', () => {
    const t = summarizeWorkouts([{ duration: 60 }, { completed: 'true' }, { completed: 1 }, { completed: null }, { completed: true }]);
    expect(t.totalWorkouts).toBe(5);
    expect(t.finishedWorkouts).toBe(1);
  });

  it('adds up time and calories over every saved record, the way Workout History does', () => {
    const t = summarizeWorkouts([
      workout('a', { duration: 1800, caloriesBurned: 300 }),
      workout('a', { duration: 600, caloriesBurned: 80.5, completed: false }),
    ]);
    expect(t.totalSeconds).toBe(2400);
    expect(t.totalCalories).toBe(380.5);
  });

  it('takes the best calories from finished workouts only', () => {
    const t = summarizeWorkouts([
      workout('a', { caloriesBurned: 400 }),
      workout('a', { caloriesBurned: 1200, completed: false }),
      workout('a', { caloriesBurned: 950 }),
    ]);
    expect(t.bestCalories).toBe(950);
    expect(t.totalCalories).toBe(2550);
  });

  it('does not take 999.6 calories for 1000', () => {
    expect(summarizeWorkouts([workout('a', { caloriesBurned: 999.6 })]).bestCalories).toBe(999.6);
  });

  it('counts a record with no usable time or calories as a workout worth nothing', () => {
    const t = summarizeWorkouts([
      { completed: true },
      { completed: true, duration: -5, caloriesBurned: -100 },
      { completed: true, duration: '600', caloriesBurned: 'lots' },
      { completed: true, duration: NaN, caloriesBurned: Infinity },
    ]);
    expect(t).toEqual({ totalWorkouts: 4, finishedWorkouts: 4, totalSeconds: 0, totalCalories: 0, bestCalories: 0 });
  });

  it('copes with no records, something that is not a list, and entries that are not records', () => {
    const none = { totalWorkouts: 0, finishedWorkouts: 0, totalSeconds: 0, totalCalories: 0, bestCalories: 0 };
    expect(summarizeWorkouts([])).toEqual(none);
    expect(summarizeWorkouts(undefined)).toEqual(none);
    expect(summarizeWorkouts({ length: 3 })).toEqual(none);
    expect(summarizeWorkouts([null, undefined, 'x', 7]).totalWorkouts).toBe(0);
  });

  it('rounds sums to two decimals so float noise does not show', () => {
    const t = summarizeWorkouts([workout('a', { caloriesBurned: 0.1 }), workout('a', { caloriesBurned: 0.2 })]);
    expect(t.totalCalories).toBe(0.3);
  });
});

describe('currentTotals', () => {
  const stored = { v: TOTALS_VERSION, totalWorkouts: 5, finishedWorkouts: 4, totalSeconds: 900, totalCalories: 400, bestCalories: 150, updatedAt: STAMP, totalMinutes: 15 };

  it('gives the five numbers of an up to date document and nothing else', () => {
    expect(currentTotals(stored)).toEqual({ totalWorkouts: 5, finishedWorkouts: 4, totalSeconds: 900, totalCalories: 400, bestCalories: 150 });
  });

  it('gives null for a missing document and for one from before the totals were counted on the server', () => {
    expect(currentTotals(null)).toBeNull();
    expect(currentTotals(undefined)).toBeNull();
    expect(currentTotals('x')).toBeNull();
    expect(currentTotals({ totalWorkouts: 9, totalMinutes: 400 })).toBeNull();
    expect(currentTotals({ ...stored, v: TOTALS_VERSION - 1 })).toBeNull();
    expect(currentTotals({ ...stored, v: undefined })).toBeNull();
  });

  it('accepts a later version', () => {
    expect(currentTotals({ ...stored, v: TOTALS_VERSION + 1 })).not.toBeNull();
  });
});

describe('refreshTotals', () => {
  const seed = () => ({
    'workouts/w1': workout('alice', { duration: 1800, caloriesBurned: 300 }),
    'workouts/w2': workout('alice', { duration: 3600, caloriesBurned: 700 }),
    'workouts/w3': workout('alice', { completed: false, duration: 600, caloriesBurned: 90 }),
    'workouts/w4': workout('bob', { duration: 9999, caloriesBurned: 9999 }),
  });

  it('counts the person\'s own records and nobody else\'s', async () => {
    const db = makeDb(seed());
    const t = await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    expect(t).toEqual({ totalWorkouts: 3, finishedWorkouts: 2, totalSeconds: 6000, totalCalories: 1090, bestCalories: 700 });
  });

  it('asks only for the fields it counts, from the person\'s own records', async () => {
    const db = makeDb(seed());
    await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    expect(db.log.filter((l) => l[0] === 'query')).toEqual([
      ['query', 'workouts', [['userId', '==', 'alice']], ['completed', 'duration', 'caloriesBurned']],
    ]);
  });

  it('stores the totals with the version, the time and the minutes', async () => {
    const db = makeDb(seed());
    await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    expect(db.docs.get(TOTALS)).toEqual({
      totalWorkouts: 3, finishedWorkouts: 2, totalSeconds: 6000, totalCalories: 1090, bestCalories: 700,
      totalMinutes: 100, v: TOTALS_VERSION, updatedAt: STAMP,
    });
  });

  it('writes over the old running count and keeps what else the document holds', async () => {
    const db = makeDb({ ...seed(), [TOTALS]: { totalWorkouts: 41, totalMinutes: 7, lastWorkoutAt: 'earlier', somethingElse: true } });
    await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    const stored = db.docs.get(TOTALS);
    expect(stored.totalWorkouts).toBe(3);
    expect(stored.totalMinutes).toBe(100);
    expect(stored.lastWorkoutAt).toBe('earlier');
    expect(stored.somethingElse).toBe(true);
  });

  it('writes the extra fields it is given along with the totals', async () => {
    const db = makeDb(seed());
    await refreshTotals({ db, uid: 'alice', stamp: STAMP, extra: { lastWorkoutAt: 'now-ish' } });
    expect(db.docs.get(TOTALS).lastWorkoutAt).toBe('now-ish');
  });

  it('gives the same answer however many times it runs: a repeated event cannot count a workout twice', async () => {
    const db = makeDb(seed());
    await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    const once = clone(db.docs.get(TOTALS));
    await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    expect(db.docs.get(TOTALS)).toEqual(once);
  });

  it('stores zeros for a person with no records', async () => {
    const db = makeDb(seed());
    const t = await refreshTotals({ db, uid: 'carol', stamp: STAMP });
    expect(t.totalWorkouts).toBe(0);
    expect(db.docs.get('users/carol/stats/totals').v).toBe(TOTALS_VERSION);
  });

  it('keeps counting past 240 records', async () => {
    const many = {};
    for (let i = 0; i < 300; i += 1) many[`workouts/m${i}`] = workout('alice', { duration: 60, caloriesBurned: 10 });
    const db = makeDb(many);
    const t = await refreshTotals({ db, uid: 'alice', stamp: STAMP });
    expect(t.totalWorkouts).toBe(300);
    expect(t.finishedWorkouts).toBe(300);
  });
});

describe('ensureTotals', () => {
  const records = { 'workouts/w1': workout('alice'), 'workouts/w2': workout('alice', { completed: false }) };

  it('returns what is stored, without counting again, when it is up to date', async () => {
    const stored = { v: TOTALS_VERSION, totalWorkouts: 77, finishedWorkouts: 70, totalSeconds: 1, totalCalories: 2, bestCalories: 3 };
    const db = makeDb({ ...records, [TOTALS]: stored });
    const t = await ensureTotals({ db, uid: 'alice', stamp: STAMP });
    expect(t).toEqual({ totalWorkouts: 77, finishedWorkouts: 70, totalSeconds: 1, totalCalories: 2, bestCalories: 3 });
    expect(db.log.some((l) => l[0] === 'query' || l[0] === 'set')).toBe(false);
  });

  it('counts from the records when there are no totals yet', async () => {
    const db = makeDb(records);
    const t = await ensureTotals({ db, uid: 'alice', stamp: STAMP });
    expect(t.totalWorkouts).toBe(2);
    expect(db.docs.get(TOTALS).v).toBe(TOTALS_VERSION);
  });

  it('counts from the records when the totals are the old running count', async () => {
    const db = makeDb({ ...records, [TOTALS]: { totalWorkouts: 1, totalMinutes: 1800 } });
    const t = await ensureTotals({ db, uid: 'alice', stamp: STAMP });
    expect(t.totalWorkouts).toBe(2);
    expect(t.finishedWorkouts).toBe(1);
    expect(db.docs.get(TOTALS).v).toBe(TOTALS_VERSION);
  });
});

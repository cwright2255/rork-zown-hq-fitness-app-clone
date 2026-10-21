import { SETTLE_LIMIT, countsNow, endMs, isDue, outcomeOf, settleExpiredDuels } from '../functions/src/duelSettle';

// A small in-memory stand-in for the Firestore pieces duelSettle.js uses: db.collection('duels').where(...).where(...).get(), whose
// documents carry a ref, and db.runTransaction with tx.get(ref) and tx.update(ref, data). `beforeSettle(path)` runs just before a
// transaction reads, so a test can change a duel between the list being made and the duel being settled.
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
function makeDb(seed = {}, { beforeSettle } = {}) {
  const docs = new Map(Object.entries(seed).map(([path, data]) => [path, clone(data)]));
  const log = [];
  const snapOf = (path) => ({
    id: path.split('/').pop(),
    ref: { path },
    exists: docs.has(path),
    data: () => clone(docs.get(path)),
  });
  const query = (collection, filters = []) => ({
    where: (field, op, value) => query(collection, [...filters, [field, op, value]]),
    get: async () => {
      log.push(['query', collection, filters]);
      const prefix = `${collection}/`;
      const paths = [...docs.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .filter((p) => filters.every(([f, op, v]) => op === '==' && docs.get(p)[f] === v));
      return { docs: paths.map(snapOf) };
    },
  });
  return {
    docs,
    log,
    collection: (name) => query(name),
    runTransaction: async (fn) => {
      log.push(['transaction']);
      const writes = [];
      const tx = {
        get: async (ref) => {
          if (beforeSettle) beforeSettle(ref.path, docs);
          if (writes.length > 0) throw new Error('reads must come before writes in a transaction');
          return snapOf(ref.path);
        },
        update: (ref, data) => {
          writes.push(() => {
            if (!docs.has(ref.path)) throw new Error('update of a document that does not exist');
            docs.set(ref.path, { ...docs.get(ref.path), ...clone(data) });
            log.push(['tx-update', ref.path]);
          });
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
}

const NOW = Date.parse('2026-10-21T12:00:00.000Z');
const STAMP = '2026-10-21T12:00:00.000Z';
const PAST = '2026-10-20T12:00:00.000Z';
const FUTURE = '2026-10-22T12:00:00.000Z';
const duel = (over = {}) => ({
  mode: 'most_by_deadline', status: 'active', metric: 'workouts', endDate: PAST,
  participantIds: ['alice', 'bob'], progress: { alice: 3, bob: 2 }, ...over,
});

describe('endMs', () => {
  it('reads the date of a duel', () => {
    expect(endMs({ endDate: '2026-10-21T12:00:00.000Z' })).toBe(NOW);
  });

  it('is null when there is no date or none that can be read', () => {
    expect(endMs({})).toBeNull();
    expect(endMs(null)).toBeNull();
    expect(endMs(undefined)).toBeNull();
    expect(endMs({ endDate: 'soon' })).toBeNull();
    expect(endMs({ endDate: '' })).toBeNull();
    expect(endMs({ endDate: 1761048000000 })).toBeNull();
    expect(endMs({ endDate: 2026 })).toBeNull(); // a bare number would read as a year
    expect(endMs({ endDate: [2026] })).toBeNull();
    expect(endMs({ endDate: { seconds: 1 } })).toBeNull();
  });
});

describe('isDue', () => {
  it('is due once the date has passed, and at the date itself', () => {
    expect(isDue(duel({ endDate: PAST }), NOW)).toBe(true);
    expect(isDue(duel({ endDate: STAMP }), NOW)).toBe(true);
  });

  it('is not due one millisecond before the date', () => {
    expect(isDue(duel({ endDate: STAMP }), NOW - 1)).toBe(false);
    expect(isDue(duel({ endDate: FUTURE }), NOW)).toBe(false);
  });

  it('is not due unless it is active and runs to a date', () => {
    expect(isDue(duel({ status: 'completed' }), NOW)).toBe(false);
    expect(isDue(duel({ status: 'pending' }), NOW)).toBe(false);
    expect(isDue(duel({ status: 'declined' }), NOW)).toBe(false);
    expect(isDue(duel({ mode: 'first_to_target' }), NOW)).toBe(false);
    expect(isDue(duel({ mode: undefined }), NOW)).toBe(false);
  });

  it('is not due with no date that can be read, or no duel', () => {
    expect(isDue(duel({ endDate: undefined }), NOW)).toBe(false);
    expect(isDue(duel({ endDate: 'soon' }), NOW)).toBe(false);
    expect(isDue(null, NOW)).toBe(false);
    expect(isDue(undefined, NOW)).toBe(false);
  });
});

describe('countsNow', () => {
  it('counts work before the date, and stops counting at the date', () => {
    expect(countsNow(duel({ endDate: STAMP }), NOW - 1)).toBe(true);
    expect(countsNow(duel({ endDate: STAMP }), NOW)).toBe(false);
    expect(countsNow(duel({ endDate: PAST }), NOW)).toBe(false);
    expect(countsNow(duel({ endDate: FUTURE }), NOW)).toBe(true);
  });

  it('always counts for a duel that does not run to a date', () => {
    expect(countsNow(duel({ mode: 'first_to_target', endDate: PAST }), NOW)).toBe(true);
    expect(countsNow(duel({ mode: undefined, endDate: PAST }), NOW)).toBe(true);
  });

  it('counts for a deadline duel whose date cannot be read, the way the app treated it', () => {
    expect(countsNow(duel({ endDate: undefined }), NOW)).toBe(true);
    expect(countsNow(duel({ endDate: 'soon' }), NOW)).toBe(true);
  });

  it('counts for no duel at all', () => {
    expect(countsNow(null, NOW)).toBe(true);
  });
});

describe('outcomeOf', () => {
  it('gives the win to whoever has more, whichever is listed first', () => {
    expect(outcomeOf(duel({ progress: { alice: 3, bob: 2 } }))).toEqual({ winnerId: 'alice', tied: false });
    expect(outcomeOf(duel({ progress: { alice: 2, bob: 3 } }))).toEqual({ winnerId: 'bob', tied: false });
    expect(outcomeOf(duel({ participantIds: ['bob', 'alice'], progress: { alice: 5, bob: 1 } }))).toEqual({ winnerId: 'alice', tied: false });
  });

  it('calls equal progress a tie with no winner, including nothing each', () => {
    expect(outcomeOf(duel({ progress: { alice: 4, bob: 4 } }))).toEqual({ winnerId: null, tied: true });
    expect(outcomeOf(duel({ progress: {} }))).toEqual({ winnerId: null, tied: true });
    expect(outcomeOf(duel({ progress: undefined }))).toEqual({ winnerId: null, tied: true });
  });

  it('counts a missing score as nothing', () => {
    expect(outcomeOf(duel({ progress: { alice: 1 } }))).toEqual({ winnerId: 'alice', tied: false });
    expect(outcomeOf(duel({ progress: { bob: 1 } }))).toEqual({ winnerId: 'bob', tied: false });
  });

  it('counts a score that is not a usable number as nothing', () => {
    expect(outcomeOf(duel({ progress: { alice: '9', bob: 1 } }))).toEqual({ winnerId: 'bob', tied: false });
    expect(outcomeOf(duel({ progress: { alice: NaN, bob: 1 } }))).toEqual({ winnerId: 'bob', tied: false });
    expect(outcomeOf(duel({ progress: { alice: Infinity, bob: 1 } }))).toEqual({ winnerId: 'bob', tied: false });
  });

  it('is a tie when it does not have exactly two people', () => {
    expect(outcomeOf(duel({ participantIds: ['alice'] }))).toEqual({ winnerId: null, tied: true });
    expect(outcomeOf(duel({ participantIds: ['a', 'b', 'c'], progress: { a: 9, b: 1, c: 1 } }))).toEqual({ winnerId: null, tied: true });
    expect(outcomeOf(duel({ participantIds: undefined }))).toEqual({ winnerId: null, tied: true });
    expect(outcomeOf(null)).toEqual({ winnerId: null, tied: true });
  });
});

describe('settleExpiredDuels', () => {
  it('completes a due duel with the winner, the time, and what settled it', async () => {
    const db = makeDb({ 'duels/d1': duel() });
    const r = await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    expect(r).toEqual({ settled: 1, skipped: 0 });
    expect(db.docs.get('duels/d1')).toMatchObject({
      status: 'completed', winnerId: 'alice', tied: false, completedAt: STAMP, settledBy: 'deadline',
    });
  });

  it('keeps everything else on the duel', async () => {
    const db = makeDb({ 'duels/d1': duel({ metric: 'calories', title: 'keep me' }) });
    await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    const d = db.docs.get('duels/d1');
    expect(d.metric).toBe('calories');
    expect(d.title).toBe('keep me');
    expect(d.progress).toEqual({ alice: 3, bob: 2 });
    expect(d.participantIds).toEqual(['alice', 'bob']);
    expect(d.endDate).toBe(PAST);
  });

  it('settles a tie with no winner', async () => {
    const db = makeDb({ 'duels/d1': duel({ progress: { alice: 2, bob: 2 } }) });
    await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    expect(db.docs.get('duels/d1')).toMatchObject({ status: 'completed', winnerId: null, tied: true });
  });

  it('settles a duel at the minute its date is reached', async () => {
    const db = makeDb({ 'duels/d1': duel({ endDate: STAMP }) });
    expect((await settleExpiredDuels({ db, now: NOW, stamp: STAMP })).settled).toBe(1);
  });

  it('settles every due duel and leaves the rest alone', async () => {
    const db = makeDb({
      'duels/due1': duel(),
      'duels/due2': duel({ progress: { alice: 0, bob: 5 } }),
      'duels/future': duel({ endDate: FUTURE }),
      'duels/target': duel({ mode: 'first_to_target' }),
      'duels/pending': duel({ status: 'pending' }),
      'duels/done': duel({ status: 'completed', winnerId: 'bob', completedAt: 'earlier' }),
      'duels/nodate': duel({ endDate: undefined }),
    });
    const before = clone(['duels/future', 'duels/target', 'duels/pending', 'duels/done', 'duels/nodate'].map((p) => db.docs.get(p)));
    const r = await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    expect(r).toEqual({ settled: 2, skipped: 0 });
    expect(db.docs.get('duels/due1').status).toBe('completed');
    expect(db.docs.get('duels/due2')).toMatchObject({ status: 'completed', winnerId: 'bob' });
    expect(clone(['duels/future', 'duels/target', 'duels/pending', 'duels/done', 'duels/nodate'].map((p) => db.docs.get(p)))).toEqual(before);
  });

  it('asks only for active duels that run to a date, with no range so no index is needed', async () => {
    const db = makeDb({ 'duels/d1': duel() });
    await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    expect(db.log.filter((l) => l[0] === 'query')).toEqual([
      ['query', 'duels', [['status', '==', 'active'], ['mode', '==', 'most_by_deadline']]],
    ]);
  });

  it('changes nothing the second time', async () => {
    const db = makeDb({ 'duels/d1': duel() });
    await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    const once = clone(db.docs.get('duels/d1'));
    const again = await settleExpiredDuels({ db, now: NOW + 3600000, stamp: '2026-10-21T13:00:00.000Z' });
    expect(again).toEqual({ settled: 0, skipped: 0 });
    expect(db.docs.get('duels/d1')).toEqual(once);
  });

  it('does nothing when there are no duels', async () => {
    const db = makeDb();
    expect(await settleExpiredDuels({ db, now: NOW, stamp: STAMP })).toEqual({ settled: 0, skipped: 0 });
    expect(db.log.some((l) => l[0] === 'transaction')).toBe(false);
  });

  it('skips a duel someone else settled after the list was made', async () => {
    const db = makeDb({ 'duels/d1': duel() }, {
      beforeSettle: (path, docs) => { docs.set(path, { ...docs.get(path), status: 'completed', winnerId: 'bob', completedAt: 'earlier' }); },
    });
    const r = await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    expect(r).toEqual({ settled: 0, skipped: 1 });
    expect(db.docs.get('duels/d1')).toMatchObject({ status: 'completed', winnerId: 'bob', completedAt: 'earlier' });
    expect(db.docs.get('duels/d1').settledBy).toBeUndefined();
  });

  it('decides by the progress it reads inside the transaction, not the progress in the list', async () => {
    const db = makeDb({ 'duels/d1': duel({ progress: { alice: 3, bob: 2 } }) }, {
      beforeSettle: (path, docs) => { docs.set(path, { ...docs.get(path), progress: { alice: 3, bob: 4 } }); },
    });
    await settleExpiredDuels({ db, now: NOW, stamp: STAMP });
    expect(db.docs.get('duels/d1')).toMatchObject({ winnerId: 'bob', tied: false });
  });

  it('skips a duel that was deleted after the list was made', async () => {
    const db = makeDb({ 'duels/d1': duel() }, { beforeSettle: (path, docs) => { docs.delete(path); } });
    expect(await settleExpiredDuels({ db, now: NOW, stamp: STAMP })).toEqual({ settled: 0, skipped: 1 });
    expect(db.docs.has('duels/d1')).toBe(false);
  });

  it('settles no more than the limit in one run, and the rest on the next', async () => {
    const seed = {};
    for (let i = 0; i < 5; i += 1) seed[`duels/d${i}`] = duel();
    const db = makeDb(seed);
    expect(await settleExpiredDuels({ db, now: NOW, stamp: STAMP, limit: 3 })).toEqual({ settled: 3, skipped: 0 });
    expect(await settleExpiredDuels({ db, now: NOW, stamp: STAMP, limit: 3 })).toEqual({ settled: 2, skipped: 0 });
    expect([...db.docs.values()].every((d) => d.status === 'completed')).toBe(true);
  });

  it('has a limit of 500 a run', () => {
    expect(SETTLE_LIMIT).toBe(500);
  });

  it('works out the time itself when not given one', async () => {
    const db = makeDb({ 'duels/d1': duel({ endDate: '2020-01-01T00:00:00.000Z' }) });
    const r = await settleExpiredDuels({ db });
    expect(r.settled).toBe(1);
    expect(Number.isFinite(Date.parse(db.docs.get('duels/d1').completedAt))).toBe(true);
  });
});

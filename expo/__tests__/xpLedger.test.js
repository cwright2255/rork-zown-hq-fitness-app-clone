import { fillLeaderboardEntry, handleClaim, processClaim, publishLeaderboard } from '../functions/src/xpLedger';
import { MAX_TOTAL_XP, dailyCap, LEVEL_CAP } from '../lib/xpRules';

// A small in-memory stand-in for the Firestore pieces xpLedger.js uses: db.doc(path) with get() and set(data, { mergeFields }),
// and db.runTransaction, whose transaction has get(ref), set(ref, data) and update(ref, data). Writes are applied when the
// transaction function returns, and a read after a write (which Firestore refuses) throws, so the real order is enforced too.
function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  const log = [];
  const snap = (path) => ({ exists: docs.has(path), data: () => (docs.has(path) ? JSON.parse(JSON.stringify(docs.get(path))) : undefined) });
  const db = {
    docs,
    log,
    doc: (path) => ({
      path,
      get: async () => snap(path),
      set: async (data, options) => {
        log.push(['set', path]);
        if (options && options.mergeFields) {
          const next = { ...(docs.get(path) || {}) };
          options.mergeFields.forEach((f) => {
            if (!(f in data)) throw new Error(`mergeFields names ${f}, which is not in the data`);
            next[f] = data[f];
          });
          docs.set(path, next);
        } else {
          docs.set(path, data);
        }
      },
    }),
    runTransaction: async (fn) => {
      log.push(['transaction']);
      const writes = [];
      let wrote = false;
      const tx = {
        get: async (ref) => {
          if (wrote) throw new Error('reads must come before writes in a transaction');
          return snap(ref.path);
        },
        set: (ref, data) => { wrote = true; writes.push(() => docs.set(ref.path, JSON.parse(JSON.stringify(data)))); },
        update: (ref, data) => {
          wrote = true;
          if (!docs.has(ref.path)) throw new Error('NOT_FOUND: ' + ref.path);
          writes.push(() => docs.set(ref.path, { ...docs.get(ref.path), ...data }));
        },
      };
      const result = await fn(tx);
      writes.forEach((w) => w());
      return result;
    },
  };
  return db;
}

const NOW = Date.UTC(2026, 9, 19, 15, 0, 0);
const TODAY = '2026-10-19';
const STAMP = '2026-10-19T15:00:00.000Z';
const LEDGER = 'users/alice/stats/xp';
const claimPath = (id) => `users/alice/xpClaims/${id}`;
const workout = (extra = {}) => ({ kind: 'workout', day: TODAY, baseExp: 200, ...extra });
const args = (db, claimId, extra = {}) => ({ db, uid: 'alice', claimId, now: NOW, stamp: STAMP, ...extra });

describe('processClaim', () => {
  it('adds the claim to the ledger and marks the claim as dealt with', async () => {
    const db = makeDb({ [claimPath('c1')]: workout() });
    const result = await processClaim(args(db, 'c1'));
    expect(result.status).toBe('applied');
    expect(result.outcome).toEqual({ status: 'awarded', amount: 200, reason: null });
    const ledger = db.docs.get(LEDGER);
    expect(ledger.total).toBe(200);
    expect(ledger.level).toBe(1);
    expect(ledger.ids).toEqual(['c1']);
    expect(ledger.updatedAt).toBe(STAMP);
    expect(db.docs.get(claimPath('c1'))).toEqual({
      kind: 'workout', day: TODAY, baseExp: 200, processedAt: STAMP, result: 'awarded', amount: 200, reason: null,
    });
  });

  it('adds claims one after another', async () => {
    const db = makeDb({
      [claimPath('c1')]: workout({ baseExp: 300 }),
      [claimPath('c2')]: { kind: 'meal', day: TODAY, baseExp: 55, foodKey: 'rice' },
    });
    await processClaim(args(db, 'c1'));
    await processClaim(args(db, 'c2'));
    const ledger = db.docs.get(LEDGER);
    expect(ledger.total).toBe(355);
    expect(ledger.ids).toEqual(['c1', 'c2']);
    expect(ledger.sources).toEqual({ workouts: 300, nutrition: 55, social: 0 });
  });

  it('applies a repeated delivery of the same claim only once', async () => {
    const db = makeDb({ [claimPath('c1')]: workout() });
    expect((await processClaim(args(db, 'c1'))).status).toBe('applied');
    const second = await processClaim(args(db, 'c1'));
    expect(second.status).toBe('duplicate');
    expect(second.ledger.total).toBe(200);
    expect(db.docs.get(LEDGER).total).toBe(200);
  });

  it('does nothing for a claim whose document is gone', async () => {
    const db = makeDb({});
    expect((await processClaim(args(db, 'c1'))).status).toBe('gone');
    expect(db.docs.size).toBe(0);
  });

  it('does not bring back a ledger for an account that was erased', async () => {
    const db = makeDb({ [claimPath('c1')]: workout() });
    db.docs.delete(claimPath('c1')); // erased while the event waited
    await processClaim(args(db, 'c1'));
    expect(db.docs.has(LEDGER)).toBe(false);
  });

  it('ignores a call without a person or a claim', async () => {
    const db = makeDb({});
    expect((await processClaim({ db, uid: '', claimId: 'c1' })).status).toBe('ignored');
    expect((await processClaim({ db, uid: 'alice', claimId: '' })).status).toBe('ignored');
    expect(db.log).toEqual([]);
  });

  it('records a refused claim, so the phone stops waiting for it, and adds nothing', async () => {
    const db = makeDb({ [claimPath('bad')]: workout({ baseExp: 999999 }) });
    const result = await processClaim(args(db, 'bad'));
    expect(result.status).toBe('applied');
    expect(result.outcome).toEqual({ status: 'rejected', reason: 'invalid', amount: 0 });
    expect(db.docs.get(LEDGER).total).toBe(0);
    expect(db.docs.get(LEDGER).ids).toEqual(['bad']);
    expect(db.docs.get(claimPath('bad'))).toMatchObject({ result: 'rejected', reason: 'invalid', amount: 0, processedAt: STAMP });
  });

  it('builds on a ledger that is already there', async () => {
    const db = makeDb({
      [LEDGER]: { total: 5000, level: 4, ids: ['old'], sources: { workouts: 5000, nutrition: 0, social: 0 } },
      [claimPath('c1')]: workout({ baseExp: 100 }),
    });
    await processClaim(args(db, 'c1'));
    const ledger = db.docs.get(LEDGER);
    expect(ledger.total).toBeGreaterThan(5000);
    expect(ledger.ids).toEqual(['old', 'c1']);
  });

  it('works out the level on the server, whatever the stored level says', async () => {
    const db = makeDb({ [LEDGER]: { total: 999, level: 50 }, [claimPath('c1')]: workout({ baseExp: 100 }) });
    await processClaim(args(db, 'c1'));
    expect(db.docs.get(LEDGER).level).toBe(2);
  });

  it('gives a claim that the person filed with a mark of their own no way to skip the check', async () => {
    const db = makeDb({ [claimPath('c1')]: workout({ result: 'awarded', amount: 99999 }) });
    await processClaim(args(db, 'c1'));
    expect(db.docs.get(LEDGER).total).toBe(200);
    expect(db.docs.get(claimPath('c1')).amount).toBe(200);
  });

  describe('the one-off import', () => {
    const imp = (extra = {}) => ({ kind: 'import', day: TODAY, total: 5000000, ...extra });
    const created = (daysAgo) => async () => NOW - daysAgo * 86400000 - 3600000;

    it('is capped by how old the account is, asking for the age only now', async () => {
      const db = makeDb({ [claimPath('import-v1')]: imp() });
      const accountCreatedMs = jest.fn(created(9));
      await processClaim(args(db, 'import-v1', { accountCreatedMs }));
      expect(accountCreatedMs).toHaveBeenCalledTimes(1);
      expect(db.docs.get(LEDGER).total).toBe(dailyCap(LEVEL_CAP) * 10);
    });

    it('does not ask for the age of an account for any other kind of claim', async () => {
      const db = makeDb({ [claimPath('c1')]: workout() });
      const accountCreatedMs = jest.fn(created(9));
      await processClaim(args(db, 'c1', { accountCreatedMs }));
      expect(accountCreatedMs).not.toHaveBeenCalled();
    });

    it('allows one day\'s worth when the age is not known', async () => {
      const db = makeDb({ [claimPath('import-v1')]: imp() });
      await processClaim(args(db, 'import-v1', { accountCreatedMs: async () => null }));
      expect(db.docs.get(LEDGER).total).toBe(dailyCap(LEVEL_CAP));
    });

    it('is taken once', async () => {
      const db = makeDb({ [claimPath('import-v1')]: imp({ total: 700 }), [claimPath('import-v2')]: imp({ total: 700 }) });
      await processClaim(args(db, 'import-v1', { accountCreatedMs: created(30) }));
      const again = await processClaim(args(db, 'import-v2', { accountCreatedMs: created(30) }));
      expect(again.outcome.reason).toBe('already-imported');
      expect(db.docs.get(LEDGER).total).toBe(700);
    });

    it('never makes a total larger than a record can hold', async () => {
      const db = makeDb({ [claimPath('import-v1')]: imp() });
      await processClaim(args(db, 'import-v1', { accountCreatedMs: created(300) }));
      expect(db.docs.get(LEDGER).total).toBe(MAX_TOTAL_XP);
    });

    it('stops the whole run, to be tried again, when the age cannot be looked up', async () => {
      const db = makeDb({ [claimPath('import-v1')]: imp() });
      await expect(processClaim(args(db, 'import-v1', { accountCreatedMs: async () => { throw new Error('auth is down'); } }))).rejects.toThrow('auth is down');
      expect(db.docs.has(LEDGER)).toBe(false);
      expect(db.docs.get(claimPath('import-v1')).processedAt).toBeUndefined();
    });
  });
});

describe('publishLeaderboard', () => {
  const ledger = {
    total: 1500, level: 2, streak: 3,
    distance: { weeks: { w20261012: 4, w20261019: 5 }, months: { m202610: 9 } },
  };

  it('puts XP, level, streak and distance on the entry, and leaves the name and picture alone', async () => {
    const db = makeDb({ 'leaderboard/alice': { name: 'Alice', avatar: 'a.png', xp: 10, level: 1 } });
    expect(await publishLeaderboard({ db, uid: 'alice', ledger, stamp: STAMP })).toBe('published');
    expect(db.docs.get('leaderboard/alice')).toEqual({
      name: 'Alice', avatar: 'a.png', xp: 1500, level: 2, streak: 3,
      distance: { w20261012: 4, w20261019: 5, m202610: 9 }, updatedAt: STAMP,
    });
  });

  it('replaces the distance as a whole, so a week that is over drops off', async () => {
    const db = makeDb({ 'leaderboard/alice': { name: 'Alice', distance: { w20260101: 99, m202601: 99 } } });
    await publishLeaderboard({ db, uid: 'alice', ledger, stamp: STAMP });
    expect(Object.keys(db.docs.get('leaderboard/alice').distance).sort()).toEqual(['m202610', 'w20261012', 'w20261019']);
  });

  it('creates the entry for someone who has none yet', async () => {
    const db = makeDb({});
    await publishLeaderboard({ db, uid: 'alice', ledger, stamp: STAMP });
    expect(db.docs.get('leaderboard/alice')).toMatchObject({ xp: 1500, level: 2, streak: 3 });
    expect(db.docs.get('leaderboard/alice').name).toBeUndefined();
  });

  it('writes nothing for someone who chose not to be shown', async () => {
    const db = makeDb({ 'users/alice/data/settings': { showInLeaderboards: false } });
    expect(await publishLeaderboard({ db, uid: 'alice', ledger, stamp: STAMP })).toBe('hidden');
    expect(db.docs.has('leaderboard/alice')).toBe(false);
  });

  it('shows someone whose setting is on, or was never saved', async () => {
    const on = makeDb({ 'users/alice/data/settings': { showInLeaderboards: true } });
    expect(await publishLeaderboard({ db: on, uid: 'alice', ledger, stamp: STAMP })).toBe('published');
    const other = makeDb({ 'users/alice/data/settings': { units: 'metric' } });
    expect(await publishLeaderboard({ db: other, uid: 'alice', ledger, stamp: STAMP })).toBe('published');
  });
});

describe('handleClaim', () => {
  it('adds the claim and puts the new XP on the leaderboard', async () => {
    const db = makeDb({ [claimPath('c1')]: { kind: 'run', day: TODAY, activity: 'run', distanceKm: 5, durationSec: 1800 } });
    expect(await handleClaim(args(db, 'c1'))).toBe('published');
    expect(db.docs.get('leaderboard/alice')).toEqual({
      xp: 150, level: 1, streak: 1, distance: { w20261019: 5, m202610: 5 }, updatedAt: STAMP,
    });
  });

  it('does not touch the leaderboard when a claim changes nothing that shows', async () => {
    const db = makeDb({ [claimPath('bad')]: workout({ baseExp: 0 }) });
    expect(await handleClaim(args(db, 'bad'))).toBe('unchanged');
    expect(db.docs.has('leaderboard/alice')).toBe(false);
    expect(db.docs.get(LEDGER).ids).toEqual(['bad']);
  });

  it('still keeps the ledger for someone who is hidden, and shows nothing', async () => {
    const db = makeDb({
      [claimPath('c1')]: workout(),
      'users/alice/data/settings': { showInLeaderboards: false },
    });
    expect(await handleClaim(args(db, 'c1'))).toBe('hidden');
    expect(db.docs.get(LEDGER).total).toBe(200);
    expect(db.docs.has('leaderboard/alice')).toBe(false);
  });

  it('puts the entry right again on a repeated delivery, without adding the claim twice', async () => {
    const db = makeDb({ [claimPath('c1')]: workout() });
    await handleClaim(args(db, 'c1'));
    db.docs.delete('leaderboard/alice'); // the first run stopped before publishing
    expect(await handleClaim(args(db, 'c1'))).toBe('published');
    expect(db.docs.get('leaderboard/alice').xp).toBe(200);
    expect(db.docs.get(LEDGER).total).toBe(200);
  });

  it('does nothing for a claim that is gone', async () => {
    const db = makeDb({});
    expect(await handleClaim(args(db, 'c1'))).toBe('gone');
    expect(db.docs.size).toBe(0);
  });

  it('does nothing without a person or a claim', async () => {
    expect(await handleClaim({ db: makeDb({}), uid: '', claimId: 'c1' })).toBe('ignored');
  });

  it('publishes the total after several claims, not just the last', async () => {
    const db = makeDb({
      [claimPath('c1')]: workout({ baseExp: 300 }),
      [claimPath('c2')]: workout({ baseExp: 100 }),
    });
    await handleClaim(args(db, 'c1'));
    await handleClaim(args(db, 'c2'));
    expect(db.docs.get('leaderboard/alice').xp).toBe(400);
  });
});

describe('fillLeaderboardEntry', () => {
  const ledger = { total: 800, level: 1, streak: 2, distance: { weeks: { w20261019: 3 }, months: { m202610: 3 } } };

  it('fills in an entry the phone just created, from the ledger', async () => {
    const db = makeDb({ [LEDGER]: ledger, 'leaderboard/alice': { name: 'Alice' } });
    expect(await fillLeaderboardEntry({ db, uid: 'alice', entry: { name: 'Alice' }, stamp: STAMP })).toBe('published');
    expect(db.docs.get('leaderboard/alice')).toMatchObject({ name: 'Alice', xp: 800, level: 1, streak: 2, distance: { w20261019: 3, m202610: 3 } });
  });

  it('leaves an entry that already has XP alone', async () => {
    const db = makeDb({ [LEDGER]: ledger });
    expect(await fillLeaderboardEntry({ db, uid: 'alice', entry: { name: 'A', xp: 5 }, stamp: STAMP })).toBe('has-xp');
    expect(db.log).toEqual([]);
  });

  it('leaves it alone for someone with no ledger yet', async () => {
    const db = makeDb({});
    expect(await fillLeaderboardEntry({ db, uid: 'alice', entry: { name: 'A' }, stamp: STAMP })).toBe('no-ledger');
    expect(db.docs.size).toBe(0);
  });

  it('fills in an entry the person made themselves even when their setting has not been saved yet', async () => {
    // The phone makes the entry only when the setting is on; the setting reaches the server a moment later, or after.
    const db = makeDb({ [LEDGER]: ledger, 'users/alice/data/settings': { showInLeaderboards: false } });
    expect(await fillLeaderboardEntry({ db, uid: 'alice', entry: { name: 'A' }, stamp: STAMP })).toBe('published');
    expect(db.docs.get('leaderboard/alice').xp).toBe(800);
  });

  it('copes with an entry that has no data, and with no person', async () => {
    const db = makeDb({ [LEDGER]: ledger });
    expect(await fillLeaderboardEntry({ db, uid: 'alice', entry: undefined, stamp: STAMP })).toBe('published');
    expect(await fillLeaderboardEntry({ db, uid: '', entry: {} })).toBe('ignored');
  });
});

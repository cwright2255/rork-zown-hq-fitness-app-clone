import { tierOf, checkFeature, takeAiQuota, giveBackAiQuota, aiRequestPlan } from '../functions/src/aiQuota';

// A small stand-in for Firestore: documents in a map, doc(path).get(), and runTransaction(fn) with tx.get / tx.set (merge). Transactions
// run one at a time, as in the real database, where a transaction whose document changed under it is run again.
function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let queue = Promise.resolve();
  const ref = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  return {
    docs,
    doc: ref,
    runTransaction: (fn) => {
      const run = queue.then(() => fn({
        get: async (r) => r.get(),
        set: (r, data, opts) => docs.set(r.path, opts && opts.merge ? { ...docs.get(r.path), ...data } : data),
      }));
      queue = run.catch(() => {});
      return run;
    },
  };
}

const NOW = new Date('2026-10-20T15:00:00.000Z'); // the day is 2026-10-20 in New York
const pro = { tier: 'pro', status: 'active', expiresAt: null };
const legend = { tier: 'legend', status: 'active', expiresAt: null };
const take = (db, kind, over = {}) => takeAiQuota({ db, uid: 'u1', kind, now: NOW, ...over });

describe('tierOf', () => {
  it('is free for a person with no plan document', async () => {
    expect(await tierOf(makeDb(), 'u1', NOW)).toBe('free');
  });

  it('is the plan in their document, and only theirs', async () => {
    const db = makeDb({ 'entitlements/u1': pro, 'entitlements/u2': legend });
    expect(await tierOf(db, 'u1', NOW)).toBe('pro');
    expect(await tierOf(db, 'u2', NOW)).toBe('legend');
    expect(await tierOf(db, 'u3', NOW)).toBe('free');
  });

  it('is free when the plan has ended', async () => {
    const db = makeDb({ 'entitlements/u1': { ...pro, expiresAt: '2026-10-19T00:00:00.000Z' } });
    expect(await tierOf(db, 'u1', NOW)).toBe('free');
  });
});

describe('checkFeature', () => {
  it('turns a free person away from Pro and Legend features, and says what is needed', async () => {
    const db = makeDb();
    expect(await checkFeature({ db, uid: 'u1', feature: 'aiWorkoutPlan', now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'pro' });
    expect(await checkFeature({ db, uid: 'u1', feature: 'bodyScan', now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'legend' });
  });

  it('lets Pro into Pro features and turns it away from Legend ones', async () => {
    const db = makeDb({ 'entitlements/u1': pro });
    expect(await checkFeature({ db, uid: 'u1', feature: 'aiWorkoutPlan', now: NOW })).toEqual({ ok: true, tier: 'pro', needs: 'pro' });
    expect(await checkFeature({ db, uid: 'u1', feature: 'bodyScan', now: NOW })).toEqual({ ok: false, tier: 'pro', needs: 'legend' });
  });

  it('lets Free into nothing that is locked: the daily Today brief is Pro', async () => {
    expect(await checkFeature({ db: makeDb(), uid: 'u1', feature: 'todayBrief', now: NOW })).toEqual({ ok: false, tier: 'free', needs: 'pro' });
    expect(await checkFeature({ db: makeDb({ 'entitlements/u1': pro }), uid: 'u1', feature: 'todayBrief', now: NOW })).toEqual({ ok: true, tier: 'pro', needs: 'pro' });
  });

  it('lets Legend into everything', async () => {
    const db = makeDb({ 'entitlements/u1': legend });
    for (const feature of ['aiWorkoutPlan', 'analytics', 'todayBrief', 'bodyScan']) {
      expect((await checkFeature({ db, uid: 'u1', feature, now: NOW })).ok).toBe(true);
    }
  });

  it('lets anyone into a feature that is not locked', async () => {
    expect((await checkFeature({ db: makeDb(), uid: 'u1', feature: 'logWorkout', now: NOW })).ok).toBe(true);
  });
});

describe('aiRequestPlan', () => {
  it('counts the daily Today brief with the comments the app asks for by itself, and says it needs the Today brief feature', () => {
    expect(aiRequestPlan('brief')).toEqual({ bucket: 'insight', feature: 'todayBrief' });
  });

  it('counts the Coach\'s notes about a person with those comments too, for every plan', () => {
    expect(aiRequestPlan('memory')).toEqual({ bucket: 'insight', feature: null });
  });

  it('counts every other kind where bucketOf says, and needs no feature', () => {
    expect(aiRequestPlan('coach')).toEqual({ bucket: 'coach', feature: null });
    expect(aiRequestPlan('assist')).toEqual({ bucket: 'assist', feature: null });
    expect(aiRequestPlan('insight')).toEqual({ bucket: 'insight', feature: null });
  });

  it('counts a request that says nothing, or something unknown, as the Coach\'s, the strictest, with no feature', () => {
    for (const kind of [undefined, null, '', 'whatever', 'Brief', 'briefs', 'Memory', 'memories', 7]) expect(aiRequestPlan(kind)).toEqual({ bucket: 'coach', feature: null });
  });

  it('is taken from the Free allowance of insight comments when a Free person somehow gets as far as the count', async () => {
    const db = makeDb();
    const first = await take(db, aiRequestPlan('brief').bucket);
    expect(first).toMatchObject({ ok: true, bucket: 'insight', limit: 9, used: 1 });
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', insight: 1 });
  });
});

describe('takeAiQuota', () => {
  it('takes one message and says how many have been used and what the limit is', async () => {
    const db = makeDb();
    expect(await take(db, 'coach')).toEqual({ ok: true, used: 1, tier: 'free', bucket: 'coach', limit: 5, day: '2026-10-20' });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 2 });
  });

  it('records the count for that person and day, with the person and the day on it', async () => {
    const db = makeDb();
    await take(db, 'coach');
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 1 });
  });

  it('gives a free person 5 Coach messages and refuses the sixth without changing the count', async () => {
    const db = makeDb();
    for (let i = 1; i <= 5; i += 1) expect(await take(db, 'coach')).toMatchObject({ ok: true, used: i });
    const sixth = await take(db, 'coach');
    expect(sixth).toMatchObject({ ok: false, used: 5, limit: 5, tier: 'free', bucket: 'coach' });
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(5);
  });

  it('counts the Coach and the other helpers separately', async () => {
    const db = makeDb();
    for (let i = 0; i < 5; i += 1) await take(db, 'coach');
    expect((await take(db, 'coach')).ok).toBe(false);
    expect(await take(db, 'assist')).toMatchObject({ ok: true, used: 1, bucket: 'assist' });
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 5, assist: 1 });
  });

  it('counts the comment the Health screen asks for on its own, so it cannot use up the messages a person sends', async () => {
    const db = makeDb();
    for (let i = 1; i <= 9; i += 1) expect(await take(db, 'insight')).toMatchObject({ ok: true, used: i, bucket: 'insight', limit: 9 });
    expect(await take(db, 'insight')).toMatchObject({ ok: false, used: 9 });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 1 });
    expect(await take(db, 'assist')).toMatchObject({ ok: true, used: 1 });
  });

  it('counts a request that says nothing, or something else, against the Coach', async () => {
    const db = makeDb();
    await take(db, undefined);
    await take(db, 'banana');
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toMatchObject({ coach: 2 });
    expect(db.docs.get('aiUsage/u1_2026-10-20').assist).toBeUndefined();
  });

  it('gives Pro 100 messages and Legend 300, in each bucket', async () => {
    const proDb = makeDb({ 'entitlements/u1': pro, 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 99, assist: 99 } });
    expect(await take(proDb, 'coach')).toMatchObject({ ok: true, used: 100, limit: 100, tier: 'pro' });
    expect((await take(proDb, 'coach')).ok).toBe(false);
    expect(await take(proDb, 'assist')).toMatchObject({ ok: true, used: 100, limit: 100 });
    expect((await take(proDb, 'assist')).ok).toBe(false);

    const legendDb = makeDb({ 'entitlements/u1': legend, 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 299 } });
    expect(await take(legendDb, 'coach')).toMatchObject({ ok: true, used: 300, limit: 300, tier: 'legend' });
    expect((await take(legendDb, 'coach')).ok).toBe(false);
  });

  it('uses the limit of the plan the person has when they ask, so an upgrade takes effect at once', async () => {
    const db = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 5 } });
    expect((await take(db, 'coach')).ok).toBe(false);
    db.docs.set('entitlements/u1', pro);
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 6, limit: 100 });
  });

  it('falls back to the free limit when the plan has ended', async () => {
    const db = makeDb({ 'entitlements/u1': { ...pro, status: 'expired' }, 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 5 } });
    expect(await take(db, 'coach')).toMatchObject({ ok: false, tier: 'free', limit: 5 });
  });

  it('starts a new count at midnight in New York, and keeps each day\'s count', async () => {
    const db = makeDb();
    const late = new Date('2026-10-20T03:30:00.000Z'); // 11:30 PM on the 19th in New York
    const early = new Date('2026-10-20T04:30:00.000Z'); // 12:30 AM on the 20th
    for (let i = 0; i < 5; i += 1) await take(db, 'coach', { now: late });
    expect((await take(db, 'coach', { now: late })).ok).toBe(false);
    expect(await take(db, 'coach', { now: early })).toMatchObject({ ok: true, used: 1, day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-19').coach).toBe(5);
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(1);
  });

  it('counts each person on their own', async () => {
    const db = makeDb();
    for (let i = 0; i < 5; i += 1) await take(db, 'coach');
    expect((await take(db, 'coach')).ok).toBe(false);
    expect(await take(db, 'coach', { uid: 'u2' })).toMatchObject({ ok: true, used: 1 });
  });

  it('lets exactly the allowance through when many messages arrive at once', async () => {
    const db = makeDb();
    const results = await Promise.all(Array.from({ length: 12 }, () => take(db, 'coach')));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok)).toHaveLength(7);
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(5);
  });

  it('reads a damaged count as zero rather than failing, and never as a negative', async () => {
    for (const bad of ['many', -3, null, NaN, {}]) {
      const db = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: bad } });
      expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 1 });
    }
    const half = makeDb({ 'aiUsage/u1_2026-10-20': { uid: 'u1', day: '2026-10-20', coach: 4.9 } });
    expect(await take(half, 'coach')).toMatchObject({ ok: true, used: 5 });
  });

  it('passes a database failure on, so the request fails instead of getting a free message', async () => {
    const db = makeDb();
    db.runTransaction = async () => { throw new Error('unavailable'); };
    await expect(take(db, 'coach')).rejects.toThrow('unavailable');
    const noRead = makeDb();
    noRead.doc = () => ({ get: async () => { throw new Error('read failed'); } });
    await expect(take(noRead, 'coach')).rejects.toThrow('read failed');
  });
});

describe('giveBackAiQuota', () => {
  it('gives back one message in the bucket it was taken from', async () => {
    const db = makeDb();
    await take(db, 'coach');
    await take(db, 'coach');
    await take(db, 'assist');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-20')).toEqual({ uid: 'u1', day: '2026-10-20', coach: 1, assist: 1 });
  });

  it('never goes below zero, and does nothing when there is no count', async () => {
    const db = makeDb();
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.size).toBe(0);
    await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-20').coach).toBe(0);
  });

  it('leaves another day\'s count alone', async () => {
    const db = makeDb({ 'aiUsage/u1_2026-10-19': { uid: 'u1', day: '2026-10-19', coach: 3 } });
    await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(db.docs.get('aiUsage/u1_2026-10-19').coach).toBe(3);
  });

  it('makes room for another message', async () => {
    const db = makeDb();
    for (let i = 0; i < 5; i += 1) await take(db, 'coach');
    await giveBackAiQuota({ db, uid: 'u1', bucket: 'coach', day: '2026-10-20' });
    expect(await take(db, 'coach')).toMatchObject({ ok: true, used: 5 });
  });
});

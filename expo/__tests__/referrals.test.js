// Invite codes and the reward for a friend who joins with one (functions/src/referrals.js). The server decides all of it: who a code belongs to,
// whether a friend may use it, and the Pro days both get. These run the real logic against a small stand-in for Firestore in which transactions
// run one at a time, as in the real database.
import {
  REFERRAL_RULES, CODE_ALPHABET, normalizeCode, isValidCode, formatCode, makeCode, planGrant, statusOf, getInviteStatus, redeemInvite,
} from '../functions/src/referrals';
import { tierOf } from '../functions/src/aiQuota';

function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let queue = Promise.resolve();
  const ref = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  return {
    docs,
    doc: ref,
    runTransaction: (fn) => {
      const run = queue.then(async () => {
        const writes = [];
        const result = await fn({
          get: async (r) => r.get(),
          set: (r, data, opts) => writes.push([r.path, opts && opts.merge ? { ...docs.get(r.path), ...data } : data]),
        });
        writes.forEach(([path, data]) => docs.set(path, data)); // all or nothing, as a transaction commits
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

const DAY = 86400000;
const NOW = new Date('2026-10-28T15:00:00.000Z');
const STAMP = NOW.toISOString();
const CODE = 'K7P2QX4M';
const fresh = (days = 1) => async () => NOW.getTime() - days * DAY;
const withCode = (extra = {}) => ({
  'inviteCodes/K7P2QX4M': { uid: 'alice', createdAt: '2026-10-01T00:00:00.000Z' },
  'users/alice/stats/invite': { code: CODE, joined: 0, rewarded: 0, daysEarned: 0, ...extra },
});
const join = (db, over = {}) => redeemInvite({ db, uid: 'bob', code: CODE, accountCreatedMs: fresh(), now: NOW, ...over });
const plan = (db, uid) => db.docs.get(`entitlements/${uid}`);
const manualPro = { tier: 'pro', status: 'active', expiresAt: null, source: 'manual' };

describe('codes', () => {
  it('are 8 letters and digits with nothing that is read wrong (no I, L, O, 0 or 1)', () => {
    expect(CODE_ALPHABET).not.toMatch(/[ILO01]/);
    expect(CODE_ALPHABET).toHaveLength(31);
    for (let i = 0; i < 200; i += 1) expect(makeCode()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });

  it('are made from the random numbers asked for, one per character', () => {
    const asked = [];
    const code = makeCode((n) => { asked.push(n); return asked.length - 1; });
    expect(asked).toEqual(Array(8).fill(31));
    expect(code).toBe(CODE_ALPHABET.slice(0, 8));
  });

  it('are read from what a person types: capitals, with spaces and dashes gone', () => {
    expect(normalizeCode(' k7p2-qx4m ')).toBe('K7P2QX4M');
    expect(normalizeCode('K7P2 QX4M')).toBe('K7P2QX4M');
    expect(normalizeCode(undefined)).toBe('');
    expect(normalizeCode(12345678)).toBe('');
  });

  it('are shown in two halves, and only when they are real', () => {
    expect(formatCode(CODE)).toBe('K7P2-QX4M');
    expect(formatCode('nope')).toBe('');
    expect(isValidCode(CODE)).toBe(true);
    ['K7P2QX4', 'K7P2QX4MM', 'k7p2qx4m', 'K7P2QX40', 'K7P2QXIL', '', null, undefined, 12345678].forEach((bad) => expect(isValidCode(bad)).toBe(false));
  });
});

describe('getInviteStatus', () => {
  it('makes the person a code the first time, and records whose it is', async () => {
    const db = makeDb();
    const status = await getInviteStatus({ db, uid: 'alice', random: () => 5, stamp: STAMP });
    expect(status.code).toBe(CODE_ALPHABET[5].repeat(8));
    expect(db.docs.get(`inviteCodes/${status.code}`)).toEqual({ uid: 'alice', createdAt: STAMP });
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ code: status.code });
    expect(status.display).toBe(`${status.code.slice(0, 4)}-${status.code.slice(4)}`);
  });

  it('gives the same code every time after, and makes no second one', async () => {
    const db = makeDb();
    const first = await getInviteStatus({ db, uid: 'alice' });
    const again = await getInviteStatus({ db, uid: 'alice' });
    expect(again.code).toBe(first.code);
    expect([...db.docs.keys()].filter((p) => p.startsWith('inviteCodes/'))).toHaveLength(1);
  });

  it('gives different people different codes', async () => {
    const db = makeDb();
    const a = await getInviteStatus({ db, uid: 'alice' });
    const b = await getInviteStatus({ db, uid: 'bob' });
    expect(a.code).not.toBe(b.code);
  });

  it('makes two people asking at once one code each, and the same code to the same person asking twice at once', async () => {
    const db = makeDb();
    const [a1, a2, b1] = await Promise.all([
      getInviteStatus({ db, uid: 'alice' }), getInviteStatus({ db, uid: 'alice' }), getInviteStatus({ db, uid: 'bob' }),
    ]);
    expect(a1.code).toBe(a2.code);
    expect(a1.code).not.toBe(b1.code);
    expect([...db.docs.keys()].filter((p) => p.startsWith('inviteCodes/'))).toHaveLength(2);
  });

  it('tries again with another code when the one it made belongs to somebody', async () => {
    const taken = CODE_ALPHABET[0].repeat(8);
    const db = makeDb({ [`inviteCodes/${taken}`]: { uid: 'carol' } });
    const numbers = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
    let i = 0;
    const status = await getInviteStatus({ db, uid: 'alice', random: () => numbers[i++] });
    expect(status.code).toBe(CODE_ALPHABET[1].repeat(8));
    expect(db.docs.get(`inviteCodes/${taken}`)).toEqual({ uid: 'carol' });
  });

  it('gives up, rather than hand out a code that is taken, when every try is taken', async () => {
    const taken = CODE_ALPHABET[0].repeat(8);
    const db = makeDb({ [`inviteCodes/${taken}`]: { uid: 'carol' } });
    await expect(getInviteStatus({ db, uid: 'alice', random: () => 0 })).rejects.toThrow(/could not make an invite code/);
    expect(db.docs.has('users/alice/stats/invite')).toBe(false);
    expect(db.docs.get(`inviteCodes/${taken}`)).toEqual({ uid: 'carol' });
  });

  it('reports how the invites are going, and the rules, and nothing about who joined', async () => {
    const db = makeDb(withCode({ joined: 3, rewarded: 3, daysEarned: 21, lastJoinedAt: STAMP }));
    const status = await getInviteStatus({ db, uid: 'alice' });
    expect(status).toEqual({
      code: CODE, display: 'K7P2-QX4M', joined: 3, rewarded: 3, daysEarned: 21, redeemed: false, friendDaysGiven: 0,
      rules: { friendDays: 7, inviterDays: 7, maxRewardedInvites: 5, accountWindowDays: 14 },
    });
  });

  it('says a person joined with a code once they have', async () => {
    const db = makeDb({ ...withCode(), 'users/bob/stats/invite': { redeemedAt: STAMP, redeemedCode: CODE, friendDays: 7 } });
    const status = await getInviteStatus({ db, uid: 'bob' });
    expect(status).toMatchObject({ redeemed: true, friendDaysGiven: 7 });
    expect(status.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/); // and still has a code of their own
  });

  it('needs a person', async () => {
    await expect(getInviteStatus({ db: makeDb(), uid: '' })).rejects.toThrow(/uid is required/);
    await expect(getInviteStatus({ db: makeDb(), uid: undefined })).rejects.toThrow(/uid is required/);
  });

  it('shows a damaged record as no invites at all, never as an error', () => {
    expect(statusOf(null)).toMatchObject({ code: null, display: '', joined: 0, rewarded: 0, daysEarned: 0, redeemed: false });
    expect(statusOf({ code: 'bad', joined: -3, rewarded: 'x', daysEarned: NaN, redeemedAt: 5 })).toMatchObject({
      code: null, joined: 0, rewarded: 0, daysEarned: 0, redeemed: false,
    });
  });
});

describe('the days given', () => {
  it('are a Pro plan that ends in that many days, for a person on Free', () => {
    expect(planGrant({ raw: null, days: 7, now: NOW })).toEqual({
      tier: 'pro', status: 'trialing', expiresAt: new Date(NOW.getTime() + 7 * DAY).toISOString(), source: 'referral', updatedAt: STAMP,
    });
  });

  it('are a new plan for a person whose old plan ended or who was on Free by document', () => {
    expect(planGrant({ raw: { tier: 'free', status: 'active' }, days: 7, now: NOW })).toMatchObject({ tier: 'pro', source: 'referral' });
    expect(planGrant({ raw: { ...manualPro, expiresAt: '2026-10-01T00:00:00.000Z' }, days: 7, now: NOW })).toMatchObject({ tier: 'pro', source: 'referral' });
    expect(planGrant({ raw: { ...manualPro, status: 'expired' }, days: 7, now: NOW })).toMatchObject({ tier: 'pro', source: 'referral' });
  });

  it('are added to the end of a referral plan the person still has', () => {
    const raw = { tier: 'pro', status: 'trialing', expiresAt: new Date(NOW.getTime() + 3 * DAY).toISOString(), source: 'referral' };
    expect(planGrant({ raw, days: 7, now: NOW }).expiresAt).toBe(new Date(NOW.getTime() + 10 * DAY).toISOString());
  });

  it('start from today for a referral plan that has run out', () => {
    const raw = { tier: 'pro', status: 'trialing', expiresAt: new Date(NOW.getTime() - 3 * DAY).toISOString(), source: 'referral' };
    expect(planGrant({ raw, days: 7, now: NOW }).expiresAt).toBe(new Date(NOW.getTime() + 7 * DAY).toISOString());
  });

  it('never replace a plan the person bought or was given: nothing changes', () => {
    [manualPro, { ...manualPro, source: 'revenuecat' }, { ...manualPro, status: 'cancelled', expiresAt: new Date(NOW.getTime() + DAY).toISOString() },
      { tier: 'legend', status: 'active', expiresAt: null, source: 'referral' }].forEach((raw) => {
      expect(planGrant({ raw, days: 7, now: NOW })).toBeNull();
    });
  });

  it('are nothing when there are no days to give', () => {
    [0, -1, NaN, undefined].forEach((days) => expect(planGrant({ raw: null, days, now: NOW })).toBeNull());
  });
});

describe('joining with a code', () => {
  it('gives the friend and the person whose code it was seven Pro days each, and counts the friend', async () => {
    const db = makeDb(withCode());
    const result = await join(db);
    expect(result).toEqual({ ok: true, friendDays: 7, inviterDays: 7 });
    const ends = new Date(NOW.getTime() + 7 * DAY).toISOString();
    expect(plan(db, 'bob')).toEqual({ tier: 'pro', status: 'trialing', expiresAt: ends, source: 'referral', updatedAt: STAMP });
    expect(plan(db, 'alice')).toEqual({ tier: 'pro', status: 'trialing', expiresAt: ends, source: 'referral', updatedAt: STAMP });
    expect(db.docs.get('users/bob/stats/invite')).toMatchObject({ redeemedAt: STAMP, redeemedCode: CODE, friendDays: 7 });
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ code: CODE, joined: 1, rewarded: 1, daysEarned: 7, lastJoinedAt: STAMP });
  });

  it('gives a plan every Pro check on the server understands, and one that ends when the days are over', async () => {
    const db = makeDb(withCode());
    await join(db);
    expect(await tierOf(db, 'bob', NOW)).toBe('pro');
    expect(await tierOf(db, 'alice', NOW)).toBe('pro');
    expect(await tierOf(db, 'bob', new Date(NOW.getTime() + 6 * DAY))).toBe('pro');
    expect(await tierOf(db, 'bob', new Date(NOW.getTime() + 7 * DAY + 1000))).toBe('free');
    expect(await tierOf(db, 'carol', NOW)).toBe('free');
  });

  it('takes the code as it was typed: lower case, spaces, a dash', async () => {
    for (const typed of ['k7p2-qx4m', ' K7P2 QX4M ', 'K7P2-QX4M', 'k7p2qx4m']) {
      const db = makeDb(withCode());
      expect((await join(db, { code: typed })).ok).toBe(true);
    }
  });

  it('adds the days to a referral plan the person whose code it was already has', async () => {
    const mine = { tier: 'pro', status: 'trialing', expiresAt: new Date(NOW.getTime() + 2 * DAY).toISOString(), source: 'referral' };
    const db = makeDb({ ...withCode({ joined: 1, rewarded: 1, daysEarned: 7 }), 'entitlements/alice': mine });
    await join(db);
    expect(plan(db, 'alice').expiresAt).toBe(new Date(NOW.getTime() + 9 * DAY).toISOString());
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 2, rewarded: 2, daysEarned: 14 });
  });

  it('leaves a friend\'s own plan alone, gives them no days, and still pays the person whose code it was', async () => {
    const db = makeDb({ ...withCode(), 'entitlements/bob': manualPro });
    const result = await join(db);
    expect(result).toEqual({ ok: true, friendDays: 0, inviterDays: 7 });
    expect(plan(db, 'bob')).toEqual(manualPro);
    expect(plan(db, 'alice')).toMatchObject({ source: 'referral' });
    expect(db.docs.get('users/bob/stats/invite')).toMatchObject({ redeemedAt: STAMP, friendDays: 0 });
  });

  it('leaves the plan of the person whose code it was alone, and still counts the friend against the limit', async () => {
    const legend = { tier: 'legend', status: 'active', expiresAt: null, source: 'manual' };
    const db = makeDb({ ...withCode(), 'entitlements/alice': legend });
    const result = await join(db);
    expect(result).toEqual({ ok: true, friendDays: 7, inviterDays: 0 });
    expect(plan(db, 'alice')).toEqual(legend);
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 1, rewarded: 1, daysEarned: 0 });
  });

  it('works for a friend whose account is exactly as old as the window allows, and not one second older', async () => {
    const window = REFERRAL_RULES.accountWindowDays * DAY;
    expect((await join(makeDb(withCode()), { accountCreatedMs: async () => NOW.getTime() - window })).ok).toBe(true);
    expect(await join(makeDb(withCode()), { accountCreatedMs: async () => NOW.getTime() - window - 1 })).toEqual({ ok: false, reason: 'too-old' });
  });
});

describe('a code that does not pay out', () => {
  const unchanged = (db, seed) => {
    const keep = ['entitlements/bob', 'entitlements/alice', 'inviteCodes/K7P2QX4M'];
    keep.forEach((p) => expect(db.docs.get(p)).toEqual(seed[p]));
  };

  it('is not a real code: nothing is given, and it is counted as a wrong try', async () => {
    const db = makeDb(withCode());
    for (const typed of ['ZZZZZZZZ', 'nope', '', '12345678', 'K7P2QX4']) {
      expect(await join(db, { code: typed })).toEqual({ ok: false, reason: 'invalid-code' });
    }
    expect(plan(db, 'bob')).toBeUndefined();
    expect(plan(db, 'alice')).toBeUndefined();
    expect(db.docs.get('users/bob/stats/invite')).toEqual({ badTries: 5 });
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 0, rewarded: 0, daysEarned: 0 });
  });

  it('turns an account away after too many wrong tries, even with a real code, and does not count the turned-away ones', async () => {
    const db = makeDb(withCode());
    for (let i = 0; i < REFERRAL_RULES.maxBadTries; i += 1) await join(db, { code: 'ZZZZZZZZ' });
    expect(db.docs.get('users/bob/stats/invite').badTries).toBe(REFERRAL_RULES.maxBadTries);
    expect(await join(db)).toEqual({ ok: false, reason: 'too-many-tries' });
    expect(await join(db, { code: 'ZZZZZZZZ' })).toEqual({ ok: false, reason: 'too-many-tries' });
    expect(db.docs.get('users/bob/stats/invite').badTries).toBe(REFERRAL_RULES.maxBadTries);
    expect(plan(db, 'bob')).toBeUndefined();
  });

  it('is the person\'s own', async () => {
    const seed = withCode();
    const db = makeDb(seed);
    expect(await redeemInvite({ db, uid: 'alice', code: CODE, accountCreatedMs: fresh(), now: NOW })).toEqual({ ok: false, reason: 'own-code' });
    expect(plan(db, 'alice')).toBeUndefined();
    expect(db.docs.get('users/alice/stats/invite')).toEqual(seed['users/alice/stats/invite']);
  });

  it('is a second one: an account joins once, and is paid once', async () => {
    const db = makeDb({ ...withCode(), 'inviteCodes/H3WZ9N5R': { uid: 'carol' } });
    expect((await join(db)).ok).toBe(true);
    const planAfterFirst = plan(db, 'bob');
    expect(await join(db)).toEqual({ ok: false, reason: 'already-redeemed' });
    expect(await join(db, { code: 'H3WZ9N5R' })).toEqual({ ok: false, reason: 'already-redeemed' });
    expect(plan(db, 'bob')).toEqual(planAfterFirst);
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 1, rewarded: 1, daysEarned: 7 });
    expect(plan(db, 'carol')).toBeUndefined();
  });

  it('is used by an account that is too old, or whose age is not known', async () => {
    const seed = withCode();
    for (const created of [fresh(15), fresh(400), async () => null, async () => NaN, async () => undefined]) {
      const db = makeDb(seed);
      expect(await join(db, { accountCreatedMs: created })).toEqual({ ok: false, reason: 'too-old' });
      expect(plan(db, 'bob')).toBeUndefined();
      expect(db.docs.get('users/bob/stats/invite')).toBeUndefined(); // and it was not counted as a wrong try
    }
  });

  it('has already paid for as many friends as it may', async () => {
    const seed = { ...withCode({ joined: 5, rewarded: 5, daysEarned: 35 }), 'entitlements/alice': { tier: 'pro', status: 'trialing', expiresAt: '2026-12-01T00:00:00.000Z', source: 'referral' } };
    const db = makeDb(seed);
    expect(await join(db)).toEqual({ ok: false, reason: 'code-full' });
    expect(plan(db, 'bob')).toBeUndefined();
    expect(db.docs.get('users/alice/stats/invite')).toEqual(seed['users/alice/stats/invite']);
    unchanged(db, { ...seed, 'entitlements/bob': undefined });
  });

  it('still pays for the last friend it may: the fifth', async () => {
    const db = makeDb(withCode({ joined: 4, rewarded: 4, daysEarned: 28 }));
    expect((await join(db)).ok).toBe(true);
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 5, rewarded: 5, daysEarned: 35 });
    expect(await redeemInvite({ db, uid: 'dave', code: CODE, accountCreatedMs: fresh(), now: NOW })).toEqual({ ok: false, reason: 'code-full' });
  });

  it('belongs to an account whose code was removed (the account was erased)', async () => {
    const db = makeDb({ 'users/alice/stats/invite': { code: CODE } }); // no inviteCodes document
    expect(await join(db)).toEqual({ ok: false, reason: 'invalid-code' });
    expect(plan(db, 'bob')).toBeUndefined();
  });
});

describe('several people at once', () => {
  it('pays each of two friends joining at the same time, and counts both', async () => {
    const db = makeDb(withCode());
    const [a, b] = await Promise.all([
      join(db), redeemInvite({ db, uid: 'carol', code: CODE, accountCreatedMs: fresh(), now: NOW }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 2, rewarded: 2, daysEarned: 14 });
    expect(plan(db, 'alice').expiresAt).toBe(new Date(NOW.getTime() + 14 * DAY).toISOString());
  });

  it('pays one account once when it tries twice at the same time', async () => {
    const db = makeDb(withCode());
    const results = await Promise.all([join(db), join(db)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: 'already-redeemed' }]);
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 1, rewarded: 1, daysEarned: 7 });
  });

  it('never pays a sixth friend when six join at once', async () => {
    const db = makeDb(withCode());
    const results = await Promise.all(['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((uid) => (
      redeemInvite({ db, uid, code: CODE, accountCreatedMs: fresh(), now: NOW })
    )));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok).map((r) => r.reason)).toEqual(['code-full']);
    expect(db.docs.get('users/alice/stats/invite')).toMatchObject({ joined: 5, rewarded: 5, daysEarned: 35 });
  });
});

describe('asking', () => {
  it('needs a person', async () => {
    await expect(redeemInvite({ db: makeDb(withCode()), uid: '', code: CODE })).rejects.toThrow(/uid is required/);
  });

  it('never throws for what a person typed', async () => {
    const db = makeDb(withCode());
    for (const code of [undefined, null, 5, {}, [], '   ', '%%%', 'a'.repeat(5000)]) {
      await expect(join(db, { code })).resolves.toMatchObject({ ok: false });
    }
  });
});

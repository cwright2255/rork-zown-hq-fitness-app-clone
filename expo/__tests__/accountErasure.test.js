import { eraseUserAccount, USER_KEYED_COLLECTIONS, STORAGE_PREFIXES } from '../functions/src/accountErasure';

// ---- A small in-memory stand-in for Firestore, Storage and Auth -------------------------------
// Documents live in one map keyed by path ("users/u1/bodyScans/s1"). It supports exactly what the
// erase code uses: where (== and array-contains), select, orderBy('__name__'), limit, startAfter,
// get, add, getAll, bulkWriter (delete / update), recursiveDelete.

const INC = Symbol('increment');
const increment = (n) => ({ [INC]: n });

const parent = (path) => path.split('/').slice(0, -1).join('/');
const idOf = (path) => path.split('/').pop();

function makeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));
  const calls = [];
  let autoId = 0;

  const ref = (path) => ({ path, id: idOf(path), parentPath: parent(path) });
  const snap = (path) => ({
    id: idOf(path),
    ref: ref(path),
    exists: docs.has(path),
    data: () => docs.get(path),
  });

  const query = (collPath, filters = [], opts = {}) => ({
    where: (field, op, value) => query(collPath, [...filters, { field, op, value }], opts),
    select: () => query(collPath, filters, opts),
    orderBy: () => query(collPath, filters, { ...opts, ordered: true }),
    limit: (n) => query(collPath, filters, { ...opts, limit: n }),
    startAfter: (d) => query(collPath, filters, { ...opts, after: d.id }),
    get: async () => {
      calls.push(['query', collPath]);
      let rows = [...docs.keys()].filter((p) => parent(p) === collPath);
      rows = rows.filter((p) => filters.every(({ field, op, value }) => {
        const v = docs.get(p)?.[field];
        if (op === '==') return v === value;
        if (op === 'array-contains') return Array.isArray(v) && v.includes(value);
        throw new Error('unsupported operator ' + op);
      }));
      rows.sort((a, b) => (idOf(a) < idOf(b) ? -1 : 1));
      if (opts.after) rows = rows.filter((p) => idOf(p) > opts.after);
      if (opts.limit) rows = rows.slice(0, opts.limit);
      const list = rows.map(snap);
      return { docs: list, size: list.length, empty: list.length === 0 };
    },
    add: async (data) => {
      const path = `${collPath}/auto${++autoId}`;
      docs.set(path, data);
      return ref(path);
    },
  });

  const db = {
    docs,
    calls,
    failRecursiveDelete: null,
    collection: (path) => query(path),
    doc: (path) => ref(path),
    getAll: async (...refs) => refs.map((r) => snap(r.path)),
    recursiveDelete: async (r) => {
      if (db.failRecursiveDelete && db.failRecursiveDelete(r.path)) throw new Error('recursiveDelete failed for ' + r.path);
      calls.push(['recursiveDelete', r.path]);
      for (const p of [...docs.keys()]) if (p === r.path || p.startsWith(r.path + '/')) docs.delete(p);
    },
    bulkWriter: () => {
      const queued = [];
      const apply = (fn) => { const p = new Promise((res, rej) => queued.push(() => { try { res(fn()); } catch (e) { rej(e); } })); p.catch(() => {}); return p; };
      return {
        delete: (r) => apply(() => { calls.push(['delete', r.path]); docs.delete(r.path); }),
        update: (r, data) => apply(() => {
          if (!docs.has(r.path)) throw Object.assign(new Error('NOT_FOUND'), { code: 5 });
          const cur = { ...docs.get(r.path) };
          for (const [k, v] of Object.entries(data)) cur[k] = v && v[INC] !== undefined ? (cur[k] || 0) + v[INC] : v;
          docs.set(r.path, cur);
          calls.push(['update', r.path]);
        }),
        close: async () => { queued.forEach((f) => f()); await Promise.resolve(); },
      };
    },
  };
  return db;
}

function makeBucket(paths = []) {
  const files = new Set(paths);
  return {
    files,
    deleteFiles: jest.fn(async ({ prefix }) => { for (const f of [...files]) if (f.startsWith(prefix)) files.delete(f); }),
  };
}

function makeAuth(uids = []) {
  const users = new Set(uids);
  return {
    users,
    deleteUser: jest.fn(async (uid) => {
      if (!users.has(uid)) throw Object.assign(new Error('no user'), { code: 'auth/user-not-found' });
      users.delete(uid);
    }),
  };
}

const quiet = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
const fixedNow = () => new Date('2026-10-12T16:00:00.000Z');

// u1 is deleted. u2 and u3 are other people whose data must be left alone.
const seed = () => ({
  'users/u1': { email: 'u1@example.com', name: 'Una' },
  'users/u1/bodyScans/s1': { bodyFatPercent: 20 },
  'users/u1/data/spotify': { refresh: 'token' },
  'users/u1/devices/tok1': { token: 'push' },
  'users/u1/following/u2': { name: 'Two' },
  'users/u1/groupMemberships/g1': { joined: true },
  'users/u2': { name: 'Two' },
  'users/u2/bodyScans/s9': { bodyFatPercent: 15 },
  'users/u2/following/u1': { name: 'Una', avatar: 'a.png' },
  'users/u2/following/u3': { name: 'Three' },
  'users/u3': { name: 'Three' },
  'workouts/w1': { userId: 'u1' }, 'workouts/w2': { userId: 'u2' },
  'loggedSets/l1': { userId: 'u1' }, 'loggedSets/l2': { userId: 'u2' },
  'coachMessages/m1': { userId: 'u1' }, 'coachMessages/m2': { userId: 'u2' },
  'goals/g1': { userId: 'u1' }, 'goals/g2': { userId: 'u2' },
  'aiRecommendations/r1': { userId: 'u1' }, 'aiRecommendations/r2': { userId: 'u2' },
  'leaderboard/u1': { xp: 10 }, 'leaderboard/u2': { xp: 20 },
  'admins/u1': { since: 1 },
  'communityPosts/p1': { authorId: 'u1', likeCount: 1, commentCount: 1 },
  'communityPosts/p1/likes/u2': { likedAt: 1 },
  'communityPosts/p1/comments/c1': { authorId: 'u2', text: 'hi' },
  'communityPosts/p2': { authorId: 'u2', likeCount: 3, commentCount: 3 },
  'communityPosts/p2/likes/u1': { likedAt: 1 },
  'communityPosts/p2/likes/u3': { likedAt: 1 },
  'communityPosts/p2/comments/c2': { authorId: 'u1', text: 'mine' },
  'communityPosts/p2/comments/c3': { authorId: 'u3', text: 'theirs' },
  'communityPosts/p2/comments/c4': { authorId: 'u3', text: 'theirs too' },
  'conversations/c12': { participantIds: ['u1', 'u2'], lastMessage: { text: 'secret', senderId: 'u1' } },
  'conversations/c12/messages/m1': { senderId: 'u1', text: 'secret' },
  'conversations/c12/messages/m2': { senderId: 'u2', text: 'reply' },
  'conversations/c23': { participantIds: ['u2', 'u3'] },
  'conversations/c23/messages/m1': { senderId: 'u2', text: 'unrelated' },
  'duels/d12': { participantIds: ['u1', 'u2'], status: 'active' },
  'duels/d23': { participantIds: ['u2', 'u3'], status: 'active' },
  'calendarInvites/i12': { participantIds: ['u1', 'u2'], fromUid: 'u1', toUid: 'u2', fromName: 'One', toName: 'Two', status: 'pending' },
  'calendarInvites/i21': { participantIds: ['u1', 'u2'], fromUid: 'u2', toUid: 'u1', fromName: 'Two', toName: 'One', status: 'accepted' },
  'calendarInvites/i23': { participantIds: ['u2', 'u3'], fromUid: 'u2', toUid: 'u3', fromName: 'Two', toName: 'Three', status: 'pending' },
  'challengeEntries/ch1_u1': { uid: 'u1', challengeId: 'ch1' },
  'challengeEntries/ch1_u2': { uid: 'u2', challengeId: 'ch1' },
  'raceEntries/local-5k-week-2026-10-12_u1': { uid: 'u1', raceId: 'local-5k-week-2026-10-12', timeSec: 1500 },
  'raceEntries/world-10k-month-2026-10_u1': { uid: 'u1', raceId: 'world-10k-month-2026-10', timeSec: 3100 },
  'raceEntries/local-5k-week-2026-10-12_u2': { uid: 'u2', raceId: 'local-5k-week-2026-10-12', timeSec: 1600 },
  'entitlements/u1': { tier: 'pro', status: 'active', expiresAt: null, source: 'manual' },
  'entitlements/u2': { tier: 'legend', status: 'active', expiresAt: null, source: 'manual' },
  'aiUsage/u1_2026-10-11': { uid: 'u1', day: '2026-10-11', coach: 4 },
  'aiUsage/u1_2026-10-12': { uid: 'u1', day: '2026-10-12', coach: 1, assist: 2 },
  'aiUsage/u2_2026-10-12': { uid: 'u2', day: '2026-10-12', coach: 3 },
  'inviteCodes/K7P2QX4M': { uid: 'u1', createdAt: '2026-10-01T00:00:00.000Z' },
  'inviteCodes/H3WZ9N5R': { uid: 'u2', createdAt: '2026-10-01T00:00:00.000Z' },
  'users/u1/stats/invite': { code: 'K7P2QX4M', joined: 2, rewarded: 2, daysEarned: 14 },
  'communityGroups/g1': { memberCount: 5 },
});

const storageSeed = () => [
  'users/u1/profile/a.jpg', 'users/u1/media/b.jpg', 'posts/u1/p1/c.jpg',
  'users/u2/profile/x.jpg', 'posts/u2/p2/y.jpg',
  // a different person whose uid merely starts with the same letters
  'users/u10/profile/z.jpg', 'posts/u10/p9/w.jpg',
];

const run = (over = {}) => {
  const db = over.db || makeDb(seed());
  const bucket = over.bucket || makeBucket(storageSeed());
  const auth = over.auth || makeAuth(['u1', 'u2', 'u3']);
  const promise = eraseUserAccount({
    uid: 'u1', db, bucket, auth, increment, now: fixedNow, log: quiet, revokeIntegrations: over.revokeIntegrations, ...over.extra,
  });
  return { db, bucket, auth, promise };
};

const has = (db, path) => db.docs.has(path);
const startsWith = (db, prefix) => [...db.docs.keys()].some((p) => p === prefix || p.startsWith(prefix + '/'));

beforeEach(() => { jest.clearAllMocks(); });

describe('erasing an account', () => {
  it('removes the person\'s profile, email and everything under it', async () => {
    const { db, promise } = run();
    const result = await promise;
    expect(result.ok).toBe(true);
    expect(startsWith(db, 'users/u1')).toBe(false);
  });

  it('removes their one-document-each records, public entry and admin flag', async () => {
    const { db, promise } = run();
    await promise;
    for (const c of USER_KEYED_COLLECTIONS) {
      const mine = [...db.docs.entries()].filter(([p, d]) => p.startsWith(c + '/') && d.userId === 'u1');
      expect(mine).toEqual([]);
    }
    expect(has(db, 'leaderboard/u1')).toBe(false);
    expect(has(db, 'admins/u1')).toBe(false);
  });

  it('removes their posts with the likes and comments other people left on them', async () => {
    const { db, promise } = run();
    await promise;
    expect(startsWith(db, 'communityPosts/p1')).toBe(false);
  });

  it('removes their likes and comments on other people\'s posts and corrects the counters', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'communityPosts/p2/likes/u1')).toBe(false);
    expect(has(db, 'communityPosts/p2/comments/c2')).toBe(false);
    expect(has(db, 'communityPosts/p2/likes/u3')).toBe(true);
    expect(has(db, 'communityPosts/p2/comments/c3')).toBe(true);
    expect(has(db, 'communityPosts/p2/comments/c4')).toBe(true);
    expect(db.docs.get('communityPosts/p2')).toMatchObject({ likeCount: 2, commentCount: 2 });
  });

  it('removes them from the lists of people who follow them (those hold their name and avatar)', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'users/u2/following/u1')).toBe(false);
    expect(has(db, 'users/u2/following/u3')).toBe(true);
  });

  it('removes conversations and duels they were in, and their challenge entries', async () => {
    const { db, promise } = run();
    await promise;
    expect(startsWith(db, 'conversations/c12')).toBe(false);
    expect(startsWith(db, 'duels/d12')).toBe(false);
    expect(has(db, 'challengeEntries/ch1_u1')).toBe(false);
  });

  it('removes the calendar invites they sent and were sent, for the other person too, and only theirs', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'calendarInvites/i12')).toBe(false);
    expect(has(db, 'calendarInvites/i21')).toBe(false);
    expect(has(db, 'calendarInvites/i23')).toBe(true);
  });

  it('removes their plan and their AI message counts, and only theirs', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'entitlements/u1')).toBe(false);
    expect(has(db, 'aiUsage/u1_2026-10-11')).toBe(false);
    expect(has(db, 'aiUsage/u1_2026-10-12')).toBe(false);
    expect(has(db, 'entitlements/u2')).toBe(true);
    expect(has(db, 'aiUsage/u2_2026-10-12')).toBe(true);
  });

  it('removes their invite code, so nobody can join with it afterwards, and only theirs', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'inviteCodes/K7P2QX4M')).toBe(false);
    expect(has(db, 'users/u1/stats/invite')).toBe(false); // with the rest of their profile
    expect(has(db, 'inviteCodes/H3WZ9N5R')).toBe(true);
  });

  it('removes their times from the virtual race boards, and only theirs', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'raceEntries/local-5k-week-2026-10-12_u1')).toBe(false);
    expect(has(db, 'raceEntries/world-10k-month-2026-10_u1')).toBe(false);
    expect(has(db, 'raceEntries/local-5k-week-2026-10-12_u2')).toBe(true);
  });

  it('removes their group memberships and leaves the member count to the onGroupLeft function', async () => {
    const { db, promise } = run();
    await promise;
    expect(has(db, 'users/u1/groupMemberships/g1')).toBe(false);
    // onGroupLeft lowers the count when the membership goes (functions/src/groupMemberCount.js); lowering it here too would count the leave twice.
    expect(db.docs.get('communityGroups/g1').memberCount).toBe(5);
  });

  it('removes their uploaded files and post media, and only theirs', async () => {
    const { bucket, promise } = run();
    await promise;
    expect([...bucket.files].sort()).toEqual([
      'posts/u10/p9/w.jpg', 'posts/u2/p2/y.jpg', 'users/u10/profile/z.jpg', 'users/u2/profile/x.jpg',
    ]);
    expect(bucket.deleteFiles).toHaveBeenCalledWith({ prefix: 'users/u1/', force: true });
    expect(bucket.deleteFiles).toHaveBeenCalledWith({ prefix: 'posts/u1/', force: true });
    expect(STORAGE_PREFIXES('u1')).toEqual(['users/u1/', 'posts/u1/']);
  });

  it('leaves every other person\'s data exactly as it was', async () => {
    const before = makeDb(seed());
    const { db, promise } = run();
    await promise;
    const keep = [
      'users/u2', 'users/u2/bodyScans/s9', 'users/u2/following/u3', 'users/u3',
      'workouts/w2', 'loggedSets/l2', 'coachMessages/m2', 'goals/g2', 'aiRecommendations/r2',
      'leaderboard/u2', 'communityPosts/p2', 'communityPosts/p2/likes/u3',
      'conversations/c23', 'conversations/c23/messages/m1', 'duels/d23', 'calendarInvites/i23', 'challengeEntries/ch1_u2', 'raceEntries/local-5k-week-2026-10-12_u2',
      'entitlements/u2', 'aiUsage/u2_2026-10-12', 'inviteCodes/H3WZ9N5R',
    ];
    for (const p of keep) expect(db.docs.get(p)).toEqual(p === 'communityPosts/p2' ? { authorId: 'u2', likeCount: 2, commentCount: 2 } : before.docs.get(p));
  });

  it('removes the sign-in account (the email) last, after all the data is gone', async () => {
    const { db, auth, promise } = run();
    let dataLeftWhenSignInDeleted = null;
    auth.deleteUser.mockImplementationOnce(async (uid) => {
      dataLeftWhenSignInDeleted = startsWith(db, 'users/u1') || has(db, 'workouts/w1');
      auth.users.delete(uid);
    });
    await promise;
    expect(dataLeftWhenSignInDeleted).toBe(false);
    expect(auth.deleteUser).toHaveBeenCalledWith('u1');
    expect(auth.users.has('u1')).toBe(false);
    expect(auth.users.has('u2')).toBe(true);
  });

  it('keeps no record of who was deleted when it works: just that a deletion happened', async () => {
    const { db, promise } = run();
    await promise;
    const records = [...db.docs.entries()].filter(([p]) => p.startsWith('accountDeletions/'));
    expect(records).toHaveLength(1);
    expect(records[0][1]).toEqual({ at: '2026-10-12T16:00:00.000Z', ok: true });
    expect(JSON.stringify([...db.docs.entries()].filter(([p]) => p.startsWith('accountDeletions/')))).not.toContain('u1');
  });

  it('leaves nothing that mentions the person anywhere', async () => {
    const { db, promise } = run();
    await promise;
    const left = [...db.docs.entries()].filter(([p, d]) => /(^|\/)u1(\/|$)/.test(p) || JSON.stringify(d).includes('u1@example.com') || JSON.stringify(d).includes('"u1"') || JSON.stringify(d).includes('Una'));
    expect(left).toEqual([]);
  });
});

describe('when something goes wrong', () => {
  it('keeps the sign-in account and records the uid for a manual clean-up when a step fails', async () => {
    const db = makeDb(seed());
    db.failRecursiveDelete = (p) => p === 'users/u1';
    const { auth, promise } = run({ db });
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.steps.find((s) => s.name === 'userData')).toMatchObject({ ok: false });
    expect(auth.deleteUser).not.toHaveBeenCalled();
    const failure = [...db.docs.entries()].find(([p]) => p.startsWith('accountDeletions/'))[1];
    expect(failure).toMatchObject({ ok: false, uid: 'u1', failedSteps: ['userData'] });
  });

  it('names the plan step, and keeps the sign-in account, when the plan cannot be removed', async () => {
    const db = makeDb(seed());
    const realBulkWriter = db.bulkWriter;
    db.bulkWriter = () => {
      const writer = realBulkWriter();
      return {
        ...writer,
        delete: (r) => {
          if (r.path !== 'entitlements/u1') return writer.delete(r);
          const failed = Promise.reject(new Error('delete failed for ' + r.path));
          failed.catch(() => {});
          return failed;
        },
      };
    };
    const { auth, promise } = run({ db });
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.steps.find((x) => x.name === 'plan')).toMatchObject({ ok: false });
    expect(auth.deleteUser).not.toHaveBeenCalled();
    const failure = [...db.docs.entries()].find(([path]) => path.startsWith('accountDeletions/'))[1];
    expect(failure).toMatchObject({ ok: false, uid: 'u1', failedSteps: ['plan'] });
  });

  it('still does every other step when one fails', async () => {
    const db = makeDb(seed());
    db.failRecursiveDelete = (p) => p === 'users/u1';
    const { promise } = run({ db });
    await promise;
    expect(has(db, 'workouts/w1')).toBe(false);
    expect(startsWith(db, 'communityPosts/p1')).toBe(false);
    expect(has(db, 'communityPosts/p2/likes/u1')).toBe(false);
  });

  it('finishes cleanly when tried again, without changing a counter twice', async () => {
    const db = makeDb(seed());
    db.failRecursiveDelete = (p) => p === 'users/u1';
    const bucket = makeBucket(storageSeed());
    const auth = makeAuth(['u1', 'u2', 'u3']);
    await run({ db, bucket, auth }).promise;
    db.failRecursiveDelete = null;
    const second = await run({ db, bucket, auth }).promise;
    expect(second.ok).toBe(true);
    expect(auth.users.has('u1')).toBe(false);
    expect(db.docs.get('communityGroups/g1').memberCount).toBe(5);
    expect(db.docs.get('communityPosts/p2')).toMatchObject({ likeCount: 2, commentCount: 2 });
    expect(startsWith(db, 'users/u1')).toBe(false);
  });

  it('reports a failure when the sign-in account cannot be deleted, so it can be tried again', async () => {
    const auth = makeAuth(['u1']);
    auth.deleteUser.mockRejectedValueOnce(Object.assign(new Error('backend down'), { code: 'auth/internal-error' }));
    const { db, promise } = run({ auth });
    const result = await promise;
    expect(result.ok).toBe(false);
    expect(result.steps.at(-1)).toMatchObject({ name: 'signIn', ok: false });
    const failure = [...db.docs.entries()].find(([p]) => p.startsWith('accountDeletions/'))[1];
    expect(failure).toMatchObject({ ok: false, uid: 'u1', failedSteps: ['signIn'] });
  });

  it('treats an already-deleted sign-in account as done', async () => {
    const { promise } = run({ auth: makeAuth([]) });
    await expect(promise).resolves.toMatchObject({ ok: true });
  });

  it('does not let a ROOK outage stop the deletion', async () => {
    const revokeIntegrations = jest.fn(async () => { throw new Error('ROOK down'); });
    const { auth, promise } = run({ revokeIntegrations });
    const result = await promise;
    expect(revokeIntegrations).toHaveBeenCalledWith('u1');
    expect(result.ok).toBe(true);
    expect(result.steps.find((s) => s.name === 'integrations')).toMatchObject({ ok: false, required: false });
    expect(auth.users.has('u1')).toBe(false);
  });

  it('still succeeds when a group the person belonged to no longer exists', async () => {
    const data = seed();
    delete data['communityGroups/g1'];
    const { promise } = run({ db: makeDb(data) });
    await expect(promise).resolves.toMatchObject({ ok: true });
  });

  it('refuses to run without a uid', async () => {
    await expect(eraseUserAccount({ uid: '', db: makeDb(), bucket: makeBucket(), auth: makeAuth(), increment, log: quiet })).rejects.toThrow(/uid is required/);
    await expect(eraseUserAccount({ db: makeDb(), bucket: makeBucket(), auth: makeAuth(), increment, log: quiet })).rejects.toThrow(/uid is required/);
  });
});

describe('with a lot of data', () => {
  it('finds and removes records beyond the first page', async () => {
    const data = {};
    for (let i = 0; i < 700; i++) {
      const n = String(i).padStart(4, '0');
      data[`workouts/w${n}`] = { userId: i % 2 ? 'u1' : 'u2' };
      data[`communityPosts/p${n}`] = { authorId: 'u2', likeCount: 1, commentCount: 0 };
      data[`communityPosts/p${n}/likes/u1`] = { likedAt: 1 };
      data[`users/x${n}`] = { name: 'x' };
      data[`users/x${n}/following/u1`] = { name: 'Una' };
    }
    const db = makeDb(data);
    const result = await run({ db }).promise;
    expect(result.ok).toBe(true);
    const mine = [...db.docs.entries()].filter(([p, d]) => d.userId === 'u1');
    expect(mine).toEqual([]);
    expect([...db.docs.keys()].filter((p) => p.startsWith('workouts/')).length).toBe(350);
    expect([...db.docs.keys()].filter((p) => p.endsWith('/likes/u1'))).toEqual([]);
    expect([...db.docs.keys()].filter((p) => p.endsWith('/following/u1'))).toEqual([]);
    expect(db.docs.get('communityPosts/p0699').likeCount).toBe(0);
    expect([...db.docs.keys()].filter((p) => /^users\/x\d+$/.test(p)).length).toBe(700);
  });
});

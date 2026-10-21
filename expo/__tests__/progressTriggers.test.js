// The Cloud Functions in index.js that keep a person's lifetime totals, unlocks, Battle Pass claims and deadline duels. index.js is
// loaded with the Firebase packages replaced by small stand-ins, and the work itself (lifetimeTotals.js, unlocks.js, duelSettle.js,
// each tested on its own) replaced by recorders, so this checks what each function watches, in what order it calls the work, and what
// it does when the work fails.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => global.__db,
  FieldValue: { increment: (n) => ({ inc: n }), serverTimestamp: () => 'ts', arrayUnion: (...a) => a, delete: () => 'del' },
}), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => global.__messaging }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ getUser: async () => ({ metadata: {} }) }) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (opts, handler) => Object.assign(handler, { __opts: opts }),
  onDocumentDeleted: (opts, handler) => Object.assign(handler, { __opts: opts }),
}), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/xpLedger.js', () => ({
  handleClaim: (...a) => global.__handle(...a),
  fillLeaderboardEntry: jest.fn(),
}));
jest.mock('../functions/src/lifetimeTotals.js', () => ({
  refreshTotals: (...a) => global.__refresh(...a),
}));
jest.mock('../functions/src/unlocks.js', () => ({
  runUnlocks: (...a) => global.__unlocks(...a),
  claimTier: (...a) => global.__claimTier(...a),
}));
jest.mock('../functions/src/duelSettle.js', () => {
  const actual = jest.requireActual('../functions/src/duelSettle.js');
  return { ...actual, settleExpiredDuels: (...a) => global.__settle(...a) };
});

const load = () => require('../functions/src/index.js');

// A stand-in database for onWorkoutComplete: the workout record, the person's open goals and duels, their devices, and a batch that
// keeps what it is asked to update.
function makeDb({ workoutExists = true, goals = [], duels = [], tokens = [] } = {}) {
  const updates = [];
  const queries = [];
  const snap = (items) => ({ docs: items.map((d, i) => ({ id: `x${i}`, ref: { path: d.path || `ref${i}` }, data: () => d })) });
  const db = {
    updates,
    queries,
    doc: (path) => ({ get: async () => { queries.push(['get', path]); return { exists: workoutExists }; } }),
    batch: () => ({
      update: (ref, data) => updates.push([ref.path, data]),
      commit: jest.fn(async () => { queries.push(['commit']); }),
    }),
    collection: (name) => {
      if (name === 'goals') return { where: () => ({ where: () => ({ get: async () => snap(goals) }) }) };
      if (name === 'duels') return { where: () => ({ where: () => ({ get: async () => snap(duels) }) }) };
      if (name === 'users') return { doc: () => ({ collection: () => ({ get: async () => ({ docs: tokens.map((t) => ({ data: () => ({ token: t }) })) }) }) }) };
      throw new Error('unexpected collection ' + name);
    },
  };
  return db;
}

const event = (data, id = 'w1') => ({ params: { workoutId: id }, data: data === undefined ? undefined : { data: () => data } });
const NOW = Date.parse('2026-10-21T12:00:00.000Z');

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  global.__db = makeDb();
  global.__messaging = { sendEachForMulticast: jest.fn(async () => ({})) };
  global.__handle = jest.fn(async () => 'published');
  global.__refresh = jest.fn(async () => ({}));
  global.__unlocks = jest.fn(async () => ({ achievements: [], badges: [], facts: {}, totals: { totalWorkouts: 4 } }));
  global.__claimTier = jest.fn(async () => ({ status: 'claimed', claimedTiers: [3], level: 5 }));
  global.__settle = jest.fn(async () => ({ settled: 0, skipped: 0 }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('onWorkoutComplete: totals and unlocks', () => {
  it('counts the totals again, then works out the unlocks, for a finished workout', async () => {
    const { onWorkoutComplete } = load();
    const order = [];
    global.__refresh = jest.fn(async () => { order.push('totals'); });
    global.__unlocks = jest.fn(async () => { order.push('unlocks'); });
    await onWorkoutComplete(event({ userId: 'alice', completed: true, duration: 600, caloriesBurned: 80 }));
    expect(order).toEqual(['totals', 'unlocks']);
    expect(global.__refresh).toHaveBeenCalledWith({ db: global.__db, uid: 'alice', extra: { lastWorkoutAt: 'ts' } });
    expect(global.__unlocks).toHaveBeenCalledWith({ db: global.__db, uid: 'alice' });
  });

  it('counts a workout saved part way as well, without marking a last finished workout', async () => {
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: false, duration: 60, caloriesBurned: 5 }));
    expect(global.__refresh).toHaveBeenCalledWith({ db: global.__db, uid: 'alice', extra: {} });
    expect(global.__unlocks).toHaveBeenCalledTimes(1);
  });

  it('leaves the goals, duels and notification alone for a workout saved part way', async () => {
    global.__db = makeDb({ goals: [{ type: 'endurance', current: 0, target: 5 }], tokens: ['t1'] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: false }));
    expect(global.__db.updates).toEqual([]);
    expect(global.__db.queries.some((q) => q[0] === 'commit')).toBe(false);
    expect(global.__messaging.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('does not count, or unlock, for a record that has been erased since', async () => {
    global.__db = makeDb({ workoutExists: false });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }));
    expect(global.__refresh).not.toHaveBeenCalled();
    expect(global.__unlocks).not.toHaveBeenCalled();
  });

  it('looks for the record by its own id', async () => {
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }, 'abc123'));
    expect(global.__db.queries[0]).toEqual(['get', 'workouts/abc123']);
  });

  it('does not count when the record names nobody', async () => {
    const { onWorkoutComplete } = load();
    global.__db = makeDb({});
    await onWorkoutComplete(event({ completed: false })).catch(() => undefined);
    expect(global.__refresh).not.toHaveBeenCalled();
  });

  it('does nothing for an event with no data', async () => {
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event(undefined));
    expect(global.__refresh).not.toHaveBeenCalled();
    expect(global.__unlocks).not.toHaveBeenCalled();
  });

  it('carries on with the goals, duels and notification when counting fails, and says so in the log', async () => {
    global.__refresh = jest.fn(async () => { throw new Error('unavailable'); });
    global.__db = makeDb({ goals: [{ type: 'general_fitness', current: 1, target: 3, path: 'goals/g1' }], tokens: ['t1'] });
    const { onWorkoutComplete } = load();
    await expect(onWorkoutComplete(event({ userId: 'alice', completed: true }))).resolves.toBeUndefined();
    expect(global.__unlocks).not.toHaveBeenCalled();
    expect(global.__db.updates).toEqual([['goals/g1', { current: 2, completed: false }]]);
    expect(global.__messaging.sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it('carries on the same when the unlocks fail', async () => {
    global.__unlocks = jest.fn(async () => { throw new Error('contention'); });
    global.__db = makeDb({ tokens: ['t1'] });
    const { onWorkoutComplete } = load();
    await expect(onWorkoutComplete(event({ userId: 'alice', completed: true }))).resolves.toBeUndefined();
    expect(global.__messaging.sendEachForMulticast).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });

  it('no longer adds one to a running count', async () => {
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true, duration: 600 }));
    const args = global.__refresh.mock.calls[0][0];
    expect(JSON.stringify(args)).not.toContain('inc');
  });
});

describe('onWorkoutComplete: duels', () => {
  const duel = (over) => ({
    path: 'duels/d1', mode: 'most_by_deadline', status: 'active', type: 'workout_count',
    endDate: '2026-10-22T12:00:00.000Z', progress: { alice: 1 }, participantIds: ['alice', 'bob'], goalTarget: 10, ...over,
  });

  it('adds to the progress of a duel that has not reached its date', async () => {
    global.__db = makeDb({ duels: [duel()] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }));
    expect(global.__db.updates).toEqual([['duels/d1', { 'progress.alice': 2 }]]);
  });

  it('adds nothing to a duel that has reached its date, even before it is settled', async () => {
    global.__db = makeDb({ duels: [duel({ endDate: '2026-10-21T11:00:00.000Z' })] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }));
    expect(global.__db.updates).toEqual([]);
  });

  it('adds nothing at the very minute of the date', async () => {
    global.__db = makeDb({ duels: [duel({ endDate: '2026-10-21T12:00:00.000Z' })] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }));
    expect(global.__db.updates).toEqual([]);
  });

  it('still adds to a first-to-target duel whatever its date, and settles it at the target', async () => {
    global.__db = makeDb({ duels: [duel({ mode: 'first_to_target', endDate: '2026-10-01T00:00:00.000Z', progress: { alice: 9 } })] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }));
    expect(global.__db.updates).toEqual([['duels/d1', { 'progress.alice': 10, status: 'completed', winnerId: 'alice', completedAt: 'ts' }]]);
  });

  it('adds the calories and the time of the workout to the duels that count them', async () => {
    global.__db = makeDb({ duels: [duel({ path: 'duels/c', type: 'calories', progress: {} }), duel({ path: 'duels/t', type: 'duration', progress: { alice: 100 } })] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true, caloriesBurned: 250, duration: 900 }));
    expect(global.__db.updates).toEqual([['duels/c', { 'progress.alice': 250 }], ['duels/t', { 'progress.alice': 1000 }]]);
  });

  it('does not settle a deadline duel itself: that is left to the schedule', async () => {
    global.__db = makeDb({ duels: [duel({ goalTarget: 1, progress: { alice: 5 } })] });
    const { onWorkoutComplete } = load();
    await onWorkoutComplete(event({ userId: 'alice', completed: true }));
    expect(global.__db.updates[0][1].status).toBeUndefined();
  });
});

describe('onXpClaim: unlocks', () => {
  const claim = { params: { uid: 'alice', claimId: 'c1' } };

  it('works out the unlocks for the person after the claim has been dealt with', async () => {
    const { onXpClaim } = load();
    const order = [];
    global.__handle = jest.fn(async () => { order.push('claim'); return 'published'; });
    global.__unlocks = jest.fn(async () => { order.push('unlocks'); });
    await onXpClaim(claim);
    expect(order).toEqual(['claim', 'unlocks']);
    expect(global.__unlocks).toHaveBeenCalledWith({ db: global.__db, uid: 'alice' });
  });

  it.each(['published', 'hidden', 'unchanged', 'duplicate'])('works out the unlocks when the claim ended %s', async (outcome) => {
    global.__handle = jest.fn(async () => outcome);
    const { onXpClaim } = load();
    expect(await onXpClaim(claim)).toBe(outcome);
    expect(global.__unlocks).toHaveBeenCalledTimes(1);
  });

  it.each(['gone', 'ignored'])('does not work out unlocks for a claim that was %s', async (outcome) => {
    global.__handle = jest.fn(async () => outcome);
    const { onXpClaim } = load();
    expect(await onXpClaim(claim)).toBe(outcome);
    expect(global.__unlocks).not.toHaveBeenCalled();
  });

  it('does not make the claim run again when the unlocks fail', async () => {
    global.__unlocks = jest.fn(async () => { throw new Error('contention'); });
    const { onXpClaim } = load();
    await expect(onXpClaim(claim)).resolves.toBe('published');
    expect(console.error).toHaveBeenCalled();
  });

  it('does not reach the unlocks when the claim itself fails, so the run is tried again', async () => {
    global.__handle = jest.fn(async () => { throw new Error('contention'); });
    const { onXpClaim } = load();
    await expect(onXpClaim(claim)).rejects.toThrow('contention');
    expect(global.__unlocks).not.toHaveBeenCalled();
  });
});

describe('syncMyProgress', () => {
  it('is in the same region as the others', () => {
    const { syncMyProgress, onWorkoutComplete } = load();
    expect(syncMyProgress.__opts.region).toBe(onWorkoutComplete.__opts.region);
  });

  it('works out the unlocks for the signed in person and returns the totals', async () => {
    const { syncMyProgress } = load();
    const r = await syncMyProgress({ auth: { uid: 'alice' }, data: {} });
    expect(global.__unlocks).toHaveBeenCalledWith({ db: global.__db, uid: 'alice' });
    expect(r).toEqual({ totals: { totalWorkouts: 4 } });
  });

  it('works for the person who is signed in, whatever the call says', async () => {
    const { syncMyProgress } = load();
    await syncMyProgress({ auth: { uid: 'alice' }, data: { uid: 'bob' } });
    expect(global.__unlocks.mock.calls[0][0].uid).toBe('alice');
  });

  it('turns away someone who is not signed in', async () => {
    const { syncMyProgress } = load();
    await expect(syncMyProgress({ data: {} })).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(syncMyProgress({ auth: {}, data: {} })).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.__unlocks).not.toHaveBeenCalled();
  });
});

describe('claimBattlePassTier', () => {
  it('is in the same region as the others', () => {
    const { claimBattlePassTier, onWorkoutComplete } = load();
    expect(claimBattlePassTier.__opts.region).toBe(onWorkoutComplete.__opts.region);
  });

  it('claims the tier for the signed in person and returns what came of it', async () => {
    const { claimBattlePassTier } = load();
    const r = await claimBattlePassTier({ auth: { uid: 'alice' }, data: { tier: 3 } });
    expect(global.__claimTier).toHaveBeenCalledWith({ db: global.__db, uid: 'alice', tier: 3 });
    expect(r).toEqual({ status: 'claimed', claimedTiers: [3], level: 5 });
  });

  it('returns a tier that is already claimed or not yet reached, as an answer and not an error', async () => {
    const { claimBattlePassTier } = load();
    global.__claimTier = jest.fn(async () => ({ status: 'already', claimedTiers: [3], level: 5 }));
    expect((await claimBattlePassTier({ auth: { uid: 'alice' }, data: { tier: 3 } })).status).toBe('already');
    global.__claimTier = jest.fn(async () => ({ status: 'locked', claimedTiers: [], level: 2 }));
    expect((await claimBattlePassTier({ auth: { uid: 'alice' }, data: { tier: 9 } })).status).toBe('locked');
  });

  it('turns away a tier that is not valid with an invalid-argument error', async () => {
    const { claimBattlePassTier } = load();
    global.__claimTier = jest.fn(async () => ({ status: 'invalid' }));
    await expect(claimBattlePassTier({ auth: { uid: 'alice' }, data: { tier: 99 } })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('passes on a call with no data as a tier that is not there', async () => {
    const { claimBattlePassTier } = load();
    await claimBattlePassTier({ auth: { uid: 'alice' } });
    expect(global.__claimTier.mock.calls[0][0].tier).toBeUndefined();
  });

  it('claims for the person who is signed in, whatever the call says', async () => {
    const { claimBattlePassTier } = load();
    await claimBattlePassTier({ auth: { uid: 'alice' }, data: { tier: 2, uid: 'bob' } });
    expect(global.__claimTier.mock.calls[0][0].uid).toBe('alice');
  });

  it('turns away someone who is not signed in', async () => {
    const { claimBattlePassTier } = load();
    await expect(claimBattlePassTier({ data: { tier: 1 } })).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.__claimTier).not.toHaveBeenCalled();
  });
});

describe('settleDuels', () => {
  it('runs every hour, in UTC, in the same region as the others', () => {
    const { settleDuels, onWorkoutComplete } = load();
    expect(settleDuels.__opts).toEqual({ schedule: 'every 60 minutes', region: onWorkoutComplete.__opts.region, timeZone: 'UTC' });
  });

  it('settles the duels that are due', async () => {
    const { settleDuels } = load();
    await settleDuels();
    expect(global.__settle).toHaveBeenCalledWith({ db: global.__db });
  });

  it('says in the log how many it settled, and nothing when none', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const { settleDuels } = load();
    await settleDuels();
    expect(console.log).not.toHaveBeenCalled();
    global.__settle = jest.fn(async () => ({ settled: 2, skipped: 1 }));
    await settleDuels();
    expect(console.log).toHaveBeenCalledWith('[settleDuels] settled', { settled: 2, skipped: 1 });
  });

  it('lets a failure stop the run, so the schedule shows it failed', async () => {
    global.__settle = jest.fn(async () => { throw new Error('unavailable'); });
    const { settleDuels } = load();
    await expect(settleDuels()).rejects.toThrow('unavailable');
  });
});

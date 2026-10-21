// The two Cloud Function triggers that keep a person's XP: onXpClaim and onLeaderboardEntryCreated in index.js. index.js is loaded
// with the Firebase packages replaced by small stand-ins, and the work itself (xpLedger.js, tested in xpLedger.test.js) replaced
// by a recorder, so this only checks what each trigger watches and what it hands over.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => global.__db,
  FieldValue: { increment: (n) => ({ inc: n }), serverTimestamp: () => 'ts', arrayUnion: (...a) => a, delete: () => 'del' },
}), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => global.__auth }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => handler, onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (opts, handler) => Object.assign(handler, { __opts: opts }),
  onDocumentDeleted: (opts, handler) => Object.assign(handler, { __opts: opts }),
}), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/xpLedger.js', () => ({
  handleClaim: (...a) => global.__handle(...a),
  fillLeaderboardEntry: (...a) => global.__fill(...a),
}));

// What a claim unlocks (unlocks.js, tested in unlocks.test.js and, for when onXpClaim asks for it, progressTriggers.test.js) is a recorder here too.
jest.mock('../functions/src/unlocks.js', () => ({
  runUnlocks: (...a) => global.__unlocks(...a),
  claimTier: (...a) => global.__claimTier(...a),
}));

const load = () => require('../functions/src/index.js');

beforeEach(() => {
  jest.resetModules();
  global.__db = { stand: 'in' };
  global.__auth = { getUser: jest.fn(async () => ({ metadata: { creationTime: 'Mon, 05 Oct 2026 12:00:00 GMT' } })) };
  global.__handle = jest.fn(async () => 'published');
  global.__fill = jest.fn(async () => 'published');
  global.__unlocks = jest.fn(async () => ({ achievements: [], badges: [] }));
  global.__claimTier = jest.fn(async () => ({ status: 'claimed' }));
});

describe('onXpClaim', () => {
  it('watches every claim of every person, in the same region as the other triggers, and is tried again if it fails', () => {
    const { onXpClaim, onWorkoutComplete } = load();
    expect(onXpClaim.__opts.document).toBe('users/{uid}/xpClaims/{claimId}');
    expect(onXpClaim.__opts.region).toBe(onWorkoutComplete.__opts.region);
    expect(onXpClaim.__opts.retry).toBe(true);
  });

  it('hands the claim to the ledger with the person and the claim named by the document path', async () => {
    const { onXpClaim } = load();
    await onXpClaim({ id: 'event-1', params: { uid: 'alice', claimId: 'run-17' } });
    expect(global.__handle).toHaveBeenCalledTimes(1);
    const call = global.__handle.mock.calls[0][0];
    expect(call.db).toBe(global.__db);
    expect(call.uid).toBe('alice');
    expect(call.claimId).toBe('run-17');
    // The claim's own contents are read from its document inside the transaction, not taken from the event.
    expect(Object.keys(call).sort()).toEqual(['accountCreatedMs', 'claimId', 'db', 'uid']);
  });

  it('looks up the age of the account of the person who filed the claim', async () => {
    const { onXpClaim } = load();
    await onXpClaim({ id: 'e', params: { uid: 'alice', claimId: 'import-v1' } });
    const created = await global.__handle.mock.calls[0][0].accountCreatedMs();
    expect(global.__auth.getUser).toHaveBeenCalledWith('alice');
    expect(created).toBe(Date.UTC(2026, 9, 5, 12));
  });

  it('has no age for an account that no longer exists', async () => {
    global.__auth.getUser = jest.fn(async () => { const e = new Error('gone'); e.code = 'auth/user-not-found'; throw e; });
    const { onXpClaim } = load();
    await onXpClaim({ id: 'e', params: { uid: 'alice', claimId: 'c' } });
    expect(await global.__handle.mock.calls[0][0].accountCreatedMs()).toBeNull();
  });

  it('has no age when the account has no creation time', async () => {
    global.__auth.getUser = jest.fn(async () => ({ metadata: {} }));
    const { onXpClaim } = load();
    await onXpClaim({ id: 'e', params: { uid: 'alice', claimId: 'c' } });
    expect(await global.__handle.mock.calls[0][0].accountCreatedMs()).toBeNull();
  });

  it('lets any other failure of the lookup stop the run, so it is tried again', async () => {
    global.__auth.getUser = jest.fn(async () => { const e = new Error('unavailable'); e.code = 'auth/internal-error'; throw e; });
    const { onXpClaim } = load();
    await onXpClaim({ id: 'e', params: { uid: 'alice', claimId: 'c' } });
    await expect(global.__handle.mock.calls[0][0].accountCreatedMs()).rejects.toThrow('unavailable');
  });

  it('passes on a failure of the ledger itself, so the run is tried again', async () => {
    global.__handle = jest.fn(async () => { throw new Error('contention'); });
    const { onXpClaim } = load();
    await expect(onXpClaim({ id: 'e', params: { uid: 'alice', claimId: 'c' } })).rejects.toThrow('contention');
  });
});

describe('onLeaderboardEntryCreated', () => {
  it('watches every new leaderboard entry', () => {
    const { onLeaderboardEntryCreated, onWorkoutComplete } = load();
    expect(onLeaderboardEntryCreated.__opts.document).toBe('leaderboard/{uid}');
    expect(onLeaderboardEntryCreated.__opts.region).toBe(onWorkoutComplete.__opts.region);
  });

  it('hands the new entry to the ledger to be filled in', async () => {
    const { onLeaderboardEntryCreated } = load();
    await onLeaderboardEntryCreated({ params: { uid: 'alice' }, data: { data: () => ({ name: 'Alice' }) } });
    expect(global.__fill).toHaveBeenCalledWith({ db: global.__db, uid: 'alice', entry: { name: 'Alice' } });
  });

  it('copes with an event that has no data', async () => {
    const { onLeaderboardEntryCreated } = load();
    await onLeaderboardEntryCreated({ params: { uid: 'alice' } });
    expect(global.__fill).toHaveBeenCalledWith({ db: global.__db, uid: 'alice', entry: undefined });
  });
});

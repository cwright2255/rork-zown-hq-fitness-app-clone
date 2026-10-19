// The two Cloud Function triggers that keep a community group's member count: onGroupJoined and onGroupLeft in index.js.
// index.js is loaded with the Firebase packages replaced by small fakes, and the counting itself (groupMemberCount.js, tested
// in groupMemberCount.test.js) replaced by a recorder, so this only checks what each trigger watches and what it hands over.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => global.__db,
  FieldValue: { increment: (n) => ({ inc: n }), serverTimestamp: () => 'ts', arrayUnion: (...a) => a, delete: () => 'del' },
}), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
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
jest.mock('../functions/src/groupMemberCount.js', () => ({ changeMemberCount: (...a) => global.__change(...a) }));

const load = () => require('../functions/src/index.js');

beforeEach(() => {
  jest.resetModules();
  global.__db = { fake: 'db' };
  global.__change = jest.fn(async () => 'changed');
});

describe('onGroupJoined', () => {
  it('watches every person\'s group memberships, in the same region as the other triggers', () => {
    const { onGroupJoined, onWorkoutComplete } = load();
    expect(onGroupJoined.__opts.document).toBe('users/{uid}/groupMemberships/{groupId}');
    expect(onGroupJoined.__opts.region).toBe(onWorkoutComplete.__opts.region);
  });

  it('adds one to the group that was joined, once per event', async () => {
    const { onGroupJoined } = load();
    await onGroupJoined({ id: 'event-1', params: { uid: 'alice', groupId: 'g1' } });
    expect(global.__change).toHaveBeenCalledTimes(1);
    expect(global.__change).toHaveBeenCalledWith({ db: global.__db, groupId: 'g1', delta: 1, eventId: 'event-1', stamp: 'ts' });
  });
});

describe('onGroupLeft', () => {
  it('watches the same documents', () => {
    const { onGroupLeft } = load();
    expect(onGroupLeft.__opts.document).toBe('users/{uid}/groupMemberships/{groupId}');
    expect(onGroupLeft.__opts.region).toBe('us-central1');
  });

  it('takes one off the group that was left, once per event', async () => {
    const { onGroupLeft } = load();
    await onGroupLeft({ id: 'event-2', params: { uid: 'alice', groupId: 'g1' } });
    expect(global.__change).toHaveBeenCalledTimes(1);
    expect(global.__change).toHaveBeenCalledWith({ db: global.__db, groupId: 'g1', delta: -1, eventId: 'event-2', stamp: 'ts' });
  });
});

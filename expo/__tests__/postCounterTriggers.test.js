// The six Cloud Function triggers that keep the like, comment and share counts on a community post: onPostLiked, onPostUnliked,
// onPostCommented, onCommentRemoved, onPostShared and onShareRemoved in index.js. index.js is loaded with the Firebase packages
// replaced by small fakes, and the counting itself (postCounters.js, tested in postCounters.test.js) replaced by a recorder, so this
// only checks what each trigger watches and what it hands over.

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
  onDocumentCreated: (opts, handler) => Object.assign(handler, { __opts: opts, __kind: 'created' }),
  onDocumentDeleted: (opts, handler) => Object.assign(handler, { __opts: opts, __kind: 'deleted' }),
}), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/postCounters.js', () => ({ changePostCount: (...a) => global.__change(...a) }));

const load = () => require('../functions/src/index.js');

beforeEach(() => {
  jest.resetModules();
  global.__db = { fake: 'db' };
  global.__change = jest.fn(async () => 'changed');
});

const TRIGGERS = [
  ['onPostLiked', 'created', 'communityPosts/{postId}/likes/{uid}', 'likes', 1],
  ['onPostUnliked', 'deleted', 'communityPosts/{postId}/likes/{uid}', 'likes', -1],
  ['onPostCommented', 'created', 'communityPosts/{postId}/comments/{commentId}', 'comments', 1],
  ['onCommentRemoved', 'deleted', 'communityPosts/{postId}/comments/{commentId}', 'comments', -1],
  ['onPostShared', 'created', 'communityPosts/{postId}/shares/{uid}', 'shares', 1],
  ['onShareRemoved', 'deleted', 'communityPosts/{postId}/shares/{uid}', 'shares', -1],
];

describe.each(TRIGGERS)('%s', (name, when, document, kind, delta) => {
  it(`watches ${document} when one is ${when}, in the same region as the other triggers, and is tried again after a failure`, () => {
    const fns = load();
    const trigger = fns[name];
    expect(trigger.__kind).toBe(when);
    expect(trigger.__opts.document).toBe(document);
    expect(trigger.__opts.region).toBe(fns.onWorkoutComplete.__opts.region);
    // A failed run is retried; each event is applied once however many times that happens (postCounters.js).
    expect(trigger.__opts.retry).toBe(true);
  });

  it(`${delta > 0 ? 'adds' : 'takes off'} one ${kind.slice(0, -1)} on the post, once per event`, async () => {
    const trigger = load()[name];
    await trigger({ id: 'event-9', params: { postId: 'p1', uid: 'alice', commentId: 'c1' } });
    expect(global.__change).toHaveBeenCalledTimes(1);
    expect(global.__change).toHaveBeenCalledWith({ db: global.__db, postId: 'p1', kind, delta, eventId: 'event-9', stamp: 'ts' });
  });
});

describe('the three counts', () => {
  it('each have a trigger for a document appearing and one for it going', () => {
    const fns = load();
    for (const kind of ['likes', 'comments', 'shares']) {
      const mine = TRIGGERS.filter((t) => t[3] === kind);
      expect(mine.map((t) => t[1]).sort()).toEqual(['created', 'deleted']);
      expect(mine.map((t) => typeof fns[t[0]]).sort()).toEqual(['function', 'function']);
    }
  });
});

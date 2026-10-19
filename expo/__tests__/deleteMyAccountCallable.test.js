// The Cloud Function wrapper around the erase logic: who may call it, and what it answers.
// index.js is loaded with the Firebase packages replaced by small fakes.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: () => global.__db,
  FieldValue: { increment: (n) => ({ inc: n }), serverTimestamp: () => 'ts', arrayUnion: (...a) => a, delete: () => 'del' },
}), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => global.__auth }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => global.__bucket }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: (...a) => global.__erase(...a) }));

const nowSeconds = () => Math.floor(Date.now() / 1000);
const call = (auth) => require('../functions/src/index.js').deleteMyAccount({ auth, data: {} });

beforeEach(() => {
  jest.resetModules();
  global.__db = { fake: 'db' };
  global.__auth = { fake: 'auth' };
  global.__bucket = { fake: 'bucket' };
  global.__erase = jest.fn(async () => ({ ok: true, steps: [] }));
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data_sources: [] }) }));
});

describe('deleteMyAccount', () => {
  it('needs a signed-in caller', async () => {
    await expect(call(undefined)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.__erase).not.toHaveBeenCalled();
  });

  it('asks the person to sign in again when their sign-in is more than 5 minutes old', async () => {
    await expect(call({ uid: 'u1', token: { auth_time: nowSeconds() - 6 * 60 } }))
      .rejects.toMatchObject({ code: 'failed-precondition', message: 'recent-login-required' });
    expect(global.__erase).not.toHaveBeenCalled();
  });

  it('refuses when the token does not say when they signed in', async () => {
    await expect(call({ uid: 'u1', token: {} })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call({ uid: 'u1' })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(global.__erase).not.toHaveBeenCalled();
  });

  it('erases the caller, and only the caller, when they signed in recently', async () => {
    const result = await call({ uid: 'u1', token: { auth_time: nowSeconds() - 60 } });
    expect(result).toEqual({ deleted: true });
    expect(global.__erase).toHaveBeenCalledTimes(1);
    const args = global.__erase.mock.calls[0][0];
    expect(args.uid).toBe('u1');
    expect(args.db).toBe(global.__db);
    expect(args.auth).toBe(global.__auth);
    expect(args.bucket).toBe(global.__bucket);
    expect(args.increment(-1)).toEqual({ inc: -1 });
    expect(typeof args.revokeIntegrations).toBe('function');
  });

  it('ignores any uid sent in the request body', async () => {
    const handler = require('../functions/src/index.js').deleteMyAccount;
    await handler({ auth: { uid: 'u1', token: { auth_time: nowSeconds() } }, data: { uid: 'someone-else' } });
    expect(global.__erase.mock.calls[0][0].uid).toBe('u1');
  });

  it('tells the app which steps failed, so nothing is claimed as deleted', async () => {
    global.__erase = jest.fn(async () => ({
      ok: false,
      steps: [{ name: 'files', ok: false }, { name: 'integrations', ok: false, required: false }, { name: 'duels', ok: true }],
    }));
    await expect(call({ uid: 'u1', token: { auth_time: nowSeconds() } }))
      .rejects.toMatchObject({ code: 'internal', message: 'delete-incomplete', details: { failed: ['files'] } });
  });

  it('is set up to run long enough for a large account, in the same region as the other functions', () => {
    const opts = require('../functions/src/index.js').deleteMyAccount.__opts;
    expect(opts.timeoutSeconds).toBeGreaterThanOrEqual(300);
    expect(opts.region).toBe('us-central1');
    expect(opts.secrets.map((s) => s.name)).toEqual(expect.arrayContaining(['ROOK_CLIENT_UUID', 'ROOK_CLIENT_SECRET']));
  });

  it('stops ROOK sending data for each source the person had connected', async () => {
    global.fetch = jest.fn(async (url) => ({
      ok: true,
      json: async () => ({ data_sources: [{ data_source: 'Whoop', authorized: true }, { data_source: 'Oura', authorized: false }, { data_source: 'Garmin', authorized: true }] }),
    }));
    await call({ uid: 'u1', token: { auth_time: nowSeconds() } });
    await global.__erase.mock.calls[0][0].revokeIntegrations('u1');
    const urls = global.fetch.mock.calls.map(([u, o]) => `${o?.method || 'GET'} ${u}`);
    expect(urls[0]).toMatch(/GET .*\/api\/v2\/user_id\/u1\/data_sources\/authorized$/);
    const revoked = global.fetch.mock.calls.filter(([, o]) => o?.method === 'POST').map(([, o]) => JSON.parse(o.body).data_source);
    expect(revoked).toEqual(['Whoop', 'Garmin']);
    expect(global.fetch.mock.calls.find(([, o]) => o?.method === 'POST')[0]).toMatch(/\/api\/v1\/user_id\/u1\/data_sources\/revoke_auth$/);
  });

  it('reports a ROOK list failure to the erase logic (which treats it as non-blocking)', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 }));
    await call({ uid: 'u1', token: { auth_time: nowSeconds() } });
    await expect(global.__erase.mock.calls[0][0].revokeIntegrations('u1')).rejects.toThrow(/503/);
  });
});

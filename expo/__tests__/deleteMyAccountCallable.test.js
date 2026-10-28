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
jest.mock('../functions/src/appleRevoke.js', () => ({ revokeAppleGrant: (...a) => global.__revokeApple(...a) }));

const nowSeconds = () => Math.floor(Date.now() / 1000);
const call = (auth, data = {}) => require('../functions/src/index.js').deleteMyAccount({ auth, data });
const recent = () => ({ uid: 'u1', token: { auth_time: nowSeconds() - 60 } });
const accountWith = (...providerIds) => ({ providerData: providerIds.map((providerId) => ({ providerId, uid: providerId === 'apple.com' ? '001234.apple.user' : 'other' })) });

beforeEach(() => {
  jest.resetModules();
  global.__db = { fake: 'db' };
  global.__auth = { fake: 'auth', getUser: jest.fn(async () => accountWith('password')) };
  global.__bucket = { fake: 'bucket' };
  global.__erase = jest.fn(async () => ({ ok: true, steps: [] }));
  global.__revokeApple = jest.fn(async () => ({ revoked: true }));
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

describe('deleteMyAccount: disconnecting from Apple (guideline 5.1.1(v))', () => {
  const withAppleAccount = (...extra) => { global.__auth.getUser = jest.fn(async () => accountWith('apple.com', ...extra)); };
  const failedWith = (code, message) => ({ code, message });

  it('asks for the Apple key and its id, along with the ROOK secrets', () => {
    const opts = require('../functions/src/index.js').deleteMyAccount.__opts;
    expect(opts.secrets.map((s) => s.name)).toEqual(expect.arrayContaining(['APPLE_KEY_ID', 'APPLE_PRIVATE_KEY']));
  });

  it('does not touch Apple for an account that never signed in with Apple, even if a code is sent', async () => {
    global.__auth.getUser = jest.fn(async () => accountWith('password', 'google.com'));
    await expect(call(recent(), { appleAuthorizationCode: 'code-1' })).resolves.toEqual({ deleted: true });
    expect(global.__auth.getUser).toHaveBeenCalledWith('u1');
    expect(global.__revokeApple).not.toHaveBeenCalled();
    expect(global.__erase).toHaveBeenCalledTimes(1);
  });

  it('revokes the Apple token with the code from the app, the key and the Apple id linked to the account', async () => {
    withAppleAccount();
    await expect(call(recent(), { appleAuthorizationCode: ' code-1 ' })).resolves.toEqual({ deleted: true });
    expect(global.__revokeApple).toHaveBeenCalledTimes(1);
    expect(global.__revokeApple).toHaveBeenCalledWith({
      authorizationCode: 'code-1',
      expectedUserId: '001234.apple.user',
      keyId: 'secret-APPLE_KEY_ID',
      privateKey: 'secret-APPLE_PRIVATE_KEY',
    });
  });

  it('revokes before anything is erased', async () => {
    withAppleAccount();
    const order = [];
    global.__revokeApple = jest.fn(async () => { order.push('revoke'); return { revoked: true }; });
    global.__erase = jest.fn(async () => { order.push('erase'); return { ok: true, steps: [] }; });
    await call(recent(), { appleAuthorizationCode: 'code-1' });
    expect(order).toEqual(['revoke', 'erase']);
  });

  it('revokes for an account that has Apple linked next to another way in', async () => {
    withAppleAccount('password');
    await call(recent(), { appleAuthorizationCode: 'code-1' });
    expect(global.__revokeApple).toHaveBeenCalledTimes(1);
  });

  it('takes the Apple id from the account, never from the request', async () => {
    withAppleAccount();
    await call(recent(), { appleAuthorizationCode: 'code-1', appleUserId: 'someone-else', uid: 'u2' });
    expect(global.__revokeApple.mock.calls[0][0].expectedUserId).toBe('001234.apple.user');
  });

  it.each([[undefined], [''], ['   '], [42], [null], [{}]])('refuses, erasing nothing, when an Apple account sends no usable code (%p)', async (appleAuthorizationCode) => {
    withAppleAccount();
    await expect(call(recent(), { appleAuthorizationCode })).rejects.toMatchObject({ code: 'failed-precondition', message: 'apple-code-required' });
    expect(global.__revokeApple).not.toHaveBeenCalled();
    expect(global.__erase).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid-code', 'failed-precondition', 'apple-code-rejected'],
    ['wrong-account', 'failed-precondition', 'apple-wrong-account'],
    ['unavailable', 'unavailable', 'apple-unavailable'],
    ['not-configured', 'internal', 'apple-revoke-failed'],
    ['failed', 'internal', 'apple-revoke-failed'],
    [undefined, 'internal', 'apple-revoke-failed'],
  ])('when Apple says %s, tells the app (%s, %s) and erases nothing', async (reason, code, message) => {
    withAppleAccount();
    global.__revokeApple = jest.fn(async () => { throw Object.assign(new Error('c-one-time-code'), { code: reason }); });
    await expect(call(recent(), { appleAuthorizationCode: 'code-1' })).rejects.toMatchObject(failedWith(code, message));
    expect(global.__erase).not.toHaveBeenCalled();
  });

  it('does not spend the one-time code when the sign-in is too old to delete', async () => {
    withAppleAccount();
    await expect(call({ uid: 'u1', token: { auth_time: nowSeconds() - 6 * 60 } }, { appleAuthorizationCode: 'code-1' }))
      .rejects.toMatchObject({ message: 'recent-login-required' });
    expect(global.__revokeApple).not.toHaveBeenCalled();
    expect(global.__auth.getUser).not.toHaveBeenCalled();
  });

  it('carries on when the sign-in account is already gone', async () => {
    global.__auth.getUser = jest.fn(async () => { throw Object.assign(new Error('gone'), { code: 'auth/user-not-found' }); });
    await expect(call(recent(), { appleAuthorizationCode: 'code-1' })).resolves.toEqual({ deleted: true });
    expect(global.__revokeApple).not.toHaveBeenCalled();
    expect(global.__erase).toHaveBeenCalledTimes(1);
  });

  it('refuses, erasing nothing, when it cannot tell whether the account uses Apple', async () => {
    global.__auth.getUser = jest.fn(async () => { throw Object.assign(new Error('boom'), { code: 'auth/internal-error' }); });
    await expect(call(recent(), { appleAuthorizationCode: 'code-1' })).rejects.toMatchObject({ code: 'unavailable', message: 'apple-check-failed' });
    expect(global.__revokeApple).not.toHaveBeenCalled();
    expect(global.__erase).not.toHaveBeenCalled();
  });
});

// The cloud function that gets Spotify's app token (client credentials) so the phone does not need the client secret
// (functions/src/index.js, functions/src/spotifyAppToken.js). index.js is loaded with the Firebase packages replaced by
// small fakes, and fetch replaced, so nothing leaves the test.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: {} }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

const AUTH = { uid: 'u1' };
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const GOOD = { access_token: 'tok-1', token_type: 'Bearer', expires_in: 3600 };

let fns;
let clock;
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const call = (data = {}, auth = AUTH) => fns.getSpotifyAppToken({ auth, data });

function load(secretValue = (name) => 'secret-' + name) {
  jest.resetModules();
  jest.doMock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => secretValue(name) }) }), { virtual: true });
  fns = require('../functions/src/index.js');
}

beforeEach(() => {
  clock = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  load();
  global.fetch = jest.fn(async () => json(GOOD));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

describe('getSpotifyAppToken', () => {
  it('needs a signed-in caller, and does not call Spotify for anyone else', async () => {
    await expect(call({}, null)).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(call({}, {})).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the Spotify id and secret in this function, in the same region and with the same cap as the other proxies', () => {
    const opts = fns.getSpotifyAppToken.__opts;
    expect(opts.secrets.map((s) => s.name)).toEqual(['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET']);
    expect(opts.region).toBe('us-central1');
    expect(opts.maxInstances).toBe(10);
  });

  it('asks Spotify for a client credentials token with the id and secret from the server', async () => {
    const answer = await call();
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(TOKEN_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('secret-SPOTIFY_CLIENT_ID:secret-SPOTIFY_CLIENT_SECRET').toString('base64')}`);
    expect(init.body).toBe('grant_type=client_credentials');
    expect(answer).toEqual({ accessToken: 'tok-1', expiresIn: 3600 });
  });

  it('sends the phone the token and its lifetime and nothing else, whatever else Spotify says', async () => {
    global.fetch.mockResolvedValue(json({ ...GOOD, scope: 'x', extra: 'secret-SPOTIFY_CLIENT_SECRET' }));
    const answer = await call();
    expect(Object.keys(answer).sort()).toEqual(['accessToken', 'expiresIn']);
    expect(JSON.stringify(answer)).not.toContain('secret-');
  });

  it('hands the same token out again while it has more than a minute left, with the time that is left', async () => {
    await call();
    clock += 1_800_000; // 30 minutes on
    expect(await call()).toEqual({ accessToken: 'tok-1', expiresIn: 1800 });
    clock += 1_700_000; // 28 minutes more: 2 minutes left, still more than the minute held back
    expect(await call()).toEqual({ accessToken: 'tok-1', expiresIn: 100 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('asks for a new token inside the last minute, and after it has run out', async () => {
    await call();
    clock += 3_541_000; // 59 seconds left
    global.fetch.mockResolvedValue(json({ access_token: 'tok-2', expires_in: 3600 }));
    expect(await call()).toEqual({ accessToken: 'tok-2', expiresIn: 3600 });
    clock += 4_000_000;
    global.fetch.mockResolvedValue(json({ access_token: 'tok-3', expires_in: 3600 }));
    expect((await call()).accessToken).toBe('tok-3');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 429, 503])('says so, without the secret or Spotify\'s own words, when Spotify answers %i', async (status) => {
    global.fetch.mockResolvedValue(json({ error: 'invalid_client', error_description: 'bad secret-SPOTIFY_CLIENT_SECRET' }, status));
    const error = await call().catch((e) => e);
    expect(error).toMatchObject({ code: 'internal' });
    expect(error.message).toBe(`Spotify refused the app token request (${status})`);
    expect(error.message).not.toContain('secret-');
    expect(error.message).not.toContain('invalid_client');
  });

  it.each([
    [{}], [{ access_token: '', expires_in: 3600 }], [{ access_token: 5, expires_in: 3600 }], [{ access_token: 'a' }],
    [{ access_token: 'a', expires_in: 0 }], [{ access_token: 'a', expires_in: -5 }], [{ access_token: 'a', expires_in: 'soon' }], [null],
  ])('refuses an answer with no usable token: %j', async (body) => {
    global.fetch.mockResolvedValue(json(body));
    await expect(call()).rejects.toMatchObject({ code: 'internal' });
  });

  it('refuses an answer that is not JSON, and does not keep a failed try', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    await expect(call()).rejects.toMatchObject({ code: 'internal' });
    expect(await call()).toEqual({ accessToken: 'tok-1', expiresIn: 3600 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not keep a refusal either', async () => {
    global.fetch.mockResolvedValueOnce(json({}, 503));
    await expect(call()).rejects.toMatchObject({ code: 'internal' });
    expect((await call()).accessToken).toBe('tok-1');
  });

  it('fails clearly, without calling Spotify, when the id or the secret has not been set on the server', async () => {
    for (const missing of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET']) {
      load((name) => (name === missing ? '' : 'secret-' + name));
      global.fetch = jest.fn(async () => json(GOOD));
      await expect(call()).rejects.toMatchObject({ code: 'failed-precondition' });
      expect(global.fetch).not.toHaveBeenCalled();
    }
  });

  it('logs the status when it fails, and not the secret', async () => {
    global.fetch.mockResolvedValue(json({}, 401));
    await call().catch(() => {});
    expect(console.warn).toHaveBeenCalledWith('[getSpotifyAppToken] failed', { status: 401 });
    expect(JSON.stringify(console.warn.mock.calls)).not.toContain('secret-');
  });
});

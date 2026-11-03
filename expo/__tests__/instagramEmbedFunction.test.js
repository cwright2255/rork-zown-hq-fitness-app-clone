// The cloud function behind the Instagram recipe import (instagramEmbed in functions/src/index.js, with the address check in
// functions/src/instagramUrl.js, the sign-in check in functions/src/bearerToken.js and the daily limit in functions/src/aiQuota.js).
// index.js is loaded with the Firebase packages replaced by small fakes, and fetch replaced by a fake Instagram, so nothing leaves the test.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => global.__db, FieldValue: {} }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: (...args) => global.__verify(...args) }) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => Object.assign(handler, { __opts: opts }), HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

// jest-expo swaps in React Native's small URL class; the function runs on Node, whose URL is the one that decides what a host is.
const reactNativeURL = global.URL;

const POST = 'https://www.instagram.com/p/ABC123/';
const EMBED = 'https://www.instagram.com/p/ABC123/embed/captioned/';
const PAGE = '<html><title>Instagram</title><script>{"owner":{"id":"42","username":"chef.amy"},"thumbnail_src":"https:\\/\\/cdn.example\\/pic.jpg","edge_media_to_caption":{"edges":[{"node":{"text":"Garlic pasta\\n\\n200 g spaghetti \\u2022 3 cloves garlic \\"quick\\""}}]}}</script></html>';

let fns;
const headers = (location) => ({ get: (name) => (String(name).toLowerCase() === 'location' ? location : null) });
const page = (html = PAGE, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: headers(null), text: async () => html });
const redirect = (location, status = 302) => ({ ok: false, status, headers: headers(location) });

// What the function says back: { status, body }, and whether it said anything at all.
// Signed in as u1 unless the request says otherwise: the token 'good-token' is the one the fake Firebase accepts.
const send = async (req) => {
  const out = { status: null, body: undefined };
  const res = { status: (code) => { out.status = code; return res; }, json: (body) => { out.body = body; return res; } };
  await fns.instagramEmbed({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { url: POST }, ...req }, res);
  return out;
};

// Firestore with documents in a map, doc().get() and transactions one at a time: enough for the daily limit.
const fakeDb = () => {
  const docs = new Map();
  global.__docs = docs;
  let queue = Promise.resolve();
  const ref = (path) => ({ path, get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) });
  global.__db = {
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
};
const usedToday = (uid = 'u1') => (global.__docs.get(`aiUsage/${uid}_${global.__today}`) || {}).instagram || 0;

beforeAll(() => { global.URL = require('url').URL; });
afterAll(() => { global.URL = reactNativeURL; });

beforeEach(() => {
  jest.resetModules();
  global.__today = require('../lib/entitlements').aiDayKey(new Date());
  fns = require('../functions/src/index.js');
  fakeDb();
  global.__verify = jest.fn(async (token) => {
    if (token === 'good-token') return { uid: 'u1' };
    if (token === 'other-token') return { uid: 'u2' };
    if (token === 'no-uid-token') return {};
    throw new Error('auth/argument-error: not a Firebase token');
  });
  global.fetch = jest.fn(async () => page());
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; delete global.__db; delete global.__docs; delete global.__verify; delete global.__today; });

describe('instagramEmbed: an Instagram post', () => {
  it('gives back the caption, the account and the picture, decoded', async () => {
    const out = await send();
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      caption: 'Garlic pasta\n\n200 g spaghetti • 3 cloves garlic "quick"',
      username: 'chef.amy',
      thumbnail: 'https://cdn.example/pic.jpg',
    });
  });

  it('fetches the post\'s embed page, as the app\'s own import does, and says it is a recipe bot', async () => {
    await send();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [address, options] = global.fetch.mock.calls[0];
    expect(address).toBe(EMBED);
    expect(options.headers).toEqual({ 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' });
    expect(options.redirect).toBe('manual');
  });

  it.each([
    ['https://instagram.com/p/ABC123', 'https://instagram.com/p/ABC123/embed/captioned/'],
    ['https://www.instagram.com/reel/XYZ/?igsh=tracking#x', 'https://www.instagram.com/reel/XYZ/embed/captioned/'],
  ])('works the embed address out from %s', async (url, embed) => {
    await send({ body: { url } });
    expect(global.fetch.mock.calls[0][0]).toBe(embed);
  });

  it('gives the caption without an account or picture when the page has none', async () => {
    global.fetch.mockResolvedValue(page('{"edge_media_to_caption":{"edges":[{"node":{"text":"Just words"}}]}}'));
    const out = await send();
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ caption: 'Just words', username: null, thumbnail: null });
  });

  it('keeps the caption when the account or picture will not decode', async () => {
    global.fetch.mockResolvedValue(page('{"owner":{"id":"1","username":"bad\\uZZZZ"},"edge_media_to_caption":{"edges":[{"node":{"text":"Kept"}}]}}'));
    const out = await send();
    expect(out.status).toBe(200);
    expect(out.body.caption).toBe('Kept');
  });

  it('follows a redirect to the other Instagram host', async () => {
    global.fetch.mockResolvedValueOnce(redirect('https://instagram.com/p/ABC123/embed/captioned/')).mockResolvedValueOnce(page());
    const out = await send();
    expect(out.status).toBe(200);
    expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([EMBED, 'https://instagram.com/p/ABC123/embed/captioned/']);
  });

  it('keeps its region and cross-origin setting', () => {
    expect(fns.instagramEmbed.__opts).toEqual({ region: 'us-central1', cors: true });
  });
});

describe('instagramEmbed: an address that is not Instagram\'s', () => {
  it.each([
    ['another site', 'https://example.com/p/ABC123/'],
    ['the name inside another site\'s address', 'https://instagram.com.example.com/p/ABC123/'],
    ['the name in the path', 'https://example.com/instagram.com/p/ABC123/'],
    ['plain http', 'http://www.instagram.com/p/ABC123/'],
    ['a user name that looks like the host', 'https://www.instagram.com@example.com/p/ABC123/'],
    ['a port', 'https://www.instagram.com:8443/p/ABC123/'],
    ['the short-link host', 'https://instagr.am/p/ABC123/'],
    ['the cloud metadata address', 'http://169.254.169.254/computeMetadata/v1/'],
    ['the cloud metadata name', 'http://metadata.google.internal/computeMetadata/v1/'],
    ['a local address', 'https://localhost:8080/'],
    ['a file address', 'file:///etc/passwd'],
    ['text that is not an address', 'not a link'],
  ])('turns away %s with a 400, and fetches nothing', async (_name, url) => {
    const out = await send({ body: { url } });
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ error: 'Send the link to an Instagram post.' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([[undefined], [null], [''], [42], [{}], [['https://www.instagram.com/p/ABC123/']]])('turns away %j as the link with a 400', async (url) => {
    const out = await send({ body: { url } });
    expect(out.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('turns away a request with no body', async () => {
    const out = await send({ body: undefined });
    expect(out.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not follow a redirect from Instagram to anywhere else, and says only that Instagram did not answer', async () => {
    global.fetch.mockResolvedValue(redirect('http://169.254.169.254/computeMetadata/v1/'));
    const out = await send();
    expect(out.status).toBe(502);
    expect(out.body).toEqual({ error: 'Instagram did not answer. Try again in a moment.' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('instagramEmbed: what it says when something goes wrong', () => {
  const said = (out) => JSON.stringify(out.body);

  it('refuses anything but POST with a 405', async () => {
    for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
      const out = await send({ method });
      expect(out).toEqual({ status: 405, body: { error: 'Method not allowed' } });
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says Instagram did not answer when Instagram answers with an error, without its status', async () => {
    global.fetch.mockResolvedValue(page('<html>Sorry, this page isn\'t available.</html>', 429));
    const out = await send();
    expect(out).toEqual({ status: 502, body: { error: 'Instagram did not answer. Try again in a moment.' } });
    expect(said(out)).not.toMatch(/429/);
  });

  it('says no caption was found for a page without one, without the page\'s status, size, title or markers', async () => {
    global.fetch.mockResolvedValue(page('<html><title>Login • Instagram</title>Please log in. challenge edge_media_to_caption</html>'));
    const out = await send();
    expect(out).toEqual({ status: 404, body: { error: 'No caption was found for that post.' } });
    for (const leak of ['Login', 'title', 'chars', 'HTTP', '200', 'edge_media_to_caption', 'log in', 'server-side']) expect(said(out)).not.toContain(leak);
  });

  it('writes the details to the log instead', async () => {
    global.fetch.mockResolvedValue(page('<html><title>Login • Instagram</title>log in</html>'));
    await send();
    expect(console.warn).toHaveBeenCalledWith('[instagramEmbed]', 'no caption pattern', expect.objectContaining({ status: 200, title: 'Login • Instagram', loginMarker: true, partialMarker: false }));
  });

  it('says no caption was found when the caption is empty', async () => {
    global.fetch.mockResolvedValue(page('{"edge_media_to_caption":{"edges":[{"node":{"text":""}}]}}'));
    expect(await send()).toEqual({ status: 404, body: { error: 'No caption was found for that post.' } });
  });

  it('says something went wrong when the caption will not decode, without the decoder\'s message', async () => {
    global.fetch.mockResolvedValue(page('{"edge_media_to_caption":{"edges":[{"node":{"text":"bad \\uZZZZ"}}]}}'));
    const out = await send();
    expect(out).toEqual({ status: 500, body: { error: 'Something went wrong reading that post.' } });
    expect(said(out)).not.toMatch(/JSON|Unexpected|position/i);
  });

  it('says something went wrong when the fetch itself fails, without the failure\'s message', async () => {
    global.fetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND www.instagram.com secret-detail'));
    const out = await send();
    expect(out).toEqual({ status: 500, body: { error: 'Something went wrong reading that post.' } });
    expect(said(out)).not.toMatch(/ENOTFOUND|secret-detail|Server error/);
    expect(console.warn).toHaveBeenCalledWith('[instagramEmbed]', 'failed', expect.stringContaining('ENOTFOUND'));
  });

  it('does not put the address it was sent in what it says back', async () => {
    const out = await send({ body: { url: 'https://example.com/<script>alert(1)</script>' } });
    expect(said(out)).not.toMatch(/example|script/);
  });
});

describe('instagramEmbed: who is asking', () => {
  const SIGN_IN = { error: 'Sign in to import from Instagram.' };

  it('turns away a request with no sign-in token with a 401, and reads nothing', async () => {
    const out = await send({ headers: {} });
    expect(out).toEqual({ status: 401, body: SIGN_IN });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(global.__verify).not.toHaveBeenCalled();
  });

  it('turns away a request with no headers at all the same way', async () => {
    const out = await send({ headers: undefined });
    expect(out).toEqual({ status: 401, body: SIGN_IN });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('turns away a token that Firebase does not accept, and a token that names nobody', async () => {
    for (const token of ['made-up', 'no-uid-token', 'x'.repeat(5000)]) {
      const out = await send({ headers: { authorization: `Bearer ${token}` } });
      expect(out).toEqual({ status: 401, body: SIGN_IN });
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['another kind of sign-in', 'Basic dXNlcjpwYXNz'],
    ['a token with no Bearer word', 'good-token'],
    ['the Bearer word alone', 'Bearer'],
    ['two tokens', 'Bearer good-token other-token'],
    ['a blank token', 'Bearer    '],
  ])('turns away %s', async (_name, authorization) => {
    const out = await send({ headers: { authorization } });
    expect(out).toEqual({ status: 401, body: SIGN_IN });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('hands Firebase the token exactly as it was sent, and lets that person in', async () => {
    const out = await send({ headers: { authorization: 'Bearer good-token' } });
    expect(global.__verify).toHaveBeenCalledWith('good-token');
    expect(out.status).toBe(200);
  });

  it('takes the Bearer word in any letter case', async () => {
    const out = await send({ headers: { authorization: 'bearer good-token' } });
    expect(out.status).toBe(200);
  });

  it('asks who is calling before it looks at the link, so a stranger learns nothing about what it accepts', async () => {
    const out = await send({ headers: {}, body: { url: 'https://example.com/' } });
    expect(out).toEqual({ status: 401, body: SIGN_IN });
  });

  it('still refuses anything but POST with a 405 first, signed in or not', async () => {
    expect(await send({ method: 'GET', headers: {} })).toEqual({ status: 405, body: { error: 'Method not allowed' } });
  });

  it('says the same few words to every kind of stranger, without the reason Firebase gave', async () => {
    const out = await send({ headers: { authorization: 'Bearer made-up' } });
    expect(JSON.stringify(out.body)).not.toMatch(/auth\/|argument|Firebase token/);
  });

  it('does not count a stranger\'s request against anyone', async () => {
    await send({ headers: {} });
    await send({ headers: { authorization: 'Bearer made-up' } });
    expect(global.__docs.size).toBe(0);
  });
});

describe('instagramEmbed: the limit for each person', () => {
  const { INSTAGRAM_DAILY_CAP } = require('../functions/src/aiQuota.js');
  const LIMIT = { error: 'That is today\'s limit for importing from Instagram. Try again tomorrow.' };

  it('is 30 imports a day', () => {
    expect(INSTAGRAM_DAILY_CAP).toBe(30);
  });

  it('counts each import against the person who asked, under today\'s date', async () => {
    await send();
    await send();
    expect(usedToday('u1')).toBe(2);
    expect(global.__docs.get(`aiUsage/u1_${global.__today}`)).toEqual({ uid: 'u1', day: global.__today, instagram: 2 });
  });

  it('lets the last import of the day through and turns the next one away with a 429, fetching nothing for it', async () => {
    for (let n = 1; n <= INSTAGRAM_DAILY_CAP; n += 1) {
      expect((await send()).status).toBe(200);
    }
    expect(global.fetch).toHaveBeenCalledTimes(INSTAGRAM_DAILY_CAP);
    const over = await send();
    expect(over).toEqual({ status: 429, body: LIMIT });
    expect(global.fetch).toHaveBeenCalledTimes(INSTAGRAM_DAILY_CAP);
    expect(usedToday('u1')).toBe(INSTAGRAM_DAILY_CAP);
  });

  it('does not let one person\'s limit stop another', async () => {
    global.__docs.set(`aiUsage/u1_${global.__today}`, { uid: 'u1', day: global.__today, instagram: INSTAGRAM_DAILY_CAP });
    expect((await send()).status).toBe(429);
    expect((await send({ headers: { authorization: 'Bearer other-token' } })).status).toBe(200);
    expect(usedToday('u2')).toBe(1);
  });

  it('starts over on a new day', async () => {
    global.__docs.set('aiUsage/u1_2020-01-01', { uid: 'u1', day: '2020-01-01', instagram: INSTAGRAM_DAILY_CAP });
    expect((await send()).status).toBe(200);
    expect(usedToday('u1')).toBe(1);
  });

  it('keeps its count apart from the nutrition targets and the Coach\'s messages', async () => {
    global.__docs.set(`aiUsage/u1_${global.__today}`, { uid: 'u1', day: global.__today, nutrition: 5, coach: 12 });
    expect((await send()).status).toBe(200);
    expect(global.__docs.get(`aiUsage/u1_${global.__today}`)).toEqual({ uid: 'u1', day: global.__today, nutrition: 5, coach: 12, instagram: 1 });
  });

  it('counts an import that finds no caption, since Instagram was asked just the same', async () => {
    global.fetch.mockResolvedValue(page('<html><title>Instagram</title></html>'));
    expect((await send()).status).toBe(404);
    expect(usedToday('u1')).toBe(1);
  });

  it('counts an import when Instagram does not answer', async () => {
    global.fetch.mockResolvedValue(page('', 429));
    expect((await send()).status).toBe(502);
    expect(usedToday('u1')).toBe(1);
  });

  it('does not count a link that is not an Instagram post: nothing was asked of Instagram', async () => {
    for (const url of ['https://example.com/', 'not a link', undefined]) await send({ body: { url } });
    expect(usedToday('u1')).toBe(0);
    expect(global.__docs.size).toBe(0);
  });

  it('does not count a request that was not a POST', async () => {
    await send({ method: 'GET' });
    expect(global.__docs.size).toBe(0);
  });

  it('refuses, rather than lets everything through, when the count cannot be kept', async () => {
    global.__db.runTransaction = async () => { throw new Error('database down'); };
    const out = await send();
    expect(out).toEqual({ status: 500, body: { error: 'Something went wrong reading that post.' } });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(out.body)).not.toMatch(/database/);
  });

  it('writes who hit the limit to the log, not to the person', async () => {
    global.__docs.set(`aiUsage/u1_${global.__today}`, { uid: 'u1', day: global.__today, instagram: INSTAGRAM_DAILY_CAP });
    const out = await send();
    expect(JSON.stringify(out.body)).not.toMatch(/u1|30/);
    expect(console.warn).toHaveBeenCalledWith('[instagramEmbed]', 'daily limit reached', 'u1');
  });
});

// The cloud function behind the Instagram recipe import (instagramEmbed in functions/src/index.js, with the address check in
// functions/src/instagramUrl.js). index.js is loaded with the Firebase packages replaced by small fakes, and fetch replaced by a fake
// Instagram, so nothing leaves the test.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: {} }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
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
const send = async (req) => {
  const out = { status: null, body: undefined };
  const res = { status: (code) => { out.status = code; return res; }, json: (body) => { out.body = body; return res; } };
  await fns.instagramEmbed({ method: 'POST', body: { url: POST }, ...req }, res);
  return out;
};

beforeAll(() => { global.URL = require('url').URL; });
afterAll(() => { global.URL = reactNativeURL; });

beforeEach(() => {
  jest.resetModules();
  fns = require('../functions/src/index.js');
  global.fetch = jest.fn(async () => page());
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

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

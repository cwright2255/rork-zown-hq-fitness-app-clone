// Which addresses instagramEmbed will fetch (functions/src/instagramUrl.js): https on instagram.com or www.instagram.com and nowhere
// else, judged on the parsed address, and again on every redirect.
import { instagramUrl, embedUrl, fetchFromInstagram } from '../functions/src/instagramUrl';

// jest-expo swaps in React Native's small URL class, which does not read addresses the way Node does (it keeps the case of a host, for one).
// The function runs on Node, and it is Node's URL that decides what a host is, so that is the one these tests use.
const reactNativeURL = global.URL;
beforeAll(() => { global.URL = require('url').URL; });
afterAll(() => { global.URL = reactNativeURL; });

describe('instagramUrl', () => {
  it.each([
    'https://www.instagram.com/p/ABC123/',
    'https://instagram.com/p/ABC123/',
    'https://www.instagram.com/reel/XYZ789/?igsh=abc',
    'https://WWW.INSTAGRAM.COM/p/ABC123/',
    'https://www.instagram.com/p/ABC123/#comments',
    '  https://www.instagram.com/p/ABC123/  ',
  ])('accepts %j', (address) => {
    const parsed = instagramUrl(address);
    expect(parsed).not.toBeNull();
    expect(['instagram.com', 'www.instagram.com']).toContain(parsed.hostname);
    expect(parsed.protocol).toBe('https:');
  });

  it.each([
    ['plain http', 'http://www.instagram.com/p/ABC123/'],
    ['another site', 'https://example.com/p/ABC123/'],
    ['the name inside another site\'s address', 'https://instagram.com.example.com/p/ABC123/'],
    ['the name at the end of another site\'s name', 'https://notinstagram.com/p/ABC123/'],
    ['the name in the path', 'https://example.com/instagram.com/p/ABC123/'],
    ['the name in the query', 'https://example.com/?u=https://www.instagram.com/p/ABC123/'],
    ['the name in the fragment', 'https://example.com/#www.instagram.com'],
    ['a user name that looks like the host', 'https://www.instagram.com@example.com/p/ABC123/'],
    ['a user name on the real host', 'https://someone@www.instagram.com/p/ABC123/'],
    ['a user name and password on the real host', 'https://someone:secret@www.instagram.com/p/ABC123/'],
    ['a password with no user name on the real host', 'https://:secret@www.instagram.com/p/ABC123/'],
    ['a port', 'https://www.instagram.com:8443/p/ABC123/'],
    ['the short-link host', 'https://instagr.am/p/ABC123/'],
    ['another Instagram sub-domain', 'https://l.instagram.com/?u=https%3A%2F%2Fexample.com'],
    ['a sub-domain of the real host', 'https://evil.www.instagram.com/p/ABC123/'],
    ['a backslash trick', 'https://example.com\\@www.instagram.com/p/ABC123/'],
    ['a numeric address', 'https://157.240.1.174/p/ABC123/'],
    ['a local address', 'https://localhost/p/ABC123/'],
    ['the cloud metadata address', 'http://169.254.169.254/computeMetadata/v1/'],
    ['the cloud metadata name', 'http://metadata.google.internal/computeMetadata/v1/'],
    ['a file address', 'file:///etc/passwd'],
    ['a javascript address', 'javascript:alert(1)'],
    ['a data address', 'data:text/html,<p>hi</p>'],
    ['an ftp address', 'ftp://www.instagram.com/p/ABC123/'],
    ['no scheme', 'www.instagram.com/p/ABC123/'],
    ['a scheme with nothing after it', 'https://'],
    ['text that is not an address', 'my favourite post'],
  ])('refuses %s', (_name, address) => {
    expect(instagramUrl(address)).toBeNull();
  });

  it.each([[undefined], [null], [''], ['   '], [42], [true], [{}], [['https://www.instagram.com/p/ABC123/']]])('refuses %j, which is not an address', (value) => {
    expect(instagramUrl(value)).toBeNull();
  });

  it('refuses an address longer than 2048 characters, and accepts one of exactly 2048', () => {
    const base = 'https://www.instagram.com/p/';
    expect(instagramUrl(base + 'a'.repeat(2048 - base.length))).not.toBeNull();
    expect(instagramUrl(base + 'a'.repeat(2049 - base.length))).toBeNull();
  });

  it('keeps the address as written in .href, with the host the address really has', () => {
    const parsed = instagramUrl('https://WWW.Instagram.com/p/AbC/?x=1');
    expect(parsed.hostname).toBe('www.instagram.com');
    expect(parsed.pathname).toBe('/p/AbC/');
  });
});

describe('embedUrl', () => {
  it('adds embed/captioned/ to the post\'s own path and drops the query and fragment', () => {
    expect(embedUrl(instagramUrl('https://www.instagram.com/p/ABC123/'))).toBe('https://www.instagram.com/p/ABC123/embed/captioned/');
    expect(embedUrl(instagramUrl('https://www.instagram.com/reel/XYZ/?igsh=abc#top'))).toBe('https://www.instagram.com/reel/XYZ/embed/captioned/');
  });

  it('adds the slash a path is missing', () => {
    expect(embedUrl(instagramUrl('https://instagram.com/p/ABC123'))).toBe('https://instagram.com/p/ABC123/embed/captioned/');
  });

  it('stays on the host it was given', () => {
    expect(embedUrl(instagramUrl('https://instagram.com/p/A/'))).toMatch(/^https:\/\/instagram\.com\//);
    expect(embedUrl(instagramUrl('https://www.instagram.com/p/A/'))).toMatch(/^https:\/\/www\.instagram\.com\//);
  });
});

describe('fetchFromInstagram', () => {
  const FIRST = 'https://www.instagram.com/p/ABC/embed/captioned/';
  const headers = (location) => ({ get: (name) => (String(name).toLowerCase() === 'location' ? location : null) });
  const ok = (body = 'page') => ({ status: 200, ok: true, headers: headers(null), text: async () => body });
  const redirect = (location, status = 302) => ({ status, ok: false, headers: headers(location) });
  const sequence = (...responses) => {
    const fetchFn = jest.fn(async () => responses[Math.min(fetchFn.mock.calls.length - 1, responses.length - 1)]);
    return fetchFn;
  };

  it('returns the response when there is no redirect, and asks for it to be left to us', async () => {
    const fetchFn = sequence(ok());
    const response = await fetchFromInstagram(FIRST, { headers: { 'User-Agent': 'x' } }, fetchFn);
    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith(FIRST, { headers: { 'User-Agent': 'x' }, redirect: 'manual' });
  });

  it('hands back an error response as it is, for the caller to deal with', async () => {
    const response = await fetchFromInstagram(FIRST, {}, sequence({ status: 404, ok: false, headers: headers(null) }));
    expect(response.status).toBe(404);
  });

  it('follows a redirect to the other Instagram host, and one given as a path', async () => {
    const fetchFn = sequence(redirect('https://instagram.com/p/ABC/embed/captioned/'), redirect('/p/ABC/embed/captioned/?x=1', 301), ok('final'));
    const response = await fetchFromInstagram(FIRST, {}, fetchFn);
    expect(await response.text()).toBe('final');
    expect(fetchFn.mock.calls.map((c) => c[0])).toEqual([
      FIRST,
      'https://instagram.com/p/ABC/embed/captioned/',
      'https://instagram.com/p/ABC/embed/captioned/?x=1',
    ]);
  });

  it.each([301, 302, 303, 307, 308])('follows a %i', async (status) => {
    const response = await fetchFromInstagram(FIRST, {}, sequence(redirect('https://instagram.com/x/', status), ok()));
    expect(response.status).toBe(200);
  });

  it.each([
    ['another site', 'https://example.com/'],
    ['plain http on Instagram', 'http://www.instagram.com/p/ABC/'],
    ['the cloud metadata address', 'http://169.254.169.254/computeMetadata/v1/'],
    ['a look-alike name', 'https://www.instagram.com.example.com/'],
    ['a user name on Instagram', 'https://x@www.instagram.com/'],
    ['another Instagram sub-domain', 'https://l.instagram.com/'],
    ['a file address', 'file:///etc/passwd'],
  ])('gives up, without fetching it, on a redirect to %s', async (_name, location) => {
    const fetchFn = sequence(redirect(location), ok('secret'));
    expect(await fetchFromInstagram(FIRST, {}, fetchFn)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gives up on a redirect with nowhere to go, or with an address that is not one', async () => {
    expect(await fetchFromInstagram(FIRST, {}, sequence(redirect(null)))).toBeNull();
    expect(await fetchFromInstagram(FIRST, {}, sequence(redirect('')))).toBeNull();
    expect(await fetchFromInstagram(FIRST, {}, sequence(redirect('http://[bad')))).toBeNull();
    expect(await fetchFromInstagram(FIRST, {}, sequence({ status: 302, ok: false }))).toBeNull();
  });

  it('gives up when a good redirect is followed by a bad one', async () => {
    const fetchFn = sequence(redirect('https://instagram.com/a/'), redirect('https://example.com/'), ok());
    expect(await fetchFromInstagram(FIRST, {}, fetchFn)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('follows at most 3 redirects', async () => {
    const three = sequence(redirect('https://instagram.com/1/'), redirect('https://instagram.com/2/'), redirect('https://instagram.com/3/'), ok('end'));
    expect(await (await fetchFromInstagram(FIRST, {}, three)).text()).toBe('end');
    expect(three).toHaveBeenCalledTimes(4);

    const four = sequence(redirect('https://instagram.com/1/'), redirect('https://instagram.com/2/'), redirect('https://instagram.com/3/'), redirect('https://instagram.com/4/'), ok('end'));
    expect(await fetchFromInstagram(FIRST, {}, four)).toBeNull();
    expect(four).toHaveBeenCalledTimes(4);
  });

  it('gives up on a redirect that loops', async () => {
    const fetchFn = sequence(redirect(FIRST));
    expect(await fetchFromInstagram(FIRST, {}, fetchFn)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it('passes a network failure on', async () => {
    await expect(fetchFromInstagram(FIRST, {}, async () => { throw new Error('fetch failed'); })).rejects.toThrow('fetch failed');
  });
});

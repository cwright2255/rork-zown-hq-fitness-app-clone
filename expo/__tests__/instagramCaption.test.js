// What instagramEmbed reads out of Instagram's embed page (functions/src/instagramCaption.js): the caption, the poster's user name and
// the picture's address, in the plain shape and in the wrapped shape, where the same data is written again as a string inside the page's
// data and every quote mark and backslash has one more backslash in front of it.
import { readEmbedPage, readWrappedString } from '../functions/src/instagramCaption';

// How Instagram writes data into the wrapped shape: the data as JSON (a character outside ASCII as \uXXXX and a slash as \/, the way
// Instagram writes it), and then that JSON again as a string, which is what puts the extra backslashes in.
const instagramJson = (value) => JSON.stringify(value)
  .replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  .replace(/\//g, '\\/');
const wrapped = (value) => JSON.stringify(instagramJson(value)).slice(1, -1);
const wrappedPage = (data) => `<html><title>Instagram</title><script>{"contextJSON":"${wrapped(data)}"}</script></html>`;
const post = (text, extra = {}) => ({
  owner: { id: '42', username: 'chef.amy' },
  thumbnail_src: 'https://cdn.example/pic.jpg?x=1&y=2',
  edge_media_to_caption: { edges: [{ node: { text } }] },
  ...extra,
});

const PLAIN_PAGE = '<html><script>{"owner":{"id":"42","username":"chef.amy"},"thumbnail_src":"https:\\/\\/cdn.example\\/pic.jpg","edge_media_to_caption":{"edges":[{"node":{"text":"Garlic pasta\\n\\n200 g spaghetti \\u2022 3 cloves garlic \\"quick\\""}}]}}</script></html>';

describe('readEmbedPage: the plain shape', () => {
  it('reads the caption, the user name and the picture', () => {
    expect(readEmbedPage(PLAIN_PAGE)).toEqual({
      ok: true,
      caption: 'Garlic pasta\n\n200 g spaghetti \u2022 3 cloves garlic "quick"',
      username: 'chef.amy',
      thumbnail: 'https://cdn.example/pic.jpg',
    });
  });

  it('gives null for a user name or picture the page does not have', () => {
    expect(readEmbedPage('{"edge_media_to_caption":{"edges":[{"node":{"text":"Just words"}}]}}')).toEqual({
      ok: true, caption: 'Just words', username: null, thumbnail: null,
    });
  });

  it('keeps the caption when the user name or picture will not decode', () => {
    const out = readEmbedPage('{"owner":{"id":"1","username":"bad\\uZZZZ"},"thumbnail_src":"also\\uZZZZ","edge_media_to_caption":{"edges":[{"node":{"text":"Kept"}}]}}');
    expect(out).toEqual({ ok: true, caption: 'Kept', username: null, thumbnail: null });
  });

  it('says the caption is empty, or that it will not decode', () => {
    expect(readEmbedPage('{"edge_media_to_caption":{"edges":[{"node":{"text":""}}]}}')).toEqual({ ok: false, reason: 'empty' });
    const bad = readEmbedPage('{"edge_media_to_caption":{"edges":[{"node":{"text":"bad \\uZZZZ"}}]}}');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('would-not-decode');
    expect(typeof bad.detail).toBe('string');
  });
});

describe('readEmbedPage: the wrapped shape', () => {
  it('reads the caption, the user name and the picture', () => {
    expect(readEmbedPage(wrappedPage(post('Garlic pasta')))).toEqual({
      ok: true,
      caption: 'Garlic pasta',
      username: 'chef.amy',
      thumbnail: 'https://cdn.example/pic.jpg?x=1&y=2',
    });
  });

  it('reads the caption of the live page it was written for: an apostrophe as \\\\u2019, new lines as \\\\n, an emoji as a pair', () => {
    // The page as the live carousel gave it (cut off after "Save for late"), with an ending made up for the test.
    const live = String.raw`ght\":1920,\"width\":1440},\"accessibility_caption\":null,\"edge_media_to_caption\":{\"edges\":[{\"node\":{\"text\":\"Episode 14 : What\\u2019s for Supper? \\n\\nLet\\u2019s Make Red Thai Curry Dumpling Bake \\ud83e\\udd29\\n\\nSave for later\"}}]}`;
    const out = readEmbedPage(live);
    expect(out.ok).toBe(true);
    expect(out.caption).toBe('Episode 14 : What\u2019s for Supper? \n\nLet\u2019s Make Red Thai Curry Dumpling Bake \ud83e\udd29\n\nSave for later');
  });

  it.each([
    ['an apostrophe and an accent', 'It\u2019s caf\u00e9 time'],
    ['new lines and tabs', 'Line one\n\nLine two\twith a tab'],
    ['quote marks', 'Say "hello" and \'hi\''],
    ['backslashes', 'C:\\recipes\\pasta and a trailing one\\'],
    ['a backslash before a quote mark', 'a \\" b'],
    ['slashes', '1/2 cup https://example.com/a/b'],
    ['an emoji', 'Spicy \ud83c\udf36\ufe0f noodles \ud83e\udd29'],
    ['characters that are escaped at both levels', '\u201cquoted\u201d \u2022 \u00bd cup \u2014 done'],
    ['hashtags and ampersands', 'Dinner #easy #quick & tasty <b>bold</b>'],
    ['something that looks like the end of the data', 'x"}}]},"owner":{"id":"1","username":"not-me"}'],
  ])('reads a caption with %s', (_what, text) => {
    const out = readEmbedPage(wrappedPage(post(text)));
    expect(out.ok).toBe(true);
    expect(out.caption).toBe(text);
    expect(out.username).toBe('chef.amy');
  });

  it('reads a caption as long as Instagram allows, with an emoji in every place', () => {
    const text = '\ud83e\udd29'.repeat(1100);
    expect(readEmbedPage(wrappedPage(post(text))).caption).toBe(text);
    const long = `${'word '.repeat(440)}`.trim();
    expect(readEmbedPage(wrappedPage(post(long))).caption).toBe(long);
  });

  it('gives null for a user name or picture the page does not have, and keeps the caption', () => {
    const out = readEmbedPage(wrappedPage({ edge_media_to_caption: { edges: [{ node: { text: 'Just words' } }] } }));
    expect(out).toEqual({ ok: true, caption: 'Just words', username: null, thumbnail: null });
  });

  it('keeps the caption when the user name will not decode', () => {
    const page = `{"x":"${wrapped(post('Kept')).replace('chef.amy', 'bad\\\\uZZZZ')}"}`;
    const out = readEmbedPage(page);
    expect(out.ok).toBe(true);
    expect(out.caption).toBe('Kept');
    expect(out.username).toBeNull();
  });

  it('finds no caption when the page lists none', () => {
    expect(readEmbedPage(wrappedPage({ edge_media_to_caption: { edges: [] } }))).toEqual({ ok: false, reason: 'no-caption-pattern' });
  });

  it('says the caption is empty, or that it will not decode', () => {
    expect(readEmbedPage(wrappedPage(post('')))).toEqual({ ok: false, reason: 'empty' });
    const bad = readEmbedPage(`{"x":"\\"edge_media_to_caption\\":{\\"edges\\":[{\\"node\\":{\\"text\\":\\"bad \\\\uZZZZ\\"}}]}"}`);
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe('would-not-decode');
  });

  it('finds no caption when the page ends before the caption does', () => {
    const page = wrappedPage(post('This caption is cut off by the end of the page'));
    const cut = page.slice(0, page.indexOf('cut off'));
    expect(readEmbedPage(cut)).toEqual({ ok: false, reason: 'no-caption-pattern' });
  });

  it('reads a caption where the page writes an ampersand or an angle bracket as \\uXXXX', () => {
    const page = '{"x":"\\"edge_media_to_caption\\":{\\"edges\\":[{\\"node\\":{\\"text\\":\\"Salt \\u0026 pepper \\u003c3\\"}}]}"}';
    expect(readEmbedPage(page).caption).toBe('Salt & pepper <3');
  });

  it('reads the first caption when the page has more than one', () => {
    const page = `${wrappedPage(post('First'))}${wrappedPage(post('Second'))}`;
    expect(readEmbedPage(page).caption).toBe('First');
  });

  it('prefers the plain shape when a page has both', () => {
    expect(readEmbedPage(`${wrappedPage(post('Wrapped'))}${PLAIN_PAGE}`).caption).toContain('Garlic pasta');
  });
});

describe('readEmbedPage: pages with nothing to read', () => {
  it.each([
    ['an empty page', ''],
    ['a login page', '<html><title>Login \u2022 Instagram</title>Please log in. challenge</html>'],
    ['the caption name with nothing after it', 'edge_media_to_caption'],
    ['the wrapped caption name with nothing after it', '\\"edge_media_to_caption\\":{\\"edges\\":[{\\"node\\":{\\"text\\":\\"'],
    ['a caption that is not a string', '"edge_media_to_caption":{"edges":[{"node":{"text":12}}]}'],
  ])('finds no caption in %s', (_what, html) => {
    expect(readEmbedPage(html)).toEqual({ ok: false, reason: 'no-caption-pattern' });
  });

  it.each([[undefined], [null], [42], [{}], [['a']]])('finds no caption in %j, and does not throw', (value) => {
    expect(readEmbedPage(value)).toEqual({ ok: false, reason: 'no-caption-pattern' });
  });
});

describe('readWrappedString', () => {
  const START = '\\"text\\":\\"';
  const read = (page) => readWrappedString(page, page.indexOf(START) + START.length);

  it('reads up to the closing quote mark and no further', () => {
    expect(read('\\"text\\":\\"hello\\",\\"more\\":\\"no\\"')).toBe('hello');
  });

  it('undoes the extra layer and leaves the value\'s own escapes for JSON.parse', () => {
    const raw = read('\\"text\\":\\"a\\\\nb \\\\u2019 \\\\\\"q\\\\\\" \\\\\\\\ \\/\\"');
    expect(raw).toBe('a\\nb \\u2019 \\"q\\" \\\\ /');
    expect(JSON.parse(`"${raw}"`)).toBe('a\nb \u2019 "q" \\ /');
  });

  it('reads a character the page itself writes as \\uXXXX (an ampersand, an angle bracket) as that character', () => {
    expect(read('\\"text\\":\\"fish \\u0026 chips \\u003cb\\u003e\\"')).toBe('fish & chips <b>');
    expect(read('\\"text\\":\\"caf\\u00e9\\"')).toBe('caf\u00e9');
  });

  it.each([['\\n', '\n'], ['\\t', '\t'], ['\\r', '\r'], ['\\b', '\b'], ['\\f', '\f']])('decodes the page\'s own %s as that one character', (escape, character) => {
    // Not something a value holds (JSON.parse refuses a raw control character in a string, and readEmbedPage then says it will not
    // decode), but the page's layer is a JSON string, so it is undone completely.
    expect(read(`\\"text\\":\\"a${escape}b\\"`)).toBe(`a${character}b`);
  });

  it('does not end at a quote mark that is part of the value', () => {
    expect(read('\\"text\\":\\"say \\\\\\"hi\\\\\\" now\\"')).toBe('say \\"hi\\" now');
  });

  it('does not end at a backslash that is part of the value', () => {
    expect(read('\\"text\\":\\"ends with a backslash \\\\\\\\\\"')).toBe('ends with a backslash \\\\');
  });

  it.each([
    ['never closed', '\\"text\\":\\"no end'],
    ['a bare quote mark before the end', '\\"text\\":\\"a"b\\"'],
    ['an escape the page cannot hold', '\\"text\\":\\"a\\xb\\"'],
    ['a unicode escape cut short', '\\"text\\":\\"a\\u12\\"'],
    ['a unicode escape that is not hex', '\\"text\\":\\"a\\uZZZZ\\"'],
    ['a backslash as the last character', '\\"text\\":\\"a\\'],
  ])('gives null for %s', (_what, page) => {
    expect(read(page)).toBeNull();
  });

  it('gives null, and stops reading, for a string that does not close within 60,000 characters', () => {
    const page = `\\"text\\":\\"${'a'.repeat(70000)}\\"`;
    expect(read(page)).toBeNull();
    const fits = `\\"text\\":\\"${'a'.repeat(59000)}\\"`;
    expect(read(fits)).toHaveLength(59000);
  });
});

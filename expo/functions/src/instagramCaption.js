// What instagramEmbed (index.js) reads out of an Instagram post's embed page: the caption, and when they are there the poster's user
// name and the picture's address.
//
// Instagram has put that data on the page in two shapes, and the page can be either:
//
//   plain    "edge_media_to_caption":{"edges":[{"node":{"text":"Episode 14 ’ ..."}}]}
//   wrapped  \"edge_media_to_caption\":{\"edges\":[{\"node\":{\"text\":\"Episode 14 \\u2019 ...\"}}]}
//
// The wrapped shape is the same data written a second time as a string inside the page's own data, so every quote mark and every
// backslash in it has one more backslash in front of it (an apostrophe written ’ shows up as \\u2019, a new line as \\n, a quote
// inside the caption as \\\"). Before this file the function looked only for the plain shape, and for a page in the wrapped shape it
// found no caption on any post.
//
// Pure functions with no Firebase in them, so they are tested directly (__tests__/instagramCaption.test.js).

// The longest stretch of page that is read for one value. A caption is at most 2,200 characters, and an emoji takes 12 in the wrapped
// shape, so this is far more than any caption needs; it stops a page that never closes its string from being read to the end.
const MAX_RAW = 60000;

const PLAIN_CAPTION = /"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)*)"/;
const PLAIN_OWNER = /"owner":\{"id":"[^"]*","username":"((?:[^"\\]|\\.)*)"/;
const PLAIN_THUMBNAIL = /"thumbnail_src":"((?:[^"\\]|\\.)*)"/;

// Where each value's string starts in the wrapped shape (the text just before its opening quote mark, which is written \").
const WRAPPED_CAPTION = '\\"edge_media_to_caption\\":{\\"edges\\":[{\\"node\\":{\\"text\\":\\"';
const WRAPPED_OWNER = /\\"owner\\":\{\\"id\\":\\"[^"\\]*\\",\\"username\\":\\"/;
// The picture: Instagram's own thumbnail when the page has one, and otherwise the post's picture (the first one, for a post with
// several). The live page in the wrapped shape has no thumbnail_src at all, only display_url.
const WRAPPED_THUMBNAILS = ['\\"thumbnail_src\\":\\"', '\\"display_url\\":\\"'];

const OUTER_ESCAPES = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/**
 * The string value that starts at `from` in `text` in the wrapped shape, as the text of a JSON string (between its quote marks, still
 * holding its own escapes such as ’), or null when it does not end where a string should.
 *
 * It undoes the page's extra layer of escaping as it goes, and ends at the first quote mark that is not itself escaped inside the
 * value. The result is what the plain shape holds between its quote marks, so JSON.parse(`"${result}"`) gives the text.
 */
export function readWrappedString(text, from) {
  const end = Math.min(text.length, from + MAX_RAW);
  let inner = '';
  let escaped = false; // the last character of the value was a backslash, so this one is part of an escape
  for (let i = from; i < end; i += 1) {
    let c = text[i];
    if (c === '\\') {
      // The page's own layer: \" \\ \/ \n and \uXXXX each stand for one character of the value.
      const next = text[i + 1];
      i += 1;
      if (next === 'u') {
        const hex = text.slice(i + 1, i + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return null;
        c = String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else if (next !== undefined && Object.prototype.hasOwnProperty.call(OUTER_ESCAPES, next)) {
        c = OUTER_ESCAPES[next];
      } else {
        return null;
      }
    } else if (c === '"') {
      return null; // a bare quote mark ends the page's string before the value did
    }
    // The value's own layer.
    if (escaped) {
      inner += c;
      escaped = false;
    } else if (c === '\\') {
      inner += c;
      escaped = true;
    } else if (c === '"') {
      return inner;
    } else {
      inner += c;
    }
  }
  return null;
}

function plainValue(html, pattern) {
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function wrappedValue(html, start) {
  if (typeof start === 'string') {
    const at = html.indexOf(start);
    return at === -1 ? null : readWrappedString(html, at + start.length);
  }
  const match = start.exec(html);
  return match ? readWrappedString(html, match.index + match[0].length) : null;
}

// The first of the markers that is on the page and reads as a string.
function firstWrappedValue(html, starts) {
  for (const start of starts) {
    const value = wrappedValue(html, start);
    if (value !== null) return value;
  }
  return null;
}

function decoded(raw) {
  if (raw === null) return null;
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return null;
  }
}

/**
 * What the embed page holds. Resolves to
 *   { ok: true, caption, username, thumbnail }  (username and thumbnail are null when the page does not have them), or
 *   { ok: false, reason }  where reason is
 *     'no-caption-pattern'  the page has no caption in either shape,
 *     'would-not-decode'    a caption was found and is not a readable string (detail holds the reason),
 *     'empty'               the caption is there and is empty.
 * Never throws.
 */
export function readEmbedPage(html) {
  if (typeof html !== 'string') return { ok: false, reason: 'no-caption-pattern' };

  let rawCaption = plainValue(html, PLAIN_CAPTION);
  const plain = rawCaption !== null;
  if (!plain) rawCaption = wrappedValue(html, WRAPPED_CAPTION);
  if (rawCaption === null) return { ok: false, reason: 'no-caption-pattern' };

  let caption;
  try {
    caption = JSON.parse(`"${rawCaption}"`);
  } catch (error) {
    return { ok: false, reason: 'would-not-decode', detail: error && error.message };
  }
  if (!caption) return { ok: false, reason: 'empty' };

  // The caption is the essential piece: a user name or picture that cannot be read is left out, and the caption is kept.
  const username = decoded(plain ? plainValue(html, PLAIN_OWNER) : wrappedValue(html, WRAPPED_OWNER));
  const thumbnail = decoded(plain ? plainValue(html, PLAIN_THUMBNAIL) : firstWrappedValue(html, WRAPPED_THUMBNAILS));
  return {
    ok: true,
    caption,
    username: typeof username === 'string' ? username : null,
    thumbnail: typeof thumbnail === 'string' ? thumbnail : null,
  };
}

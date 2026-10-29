// Which web addresses instagramEmbed (index.js) will fetch for someone. It runs on Google's network for anyone who can reach it, so
// it must only ever go to Instagram: an https address on instagram.com or www.instagram.com, judged on the parsed address (not on the
// text, where "https://instagram.com.example.com" or "https://example.com/instagram.com" would pass a "contains" check) and again on
// every redirect Instagram sends back.
//
// Pure functions with no Firebase in them, so they are tested directly (__tests__/instagramUrl.test.js).

const HOSTS = new Set(['instagram.com', 'www.instagram.com']);
const MAX_ADDRESS_LENGTH = 2048;
const MAX_REDIRECTS = 3;

/**
 * The address as a URL when it is an https address on instagram.com or www.instagram.com, with no user name or password in it and
 * no port; otherwise null. Never throws.
 */
export function instagramUrl(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_ADDRESS_LENGTH) return null;
  let parsed;
  try {
    parsed = new URL(text.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (!HOSTS.has(parsed.hostname)) return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  return parsed;
}

/** The address of a post's embed page: the post's own path (no query, no fragment) with embed/captioned/ added. `parsed` is from instagramUrl. */
export function embedUrl(parsed) {
  const path = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  return `${parsed.origin}${path}embed/captioned/`;
}

/**
 * Fetches `address`, following a redirect only when it leads to another allowed Instagram address, at most MAX_REDIRECTS times.
 * Resolves to the final response, or null when a redirect went anywhere else (or on and on). `fetchFn` is fetch, or a stand-in in tests.
 */
export async function fetchFromInstagram(address, options, fetchFn = fetch) {
  let current = address;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchFn(current, { ...options, redirect: 'manual' });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers && response.headers.get ? response.headers.get('location') : null;
    let next = null;
    if (location) {
      try {
        next = instagramUrl(new URL(location, current).href);
      } catch {
        next = null;
      }
    }
    if (!next) return null;
    current = next.href;
  }
  return null;
}

// functions/src/proxyInput.js
//
// Checks on what the app sends to the proxy functions in index.js (trail search, trail
// photos and routes, muscle diagrams). Each returns the cleaned value, or null when the
// input is not acceptable; index.js turns a null into an `invalid-argument` answer.
// The functions build the outgoing address themselves from these values, so nothing the
// app sends can change which service, path or field is asked for.

/** A finite number from `min` to `max`, or null. */
export function numberInRange(value, min, max) {
  // A number, or text that holds one. Not an empty string, a list, a flag or nothing at all,
  // which JavaScript would otherwise quietly turn into 0 or 1.
  const isNumber = typeof value === 'number';
  const isText = typeof value === 'string' && value.trim() !== '';
  if (!isNumber && !isText) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/**
 * An id from the trail service (a trail or a map): up to 100 characters, no spaces,
 * slashes, backslashes, ? # or %, no "..", and not just ".". Returned as text.
 */
export function trailServiceId(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  if (!/^[^\s/\\?#%]{1,100}$/.test(text)) return null;
  // "." and ".." are not names but steps in an address, and encodeURIComponent leaves them as they are.
  if (text.includes('..') || text === '.') return null;
  return text;
}

/** A Google Places photo resource name, "places/<id>/photos/<reference>", or null. */
export function placePhotoName(value) {
  if (typeof value !== 'string') return null;
  return /^places\/[A-Za-z0-9_-]{1,200}\/photos\/[A-Za-z0-9_-]{1,600}$/.test(value) ? value : null;
}

/**
 * The words to look a food up by (USDA FoodData Central): 2 to 80 characters once trimmed, runs of spaces
 * made single, no control characters. Returned as text, or null.
 */
export function foodSearchText(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < 2 || text.length > 80) return null;
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u001f\u007f]/.test(text) ? null : text;
}

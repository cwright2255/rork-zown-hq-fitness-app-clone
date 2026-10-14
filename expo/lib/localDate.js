// lib/localDate.js
//
// A calendar day as the person lives it: "2026-10-08" in the phone's own time
// zone. The food diary keys every day by this. The old code used
// `new Date().toISOString().slice(0, 10)`, which is the UTC date, so in New
// Jersey anything logged after about 8 PM landed on tomorrow.

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD for a Date (or anything `new Date()` takes), in local time. Defaults to now. */
export function localDateKey(when = new Date()) {
  let d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The local midnight Date for a "YYYY-MM-DD" key, or null when it is not a real calendar day. */
export function parseDateKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof key === 'string' ? key : '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

/** The key of the day `days` away from `key` (negative for earlier days), or null for a bad key. */
export function shiftDateKey(key, days) {
  const base = parseDateKey(key);
  if (!base) return null;
  return localDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(days || 0)));
}

/**
 * The local calendar day of a moment in time: a Date, an ISO string, a number of milliseconds, or a Firestore
 * Timestamp (anything with toDate()). A plain "YYYY-MM-DD" is already a calendar day and comes back as it is,
 * because reading it as a time would make it midnight UTC, which is the evening before in New Jersey. Anything
 * that is not a usable date gives null, so callers can skip it instead of crashing on a bad record.
 */
export function dayKeyOf(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDateKey(value) ? value : null;
  const d = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value);
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return localDateKey(d);
}

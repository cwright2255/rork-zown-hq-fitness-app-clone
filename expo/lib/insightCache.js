// lib/insightCache.js
//
// The Health screen asks the AI for a short comment on the person's training load. The comment only changes when the numbers it is
// about change, so it is asked for once per day for each set of numbers and kept on the phone; opening the screen again (or a
// store finishing its load a moment later) reads the kept one instead of spending another of the day's AI requests.
//
// An entry is { text, at }: the comment (or null when the AI gave nothing) and when it was filed. A comment is good for the whole day
// it was made for, since the day is part of its key. "Nothing" is only remembered for a little while, so a failed try is not repeated
// every time the screen opens but is tried again soon.

/** How long the screen waits for the stores to settle before it asks, so a store finishing its load does not start a second request. */
export const INSIGHT_SETTLE_MS = 1500;
/** How long "the AI gave nothing" is remembered. */
export const INSIGHT_MISS_MS = 30 * 60 * 1000;
/** How many entries are kept on the phone. */
export const INSIGHT_KEEP = 12;

/**
 * The key for the comment on one person's training load on one day, or null when there is nothing to key it by. The numbers are the
 * ones the AI is given, so a different reading is a different comment.
 */
export function trainingLoadKey(uid, day, load) {
  if (typeof uid !== 'string' || !uid || typeof day !== 'string' || !day) return null;
  if (!load || typeof load.zone !== 'string' || !load.zone || load.zone === 'insufficient_data') return null;
  if (!Number.isFinite(load.acuteLoad) || !Number.isFinite(load.chronicWeeklyAvg)) return null;
  return `trainingLoad|${uid}|${day}|${load.zone}|${load.acuteLoad}|${load.chronicWeeklyAvg}`;
}

/**
 * What is kept for a key: { found: true, text } for a comment (or for a recent "nothing", whose text is null), { found: false } when
 * the key has no entry or its "nothing" is old enough to try again.
 */
export function readInsight(entries, key, now = Date.now()) {
  const entry = entries && key ? entries[key] : null;
  if (!entry) return { found: false };
  if (typeof entry.text === 'string' && entry.text) return { found: true, text: entry.text };
  if (Number.isFinite(entry.at) && now - entry.at < INSIGHT_MISS_MS) return { found: true, text: null };
  return { found: false };
}

/** The entries with one more filed under its key, keeping only the newest INSIGHT_KEEP. A text that is not a sentence is filed as "nothing". */
export function rememberInsight(entries, key, text, now = Date.now()) {
  const base = entries && typeof entries === 'object' ? entries : {};
  if (!key) return base;
  const next = { ...base, [key]: { text: typeof text === 'string' && text.trim() ? text : null, at: now } };
  const newest = Object.keys(next)
    .sort((a, b) => (next[b]?.at || 0) - (next[a]?.at || 0))
    .slice(0, INSIGHT_KEEP);
  const out = {};
  for (const k of newest) out[k] = next[k];
  return out;
}

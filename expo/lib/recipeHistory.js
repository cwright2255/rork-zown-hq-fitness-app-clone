// lib/recipeHistory.js
//
// Which recipes the Recipes tab has put at the top of its picks, and on which days, so the same few do not come back every day
// (lib/recipePicks.js pushes a recipe down if it was a top pick in the last three days). Kept on the phone, one list per person.
// { [recipeId]: ["YYYY-MM-DD", ...] }, every day it was shown, for the last 7 days only. Storage failing is never an error: with
// no memory of what was shown, the picks are just not varied from day to day.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shiftDateKey } from './localDate';

export const HISTORY_KEY_PREFIX = '@recipes_recent_picks_v1:';
export const KEEP_DAYS = 7;
export const MAX_IDS = 80;

const storageKey = (uid) => `${HISTORY_KEY_PREFIX}${uid || 'anon'}`;

/** The history with every day older than KEEP_DAYS before `todayKey` forgotten, and any recipe left with no day removed. */
export function pruneHistory(history, todayKey) {
  const oldest = shiftDateKey(todayKey, -KEEP_DAYS);
  const out = {};
  Object.entries(history && typeof history === 'object' ? history : {}).forEach(([id, days]) => {
    const kept = (Array.isArray(days) ? days : [days]).filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && (!oldest || d >= oldest));
    if (kept.length) out[id] = [...new Set(kept)].sort();
  });
  const ids = Object.keys(out);
  if (ids.length <= MAX_IDS) return out;
  // Too many: keep the ones shown most recently.
  return Object.fromEntries(ids.sort((a, b) => out[b][out[b].length - 1].localeCompare(out[a][out[a].length - 1])).slice(0, MAX_IDS).map((id) => [id, out[id]]));
}

/** `ids` added to the history as shown on `dayKey` (a day already there is not added twice). */
export function withShown(history, ids, dayKey) {
  const next = { ...(history || {}) };
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    if (!id) return;
    const days = Array.isArray(next[id]) ? next[id] : [];
    next[id] = days.includes(dayKey) ? days : [...days, dayKey];
  });
  return pruneHistory(next, dayKey);
}

export async function loadRecentPicks(uid) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

/** Record that `ids` were shown as the top picks today. Returns the new history. */
export async function recordPicks(uid, ids, dayKey) {
  const next = withShown(await loadRecentPicks(uid), ids, dayKey);
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify(next));
  } catch (e) {
    // Not remembered: nothing breaks.
  }
  return next;
}

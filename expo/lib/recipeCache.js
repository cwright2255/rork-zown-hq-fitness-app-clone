// lib/recipeCache.js
//
// The last recipes the Recipes tab fetched, kept on the phone so the tab opens with recipes on screen straight away instead of
// a blank page while the function wakes up (it starts from nothing when idle). What is on the phone is shown at once and
// replaced in the background when it is old: a day old, or more than half an hour old.
//
// An entry is { items, at, day }: the recipes, when they were fetched (ms) and the local day. The memory copy makes a second visit
// in the same session instant; the phone's storage makes the first visit after opening the app instant. Storage failing
// (a full phone, a private mode) never breaks anything: the tab just starts empty, as it did before.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CACHE_KEY_PREFIX = '@recipes_browse_cache_v1:';
/** Recipes fetched within this long ago, on the same day, are not fetched again. */
export const FRESH_MS = 30 * 60 * 1000;
/** Older than this, a saved answer is not shown at all. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ENTRIES = 16;

const memory = new Map(); // uid -> { entries }

const storageKey = (uid) => `${CACHE_KEY_PREFIX}${uid || 'anon'}`;

/** True when an entry is from today and fresh enough not to be fetched again. */
export function isFresh(entry, dayKey, now = Date.now()) {
  return !!entry && entry.day === dayKey && Number.isFinite(entry.at) && now - entry.at >= 0 && now - entry.at < FRESH_MS;
}

/** True when an entry can be shown while a newer one is fetched. */
export function isShowable(entry, now = Date.now()) {
  return !!entry && Array.isArray(entry.items) && Number.isFinite(entry.at) && now - entry.at < MAX_AGE_MS;
}

/** Every showable entry for a person, as { [key]: entry }. Memory first, then the phone's storage; {} when there is nothing. */
export async function loadBrowseCache(uid, now = Date.now()) {
  if (memory.has(uid || 'anon')) return { ...memory.get(uid || 'anon').entries };
  let entries = {};
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && parsed.v === 1 && parsed.entries && typeof parsed.entries === 'object') {
      Object.entries(parsed.entries).forEach(([key, entry]) => { if (isShowable(entry, now)) entries[key] = entry; });
    }
  } catch (e) {
    entries = {};
  }
  memory.set(uid || 'anon', { entries });
  return { ...entries };
}

/** Remember some fresh answers ({ [key]: { items, at, day } }), keeping the newest MAX_ENTRIES, and write them to the phone. */
export async function rememberBrowse(uid, updates, now = Date.now()) {
  const current = memory.has(uid || 'anon') ? memory.get(uid || 'anon').entries : (await loadBrowseCache(uid, now));
  const merged = { ...current, ...updates };
  const kept = Object.entries(merged)
    .filter(([, entry]) => isShowable(entry, now))
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_ENTRIES);
  const entries = Object.fromEntries(kept);
  memory.set(uid || 'anon', { entries });
  try {
    await AsyncStorage.setItem(storageKey(uid), JSON.stringify({ v: 1, entries }));
  } catch (e) {
    // Not saved to the phone: it still works for this session from memory.
  }
  return entries;
}

/** For tests only: forget what is held in memory. */
export function resetBrowseCacheForTests() {
  memory.clear();
}

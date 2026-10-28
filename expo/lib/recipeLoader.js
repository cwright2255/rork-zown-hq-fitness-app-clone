// lib/recipeLoader.js
//
// How the Recipes tab gets its recipes from the service, apart from the screen so each rule is tested on its own:
//   - everything the tab needs when it opens is asked for in ONE call (the function starts from nothing when idle, so one call
//     pays at most one wake-up instead of one per section);
//   - an answer that comes back empty or short is asked again once with the day's window put back to the start, because a narrow
//     diet can have fewer results than the window reaches; a pool that is still short is asked for once more with the narrow
//     meal limits taken off;
//   - a failed call is NOT an empty answer: it is never saved, and it never replaces recipes that were already on screen.
import { MIN_POOL, cacheKeyFor } from './recipeBrowse';

const isStart = (params) => !params || params.offset == null || params.offset === '0';
const countOf = (byKey, key) => (Array.isArray(byKey && byKey[key]) ? byKey[key].length : 0);

/** The sections with the name each one is kept under in the cache: [{ key, params, number, cacheKey }]. */
export function withCacheKeys(sections) {
  return (Array.isArray(sections) ? sections : []).map((s) => ({ ...s, cacheKey: cacheKeyFor(s.key, s.params) }));
}

/**
 * Ask for the sections in one call, then top up what is short. `sections` is [{ key, params, number }]; `relaxedPool` is the
 * pool's question with the narrow limits taken off (or null). Returns { [key]: items }, with a key missing when nothing came back
 * for it. When the call itself fails (the service gives back nothing at all) it stops there: asking again would only wait twice.
 */
export async function fetchHome({ service, sections, relaxedPool = null }) {
  const list = Array.isArray(sections) ? sections : [];
  if (!list.length) return {};
  const first = await service.getSpoonacularBrowseBatch(list.map(({ key, params, number }) => ({ key, params, number })));
  const byKey = { ...(first || {}) };
  if (!Object.keys(byKey).length) return {};

  const isShort = (s) => (s.key === 'pool' ? countOf(byKey, s.key) < MIN_POOL : countOf(byKey, s.key) === 0);
  const retry = list.filter((s) => isShort(s) && !isStart(s.params));
  if (retry.length) {
    const again = await service.getSpoonacularBrowseBatch(retry.map((s) => ({ key: s.key, params: { ...s.params, offset: '0' }, number: s.number })));
    retry.forEach((s) => { if (countOf(again, s.key) > countOf(byKey, s.key)) byKey[s.key] = again[s.key]; });
  }

  const pool = list.find((s) => s.key === 'pool');
  if (pool && relaxedPool && countOf(byKey, 'pool') < MIN_POOL) {
    const wide = await service.getSpoonacularBrowseBatch([{ key: 'pool', params: relaxedPool, number: relaxedPool.number }]);
    if (countOf(wide, 'pool') > countOf(byKey, 'pool')) byKey.pool = wide.pool;
  }
  return byKey;
}

/** One question (a chip, a search, an ingredient search): the service's answer, asked again from the start of the list if empty. */
export async function fetchOne({ service, params, number = 20 }) {
  let items = await service.getSpoonacularBrowse(params, number);
  if (!(items && items.length) && params && params.offset && params.offset !== '0') {
    items = await service.getSpoonacularBrowse({ ...params, offset: '0' }, number);
  }
  return Array.isArray(items) ? items : [];
}

/**
 * What to remember from an answer: { [cacheKey]: { items, at, day } }.
 * The batch call gives back a key for every section it answered, and nothing at all when it failed. So a key that is there with
 * no recipes is a real "nothing matches" and is remembered for a row (otherwise a row that is always empty for a narrow diet would
 * be asked for again on every visit); a key that is missing is a failure and is never remembered. An empty pool is not remembered
 * either way: it is far more likely to be a hiccup than the truth, and the page is no good without one.
 */
export function cacheEntries(sections, byKey, { now, dayKey }) {
  const out = {};
  (Array.isArray(sections) ? sections : []).forEach((s) => {
    const items = byKey && byKey[s.key];
    if (!Array.isArray(items)) return;
    if (items.length || s.key !== 'pool') out[s.cacheKey] = { items, at: now, day: dayKey };
  });
  return out;
}

/** The recipes to show for a section: the new answer, or what was on screen / in the cache if the new answer is empty. */
export function itemsToShow(fresh, kept) {
  if (Array.isArray(fresh) && fresh.length) return fresh;
  return Array.isArray(kept) ? kept : [];
}

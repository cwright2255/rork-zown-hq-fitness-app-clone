// The last recipes kept on the phone so the tab opens with something on screen (lib/recipeCache.js), and the memory of which
// recipes were the top picks on which days (lib/recipeHistory.js).
const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k) => (k in mockStore ? mockStore[k] : null)),
    setItem: jest.fn(async (k, v) => { mockStore[k] = v; }),
  },
}));
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

const {
  loadBrowseCache, rememberBrowse, isFresh, isShowable, resetBrowseCacheForTests, FRESH_MS, MAX_AGE_MS, MAX_ENTRIES, CACHE_KEY_PREFIX,
} = require('../lib/recipeCache');
const { loadRecentPicks, recordPicks, withShown, pruneHistory, KEEP_DAYS, MAX_IDS, HISTORY_KEY_PREFIX } = require('../lib/recipeHistory');

const NOW = Date.UTC(2026, 9, 28, 15, 0);
const entry = (over = {}) => ({ items: [{ id: '1' }], at: NOW, day: '2026-10-28', ...over });

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  resetBrowseCacheForTests();
  AsyncStorage.getItem.mockClear();
  AsyncStorage.setItem.mockClear();
});

describe('how old a saved answer can be', () => {
  it('is fresh for half an hour on the same day', () => {
    expect(FRESH_MS).toBe(30 * 60 * 1000);
    expect(isFresh(entry(), '2026-10-28', NOW + 29 * 60 * 1000)).toBe(true);
    expect(isFresh(entry(), '2026-10-28', NOW + 31 * 60 * 1000)).toBe(false);
  });

  it('is never fresh on another day, even a minute old', () => {
    expect(isFresh(entry({ day: '2026-10-27' }), '2026-10-28', NOW)).toBe(false);
  });

  it('is not fresh when it is missing, broken, or from the future', () => {
    expect(isFresh(null, '2026-10-28', NOW)).toBe(false);
    expect(isFresh({ items: [] }, '2026-10-28', NOW)).toBe(false);
    expect(isFresh(entry({ at: NOW + 60000 }), '2026-10-28', NOW)).toBe(false);
  });

  it('can be shown for a week while a newer one is fetched, and not after', () => {
    expect(isShowable(entry(), NOW + MAX_AGE_MS - 1)).toBe(true);
    expect(isShowable(entry(), NOW + MAX_AGE_MS)).toBe(false);
    expect(isShowable({ at: NOW }, NOW)).toBe(false);
    expect(isShowable(null, NOW)).toBe(false);
  });
});

describe('the browse cache', () => {
  it('starts empty', async () => {
    expect(await loadBrowseCache('u1', NOW)).toEqual({});
  });

  it('keeps what it is given, in memory and on the phone, for that person', async () => {
    await rememberBrowse('u1', { 'pool:a': entry() }, NOW);
    expect(await loadBrowseCache('u1', NOW)).toEqual({ 'pool:a': entry() });
    expect(JSON.parse(mockStore[`${CACHE_KEY_PREFIX}u1`])).toEqual({ v: 1, entries: { 'pool:a': entry() } });
    resetBrowseCacheForTests(); // a new session: read back from the phone
    expect(await loadBrowseCache('u1', NOW)).toEqual({ 'pool:a': entry() });
  });

  it('does not show one person\'s recipes to another', async () => {
    await rememberBrowse('u1', { 'pool:a': entry() }, NOW);
    resetBrowseCacheForTests();
    expect(await loadBrowseCache('u2', NOW)).toEqual({});
  });

  it('merges new answers with the old ones, newer winning', async () => {
    await rememberBrowse('u1', { a: entry({ items: [{ id: 'old' }] }), b: entry() }, NOW);
    await rememberBrowse('u1', { a: entry({ items: [{ id: 'new' }], at: NOW + 1000 }) }, NOW + 1000);
    const all = await loadBrowseCache('u1', NOW + 1000);
    expect(all.a.items).toEqual([{ id: 'new' }]);
    expect(Object.keys(all).sort()).toEqual(['a', 'b']);
  });

  it('drops answers older than a week when it reads them, and keeps only the newest sixteen', async () => {
    mockStore[`${CACHE_KEY_PREFIX}u1`] = JSON.stringify({ v: 1, entries: { stale: entry({ at: NOW - MAX_AGE_MS - 1 }), ok: entry() } });
    expect(Object.keys(await loadBrowseCache('u1', NOW))).toEqual(['ok']);
    const many = Object.fromEntries(Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => [`k${i}`, entry({ at: NOW + i })]));
    const kept = await rememberBrowse('u2', many, NOW + 100);
    expect(MAX_ENTRIES).toBe(16);
    expect(Object.keys(kept)).toHaveLength(16);
    expect(kept[`k${MAX_ENTRIES + 4}`]).toBeTruthy();
    expect(kept.k0).toBeUndefined();
  });

  it('shrugs off a damaged copy on the phone and a phone that will not save', async () => {
    mockStore[`${CACHE_KEY_PREFIX}u1`] = '{not json';
    expect(await loadBrowseCache('u1', NOW)).toEqual({});
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('disk full'));
    await expect(rememberBrowse('u3', { a: entry() }, NOW)).resolves.toEqual({ a: entry() });
    expect(await loadBrowseCache('u3', NOW)).toEqual({ a: entry() }); // still there for this session
    mockStore[`${CACHE_KEY_PREFIX}u4`] = JSON.stringify({ v: 9, entries: { a: entry() } });
    expect(await loadBrowseCache('u4', NOW)).toEqual({});
  });
});

describe('the memory of which recipes were top picks', () => {
  it('adds the day a recipe was shown, once, and keeps the earlier days', () => {
    const h1 = withShown({}, ['a', 'b'], '2026-10-27');
    const h2 = withShown(h1, ['a'], '2026-10-28');
    const h3 = withShown(h2, ['a'], '2026-10-28');
    expect(h3).toEqual({ a: ['2026-10-27', '2026-10-28'], b: ['2026-10-27'] });
  });

  it('forgets days older than a week, and recipes with no day left', () => {
    expect(KEEP_DAYS).toBe(7);
    const h = pruneHistory({ old: ['2026-10-10'], mixed: ['2026-10-10', '2026-10-27'], edge: ['2026-10-21'] }, '2026-10-28');
    expect(h).toEqual({ mixed: ['2026-10-27'], edge: ['2026-10-21'] });
  });

  it('ignores junk', () => {
    expect(withShown(null, [null, '', 'a'], '2026-10-28')).toEqual({ a: ['2026-10-28'] });
    expect(pruneHistory(null, '2026-10-28')).toEqual({});
    expect(pruneHistory({ a: ['soon', 5] }, '2026-10-28')).toEqual({});
    expect(withShown({ a: 'x' }, 'not a list', '2026-10-28')).toEqual({});
  });

  it('holds at most 80 recipes, the most recently shown', () => {
    const ids = Array.from({ length: MAX_IDS + 10 }, (_, i) => `r${i}`);
    const history = Object.fromEntries(ids.map((id, i) => [id, [i < 10 ? '2026-10-22' : '2026-10-27']]));
    const pruned = pruneHistory(history, '2026-10-28');
    expect(Object.keys(pruned)).toHaveLength(MAX_IDS);
    expect(pruned.r0).toBeUndefined();
    expect(pruned[`r${MAX_IDS + 9}`]).toBeTruthy();
  });

  it('is kept on the phone for that person', async () => {
    expect(await loadRecentPicks('u1')).toEqual({});
    const after = await recordPicks('u1', ['a', 'b'], '2026-10-27');
    expect(after).toEqual({ a: ['2026-10-27'], b: ['2026-10-27'] });
    await recordPicks('u1', ['a'], '2026-10-28');
    expect(await loadRecentPicks('u1')).toEqual({ a: ['2026-10-27', '2026-10-28'], b: ['2026-10-27'] });
    expect(JSON.parse(mockStore[`${HISTORY_KEY_PREFIX}u1`])).toEqual({ a: ['2026-10-27', '2026-10-28'], b: ['2026-10-27'] });
    expect(await loadRecentPicks('u2')).toEqual({});
  });

  it('is never an error when the phone will not read or write', async () => {
    mockStore[`${HISTORY_KEY_PREFIX}u1`] = '{bad';
    expect(await loadRecentPicks('u1')).toEqual({});
    AsyncStorage.setItem.mockRejectedValueOnce(new Error('full'));
    await expect(recordPicks('u9', ['a'], '2026-10-28')).resolves.toEqual({ a: ['2026-10-28'] });
  });
});

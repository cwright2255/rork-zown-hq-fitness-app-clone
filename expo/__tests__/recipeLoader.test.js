// How the Recipes tab gets its recipes (lib/recipeLoader.js): one call, topped up when short, and a failed call is never mistaken
// for "nothing matches".
const { withCacheKeys, fetchHome, fetchOne, cacheEntries, itemsToShow } = require('../lib/recipeLoader');
const { MIN_POOL } = require('../lib/recipeBrowse');

const items = (n, prefix = 'r') => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, name: `Recipe ${prefix}${i}` }));
const sections = (offset = '36') => [
  { key: 'pool', params: { offset, type: 'main course', number: 36 }, number: 36 },
  { key: 'postWorkout', params: { offset: '6', minProtein: '20', number: 6 }, number: 6 },
  { key: 'quickEasy', params: { offset: '6', maxReadyTime: '20', number: 6 }, number: 6 },
];
const batchService = (replies) => {
  const calls = [];
  const queue = [...replies];
  return { calls, getSpoonacularBrowseBatch: jest.fn(async (asked) => { calls.push(asked); const r = queue.shift(); return typeof r === 'function' ? r(asked) : (r || {}); }) };
};

describe('withCacheKeys', () => {
  it('names each section by its question, leaving the day\'s window out', () => {
    const a = withCacheKeys(sections('36'));
    const b = withCacheKeys(sections('72'));
    expect(a[0].cacheKey).toBe(b[0].cacheKey);
    expect(a[0].cacheKey).not.toBe(a[1].cacheKey);
    expect(a[0]).toMatchObject({ key: 'pool', number: 36 });
    expect(withCacheKeys(null)).toEqual([]);
  });
});

describe('fetchHome', () => {
  it('asks for every section in one call and gives each one back', async () => {
    const service = batchService([{ pool: items(MIN_POOL + 5), postWorkout: items(6, 'p'), quickEasy: items(6, 'q') }]);
    const out = await fetchHome({ service, sections: sections() });
    expect(service.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
    expect(service.calls[0].map((s) => s.key)).toEqual(['pool', 'postWorkout', 'quickEasy']);
    expect(service.calls[0][0]).toEqual({ key: 'pool', params: sections()[0].params, number: 36 });
    expect(Object.keys(out)).toEqual(['pool', 'postWorkout', 'quickEasy']);
  });

  it('asks again from the start of the list for an empty row and a short pool, in one more call', async () => {
    const service = batchService([
      { pool: items(3), postWorkout: [], quickEasy: items(6, 'q') },
      { pool: items(20, 'again'), postWorkout: items(6, 'again') },
    ]);
    const out = await fetchHome({ service, sections: sections() });
    expect(service.getSpoonacularBrowse).toBeUndefined();
    expect(service.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(2);
    expect(service.calls[1].map((s) => [s.key, s.params.offset])).toEqual([['pool', '0'], ['postWorkout', '0']]);
    expect(out.pool).toHaveLength(20);
    expect(out.postWorkout).toHaveLength(6);
    expect(out.quickEasy[0].id).toBe('q0');
  });

  it('does not ask again from the start when it already asked from the start', async () => {
    const service = batchService([{ pool: items(3) }, { pool: items(MIN_POOL + 4, 'wide') }]);
    const out = await fetchHome({ service, sections: [sections('0')[0]], relaxedPool: { instructionsRequired: 'true', number: 36 } });
    // The only extra call is the relaxed pool: no offset retry
    expect(service.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(2);
    expect(service.calls[1]).toEqual([{ key: 'pool', params: { instructionsRequired: 'true', number: 36 }, number: 36 }]);
    expect(out.pool).toHaveLength(MIN_POOL + 4);
  });

  it('takes the narrow meal limits off a pool that is still short, and keeps the better of the two', async () => {
    const service = batchService([
      { pool: items(2), postWorkout: items(6, 'p'), quickEasy: items(6, 'q') },
      { pool: items(4, 'again') },
      { pool: items(30, 'wide') },
    ]);
    const out = await fetchHome({ service, sections: sections(), relaxedPool: { number: 36, sort: 'popularity' } });
    expect(service.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(3);
    expect(out.pool).toHaveLength(30);
    const worse = batchService([{ pool: items(5, 'a') }, { pool: items(2, 'b') }, { pool: items(1, 'c') }]);
    const kept = await fetchHome({ service: worse, sections: [sections()[0]], relaxedPool: { number: 36 } });
    expect(kept.pool).toHaveLength(5);
  });

  it('does not take the limits off when there is no relaxed question', async () => {
    const service = batchService([{ pool: items(2) }, { pool: items(2) }]);
    await fetchHome({ service, sections: [sections()[0]] });
    expect(service.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(2); // the offset retry only
  });

  it('stops after one call when the call itself failed (nothing came back at all)', async () => {
    const service = batchService([{}]);
    const out = await fetchHome({ service, sections: sections(), relaxedPool: { number: 36 } });
    expect(out).toEqual({});
    expect(service.getSpoonacularBrowseBatch).toHaveBeenCalledTimes(1);
  });

  it('does nothing for no sections, and copes with a service that gives back nothing', async () => {
    const service = batchService([]);
    expect(await fetchHome({ service, sections: [] })).toEqual({});
    expect(service.getSpoonacularBrowseBatch).not.toHaveBeenCalled();
    const empty = { getSpoonacularBrowseBatch: jest.fn(async () => null) };
    expect(await fetchHome({ service: empty, sections: sections() })).toEqual({});
  });

  it('keeps a short pool of a person with a narrow diet, rather than nothing', async () => {
    const service = batchService([{ pool: items(4) }, { pool: items(4, 'x') }, { pool: items(4, 'y') }]);
    const out = await fetchHome({ service, sections: [sections()[0]], relaxedPool: { number: 36 } });
    expect(out.pool).toHaveLength(4);
  });
});

describe('fetchOne', () => {
  it('gives the answer', async () => {
    const service = { getSpoonacularBrowse: jest.fn(async () => items(5)) };
    expect(await fetchOne({ service, params: { query: 'soup' }, number: 20 })).toHaveLength(5);
    expect(service.getSpoonacularBrowse).toHaveBeenCalledWith({ query: 'soup' }, 20);
  });

  it('asks again from the start of the list when a later page was empty', async () => {
    const service = { getSpoonacularBrowse: jest.fn(async (p) => (p.offset === '0' ? items(3) : [])) };
    expect(await fetchOne({ service, params: { offset: '90' } })).toHaveLength(3);
    expect(service.getSpoonacularBrowse).toHaveBeenCalledTimes(2);
    expect(service.getSpoonacularBrowse.mock.calls[1][0]).toEqual({ offset: '0' });
  });

  it('does not ask twice with no offset, and always gives a list', async () => {
    const service = { getSpoonacularBrowse: jest.fn(async () => []) };
    expect(await fetchOne({ service, params: { query: 'x' } })).toEqual([]);
    expect(service.getSpoonacularBrowse).toHaveBeenCalledTimes(1);
    expect(await fetchOne({ service: { getSpoonacularBrowse: async () => null }, params: {} })).toEqual([]);
  });
});

describe('cacheEntries', () => {
  it('keeps each answer that has recipes under its section\'s name, with when and which day', () => {
    const secs = withCacheKeys(sections());
    const out = cacheEntries(secs, { pool: items(2), postWorkout: items(1, 'p') }, { now: 1000, dayKey: '2026-10-28' });
    expect(out[secs[0].cacheKey]).toEqual({ items: items(2), at: 1000, day: '2026-10-28' });
    expect(out[secs[1].cacheKey].items).toHaveLength(1);
  });

  it('keeps a row the service answered with nothing, so it is not asked for again on every visit', () => {
    const secs = withCacheKeys(sections());
    const out = cacheEntries(secs, { pool: items(2), postWorkout: [], quickEasy: [] }, { now: 5, dayKey: 'd' });
    expect(out[secs[1].cacheKey]).toEqual({ items: [], at: 5, day: 'd' });
    expect(out[secs[2].cacheKey]).toEqual({ items: [], at: 5, day: 'd' });
  });

  it('never keeps what the service did not answer (a failed call), nor an empty pool', () => {
    const secs = withCacheKeys(sections());
    expect(cacheEntries(secs, {}, { now: 1, dayKey: 'd' })).toEqual({});
    expect(cacheEntries(secs, { pool: [], postWorkout: undefined, quickEasy: null }, { now: 1, dayKey: 'd' })).toEqual({});
    expect(cacheEntries(secs, null, { now: 1, dayKey: 'd' })).toEqual({});
    expect(cacheEntries(null, {}, { now: 1, dayKey: 'd' })).toEqual({});
  });
});

describe('itemsToShow', () => {
  it('shows the new answer, or what was already there when the new one is empty', () => {
    expect(itemsToShow(items(2), items(5, 'old'))).toHaveLength(2);
    expect(itemsToShow([], items(5, 'old'))).toHaveLength(5);
    expect(itemsToShow(undefined, items(1, 'old'))).toHaveLength(1);
    expect(itemsToShow(undefined, undefined)).toEqual([]);
  });
});

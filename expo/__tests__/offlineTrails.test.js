import {
  MAX_OFFLINE_CHARS, MAX_OFFLINE_TRAILS, MAX_PATHS_PER_TRAIL, MAX_PROFILE_POINTS, MAX_ROUTE_POINTS,
  cachedRoute, downloadTrailForOffline, limitOfflineTrails, mergeOfflineTrail, pathLengthKm,
  slimRoute, slimTrail, thin,
} from '../lib/offlineTrails';

const pt = (i, extra = {}) => ({ latitude: 38 + i * 0.0001, longitude: -78 - i * 0.0001, ...extra });
const line = (n) => Array.from({ length: n }, (_, i) => pt(i));
const route = (n = 5, extra = {}) => ({ coordinates: line(n), distanceKm: 2.5, elevationGainM: 80, elevationProfile: null, ...extra });
const trail = (extra = {}) => ({
  id: 'trailapi-77', source: 'trailapi', name: 'Old Rag Loop', address: 'Syria, VA',
  latitude: 38.55, longitude: -78.3, lengthMiles: 9.2, rating: 4.5, ratingCount: 0,
  photoUrl: 'https://img/x.jpg', photoName: null, googleMapsUri: null, directions: 'Take 231 north.',
  distanceKm: 12.5, isOpen: true, types: ['hiking_area'],
  ...extra,
});

describe('thin', () => {
  it('returns a copy when the list is short enough', () => {
    const list = [1, 2, 3];
    const out = thin(list, 3);
    expect(out).toEqual([1, 2, 3]);
    expect(out).not.toBe(list);
  });

  it('keeps the first and the last, and spreads the rest evenly', () => {
    const list = Array.from({ length: 101 }, (_, i) => i);
    expect(thin(list, 5)).toEqual([0, 25, 50, 75, 100]);
  });

  it('gives exactly the number asked for', () => {
    expect(thin(Array.from({ length: 1000 }, (_, i) => i), 7)).toHaveLength(7);
    expect(thin(Array.from({ length: 10 }, (_, i) => i), 9)).toHaveLength(9);
  });

  it('never repeats a point', () => {
    const out = thin(Array.from({ length: 12 }, (_, i) => i), 11);
    expect(new Set(out).size).toBe(11);
  });

  it('copes with one or no places, and with something that is not a list', () => {
    expect(thin([1, 2, 3], 1)).toEqual([1]);
    expect(thin([1, 2, 3], 0)).toEqual([]);
    expect(thin(null, 5)).toEqual([]);
    expect(thin('abc', 5)).toEqual([]);
  });
});

describe('pathLengthKm', () => {
  it('measures a line in km, to the nearest 10 m', () => {
    expect(pathLengthKm([{ latitude: 38, longitude: -78 }, { latitude: 38.01, longitude: -78 }])).toBe(1.11);
  });

  it('is nothing for a single point', () => {
    expect(pathLengthKm([pt(0)])).toBe(0);
  });
});

describe('slimRoute', () => {
  it('has no route to keep without a usable line', () => {
    expect(slimRoute(null)).toBeNull();
    expect(slimRoute({})).toBeNull();
    expect(slimRoute({ coordinates: 'x' })).toBeNull();
    expect(slimRoute({ coordinates: [pt(0)] })).toBeNull();
    expect(slimRoute({ coordinates: [pt(0), { latitude: NaN, longitude: 1 }, null] })).toBeNull();
  });

  it('keeps the line, the distance and the climb', () => {
    const out = slimRoute(route(5));
    expect(out.coordinates).toHaveLength(5);
    expect(out.distanceKm).toBe(2.5);
    expect(out.elevationGainM).toBe(80);
    expect(out.elevationProfile).toBeNull();
  });

  it('leaves out points that are not places, and anything extra on a point', () => {
    const out = slimRoute({ coordinates: [pt(0, { elevation: 99 }), { latitude: 'x', longitude: 1 }, pt(1), null], distanceKm: 1 });
    expect(out.coordinates).toEqual([
      { latitude: 38, longitude: -78 },
      { latitude: 38.0001, longitude: -78.0001 },
    ]);
  });

  it('rounds places to about 10 cm', () => {
    const out = slimRoute({ coordinates: [{ latitude: 38.123456789, longitude: -78.987654321 }, pt(1)], distanceKm: 1 });
    expect(out.coordinates[0]).toEqual({ latitude: 38.123457, longitude: -78.987654 });
  });

  it('thins a long line, keeping where it starts and ends', () => {
    const long = line(5000);
    const out = slimRoute({ coordinates: long, distanceKm: 12 });
    expect(out.coordinates).toHaveLength(MAX_ROUTE_POINTS);
    expect(out.coordinates[0]).toEqual({ latitude: 38, longitude: -78 });
    expect(out.coordinates[MAX_ROUTE_POINTS - 1]).toEqual({ latitude: 38.4999, longitude: -78.4999 });
  });

  it('works the distance out when it is missing, and the climb stays unknown', () => {
    const out = slimRoute({ coordinates: [{ latitude: 38, longitude: -78 }, { latitude: 38.01, longitude: -78 }] });
    expect(out.distanceKm).toBe(1.11);
    expect(out.elevationGainM).toBeNull();
  });

  it('keeps a distance of zero', () => {
    expect(slimRoute({ coordinates: line(3), distanceKm: 0 }).distanceKm).toBe(0);
  });

  it('thins the height chart, and keeps it as it is when it is short', () => {
    const profile = Array.from({ length: 800 }, (_, i) => ({ distanceKm: i / 100, elevationM: 100 + i, extra: 1 }));
    const out = slimRoute({ ...route(5), elevationProfile: profile });
    expect(out.elevationProfile).toHaveLength(MAX_PROFILE_POINTS);
    expect(out.elevationProfile[0]).toEqual({ distanceKm: 0, elevationM: 100 });
    const short = slimRoute({ ...route(5), elevationProfile: profile.slice(0, 10) });
    expect(short.elevationProfile).toHaveLength(10);
  });

  it('has no height chart when it is empty or unusable', () => {
    expect(slimRoute({ ...route(5), elevationProfile: [] }).elevationProfile).toBeNull();
    expect(slimRoute({ ...route(5), elevationProfile: [{ distanceKm: 'a', elevationM: 1 }] }).elevationProfile).toBeNull();
  });
});

describe('slimTrail', () => {
  it('keeps what the trail screens use', () => {
    expect(slimTrail(trail())).toEqual({
      id: 'trailapi-77', source: 'trailapi', name: 'Old Rag Loop', address: 'Syria, VA',
      latitude: 38.55, longitude: -78.3, lengthMiles: 9.2, rating: 4.5, ratingCount: 0,
      photoUrl: 'https://img/x.jpg', photoName: null, googleMapsUri: null, directions: 'Take 231 north.',
    });
  });

  it('leaves out how far it was from whoever found it, and whether it was open', () => {
    const out = slimTrail(trail());
    expect(out).not.toHaveProperty('distanceKm');
    expect(out).not.toHaveProperty('isOpen');
    expect(out).not.toHaveProperty('types');
  });

  it('leaves out fields the trail does not have', () => {
    expect(slimTrail({ id: 'osm-1', name: 'Loop' })).toEqual({ id: 'osm-1', name: 'Loop' });
  });

  it('is nothing without an id', () => {
    expect(slimTrail(null)).toBeNull();
    expect(slimTrail({ name: 'x' })).toBeNull();
    expect(slimTrail({ id: '' })).toBeNull();
    expect(slimTrail({ id: 12 })).toBeNull();
  });
});

describe('mergeOfflineTrail', () => {
  const NOW = 1000;
  const maps = [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }];

  it('keeps nothing for something that is not a trail', () => {
    expect(mergeOfflineTrail(null, {}, NOW)).toBeNull();
    expect(mergeOfflineTrail(null, { trail: { name: 'x' } }, NOW)).toBeNull();
    expect(mergeOfflineTrail(null)).toBeNull();
  });

  it('makes a record of the trail, its paths and their lines', () => {
    const out = mergeOfflineTrail(null, { trail: trail(), maps, routes: { 11: route(4) }, pinned: true }, NOW);
    expect(out).toMatchObject({ version: 1, id: 'trailapi-77', savedAt: NOW, pinned: true, maps });
    expect(out.trail.name).toBe('Old Rag Loop');
    expect(Object.keys(out.routes)).toEqual(['11']);
    expect(out.routes['11'].coordinates).toHaveLength(4);
  });

  it('is not saved by the person unless it is said so', () => {
    expect(mergeOfflineTrail(null, { trail: trail() }, NOW).pinned).toBe(false);
  });

  it('has no paths and no lines when none were found', () => {
    const out = mergeOfflineTrail(null, { trail: trail() }, NOW);
    expect(out.maps).toEqual([]);
    expect(out.routes).toEqual({});
  });

  it('adds a line to what is already kept, without losing the others', () => {
    const first = mergeOfflineTrail(null, { trail: trail(), maps, routes: { 11: route(4) } }, NOW);
    const second = mergeOfflineTrail(first, { trail: trail(), routes: { 12: route(6) } }, NOW + 1);
    expect(Object.keys(second.routes).sort()).toEqual(['11', '12']);
    expect(second.routes['11'].coordinates).toHaveLength(4);
    expect(second.routes['12'].coordinates).toHaveLength(6);
    expect(second.maps).toEqual(maps);
    expect(second.savedAt).toBe(NOW + 1);
  });

  it('replaces the line of a path that comes again', () => {
    const first = mergeOfflineTrail(null, { trail: trail(), routes: { 11: route(4) } }, NOW);
    const second = mergeOfflineTrail(first, { trail: trail(), routes: { 11: route(9) } }, NOW + 1);
    expect(second.routes['11'].coordinates).toHaveLength(9);
  });

  it('keeps a trail the person saved as saved, even when it is only started later', () => {
    const saved = mergeOfflineTrail(null, { trail: trail(), pinned: true }, NOW);
    const started = mergeOfflineTrail(saved, { trail: trail(), maps, pinned: false }, NOW + 1);
    expect(started.pinned).toBe(true);
  });

  it('can become saved later', () => {
    const started = mergeOfflineTrail(null, { trail: trail(), pinned: false }, NOW);
    expect(mergeOfflineTrail(started, { trail: trail(), pinned: true }, NOW + 1).pinned).toBe(true);
  });

  it('lists each path once, and keeps the paths it already had', () => {
    const first = mergeOfflineTrail(null, { trail: trail(), maps: [maps[0]] }, NOW);
    const second = mergeOfflineTrail(first, { trail: trail(), maps: [{ id: 11, name: 'Renamed' }, maps[1]] }, NOW + 1);
    expect(second.maps).toEqual(maps);
  });

  it('names a path that has no name', () => {
    expect(mergeOfflineTrail(null, { trail: trail(), maps: [{ id: 5 }] }, NOW).maps).toEqual([{ id: 5, name: 'Trail Map' }]);
  });

  it('leaves out paths that cannot be told apart', () => {
    const out = mergeOfflineTrail(null, { trail: trail(), maps: [null, {}, { id: null }, { name: 'x' }, maps[0]] }, NOW);
    expect(out.maps).toEqual([maps[0]]);
  });

  it('keeps only the first few paths of a trail', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `Path ${i + 1}` }));
    const out = mergeOfflineTrail(null, { trail: trail(), maps: many }, NOW);
    expect(out.maps.map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(out.maps).toHaveLength(MAX_PATHS_PER_TRAIL);
  });

  it('keeps only a few lines of a trail, and the ones that just came stay', () => {
    const routes = { 1: route(3), 2: route(3), 3: route(3), 4: route(3) };
    const first = mergeOfflineTrail(null, { trail: trail(), routes }, NOW);
    expect(Object.keys(first.routes)).toHaveLength(MAX_PATHS_PER_TRAIL);
    const second = mergeOfflineTrail(first, { trail: trail(), routes: { 9: route(7) } }, NOW + 1);
    expect(Object.keys(second.routes)).toHaveLength(MAX_PATHS_PER_TRAIL);
    expect(second.routes['9'].coordinates).toHaveLength(7);
  });

  it('ignores a line that has no usable points', () => {
    const out = mergeOfflineTrail(null, { trail: trail(), routes: { 11: { coordinates: [] }, 12: null, 13: route(3) } }, NOW);
    expect(Object.keys(out.routes)).toEqual(['13']);
  });

  it('gives back the very same record when nothing new came, so nothing needs saving', () => {
    const first = mergeOfflineTrail(null, { trail: trail(), maps, routes: { 11: route(4) }, pinned: true }, NOW);
    const again = mergeOfflineTrail(first, { trail: trail(), maps, routes: { 11: route(4) }, pinned: true }, NOW + 5000);
    expect(again).toBe(first);
    expect(again.savedAt).toBe(NOW);
  });

  it('gives back the same record for a trail that adds only things that do not count', () => {
    const first = mergeOfflineTrail(null, { trail: trail() }, NOW);
    expect(mergeOfflineTrail(first, { trail: trail({ distanceKm: 99, isOpen: false }) }, NOW + 1)).toBe(first);
  });

  it('is a new record when the trail itself changed', () => {
    const first = mergeOfflineTrail(null, { trail: trail() }, NOW);
    const next = mergeOfflineTrail(first, { trail: trail({ rating: 3 }) }, NOW + 1);
    expect(next).not.toBe(first);
    expect(next.trail.rating).toBe(3);
  });

  it('keeps what it knew of the trail that the new copy lacks', () => {
    const first = mergeOfflineTrail(null, { trail: trail() }, NOW);
    const next = mergeOfflineTrail(first, { trail: { id: 'trailapi-77', name: 'Old Rag Loop' } }, NOW + 1);
    expect(next.trail.directions).toBe('Take 231 north.');
  });

  it('does not mix up with the record of another trail', () => {
    const other = mergeOfflineTrail(null, { trail: trail({ id: 'trailapi-1' }), routes: { 11: route(4) }, pinned: true }, NOW);
    const out = mergeOfflineTrail(other, { trail: trail() }, NOW + 1);
    expect(out.id).toBe('trailapi-77');
    expect(out.routes).toEqual({});
    expect(out.pinned).toBe(false);
  });
});

describe('limitOfflineTrails', () => {
  const rec = (id, savedAt, pinned = false, extra = {}) => ({ id, savedAt, pinned, trail: { id }, maps: [], routes: {}, ...extra });
  const byId = (...list) => Object.fromEntries(list.map((r) => [r.id, r]));

  it('keeps everything while it fits', () => {
    const all = byId(rec('a', 1), rec('b', 2));
    expect(limitOfflineTrails(all, { keepId: 'b' })).toEqual(all);
  });

  it('does not change what it is given', () => {
    const all = byId(rec('a', 1), rec('b', 2), rec('c', 3));
    limitOfflineTrails(all, { maxTrails: 1, keepId: 'c' });
    expect(Object.keys(all)).toHaveLength(3);
  });

  it('drops the oldest trail first when there are too many', () => {
    const all = byId(rec('a', 3), rec('b', 1), rec('c', 2), rec('d', 4));
    expect(Object.keys(limitOfflineTrails(all, { maxTrails: 2, keepId: 'd' })).sort()).toEqual(['a', 'd']);
  });

  it('drops trails that were only started before the ones the person saved, however old', () => {
    const all = byId(rec('saved-old', 1, true), rec('started-new', 5), rec('started-newer', 6), rec('now', 7));
    expect(Object.keys(limitOfflineTrails(all, { maxTrails: 2, keepId: 'now' })).sort()).toEqual(['now', 'saved-old']);
  });

  it('drops saved ones too, oldest first, when that is all that is left', () => {
    const all = byId(rec('a', 2, true), rec('b', 1, true), rec('c', 3, true));
    expect(Object.keys(limitOfflineTrails(all, { maxTrails: 2, keepId: 'c' })).sort()).toEqual(['a', 'c']);
  });

  it('never drops the trail that was just written', () => {
    const all = byId(rec('old-but-new', 1), rec('b', 2), rec('c', 3));
    expect(Object.keys(limitOfflineTrails(all, { maxTrails: 1, keepId: 'old-but-new' }))).toEqual(['old-but-new']);
  });

  it('drops trails until all of them together fit in the space', () => {
    const big = (id, savedAt) => rec(id, savedAt, false, { note: 'x'.repeat(1000) });
    const all = byId(big('a', 1), big('b', 2), big('c', 3), big('d', 4));
    const size = JSON.stringify(all.d).length;
    const out = limitOfflineTrails(all, { maxChars: size * 2 + 10, keepId: 'd' });
    expect(Object.keys(out).sort()).toEqual(['c', 'd']);
  });

  it('keeps the trail just written even when it alone is too big', () => {
    const huge = rec('only', 1, false, { note: 'x'.repeat(5000) });
    expect(Object.keys(limitOfflineTrails(byId(huge), { maxChars: 100, keepId: 'only' }))).toEqual(['only']);
  });

  it('leaves out empty entries', () => {
    expect(Object.keys(limitOfflineTrails({ a: rec('a', 1), b: null, c: undefined }, { keepId: 'a' }))).toEqual(['a']);
    expect(limitOfflineTrails(null)).toEqual({});
  });

  it('keeps 30 trails and 1.5 million characters by default', () => {
    expect(MAX_OFFLINE_TRAILS).toBe(30);
    expect(MAX_OFFLINE_CHARS).toBe(1500000);
    const many = byId(...Array.from({ length: 31 }, (_, i) => rec(`t${i}`, i)));
    const out = limitOfflineTrails(many, { keepId: 't30' });
    expect(Object.keys(out)).toHaveLength(30);
    expect(out.t0).toBeUndefined();
  });
});

describe('cachedRoute', () => {
  const record = { routes: { 11: route(4), 12: { coordinates: [pt(0)] } } };

  it('gives the line kept for a path', () => {
    expect(cachedRoute(record, 11)).toBe(record.routes['11']);
    expect(cachedRoute(record, '11')).toBe(record.routes['11']);
  });

  it('gives nothing for a path that is not kept, never another path\'s line', () => {
    expect(cachedRoute(record, 99)).toBeNull();
  });

  it('gives nothing for a line too short to draw', () => {
    expect(cachedRoute(record, 12)).toBeNull();
  });

  it('gives nothing without a record or a path', () => {
    expect(cachedRoute(null, 11)).toBeNull();
    expect(cachedRoute({}, 11)).toBeNull();
    expect(cachedRoute(record, null)).toBeNull();
    expect(cachedRoute(record, undefined)).toBeNull();
  });

  it('copes with the path number 0', () => {
    expect(cachedRoute({ routes: { 0: route(3) } }, 0)).not.toBeNull();
  });
});

describe('downloadTrailForOffline', () => {
  const PATHS = [{ id: 11, name: 'Main loop' }, { id: 12, name: 'Short cut' }];

  it('asks for the paths of the trail, then for the line of each, one at a time', async () => {
    const log = [];
    const fetchMaps = jest.fn(async (id) => { log.push(`maps ${id}`); return PATHS; });
    const fetchRoute = jest.fn(async (id) => {
      log.push(`start ${id}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      log.push(`end ${id}`);
      return route(3);
    });
    const out = await downloadTrailForOffline({ trail: trail(), fetchMaps, fetchRoute });
    expect(fetchMaps).toHaveBeenCalledWith('77');
    expect(log).toEqual(['maps 77', 'start 11', 'end 11', 'start 12', 'end 12']);
    expect(out.maps).toEqual(PATHS);
    expect(Object.keys(out.routes).sort()).toEqual(['11', '12']);
  });

  it('does not ask again for what is already in hand', async () => {
    const fetchMaps = jest.fn();
    const fetchRoute = jest.fn(async () => route(3));
    const out = await downloadTrailForOffline({
      trail: trail(), known: { maps: PATHS, routes: { 11: route(5) } }, fetchMaps, fetchRoute,
    });
    expect(fetchMaps).not.toHaveBeenCalled();
    expect(fetchRoute.mock.calls).toEqual([[12]]);
    expect(Object.keys(out.routes)).toEqual(['12']);
    expect(out.maps).toEqual(PATHS);
  });

  it('asks for nothing at all when everything is in hand', async () => {
    const fetchRoute = jest.fn();
    const out = await downloadTrailForOffline({
      trail: trail(), known: { maps: PATHS, routes: { 11: route(5), 12: route(5) } }, fetchMaps: jest.fn(), fetchRoute,
    });
    expect(fetchRoute).not.toHaveBeenCalled();
    expect(out.routes).toEqual({});
  });

  it('leaves out a line that cannot be fetched, and carries on with the rest', async () => {
    const fetchRoute = jest.fn(async (id) => {
      if (id === 11) throw new Error('no signal');
      return route(3);
    });
    const out = await downloadTrailForOffline({ trail: trail(), fetchMaps: async () => PATHS, fetchRoute });
    expect(Object.keys(out.routes)).toEqual(['12']);
    expect(fetchRoute).toHaveBeenCalledTimes(2);
  });

  it('leaves out a path with no route', async () => {
    const out = await downloadTrailForOffline({ trail: trail(), fetchMaps: async () => PATHS, fetchRoute: async () => null });
    expect(out.routes).toEqual({});
    expect(out.maps).toEqual(PATHS);
  });

  it('has no paths when the list cannot be fetched', async () => {
    const fetchRoute = jest.fn();
    const out = await downloadTrailForOffline({
      trail: trail(), fetchMaps: async () => { throw new Error('no signal'); }, fetchRoute,
    });
    expect(out).toEqual({ maps: [], routes: {} });
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it('only asks for the paths of a trail that has them', async () => {
    const fetchMaps = jest.fn(async () => PATHS);
    const out = await downloadTrailForOffline({ trail: trail({ id: 'osm-5', source: 'osm' }), fetchMaps, fetchRoute: jest.fn() });
    expect(fetchMaps).not.toHaveBeenCalled();
    expect(out).toEqual({ maps: [], routes: {} });
  });

  it('takes no more than the first few paths', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `P${i + 1}` }));
    const fetchRoute = jest.fn(async () => route(3));
    const out = await downloadTrailForOffline({ trail: trail(), fetchMaps: async () => many, fetchRoute });
    expect(fetchRoute).toHaveBeenCalledTimes(MAX_PATHS_PER_TRAIL);
    expect(out.maps).toHaveLength(MAX_PATHS_PER_TRAIL);
  });

  it('copes with nothing to ask with', async () => {
    const out = await downloadTrailForOffline({ trail: trail(), known: { maps: PATHS } });
    expect(out).toEqual({ maps: PATHS, routes: {} });
  });
});

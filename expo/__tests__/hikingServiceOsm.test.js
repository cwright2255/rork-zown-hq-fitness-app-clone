import { fetchOsmPaths, fetchRouteForMap, clearOsmPathCache } from '../services/hikingService';
import { callProxy } from '../services/callProxy';

// The trail service is asked through the app's cloud functions; none is called here.
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

const line = (lat0, lon0, n) => Array.from({ length: n }, (_, i) => ({ lat: lat0 + i * 0.001, lon: lon0 }));
const way = (id, name, geometry) => ({ type: 'way', id, geometry, tags: { highway: 'path', name } });
const ANSWER = {
  version: 0.6,
  elements: [
    way(701, 'Blue Trail', line(39.9, -74.9, 6)),
    way(702, 'Red Trail', line(39.91, -74.9, 6)),
  ],
};
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const failed = (status) => ({ ok: false, status, json: async () => ({}) });

const FIRST = 'https://overpass-api.de/api/interpreter';
const MIRROR = 'https://overpass.kumi.systems/api/interpreter';
const POINT = { latitude: 39.9, longitude: -74.9 };

let warn;
beforeEach(() => {
  clearOsmPathCache();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.fetch = jest.fn();
  callProxy.mockReset();
});
afterEach(() => {
  warn.mockRestore();
  delete global.fetch;
  jest.useRealTimers();
});

describe('fetchOsmPaths', () => {
  it('asks Overpass for the paths around the point, as a form post', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(FIRST);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.body.startsWith('data=')).toBe(true);
    const query = decodeURIComponent(init.body.slice(5));
    expect(query).toContain('way(around:2000,39.900000,-74.900000)');
    expect(query).toContain('["name"]');
    // sent encoded, as a form post must be: no raw brackets, quotes, spaces or bars in it
    expect(init.body).toBe(`data=${encodeURIComponent(query)}`);
    expect(init.body).not.toMatch(/[\s"\[\]|^]/);
  });

  it('asks for a different distance when told to', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths({ ...POINT, radiusM: 800 });
    expect(decodeURIComponent(global.fetch.mock.calls[0][1].body)).toContain('around:800,');
  });

  it('gives the paths for the picker and their lines, nearest first', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    const { maps, routes } = await fetchOsmPaths(POINT);
    expect(maps.map((m) => m.name)).toEqual(['Blue Trail', 'Red Trail']);
    expect(maps.map((m) => m.id)).toEqual(['osm-way-701', 'osm-way-702']);
    expect(maps[0].distanceKm).toBeCloseTo(0.56, 2);
    expect(Object.keys(routes)).toEqual(['osm-way-701', 'osm-way-702']);
    expect(routes['osm-way-701'].coordinates).toHaveLength(6);
    expect(routes['osm-way-701'].elevationGainM).toBeNull();
  });

  it('gives no paths, and no error, when the park has none marked', async () => {
    global.fetch.mockResolvedValue(ok({ version: 0.6, elements: [] }));
    await expect(fetchOsmPaths(POINT)).resolves.toEqual({ maps: [], routes: {} });
    expect(warn).not.toHaveBeenCalled();
  });

  it('asks the second address when the first is busy', async () => {
    global.fetch.mockResolvedValueOnce(failed(429)).mockResolvedValueOnce(ok(ANSWER));
    const { maps } = await fetchOsmPaths(POINT);
    expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([FIRST, MIRROR]);
    expect(maps).toHaveLength(2);
  });

  it('asks the second address when the first cannot be reached', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(ok(ANSWER));
    const { maps } = await fetchOsmPaths(POINT);
    expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([FIRST, MIRROR]);
    expect(maps).toHaveLength(2);
  });

  it('does not ask the second address when the first answered', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails, with the reason, when neither address answers', async () => {
    global.fetch.mockResolvedValueOnce(failed(504)).mockRejectedValueOnce(new Error('Network request failed'));
    await expect(fetchOsmPaths(POINT)).rejects.toThrow('Network request failed');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith('[hikingService] Overpass request failed:', FIRST, 'Overpass request failed: 504');
  });

  it('counts a "timed out" answer with nothing in it as a failure, not as "no paths here"', async () => {
    const busy = { version: 0.6, elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 26 seconds.' };
    global.fetch.mockResolvedValueOnce(ok(busy)).mockResolvedValueOnce(ok(ANSWER));
    const { maps } = await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(maps).toHaveLength(2);
    clearOsmPathCache();
    global.fetch.mockReset();
    global.fetch.mockResolvedValue(ok(busy));
    await expect(fetchOsmPaths(POINT)).rejects.toThrow(/timed out/);
  });

  it('counts an out-of-memory answer with nothing in it as a failure too', async () => {
    global.fetch.mockResolvedValue(ok({ elements: [], remark: 'runtime error: Query run out of memory using about 2048 MB of RAM.' }));
    await expect(fetchOsmPaths(POINT)).rejects.toThrow(/out of memory/);
  });

  it('uses an answer that has a remark but also has paths in it', async () => {
    global.fetch.mockResolvedValue(ok({ ...ANSWER, remark: 'runtime error: Query timed out' }));
    const { maps } = await fetchOsmPaths(POINT);
    expect(maps).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails when the answer is not JSON', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } });
    await expect(fetchOsmPaths(POINT)).rejects.toThrow('Unexpected token');
  });

  it('does not ask at all without a point on the map', async () => {
    await expect(fetchOsmPaths({ latitude: undefined, longitude: -74.9 })).resolves.toEqual({ maps: [], routes: {} });
    await expect(fetchOsmPaths({ latitude: 'x', longitude: NaN })).resolves.toEqual({ maps: [], routes: {} });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe('on a weak signal', () => {
    it('gives up on an address after 20 seconds and asks the next', async () => {
      jest.useFakeTimers();
      const signals = [];
      global.fetch.mockImplementation((url, init) => {
        signals.push(init.signal);
        if (url === FIRST) {
          return new Promise((resolve, reject) => {
            init.signal.addEventListener('abort', () => reject(new Error('Aborted')));
          });
        }
        return Promise.resolve(ok(ANSWER));
      });
      const pending = fetchOsmPaths(POINT);
      await Promise.resolve();
      jest.advanceTimersByTime(19999);
      await Promise.resolve();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(signals[0].aborted).toBe(false);
      jest.advanceTimersByTime(1);
      const { maps } = await pending;
      expect(signals[0].aborted).toBe(true);
      expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([FIRST, MIRROR]);
      expect(maps).toHaveLength(2);
    });

    it('leaves no timer running once an address has answered', async () => {
      jest.useFakeTimers();
      global.fetch.mockResolvedValue(ok(ANSWER));
      await fetchOsmPaths(POINT);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('leaves no timer running after a failure either', async () => {
      jest.useFakeTimers();
      global.fetch.mockResolvedValue(failed(500));
      await expect(fetchOsmPaths(POINT)).rejects.toThrow('500');
      expect(jest.getTimerCount()).toBe(0);
    });
  });
});

describe('reusing an answer', () => {
  it('does not ask again for the same trail within fifteen minutes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    global.fetch.mockResolvedValue(ok(ANSWER));
    const first = await fetchOsmPaths(POINT);
    jest.setSystemTime(new Date('2026-10-13T12:14:59Z'));
    const second = await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('asks again after fifteen minutes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths(POINT);
    jest.setSystemTime(new Date('2026-10-13T12:15:00Z'));
    await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a point a few metres off as the same trail, and one further off as another', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths({ latitude: 39.90001, longitude: -74.90001 });
    await fetchOsmPaths({ latitude: 39.90003, longitude: -74.90004 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await fetchOsmPaths({ latitude: 39.9005, longitude: -74.9 }); // about 55 m north: another trailhead
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await fetchOsmPaths({ latitude: 39.91, longitude: -74.9 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('does not share an answer between two search distances', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths({ ...POINT, radiusM: 2000 });
    await fetchOsmPaths({ ...POINT, radiusM: 500 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failure: the next visit asks again', async () => {
    global.fetch.mockResolvedValue(failed(500));
    await expect(fetchOsmPaths(POINT)).rejects.toThrow();
    global.fetch.mockReset();
    global.fetch.mockResolvedValue(ok(ANSWER));
    const { maps } = await fetchOsmPaths(POINT);
    expect(maps).toHaveLength(2);
  });

  it('keeps an answer of "no paths here" too, so an empty park is not asked about again and again', async () => {
    global.fetch.mockResolvedValue(ok({ elements: [] }));
    await fetchOsmPaths(POINT);
    await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('can be cleared', async () => {
    global.fetch.mockResolvedValue(ok(ANSWER));
    await fetchOsmPaths(POINT);
    clearOsmPathCache();
    await fetchOsmPaths(POINT);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('fetchRouteForMap and a path from OpenStreetMap', () => {
  it('does not ask the trail service for the line: the path came with it', async () => {
    await expect(fetchRouteForMap('osm-way-701')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(callProxy).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('still asks for the line of a trail service map', async () => {
    const gpx = '<gpx><trk><trkseg>'
      + '<trkpt lat="39.9" lon="-74.9"><ele>10</ele></trkpt>'
      + '<trkpt lat="39.91" lon="-74.9"><ele>20</ele></trkpt>'
      + '</trkseg></trk></gpx>';
    callProxy.mockResolvedValue({ gpx });
    const route = await fetchRouteForMap(55);
    expect(callProxy).toHaveBeenCalledTimes(1);
    expect(callProxy).toHaveBeenCalledWith('getTrailApiGpx', { mapId: 55 });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(route.coordinates).toHaveLength(2);
    expect(route.elevationGainM).toBe(10);
  });

  it('gives nothing for no id at all', async () => {
    await expect(fetchRouteForMap(null)).resolves.toBeNull();
    await expect(fetchRouteForMap(undefined)).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(callProxy).not.toHaveBeenCalled();
  });
});

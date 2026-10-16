// When the Radar request fails, the route and place lookups used to answer anyway: a made-up walking time worked out from an
// assumed pace, and two hard-coded cities (San Francisco, New York) as if they were search results. They now say they have
// nothing.
jest.mock('expo-location', () => ({}), { virtual: true });

import { radarService } from '../services/radarService';

const here = { latitude: 40.7, longitude: -74.0 };
const there = { latitude: 40.8, longitude: -73.9 };

let originalFetch;
beforeEach(() => {
  originalFetch = global.fetch;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('when Radar cannot be reached', () => {
  beforeEach(() => { global.fetch = jest.fn(() => Promise.reject(new Error('offline'))); });

  it('gives no route, not an estimate', async () => {
    expect(await radarService.getRoute([here, there])).toBeNull();
  });

  it('finds no places, not two cities', async () => {
    expect(await radarService.searchLocations('anywhere')).toEqual([]);
  });
});

describe('when Radar answers with an error', () => {
  beforeEach(() => { global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })); });

  it('gives no route and no places', async () => {
    expect(await radarService.getRoute([here, there])).toBeNull();
    expect(await radarService.searchLocations('anywhere')).toEqual([]);
  });
});

describe('when Radar answers', () => {
  it('passes the real route through', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ routes: [{ distance: { value: 1500, text: '1.5 km' }, duration: { value: 1100, text: '18 min' }, geometry: { coordinates: [[-74, 40.7], [-73.9, 40.8]] } }] }),
    }));
    const route = await radarService.getRoute([here, there]);
    expect(route.distance).toEqual({ value: 1500, text: '1.5 km' });
    expect(route.duration).toEqual({ value: 1100, text: '18 min' });
  });

  it('still refuses a route with fewer than two points', async () => {
    await expect(radarService.getRoute([here])).rejects.toThrow('At least two coordinates');
  });
});

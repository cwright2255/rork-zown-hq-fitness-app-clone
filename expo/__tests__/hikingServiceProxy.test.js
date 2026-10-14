import {
  searchNearbyTrails, getTrailMaps, getTrailGpx, fetchTrailRoute, getPhotoUri, peekPhotoUri, clearPhotoCache,
} from '../services/hikingService';
import { callProxy } from '../services/callProxy';

// The trail service, Google Places and trail photos are asked for through the app's cloud functions,
// which hold the keys (functions/src/index.js). The functions are replaced here by a fake.
jest.mock('../services/callProxy', () => ({ callProxy: jest.fn() }));

const POINT = { latitude: 39.9, longitude: -74.9 };
const TRAILAPI_ANSWER = {
  places: [
    {
      unique_id: 'trail-77', name: 'Pine Barrens', lat: 39.95, lon: -74.9, city: 'Medford', state: 'NJ', directions: 'Take Route 70',
      activities: [{ activity_type_name: 'hiking', name: 'Pine Loop', rating: '4.5', length: '3.2', thumbnail: 'null' }],
    },
    { unique_id: 'no-position', name: 'Nowhere', activities: [] },
  ],
};
const PLACES_ANSWER = {
  places: [{
    id: 'ChIJ1', displayName: { text: 'Wharton State Forest' }, formattedAddress: 'Hammonton, NJ', location: { latitude: 39.7, longitude: -74.7 },
    rating: 4.7, userRatingCount: 321, regularOpeningHours: { openNow: true }, types: ['state_park'], googleMapsUri: 'https://maps/x',
    photos: [{ name: 'places/ChIJ1/photos/AbC' }],
  }],
};
const GPX = '<gpx><trk><trkseg>'
  + '<trkpt lat="39.9" lon="-74.9"><ele>10</ele></trkpt>'
  + '<trkpt lat="39.91" lon="-74.9"><ele>20</ele></trkpt>'
  + '</trkseg></trk></gpx>';

let warn;
let log;
beforeEach(() => {
  callProxy.mockReset();
  clearPhotoCache();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
  global.fetch = jest.fn();
});
afterEach(() => {
  warn.mockRestore();
  log.mockRestore();
  delete global.fetch;
  jest.restoreAllMocks();
});

describe('searchNearbyTrails', () => {
  it('asks the trail service, through the cloud function, for trails in miles', async () => {
    callProxy.mockResolvedValue(TRAILAPI_ANSWER);
    await searchNearbyTrails({ ...POINT, radiusMeters: 24000 });
    expect(callProxy).toHaveBeenCalledTimes(1);
    expect(callProxy).toHaveBeenCalledWith('searchTrailApiNearby', { latitude: 39.9, longitude: -74.9, radiusMiles: 15 });
  });

  it('turns the answer into trail records, keeping only trails with a position', async () => {
    callProxy.mockResolvedValue(TRAILAPI_ANSWER);
    const trails = await searchNearbyTrails(POINT);
    expect(trails).toHaveLength(1);
    expect(trails[0]).toMatchObject({
      id: 'trailapi-trail-77', name: 'Pine Loop', address: 'Medford, NJ', latitude: 39.95, longitude: -74.9,
      rating: 4.5, lengthMiles: 3.2, photoUrl: null, photoName: null, directions: 'Take Route 70', source: 'trailapi',
    });
    expect(trails[0].distanceKm).toBeGreaterThan(5);
    expect(trails[0].distanceKm).toBeLessThan(6);
    expect(callProxy).toHaveBeenCalledTimes(1); // Places was not needed
  });

  it('carries on with Places when the trail service fails', async () => {
    callProxy.mockRejectedValueOnce(new Error('TrailAPI is not set up')).mockResolvedValueOnce(PLACES_ANSWER);
    const trails = await searchNearbyTrails({ ...POINT, radiusMeters: 30000 });
    expect(callProxy.mock.calls[1]).toEqual(['searchPlacesNearby', { latitude: 39.9, longitude: -74.9, radiusMeters: 30000 }]);
    expect(trails).toHaveLength(1);
    expect(trails[0]).toMatchObject({
      id: 'ChIJ1', name: 'Wharton State Forest', address: 'Hammonton, NJ', rating: 4.7, ratingCount: 321, isOpen: true,
      photoUrl: null, photoName: 'places/ChIJ1/photos/AbC', source: 'places',
    });
    expect(warn).toHaveBeenCalledWith('[hikingService] TrailAPI failed, falling back to Places:', 'TrailAPI is not set up');
  });

  it('carries on with Places when the trail service finds nothing', async () => {
    callProxy.mockResolvedValueOnce({ places: [] }).mockResolvedValueOnce(PLACES_ANSWER);
    const trails = await searchNearbyTrails(POINT);
    expect(callProxy.mock.calls.map((c) => c[0])).toEqual(['searchTrailApiNearby', 'searchPlacesNearby']);
    expect(trails[0].source).toBe('places');
  });

  it('carries on with Places when the trail service sends nothing readable', async () => {
    callProxy.mockResolvedValueOnce(null).mockResolvedValueOnce(PLACES_ANSWER);
    const trails = await searchNearbyTrails(POINT);
    expect(trails[0].source).toBe('places');
  });

  it('fails when Places fails too, as before', async () => {
    callProxy.mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('Places search failed: 403'));
    await expect(searchNearbyTrails(POINT)).rejects.toThrow('Places search failed: 403');
  });

  it('gives an empty list when Places finds no trail areas', async () => {
    callProxy.mockResolvedValueOnce({ places: [] }).mockResolvedValueOnce({});
    await expect(searchNearbyTrails(POINT)).resolves.toEqual([]);
  });

  it('never sends a key from the phone, whatever the environment holds', async () => {
    process.env.EXPO_PUBLIC_TRAILAPI_KEY = 'SENTINEL-TRAILAPI';
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'SENTINEL-PLACES';
    process.env.EXPO_PUBLIC_RAPIDAPI_KEY = 'SENTINEL-RAPID';
    try {
      callProxy.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(PLACES_ANSWER);
      await searchNearbyTrails(POINT);
      callProxy.mockResolvedValue({ maps: [{ id: 1 }], gpx: GPX, photoUri: 'https://p' });
      await getTrailMaps('1');
      await getTrailGpx('1');
      await getPhotoUri('places/a/photos/b', 300);
      expect(JSON.stringify(callProxy.mock.calls)).not.toContain('SENTINEL');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_TRAILAPI_KEY;
      delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
      delete process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
    }
  });
});

describe('getTrailMaps', () => {
  it('asks for the maps of a trail', async () => {
    callProxy.mockResolvedValue([]);
    await getTrailMaps('trail-77');
    expect(callProxy).toHaveBeenCalledWith('getTrailApiMaps', { trailId: 'trail-77' });
  });

  it.each([
    ['a list', [{ id: 1, name: 'Loop' }, { unique_id: 2 }, { map_id: 3, name: 'Out and back' }]],
    ['a maps field', { maps: [{ id: 1, name: 'Loop' }, { unique_id: 2 }, { map_id: 3, name: 'Out and back' }] }],
    ['a data field', { data: [{ id: 1, name: 'Loop' }, { unique_id: 2 }, { map_id: 3, name: 'Out and back' }] }],
  ])('reads the maps from %s', async (_, answer) => {
    callProxy.mockResolvedValue(answer);
    await expect(getTrailMaps('1')).resolves.toEqual([
      { id: 1, name: 'Loop' }, { id: 2, name: 'Trail Map' }, { id: 3, name: 'Out and back' },
    ]);
  });

  it('gives an empty list for an answer with no maps in it', async () => {
    callProxy.mockResolvedValue({});
    await expect(getTrailMaps('1')).resolves.toEqual([]);
    callProxy.mockResolvedValue(null);
    await expect(getTrailMaps('1')).resolves.toEqual([]);
  });

  it('fails when the cloud function fails, for the screen to handle', async () => {
    callProxy.mockRejectedValue(new Error('TrailAPI maps failed: 429'));
    await expect(getTrailMaps('1')).rejects.toThrow('TrailAPI maps failed: 429');
  });
});

describe('getTrailGpx and fetchTrailRoute', () => {
  it('gives the GPX text of a map', async () => {
    callProxy.mockResolvedValue({ gpx: GPX });
    await expect(getTrailGpx(55)).resolves.toBe(GPX);
    expect(callProxy).toHaveBeenCalledWith('getTrailApiGpx', { mapId: 55 });
  });

  it('needs a map id, and asks for nothing without one', async () => {
    await expect(getTrailGpx(null)).rejects.toThrow('getTrailGpx requires a real map id.');
    expect(callProxy).not.toHaveBeenCalled();
  });

  it('fails when no route comes back', async () => {
    callProxy.mockResolvedValue({});
    await expect(getTrailGpx(55)).rejects.toThrow('sent no route');
    callProxy.mockResolvedValue(null);
    await expect(getTrailGpx(55)).rejects.toThrow('sent no route');
  });

  it('finds a trail\'s first map and its line', async () => {
    callProxy.mockImplementation(async (name) => (name === 'getTrailApiMaps' ? [{ id: 9, name: 'Loop' }] : { gpx: GPX }));
    const route = await fetchTrailRoute('trail-77');
    expect(callProxy.mock.calls).toEqual([['getTrailApiMaps', { trailId: 'trail-77' }], ['getTrailApiGpx', { mapId: 9 }]]);
    expect(route.coordinates).toHaveLength(2);
  });

  it('gives nothing, quietly, when there is no id, no map or the request fails', async () => {
    await expect(fetchTrailRoute(null)).resolves.toBeNull();
    expect(callProxy).not.toHaveBeenCalled();
    callProxy.mockResolvedValue([]);
    await expect(fetchTrailRoute('t')).resolves.toBeNull();
    callProxy.mockRejectedValue(new Error('down'));
    await expect(fetchTrailRoute('t')).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('getPhotoUri', () => {
  const NAME = 'places/ChIJ1/photos/AbC';

  it('gives the address Google gives for a photo name', async () => {
    callProxy.mockResolvedValue({ photoUri: 'https://lh3/abc' });
    await expect(getPhotoUri(NAME, 300)).resolves.toBe('https://lh3/abc');
    expect(callProxy).toHaveBeenCalledWith('getPlacesPhotoUri', { photoName: NAME, maxWidthPx: 300 });
  });

  it('asks for 500 pixels wide when the screen does not say', async () => {
    callProxy.mockResolvedValue({ photoUri: 'https://lh3/abc' });
    await getPhotoUri(NAME);
    expect(callProxy).toHaveBeenCalledWith('getPlacesPhotoUri', { photoName: NAME, maxWidthPx: 500 });
  });

  it('reuses an address it has, for each size separately', async () => {
    callProxy.mockImplementation(async (_, { maxWidthPx }) => ({ photoUri: `https://lh3/${maxWidthPx}` }));
    await expect(getPhotoUri(NAME, 300)).resolves.toBe('https://lh3/300');
    await expect(getPhotoUri(NAME, 300)).resolves.toBe('https://lh3/300');
    expect(callProxy).toHaveBeenCalledTimes(1);
    await expect(getPhotoUri(NAME, 900)).resolves.toBe('https://lh3/900');
    expect(callProxy).toHaveBeenCalledTimes(2);
    expect(peekPhotoUri(NAME, 300)).toBe('https://lh3/300');
    expect(peekPhotoUri(NAME, 900)).toBe('https://lh3/900');
    expect(peekPhotoUri(NAME, 500)).toBeNull();
  });

  it('asks once when the same photo is wanted twice at the same time', async () => {
    let finish;
    callProxy.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const first = getPhotoUri(NAME, 300);
    const second = getPhotoUri(NAME, 300);
    finish({ photoUri: 'https://lh3/once' });
    await expect(Promise.all([first, second])).resolves.toEqual(['https://lh3/once', 'https://lh3/once']);
    expect(callProxy).toHaveBeenCalledTimes(1);
  });

  it('asks again once the address is two minutes old', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    callProxy.mockResolvedValueOnce({ photoUri: 'https://lh3/old' }).mockResolvedValueOnce({ photoUri: 'https://lh3/new' });
    await getPhotoUri(NAME, 300);
    now.mockReturnValue(1_000_000 + 119_000);
    expect(peekPhotoUri(NAME, 300)).toBe('https://lh3/old');
    await expect(getPhotoUri(NAME, 300)).resolves.toBe('https://lh3/old');
    now.mockReturnValue(1_000_000 + 121_000);
    expect(peekPhotoUri(NAME, 300)).toBeNull();
    await expect(getPhotoUri(NAME, 300)).resolves.toBe('https://lh3/new');
    expect(callProxy).toHaveBeenCalledTimes(2);
  });

  it('gives null, and asks again next time, when the photo cannot be found', async () => {
    callProxy.mockRejectedValueOnce(new Error('Places photo failed: 404')).mockResolvedValueOnce({ photoUri: 'https://lh3/ok' });
    await expect(getPhotoUri(NAME, 300)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith('[hikingService] Trail photo request failed:', 'Places photo failed: 404');
    await expect(getPhotoUri(NAME, 300)).resolves.toBe('https://lh3/ok');
  });

  it('gives null for an answer with no address, and does not keep it', async () => {
    callProxy.mockResolvedValueOnce({}).mockResolvedValueOnce({ photoUri: '' }).mockResolvedValueOnce(null);
    await expect(getPhotoUri(NAME, 300)).resolves.toBeNull();
    await expect(getPhotoUri(NAME, 300)).resolves.toBeNull();
    await expect(getPhotoUri(NAME, 300)).resolves.toBeNull();
    expect(peekPhotoUri(NAME, 300)).toBeNull();
  });

  it('asks for nothing without a photo name', async () => {
    await expect(getPhotoUri(null)).resolves.toBeNull();
    await expect(getPhotoUri('')).resolves.toBeNull();
    expect(callProxy).not.toHaveBeenCalled();
  });
});

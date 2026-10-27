// The cloud functions that hold the TrailAPI, Google Places and RapidAPI keys so the app does not
// (functions/src/index.js, checks in functions/src/proxyInput.js). index.js is loaded with the
// Firebase packages replaced by small fakes, and fetch replaced, so nothing leaves the test.

jest.mock('firebase-admin/app', () => ({ initializeApp: jest.fn() }), { virtual: true });
jest.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}), FieldValue: {} }), { virtual: true });
jest.mock('firebase-admin/messaging', () => ({ getMessaging: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/auth', () => ({ getAuth: () => ({}) }), { virtual: true });
jest.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({}) }) }), { virtual: true });
jest.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  return { onCall: (opts, handler) => Object.assign(handler, { __opts: opts }), onRequest: (opts, handler) => handler, HttpsError };
}, { virtual: true });
jest.mock('firebase-functions/v2/firestore', () => ({ onDocumentCreated: (opts, handler) => handler, onDocumentDeleted: (opts, handler) => handler }), { virtual: true });
jest.mock('firebase-functions/params', () => ({ defineSecret: (name) => ({ name, value: () => 'secret-' + name }) }), { virtual: true });
jest.mock('openai', () => ({ __esModule: true, default: class OpenAI {} }), { virtual: true });
jest.mock('../functions/src/accountErasure.js', () => ({ eraseUserAccount: jest.fn() }));

const AUTH = { uid: 'u1' };
const TRAILAPI = 'https://trailapi-trailapi.p.rapidapi.com';
const PLACES = 'https://places.googleapis.com/v1';

let fns;
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
const call = (name, data, auth = AUTH) => fns[name]({ auth, data });

beforeEach(() => {
  jest.resetModules();
  fns = require('../functions/src/index.js');
  global.fetch = jest.fn(async () => json({ ok: true }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

describe('who may use the trail proxies', () => {
  const requests = {
    searchTrailApiNearby: { latitude: 39.9, longitude: -74.9, radiusMiles: 15 },
    getTrailApiMaps: { trailId: '55' },
    getTrailApiGpx: { mapId: '55' },
    searchPlacesNearby: { latitude: 39.9, longitude: -74.9, radiusMeters: 24000 },
    getPlacesPhotoUri: { photoName: 'places/abc/photos/def', maxWidthPx: 500 },
  };

  it.each(Object.keys(requests))('%s needs a signed-in caller', async (name) => {
    await expect(call(name, requests[name], null)).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps each key in the functions that use it, and caps how many copies run', () => {
    const secretsOf = (name) => fns[name].__opts.secrets.map((s) => s.name);
    for (const name of ['searchTrailApiNearby', 'getTrailApiMaps', 'getTrailApiGpx']) expect(secretsOf(name)).toEqual(['TRAILAPI_KEY']);
    for (const name of ['searchPlacesNearby', 'getPlacesPhotoUri']) expect(secretsOf(name)).toEqual(['GOOGLE_PLACES_API_KEY']);
    for (const name of Object.keys(requests)) {
      expect(fns[name].__opts.region).toBe('us-central1');
      expect(fns[name].__opts.maxInstances).toBe(10);
    }
  });
});

describe('searchTrailApiNearby', () => {
  it('asks TrailAPI for the trails around the point, with the key from the server', async () => {
    global.fetch.mockResolvedValue(json({ places: [{ unique_id: 'x' }] }));
    const answer = await call('searchTrailApiNearby', { latitude: 39.9, longitude: -74.9, radiusMiles: 15 });
    expect(answer).toEqual({ places: [{ unique_id: 'x' }] });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${TRAILAPI}/?lat=39.9&lon=-74.9&radius=15`);
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ 'x-rapidapi-key': 'secret-TRAILAPI_KEY', 'x-rapidapi-host': 'trailapi-trailapi.p.rapidapi.com' });
  });

  it('rounds the radius to whole miles, as the app did', async () => {
    await call('searchTrailApiNearby', { latitude: 1, longitude: 2, radiusMiles: 14.6 });
    expect(global.fetch.mock.calls[0][0]).toBe(`${TRAILAPI}/?lat=1&lon=2&radius=15`);
    await call('searchTrailApiNearby', { latitude: 1, longitude: 2, radiusMiles: 0 });
    expect(global.fetch.mock.calls[1][0]).toBe(`${TRAILAPI}/?lat=1&lon=2&radius=0`);
  });

  it.each([
    [{ longitude: 1, radiusMiles: 5 }],
    [{ latitude: 91, longitude: 1, radiusMiles: 5 }],
    [{ latitude: 1, longitude: -181, radiusMiles: 5 }],
    [{ latitude: 'north', longitude: 1, radiusMiles: 5 }],
    [{ latitude: 1, longitude: 1, radiusMiles: 201 }],
    [{ latitude: 1, longitude: 1, radiusMiles: -1 }],
    [{ latitude: true, longitude: 1, radiusMiles: 5 }],
    [{ latitude: '1&x=2', longitude: 1, radiusMiles: 5 }],
  ])('refuses %j without calling TrailAPI', async (data) => {
    await expect(call('searchTrailApiNearby', data)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says so, without the key, when TrailAPI refuses', async () => {
    global.fetch.mockResolvedValue(json({}, 429));
    const error = await call('searchTrailApiNearby', { latitude: 1, longitude: 2, radiusMiles: 5 }).catch((e) => e);
    expect(error).toMatchObject({ code: 'internal' });
    expect(error.message).toContain('429');
    expect(error.message).not.toContain('secret-');
  });

  it('says so when the answer is not JSON', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    await expect(call('searchTrailApiNearby', { latitude: 1, longitude: 2, radiusMiles: 5 })).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('getTrailApiMaps and getTrailApiGpx', () => {
  it('lists the maps of a trail', async () => {
    global.fetch.mockResolvedValue(json([{ id: 9, name: 'Loop' }]));
    expect(await call('getTrailApiMaps', { trailId: 'trail-55' })).toEqual([{ id: 9, name: 'Loop' }]);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${TRAILAPI}/trails/trail-55/maps/`);
    expect(init.headers['x-rapidapi-key']).toBe('secret-TRAILAPI_KEY');
  });

  it('downloads the GPX of a map and sends it back as text', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '<gpx></gpx>' });
    expect(await call('getTrailApiGpx', { mapId: 55 })).toEqual({ gpx: '<gpx></gpx>' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${TRAILAPI}/trails/map/55/gpx/`);
  });

  it.each(['../secret', '..', '.', 'a..b', '...', 'a/b', 'a\\b', 'a?x=1', 'a#b', 'a b', 'a%2Fb', '', 'x'.repeat(101), null, undefined, {}, ['1']])(
    'refuses the id %j',
    async (id) => {
      await expect(call('getTrailApiMaps', { trailId: id })).rejects.toMatchObject({ code: 'invalid-argument' });
      await expect(call('getTrailApiGpx', { mapId: id })).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(global.fetch).not.toHaveBeenCalled();
    }
  );

  it('keeps an id with a dot or a colon in one piece', async () => {
    await call('getTrailApiMaps', { trailId: 'a.b:c' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${TRAILAPI}/trails/a.b%3Ac/maps/`);
  });

  it('keeps a map id with a dot or a colon in one piece too', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '<gpx/>' });
    await call('getTrailApiGpx', { mapId: 'a.b:c' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${TRAILAPI}/trails/map/a.b%3Ac/gpx/`);
  });

  it('says so when TrailAPI sends nothing readable for a map list', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    await expect(call('getTrailApiMaps', { trailId: '1' })).rejects.toMatchObject({ code: 'internal' });
  });

  it('says so when TrailAPI refuses', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404, text: async () => '', json: async () => ({}) });
    await expect(call('getTrailApiGpx', { mapId: '1' })).rejects.toMatchObject({ code: 'internal' });
    await expect(call('getTrailApiMaps', { trailId: '1' })).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('searchPlacesNearby', () => {
  const REQUEST = { latitude: 39.9, longitude: -74.9, radiusMeters: 24000 };

  it('asks Places for trail areas near the point, with the key in the header', async () => {
    global.fetch.mockResolvedValue(json({ places: [{ id: 'p1' }] }));
    expect(await call('searchPlacesNearby', REQUEST)).toEqual({ places: [{ id: 'p1' }] });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${PLACES}/places:searchNearby`);
    expect(url).not.toContain('key');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('secret-GOOGLE_PLACES_API_KEY');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-Goog-FieldMask']).toBe(
      'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.types,places.googleMapsUri'
    );
    expect(JSON.parse(init.body)).toEqual({
      includedTypes: ['hiking_area', 'park', 'state_park', 'national_park'],
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: 39.9, longitude: -74.9 }, radius: 24000 } },
    });
  });

  it('ignores anything else the caller sends: the types and fields are fixed here', async () => {
    await call('searchPlacesNearby', {
      ...REQUEST, includedTypes: ['gas_station'], maxResultCount: 500, fieldMask: 'places.reviews', textQuery: 'x', rankPreference: 'RELEVANCE',
    });
    const [, init] = global.fetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.includedTypes).toEqual(['hiking_area', 'park', 'state_park', 'national_park']);
    expect(body.maxResultCount).toBe(20);
    expect(body.rankPreference).toBe('DISTANCE');
    expect(Object.keys(body).sort()).toEqual(['includedTypes', 'locationRestriction', 'maxResultCount', 'rankPreference']);
    expect(init.headers['X-Goog-FieldMask']).not.toContain('reviews');
  });

  it.each([
    [{ ...REQUEST, radiusMeters: 0 }],
    [{ ...REQUEST, radiusMeters: 50001 }],
    [{ ...REQUEST, radiusMeters: undefined }],
    [{ ...REQUEST, latitude: -91 }],
    [{ ...REQUEST, longitude: 'x' }],
  ])('refuses %j without calling Places', async (data) => {
    await expect(call('searchPlacesNearby', data)).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts the largest radius Places allows', async () => {
    await call('searchPlacesNearby', { ...REQUEST, radiusMeters: 50000 });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).locationRestriction.circle.radius).toBe(50000);
  });

  it('says so when Places sends nothing readable', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
    await expect(call('searchPlacesNearby', REQUEST)).rejects.toMatchObject({ code: 'internal' });
  });

  it('says so, without the key, when Places refuses', async () => {
    global.fetch.mockResolvedValue(json({ error: { message: 'API key not valid secret-GOOGLE_PLACES_API_KEY' } }, 403));
    const error = await call('searchPlacesNearby', REQUEST).catch((e) => e);
    expect(error).toMatchObject({ code: 'internal' });
    expect(error.message).toContain('403');
    expect(error.message).not.toContain('secret-');
  });
});

describe('getPlacesPhotoUri', () => {
  const NAME = 'places/ChIJabc_123-x/photos/AUy1Y-qq_Zz9';

  it('turns a photo name into the address Google gives for it, with the key in the header', async () => {
    global.fetch.mockResolvedValue(json({ name: `${NAME}/media`, photoUri: 'https://lh3.googleusercontent.com/p/abc' }));
    expect(await call('getPlacesPhotoUri', { photoName: NAME, maxWidthPx: 300 })).toEqual({ photoUri: 'https://lh3.googleusercontent.com/p/abc' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`${PLACES}/${NAME}/media?maxWidthPx=300&skipHttpRedirect=true`);
    expect(url).not.toContain('key=');
    expect(url).not.toContain('secret-');
    expect(init.headers).toEqual({ 'X-Goog-Api-Key': 'secret-GOOGLE_PLACES_API_KEY' });
  });

  it('uses 500 pixels wide when the app does not say', async () => {
    global.fetch.mockResolvedValue(json({ photoUri: 'https://x/y' }));
    await call('getPlacesPhotoUri', { photoName: NAME });
    expect(global.fetch.mock.calls[0][0]).toContain('maxWidthPx=500&');
  });

  it.each([
    'places/abc/photos/def/../../other',
    'places/../other/photos/def',
    'places/a/b/photos/c',
    'places/a/photos/b.c',
    'places/a.b/photos/c',
    ['places/abc/photos/def'],
    'places/abc/photos/def/media',
    'places/abc',
    'https://evil.example/places/abc/photos/def',
    '../places/abc/photos/def',
    'places/abc/photos/de f',
    'places/abc/photos/def?key=1',
    '',
    null,
    undefined,
    42,
  ])('refuses the photo name %j', async (photoName) => {
    await expect(call('getPlacesPhotoUri', { photoName })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([0, -5, 4801, 'wide', NaN, null])('refuses a width of %j', async (maxWidthPx) => {
    await expect(call('getPlacesPhotoUri', { photoName: NAME, maxWidthPx })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('says so when Places has no address to give', async () => {
    global.fetch.mockResolvedValue(json({ name: 'x' }));
    await expect(call('getPlacesPhotoUri', { photoName: NAME })).rejects.toMatchObject({ code: 'internal' });
    global.fetch.mockResolvedValue(json({}, 404));
    await expect(call('getPlacesPhotoUri', { photoName: NAME })).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('the edges of what the proxies accept', () => {
  it('takes the furthest coordinates and the largest and smallest sizes', async () => {
    await call('searchTrailApiNearby', { latitude: 90, longitude: 180, radiusMiles: 200 });
    await call('searchTrailApiNearby', { latitude: -90, longitude: -180, radiusMiles: 0 });
    expect(global.fetch.mock.calls.map((c) => c[0])).toEqual([`${TRAILAPI}/?lat=90&lon=180&radius=200`, `${TRAILAPI}/?lat=-90&lon=-180&radius=0`]);
    await call('searchPlacesNearby', { latitude: 90, longitude: 180, radiusMeters: 1 });
    expect(JSON.parse(global.fetch.mock.calls[2][1].body).locationRestriction.circle.radius).toBe(1);
    global.fetch.mockResolvedValue(json({ photoUri: 'https://x' }));
    await call('getPlacesPhotoUri', { photoName: 'places/a/photos/b', maxWidthPx: 4800 });
    await call('getPlacesPhotoUri', { photoName: 'places/a/photos/b', maxWidthPx: 1 });
    expect(global.fetch.mock.calls[3][0]).toContain('maxWidthPx=4800&');
    expect(global.fetch.mock.calls[4][0]).toContain('maxWidthPx=1&');
  });

  it('does not take an empty or missing number for zero', async () => {
    for (const latitude of ['', null, undefined, false, [], {}]) {
      await expect(call('searchTrailApiNearby', { latitude, longitude: 1, radiusMiles: 5 })).rejects.toMatchObject({ code: 'invalid-argument' });
      await expect(call('searchPlacesNearby', { latitude, longitude: 1, radiusMeters: 5 })).rejects.toMatchObject({ code: 'invalid-argument' });
    }
    await expect(call('searchTrailApiNearby', undefined)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call('getPlacesPhotoUri', { photoName: 'places/a/photos/b', maxWidthPx: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call('getPlacesPhotoUri', { photoName: 'places/a/photos/b', maxWidthPx: false })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('takes a trail id and a photo name up to their longest, and no longer', async () => {
    await call('getTrailApiMaps', { trailId: 'x'.repeat(100) });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await expect(call('getTrailApiMaps', { trailId: 'x'.repeat(101) })).rejects.toMatchObject({ code: 'invalid-argument' });
    global.fetch.mockResolvedValue(json({ photoUri: 'https://x' }));
    await call('getPlacesPhotoUri', { photoName: `places/${'a'.repeat(200)}/photos/${'b'.repeat(600)}` });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await expect(call('getPlacesPhotoUri', { photoName: `places/${'a'.repeat(201)}/photos/b` })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call('getPlacesPhotoUri', { photoName: `places/a/photos/${'b'.repeat(601)}` })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('takes a number sent as text, as the app may', async () => {
    await call('searchTrailApiNearby', { latitude: '39.9', longitude: '-74.9', radiusMiles: '15' });
    expect(global.fetch.mock.calls[0][0]).toBe(`${TRAILAPI}/?lat=39.9&lon=-74.9&radius=15`);
  });
});

describe('the muscle diagram functions (RapidAPI)', () => {
  const image = () => ({
    ok: true, status: 200,
    headers: { get: () => 'image/png' },
    arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
  });

  it('sends the image back as base64, with the key from the server', async () => {
    global.fetch.mockResolvedValue(image());
    const answer = await call('getMuscleVisualizeImage', { muscles: ['biceps', 'triceps'], color: '#E74C3C', gender: 'male', size: 'small' });
    expect(answer).toEqual({ base64: 'AQID', contentType: 'image/png' });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://muscle-visualizer-api.p.rapidapi.com/v1/visualize/muscles?muscles=biceps%2Ctriceps&color=%23E74C3C&gender=male&background=transparent&size=small&format=png');
    expect(init.headers['X-RapidAPI-Key']).toBe('secret-RAPIDAPI_KEY');
  });

  it('keeps gender and size from adding to the address', async () => {
    global.fetch.mockResolvedValue(image());
    await call('getMuscleVisualizeImage', { muscles: ['biceps'], gender: 'male&format=svg', size: 'x&y=1' });
    await call('getWorkoutVisualizeImage', { targetMuscles: ['biceps'], gender: 'male&format=svg', size: 'x&y=1' });
    await call('getHeatmapVisualizeImage', { muscleColors: [{ muscle: 'biceps', color: '#fff' }], gender: 'male&format=svg', size: 'x&y=1' });
    for (const [url] of global.fetch.mock.calls) {
      expect(url).toContain('gender=male%26format%3Dsvg');
      expect(url).toContain('size=x%26y%3D1');
      expect(url.match(/format=/g)).toHaveLength(1);
    }
  });

  it('refuses a list longer than a body has muscles', async () => {
    const many = Array.from({ length: 61 }, (_, i) => `m${i}`);
    await expect(call('getMuscleVisualizeImage', { muscles: many })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call('getWorkoutVisualizeImage', { targetMuscles: many })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(call('getHeatmapVisualizeImage', { muscleColors: many.map((m) => ({ muscle: m, color: '#000' })) })).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('still takes the longest list a body could need', async () => {
    global.fetch.mockResolvedValue(image());
    const sixty = Array.from({ length: 60 }, (_, i) => `m${i}`);
    await call('getMuscleVisualizeImage', { muscles: sixty });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

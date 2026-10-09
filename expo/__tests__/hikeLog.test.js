import {
  MIN_HIKE_KM, MAX_SAVED_HIKES, hikeTime, sortHikesNewest, keepNewestHikes, mergeHikes,
  buildSavedHike, fitHikesToSize, hikeRoute, hikeTitle, describeHike, summarizeHikes,
} from '../lib/hikeLog';

// 7:05 in the morning on Thu 8 Oct 2026, in the phone's own time zone (titles use local time).
const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();
const NOW = new Date(2026, 9, 8, 11, 20, 0).getTime();

// A route going straight north from (40, -74): one point every 0.001 degrees, about 111 m apart.
const north = (count, step = 0.001) => Array.from({ length: count }, (_, i) => ({ latitude: 40 + i * step, longitude: -74 }));

const tracked = (extra = {}) => ({
  trailId: 'trailapi-7', trailName: 'Old Rag', pathName: 'Ridge Trail',
  distanceKm: 14.236, elevationGainM: 812.4, elevationLossM: 805.2, durationSeconds: 15300.4,
  difficultyScore: 170.3, difficultyTier: 'Strenuous', calories: 2210.6, xpEarned: 1250.2,
  startTime: START, coords: north(60),
  ...extra,
});

const saved = (n, extra = {}) => ({
  id: `hike-${n}`,
  completedAt: new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString(),
  distanceKm: 5, durationSeconds: 5000, elevationGainM: 100, track: [],
  ...extra,
});

describe('the numbers it uses', () => {
  it('only keeps an outing as a hike from 0.3 km, and keeps the newest 200', () => {
    expect(MIN_HIKE_KM).toBe(0.3);
    expect(MAX_SAVED_HIKES).toBe(200);
  });
});

describe('buildSavedHike', () => {
  it('builds the saved record with whole numbers, the trail and the route', () => {
    const hike = buildSavedHike(tracked(), { now: NOW, uid: 'u1' });
    expect(hike).toMatchObject({
      id: `hike-${NOW}`,
      completedAt: new Date(NOW).toISOString(),
      startTime: START,
      trailId: 'trailapi-7',
      trailName: 'Old Rag',
      pathName: 'Ridge Trail',
      distanceKm: 14.24,
      elevationGainM: 812,
      elevationLossM: 805,
      durationSeconds: 15300,
      difficultyScore: 170.3,
      difficultyTier: 'Strenuous',
      calories: 2211,
      xpEarned: 1250,
      uid: 'u1',
    });
    expect(hike.track).toHaveLength(120); // 60 points, as a flat lat/lng list
    expect(hike.track.slice(0, 2)).toEqual([40, -74]);
  });

  it('keeps at most 200 points of a long route, first and last included', () => {
    const hike = buildSavedHike(tracked({ coords: north(1500) }), { now: NOW });
    expect(hike.track).toHaveLength(400);
    expect(hike.track.slice(0, 2)).toEqual([40, -74]);
    expect(hike.track.slice(-2)).toEqual([41.499, -74]);
  });

  it('also takes a route that is already a flat list', () => {
    const hike = buildSavedHike(tracked({ coords: undefined, track: [40, -74, 40.01, -74, 40.02, -74] }), { now: NOW });
    expect(hike.track).toEqual([40, -74, 40.01, -74, 40.02, -74]);
  });

  it('works out a start time when none was given, and has a plain name for an unlisted trail', () => {
    const hike = buildSavedHike({ distanceKm: 2, durationSeconds: 3600 }, { now: NOW });
    expect(hike.startTime).toBe(new Date(NOW - 3600 * 1000).toISOString());
    expect(hike.trailName).toBe('Untitled hike');
    expect(hike.trailId).toBeNull();
    expect(hike.pathName).toBeNull();
    expect(hike.difficultyTier).toBe('Easy');
    expect(hike.track).toEqual([]);
    expect('uid' in hike).toBe(false);
  });

  it('turns junk and negative numbers into zero, and never leaves a value undefined', () => {
    const hike = buildSavedHike({ distanceKm: -3, elevationGainM: 'lots', durationSeconds: NaN, calories: undefined }, { now: NOW });
    expect(hike.distanceKm).toBe(0);
    expect(hike.elevationGainM).toBe(0);
    expect(hike.durationSeconds).toBe(0);
    expect(hike.calories).toBe(0);
    expect(Object.values(buildSavedHike(undefined, { now: NOW })).every((v) => v !== undefined)).toBe(true);
    expect(Object.values(buildSavedHike(tracked(), { now: NOW })).every((v) => v !== undefined)).toBe(true);
  });
});

describe('keeping the list', () => {
  it('is oldest first, once per id, and keeps the newer copy of a repeat', () => {
    const list = keepNewestHikes([saved(3), saved(1), saved(2), saved(2, { distanceKm: 99 })]);
    expect(list.map((h) => h.id)).toEqual(['hike-1', 'hike-2', 'hike-3']);
    expect(list[1].distanceKm).toBe(99); // later in the list = the newer copy on a tie
  });

  it('keeps only the newest ones when there are too many', () => {
    const list = keepNewestHikes([saved(1), saved(2), saved(3), saved(4)], 2);
    expect(list.map((h) => h.id)).toEqual(['hike-3', 'hike-4']);
  });

  it('ignores junk, and keeps hikes that have no id', () => {
    const list = keepNewestHikes([null, 'x', saved(1), { distanceKm: 1 }, { distanceKm: 2 }]);
    expect(list).toHaveLength(3);
  });

  it('sorts newest first for display, without touching the list it was given', () => {
    const input = [saved(1), saved(3), saved(2)];
    expect(sortHikesNewest(input).map((h) => h.id)).toEqual(['hike-3', 'hike-2', 'hike-1']);
    expect(input.map((h) => h.id)).toEqual(['hike-1', 'hike-3', 'hike-2']);
    expect(sortHikesNewest(undefined)).toEqual([]);
  });

  it('reads a hike time from when it finished, then when it started', () => {
    expect(hikeTime({ completedAt: START })).toBe(Date.parse(START));
    expect(hikeTime({ startTime: START })).toBe(Date.parse(START));
    expect(hikeTime({})).toBe(0);
    expect(hikeTime(null)).toBe(0);
  });
});

describe('mergeHikes', () => {
  it('adds hikes that only exist on this phone to the ones from the server, oldest first', () => {
    const merged = mergeHikes([saved(1), saved(3)], [saved(2, { uid: 'u1' }), saved(3, { uid: 'u1' })]);
    expect(merged.map((h) => h.id)).toEqual(['hike-1', 'hike-2', 'hike-3']);
  });

  it('uses the server copy of a hike, but keeps a share that was only remembered here', () => {
    const merged = mergeHikes([saved(1, { distanceKm: 6 })], [saved(1, { distanceKm: 5, sharedPostId: 'p9' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].distanceKm).toBe(6);
    expect(merged[0].sharedPostId).toBe('p9');
  });

  it('does not let the phone undo a share the server already knows', () => {
    const merged = mergeHikes([saved(1, { sharedPostId: 'server' })], [saved(1, { sharedPostId: 'local' })]);
    expect(merged[0].sharedPostId).toBe('server');
  });

  it('copes with nothing on either side', () => {
    expect(mergeHikes(undefined, undefined)).toEqual([]);
    expect(mergeHikes([saved(1)], null)).toHaveLength(1);
    expect(mergeHikes(null, [saved(1)])).toHaveLength(1);
  });
});

describe('fitHikesToSize', () => {
  const withTrack = (n) => saved(n, { track: Array.from({ length: 400 }, (_, i) => 40 + i / 1000) });

  it('leaves a small list alone', () => {
    const list = [saved(1), saved(2)];
    expect(fitHikesToSize(list)).toEqual(list);
  });

  it('takes the route off the oldest hikes first', () => {
    const list = [withTrack(1), withTrack(2), withTrack(3)];
    const oneRoute = JSON.stringify(withTrack(3).track).length - 2; // what taking one route off saves
    const fitted = fitHikesToSize(list, JSON.stringify(list).length - oneRoute + 50);
    expect(fitted).toHaveLength(3);
    expect(fitted[0].track).toEqual([]);
    expect(fitted[1].track.length).toBeGreaterThan(0);
    expect(fitted[2].track.length).toBeGreaterThan(0);
  });

  it('then drops the oldest hikes, keeping at least the newest one', () => {
    const list = [withTrack(1), withTrack(2), withTrack(3)];
    const fitted = fitHikesToSize(list, 10);
    expect(fitted.map((h) => h.id)).toEqual(['hike-3']);
  });
});

describe('titles and details', () => {
  it('is named after the trail', () => {
    expect(hikeTitle({ trailName: 'Old Rag', startTime: START })).toBe('Old Rag');
  });

  it('is named after the time of day when there was no listed trail', () => {
    expect(hikeTitle({ trailName: 'Untitled hike', startTime: START })).toBe('Morning Hike');
    expect(hikeTitle({ startTime: new Date(2026, 9, 8, 13, 0).toISOString() })).toBe('Afternoon Hike');
    expect(hikeTitle({ startTime: new Date(2026, 9, 8, 18, 0).toISOString() })).toBe('Evening Hike');
    expect(hikeTitle({ startTime: new Date(2026, 9, 8, 23, 0).toISOString() })).toBe('Night Hike');
    expect(hikeTitle({ trailName: '  ' })).toBe('Free Hike');
    expect(hikeTitle(null)).toBe('Free Hike');
  });

  it('gives the route of a hike, empty for one saved before routes were kept', () => {
    const hike = buildSavedHike(tracked(), { now: NOW });
    expect(hikeRoute(hike)).toHaveLength(60);
    expect(hikeRoute(hike)[0]).toEqual({ latitude: 40, longitude: -74 });
    expect(hikeRoute({ distanceKm: 3 })).toEqual([]);
    expect(hikeRoute(null)).toEqual([]);
  });

  it('describes a hike for the screens', () => {
    const info = describeHike({ ...buildSavedHike(tracked(), { now: NOW }), sharedPostId: 'p1' });
    expect(info).toMatchObject({
      id: `hike-${NOW}`,
      title: 'Old Rag',
      pathName: 'Ridge Trail',
      when: 'Thu, Oct 8 • 7:05 AM',
      distanceText: '14.24',
      timeText: '4:15:00',
      paceText: '17:54',
      calories: 2211,
      climb: 812,
      descent: 805,
      tier: 'Strenuous',
      score: 170.3,
      xp: 1250,
      hasRoute: true,
      shared: true,
    });
    expect(info.points).toHaveLength(60);
  });

  it('describes an older hike that has no route, start time or descent', () => {
    const info = describeHike({
      id: 'hike-1', completedAt: START, trailName: 'Untitled hike', distanceKm: 4, durationSeconds: 3600,
      elevationGainM: 120, difficultyTier: 'Easy', calories: 300,
    });
    expect(info.title).toBe('Morning Hike');
    expect(info.when).toBe('Thu, Oct 8 • 7:05 AM');
    expect(info.hasRoute).toBe(false);
    expect(info.points).toEqual([]);
    expect(info.descent).toBe(0);
    expect(info.paceText).toBe('15:00');
    expect(info.shared).toBe(false);
  });

  it('shows no pace when there is nothing to work it out from', () => {
    expect(describeHike({ id: 1, distanceKm: 0, durationSeconds: 0 }).paceText).toBe('--');
  });

  it('is null for something that is not a hike', () => {
    expect(describeHike(null)).toBeNull();
    expect(describeHike('x')).toBeNull();
  });
});

describe('summarizeHikes', () => {
  it('adds up the hikes', () => {
    expect(summarizeHikes([
      { distanceKm: 5.5, durationSeconds: 3600, elevationGainM: 200 },
      { distanceKm: 10, durationSeconds: 7200, elevationGainM: 450 },
      null,
    ])).toEqual({ count: 2, distanceKm: 15.5, durationSeconds: 10800, climbM: 650 });
  });

  it('is all zero for no hikes', () => {
    expect(summarizeHikes(undefined)).toEqual({ count: 0, distanceKm: 0, durationSeconds: 0, climbM: 0 });
  });
});

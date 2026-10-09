import { hikeCaption, buildHikePost } from '../lib/hikeShare';
import { describeSharedRun, SHARE_HIDE_ENDS_M, SHARE_MAX_POINTS } from '../lib/runShare';
import { buildSavedHike } from '../lib/hikeLog';
import { distanceM } from '../lib/gpsFilter';

const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();
const NOW = new Date(2026, 9, 8, 11, 20, 0).getTime();
const north = (count, step = 0.001) => Array.from({ length: count }, (_, i) => ({ latitude: 40 + i * step, longitude: -74 }));

// A saved hike with a 6.6 km route (60 points, about 111 m apart).
const hike = (extra = {}) => ({
  ...buildSavedHike({
    trailId: 'trailapi-7', trailName: 'Old Rag', distanceKm: 6.6, elevationGainM: 412, durationSeconds: 9000,
    difficultyTier: 'Moderate', difficultyScore: 74.5, calories: 880, xpEarned: 300, startTime: START, coords: north(60),
  }, { now: NOW, uid: 'u1' }),
  ...extra,
});

describe('buildHikePost', () => {
  it('builds a hike card with the numbers, the difficulty and a route', () => {
    const post = buildHikePost(hike());
    expect(post.run).toMatchObject({
      v: 1, activity: 'hike', title: 'Old Rag', distance: 6.6, duration: 9000, pace: 1364,
      startTime: START, calories: 880, elevGain: 412, tier: 'Moderate',
    });
    expect(post.run.route.length).toBeGreaterThan(0);
    expect(post.run.route.length % 2).toBe(0);
    expect(post.run.route.length / 2).toBeLessThanOrEqual(SHARE_MAX_POINTS);
  });

  it('hides the start and the finish of the route', () => {
    const { run } = buildHikePost(hike());
    const start = { latitude: 40, longitude: -74 };
    const finish = { latitude: 40 + 59 * 0.001, longitude: -74 };
    const shown = [];
    for (let i = 0; i + 1 < run.route.length; i += 2) shown.push({ latitude: run.route[i], longitude: run.route[i + 1] });
    expect(distanceM(start, shown[0])).toBeGreaterThanOrEqual(SHARE_HIDE_ENDS_M - 1);
    expect(distanceM(finish, shown[shown.length - 1])).toBeGreaterThanOrEqual(SHARE_HIDE_ENDS_M - 1);
  });

  it('leaves the route out, but still shares the numbers, when too little is left to show', () => {
    const post = buildHikePost(hike({ track: [], coords: undefined }));
    expect(post.run.route).toEqual([]);
    expect(post.run.distance).toBe(6.6);
    const short = buildHikePost({ ...hike(), track: [40, -74, 40.001, -74, 40.002, -74] });
    expect(short.run.route).toEqual([]);
  });

  it('is named after the time of day when the hike was not on a listed trail', () => {
    expect(buildHikePost(hike({ trailName: 'Untitled hike' })).run.title).toBe('Morning Hike');
  });

  it('cuts a very long trail name to the 40 characters the card shows', () => {
    const name = 'The Very Long Winding Way Up To The Summit Of Mount Somewhere Grand';
    expect(buildHikePost(hike({ trailName: name })).run.title).toBe(name.slice(0, 40));
  });

  it('leaves out calories, climb and difficulty when there are none', () => {
    const { run } = buildHikePost(hike({ calories: 0, elevationGainM: 0, difficultyTier: '' }));
    expect('calories' in run).toBe(false);
    expect('elevGain' in run).toBe(false);
    expect('tier' in run).toBe(false);
  });

  it('is null when there is nothing worth sharing', () => {
    expect(buildHikePost(null)).toBeNull();
    expect(buildHikePost('x')).toBeNull();
    expect(buildHikePost(hike({ distanceKm: 0 }))).toBeNull();
    expect(buildHikePost(hike({ durationSeconds: 0 }))).toBeNull();
  });

  it('never contains undefined, which Firestore refuses', () => {
    const { run } = buildHikePost(hike());
    expect(Object.values(run).every((v) => v !== undefined)).toBe(true);
  });

  it('writes a caption with the name, distance, time and a hiking boot', () => {
    const post = buildHikePost(hike());
    expect(post.text).toBe('Old Rag: 6.60 km in 2:30:00 \uD83E\uDD7E');
    expect(hikeCaption({})).toBe('Hike: 0.00 km in 0:00 \uD83E\uDD7E');
  });
});

describe('the feed card for a hike', () => {
  it('is read back as a hike, with its difficulty', () => {
    const card = describeSharedRun(buildHikePost(hike()).run);
    expect(card).toMatchObject({
      activity: 'hike', title: 'Old Rag', distanceText: '6.60', timeText: '2:30:00', paceText: '22:44',
      climb: 412, tier: 'Moderate', hasRoute: true,
    });
  });

  it('is called "Hike" when it has no title', () => {
    const run = { ...buildHikePost(hike()).run, title: '' };
    expect(describeSharedRun(run).title).toBe('Hike');
  });

  it('only shows a difficulty on a hike, and cuts a long one short', () => {
    const base = buildHikePost(hike()).run;
    expect(describeSharedRun({ ...base, activity: 'run' }).tier).toBeUndefined();
    expect('tier' in describeSharedRun({ ...base, activity: 'walk' })).toBe(false);
    expect(describeSharedRun({ ...base, tier: 'Very Strenuous And Then Some More' }).tier).toHaveLength(20);
    expect('tier' in describeSharedRun({ ...base, tier: '   ' })).toBe(false);
    expect('tier' in describeSharedRun({ ...base, tier: 7 })).toBe(false);
  });
});

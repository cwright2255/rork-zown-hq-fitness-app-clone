import {
  SHARE_HIDE_ENDS_M, SHARE_MIN_SHOWN_M, SHARE_MAX_POINTS, RUN_POST_VERSION,
  routeLengthM, hideRouteEnds, runCaption, buildRunPost, describeSharedRun,
} from '../lib/runShare';
import { distanceM } from '../lib/gpsFilter';

// 7:05 in the morning on Thu 8 Oct 2026, in the phone's own time zone (titles use local time).
const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();

// A route going straight north from (40, -74): one point every 0.001 degrees, about 111 m apart.
const north = (count, step = 0.001) => Array.from({ length: count }, (_, i) => ({ latitude: 40 + i * step, longitude: -74 }));
// The same, as the flat [lat, lng, ...] list a saved run keeps.
const flat = (points) => points.reduce((all, p) => all.concat([p.latitude, p.longitude]), []);

const savedRun = (extra = {}) => ({
  id: 'run-1',
  uid: 'u1',
  startTime: START,
  endTime: new Date(2026, 9, 8, 7, 31, 50).toISOString(),
  distance: 5.234,
  duration: 1610,
  pace: 308,
  calories: 366,
  track: flat(north(41)), // about 4.4 km
  elevGain: 42,
  elevLoss: 38,
  ...extra,
});

describe('the numbers it uses', () => {
  it('hides 200 m at each end, and needs 300 m of route left to show one', () => {
    expect(SHARE_HIDE_ENDS_M).toBe(200);
    expect(SHARE_MIN_SHOWN_M).toBe(300);
    expect(SHARE_MAX_POINTS).toBe(100);
    expect(RUN_POST_VERSION).toBe(1);
  });
});

describe('routeLengthM', () => {
  it('adds up the legs', () => {
    expect(routeLengthM(north(11))).toBeGreaterThan(1100);
    expect(routeLengthM(north(11))).toBeLessThan(1120);
  });

  it('is 0 for nothing, one point, or junk', () => {
    expect(routeLengthM(undefined)).toBe(0);
    expect(routeLengthM([])).toBe(0);
    expect(routeLengthM(north(1))).toBe(0);
    expect(routeLengthM([{ latitude: NaN, longitude: 1 }, { latitude: 'x' }])).toBe(0);
  });
});

describe('hideRouteEnds', () => {
  it('cuts the first and last 200 m off a route', () => {
    const kept = hideRouteEnds(north(21)); // 2.2 km
    expect(kept).toHaveLength(17);
    expect(kept[0].latitude).toBeCloseTo(40.002, 5);
    expect(kept[kept.length - 1].latitude).toBeCloseTo(40.018, 5);
  });

  it('leaves no point within 200 m of where the run began or ended', () => {
    const all = north(21);
    const kept = hideRouteEnds(all);
    kept.forEach((p) => {
      expect(distanceM(all[0], p)).toBeGreaterThanOrEqual(200);
      expect(distanceM(all[all.length - 1], p)).toBeGreaterThanOrEqual(200);
    });
  });

  it('hides the ends of an out-and-back that finishes where it started', () => {
    // Out 1.1 km and back again: the finish is the start, so both ends are the same doorstep.
    const out = north(11);
    const route = out.concat(out.slice(0, -1).reverse());
    const kept = hideRouteEnds(route);
    expect(kept.length).toBeGreaterThan(0);
    kept.forEach((p) => expect(distanceM(route[0], p)).toBeGreaterThanOrEqual(200));
    expect(kept).toContainEqual(out[out.length - 1]); // the turning point is still shown
  });

  it('shows nothing for a route that is mostly the hidden ends', () => {
    expect(hideRouteEnds(north(6))).toEqual([]); // 550 m: 111 m left after hiding
    expect(hideRouteEnds(north(2))).toEqual([]);
  });

  it('shows nothing when what is left is under 300 m, and something when it is more', () => {
    expect(hideRouteEnds(north(21, 0.0003))).toEqual([]); // 667 m long, 267 m left after hiding
    expect(hideRouteEnds(north(25, 0.0003))).toHaveLength(13); // 800 m long, 400 m left
  });

  it('returns nothing for no route or junk', () => {
    expect(hideRouteEnds(undefined)).toEqual([]);
    expect(hideRouteEnds([])).toEqual([]);
    expect(hideRouteEnds([{ latitude: 40, longitude: -74 }])).toEqual([]);
    expect(hideRouteEnds('route')).toEqual([]);
  });

  it('ignores points that are not real places', () => {
    const route = north(21).concat([{ latitude: NaN, longitude: 0 }, { latitude: 120, longitude: 0 }, null]);
    expect(hideRouteEnds(route)).toHaveLength(17);
  });

  it('keeps the whole route when told to hide nothing', () => {
    expect(hideRouteEnds(north(21), 0)).toHaveLength(21);
    expect(hideRouteEnds(north(2), 0)).toEqual([]); // still not worth showing
  });
});

describe('runCaption', () => {
  it('says what the run was', () => {
    expect(runCaption({ title: 'Morning Run', distance: 5.234, duration: 1610 })).toBe('Morning Run: 5.23 km in 26:50 \uD83D\uDCAA');
  });

  it('falls back to the activity when there is no title', () => {
    expect(runCaption({ distance: 3, duration: 2400 })).toBe('Run: 3.00 km in 40:00 \uD83D\uDCAA');
    expect(runCaption({ activity: 'walk', distance: 3, duration: 2400 })).toBe('Walk: 3.00 km in 40:00 \uD83D\uDCAA');
  });

  it('copes with nothing at all', () => {
    expect(runCaption(undefined)).toBe('Run: 0.00 km in 0:00 \uD83D\uDCAA');
  });
});

describe('buildRunPost', () => {
  it('builds the post for a saved run', () => {
    const post = buildRunPost(savedRun());
    expect(post.run).toMatchObject({
      v: 1, activity: 'run', title: 'Morning Run', distance: 5.23, duration: 1610, pace: 308,
      startTime: START, calories: 366, elevGain: 42,
    });
    expect(post.text).toBe('Morning Run: 5.23 km in 26:50 \uD83D\uDCAA');
  });

  it('shares a walk as a walk', () => {
    const post = buildRunPost(savedRun({ activity: 'walk', distance: 3, duration: 2400 }));
    expect(post.run.activity).toBe('walk');
    expect(post.run.title).toBe('Morning Walk');
    expect(post.text).toBe('Morning Walk: 3.00 km in 40:00 \uD83D\uDCAA');
  });

  it('works the pace out from the distance and time', () => {
    expect(buildRunPost(savedRun({ distance: 5, duration: 1500, pace: 999 })).run.pace).toBe(300);
  });

  it('puts only the middle of the route in the post, as a flat list', () => {
    const { run } = buildRunPost(savedRun());
    expect(run.route.length % 2).toBe(0);
    expect(run.route.length).toBeGreaterThan(0);
    const points = [];
    for (let i = 0; i < run.route.length; i += 2) points.push({ latitude: run.route[i], longitude: run.route[i + 1] });
    const all = north(41);
    points.forEach((p) => {
      expect(distanceM(all[0], p)).toBeGreaterThanOrEqual(199); // the saved route rounds to 5 decimals
      expect(distanceM(all[all.length - 1], p)).toBeGreaterThanOrEqual(199);
    });
  });

  it('never shares the exact start or finish', () => {
    const { run } = buildRunPost(savedRun());
    expect(run.route.slice(0, 2)).not.toEqual([40, -74]);
    expect(run.route.slice(-2)).not.toEqual([40.04, -74]);
  });

  it('keeps the post light: at most 100 route points', () => {
    const long = north(200, 0.0002); // a saved route is at most 200 points
    const { run } = buildRunPost(savedRun({ track: flat(long) }));
    expect(run.route.length).toBeLessThanOrEqual(SHARE_MAX_POINTS * 2);
    expect(run.route.length).toBeGreaterThan(20);
  });

  it('shares the stats with no route when the route is too short to show', () => {
    const { run } = buildRunPost(savedRun({ track: flat(north(6)) }));
    expect(run.route).toEqual([]);
    expect(run.distance).toBe(5.23);
  });

  it('shares a run that has no route at all', () => {
    const { run, text } = buildRunPost(savedRun({ track: undefined }));
    expect(run.route).toEqual([]);
    expect(text).toContain('5.23 km');
  });

  it('reads the older route shape (coords) too', () => {
    const { run } = buildRunPost(savedRun({ track: undefined, coords: north(41) }));
    expect(run.route.length).toBeGreaterThan(0);
  });

  it('leaves out what the run does not have, and never has an undefined in it', () => {
    const { run } = buildRunPost({ distance: 2, duration: 700 });
    expect(Object.keys(run).sort()).toEqual(['activity', 'distance', 'duration', 'pace', 'route', 'title', 'v']);
    expect(Object.values(run).every((v) => v !== undefined)).toBe(true);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  it('does not carry the account, the run id or the old post id along', () => {
    const { run } = buildRunPost(savedRun({ sharedPostId: 'old-post' }));
    expect(run).not.toHaveProperty('id');
    expect(run).not.toHaveProperty('uid');
    expect(run).not.toHaveProperty('sharedPostId');
    expect(run).not.toHaveProperty('track');
    expect(run).not.toHaveProperty('splits');
  });

  it('shares nothing for a run with no distance or no time', () => {
    expect(buildRunPost(savedRun({ distance: 0 }))).toBeNull();
    expect(buildRunPost(savedRun({ distance: 0.004 }))).toBeNull();
    expect(buildRunPost(savedRun({ duration: 0 }))).toBeNull();
    expect(buildRunPost(savedRun({ distance: 'far', duration: 'long' }))).toBeNull();
    expect(buildRunPost(null)).toBeNull();
    expect(buildRunPost('run')).toBeNull();
    expect(buildRunPost(undefined)).toBeNull();
  });

  it('survives being read back by the feed card', () => {
    const { run } = buildRunPost(savedRun());
    const card = describeSharedRun(run);
    expect(card.title).toBe('Morning Run');
    expect(card.distanceText).toBe('5.23');
    expect(card.timeText).toBe('26:50');
    expect(card.hasRoute).toBe(true);
  });
});

describe('describeSharedRun', () => {
  const shared = (extra = {}) => ({
    v: 1, activity: 'run', title: 'Morning Run', distance: 5.23, duration: 1610, pace: 308,
    route: [40.002, -74, 40.01, -74, 40.018, -74], elevGain: 42, ...extra,
  });

  it('gives the card its text and route', () => {
    expect(describeSharedRun(shared())).toEqual({
      activity: 'run',
      title: 'Morning Run',
      distanceText: '5.23',
      timeText: '26:50',
      paceText: '5:08',
      climb: 42,
      points: [
        { latitude: 40.002, longitude: -74 },
        { latitude: 40.01, longitude: -74 },
        { latitude: 40.018, longitude: -74 },
      ],
      hasRoute: true,
    });
  });

  it('knows a walk', () => {
    expect(describeSharedRun(shared({ activity: 'walk' })).activity).toBe('walk');
    expect(describeSharedRun(shared({ activity: 'swim' })).activity).toBe('run');
  });

  it('shows hours when it takes that long', () => {
    expect(describeSharedRun(shared({ distance: 21.1, duration: 7500 })).timeText).toBe('2:05:00');
  });

  it('works the pace out when the post has none', () => {
    expect(describeSharedRun(shared({ pace: undefined, distance: 5, duration: 1500 })).paceText).toBe('5:00');
    expect(describeSharedRun(shared({ pace: 'fast', distance: 5, duration: 1500 })).paceText).toBe('5:00');
  });

  it('has no route when the post has none', () => {
    const card = describeSharedRun(shared({ route: [] }));
    expect(card.points).toEqual([]);
    expect(card.hasRoute).toBe(false);
    expect(describeSharedRun(shared({ route: undefined })).hasRoute).toBe(false);
    expect(describeSharedRun(shared({ route: 'none' })).hasRoute).toBe(false);
  });

  it('drops points that are not real places, and a half pair at the end', () => {
    const card = describeSharedRun(shared({ route: [40, -74, 'x', 3, 95, 10, 40.1, -74, 40.2] }));
    expect(card.points).toEqual([{ latitude: 40, longitude: -74 }, { latitude: 40.1, longitude: -74 }]);
  });

  it('reads no more than 100 route points, whatever the post says', () => {
    const route = flat(north(500));
    expect(describeSharedRun(shared({ route })).points).toHaveLength(SHARE_MAX_POINTS);
  });

  it('gives the activity name when the title is missing or blank, and trims a long one', () => {
    expect(describeSharedRun(shared({ title: undefined })).title).toBe('Run');
    expect(describeSharedRun(shared({ title: '   ', activity: 'walk' })).title).toBe('Walk');
    expect(describeSharedRun(shared({ title: 42 })).title).toBe('Run');
    expect(describeSharedRun(shared({ title: `  ${'x'.repeat(80)}  ` })).title).toHaveLength(40);
  });

  it('shows a climb only when there is one', () => {
    expect(describeSharedRun(shared({ elevGain: 0 })).climb).toBe(0);
    expect(describeSharedRun(shared({ elevGain: undefined })).climb).toBe(0);
    expect(describeSharedRun(shared({ elevGain: 41.6 })).climb).toBe(42);
  });

  it('trusts nothing: anything that is not a usable run gives null', () => {
    expect(describeSharedRun(undefined)).toBeNull();
    expect(describeSharedRun(null)).toBeNull();
    expect(describeSharedRun('run')).toBeNull();
    expect(describeSharedRun(12)).toBeNull();
    expect(describeSharedRun({})).toBeNull();
    expect(describeSharedRun(shared({ distance: 0 }))).toBeNull();
    expect(describeSharedRun(shared({ distance: -3 }))).toBeNull();
    expect(describeSharedRun(shared({ duration: 0 }))).toBeNull();
    expect(describeSharedRun(shared({ distance: '5.2' }))).toBeNull();
    expect(describeSharedRun(shared({ duration: NaN }))).toBeNull();
    expect(describeSharedRun(shared({ distance: Infinity }))).toBeNull();
  });
});

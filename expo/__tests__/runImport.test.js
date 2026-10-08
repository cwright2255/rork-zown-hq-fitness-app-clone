import {
  IMPORT_RANGES, DEFAULT_RANGE, MIN_IMPORT_SECONDS, HK_RUNNING, HK_WALKING,
  rangeStartMs, importedRunId, sourceLabel, quantityToMeters, quantityToSeconds, quantityToKcal,
  fromHealthKitRoutes, fromHealthKitWorkout, analyzeRoute, buildImportedRun, sameOuting, planImport, describeImport,
} from '../lib/runImport';
import { distanceM } from '../lib/gpsFilter';

const T0 = Date.UTC(2026, 9, 7, 11, 0, 0);
const DAY = 86400000;

// Metres east of a start line at 40.7 N, as a longitude.
const lngAt = (metres) => -74 + metres / (111194.93 * Math.cos((40.7 * Math.PI) / 180));

// A steady route: one point per second at `mps` metres per second for `seconds`.
const steady = (seconds, mps, extra = () => ({}), startMs = T0) => Array.from({ length: seconds + 1 }, (_, i) => ({
  latitude: 40.7, longitude: lngAt(i * mps), altitude: 20, horizontalAccuracy: 5, verticalAccuracy: 3,
  timeMs: startMs + i * 1000, ...extra(i),
}));

const workout = (extra = {}) => ({
  source: 'apple-health', nativeId: 'ABC-1', activity: 'run',
  startMs: T0, endMs: T0 + 625000, durationSec: 625, distanceM: 2500, energyKcal: 180,
  locations: steady(625, 4), ...extra,
});

describe('ranges and ids', () => {
  it('offers 30 days, 90 days and a year, defaulting to 90 days', () => {
    expect(IMPORT_RANGES.map((r) => r.id)).toEqual(['30d', '90d', '1y']);
    expect(DEFAULT_RANGE).toBe('90d');
  });

  it('works out where each range starts', () => {
    expect(rangeStartMs('30d', T0)).toBe(T0 - 30 * DAY);
    expect(rangeStartMs('1y', T0)).toBe(T0 - 365 * DAY);
    expect(rangeStartMs('nonsense', T0)).toBe(T0 - 90 * DAY);
  });

  it('gives an imported run the same id every time', () => {
    expect(importedRunId('apple-health', 'ABC-1')).toBe('hk-ABC-1');
    expect(importedRunId('apple-health', 'ABC-1')).toBe(importedRunId('apple-health', 'ABC-1'));
  });

  it('names where a run came from, and nothing for one recorded in Zown', () => {
    expect(sourceLabel({ source: 'apple-health' })).toBe('Apple Health');
    expect(sourceLabel({ id: '1' })).toBe('');
    expect(sourceLabel({ source: 'something-else' })).toBe('');
    expect(sourceLabel(null)).toBe('');
  });
});

describe('units from Apple Health', () => {
  it('reads metres, seconds and kilocalories', () => {
    expect(quantityToMeters({ unit: 'meters', quantity: 5000 })).toBe(5000);
    expect(quantityToMeters({ unit: 'm', quantity: 12.5 })).toBe(12.5);
    expect(quantityToSeconds({ unit: 's', quantity: 1530 })).toBe(1530);
    expect(quantityToKcal({ unit: 'kcal', quantity: 410 })).toBe(410);
  });

  it('converts the other units it could be given', () => {
    expect(quantityToMeters({ unit: 'km', quantity: 5 })).toBe(5000);
    expect(quantityToMeters({ unit: 'mi', quantity: 1 })).toBeCloseTo(1609.344, 3);
    expect(quantityToSeconds({ unit: 'min', quantity: 25 })).toBe(1500);
    expect(quantityToSeconds({ unit: 'hr', quantity: 1 })).toBe(3600);
    expect(quantityToKcal({ unit: 'kJ', quantity: 4.184 })).toBeCloseTo(1, 6);
  });

  it('gives 0 for a unit it does not know instead of guessing', () => {
    expect(quantityToMeters({ unit: 'parsecs', quantity: 3 })).toBe(0);
    expect(quantityToMeters(undefined)).toBe(0);
    expect(quantityToSeconds({ unit: 's', quantity: NaN })).toBe(0);
  });
});

describe('reading what HealthKit hands over', () => {
  it('flattens the routes of a workout into points with times in ms', () => {
    const date = new Date(T0 + 5000);
    const pts = fromHealthKitRoutes([
      { locations: [{ latitude: 1, longitude: 2, altitude: 3, horizontalAccuracy: 4, verticalAccuracy: 5, date }] },
      { locations: [{ latitude: 6, longitude: 7, altitude: 8, horizontalAccuracy: 9, verticalAccuracy: 10, date }] },
    ]);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ latitude: 1, longitude: 2, altitude: 3, horizontalAccuracy: 4, verticalAccuracy: 5, timeMs: T0 + 5000 });
    expect(fromHealthKitRoutes(undefined)).toEqual([]);
    expect(fromHealthKitRoutes([null, { locations: null }])).toEqual([]);
  });

  it('turns a HealthKit workout into the plain shape', () => {
    const w = fromHealthKitWorkout({
      uuid: 'U-1', workoutActivityType: HK_WALKING, startDate: new Date(T0), endDate: new Date(T0 + 1800000),
      duration: { unit: 's', quantity: 1700 }, totalDistance: { unit: 'meters', quantity: 2400 }, totalEnergyBurned: { unit: 'kcal', quantity: 120 },
    }, []);
    expect(w).toMatchObject({
      source: 'apple-health', nativeId: 'U-1', activity: 'walk', startMs: T0, endMs: T0 + 1800000,
      durationSec: 1700, distanceM: 2400, energyKcal: 120, locations: [],
    });
    expect(fromHealthKitWorkout({ uuid: 'U-2', workoutActivityType: HK_RUNNING, startDate: new Date(T0), endDate: new Date(T0 + 1000) }).activity).toBe('run');
    expect(fromHealthKitWorkout(null)).toBeNull();
  });
});

describe('analyzeRoute', () => {
  it('measures distance and moving time, and gives a split for each full kilometre', () => {
    const r = analyzeRoute(steady(625, 4), { reportedKm: 2.5, durationSec: 625 });
    expect(r.routeKm).toBeCloseTo(2.5, 2);
    expect(r.movingSec).toBeCloseTo(625, 3);
    expect(r.splits).toHaveLength(2);
    expect(r.splits[0]).toBe(250);
    expect(r.splits[1]).toBe(250);
  });

  it('stretches the route to the distance the workout reports, so the splits add up', () => {
    // The watch says 2.6 km although the route measures 2.5 km: each km takes a little less.
    const r = analyzeRoute(steady(625, 4), { reportedKm: 2.6, durationSec: 625 });
    expect(r.splits).toHaveLength(2);
    expect(r.splits[0]).toBeCloseTo(240.4, 0);
  });

  it('stretches time to the duration the workout reports', () => {
    const r = analyzeRoute(steady(625, 4), { reportedKm: 2.5, durationSec: 650 });
    expect(r.splits[0]).toBeCloseTo(260, 0);
  });

  it('leaves splits out when the route does not agree with the workout', () => {
    expect(analyzeRoute(steady(625, 4), { reportedKm: 4, durationSec: 625 }).splits).toEqual([]);
    expect(analyzeRoute(steady(625, 4), { reportedKm: 2.5, durationSec: 1200 }).splits).toEqual([]);
  });

  it('does not count a long pause as moving time', () => {
    const route = [
      ...steady(300, 4),
      // stood still for two minutes, then carried on
      ...steady(300, 4, () => ({}), T0 + 420000).map((p, i) => ({ ...p, longitude: lngAt(1200 + i * 4) })),
    ];
    const r = analyzeRoute(route, { reportedKm: 2.4, durationSec: 600 });
    expect(r.movingSec).toBeCloseTo(600, 0);
  });

  it('ignores a GPS jump', () => {
    const route = steady(300, 4);
    route[100] = { ...route[100], longitude: lngAt(5000) }; // 5 km away for one second
    const r = analyzeRoute(route, { reportedKm: 1.2, durationSec: 300 });
    expect(r.routeKm).toBeCloseTo(1.2, 1);
  });

  it('ignores points with bad accuracy', () => {
    const route = steady(100, 4, (i) => (i === 50 ? { horizontalAccuracy: 300, longitude: lngAt(9000) } : {}));
    const r = analyzeRoute(route, {});
    expect(r.points).toHaveLength(100);
    expect(r.routeKm).toBeCloseTo(0.4, 1);
  });

  it('puts points in time order', () => {
    const route = steady(100, 4).reverse();
    expect(analyzeRoute(route, {}).routeKm).toBeCloseTo(0.4, 2);
  });

  it('adds up the climb and the descent', () => {
    const up = analyzeRoute(steady(600, 3, (i) => ({ altitude: 20 + i * 0.1 })), {});
    expect(up.hasAltitude).toBe(true);
    expect(up.elevGain).toBeGreaterThan(40);
    expect(up.elevGain).toBeLessThan(62);
    expect(up.elevLoss).toBeLessThan(2);
    const down = analyzeRoute(steady(600, 3, (i) => ({ altitude: 200 - i * 0.1 })), {});
    expect(down.elevLoss).toBeGreaterThan(40);
    expect(down.elevGain).toBeLessThan(2);
  });

  it('knows when a route has no usable heights', () => {
    const r = analyzeRoute(steady(100, 4, () => ({ altitude: 20, verticalAccuracy: -1 })), {});
    expect(r.hasAltitude).toBe(false);
  });

  it('copes with nothing', () => {
    for (const input of [undefined, [], [{}], [{ latitude: 1, longitude: 1, timeMs: 5 }]]) {
      const r = analyzeRoute(input, { reportedKm: 3, durationSec: 900 });
      expect(r.splits).toEqual([]);
      expect(r.routeKm).toBe(0);
    }
  });

  it('sanity check of the test route itself', () => {
    const pts = steady(10, 4);
    expect(distanceM(pts[0], pts[10])).toBeCloseTo(40, 0);
  });
});

describe('buildImportedRun', () => {
  it('builds the saved record from a workout with a route', () => {
    const run = buildImportedRun(workout(), { uid: 'u1' });
    expect(run).toMatchObject({
      id: 'hk-ABC-1', uid: 'u1', source: 'apple-health', distance: 2.5, duration: 625, pace: 250, calories: 180,
    });
    expect(run.startTime).toBe(new Date(T0).toISOString());
    expect(run.endTime).toBe(new Date(T0 + 625000).toISOString());
    expect(run.splits).toEqual([250, 250]);
    expect(run.track.length).toBeGreaterThanOrEqual(4);
    expect(run.track.length).toBeLessThanOrEqual(400);
    expect(run.elevGain).toBe(0);
    expect(run.elevLoss).toBe(0);
    expect('activity' in run).toBe(false);
  });

  it('marks a walk as a walk', () => {
    expect(buildImportedRun(workout({ activity: 'walk' })).activity).toBe('walk');
  });

  it('uses the workout distance as the headline, not the route', () => {
    expect(buildImportedRun(workout({ distanceM: 2600 })).distance).toBe(2.6);
  });

  it('imports an indoor run that has distance but no route', () => {
    const run = buildImportedRun(workout({ locations: [], energyKcal: 0 }));
    expect(run.distance).toBe(2.5);
    expect(run.track).toEqual([]);
    expect('splits' in run).toBe(false);
    expect('elevGain' in run).toBe(false);
    expect(run.calories).toBe(175); // 70 per km when Health gave no figure
  });

  it('falls back to the route for distance when the workout has none', () => {
    const run = buildImportedRun(workout({ distanceM: 0 }));
    expect(run.distance).toBeCloseTo(2.5, 2);
  });

  it('works out the duration from the times when Health gave none', () => {
    expect(buildImportedRun(workout({ durationSec: 0 })).duration).toBe(625);
  });

  it('leaves out a stray tap: under a minute, or under 100 m', () => {
    expect(buildImportedRun(workout({ durationSec: MIN_IMPORT_SECONDS - 1, endMs: T0 + 59000, locations: [] }))).toBeNull();
    expect(buildImportedRun(workout({ distanceM: 50, locations: [] }))).toBeNull();
  });

  it('refuses a workout it can not make sense of', () => {
    expect(buildImportedRun(null)).toBeNull();
    expect(buildImportedRun(workout({ nativeId: '' }))).toBeNull();
    expect(buildImportedRun(workout({ startMs: 0 }))).toBeNull();
    expect(buildImportedRun(workout({ endMs: T0 }))).toBeNull();
  });

  it('never contains anything Firestore would refuse', () => {
    const run = buildImportedRun(workout({ energyKcal: undefined }), { uid: 'u1' });
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
    Object.values(run).forEach((v) => expect(v).not.toBeUndefined());
  });

  it('leaves the uid off when there is none', () => {
    expect('uid' in buildImportedRun(workout())).toBe(false);
  });
});

describe('sameOuting', () => {
  const at = (startMin, endMin) => ({ startTime: new Date(T0 + startMin * 60000).toISOString(), endTime: new Date(T0 + endMin * 60000).toISOString() });

  it('sees the same stretch of time', () => {
    expect(sameOuting(at(0, 30), at(1, 29))).toBe(true);
    expect(sameOuting(at(0, 30), at(10, 50))).toBe(true); // 20 of the shorter 30 minutes
  });

  it('keeps apart outings that only touch', () => {
    expect(sameOuting(at(0, 30), at(30, 60))).toBe(false);
    expect(sameOuting(at(0, 30), at(25, 60))).toBe(false);
    expect(sameOuting(at(0, 30), at(120, 150))).toBe(false);
  });

  it('is not fooled by missing times', () => {
    expect(sameOuting({}, at(0, 30))).toBe(false);
    expect(sameOuting(at(10, 5), at(0, 30))).toBe(false);
  });
});

describe('planImport', () => {
  const imp = (id, startMin, endMin, extra = {}) => ({
    id, source: 'apple-health', distance: 5, duration: 1500,
    startTime: new Date(T0 + startMin * 60000).toISOString(), endTime: new Date(T0 + endMin * 60000).toISOString(),
    track: [], ...extra,
  });

  it('adds new runs, newest first', () => {
    const plan = planImport([imp('hk-a', 0, 30), imp('hk-b', 600, 630)], []);
    expect(plan.add.map((r) => r.id)).toEqual(['hk-b', 'hk-a']);
    expect(plan.alreadyThere).toBe(0);
    expect(plan.overlapping).toBe(0);
  });

  it('skips a run that is already there, so importing twice changes nothing', () => {
    const plan = planImport([imp('hk-a', 0, 30)], [imp('hk-a', 0, 30)]);
    expect(plan.add).toEqual([]);
    expect(plan.alreadyThere).toBe(1);
  });

  it('skips a workout that is the same outing as a run recorded in Zown', () => {
    const zown = { id: '1', startTime: new Date(T0 + 60000).toISOString(), endTime: new Date(T0 + 31 * 60000).toISOString(), distance: 5, duration: 1500 };
    const plan = planImport([imp('hk-a', 0, 30)], [zown]);
    expect(plan.add).toEqual([]);
    expect(plan.overlapping).toBe(1);
  });

  it('keeps the richer one of two imported copies of the same outing', () => {
    const plain = imp('hk-plain', 0, 30);
    const rich = imp('hk-rich', 0, 30, { track: [1, 2, 3, 4], splits: [300], elevGain: 3 });
    const plan = planImport([plain, rich], []);
    expect(plan.add.map((r) => r.id)).toEqual(['hk-rich']);
    expect(plan.overlapping).toBe(1);
  });

  it('copes with junk', () => {
    expect(planImport(undefined, undefined)).toEqual({ add: [], alreadyThere: 0, overlapping: 0 });
    expect(planImport([null, imp('hk-a', 0, 30)], [null]).add).toHaveLength(1);
  });
});

describe('describeImport', () => {
  const run = { id: 'r', distance: 5 };
  const walk = { id: 'w', distance: 2, activity: 'walk' };

  it('says what came in', () => {
    expect(describeImport({ added: [run], found: 1 }).headline).toBe('Imported 1 run');
    expect(describeImport({ added: [run, run, walk], found: 3 }).headline).toBe('Imported 2 runs and 1 walk');
    expect(describeImport({ added: [walk, walk], found: 2 }).headline).toBe('Imported 2 walks');
  });

  it('says so when there was nothing', () => {
    expect(describeImport({ found: 0 }).headline).toBe('No runs or walks found');
    expect(describeImport({ found: 4, alreadyThere: 4 }).headline).toBe('Nothing new to import');
  });

  it('explains what was left out', () => {
    const d = describeImport({ added: [run], alreadyThere: 3, overlapping: 2, dropped: 1, found: 7 });
    expect(d.lines).toEqual([
      '3 already in Zown',
      '2 overlapped an outing that was already saved, so they were skipped',
      '1 older one did not fit in your history of 100 runs',
    ]);
    expect(describeImport({ overlapping: 1, found: 1 }).lines[0]).toMatch(/so it was skipped/);
  });

  it('has no lines when nothing was left out', () => {
    expect(describeImport({ added: [run], found: 1 }).lines).toEqual([]);
  });
});

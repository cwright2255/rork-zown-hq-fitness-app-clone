import {
  MAX_SAVED_RUNS, MIN_SAVED_RUN_SECONDS, MAX_ROUTE_POINTS,
  runTime, runPaceSecPerKm, formatPace, paceLabel, newestRuns, routePoints, compactTrack,
  shouldSaveRun, buildSavedRun, fitRunsToSize, personalRecords, summarizeRuns, cleanSplits, MAX_SPLITS,
} from '../lib/runStats';

const run = (n, extra = {}) => ({
  id: String(n),
  startTime: new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString(),
  endTime: new Date(Date.UTC(2026, 0, 1) + n * 86400000 + 1800000).toISOString(),
  distance: 5, duration: 1500, pace: 300, calories: 300,
  ...extra,
});

describe('pace', () => {
  it('works pace out in seconds per km from distance and time', () => {
    expect(runPaceSecPerKm({ distance: 5, duration: 1650 })).toBe(330);
    expect(runPaceSecPerKm({ distance: 10, duration: 3000 })).toBe(300);
  });

  it('falls back to a stored pace when distance is missing, and to 0 otherwise', () => {
    expect(runPaceSecPerKm({ distance: 0, duration: 600, pace: 360 })).toBe(360);
    expect(runPaceSecPerKm({ distance: 0, duration: 600 })).toBe(0);
    expect(runPaceSecPerKm(null)).toBe(0);
  });

  it('formats seconds per km as minutes:seconds', () => {
    expect(formatPace(330)).toBe('5:30');
    expect(formatPace(305)).toBe('5:05');
    expect(formatPace(359.6)).toBe('6:00');
    expect(paceLabel(330)).toBe('5:30 /km');
  });

  it('shows -- when there is no usable pace', () => {
    expect(formatPace(0)).toBe('--');
    expect(formatPace(NaN)).toBe('--');
    expect(formatPace(undefined)).toBe('--');
    expect(formatPace(99999)).toBe('--');
    expect(paceLabel(0)).toBe('--');
  });

  it('shows a 5:30 pace as 5:30 and not as 330 minutes (the old unit bug)', () => {
    expect(paceLabel(runPaceSecPerKm({ distance: 5, duration: 1650, pace: 330 }))).toBe('5:30 /km');
  });
});

describe('newestRuns', () => {
  it('puts the newest run first whatever order it was given in', () => {
    const out = newestRuns([run(1), run(3), run(2)]);
    expect(out.map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('keeps the NEWEST 100 when there are more, not the oldest 100', () => {
    const many = [];
    for (let i = 150; i >= 1; i -= 1) many.push(run(i)); // newest first, like the store
    const out = newestRuns(many);
    expect(out).toHaveLength(MAX_SAVED_RUNS);
    expect(out[0].id).toBe('150');
    expect(out[99].id).toBe('51');
  });

  it('drops repeated ids and empty entries', () => {
    const out = newestRuns([run(2), null, run(2), undefined, run(1)]);
    expect(out.map((r) => r.id)).toEqual(['2', '1']);
  });

  it('copes with a missing list', () => {
    expect(newestRuns(undefined)).toEqual([]);
  });

  it('reads the finish time, falling back to the start time', () => {
    expect(runTime({ endTime: '2026-01-02T00:00:00.000Z' })).toBe(Date.UTC(2026, 0, 2));
    expect(runTime({ startTime: '2026-01-02T00:00:00.000Z' })).toBe(Date.UTC(2026, 0, 2));
    expect(runTime({})).toBe(0);
  });
});

describe('route', () => {
  const line = (n) => Array.from({ length: n }, (_, i) => ({ latitude: 40 + i * 0.0001, longitude: -74 - i * 0.0001 }));

  it('saves a flat list of rounded numbers', () => {
    const t = compactTrack([{ latitude: 40.123456789, longitude: -74.987654321 }, { latitude: 40.2, longitude: -74.9 }]);
    expect(t).toEqual([40.12346, -74.98765, 40.2, -74.9]);
  });

  it('never saves a list inside a list (Firestore refuses those)', () => {
    const t = compactTrack(line(500));
    expect(t.every((v) => typeof v === 'number')).toBe(true);
  });

  it('limits a long route and keeps its first and last points', () => {
    const pts = line(3000);
    const t = compactTrack(pts);
    expect(t).toHaveLength(MAX_ROUTE_POINTS * 2);
    expect(t[0]).toBe(Math.round(pts[0].latitude * 1e5) / 1e5);
    expect(t[t.length - 2]).toBe(Math.round(pts[2999].latitude * 1e5) / 1e5);
  });

  it('needs at least two points', () => {
    expect(compactTrack([])).toEqual([]);
    expect(compactTrack([{ latitude: 1, longitude: 2 }])).toEqual([]);
    expect(compactTrack(undefined)).toEqual([]);
  });

  it('reads points back from the saved shape and from the older object shape', () => {
    expect(routePoints({ track: [1, 2, 3, 4] })).toEqual([{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }]);
    expect(routePoints({ coords: [{ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 }] })).toHaveLength(2);
    expect(routePoints({})).toEqual([]);
    expect(routePoints(null)).toEqual([]);
  });
});

describe('buildSavedRun', () => {
  const now = Date.UTC(2026, 5, 1, 12, 0, 0);

  it('builds the record from what the run screen tracked, with no active run', () => {
    const r = buildSavedRun(null, {
      startTime: '2026-06-01T11:30:00.000Z', distance: 5, duration: 1650.4, calories: 312.6,
      coords: [{ latitude: 40, longitude: -74 }, { latitude: 40.001, longitude: -74.001 }],
    }, { uid: 'u1', now });
    expect(r.id).toBe(String(now));
    expect(r.startTime).toBe('2026-06-01T11:30:00.000Z');
    expect(r.endTime).toBe(new Date(now).toISOString());
    expect(r.distance).toBe(5);
    expect(r.duration).toBe(1650);
    expect(r.pace).toBe(330);
    expect(r.calories).toBe(313);
    expect(r.track).toHaveLength(4);
    expect(r.uid).toBe('u1');
  });

  it('works out a start time when none was given', () => {
    const r = buildSavedRun(null, { distance: 1, duration: 600 }, { now });
    expect(r.startTime).toBe(new Date(now - 600000).toISOString());
  });

  it('leaves out uid when signed out and never contains undefined', () => {
    const r = buildSavedRun(null, { distance: 1, duration: 600 }, { now });
    expect('uid' in r).toBe(false);
    expect(Object.values(r).every((v) => v !== undefined)).toBe(true);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('lets the tracked data win over an active run', () => {
    const r = buildSavedRun({ startTime: '2026-06-01T10:00:00.000Z', distance: 0, duration: 0 }, { distance: 2, duration: 700 }, { now });
    expect(r.startTime).toBe('2026-06-01T10:00:00.000Z');
    expect(r.distance).toBe(2);
    expect(r.duration).toBe(700);
  });

  it('turns junk numbers into zeros', () => {
    const r = buildSavedRun(null, { distance: NaN, duration: -5, calories: 'x' }, { now });
    expect(r.distance).toBe(0);
    expect(r.duration).toBe(0);
    expect(r.calories).toBe(0);
    expect(r.pace).toBe(0);
  });

  it('only keeps runs of at least 10 seconds', () => {
    expect(MIN_SAVED_RUN_SECONDS).toBe(10);
    expect(shouldSaveRun({ duration: 9 })).toBe(false);
    expect(shouldSaveRun({ duration: 10 })).toBe(true);
    expect(shouldSaveRun({ duration: 0, distance: 3 })).toBe(false);
    expect(shouldSaveRun(null)).toBe(false);
  });

  it('keeps a treadmill or interval session that has time but no distance', () => {
    expect(shouldSaveRun(buildSavedRun(null, { distance: 0, duration: 1200 }, { now }))).toBe(true);
  });
});

describe('splits and elevation on a saved run', () => {
  const now = Date.UTC(2026, 5, 1, 12, 0, 0);

  it('keeps the kilometre splits and the climb from the tracker', () => {
    const r = buildSavedRun(null, { distance: 3.2, duration: 1000, splits: [320.4, 318, 330.6], elevGain: 41.6, elevLoss: 38.2 }, { now });
    expect(r.splits).toEqual([320, 318, 331]);
    expect(r.elevGain).toBe(42);
    expect(r.elevLoss).toBe(38);
  });

  it('leaves them out for a run that has none, so old and new runs both look right', () => {
    const r = buildSavedRun(null, { distance: 1, duration: 600 }, { now });
    expect('splits' in r).toBe(false);
    expect('elevGain' in r).toBe(false);
    expect('elevLoss' in r).toBe(false);
  });

  it('keeps zero climb when the tracker reports zero', () => {
    const r = buildSavedRun(null, { distance: 1, duration: 600, splits: [], elevGain: 0, elevLoss: 0 }, { now });
    expect(r.elevGain).toBe(0);
    expect('splits' in r).toBe(false);
  });

  it('drops junk and never saves a negative climb', () => {
    const r = buildSavedRun(null, { distance: 1, duration: 600, splits: [300, NaN, -5, 0, 'x', null, 310], elevGain: -4, elevLoss: NaN }, { now });
    expect(r.splits).toEqual([300, 310]);
    expect(r.elevGain).toBe(0);
    expect('elevLoss' in r).toBe(false);
  });

  it('caps the number of splits', () => {
    expect(cleanSplits(Array.from({ length: 500 }, () => 300))).toHaveLength(MAX_SPLITS);
    expect(cleanSplits('nope')).toEqual([]);
  });

  it('has no undefined values (Firestore refuses them)', () => {
    const r = buildSavedRun(null, { distance: 5, duration: 1500, splits: [300], elevGain: 3, elevLoss: 2, coords: [{ latitude: 1, longitude: 1 }, { latitude: 1.1, longitude: 1.1 }] }, { now, uid: 'u1' });
    expect(Object.values(r).every((v) => v !== undefined)).toBe(true);
  });
});

describe('fitRunsToSize', () => {
  const bigRun = (n) => run(n, { track: Array.from({ length: 400 }, (_, i) => 40 + i / 1000) });

  it('leaves a normal history alone', () => {
    const runs = [run(3), run(2), run(1)];
    expect(fitRunsToSize(runs)).toEqual(runs);
  });

  it('removes routes from the oldest runs first when too big', () => {
    const runs = [bigRun(5), bigRun(4), bigRun(3), bigRun(2), bigRun(1)];
    const one = JSON.stringify(runs[0]).length;
    const out = fitRunsToSize(runs, one * 3);
    expect(out).toHaveLength(5);
    expect(out[0].track).toHaveLength(400);
    expect(out[4].track).toHaveLength(0);
    expect(JSON.stringify(out).length <= one * 3).toBe(true);
  });

  it('drops the oldest runs only as a last resort', () => {
    const out = fitRunsToSize([run(3), run(2), run(1)], 10);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('3');
  });

  it('keeps 100 runs with full routes under the Firestore limit', () => {
    const runs = [];
    for (let i = 100; i >= 1; i -= 1) runs.push(run(i, { track: compactTrack(Array.from({ length: 5000 }, (_, k) => ({ latitude: 40 + k * 0.00001234, longitude: -74 - k * 0.00001234 }))) }));
    expect(JSON.stringify(fitRunsToSize(runs)).length < 700000).toBe(true);
    expect(fitRunsToSize(runs)).toHaveLength(100);
  });
});

describe('personalRecords', () => {
  it('is empty with no runs', () => {
    expect(personalRecords([])).toEqual({ longestRun: null, fastestPace: null, best5k: null, totalDistance: 0 });
  });

  it('finds the longest run, fastest pace (in seconds per km) and total', () => {
    const runs = [
      run(3, { distance: 3, duration: 900 }),   // 300 s/km
      run(2, { distance: 10, duration: 3300 }), // 330 s/km
      run(1, { distance: 5, duration: 1750 }),  // 350 s/km
    ];
    const rec = personalRecords(runs);
    expect(rec.longestRun.id).toBe('2');
    expect(rec.fastestPace.id).toBe('3');
    expect(rec.fastestPace.pace).toBe(300);
    expect(rec.totalDistance).toBe(18);
  });

  it('ignores runs under 1 km for fastest pace', () => {
    const rec = personalRecords([run(2, { distance: 0.05, duration: 5 }), run(1, { distance: 4, duration: 1400 })]);
    expect(rec.fastestPace.id).toBe('1');
    expect(personalRecords([run(1, { distance: 0.5, duration: 100 })]).fastestPace).toBeNull();
  });

  it('counts a run of 4.5 km or more as a 5K and picks the quickest', () => {
    const rec = personalRecords([run(3, { distance: 4.4, duration: 1000 }), run(2, { distance: 5, duration: 1700 }), run(1, { distance: 6, duration: 1600 })]);
    expect(rec.best5k.id).toBe('1');
  });
});

describe('summarizeRuns', () => {
  it('adds up the totals and gives an average pace in seconds per km', () => {
    const s = summarizeRuns([run(2, { distance: 5, duration: 1500 }), run(1, { distance: 5, duration: 1800 })]);
    expect(s.totalRuns).toBe(2);
    expect(s.totalDistance).toBe(10);
    expect(s.totalDuration).toBe(3300);
    expect(s.totalCalories).toBe(600);
    expect(s.avgPace).toBe(330);
  });

  it('does not let a no-distance session distort the average pace', () => {
    const s = summarizeRuns([run(2, { distance: 0, duration: 1200 }), run(1, { distance: 5, duration: 1500 })]);
    expect(s.avgPace).toBe(300);
  });

  it('is all zeros with no runs', () => {
    expect(summarizeRuns([])).toEqual({ totalRuns: 0, totalDistance: 0, totalDuration: 0, totalCalories: 0, avgPace: 0 });
    expect(summarizeRuns(undefined).totalRuns).toBe(0);
  });
});

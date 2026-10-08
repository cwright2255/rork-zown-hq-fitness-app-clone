import {
  runTitle, runDateLabel, formatClock, formatDelta, splitSummary, routeRegion, routeSketch, describeRun,
  MIN_BAR,
} from '../lib/runDetail';

// A start time in the phone's own time zone (the screen shows local time).
const at = (h, m = 0) => new Date(2026, 9, 8, h, m, 0).toISOString();

describe('runTitle', () => {
  it('names the run for the time of day it started', () => {
    expect(runTitle({ startTime: at(3) })).toBe('Night Run');
    expect(runTitle({ startTime: at(7) })).toBe('Morning Run');
    expect(runTitle({ startTime: at(12) })).toBe('Afternoon Run');
    expect(runTitle({ startTime: at(18, 30) })).toBe('Evening Run');
    expect(runTitle({ startTime: at(22) })).toBe('Night Run');
  });

  it('calls a walk a walk', () => {
    expect(runTitle({ startTime: at(7), activity: 'walk' })).toBe('Morning Walk');
  });

  it('falls back when there is no usable start time', () => {
    expect(runTitle({})).toBe('Free Run');
    expect(runTitle({ startTime: 'nonsense', activity: 'walk' })).toBe('Free Walk');
    expect(runTitle(null)).toBe('Free Run');
  });
});

describe('runDateLabel', () => {
  it('writes the day and the time', () => {
    expect(runDateLabel({ startTime: at(7, 5) })).toBe('Thu, Oct 8 • 7:05 AM');
    expect(runDateLabel({ startTime: at(0, 30) })).toBe('Thu, Oct 8 • 12:30 AM');
    expect(runDateLabel({ startTime: at(12, 0) })).toBe('Thu, Oct 8 • 12:00 PM');
    expect(runDateLabel({ startTime: at(18, 45) })).toBe('Thu, Oct 8 • 6:45 PM');
  });

  it('is empty without a usable time', () => {
    expect(runDateLabel({})).toBe('');
    expect(runDateLabel(null)).toBe('');
  });
});

describe('formatClock', () => {
  it('shows minutes and seconds, adding hours from an hour up', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(1530)).toBe('25:30');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3930)).toBe('1:05:30');
  });

  it('copes with junk', () => {
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(undefined)).toBe('0:00');
    expect(formatClock(NaN)).toBe('0:00');
  });
});

describe('formatDelta', () => {
  it('shows how far from the average, with a sign', () => {
    expect(formatDelta(12)).toBe('+0:12');
    expect(formatDelta(-5)).toBe('-0:05');
    expect(formatDelta(75)).toBe('+1:15');
    expect(formatDelta(0)).toBe('0:00');
    expect(formatDelta(0.3)).toBe('0:00');
    expect(formatDelta(undefined)).toBe('0:00');
  });
});

describe('splitSummary', () => {
  it('gives nothing for a run without kilometre splits', () => {
    expect(splitSummary({ distance: 0.8, duration: 300 }).rows).toEqual([]);
    expect(splitSummary({ distance: 5, duration: 1500, splits: [] }).rows).toEqual([]);
    expect(splitSummary(null).rows).toEqual([]);
  });

  it('makes a row per kilometre with the average and the fastest and slowest', () => {
    const run = { distance: 3, duration: 930, splits: [300, 330, 300] };
    const out = splitSummary(run);
    expect(out.rows).toHaveLength(3);
    expect(out.rows.map((r) => r.label)).toEqual(['1', '2', '3']);
    expect(out.rows.map((r) => r.pace)).toEqual([300, 330, 300]);
    expect(out.avgPace).toBe(310);
    expect(out.fastest).toBe(0); // the first of two equal fastest
    expect(out.slowest).toBe(1);
    expect(out.rows[1].delta).toBeCloseTo(20, 5);
    expect(out.rows[0].delta).toBeCloseTo(-10, 5);
    expect(out.rows[0].isFastest).toBe(true);
    expect(out.rows[1].isSlowest).toBe(true);
    expect(out.rows[2].isFastest).toBe(false);
  });

  it('draws the fastest kilometre tallest and the slowest at the minimum', () => {
    const out = splitSummary({ distance: 3, duration: 930, splits: [300, 330, 315] });
    expect(out.rows[0].bar).toBe(1);
    expect(out.rows[1].bar).toBeCloseTo(MIN_BAR, 5);
    expect(out.rows[2].bar).toBeGreaterThan(MIN_BAR);
    expect(out.rows[2].bar).toBeLessThan(1);
  });

  it('does not single out a fastest or slowest when every kilometre is the same', () => {
    const out = splitSummary({ distance: 2, duration: 600, splits: [300, 300] });
    expect(out.rows.every((r) => r.bar === 0.7)).toBe(true);
    expect(out.fastest).toBeNull();
    expect(out.slowest).toBeNull();
    expect(out.rows.some((r) => r.isFastest)).toBe(false);
    expect(out.rows.some((r) => r.isSlowest)).toBe(false);
  });

  it('has no fastest or slowest with a single kilometre', () => {
    const out = splitSummary({ distance: 1.1, duration: 330, splits: [300] });
    expect(out.fastest).toBeNull();
    expect(out.slowest).toBeNull();
    expect(out.rows[0].isFastest).toBe(false);
  });

  it('adds the leftover bit of a kilometre as a shorter last split', () => {
    const out = splitSummary({ distance: 2.5, duration: 790, splits: [300, 310] });
    expect(out.rows).toHaveLength(3);
    const last = out.rows[2];
    expect(last.partial).toBe(true);
    expect(last.label).toBe('0.50');
    expect(last.seconds).toBe(180);
    expect(last.pace).toBeCloseTo(360, 5);
    expect(last.isFastest).toBe(false);
    expect(last.isSlowest).toBe(false);
    expect(out.avgPace).toBe(305); // the leftover does not change the average
  });

  it('skips a leftover that is tiny, or that makes no sense', () => {
    expect(splitSummary({ distance: 2.03, duration: 620, splits: [300, 310] }).rows).toHaveLength(2);
    expect(splitSummary({ distance: 2.5, duration: 600, splits: [300, 310] }).rows).toHaveLength(2); // no time left
    expect(splitSummary({ distance: 9, duration: 2000, splits: [300, 310] }).rows).toHaveLength(2); // route lost its splits
  });

  it('ignores junk in the saved splits', () => {
    const out = splitSummary({ distance: 3, duration: 900, splits: [300, NaN, -4, 'x', 310, null, 290] });
    expect(out.rows.map((r) => r.pace)).toEqual([300, 310, 290]);
  });

  it('keeps every bar inside the chart', () => {
    const splits = [240, 600, 255, 300, 250];
    const out = splitSummary({ distance: 5, duration: 1645, splits });
    out.rows.forEach((r) => {
      expect(r.bar).toBeGreaterThanOrEqual(0.15);
      expect(r.bar).toBeLessThanOrEqual(1);
    });
  });
});

describe('routeRegion', () => {
  it('centres on the route and leaves room around it', () => {
    const r = routeRegion([
      { latitude: 40.0, longitude: -74.02 },
      { latitude: 40.02, longitude: -74.0 },
    ]);
    expect(r.latitude).toBeCloseTo(40.01, 6);
    expect(r.longitude).toBeCloseTo(-74.01, 6);
    expect(r.latitudeDelta).toBeCloseTo(0.032, 6);
    expect(r.longitudeDelta).toBeCloseTo(0.032, 6);
  });

  it('never zooms in closer than a few hundred metres', () => {
    const r = routeRegion([{ latitude: 40, longitude: -74 }, { latitude: 40.0001, longitude: -74.0001 }]);
    expect(r.latitudeDelta).toBe(0.004);
    expect(r.longitudeDelta).toBe(0.004);
  });

  it('is null with no route, and skips bad points', () => {
    expect(routeRegion([])).toBeNull();
    expect(routeRegion(null)).toBeNull();
    expect(routeRegion([{ latitude: NaN, longitude: 1 }])).toBeNull();
    expect(routeRegion([{ latitude: 40, longitude: -74 }]).latitudeDelta).toBe(0.004);
  });
});

describe('routeSketch', () => {
  const square = [
    { latitude: 40, longitude: -74 },
    { latitude: 40, longitude: -73.99 },
    { latitude: 40.01, longitude: -73.99 },
    { latitude: 40.01, longitude: -74 },
  ];

  it('fits the route inside the box and keeps the first and last points', () => {
    const s = routeSketch(square, 300, 200, 16);
    const pts = s.points.split(' ').map((p) => p.split(',').map(Number));
    expect(pts).toHaveLength(4);
    pts.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(16 - 0.1);
      expect(x).toBeLessThanOrEqual(284 + 0.1);
      expect(y).toBeGreaterThanOrEqual(16 - 0.1);
      expect(y).toBeLessThanOrEqual(184 + 0.1);
    });
    expect(s.start).toEqual({ x: pts[0][0], y: pts[0][1] });
    expect(s.end).toEqual({ x: pts[3][0], y: pts[3][1] });
  });

  it('draws north at the top', () => {
    const s = routeSketch(square, 300, 200, 16);
    const pts = s.points.split(' ').map((p) => p.split(',').map(Number));
    expect(pts[2][1]).toBeLessThan(pts[0][1]); // 40.01 is above 40.00
  });

  it('keeps its shape: a route twice as tall as wide is not stretched', () => {
    const tall = [
      { latitude: 40, longitude: -74 },
      { latitude: 40.02, longitude: -74 },
      { latitude: 40.02, longitude: -73.9855 }, // about 1.2 km east at this latitude
    ];
    const s = routeSketch(tall, 300, 200, 16);
    const pts = s.points.split(' ').map((p) => p.split(',').map(Number));
    const height = Math.abs(pts[1][1] - pts[0][1]);
    const width = Math.abs(pts[2][0] - pts[1][0]);
    // 0.02 deg of latitude is about 2.2 km, 0.0145 deg of longitude about 1.2 km
    expect(height / width).toBeGreaterThan(1.7);
    expect(height / width).toBeLessThan(2.0);
  });

  it('is null for fewer than two points', () => {
    expect(routeSketch([])).toBeNull();
    expect(routeSketch([{ latitude: 40, longitude: -74 }])).toBeNull();
    expect(routeSketch(null)).toBeNull();
  });

  it('handles a straight line', () => {
    const s = routeSketch([{ latitude: 40, longitude: -74 }, { latitude: 40, longitude: -73.99 }]);
    const pts = s.points.split(' ').map((p) => p.split(',').map(Number));
    expect(pts[0][1]).toBe(pts[1][1]);
    expect(pts[1][0]).toBeGreaterThan(pts[0][0]);
  });
});

describe('describeRun', () => {
  const run = {
    id: '1', startTime: at(7, 5), distance: 5.234, duration: 1610, calories: 366.4, activity: 'walk',
    elevGain: 42, elevLoss: 38, track: [40, -74, 40.01, -74.01, 40.02, -74.02],
    splits: [300, 310, 305, 320, 295],
  };

  it('puts everything the screen shows in one place', () => {
    const d = describeRun(run);
    expect(d.title).toBe('Morning Walk');
    expect(d.when).toBe('Thu, Oct 8 • 7:05 AM');
    expect(d.activity).toBe('walk');
    expect(d.distanceText).toBe('5.23');
    expect(d.timeText).toBe('26:50');
    expect(d.calories).toBe(366);
    expect(d.climb).toBe(42);
    expect(d.descent).toBe(38);
    expect(d.points).toHaveLength(3);
    expect(d.hasRoute).toBe(true);
    expect(d.splits.rows).toHaveLength(5 + 1); // five full kilometres and 0.23 km over
  });

  it('copes with a bare, older record', () => {
    const d = describeRun({ id: 'x', distance: 0.4, duration: 130 });
    expect(d.title).toBe('Free Run');
    expect(d.distanceText).toBe('0.40');
    expect(d.timeText).toBe('2:10');
    expect(d.calories).toBe(0);
    expect(d.climb).toBe(0);
    expect(d.hasRoute).toBe(false);
    expect(d.splits.rows).toEqual([]);
  });

  it('names where an imported run came from, and nothing for one recorded here', () => {
    expect(describeRun({ ...run, source: 'apple-health' }).source).toBe('Apple Health');
    expect(describeRun(run).source).toBe('');
    expect(describeRun({ ...run, source: 'something-unknown' }).source).toBe('');
  });

  it('reads an older route saved as coordinates', () => {
    const d = describeRun({ id: 'o', distance: 1, duration: 300, coords: [{ latitude: 40, longitude: -74 }, { latitude: 40.001, longitude: -74.001 }] });
    expect(d.hasRoute).toBe(true);
  });
});

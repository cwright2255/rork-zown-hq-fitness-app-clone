import {
  MIN_SAVED_FAST_MS, MAX_BACKDATE_MS, MIN_CORRELATION_POINTS,
  normalizeFast, fastHours, metGoal, fastDay, finishFast, streaks, niceMax, chartSeries, linearFit,
  weightCorrelation, calorieCorrelation, correlationStrength, correlationSentence, formatR,
  shiftFastStart, goalTime, formatClock, formatDayLabel, formatStartLabel, formatDuration, formatHours,
} from '../lib/fastingStats';

const H = 3600000;
// Monday 12 October 2026, 2:00 PM (the phone's own time zone, like everything the widget does).
const NOW = new Date(2026, 9, 12, 14, 0, 0);

// A finished fast: start and end as [y, m(1-12), d, h, min].
const at = ([y, mo, d, h = 0, mi = 0]) => new Date(y, mo - 1, d, h, mi, 0);
const fast = (start, end, targetHours = 16, plan = null, id) => ({ id: id || `f${start.join('-')}`, startedAt: at(start), endedAt: at(end), targetHours, plan });
// A fast that ends at `endH`:00 on day (y, mo, d) and lasted `hours`.
const endingOn = (y, mo, d, hours, target = 16, endH = 12) => {
  const endedAt = new Date(y, mo - 1, d, endH, 0, 0);
  return { id: `e${y}${mo}${d}${hours}`, startedAt: new Date(endedAt.getTime() - hours * H), endedAt, targetHours: target, plan: null };
};

describe('normalizeFast', () => {
  it('turns Firestore timestamps, ISO strings and numbers into Dates', () => {
    const start = new Date(2026, 9, 10, 20, 0);
    const end = new Date(2026, 9, 11, 12, 30);
    const f = normalizeFast({
      id: 'abc', startedAt: { toDate: () => start }, endedAt: end.toISOString(), targetHours: 18, plan: '18',
    });
    expect(f).toEqual({ id: 'abc', startedAt: start, endedAt: end, targetHours: 18, plan: '18' });
    expect(normalizeFast({ startedAt: start.getTime(), endedAt: end.getTime() }).endedAt).toEqual(end);
  });

  it('names a fast by its start time when it has no id, and defaults the target to 16', () => {
    const f = normalizeFast({ startedAt: at([2026, 10, 10, 20]), endedAt: at([2026, 10, 11, 12]) });
    expect(f.id).toBe(String(at([2026, 10, 10, 20]).getTime()));
    expect(f.targetHours).toBe(16);
    expect(f.plan).toBeNull();
  });

  it.each([[0], [-4], ['x'], [null]])('uses 16 hours when the target is %p', (t) => {
    expect(normalizeFast({ startedAt: at([2026, 10, 10, 20]), endedAt: at([2026, 10, 11, 12]), targetHours: t }).targetHours).toBe(16);
  });

  it('is null for anything that can not be a fast', () => {
    const a = at([2026, 10, 10, 20]);
    const b = at([2026, 10, 11, 12]);
    expect(normalizeFast(null)).toBeNull();
    expect(normalizeFast('x')).toBeNull();
    expect(normalizeFast({})).toBeNull();
    expect(normalizeFast({ startedAt: a })).toBeNull();
    expect(normalizeFast({ endedAt: b })).toBeNull();
    expect(normalizeFast({ startedAt: 'nope', endedAt: b })).toBeNull();
    expect(normalizeFast({ startedAt: b, endedAt: a })).toBeNull(); // ends before it starts
    expect(normalizeFast({ startedAt: a, endedAt: a })).toBeNull(); // no time at all
  });

  it('measures hours and the goal', () => {
    const f = normalizeFast(fast([2026, 10, 10, 20], [2026, 10, 11, 12], 16));
    expect(fastHours(f)).toBe(16);
    expect(metGoal(f)).toBe(true);
    expect(metGoal({ ...f, targetHours: 16.01 })).toBe(false);
    expect(fastDay(f)).toBe('2026-10-11');
  });
});

describe('finishFast', () => {
  const active = { startedAt: at([2026, 10, 10, 20]), targetHours: 16, plan: '16' };

  it('keeps the times, the target and the plan, how long it ran, and whether it made its goal', () => {
    const e = finishFast(active, at([2026, 10, 11, 12, 30]));
    expect(e).toEqual({
      id: String(active.startedAt.getTime()),
      startedAt: active.startedAt,
      endedAt: at([2026, 10, 11, 12, 30]),
      targetHours: 16,
      plan: '16',
      hours: 16.5,
      completed: true,
      saveable: true,
    });
  });

  it('counts exactly the target as reached, and one minute short as not', () => {
    expect(finishFast(active, new Date(active.startedAt.getTime() + 16 * H)).completed).toBe(true);
    expect(finishFast(active, new Date(active.startedAt.getTime() + 16 * H - 60000)).completed).toBe(false);
  });

  it('only keeps a fast of ten minutes or more', () => {
    expect(MIN_SAVED_FAST_MS).toBe(600000);
    expect(finishFast(active, new Date(active.startedAt.getTime() + MIN_SAVED_FAST_MS)).saveable).toBe(true);
    expect(finishFast(active, new Date(active.startedAt.getTime() + MIN_SAVED_FAST_MS - 1)).saveable).toBe(false);
  });

  it('never ends before it starts', () => {
    const e = finishFast(active, new Date(active.startedAt.getTime() - 5 * H));
    expect(e.endedAt).toEqual(active.startedAt);
    expect(e.hours).toBe(0);
    expect(e.saveable).toBe(false);
  });

  it('falls back to 16 hours and no plan, and is null without a start time', () => {
    const e = finishFast({ startedAt: active.startedAt, targetHours: 'x' }, at([2026, 10, 11, 12]));
    expect(e.targetHours).toBe(16);
    expect(e.plan).toBeNull();
    expect(finishFast({}, NOW)).toBeNull();
    expect(finishFast(null, NOW)).toBeNull();
  });
});

describe('streaks', () => {
  it('is zero with no fasts', () => {
    expect(streaks([], NOW)).toEqual({ current: 0, best: 0, todayDone: false, goalDays: 0 });
    expect(streaks(undefined, NOW)).toEqual({ current: 0, best: 0, todayDone: false, goalDays: 0 });
  });

  it('counts the days in a row, today included', () => {
    const h = [endingOn(2026, 10, 12, 17), endingOn(2026, 10, 11, 16), endingOn(2026, 10, 10, 18)];
    expect(streaks(h, NOW)).toEqual({ current: 3, best: 3, todayDone: true, goalDays: 3 });
  });

  it('keeps a streak alive through a day that is not over: nothing yet today is not a break', () => {
    const h = [endingOn(2026, 10, 11, 16), endingOn(2026, 10, 10, 16)];
    expect(streaks(h, NOW)).toEqual({ current: 2, best: 2, todayDone: false, goalDays: 2 });
  });

  it('breaks after a whole day with no fast that made its goal', () => {
    const h = [endingOn(2026, 10, 10, 16), endingOn(2026, 10, 9, 16)];
    const out = streaks(h, NOW);
    expect(out.current).toBe(0);
    expect(out.best).toBe(2);
  });

  it('does not count a fast that fell short', () => {
    const h = [endingOn(2026, 10, 12, 15.9), endingOn(2026, 10, 11, 16)];
    expect(streaks(h, NOW)).toMatchObject({ current: 1, todayDone: false });
  });

  it('counts a day once however many fasts made their goal', () => {
    const h = [endingOn(2026, 10, 12, 16, 16, 9), endingOn(2026, 10, 12, 16, 16, 13)];
    expect(streaks(h, NOW)).toMatchObject({ current: 1, goalDays: 1 });
  });

  it('keeps the best run even after it is over', () => {
    const old = [6, 7, 8, 9].map((d) => endingOn(2026, 9, d, 16)); // 4 in a row
    const now = [endingOn(2026, 10, 12, 16), endingOn(2026, 10, 11, 16)];
    expect(streaks([...old, ...now], NOW)).toMatchObject({ current: 2, best: 4, goalDays: 6 });
  });

  it('counts a fast on the day it ENDS: 11:50 PM is that day, 12:10 AM is the next', () => {
    const late = { id: 'late', startedAt: at([2026, 10, 11, 7, 50]), endedAt: at([2026, 10, 11, 23, 50]), targetHours: 16 };
    const early = { id: 'early', startedAt: at([2026, 10, 11, 8, 10]), endedAt: at([2026, 10, 12, 0, 10]), targetHours: 16 };
    expect(fastDay(normalizeFast(late))).toBe('2026-10-11');
    expect(fastDay(normalizeFast(early))).toBe('2026-10-12');
    expect(streaks([late, early], NOW)).toMatchObject({ current: 2, todayDone: true });
  });

  it('runs across the end of a month and a year', () => {
    const h = [endingOn(2026, 9, 30, 16), endingOn(2026, 10, 1, 16), endingOn(2026, 10, 2, 16)];
    expect(streaks(h, at([2026, 10, 2, 15]))).toMatchObject({ current: 3 });
    const y = [endingOn(2025, 12, 31, 16), endingOn(2026, 1, 1, 16)];
    expect(streaks(y, at([2026, 1, 1, 15]))).toMatchObject({ current: 2 });
  });

  it('runs across the clocks changing (they went back on 1 November and forward on 8 March)', () => {
    const fall = [endingOn(2026, 10, 31, 16), endingOn(2026, 11, 1, 16), endingOn(2026, 11, 2, 16)];
    expect(streaks(fall, at([2026, 11, 2, 15])).current).toBe(3);
    const spring = [endingOn(2026, 3, 7, 16), endingOn(2026, 3, 8, 16), endingOn(2026, 3, 9, 16)];
    expect(streaks(spring, at([2026, 3, 9, 15])).current).toBe(3);
    const week = chartSeries(fall, 'week', at([2026, 11, 2, 15]));
    expect(week.bars.map((b) => b.key)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(week.bars.map((b) => b.fasts)).toEqual([0, 0, 0, 0, 1, 1, 1]);
  });

  it('ignores entries that are not real fasts', () => {
    expect(streaks([null, {}, { startedAt: 'x', endedAt: 'y' }, endingOn(2026, 10, 12, 16)], NOW).current).toBe(1);
  });
});

describe('niceMax', () => {
  it.each([[0, 8], [5, 8], [8, 8], [8.1, 12], [12, 12], [16.5, 20], [24, 24], [36.2, 40], [NaN, 8], [undefined, 8]])('%p -> %p', (v, expected) => {
    expect(niceMax(v)).toBe(expected);
  });
});

describe('chartSeries: the week', () => {
  const history = [
    endingOn(2026, 10, 12, 17), // Monday, today: met
    endingOn(2026, 10, 10, 12), // Saturday: fell short
    endingOn(2026, 10, 9, 16.5, 16, 8), // Friday morning: met
    endingOn(2026, 10, 9, 3, 16, 15), // Friday afternoon: a short second fast
    endingOn(2026, 10, 5, 20), // a week ago Monday: out of range
    endingOn(2026, 10, 13, 20), // tomorrow: out of range
  ];
  const out = chartSeries(history, 'week', NOW);

  it('has the last seven days ending today, labelled by weekday', () => {
    expect(out.range).toBe('week');
    expect(out.bars.map((b) => b.label)).toEqual(['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']);
    expect(out.bars.map((b) => b.key)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
    expect(out.bars.every((b) => b.showLabel)).toBe(true);
  });

  it('adds up the hours fasted on each day, and marks a day that made its goal', () => {
    expect(out.bars.map((b) => b.value)).toEqual([0, 0, 0, 19.5, 12, 0, 17]);
    expect(out.bars.map((b) => b.met)).toEqual([false, false, false, true, false, false, true]);
    expect(out.bars.map((b) => b.fasts)).toEqual([0, 0, 0, 2, 1, 0, 1]);
  });

  it('summarizes the fasts in the week only', () => {
    expect(out.summary).toEqual({ fasts: 4, avgHours: 12.1, goalsMet: 2, longestHours: 17 });
    expect(out.empty).toBe(false);
  });

  it('tops the chart at a multiple of four hours with three ticks', () => {
    expect(out.max).toBe(20);
    expect(out.ticks).toEqual([0, 10, 20]);
  });

  it('is empty, with a chart of 8 hours, when there are no fasts', () => {
    const none = chartSeries([], 'week', NOW);
    expect(none.empty).toBe(true);
    expect(none.summary).toEqual({ fasts: 0, avgHours: 0, goalsMet: 0, longestHours: 0 });
    expect(none.max).toBe(8);
    expect(none.bars).toHaveLength(7);
  });

  it('treats a fast that made its goal on a day with a short one as a met day', () => {
    const only = chartSeries([endingOn(2026, 10, 12, 4, 16, 9), endingOn(2026, 10, 12, 16, 16, 13)], 'week', NOW);
    expect(only.bars[6]).toMatchObject({ met: true, fasts: 2, value: 20 });
  });
});

describe('chartSeries: the month', () => {
  const out = chartSeries([endingOn(2026, 10, 12, 16), endingOn(2026, 9, 13, 14), endingOn(2026, 9, 12, 20)], 'month', NOW);

  it('has the last 30 days, from 13 September to today', () => {
    expect(out.bars).toHaveLength(30);
    expect(out.bars[0].key).toBe('2026-09-13');
    expect(out.bars[29].key).toBe('2026-10-12');
  });

  it('labels each bar with its day of the month, and shows a label for today and every fifth day back', () => {
    expect(out.bars[29].label).toBe('12');
    expect(out.bars[0].label).toBe('13');
    expect(out.bars.map((b, i) => (b.showLabel ? i : null)).filter((i) => i !== null)).toEqual([4, 9, 14, 19, 24, 29]);
  });

  it('counts the first day and leaves out the day before it', () => {
    expect(out.bars[0]).toMatchObject({ value: 14, met: false });
    expect(out.summary.fasts).toBe(2);
  });
});

describe('chartSeries: the year', () => {
  const history = [
    endingOn(2026, 10, 12, 16), endingOn(2026, 10, 3, 20), // October: average 18, met
    endingOn(2026, 9, 30, 10), endingOn(2026, 9, 1, 12), // September: average 11, short
    endingOn(2025, 11, 1, 16), // the oldest month on the chart
    endingOn(2025, 10, 31, 16), // before it: left out
  ];
  const out = chartSeries(history, 'year', NOW);

  it('has twelve months ending this one, labelled with their first letter', () => {
    expect(out.bars).toHaveLength(12);
    expect(out.bars[0].key).toBe('2025-11');
    expect(out.bars[11].key).toBe('2026-10');
    expect(out.bars.map((b) => b.label).join('')).toBe('NDJFMAMJJASO');
    expect(out.bars[11].fullLabel).toBe('Oct');
    expect(out.bars.every((b) => b.showLabel)).toBe(true);
  });

  it('shows the AVERAGE length of the fasts in a month, and whether the average made the goal', () => {
    expect(out.bars[11]).toMatchObject({ value: 18, met: true, fasts: 2 });
    expect(out.bars[10]).toMatchObject({ value: 11, met: false, fasts: 2 });
    expect(out.bars[0]).toMatchObject({ value: 16, met: true, fasts: 1 });
    expect(out.bars[5]).toMatchObject({ value: 0, met: false, fasts: 0 });
  });

  it('summarizes the twelve months', () => {
    expect(out.summary).toEqual({ fasts: 5, avgHours: 14.8, goalsMet: 3, longestHours: 20 });
  });

  it('works across a year end', () => {
    const jan = chartSeries([endingOn(2026, 1, 5, 16), endingOn(2025, 12, 28, 16)], 'year', at([2026, 1, 20, 12]));
    expect(jan.bars[11].key).toBe('2026-01');
    expect(jan.bars[10].key).toBe('2025-12');
    expect(jan.bars[0].key).toBe('2025-02');
    expect(jan.summary.fasts).toBe(2);
  });
});

describe('linearFit', () => {
  it('fits a straight line', () => {
    const up = linearFit([{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }]);
    expect(up.slope).toBeCloseTo(2, 10);
    expect(up.intercept).toBeCloseTo(1, 10);
    expect(up.r).toBeCloseTo(1, 10);
    expect(linearFit([{ x: 1, y: 7 }, { x: 2, y: 5 }, { x: 3, y: 3 }]).r).toBeCloseTo(-1, 10);
  });

  it('measures how loosely the dots follow it', () => {
    const fit = linearFit([[1, 2], [2, 4], [3, 5], [4, 4], [5, 5]].map(([x, y]) => ({ x, y })));
    expect(fit.slope).toBeCloseTo(0.6, 10);
    expect(fit.intercept).toBeCloseTo(2.2, 10);
    expect(fit.r).toBeCloseTo(6 / Math.sqrt(60), 10);
    expect(fit.n).toBe(5);
  });

  it('gives no r for fewer than three dots or no spread, and no line without spread in x', () => {
    expect(linearFit([]).slope).toBeNull();
    expect(linearFit([{ x: 1, y: 1 }]).slope).toBeNull();
    expect(linearFit([{ x: 1, y: 1 }, { x: 2, y: 3 }])).toMatchObject({ slope: 2, r: null, n: 2 });
    expect(linearFit([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }])).toMatchObject({ slope: 0, r: null });
    expect(linearFit([{ x: 2, y: 1 }, { x: 2, y: 3 }, { x: 2, y: 5 }])).toMatchObject({ slope: null, intercept: null, r: null });
  });

  it('skips dots that are not numbers', () => {
    expect(linearFit([{ x: 1, y: 1 }, { x: NaN, y: 2 }, { x: 2, y: 2 }, { x: 3, y: undefined }, { x: 3, y: 3 }]).n).toBe(3);
    expect(linearFit(undefined).n).toBe(0);
  });
});

describe('weightCorrelation', () => {
  // Weeks start on Mondays: Aug 31, Sep 7, 14, 21, 28, Oct 5. One weigh-in each Wednesday.
  const weigh = (y, m, d, kg) => ({ weightKg: kg, createdAtLocal: new Date(y, m - 1, d, 8, 0).toISOString() });
  const logs = [
    weigh(2026, 9, 2, 82), weigh(2026, 9, 9, 81.6), weigh(2026, 9, 16, 81), weigh(2026, 9, 23, 81),
    weigh(2026, 9, 30, 80.2), weigh(2026, 10, 7, 80),
  ];
  const fasts = [
    endingOn(2026, 9, 10, 14), endingOn(2026, 9, 17, 16), endingOn(2026, 9, 24, 12),
    endingOn(2026, 10, 1, 18), endingOn(2026, 10, 8, 20),
  ];

  it('makes a dot for each pair of weigh-in weeks: the average fast, and the change in weight', () => {
    const { points, fit } = weightCorrelation(fasts, logs);
    expect(points.map((p) => [p.x, p.y])).toEqual([[14, -0.4], [16, -0.6], [12, 0], [18, -0.8], [20, -0.2]]);
    expect(points.map((p) => p.label)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
    expect(fit.n).toBe(5);
    expect(fit.r).toBeLessThan(0);
  });

  it('averages the weigh-ins inside a week, and ignores entries that are not a weight on a date', () => {
    const noisy = [
      weigh(2026, 9, 1, 81), weigh(2026, 9, 3, 83), // week of Aug 31 averages 82
      weigh(2026, 9, 8, 81), weigh(2026, 9, 11, 82.2), // week of Sep 7 averages 81.6
      { weightKg: 'x', createdAtLocal: new Date(2026, 8, 9).toISOString() },
      { weightKg: 0, createdAtLocal: new Date(2026, 8, 9).toISOString() },
      { weightKg: 90, createdAtLocal: 'not a date' },
      { weightKg: 90 },
      null,
    ];
    const { points } = weightCorrelation([endingOn(2026, 9, 10, 14)], noisy);
    expect(points).toHaveLength(1);
    expect(points[0].y).toBe(-0.4);
  });

  it('counts fasts that ended after the first week through the end of the second, and no others', () => {
    const two = [weigh(2026, 9, 2, 82), weigh(2026, 9, 9, 81)];
    // Sunday of the first week (Sep 6): not between. Monday Sep 7 and Sunday Sep 13: between. Monday Sep 14: not.
    expect(weightCorrelation([endingOn(2026, 9, 6, 20)], two).points).toHaveLength(0);
    expect(weightCorrelation([endingOn(2026, 9, 14, 20)], two).points).toHaveLength(0);
    expect(weightCorrelation([endingOn(2026, 9, 7, 20)], two).points).toHaveLength(1);
    expect(weightCorrelation([endingOn(2026, 9, 13, 20)], two).points).toHaveLength(1);
    expect(weightCorrelation([endingOn(2026, 9, 7, 20), endingOn(2026, 9, 13, 10)], two).points[0].x).toBe(15);
  });

  it('spreads a longer gap across its weeks, up to four weeks', () => {
    const gap = [weigh(2026, 9, 2, 82), weigh(2026, 9, 30, 80)]; // four weeks apart
    const out = weightCorrelation([endingOn(2026, 9, 20, 16)], gap);
    expect(out.points).toHaveLength(1);
    expect(out.points[0]).toMatchObject({ x: 16, y: -0.5, weeks: 4 });
    const tooFar = [weigh(2026, 9, 2, 82), weigh(2026, 10, 7, 80)]; // five weeks apart
    expect(weightCorrelation([endingOn(2026, 9, 20, 16)], tooFar).points).toHaveLength(0);
  });

  it('has no dots without fasts, weigh-ins, or two weeks of them', () => {
    expect(weightCorrelation([], logs).points).toEqual([]);
    expect(weightCorrelation(fasts, []).points).toEqual([]);
    expect(weightCorrelation(fasts, [weigh(2026, 9, 2, 82), weigh(2026, 9, 3, 81)]).points).toEqual([]); // the same week
    expect(weightCorrelation(undefined, undefined).fit.n).toBe(0);
  });
});

describe('calorieCorrelation', () => {
  const meal = (date, ...calories) => ({ id: `m-${date}`, date, foods: calories.map((c) => ({ calories: c })) });

  it('makes a dot for each day with food logged and a fast that ended: longest fast, calories eaten', () => {
    const fasts = [
      endingOn(2026, 10, 12, 16), endingOn(2026, 10, 11, 14), endingOn(2026, 10, 11, 18, 16, 9),
      endingOn(2026, 10, 10, 20), // no food logged that day
      endingOn(2026, 10, 9, 16),
    ];
    const meals = [meal('2026-10-12', 600, 500), meal('2026-10-11', 900, 700), meal('2026-10-09', 1800), meal('2026-10-08', 2000)];
    const { points, fit } = calorieCorrelation(fasts, meals, { now: NOW });
    expect(points.map((p) => [p.label, p.x, p.y])).toEqual([
      ['2026-10-09', 16, 1800], ['2026-10-11', 18, 1600], ['2026-10-12', 16, 1100],
    ]);
    expect(fit.n).toBe(3);
  });

  it('skips days with no calories, and days outside the window', () => {
    const fasts = [endingOn(2026, 10, 12, 16), endingOn(2026, 9, 1, 16)];
    const meals = [meal('2026-10-12', 0), meal('2026-09-01', 1500)];
    expect(calorieCorrelation(fasts, meals, { now: NOW }).points).toEqual([]);
    expect(calorieCorrelation(fasts, [meal('2026-09-01', 1500)], { now: NOW, days: 60 }).points).toHaveLength(1);
  });

  it('copes with no meals or no fasts', () => {
    expect(calorieCorrelation([], [meal('2026-10-12', 500)], { now: NOW }).points).toEqual([]);
    expect(calorieCorrelation([endingOn(2026, 10, 12, 16)], undefined, { now: NOW }).points).toEqual([]);
  });
});

describe('words for a correlation', () => {
  it.each([[0, 'none'], [0.19, 'none'], [-0.19, 'none'], [0.2, 'weak'], [-0.39, 'weak'], [0.4, 'moderate'], [-0.69, 'moderate'], [0.7, 'strong'], [-1, 'strong'], [null, 'none'], [NaN, 'none']])(
    'r = %p is %p',
    (r, word) => {
      expect(correlationStrength(r)).toBe(word);
    },
  );

  it('waits for enough dots before saying anything', () => {
    expect(MIN_CORRELATION_POINTS).toBe(5);
    expect(correlationSentence('weight', { n: 4, r: -0.9 })).toBeNull();
    expect(correlationSentence('weight', null)).toBeNull();
    expect(correlationSentence('nonsense', { n: 9, r: -0.9 })).toBeNull();
  });

  it('says which way weight went with longer fasts', () => {
    expect(correlationSentence('weight', { n: 8, r: -0.5 })).toBe('Across 8 weeks, longer fasts went with moderately lower weight.');
    expect(correlationSentence('weight', { n: 6, r: 0.3 })).toBe('Across 6 weeks, longer fasts went with slightly higher weight.');
    expect(correlationSentence('weight', { n: 12, r: -0.85 })).toBe('Across 12 weeks, longer fasts went with clearly lower weight.');
  });

  it('says which way calories went with longer fasts', () => {
    expect(correlationSentence('calories', { n: 14, r: -0.45 })).toBe('Across 14 days, longer fasts went with moderately fewer calories logged.');
    expect(correlationSentence('calories', { n: 9, r: 0.8 })).toBe('Across 9 days, longer fasts went with clearly more calories logged.');
  });

  it('says there is no clear link when r is small or missing', () => {
    expect(correlationSentence('weight', { n: 7, r: 0.05 })).toBe('No clear link between how long you fast and your weight across 7 weeks.');
    expect(correlationSentence('calories', { n: 7, r: null })).toBe('No clear link between how long you fast and what you eat across 7 days.');
  });

  it('writes r with a real minus sign, and never as minus zero', () => {
    expect(formatR(-0.4567)).toBe('r = −0.46');
    expect(formatR(0.5)).toBe('r = 0.50');
    expect(formatR(-0.001)).toBe('r = 0.00');
    expect(formatR(null)).toBeNull();
    expect(formatR(NaN)).toBeNull();
  });
});

describe('moving the start of a running fast', () => {
  const started = at([2026, 10, 12, 8, 30]);

  it('moves it by the amount asked', () => {
    expect(shiftFastStart(started, -3600000, NOW)).toEqual(at([2026, 10, 12, 7, 30]));
    expect(shiftFastStart(started, 15 * 60000, NOW)).toEqual(at([2026, 10, 12, 8, 45]));
  });

  it('never moves it into the future', () => {
    expect(shiftFastStart(at([2026, 10, 12, 13, 50]), 3600000, NOW)).toEqual(NOW);
    expect(shiftFastStart(NOW, 15 * 60000, NOW)).toEqual(NOW);
  });

  it('never moves it more than 72 hours back', () => {
    expect(MAX_BACKDATE_MS).toBe(72 * H);
    const limit = new Date(NOW.getTime() - 72 * H);
    expect(shiftFastStart(new Date(limit.getTime() + 600000), -3600000, NOW)).toEqual(limit);
    expect(shiftFastStart(limit, -3600000, NOW)).toEqual(limit);
  });

  it('starts from now when there is no start to move', () => {
    expect(shiftFastStart(null, -3600000, NOW)).toEqual(new Date(NOW.getTime() - 3600000));
  });

  it('works out when the goal is reached', () => {
    expect(goalTime(started, 16)).toEqual(at([2026, 10, 13, 0, 30]));
    expect(goalTime(started.toISOString(), 13)).toEqual(at([2026, 10, 12, 21, 30]));
  });
});

describe('words and clocks', () => {
  it.each([[[2026, 10, 12, 0, 5], '12:05 AM'], [[2026, 10, 12, 9, 30], '9:30 AM'], [[2026, 10, 12, 12, 0], '12:00 PM'], [[2026, 10, 12, 13, 7], '1:07 PM'], [[2026, 10, 12, 23, 59], '11:59 PM']])(
    'writes %p as %p',
    (parts, text) => {
      expect(formatClock(at(parts))).toBe(text);
    },
  );
  it('writes nothing for a bad date', () => {
    expect(formatClock('nope')).toBe('');
    expect(formatClock(null)).toBe('');
    expect(formatDayLabel(null, NOW)).toBe('');
  });

  it('names the day', () => {
    expect(formatDayLabel(at([2026, 10, 12, 1]), NOW)).toBe('Today');
    expect(formatDayLabel(at([2026, 10, 11, 23]), NOW)).toBe('Yesterday');
    expect(formatDayLabel(at([2026, 10, 10, 12]), NOW)).toBe('Sat, Oct 10');
    expect(formatDayLabel(at([2026, 12, 25, 12]), NOW)).toBe('Fri, Dec 25');
  });

  it('puts the day and the time together', () => {
    expect(formatStartLabel(at([2026, 10, 11, 20, 12]), NOW)).toBe('Yesterday, 8:12 PM');
  });

  it.each([[0, '0m'], [59 * 60000, '59m'], [3600000, '1h'], [16 * H + 24 * 60000, '16h 24m'], [-5000, '0m'], [NaN, '0m'], [90 * 1000, '1m']])(
    'writes %p ms as %p',
    (ms, text) => {
      expect(formatDuration(ms)).toBe(text);
    },
  );

  it.each([[16, '16h'], [15.5, '15.5h'], [15.04, '15h'], [0, '0h'], [NaN, '0h'], [undefined, '0h']])('writes %p hours as %p', (h, text) => {
    expect(formatHours(h)).toBe(text);
  });
});

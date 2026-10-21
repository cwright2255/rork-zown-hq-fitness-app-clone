// The daily record of sleep, HRV and resting heart rate, and the trends drawn from it (lib/dailyReadings.js).
import {
  READINGS_KEEP_DAYS, READING_RANGES, MIN_NIGHT_HOURS, MIN_READINGS_TO_COMPARE,
  cleanReading, normalizeReadings, mergeReadings, withReadingsOn, readingsFromHealthKit,
  lastDays, readingByDay, weightByDay, trendSeries, trendGeometry, nearestDot, shortDay, formatValue, formatChange,
} from '../lib/dailyReadings';
import { KG_TO_LB } from '../lib/macroWeightData';
import { shiftDateKey } from '../lib/localDate';

const TODAY = '2026-10-20';
const day = (offset) => shiftDateKey(TODAY, offset);
// Local-time moments, so these tests give the same answer in any time zone.
const at = (offset, hour, minute = 0) => new Date(2026, 9, 20 + offset, hour, minute);

describe('the readings that can be believed', () => {
  it('are these, and no others', () => {
    expect(READING_RANGES).toEqual({
      restingHeartRate: { min: 25, max: 220 },
      hrv: { min: 1, max: 400 },
      sleepHours: { min: 0.1, max: 20 },
    });
  });

  it('end where they say', () => {
    expect([cleanReading('restingHeartRate', 24.9), cleanReading('restingHeartRate', 25), cleanReading('restingHeartRate', 220), cleanReading('restingHeartRate', 220.1)]).toEqual([null, 25, 220, null]);
    expect([cleanReading('hrv', 0.9), cleanReading('hrv', 1), cleanReading('hrv', 400), cleanReading('hrv', 400.1)]).toEqual([null, 1, 400, null]);
    expect([cleanReading('sleepHours', 0.09), cleanReading('sleepHours', 0.1), cleanReading('sleepHours', 20), cleanReading('sleepHours', 20.1)]).toEqual([null, 0.1, 20, null]);
  });
});

describe('cleanReading', () => {
  it('keeps a believable reading, to a tenth', () => {
    expect(cleanReading('restingHeartRate', 58)).toBe(58);
    expect(cleanReading('hrv', 41.64)).toBe(41.6);
    expect(cleanReading('sleepHours', '7.46')).toBe(7.5);
  });

  it('accepts the ends of each range and nothing beyond them', () => {
    for (const [field, { min, max }] of Object.entries(READING_RANGES)) {
      expect(cleanReading(field, min)).toBe(min);
      expect(cleanReading(field, max)).toBe(max);
      expect(cleanReading(field, min - 0.5)).toBeNull();
      expect(cleanReading(field, max + 0.5)).toBeNull();
    }
  });

  it.each([[null], [undefined], [''], ['  '], ['n/a'], [NaN], [Infinity], [true], [false], [0], [-5], [{}], [[]]])('drops %p', (value) => {
    expect(cleanReading('restingHeartRate', value)).toBeNull();
    expect(cleanReading('sleepHours', value)).toBeNull();
  });

  it('knows only the three readings', () => {
    expect(cleanReading('weight', 70)).toBeNull();
    expect(cleanReading(undefined, 70)).toBeNull();
  });
});

describe('normalizeReadings', () => {
  it('keeps real days with believable readings and drops the rest of each day', () => {
    expect(normalizeReadings({
      '2026-10-19': { restingHeartRate: 58, hrv: 0, sleepHours: 7.2, extra: 9 },
      '2026-10-20': { hrv: 44.44 },
    })).toEqual({
      '2026-10-19': { restingHeartRate: 58, sleepHours: 7.2 },
      '2026-10-20': { hrv: 44.4 },
    });
  });

  it('drops days that are not real calendar days, or have nothing believable', () => {
    expect(normalizeReadings({
      '2026-02-30': { hrv: 40 }, 'yesterday': { hrv: 40 }, '2026-10-18': {}, '2026-10-17': { hrv: 'x' }, '2026-10-16': null, '2026-10-15': 'x',
    })).toEqual({});
  });

  it.each([[null], [undefined], ['x'], [5], [[]], [[{ hrv: 40 }]]])('gives {} for %p', (value) => {
    expect(normalizeReadings(value)).toEqual({});
  });

  it('keeps the newest READINGS_KEEP_DAYS days, in date order', () => {
    const many = {};
    for (let i = 0; i < READINGS_KEEP_DAYS + 5; i += 1) many[shiftDateKey('2025-01-01', i)] = { restingHeartRate: 60 };
    const out = normalizeReadings(many);
    const days = Object.keys(out);
    expect(days).toHaveLength(READINGS_KEEP_DAYS);
    expect(days[0]).toBe(shiftDateKey('2025-01-01', 5));
    expect(days[days.length - 1]).toBe(shiftDateKey('2025-01-01', READINGS_KEEP_DAYS + 4));
    expect(days).toEqual([...days].sort());
  });

  it('keeps the newest days even when they were given out of order', () => {
    const many = {};
    for (let i = READINGS_KEEP_DAYS + 5; i >= 0; i -= 1) many[shiftDateKey('2025-01-01', i)] = { hrv: 40 };
    const days = Object.keys(normalizeReadings(many));
    expect(days).toHaveLength(READINGS_KEEP_DAYS);
    expect(days[0]).toBe(shiftDateKey('2025-01-01', 6));
    expect(days[days.length - 1]).toBe(shiftDateKey('2025-01-01', READINGS_KEEP_DAYS + 5));
  });

  it('does not change what it is given', () => {
    const given = { '2026-10-20': { hrv: 40.04, bad: 1 } };
    normalizeReadings(given);
    expect(given).toEqual({ '2026-10-20': { hrv: 40.04, bad: 1 } });
  });
});

describe('mergeReadings and withReadingsOn', () => {
  const base = { '2026-10-18': { restingHeartRate: 58, hrv: 40 }, '2026-10-19': { sleepHours: 7 } };

  it('puts the newer readings on top, reading by reading', () => {
    expect(mergeReadings(base, { '2026-10-18': { hrv: 45 }, '2026-10-20': { sleepHours: 8 } })).toEqual({
      '2026-10-18': { restingHeartRate: 58, hrv: 45 },
      '2026-10-19': { sleepHours: 7 },
      '2026-10-20': { sleepHours: 8 },
    });
  });

  it('keeps what was there when the newer reading is not believable', () => {
    expect(mergeReadings(base, { '2026-10-18': { hrv: 0, restingHeartRate: 'x' } })).toEqual(base);
  });

  it('copes with nothing on either side', () => {
    expect(mergeReadings(null, base)).toEqual(base);
    expect(mergeReadings(base, undefined)).toEqual(base);
    expect(mergeReadings(null, null)).toEqual({});
  });

  it('files one day\'s readings', () => {
    expect(withReadingsOn(base, '2026-10-20', { hrv: 50 })).toEqual({ ...base, '2026-10-20': { hrv: 50 } });
    expect(withReadingsOn(base, 'not a day', { hrv: 50 })).toEqual(base);
    expect(withReadingsOn({}, '2026-10-20', { hrv: 0 })).toEqual({});
  });

  it('does not change what it is given', () => {
    const copy = JSON.parse(JSON.stringify(base));
    mergeReadings(base, { '2026-10-18': { hrv: 99 } });
    expect(base).toEqual(copy);
  });
});

describe('readingsFromHealthKit', () => {
  const quantity = (when, value) => ({ startDate: when, endDate: when, quantity: value });
  const asleep = (value, from, to) => ({ value, startDate: from, endDate: to });
  const read = (samples) => readingsFromHealthKit(samples, TODAY, 28);

  it('takes the latest resting heart rate of each day', () => {
    expect(read({ restingHr: [quantity(at(-1, 6), 60), quantity(at(-1, 20), 57), quantity(at(-1, 12), 58), quantity(at(0, 7), 55)] })).toEqual({
      [day(-1)]: { restingHeartRate: 57 },
      [day(0)]: { restingHeartRate: 55 },
    });
  });

  it('averages the HRV samples of each day', () => {
    expect(read({ hrv: [quantity(at(-2, 3), 40), quantity(at(-2, 4), 50), quantity(at(-2, 5), 60), quantity(at(-1, 3), 33)] })).toEqual({
      [day(-2)]: { hrv: 50 },
      [day(-1)]: { hrv: 33 },
    });
  });

  it('adds up the time asleep, and files a night that crosses midnight under the day the person woke up', () => {
    const out = read({ sleep: [
      asleep(3, at(-1, 23), at(0, 2)), // core, 3 h, before and after midnight
      asleep(4, at(0, 2), at(0, 4)), // deep, 2 h
      asleep(5, at(0, 4), at(0, 6, 30)), // REM, 2.5 h
    ] });
    expect(out).toEqual({ [day(0)]: { sleepHours: 7.5 } });
  });

  it('puts the part of a night before midnight with the part after it, not on the day before', () => {
    const out = read({ sleep: [asleep(3, at(-1, 22), at(-1, 23, 45)), asleep(3, at(0, 0, 15), at(0, 6))] });
    expect(Object.keys(out)).toEqual([day(0)]);
    expect(out[day(0)].sleepHours).toBe(7.5);
  });

  it('counts the same night once when two devices both recorded it', () => {
    const out = read({ sleep: [asleep(3, at(-1, 23), at(0, 7)), asleep(1, at(-1, 23, 30), at(0, 6)), asleep(4, at(-1, 23), at(0, 7))] });
    expect(out).toEqual({ [day(0)]: { sleepHours: 8 } });
  });

  it('adds spans that follow each other, and counts a span inside another span only once', () => {
    const out = read({ sleep: [asleep(3, at(0, 0), at(0, 2)), asleep(3, at(0, 2), at(0, 5)), asleep(4, at(0, 3), at(0, 4)), asleep(5, at(0, 6), at(0, 7))] });
    expect(out).toEqual({ [day(0)]: { sleepHours: 6 } });
  });

  it('leaves out the time in bed or awake', () => {
    const out = read({ sleep: [asleep(0, at(-1, 21), at(0, 9)), asleep(2, at(0, 6), at(0, 7, 30)), asleep(3, at(-1, 23), at(0, 6))] });
    expect(out).toEqual({ [day(0)]: { sleepHours: 7 } });
  });

  it('counts sleep the watch could not sort into stages', () => {
    expect(read({ sleep: [asleep(1, at(-1, 23), at(0, 6, 30))] })).toEqual({ [day(0)]: { sleepHours: 7.5 } });
  });

  it('files a sleep that ends in the evening under the next day, and one that ends in the afternoon under the same day', () => {
    expect(read({ sleep: [asleep(3, at(-1, 16, 30), at(-1, 18, 30))] })).toEqual({ [day(0)]: { sleepHours: 2 } });
    expect(read({ sleep: [asleep(3, at(-1, 15, 30), at(-1, 17, 30))] })).toEqual({ [day(-1)]: { sleepHours: 2 } });
  });

  it('is not thrown off by a sample with a start after its end, or a date it cannot read, among a real night', () => {
    const night = asleep(3, at(-1, 23), at(0, 6));
    expect(read({ sleep: [night, asleep(3, at(0, 10), at(0, 9))] })).toEqual({ [day(0)]: { sleepHours: 7 } });
    expect(read({ sleep: [night, asleep(3, 'bad', at(0, 4))] })).toEqual({ [day(0)]: { sleepHours: 7 } });
    expect(read({ sleep: [night, asleep(3, at(0, 2), 'bad')] })).toEqual({ [day(0)]: { sleepHours: 7 } });
  });

  it('reads the stages when the library names them', () => {
    const out = read({ sleep: [asleep('asleepCore', at(0, 0), at(0, 3)), asleep('asleepDeep', at(0, 3), at(0, 4)), asleep('asleepREM', at(0, 4), at(0, 5)), asleep('asleepUnspecified', at(0, 5), at(0, 6)), asleep('asleep', at(0, 6), at(0, 7)), asleep('inBed', at(0, 7), at(0, 9))] });
    expect(out).toEqual({ [day(0)]: { sleepHours: 7 } });
  });

  it('does not count a nap, or a watch that was barely worn, as a night', () => {
    expect(MIN_NIGHT_HOURS).toBe(2);
    expect(read({ sleep: [asleep(3, at(0, 14), at(0, 15, 30))] })).toEqual({});
    expect(read({ sleep: [asleep(3, at(0, 2), at(0, 4))] })).toEqual({ [day(0)]: { sleepHours: 2 } });
  });

  it('leaves out days outside the window', () => {
    const out = readingsFromHealthKit({ restingHr: [quantity(at(-28, 8), 60), quantity(at(-27, 8), 61), quantity(at(1, 8), 62)] }, TODAY, 28);
    expect(out).toEqual({ [day(-27)]: { restingHeartRate: 61 } });
  });

  it('puts every reading of a day together', () => {
    const out = read({ restingHr: [quantity(at(0, 7), 56)], hrv: [quantity(at(0, 3), 48)], sleep: [asleep(3, at(-1, 23), at(0, 6))] });
    expect(out).toEqual({ [day(0)]: { restingHeartRate: 56, hrv: 48, sleepHours: 7 } });
  });

  it('drops readings that are not believable, and samples it cannot read', () => {
    const out = read({
      restingHr: [quantity(at(0, 7), 0), quantity('not a date', 60), { startDate: at(-1, 7) }, null, undefined],
      hrv: [quantity(at(0, 3), 'x'), quantity(at(-1, 3), 9999), { startDate: at(-2, 3), quantity: null }, null],
      sleep: [asleep(3, at(0, 6), at(0, 2)), asleep(3, 'bad', at(0, 4)), asleep(3, at(0, 1), 'bad'), asleep(undefined, at(0, 0), at(0, 7)), asleep(99, at(0, 0), at(0, 7)), null, undefined],
    });
    expect(out).toEqual({});
  });

  it('gives nothing for nothing', () => {
    expect(readingsFromHealthKit(undefined, TODAY, 28)).toEqual({});
    expect(readingsFromHealthKit({}, TODAY, 28)).toEqual({});
    expect(readingsFromHealthKit({ restingHr: null, hrv: null, sleep: null }, TODAY, 28)).toEqual({});
    expect(readingsFromHealthKit({ restingHr: [quantity(at(0, 7), 60)] }, 'bad day', 28)).toEqual({});
    expect(readingsFromHealthKit({ restingHr: [quantity(at(0, 7), 60)] }, TODAY, 0)).toEqual({});
  });
});

describe('lastDays', () => {
  it('lists the days ending today, oldest first', () => {
    expect(lastDays(TODAY, 3)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
    expect(lastDays(TODAY, 1)).toEqual([TODAY]);
    expect(lastDays('2026-03-02', 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it.each([[0], [-1], [1.5], ['7'], [null]])('is empty for a count of %p', (count) => {
    expect(lastDays(TODAY, count)).toEqual([]);
  });

  it('is empty for a day that is not one', () => {
    expect(lastDays('nope', 7)).toEqual([]);
    expect(lastDays(null, 7)).toEqual([]);
  });
});

describe('readingByDay', () => {
  it('gives one reading, for the days that have it', () => {
    const history = { [day(-1)]: { hrv: 40, sleepHours: 7 }, [day(0)]: { hrv: 44 }, [day(-2)]: { sleepHours: 6 } };
    expect(readingByDay(history, 'hrv')).toEqual({ [day(-1)]: 40, [day(0)]: 44 });
    expect(readingByDay(history, 'sleepHours')).toEqual({ [day(-2)]: 6, [day(-1)]: 7 });
    expect(readingByDay(history, 'restingHeartRate')).toEqual({});
    expect(readingByDay(null, 'hrv')).toEqual({});
  });
});

describe('weightByDay', () => {
  const log = (isoOrDate, weightKg) => ({ createdAtLocal: isoOrDate, weightKg });

  it('gives the last weight logged each day, in kilograms', () => {
    const logs = [log(at(-1, 7).toISOString(), 80), log(at(-1, 21).toISOString(), 79.4), log(at(-1, 12).toISOString(), 81), log(at(0, 8).toISOString(), 79)];
    expect(weightByDay(logs)).toEqual({ [day(-1)]: 79.4, [day(0)]: 79 });
  });

  it('turns kilograms into pounds when asked', () => {
    expect(weightByDay([log(at(0, 8).toISOString(), 80)], { pounds: true })).toEqual({ [day(0)]: Math.round(80 * KG_TO_LB * 10) / 10 });
    expect(weightByDay([log(at(0, 8).toISOString(), 80)], { pounds: false })).toEqual({ [day(0)]: 80 });
  });

  it('files a weight logged late in the evening under that evening\'s day', () => {
    expect(weightByDay([log(at(0, 23, 30).toISOString(), 80)])).toEqual({ [day(0)]: 80 });
  });

  it('reads a Firestore timestamp, and falls back to createdAt', () => {
    const stamp = { toDate: () => at(0, 9) };
    expect(weightByDay([{ createdAt: stamp, weightKg: 78 }])).toEqual({ [day(0)]: 78 });
    expect(weightByDay([{ createdAtLocal: stamp, weightKg: 77 }])).toEqual({ [day(0)]: 77 });
  });

  it('skips logs it cannot use', () => {
    const logs = [log('bad', 80), log(null, 80), log(at(0, 8).toISOString(), 0), log(at(0, 8).toISOString(), -3), log(at(0, 8).toISOString(), null),
      log(at(0, 8).toISOString(), ''), log(at(0, 8).toISOString(), 'x'), log(at(0, 8).toISOString(), true), null, undefined, {}];
    expect(weightByDay(logs)).toEqual({});
  });

  it.each([[null], [undefined], ['x'], [{}]])('gives {} for %p', (logs) => {
    expect(weightByDay(logs)).toEqual({});
  });
});

describe('trendSeries', () => {
  const series = (entries, days = 7) => {
    const map = {};
    for (const [offset, value] of entries) map[day(offset)] = value;
    return trendSeries(map, TODAY, days);
  };

  it('has one point for each day of the window, oldest first, with a gap where there is no reading', () => {
    const s = series([[-6, 60], [-3, 62], [0, 64]]);
    expect(s.days).toBe(7);
    expect(s.points.map((p) => p.day)).toEqual(lastDays(TODAY, 7));
    expect(s.points.map((p) => p.value)).toEqual([60, null, null, 62, null, null, 64]);
    expect(s.count).toBe(3);
  });

  it('gives the newest reading and the average of the window', () => {
    const s = series([[-5, 60], [-2, 63], [-1, 66]]);
    expect(s.latest).toEqual({ day: day(-1), value: 66 });
    expect(s.average).toBe(63);
  });

  it('gives the lowest and the highest reading of the window', () => {
    const s = series([[-5, 60], [-2, 63], [-1, 57], [-8, 10], [1, 99]]);
    expect(s.min).toBe(57);
    expect(s.max).toBe(63);
    expect(series([[0, 61]])).toMatchObject({ min: 61, max: 61 });
    expect(series([[-2, 0], [0, -4]])).toMatchObject({ min: -4, max: 0 });
    expect(series([])).toMatchObject({ min: null, max: null });
  });

  it('leaves out readings from before the window and from tomorrow', () => {
    const s = series([[-7, 10], [-8, 10], [1, 99], [0, 50]]);
    expect(s.count).toBe(1);
    expect(s.average).toBe(50);
  });

  it('compares with the same number of days before once both have enough readings', () => {
    expect(MIN_READINGS_TO_COMPARE).toBe(3);
    const s = series([[-6, 60], [-3, 62], [0, 64], [-8, 58], [-10, 58], [-12, 58]]);
    expect(s.average).toBe(62);
    expect(s.change).toBe(4);
  });

  it('gives no comparison with too few readings in either period', () => {
    expect(series([[-6, 60], [-3, 62], [-8, 58], [-10, 58], [-12, 58]]).change).toBeNull();
    expect(series([[-6, 60], [-3, 62], [0, 64], [-8, 58], [-10, 58]]).change).toBeNull();
    expect(series([[-6, 60], [-3, 62], [0, 64]]).change).toBeNull();
  });

  it('compares a 28-day window with the 28 days before it', () => {
    const s = series([[-27, 50], [-14, 52], [0, 54], [-28, 40], [-40, 44], [-55, 48]], 28);
    expect(s.average).toBe(52);
    expect(s.change).toBe(8);
  });

  it('says what it does not have: no average, no newest reading', () => {
    const s = series([]);
    expect(s).toMatchObject({ count: 0, latest: null, average: null, change: null });
    expect(s.points).toHaveLength(7);
    expect(s.points.every((p) => p.value === null)).toBe(true);
  });

  it('ignores values that are not numbers', () => {
    const s = trendSeries({ [day(0)]: '60', [day(-1)]: NaN, [day(-2)]: null, [day(-3)]: Infinity, [day(-4)]: 61 }, TODAY, 7);
    expect(s.count).toBe(1);
    expect(s.latest).toEqual({ day: day(-4), value: 61 });
  });

  it('copes with nothing', () => {
    expect(trendSeries(null, TODAY, 7).count).toBe(0);
    expect(trendSeries(undefined, TODAY, 7).average).toBeNull();
    expect(trendSeries({}, 'bad', 7).points).toEqual([]);
  });
});

describe('trendGeometry', () => {
  const pt = (d, value) => ({ day: d, value });

  it('has nothing to draw without a reading', () => {
    expect(trendGeometry([], 100, 50)).toBeNull();
    expect(trendGeometry([pt('a', null), pt('b', null)], 100, 50)).toBeNull();
    expect(trendGeometry(null, 100, 50)).toBeNull();
    expect(trendGeometry([pt('a', NaN), pt('b', 'x')], 100, 50)).toBeNull();
  });

  it('puts a dot on each reading, a higher reading higher up, and breaks the line at a gap', () => {
    const g = trendGeometry([pt('d0', 10), pt('d1', 20), pt('d2', null), pt('d3', 15)], 100, 50);
    expect(g.dots).toEqual([
      { index: 0, day: 'd0', value: 10, x: 10, y: 38.5 },
      { index: 1, day: 'd1', value: 20, x: 36.7, y: 15.5 },
      { index: 3, day: 'd3', value: 15, x: 90, y: 27 },
    ]);
    expect(g.paths).toEqual(['M10 38.5 L36.7 15.5']);
  });

  it('joins days that follow each other, and starts a new line after a gap', () => {
    const g = trendGeometry([pt('a', 10), pt('b', 20), pt('c', 10), pt('d', null), pt('e', 20), pt('f', 10)], 100, 50);
    expect(g.paths).toHaveLength(2);
    expect(g.paths[0].startsWith('M')).toBe(true);
    expect(g.paths[0].match(/L/g)).toHaveLength(2);
    expect(g.paths[1].match(/L/g)).toHaveLength(1);
  });

  it('draws a lone reading as a dot with no line, in the middle', () => {
    const g = trendGeometry([pt('a', 60)], 100, 50);
    expect(g.paths).toEqual([]);
    expect(g.dots).toEqual([{ index: 0, day: 'a', value: 60, x: 50, y: 27 }]);
  });

  it('draws readings that do not change as a level line in the middle', () => {
    const g = trendGeometry([pt('a', 5), pt('b', 5), pt('c', 5)], 100, 50);
    expect(g.dots.map((d) => d.y)).toEqual([27, 27, 27]);
    expect(g.paths).toEqual(['M10 27 L50 27 L90 27']);
  });

  it('keeps every dot inside the box', () => {
    const g = trendGeometry([pt('a', 1), pt('b', 1000), pt('c', 500), pt('d', 2)], 300, 120);
    for (const d of g.dots) {
      expect(d.x).toBeGreaterThanOrEqual(10);
      expect(d.x).toBeLessThanOrEqual(290);
      expect(d.y).toBeGreaterThanOrEqual(12);
      expect(d.y).toBeLessThanOrEqual(112);
    }
  });

  it('takes the room around the box from the padding it is given', () => {
    const g = trendGeometry([pt('a', 1), pt('b', 3)], 100, 100, { top: 0, bottom: 0, left: 0, right: 0 });
    expect(g.dots[0].x).toBe(0);
    expect(g.dots[1].x).toBe(100);
  });
});

describe('nearestDot', () => {
  const dots = [{ index: 0, x: 10 }, { index: 3, x: 40 }, { index: 6, x: 70 }];

  it('picks the dot closest to the touch, on either side', () => {
    expect(nearestDot(dots, 0).index).toBe(0);
    expect(nearestDot(dots, 24).index).toBe(0);
    expect(nearestDot(dots, 26).index).toBe(3);
    expect(nearestDot(dots, 54).index).toBe(3);
    expect(nearestDot(dots, 56).index).toBe(6);
    expect(nearestDot(dots, 500).index).toBe(6);
  });

  it('picks the earlier of two equally close dots', () => {
    expect(nearestDot(dots, 25).index).toBe(0);
    expect(nearestDot(dots, 55).index).toBe(3);
  });

  it('picks the only dot there is', () => {
    expect(nearestDot([{ index: 4, x: 50 }], 3).index).toBe(4);
  });

  it.each([[[]], [null], [undefined], ['x']])('finds nothing in %p', (list) => {
    expect(nearestDot(list, 10)).toBeNull();
  });
});

describe('words and numbers for the charts', () => {
  it('writes a short day', () => {
    expect(shortDay('2026-10-14')).toBe('Oct 14');
    expect(shortDay('2026-01-01')).toBe('Jan 1');
    expect(shortDay('2026-12-31')).toBe('Dec 31');
    expect(shortDay('nope')).toBe('nope');
  });

  it('writes a reading with its unit', () => {
    expect(formatValue(58.4, { unit: 'bpm' })).toBe('58 bpm');
    expect(formatValue(7.46, { decimals: 1, unit: 'h' })).toBe('7.5 h');
    expect(formatValue(176.46, { decimals: 1 })).toBe('176.5');
    expect(formatValue(0, { unit: 'ms' })).toBe('0 ms');
  });

  it.each([[null], [undefined], [NaN], ['5'], [Infinity]])('writes nothing for %p', (value) => {
    expect(formatValue(value, { unit: 'bpm' })).toBe('');
    expect(formatChange(value, { unit: 'bpm' })).toBe('');
  });

  it('writes a change with its sign', () => {
    expect(formatChange(2.4, { unit: 'bpm' })).toBe('+2 bpm');
    expect(formatChange(-3.6, { unit: 'ms' })).toBe('-4 ms');
    expect(formatChange(-0.44, { decimals: 1, unit: 'h' })).toBe('-0.4 h');
    expect(formatChange(1.26, { decimals: 1, unit: 'lb' })).toBe('+1.3 lb');
  });

  it('says no change when it rounds to nothing', () => {
    expect(formatChange(0, { unit: 'bpm' })).toBe('no change');
    expect(formatChange(0.4, { unit: 'bpm' })).toBe('no change');
    expect(formatChange(-0.04, { decimals: 1, unit: 'h' })).toBe('no change');
  });
});

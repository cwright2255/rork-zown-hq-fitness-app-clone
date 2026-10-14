// lib/activity.js turns workouts, runs and hikes into one list of sessions, so a streak, a challenge or a mission
// counts a person who trains by running or hiking the same as one who lifts.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import {
  sessionsOf, sessionsBetween, countOnDay, countSince, distinctDays, activeDays, activityStreak,
} from '../lib/activity';

const EVENING_UTC = '2026-10-15T01:30:00.000Z'; // 9:30 PM Wed 14 Oct in New Jersey
const workout = (completedAt, extra = {}) => ({ id: `w-${completedAt}`, completedAt, ...extra });
const run = (endTime, extra = {}) => ({ id: `r-${endTime}`, startTime: endTime, endTime, ...extra });
const hike = (completedAt, extra = {}) => ({ id: `h-${completedAt}`, completedAt, ...extra });

describe('sessionsOf', () => {
  it('puts workouts, runs and hikes in one list, in that order, each with its kind', () => {
    const list = sessionsOf({
      workouts: [workout('2026-10-10T15:00:00Z')],
      runs: [run('2026-10-11T15:00:00Z')],
      hikes: [hike('2026-10-12T15:00:00Z')],
    });
    expect(list.map((s) => s.kind)).toEqual(['workout', 'run', 'hike']);
    expect(list.map((s) => s.dayKey)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
    expect(list[2].ms).toBe(Date.parse('2026-10-12T15:00:00Z'));
  });

  it('puts a 9 PM session on the person\'s own day, not the UTC day', () => {
    const list = sessionsOf({ workouts: [workout(EVENING_UTC)], runs: [run(EVENING_UTC)], hikes: [hike(EVENING_UTC)] });
    expect(list.map((s) => s.dayKey)).toEqual(['2026-10-14', '2026-10-14', '2026-10-14']);
  });

  it('finishes a run by its end time and falls back to its start, and a hike by completedAt then startTime', () => {
    const list = sessionsOf({
      runs: [{ id: 'a', startTime: '2026-10-11T15:00:00Z', endTime: '2026-10-11T16:00:00Z' }, { id: 'b', startTime: '2026-10-12T15:00:00Z' }],
      hikes: [{ id: 'c', startTime: '2026-10-13T15:00:00Z', completedAt: '2026-10-13T18:00:00Z' }, { id: 'd', startTime: '2026-10-14T15:00:00Z' }],
    });
    expect(list.map((s) => s.ms)).toEqual([
      Date.parse('2026-10-11T16:00:00Z'), Date.parse('2026-10-12T15:00:00Z'),
      Date.parse('2026-10-13T18:00:00Z'), Date.parse('2026-10-14T15:00:00Z'),
    ]);
  });

  it('finishes a workout by completedAt, then date, then timestamp', () => {
    const list = sessionsOf({
      workouts: [
        { id: 1, completedAt: '2026-10-10T15:00:00Z', date: '2026-10-01' },
        { id: 2, date: '2026-10-11' },
        { id: 3, timestamp: '2026-10-12T15:00:00Z' },
      ],
    });
    expect(list.map((s) => s.dayKey)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
  });

  it('reads a Firestore timestamp', () => {
    const stamp = { toDate: () => new Date('2026-10-12T15:00:00Z') };
    const [s] = sessionsOf({ workouts: [{ id: 1, completedAt: stamp }] });
    expect(s.dayKey).toBe('2026-10-12');
    expect(s.ms).toBe(Date.parse('2026-10-12T15:00:00Z'));
  });

  it('leaves out records with no usable time, and copes with missing lists and null records', () => {
    const list = sessionsOf({
      workouts: [null, undefined, 'x', {}, { completedAt: 'not a date' }, { completedAt: false }, workout('2026-10-10T15:00:00Z')],
      runs: [{ startTime: '' }, { id: 'r' }],
      hikes: 'none',
    });
    expect(list).toHaveLength(1);
    expect(sessionsOf()).toEqual([]);
    expect(sessionsOf({})).toEqual([]);
    expect(sessionsOf({ workouts: null, runs: null, hikes: null })).toEqual([]);
  });
});

describe('sessionsBetween, countOnDay, countSince, distinctDays', () => {
  const list = sessionsOf({
    workouts: [workout('2026-10-12T15:00:00Z')],
    runs: [run('2026-10-13T15:00:00Z'), run('2026-10-13T22:00:00Z')],
    hikes: [hike('2026-10-14T15:00:00Z')],
  });

  it('sessionsBetween keeps those inside the window, both ends included', () => {
    const a = Date.parse('2026-10-13T15:00:00Z');
    const b = Date.parse('2026-10-14T15:00:00Z');
    expect(sessionsBetween(list, a, b)).toHaveLength(3);
    expect(sessionsBetween(list, a + 1, b - 1)).toHaveLength(1);
    expect(sessionsBetween(list, b + 1, b + 2)).toHaveLength(0);
    expect(sessionsBetween(undefined, 0, 1)).toEqual([]);
  });

  it('countOnDay counts the sessions on one day, of any kind', () => {
    expect(countOnDay(list, '2026-10-13')).toBe(2);
    expect(countOnDay(list, '2026-10-14')).toBe(1);
    expect(countOnDay(list, '2026-10-15')).toBe(0);
    expect(countOnDay(null, '2026-10-13')).toBe(0);
  });

  it('countSince counts the sessions at or after a moment', () => {
    expect(countSince(list, Date.parse('2026-10-13T15:00:00Z'))).toBe(3);
    expect(countSince(list, Date.parse('2026-10-13T15:00:01Z'))).toBe(2);
    expect(countSince(list, Date.parse('2026-10-20T00:00:00Z'))).toBe(0);
    expect(countSince(undefined, 0)).toBe(0);
  });

  it('distinctDays counts days, not sessions', () => {
    expect(distinctDays(list)).toBe(3);
    expect(distinctDays([])).toBe(0);
    expect(distinctDays(undefined)).toBe(0);
  });
});

describe('activityStreak', () => {
  const streakOf = (days, today = '2026-10-14') => activityStreak(
    sessionsOf({ runs: days.map((d) => run(`${d}T15:00:00Z`)) }),
    today,
  );

  it('is 0 and 0 with nothing done', () => {
    expect(activityStreak([], '2026-10-14')).toEqual({ current: 0, longest: 0 });
    expect(activityStreak(undefined, '2026-10-14')).toEqual({ current: 0, longest: 0 });
  });

  it('counts days in a row ending today', () => {
    expect(streakOf(['2026-10-12', '2026-10-13', '2026-10-14'])).toEqual({ current: 3, longest: 3 });
  });

  it('keeps the streak alive when today is not done yet but yesterday was', () => {
    expect(streakOf(['2026-10-12', '2026-10-13'])).toEqual({ current: 2, longest: 2 });
  });

  it('drops the current streak after a missed day, and remembers the longest', () => {
    expect(streakOf(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-12'])).toEqual({ current: 0, longest: 4 });
    expect(streakOf(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-13', '2026-10-14'])).toEqual({ current: 2, longest: 4 });
  });

  it('counts two sessions on one day as one day', () => {
    const list = sessionsOf({ workouts: [workout('2026-10-14T13:00:00Z')], runs: [run('2026-10-14T20:00:00Z')], hikes: [hike('2026-10-13T20:00:00Z')] });
    expect(activityStreak(list, '2026-10-14')).toEqual({ current: 2, longest: 2 });
  });

  it('joins a workout day, a run day and a hike day into one streak', () => {
    const list = sessionsOf({ workouts: [workout('2026-10-12T15:00:00Z')], runs: [run('2026-10-13T15:00:00Z')], hikes: [hike('2026-10-14T15:00:00Z')] });
    expect(activityStreak(list, '2026-10-14')).toEqual({ current: 3, longest: 3 });
  });

  it('counts a 9 PM run as today, so the streak does not break at night', () => {
    const list = sessionsOf({ runs: [run('2026-10-13T15:00:00Z'), run(EVENING_UTC)] });
    expect(activityStreak(list, '2026-10-14')).toEqual({ current: 2, longest: 2 });
  });

  it('steps by calendar day across a month end and across the clock change', () => {
    expect(streakOf(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'], '2026-10-02')).toEqual({ current: 4, longest: 4 });
    // 1 Nov 2026 is the 25-hour day when the clocks go back
    expect(streakOf(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02')).toEqual({ current: 3, longest: 3 });
    // 8 Mar 2026 is the 23-hour day when the clocks go forward
    expect(streakOf(['2026-03-07', '2026-03-08', '2026-03-09'], '2026-03-09')).toEqual({ current: 3, longest: 3 });
  });

  it('defaults to today in the person\'s own time', () => {
    const night = '2026-11-03T01:30:00.000Z'; // 8:30 PM on Mon 2 Nov in New Jersey, after the clocks went back
    jest.useFakeTimers({ now: new Date(night), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      const list = sessionsOf({ runs: [run('2026-11-02T14:00:00.000Z'), run('2026-11-03T01:00:00.000Z')] });
      expect(activityStreak(list)).toEqual({ current: 1, longest: 1 });
      expect(activityStreak(sessionsOf({ runs: [run('2026-11-01T14:00:00.000Z'), run('2026-11-02T14:00:00.000Z')] }))).toEqual({ current: 2, longest: 2 });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('activeDays', () => {
  it('lists each calendar day with a session once, oldest first, whatever order they come in', () => {
    const list = sessionsOf({
      workouts: [workout('2026-10-14T15:00:00Z'), workout('2026-10-14T13:00:00Z')],
      runs: [run('2026-10-15T01:00:00Z'), run('2026-10-11T15:00:00Z')], // 9 PM on the 14th again; the 11th
      hikes: [hike('2026-10-13T15:00:00Z')],
    });
    expect(activeDays(list)).toEqual(['2026-10-11', '2026-10-13', '2026-10-14']);
  });

  it('is an empty list for nothing, and for something that is not a list', () => {
    expect(activeDays([])).toEqual([]);
    expect(activeDays(undefined)).toEqual([]);
    expect(activeDays(null)).toEqual([]);
    expect(activeDays('none')).toEqual([]);
  });

  it('sorts a month change and a year change in order', () => {
    const list = sessionsOf({ workouts: [workout('2027-01-02T15:00:00Z'), workout('2026-12-31T15:00:00Z'), workout('2026-10-01T15:00:00Z')] });
    expect(activeDays(list)).toEqual(['2026-10-01', '2026-12-31', '2027-01-02']);
  });
});

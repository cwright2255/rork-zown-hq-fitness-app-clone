// A challenge's progress counts every kind of session: a completed workout, a run or walk, and a hike. Before this,
// only workouts counted, so a person who trained by running saw a challenge that never moved.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.

jest.mock('../src/config/firebase', () => ({ db: {} }));

import { useChallengeStore } from '../store/challengeStore';

const getProgress = (...args) => useChallengeStore.getState().getProgress(...args);

const WEEK = { goalType: 'workout_count', goalTarget: 4, startDate: '2026-10-12T00:00:00.000Z', endDate: '2026-10-18T23:59:59.999Z' };
const DAYS = { goalType: 'streak_days', goalTarget: 3, startDate: '2026-10-12T00:00:00.000Z', endDate: '2026-10-18T23:59:59.999Z' };

const workout = (completedAt) => ({ id: `w-${completedAt}`, completedAt });
const run = (at) => ({ id: `r-${at}`, startTime: at, endTime: at, distance: 5, duration: 1500 });
const hike = (at) => ({ id: `h-${at}`, startTime: at, completedAt: at, distanceKm: 6 });

describe('challenge progress: workout_count', () => {
  it('counts workouts, runs and hikes in the window together', () => {
    const p = getProgress(
      WEEK,
      [workout('2026-10-12T15:00:00Z')],
      [run('2026-10-13T15:00:00Z')],
      [hike('2026-10-14T15:00:00Z')],
    );
    expect(p).toEqual({ current: 3, target: 4, percent: 75, completed: false });
  });

  it('completes the challenge for a person who only runs', () => {
    const runs = ['12', '13', '14', '15'].map((d) => run(`2026-10-${d}T15:00:00Z`));
    expect(getProgress(WEEK, [], runs, [])).toEqual({ current: 4, target: 4, percent: 100, completed: true });
  });

  it('completes the challenge for a person who only hikes', () => {
    const hikes = ['12', '13', '14', '15'].map((d) => hike(`2026-10-${d}T15:00:00Z`));
    expect(getProgress(WEEK, [], [], hikes).completed).toBe(true);
  });

  it('does not count a run or hike from outside the window', () => {
    const p = getProgress(
      WEEK,
      [],
      [run('2026-10-11T23:59:59Z'), run('2026-10-19T00:00:00Z')],
      [hike('2026-10-05T15:00:00Z')],
    );
    expect(p.current).toBe(0);
  });

  it('counts a run on the first and the last moment of the window', () => {
    const p = getProgress(WEEK, [], [run('2026-10-12T00:00:00.000Z'), run('2026-10-18T23:59:59.999Z')], []);
    expect(p.current).toBe(2);
  });

  it('still takes just workouts, as it did before, when no runs or hikes are passed', () => {
    const w = [workout('2026-10-12T15:00:00Z'), workout('2026-10-13T15:00:00Z')];
    expect(getProgress(WEEK, w)).toEqual({ current: 2, target: 4, percent: 50, completed: false });
    expect(getProgress(WEEK, w, undefined, undefined).current).toBe(2);
    expect(getProgress(WEEK, w, null, null).current).toBe(2);
  });

  it('caps the percentage at 100 and ignores records it cannot place in time', () => {
    const runs = Array.from({ length: 6 }, (_, i) => run(`2026-10-1${2 + (i % 5)}T15:00:00Z`));
    const p = getProgress(WEEK, [{}, null, { completedAt: 'nope' }], [...runs, null, { startTime: '' }], [{ id: 'x' }]);
    expect(p).toEqual({ current: 6, target: 4, percent: 100, completed: true });
  });

  it('has no progress for no challenge', () => {
    expect(getProgress(null, [], [], [])).toBeNull();
  });
});

describe('challenge progress: streak_days', () => {
  it('counts the days that had a workout, a run or a hike', () => {
    const p = getProgress(
      DAYS,
      [workout('2026-10-12T15:00:00Z')],
      [run('2026-10-13T15:00:00Z')],
      [hike('2026-10-14T15:00:00Z')],
    );
    expect(p).toEqual({ current: 3, target: 3, percent: 100, completed: true });
  });

  it('counts two sessions on the same day as one day', () => {
    const p = getProgress(
      DAYS,
      [workout('2026-10-12T14:00:00Z')],
      [run('2026-10-12T20:00:00Z')],
      [hike('2026-10-12T21:00:00Z')],
    );
    expect(p.current).toBe(1);
  });

  it('counts an evening run and an afternoon workout on the same local day as one day, though UTC says two', () => {
    // 3 PM (19:00Z) and 9:30 PM (01:30Z the next day) on Tue 13 Oct in New Jersey
    const p = getProgress(DAYS, [workout('2026-10-13T19:00:00Z')], [run('2026-10-14T01:30:00Z')], []);
    expect(p.current).toBe(1);
  });

  it('still counts the days when only workouts are passed', () => {
    const p = getProgress(DAYS, [workout('2026-10-12T15:00:00Z'), workout('2026-10-14T15:00:00Z')]);
    expect(p.current).toBe(2);
  });

  it('reads a workout that only has a date', () => {
    const p = getProgress(DAYS, [{ id: 1, date: '2026-10-13T15:00:00Z' }, { id: 2, timestamp: '2026-10-14T15:00:00Z' }], [], []);
    expect(p.current).toBe(2);
  });
});

describe('challenge progress: an open-ended challenge', () => {
  it('runs from the start date to now when there is no end date', () => {
    jest.useFakeTimers({ now: new Date('2026-10-15T01:30:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      const open = { goalType: 'workout_count', goalTarget: 2, startDate: '2026-10-12T00:00:00.000Z' };
      const p = getProgress(open, [], [run('2026-10-13T15:00:00Z'), run('2026-10-16T15:00:00Z')], [hike('2026-10-14T15:00:00Z')]);
      expect(p.current).toBe(2); // the run on the 16th has not happened yet
    } finally {
      jest.useRealTimers();
    }
  });
});

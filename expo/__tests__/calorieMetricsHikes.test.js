// The Calories card and the calorie history count hikes with workouts and runs.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import { computeCalorieMetrics } from '../lib/calorieMetrics';

const NOW = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const workout = (completedAt, caloriesBurned, extra = {}) => ({ id: completedAt, completedAt, caloriesBurned, duration: 1800, category: 'Strength', ...extra });
const run = (startTime, calories, extra = {}) => ({ id: startTime, startTime, calories, duration: 1500, ...extra });
const hike = (startTime, calories, extra = {}) => ({ id: startTime, startTime, completedAt: startTime, calories, durationSeconds: 7200, ...extra });

beforeEach(() => { jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }); });
afterEach(() => { jest.useRealTimers(); });

describe('computeCalorieMetrics with hikes', () => {
  it('adds a hike to today, to the week and to the lifetime total', () => {
    const m = computeCalorieMetrics(
      [workout('2026-10-14T13:00:00Z', 300)],
      [run('2026-10-14T14:00:00Z', 200)],
      null, 0,
      [hike('2026-10-14T15:00:00Z', 900)],
    );
    expect(m.todayCalories).toBe(1400);
    expect(m.weeklyTotal).toBe(1400);
    expect(m.lifetimeCalories).toBe(1400);
    expect(m.totalSessions).toBe(3);
  });

  it('shows hikes as their own category in the breakdown', () => {
    const m = computeCalorieMetrics([workout('2026-10-14T13:00:00Z', 300)], [run('2026-10-14T14:00:00Z', 200)], null, 0, [hike('2026-10-14T15:00:00Z', 900)]);
    expect(m.categoryBreakdown).toEqual([
      { category: 'Hiking', calories: 900 },
      { category: 'Strength', calories: 300 },
      { category: 'Running', calories: 200 },
    ]);
  });

  it('lists a hike among the entries for the history screen, with its duration and kind', () => {
    const m = computeCalorieMetrics([], [], null, 0, [hike('2026-10-14T15:00:00Z', 900)]);
    expect(m.entries).toEqual([
      { calories: 900, durationSecs: 7200, dateStr: '2026-10-14T15:00:00Z', category: 'Hiking', source: 'hike' },
    ]);
  });

  it('counts a 9 PM hike as today, not tomorrow', () => {
    const m = computeCalorieMetrics([], [], null, 0, [hike('2026-10-15T01:00:00Z', 500)]); // 9:00 PM on the 14th
    expect(m.todayCalories).toBe(500);
  });

  it('puts a hike on the day it started, as a run is, when it ran past midnight', () => {
    // started 10:30 PM on the 14th, finished 1:00 AM on the 15th
    const m = computeCalorieMetrics([], [], null, 0, [hike('2026-10-15T02:30:00Z', 600, { completedAt: '2026-10-15T05:00:00Z' })]);
    expect(m.todayCalories).toBe(600);
  });

  it('takes the finish time for the day when a hike has no start time', () => {
    const m = computeCalorieMetrics([], [], null, 0, [{ id: 'h', completedAt: '2026-10-14T17:00:00Z', calories: 400, durationSeconds: 3600 }]);
    expect(m.todayCalories).toBe(400);
  });

  it('adds the estimate from steps to the hike, as it does for workouts and runs', () => {
    const m = computeCalorieMetrics([], [], null, 250, [hike('2026-10-14T15:00:00Z', 900)]);
    expect(m.todayCalories).toBe(1150);
    expect(m.stepsCalorieEstimate).toBe(250);
  });

  it('keeps the burn-goal streak going on a day that was only a hike', () => {
    const m = computeCalorieMetrics(
      [workout('2026-10-13T13:00:00Z', 600)],
      [],
      500, 0,
      [hike('2026-10-14T15:00:00Z', 800)],
    );
    expect(m.streak).toBe(2);
  });

  it('works out a burn rate for a hike, and the best day', () => {
    const m = computeCalorieMetrics([], [], null, 0, [hike('2026-10-14T15:00:00Z', 840), hike('2026-10-12T15:00:00Z', 360)]);
    expect(m.peakBurnRate).toBe(7); // 840 kcal in 120 minutes
    expect(m.averageBurnRate).toBe(5);
    expect(m.burnCeiling).toBe(840);
  });

  it('leaves out a hike with no time or a null hike, and counts a hike with unusable calories as 0', () => {
    const m = computeCalorieMetrics([], [], null, 0, [
      null, {}, { calories: 500 },
      hike('2026-10-14T15:00:00Z', undefined),
      hike('2026-10-14T16:00:00Z', 'x'),
      hike('2026-10-14T17:00:00Z', NaN),
      hike('2026-10-14T18:00:00Z', -40),
      hike('2026-10-14T18:30:00Z', Infinity),
      hike('2026-10-14T19:00:00Z', 250),
    ]);
    expect(m.totalSessions).toBe(6);
    expect(m.todayCalories).toBe(250);
    expect(m.lifetimeCalories).toBe(250);
  });

  it('treats a hike with no usable duration as having none, so it has no burn rate', () => {
    const m = computeCalorieMetrics([], [], null, 0, [hike('2026-10-14T15:00:00Z', 400, { durationSeconds: 'long' })]);
    expect(m.entries[0].durationSecs).toBe(0);
    expect(m.peakBurnRate).toBeNull();
  });

  it('ignores a hikes value that is not a list', () => {
    const w = [workout('2026-10-14T13:00:00Z', 300)];
    const without = computeCalorieMetrics(w, [], null, 0);
    expect(computeCalorieMetrics(w, [], null, 0, 'none')).toEqual(without);
    expect(computeCalorieMetrics(w, [], null, 0, { 0: hike('2026-10-14T15:00:00Z', 900) })).toEqual(without);
  });

  it('gives the same answer as before when no hikes are passed', () => {
    const w = [workout('2026-10-14T13:00:00Z', 300)];
    const r = [run('2026-10-14T14:00:00Z', 200)];
    const without = computeCalorieMetrics(w, r, 500, 100);
    expect(computeCalorieMetrics(w, r, 500, 100, undefined)).toEqual(without);
    expect(computeCalorieMetrics(w, r, 500, 100, null)).toEqual(without);
    expect(computeCalorieMetrics(w, r, 500, 100, [])).toEqual(without);
    expect(without.todayCalories).toBe(600);
  });
});

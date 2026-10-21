// lib/lifetimeTotals.js: the lifetime workout totals the screens show, put together from the server's count and the workouts the phone holds.
import { TOTALS_MIN_VERSION, heldTotals, lifetimeOf, serverTotalsFrom } from '../lib/lifetimeTotals';
import { TOTALS_VERSION, currentTotals } from '../functions/src/lifetimeTotals';

const rec = (over = {}) => ({ id: 'a', completed: true, duration: 600, caloriesBurned: 100, ...over });
const server = (over = {}) => ({ v: 2, totalWorkouts: 300, finishedWorkouts: 280, totalSeconds: 200000, totalCalories: 40000.5, bestCalories: 900, ...over });

describe('serverTotalsFrom', () => {
  it('gives the five numbers of a totals document the server counted', () => {
    expect(serverTotalsFrom(server({ updatedAt: 'x', totalMinutes: 1500 }))).toEqual({
      totalWorkouts: 300, finishedWorkouts: 280, totalSeconds: 200000, totalCalories: 40000.5, bestCalories: 900,
    });
  });

  it('gives null for a missing document and for the old running count, which has no version', () => {
    expect(serverTotalsFrom(null)).toBeNull();
    expect(serverTotalsFrom(undefined)).toBeNull();
    expect(serverTotalsFrom('x')).toBeNull();
    expect(serverTotalsFrom({ totalWorkouts: 41, totalMinutes: 800 })).toBeNull();
    expect(serverTotalsFrom(server({ v: 1 }))).toBeNull();
    expect(serverTotalsFrom(server({ v: '2' }))).toBeNull();
    expect(serverTotalsFrom(server({ v: NaN }))).toBeNull();
  });

  it('accepts a later version', () => {
    expect(serverTotalsFrom(server({ v: 3 }))).not.toBeNull();
  });

  it('turns a number that is missing or not usable into zero', () => {
    expect(serverTotalsFrom({ v: 2, totalWorkouts: 'many', finishedWorkouts: -4, totalSeconds: NaN, totalCalories: Infinity })).toEqual({
      totalWorkouts: 0, finishedWorkouts: 0, totalSeconds: 0, totalCalories: 0, bestCalories: 0,
    });
  });

  it('agrees with the server about which documents are up to date', () => {
    expect(TOTALS_MIN_VERSION).toBe(TOTALS_VERSION);
    const docs = [null, {}, { totalWorkouts: 9 }, server({ v: 1 }), server({ v: 2 }), server({ v: 5 }), server({ v: undefined }), 'x'];
    docs.forEach((d) => expect(serverTotalsFrom(d) === null).toBe(currentTotals(d) === null));
  });
});

describe('heldTotals', () => {
  it('counts every record, the time and calories over all of them, and the finished ones apart', () => {
    const t = heldTotals([rec(), rec({ completed: false, duration: 120, caloriesBurned: 20 }), rec({ duration: 300, caloriesBurned: 50.5 })]);
    expect(t).toEqual({ totalWorkouts: 3, finishedWorkouts: 2, totalSeconds: 1020, totalCalories: 170.5, bestCalories: 100 });
  });

  it('takes a record with no completed field as finished: one saved on the phone is finished until the server says otherwise', () => {
    const t = heldTotals([{ duration: 60, caloriesBurned: 10 }, rec({ completed: undefined })]);
    expect(t.finishedWorkouts).toBe(2);
    expect(heldTotals([rec({ completed: false })]).finishedWorkouts).toBe(0);
  });

  it('takes the best calories from finished workouts only', () => {
    expect(heldTotals([rec({ caloriesBurned: 400 }), rec({ completed: false, caloriesBurned: 2000 })]).bestCalories).toBe(400);
  });

  it('counts a record with no usable time or calories as a workout worth nothing', () => {
    const t = heldTotals([{}, { duration: -5, caloriesBurned: -100 }, { duration: '600', caloriesBurned: 'lots' }, { duration: NaN, caloriesBurned: Infinity }]);
    expect(t).toEqual({ totalWorkouts: 4, finishedWorkouts: 4, totalSeconds: 0, totalCalories: 0, bestCalories: 0 });
  });

  it('copes with no list, something that is not a list, and entries that are not records', () => {
    const none = { totalWorkouts: 0, finishedWorkouts: 0, totalSeconds: 0, totalCalories: 0, bestCalories: 0 };
    expect(heldTotals()).toEqual(none);
    expect(heldTotals(null)).toEqual(none);
    expect(heldTotals({ length: 3 })).toEqual(none);
    expect(heldTotals([null, undefined, 'x', 7])).toEqual(none);
  });

  it('rounds sums to two decimals so float noise does not show', () => {
    expect(heldTotals([rec({ caloriesBurned: 0.1 }), rec({ caloriesBurned: 0.2 })]).totalCalories).toBe(0.3);
    expect(heldTotals([rec({ duration: 0.1 }), rec({ duration: 0.2 })]).totalSeconds).toBe(0.3);
  });
});

describe('lifetimeOf', () => {
  it('shows the server\'s count when it is more than what the phone holds: the phone holds only the newest 240', () => {
    const held = Array.from({ length: 240 }, () => rec());
    const t = lifetimeOf({ held, server: serverTotalsFrom(server()) });
    expect(t.totalWorkouts).toBe(300);
    expect(t.finishedWorkouts).toBe(280);
    expect(t.totalSeconds).toBe(200000);
    expect(t.totalCalories).toBe(40000.5);
    expect(t.bestCalories).toBe(900);
  });

  it('shows what the phone holds when that is more: a workout just finished is not counted by the server yet', () => {
    const held = Array.from({ length: 301 }, () => rec());
    const t = lifetimeOf({ held, server: serverTotalsFrom(server()) });
    expect(t.totalWorkouts).toBe(301);
    expect(t.finishedWorkouts).toBe(301);
  });

  it('takes each number on its own, whichever is more', () => {
    const held = [rec({ duration: 999999, caloriesBurned: 5000 })];
    const t = lifetimeOf({ held, server: serverTotalsFrom(server()) });
    expect(t.totalWorkouts).toBe(300);
    expect(t.totalSeconds).toBe(999999);
    expect(t.bestCalories).toBe(5000);
  });

  it('shows only what the phone holds before the server has counted', () => {
    const held = [rec(), rec({ completed: false })];
    expect(lifetimeOf({ held, server: null })).toEqual(heldTotals(held));
    expect(lifetimeOf({ held })).toEqual(heldTotals(held));
    expect(lifetimeOf({ held, server: undefined })).toEqual(heldTotals(held));
  });

  it('shows the server\'s count when the phone holds nothing yet', () => {
    expect(lifetimeOf({ held: [], server: serverTotalsFrom(server()) }).totalWorkouts).toBe(300);
    expect(lifetimeOf({ server: serverTotalsFrom(server()) }).totalWorkouts).toBe(300);
  });

  it('never goes below zero, and copes with nothing at all', () => {
    expect(lifetimeOf()).toEqual({ totalWorkouts: 0, finishedWorkouts: 0, totalSeconds: 0, totalCalories: 0, bestCalories: 0 });
    expect(lifetimeOf({ held: [], server: { totalWorkouts: -3, totalSeconds: 'x' } }).totalWorkouts).toBe(0);
  });
});

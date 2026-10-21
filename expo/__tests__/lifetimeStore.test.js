// store/lifetimeStore.js: the server's count of everything the person has saved, held for the screens.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

import { useLifetimeStore } from '../store/lifetimeStore';

const store = () => useLifetimeStore.getState();
const doc = (over = {}) => ({ v: 2, totalWorkouts: 300, finishedWorkouts: 280, totalSeconds: 90000, totalCalories: 40000, bestCalories: 900, updatedAt: 'x', totalMinutes: 1500, ...over });

beforeEach(() => store().clearTotals());

describe('lifetimeStore', () => {
  it('starts with no count, so a screen shows only what the phone holds', () => {
    expect(store().totals).toBeNull();
  });

  it('holds the five numbers of the totals document the server counted', () => {
    store().applyTotals(doc());
    expect(store().totals).toEqual({ totalWorkouts: 300, finishedWorkouts: 280, totalSeconds: 90000, totalCalories: 40000, bestCalories: 900 });
  });

  it('follows each new count', () => {
    store().applyTotals(doc());
    store().applyTotals(doc({ totalWorkouts: 301 }));
    expect(store().totals.totalWorkouts).toBe(301);
  });

  it('holds nothing for a missing document or the old running count', () => {
    store().applyTotals(doc());
    store().applyTotals({ totalWorkouts: 41, totalMinutes: 800 });
    expect(store().totals).toBeNull();
    store().applyTotals(doc());
    store().applyTotals(null);
    expect(store().totals).toBeNull();
  });

  it('is cleared when the person signs out', () => {
    store().applyTotals(doc());
    store().clearTotals();
    expect(store().totals).toBeNull();
  });

  it('keeps only the count in the phone\'s storage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem.mockClear();
    store().applyTotals(doc());
    await new Promise((resolve) => setTimeout(resolve, 0));
    const saved = AsyncStorage.setItem.mock.calls.filter((c) => c[0] === 'zown-lifetime-storage').map((c) => JSON.parse(c[1]).state);
    expect(saved.length).toBeGreaterThan(0);
    expect(Object.keys(saved[saved.length - 1])).toEqual(['totals']);
  });
});

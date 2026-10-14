// The Steps card on Home works out its streak, averages and totals from one saved step count per day
// (lib/stepsMetrics.js). The history it reads was an empty list that nothing ever wrote to, so the card never had
// anything to show. Now every step count the app takes is also kept under its day, saved with the other health data.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (...a) => global.__stored(...a)),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));
jest.mock('firebase/firestore', () => ({
  doc: (_db, ...path) => path.join('/'),
  getDoc: (...a) => global.__getDoc(...a),
  setDoc: (...a) => global.__setDoc(...a),
}), { virtual: true });
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({
  appleHealthService: {
    isAvailable: (...a) => global.__appleAvailable(...a),
    requestAuthorization: async () => true,
    getTodayActivity: (...a) => global.__appleActivity(...a),
  },
}));

import {
  useHealthStore, normalizeStepsHistory, mergeStepsHistory, withStepsOn, STEPS_HISTORY_DAYS,
} from '../store/healthStore';
import { computeStepsMetrics } from '../lib/stepsMetrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_AT_START = useHealthStore.getState().stepsHistory; // before any test touches the store

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const at = (date) => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(date); };
const healthWrites = () => global.__setDoc.mock.calls.filter(([ref]) => ref === 'users/u1/data/health').map(([, data]) => data);

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  global.__stored = jest.fn(async () => null);
  global.__getDoc = jest.fn(async () => ({ exists: () => false }));
  global.__setDoc = jest.fn(async () => undefined);
  global.__appleAvailable = jest.fn(async () => true);
  global.__appleActivity = jest.fn(async () => ({ steps: 4321, flightsClimbed: 2 }));
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  useHealthStore.setState({ steps: 0, stepsDate: null, stepsHistory: {} });
  at(EVENING);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('setSteps', () => {
  it('starts as an empty record of days, not a list', () => {
    expect(HISTORY_AT_START).toEqual({});
    expect(Array.isArray(HISTORY_AT_START)).toBe(false);
  });

  it('keeps the count under the person\'s own day: 9:30 PM on the 14th is the 14th', () => {
    useHealthStore.getState().setSteps(6500);
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 6500 });
    expect(useHealthStore.getState().steps).toBe(6500);
  });

  it('replaces the count for the same day with the newer one', () => {
    useHealthStore.getState().setSteps(6500);
    useHealthStore.getState().setSteps(7200);
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 7200 });
  });

  it('keeps the earlier days when a new day starts', () => {
    useHealthStore.getState().setSteps(6500);
    at(new Date('2026-10-15T14:00:00Z')); // 10 AM on the 15th
    useHealthStore.getState().setSteps(900);
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 6500, '2026-10-15': 900 });
  });

  it('keeps a count of 0', () => {
    useHealthStore.getState().setSteps(0);
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 0 });
  });

  it('leaves the history alone for a count that is not a number of 0 or more', () => {
    useHealthStore.getState().setSteps(5000);
    for (const bad of [NaN, -3, undefined, null, 'lots', Infinity]) {
      useHealthStore.getState().setSteps(bad);
      expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 5000 });
    }
  });

  it('starts a proper history over the empty list an older version kept', () => {
    useHealthStore.setState({ stepsHistory: [] });
    useHealthStore.getState().setSteps(3000);
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 3000 });
  });

  it('keeps only the newest 400 days', () => {
    const old = {};
    for (let i = 0; i < 405; i++) {
      const d = new Date(2025, 0, 1 + i); // 1 Jan 2025 onward, local days
      old[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`] = 1000 + i;
    }
    useHealthStore.setState({ stepsHistory: old });
    useHealthStore.getState().setSteps(100);
    const days = Object.keys(useHealthStore.getState().stepsHistory);
    expect(days).toHaveLength(STEPS_HISTORY_DAYS);
    expect(days).toContain('2026-10-14');
    expect(days).not.toContain('2025-01-01'); // the oldest are the ones dropped
  });

  it('saves the history with the rest of the health data', () => {
    useHealthStore.getState().setSteps(6500, 'u1');
    const writes = healthWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].stepsHistory).toEqual({ '2026-10-14': 6500 });
    expect(writes[0]).toMatchObject({ steps: 6500, stepsDate: '2026-10-14' });
  });
});

describe('Apple Health sync', () => {
  it('records the count it brings in', async () => {
    await useHealthStore.getState().loadAppleHealthActivity();
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 4321 });
    expect(useHealthStore.getState().flightsClimbed).toBe(2);
  });

  it('adds to the days already kept', async () => {
    useHealthStore.setState({ stepsHistory: { '2026-10-13': 8000 } });
    await useHealthStore.getState().loadAppleHealthActivity();
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-13': 8000, '2026-10-14': 4321 });
  });
});

describe('loading the saved health data', () => {
  const remote = (data) => { global.__getDoc = jest.fn(async () => ({ exists: () => true, data: () => data })); };

  it('puts the saved days together with the ones on this phone, the larger count winning', async () => {
    useHealthStore.setState({ stepsHistory: { '2026-10-12': 5000, '2026-10-13': 9000 } });
    remote({ steps: 3000, stepsDate: '2026-10-14', stepsHistory: { '2026-10-11': 4000, '2026-10-12': 7000, '2026-10-13': 2000 } });
    await useHealthStore.getState().loadAllHealth('u1');
    expect(useHealthStore.getState().stepsHistory).toEqual({
      '2026-10-11': 4000, '2026-10-12': 7000, '2026-10-13': 9000, '2026-10-14': 3000,
    });
  });

  it('takes the saved count and its day as an entry, for data saved before there was a history', async () => {
    remote({ steps: 6100, stepsDate: '2026-10-14' });
    await useHealthStore.getState().loadAllHealth('u1');
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 6100 });
  });

  it('keeps what is on this phone when nothing was saved', async () => {
    useHealthStore.setState({ stepsHistory: { '2026-10-13': 9000 } });
    remote({});
    await useHealthStore.getState().loadAllHealth('u1');
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-13': 9000 });
  });

  it('leaves out saved entries that are not a day with a count, and a saved list', async () => {
    remote({ steps: 0, stepsDate: null, stepsHistory: { '2026-10-13': 8000, 'yesterday': 5, '2026-10-12': 'lots', '2026-10-11': -4, '2026-02-31': 100 } });
    await useHealthStore.getState().loadAllHealth('u1');
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-13': 8000 });
    remote({ stepsHistory: [1, 2, 3] });
    await useHealthStore.getState().loadAllHealth('u1');
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-13': 8000 });
  });
});

describe('coming back from the phone\'s storage', () => {
  const stored = (state) => { global.__stored = jest.fn(async () => JSON.stringify({ state, version: 0 })); };

  it('brings the history back', async () => {
    stored({ steps: 100, stepsDate: '2026-10-14', stepsHistory: { '2026-10-13': 8000, '2026-10-14': 5000 } });
    await useHealthStore.persist.rehydrate();
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-13': 8000, '2026-10-14': 5000 });
  });

  it('starts the history from the saved count and its day when there was none yet', async () => {
    stored({ steps: 4200, stepsDate: '2026-10-14' });
    await useHealthStore.persist.rehydrate();
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 4200 });
    expect(useHealthStore.getState().steps).toBe(4200);
  });

  it('starts with no days when there is nothing saved at all', async () => {
    stored({ measurements: {} });
    await useHealthStore.persist.rehydrate();
    expect(useHealthStore.getState().stepsHistory).toEqual({});
  });

  it('comes back fine when the phone has nothing stored yet', async () => {
    useHealthStore.setState({ stepsHistory: { '2026-10-13': 8000 } });
    await useHealthStore.persist.rehydrate(); // the default: storage has nothing
    expect(useHealthStore.persist.hasHydrated()).toBe(true);
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-13': 8000 });
  });

  it('writes the history to the phone\'s storage whenever a count is taken, and reads it back', async () => {
    AsyncStorage.setItem.mockClear();
    useHealthStore.getState().setSteps(6500);
    at(new Date('2026-10-15T14:00:00Z'));
    useHealthStore.getState().setSteps(900);
    const mine = AsyncStorage.setItem.mock.calls.filter(([key]) => key === 'health-storage'); // other stores save too
    const writes = mine.map(([, json]) => JSON.parse(json).state);
    expect(writes[writes.length - 1].stepsHistory).toEqual({ '2026-10-14': 6500, '2026-10-15': 900 });
    expect(writes[writes.length - 1]).toMatchObject({ steps: 900, stepsDate: '2026-10-15' });
    // and what was written is what comes back on the next launch
    const last = mine[mine.length - 1][1];
    global.__stored = jest.fn(async () => last);
    useHealthStore.setState({ stepsHistory: {}, steps: 0, stepsDate: null });
    await useHealthStore.persist.rehydrate();
    expect(useHealthStore.getState().stepsHistory).toEqual({ '2026-10-14': 6500, '2026-10-15': 900 });
  });
});

describe('what the Steps card makes of it', () => {
  it('has a streak, averages and totals once days have been recorded', () => {
    for (const [when, count] of [
      ['2026-10-12T15:00:00Z', 11000], ['2026-10-13T15:00:00Z', 9000], ['2026-10-14T15:00:00Z', 12000],
    ]) {
      at(new Date(when));
      useHealthStore.getState().setSteps(count);
    }
    at(EVENING);
    const m = computeStepsMetrics(useHealthStore.getState().stepsHistory, 8000);
    expect(m.todaySteps).toBe(12000);
    expect(m.streak).toBe(3);
    expect(m.weeklyTotal).toBe(32000);
    expect(m.lifetimeSteps).toBe(32000);
    expect(m.bestDay).toBe(12000);
    expect(m.totalDaysTracked).toBe(3);
  });
});

describe('the history helpers', () => {
  it('normalizeStepsHistory keeps real days with a count of 0 or more, oldest first', () => {
    expect(normalizeStepsHistory({ '2026-10-14': 5, '2026-10-12': 0, bad: 3, '2026-10-13': -1, '2026-10-11': NaN, '2026-10-10': '7' })).toEqual({ '2026-10-12': 0, '2026-10-14': 5 });
  });

  it('normalizeStepsHistory gives {} for anything that is not a plain object', () => {
    for (const v of [undefined, null, [], [1, 2], 'x', 5, true]) expect(normalizeStepsHistory(v)).toEqual({});
  });

  it('normalizeStepsHistory keeps the newest 400 days', () => {
    const many = {};
    for (let i = 0; i < 450; i++) many[new Date(2025, 0, 1 + i).toLocaleDateString('en-CA')] = i;
    const kept = Object.keys(normalizeStepsHistory(many));
    expect(kept).toHaveLength(400);
    expect(kept[0]).toBe(new Date(2025, 0, 51).toLocaleDateString('en-CA'));
  });

  it('normalizeStepsHistory drops the oldest days and sorts them, whatever order they came in', () => {
    const many = {};
    for (let i = 449; i >= 0; i--) many[new Date(2025, 0, 1 + i).toLocaleDateString('en-CA')] = i; // newest first
    const kept = Object.keys(normalizeStepsHistory(many));
    expect(kept).toHaveLength(400);
    expect(kept[0]).toBe(new Date(2025, 0, 51).toLocaleDateString('en-CA'));
    expect(kept).toEqual([...kept].sort());
    expect(Object.keys(normalizeStepsHistory({ '2026-10-14': 1, '2026-10-12': 1, '2026-10-13': 1 }))).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
  });

  it('mergeStepsHistory keeps the newest 400 days of the two together', () => {
    const run = (from, n) => { const o = {}; for (let i = 0; i < n; i++) o[new Date(2025, 0, from + i).toLocaleDateString('en-CA')] = 1; return o; };
    const merged = Object.keys(mergeStepsHistory(run(1, 300), run(301, 300))); // 600 different days
    expect(merged).toHaveLength(400);
    expect(merged[0]).toBe(new Date(2025, 0, 201).toLocaleDateString('en-CA'));
    expect(merged[399]).toBe(new Date(2025, 0, 600).toLocaleDateString('en-CA'));
  });

  it('mergeStepsHistory takes the larger count for a day, and every other day from either', () => {
    expect(mergeStepsHistory({ '2026-10-12': 5, '2026-10-13': 9 }, { '2026-10-13': 2, '2026-10-14': 7 })).toEqual({ '2026-10-12': 5, '2026-10-13': 9, '2026-10-14': 7 });
    expect(mergeStepsHistory(undefined, { '2026-10-14': 7 })).toEqual({ '2026-10-14': 7 });
    expect(mergeStepsHistory({ '2026-10-14': 7 }, null)).toEqual({ '2026-10-14': 7 });
    expect(mergeStepsHistory([], [])).toEqual({});
  });

  it('withStepsOn replaces a day\'s count, even with a smaller one', () => {
    expect(withStepsOn({ '2026-10-14': 9 }, '2026-10-14', 4)).toEqual({ '2026-10-14': 4 });
  });

  it('withStepsOn leaves the history as it was for a bad day or a bad count', () => {
    const h = { '2026-10-14': 9 };
    for (const [day, count] of [['nope', 5], [null, 5], ['2026-10-15', NaN], ['2026-10-15', -1], ['2026-10-15', '5'], ['2026-10-15', undefined]]) {
      expect(withStepsOn(h, day, count)).toEqual(h);
    }
  });
});

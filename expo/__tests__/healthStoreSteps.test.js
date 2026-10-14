// The step count is saved on the phone. Without the day it was set, a count from yesterday looks like today's, so
// the store records the person's own day with it and getTodaySteps() only returns a count from today.
jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(async () => undefined),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('../services/rookService', () => ({ rookService: {} }));
jest.mock('../services/appleHealthService', () => ({ appleHealthService: {} }));

import { getDoc, setDoc } from 'firebase/firestore';
import { useHealthStore } from '../store/healthStore';

const at = (date) => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }).setSystemTime(date); };
const store = () => useHealthStore.getState();

// The user store finishes loading on a timer once it is imported; let that happen before the clock is moved.
beforeAll(() => new Promise((resolve) => setTimeout(resolve, 20)));
beforeEach(() => {
  useHealthStore.setState({ steps: 0, stepsDate: null });
  setDoc.mockClear();
  getDoc.mockReset();
});
afterEach(() => { jest.useRealTimers(); });

describe('steps and the day they belong to', () => {
  it('remembers the person\'s own day when the count is set: 9:30 PM on the 14th is the 14th', () => {
    at(new Date('2026-10-15T01:30:00Z'));
    store().setSteps(6420);
    expect(store()).toMatchObject({ steps: 6420, stepsDate: '2026-10-14' });
    expect(store().getTodaySteps()).toBe(6420);
  });

  it('stops calling the count today\'s once the day is over', () => {
    at(new Date('2026-10-15T01:30:00Z'));
    store().setSteps(6420);
    at(new Date('2026-10-15T04:05:00Z')); // 12:05 AM on the 15th
    expect(store().steps).toBe(6420);
    expect(store().getTodaySteps()).toBeNull();
  });

  it('does not treat a count saved before the day was recorded as today\'s', () => {
    at(new Date('2026-10-15T12:00:00Z'));
    useHealthStore.setState({ steps: 9000, stepsDate: null });
    expect(store().getTodaySteps()).toBeNull();
  });

  it('does not pass on a count that is not a number, even from today', () => {
    at(new Date('2026-10-15T12:00:00Z'));
    for (const bad of [NaN, undefined, null, 'lots']) {
      useHealthStore.setState({ steps: bad, stepsDate: '2026-10-15' });
      expect({ bad: String(bad), steps: store().getTodaySteps() }).toEqual({ bad: String(bad), steps: null });
    }
  });

  it('keeps a real 0 for today', () => {
    at(new Date('2026-10-15T12:00:00Z'));
    store().setSteps(0);
    expect(store().getTodaySteps()).toBe(0);
  });

  it('saves the day with the count, and brings it back', async () => {
    at(new Date('2026-10-15T01:30:00Z'));
    store().setSteps(6420, 'u1');
    await Promise.resolve();
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ steps: 6420, stepsDate: '2026-10-14' }), { merge: true });

    useHealthStore.setState({ steps: 0, stepsDate: null });
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ steps: 6420, stepsDate: '2026-10-14' }) });
    await store().loadAllHealth('u1');
    expect(store()).toMatchObject({ steps: 6420, stepsDate: '2026-10-14' });
    expect(store().getTodaySteps()).toBe(6420);
  });

  it('brings back a count saved before the day was recorded as not-today', async () => {
    at(new Date('2026-10-15T12:00:00Z'));
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ steps: 7000 }) });
    await store().loadAllHealth('u1');
    expect(store().steps).toBe(7000);
    expect(store().stepsDate).toBeNull();
    expect(store().getTodaySteps()).toBeNull();
  });
});

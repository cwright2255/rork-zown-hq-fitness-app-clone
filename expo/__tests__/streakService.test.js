// The streak is worked out from the person's workouts, runs and hikes, on their own calendar days.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import { act, renderHook } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true }); // the hiking store imports it; no GPS is used here

import { getActivityDayKeys, getActivityStreak, useActivityStreak } from '../services/streakService';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const workout = (completedAt) => ({ id: `w-${completedAt}`, completedAt });
const run = (at) => ({ id: `r-${at}`, startTime: at, endTime: at });
const hike = (at) => ({ id: `h-${at}`, startTime: at, completedAt: at });

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useWorkoutStore.setState({ completedWorkouts: [] });
  useRunningStore.setState({ runs: [] });
  useHikingStore.setState({ completedHikes: [] });
});
afterEach(() => { jest.useRealTimers(); });

describe('getActivityStreak', () => {
  it('is 0 and 0 with nothing done', () => {
    expect(getActivityStreak()).toEqual({ current: 0, longest: 0 });
  });

  it('counts a workout, a run and a hike on three days in a row', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z')] });
    useRunningStore.setState({ runs: [run('2026-10-13T13:00:00Z')] });
    useHikingStore.setState({ completedHikes: [hike('2026-10-12T13:00:00Z')] });
    expect(getActivityStreak()).toEqual({ current: 3, longest: 3 });
  });

  it('keeps a streak going on runs alone, which the old counter ignored', () => {
    useRunningStore.setState({ runs: [run('2026-10-14T13:00:00Z'), run('2026-10-13T13:00:00Z')] });
    expect(getActivityStreak().current).toBe(2);
  });

  it('keeps a streak going on hikes alone', () => {
    useHikingStore.setState({ completedHikes: [hike('2026-10-14T13:00:00Z'), hike('2026-10-13T13:00:00Z')] });
    expect(getActivityStreak().current).toBe(2);
  });

  it('puts a 9 PM run on today, not tomorrow', () => {
    useRunningStore.setState({ runs: [run('2026-10-15T01:00:00Z')] }); // 9:00 PM on the 14th
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-13T15:00:00Z')] });
    expect(getActivityStreak().current).toBe(2);
  });

  it('keeps yesterday\'s streak alive until the day is over, and drops it after', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-13T15:00:00Z'), workout('2026-10-12T15:00:00Z')] });
    expect(getActivityStreak().current).toBe(2); // nothing yet today, the 13th and 12th
    jest.setSystemTime(new Date('2026-10-16T14:00:00Z')); // 10 AM on the 16th: the 14th and 15th are empty
    expect(getActivityStreak()).toEqual({ current: 0, longest: 2 });
  });

  it('stops at a day with nothing and reports the best run separately', () => {
    useWorkoutStore.setState({
      completedWorkouts: [
        workout('2026-10-14T15:00:00Z'),
        // the 13th is empty
        workout('2026-10-12T15:00:00Z'), workout('2026-10-11T15:00:00Z'), workout('2026-10-10T15:00:00Z'),
      ],
    });
    expect(getActivityStreak()).toEqual({ current: 1, longest: 3 });
  });

  it('counts two sessions on one day as one day', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z'), workout('2026-10-14T15:00:00Z')] });
    useRunningStore.setState({ runs: [run('2026-10-14T18:00:00Z')] });
    expect(getActivityStreak().current).toBe(1);
  });

  it('copes with records that have no usable time', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z'), { id: 'x' }, null] });
    useRunningStore.setState({ runs: [{ id: 'r' }, null] });
    expect(getActivityStreak().current).toBe(1);
  });
});

describe('getActivityDayKeys', () => {
  it('is empty with nothing done', () => {
    expect(getActivityDayKeys()).toEqual([]);
  });

  it('lists the days with a workout, a run or a hike, oldest first, each day once', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z'), workout('2026-10-14T15:00:00Z'), workout('2026-10-10T15:00:00Z')] });
    useRunningStore.setState({ runs: [run('2026-10-12T13:00:00Z')] });
    useHikingStore.setState({ completedHikes: [hike('2026-10-11T13:00:00Z')] });
    expect(getActivityDayKeys()).toEqual(['2026-10-10', '2026-10-11', '2026-10-12', '2026-10-14']);
  });

  it('puts a 9 PM run on the person\'s own day, not the UTC one', () => {
    useRunningStore.setState({ runs: [run('2026-10-15T01:00:00Z')] }); // 9:00 PM on the 14th
    expect(getActivityDayKeys()).toEqual(['2026-10-14']);
  });
});

describe('useActivityStreak', () => {
  it('gives the same answer as getActivityStreak', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z')] });
    useRunningStore.setState({ runs: [run('2026-10-13T13:00:00Z')] });
    const { result } = renderHook(() => useActivityStreak());
    expect(result.current).toEqual(getActivityStreak());
    expect(result.current.current).toBe(2);
  });

  it('updates when a workout, a run or a hike arrives', () => {
    const { result } = renderHook(() => useActivityStreak());
    expect(result.current.current).toBe(0);
    act(() => { useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z')] }); });
    expect(result.current.current).toBe(1);
    act(() => { useRunningStore.setState({ runs: [run('2026-10-13T13:00:00Z')] }); });
    expect(result.current.current).toBe(2);
    act(() => { useHikingStore.setState({ completedHikes: [hike('2026-10-12T13:00:00Z')] }); });
    expect(result.current.current).toBe(3);
  });

  it('is worked out again when the day changes, though no record did', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T13:00:00Z')] });
    const { result, rerender } = renderHook(() => useActivityStreak());
    expect(result.current.current).toBe(1);
    jest.setSystemTime(new Date('2026-10-16T14:00:00Z')); // two days on
    rerender({});
    expect(result.current.current).toBe(0);
  });
});

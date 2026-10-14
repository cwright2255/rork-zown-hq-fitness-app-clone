// The Streak on the Profile is the days in a row with a workout, a run or a hike. It used to read a counter on the
// user record that nothing ever updated, so it showed 0 whatever the person had done.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('expo-image-picker', () => ({}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
// The old counter is still on the user record, at a number nothing else would give.
jest.mock('@/store/userStore', () => ({
  useUserStore: () => ({ user: { uid: 'u1', name: 'Cj', streak: 9 }, loadProfile: () => {}, updateUser: () => {}, saveProfile: () => {} }),
}));
jest.mock('@/store/expStore', () => ({
  useExpStore: () => ({
    loadXP: () => {}, getLevel: () => 1, getExpForLevel: (l) => l * 1000, getExpToNextLevel: () => 1000, getTotalExp: () => 0,
  }),
}));
jest.mock('@/store/achievementStore', () => ({
  useAchievementStore: () => ({
    achievements: [], getUnlockedAchievements: () => [], getLockedAchievements: () => [], loadAchievements: () => {},
  }),
}));
// The three lists live in real stores here (selectors work), without Firestore behind them.
jest.mock('@/store/workoutStore', () => {
  const { create } = require('zustand');
  return { useWorkoutStore: create(() => ({ completedWorkouts: [], loadWorkouts: () => {} })) };
});
jest.mock('@/store/runningStore', () => {
  const { create } = require('zustand');
  return { useRunningStore: create(() => ({ runs: [] })) };
});
jest.mock('@/store/hikingStore', () => {
  const { create } = require('zustand');
  return { useHikingStore: create(() => ({ completedHikes: [] })) };
});

import ProfileScreen from '../app/profile';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';

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

// The number that sits above a label: both are Text inside the same stat View.
const statOf = (utils, label) => {
  let cell = utils.getByText(label).parent;
  while (cell && cell.type !== 'View') cell = cell.parent;
  return String(cell.findAll((n) => n.type === 'Text').map((n) => n.props.children).find((c) => String(c) !== label));
};

describe('the Streak on the Profile', () => {
  it('is 0 with nothing done, not the old counter on the user record', () => {
    expect(statOf(render(<ProfileScreen />), 'Streak')).toBe('0');
  });

  it('counts days in a row from workouts, runs and hikes together', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-14T15:00:00Z')] });
    useRunningStore.setState({ runs: [run('2026-10-13T15:00:00Z')] });
    useHikingStore.setState({ completedHikes: [hike('2026-10-12T15:00:00Z')] });
    expect(statOf(render(<ProfileScreen />), 'Streak')).toBe('3');
  });

  it('is kept up by runs alone', () => {
    useRunningStore.setState({ runs: [run('2026-10-14T15:00:00Z'), run('2026-10-13T15:00:00Z')] });
    expect(statOf(render(<ProfileScreen />), 'Streak')).toBe('2');
    expect(statOf(render(<ProfileScreen />), 'Workouts')).toBe('0');
  });

  it('is the streak now, not the best one ever', () => {
    useWorkoutStore.setState({
      completedWorkouts: [workout('2026-10-14T15:00:00Z'), workout('2026-10-10T15:00:00Z'), workout('2026-10-09T15:00:00Z'), workout('2026-10-08T15:00:00Z')],
    });
    expect(statOf(render(<ProfileScreen />), 'Streak')).toBe('1');
  });

  it('moves when a hike arrives while the screen is open', () => {
    useWorkoutStore.setState({ completedWorkouts: [workout('2026-10-13T15:00:00Z')] });
    const utils = render(<ProfileScreen />);
    expect(statOf(utils, 'Streak')).toBe('1');
    act(() => { useHikingStore.setState({ completedHikes: [hike('2026-10-14T15:00:00Z')] }); });
    expect(statOf(utils, 'Streak')).toBe('2');
  });
});

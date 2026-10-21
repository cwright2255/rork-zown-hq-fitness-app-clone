// Total Workouts on the Workouts screen and the Workouts, Calories and Total Time at the top of Profile > Workout History are over every
// workout the person has ever saved (the server's count, store/lifetimeStore.js), not just the newest 240 the phone holds.
// jest.global-setup.js pins the zone to America/New_York.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/EmptyState', () => ({ __esModule: true, default: () => null }));
jest.mock('@/src/components/LoadingSkeleton', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
jest.mock('@/store/exerciseStore', () => ({
  useExerciseStore: () => ({ exercises: [], isLoading: false, loadExercises: jest.fn() }),
}));
jest.mock('@/services/coachSnapshotService', () => ({ getProfileFromStores: () => ({}) }));
// The Workouts screen reads a good deal from the workout store; the History screen is run on the real one below.
jest.mock('@/store/workoutStore', () => {
  const actual = jest.requireActual('../store/workoutStore');
  const hook = (selector) => {
    const state = {
      ...actual.useWorkoutStore.getState(),
      workouts: [], loadWorkoutTemplates: jest.fn(), loadWorkoutRecommendation: jest.fn(), loadWorkouts: jest.fn(),
      getWorkoutStreak: () => ({ current: 0, longest: 0 }), workoutRecommendation: null, isLoadingRecommendation: false,
      generateNewWorkoutRecommendation: jest.fn(),
    };
    return selector ? selector(state) : state;
  };
  return { ...actual, useWorkoutStore: Object.assign(hook, actual.useWorkoutStore) };
});

import WorkoutsScreen from '../app/workouts';
import WorkoutHistoryScreen from '../app/profile/workout-history';
import { useWorkoutStore } from '../store/workoutStore';
import { useLifetimeStore } from '../store/lifetimeStore';

const rec = (i, over = {}) => ({ id: `w${i}`, name: `Workout ${i}`, completedAt: new Date(2026, 9, 14, 12, 0).toISOString(), duration: 600, caloriesBurned: 100, completed: true, ...over });
const held = (n) => Array.from({ length: n }, (_, i) => rec(i));
const totals = (over = {}) => ({ totalWorkouts: 500, finishedWorkouts: 480, totalSeconds: 360000, totalCalories: 80000, bestCalories: 900, ...over });
// The number above a label: both are Text inside the same box.
const valueOf = (utils, label) => {
  let box = utils.getAllByText(label)[0].parent; // the stats at the top come before any workout in the list
  const texts = (node) => node.findAll((n) => typeof n.type === 'string' && n.type === 'Text');
  while (box && texts(box).length < 2) box = box.parent;
  return texts(box).map((n) => n.props.children).find((c) => c !== label);
};

beforeEach(() => {
  useWorkoutStore.setState({ completedWorkouts: [] });
  useLifetimeStore.setState({ totals: null });
});

describe('Workouts screen: Total Workouts', () => {
  it('shows the server\'s count when the phone holds fewer', () => {
    useWorkoutStore.setState({ completedWorkouts: held(240) });
    useLifetimeStore.setState({ totals: totals() });
    expect(valueOf(render(<WorkoutsScreen />), 'Total Workouts')).toBe(500);
  });

  it('shows what the phone holds before the server has counted, as it always did', () => {
    useWorkoutStore.setState({ completedWorkouts: held(7) });
    expect(valueOf(render(<WorkoutsScreen />), 'Total Workouts')).toBe(7);
  });

  it('shows what the phone holds when that is more than the server has counted so far', () => {
    useWorkoutStore.setState({ completedWorkouts: held(12) });
    useLifetimeStore.setState({ totals: totals({ totalWorkouts: 10 }) });
    expect(valueOf(render(<WorkoutsScreen />), 'Total Workouts')).toBe(12);
  });

  it('shows 0 for someone with no workouts', () => {
    expect(valueOf(render(<WorkoutsScreen />), 'Total Workouts')).toBe(0);
  });
});

describe('Workout History: the stats at the top', () => {
  it('shows the server\'s totals for workouts, calories and time when the phone holds fewer', () => {
    useWorkoutStore.setState({ completedWorkouts: held(240) });
    useLifetimeStore.setState({ totals: totals() });
    const utils = render(<WorkoutHistoryScreen />);
    expect(valueOf(utils, 'Workouts')).toBe(500);
    expect(valueOf(utils, 'Calories')).toBe((80000).toLocaleString());
    expect(valueOf(utils, 'Total Time')).toBe('100h 0m');
  });

  it('shows what the phone holds before the server has counted', () => {
    useWorkoutStore.setState({ completedWorkouts: held(3) });
    const utils = render(<WorkoutHistoryScreen />);
    expect(valueOf(utils, 'Workouts')).toBe(3);
    expect(valueOf(utils, 'Calories')).toBe('300');
    expect(valueOf(utils, 'Total Time')).toBe('30m');
  });

  it('still lists only the workouts the phone holds', () => {
    useWorkoutStore.setState({ completedWorkouts: held(3) });
    useLifetimeStore.setState({ totals: totals() });
    const utils = render(<WorkoutHistoryScreen />);
    expect(utils.getAllByText(/^Workout \d$/)).toHaveLength(3);
  });
});

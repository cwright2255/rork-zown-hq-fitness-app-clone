import React from 'react';
import { render } from '@testing-library/react-native';

// The Workout Complete screen shows the workout that was just finished. It used to read the LAST item in the saved list, which is the
// newest only in a list that is oldest first; the list the server sends is newest first, so after a refresh it showed the oldest workout
// the app holds. It now takes the one that finished last, whatever order the list is in.
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
}), { virtual: true });

function mockStore(key) {
  const hook = (select) => (select ? select(global[key]) : global[key]);
  hook.getState = () => global[key];
  return hook;
}
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: mockStore('__workouts') }));
jest.mock('@/store/userStore', () => ({ useUserStore: mockStore('__userStore') }));
jest.mock('@/store/badgeStore', () => ({ useBadgeStore: mockStore('__badges') }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: mockStore('__running') }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: mockStore('__hiking') }));
jest.mock('@/store/communityStore', () => ({ useCommunityStore: mockStore('__community') }));
jest.mock('@/services/runShare', () => ({ shareRunToFeed: jest.fn(), shareErrorText: jest.fn() }));
jest.mock('@/services/hikeShare', () => ({ shareHikeToFeed: jest.fn(), hikeShareErrorText: jest.fn() }));

import WorkoutCompleteScreen from '../app/workout/complete';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const FINISHED = { name: 'Just finished', completedAt: '2026-10-20T12:00:00.000Z', caloriesBurned: 421, xpEarned: 75, duration: 2700, exercisesCompleted: 5, totalExercises: 6 };
const MIDDLE = { name: 'Middle', completedAt: '2026-10-10T12:00:00.000Z', caloriesBurned: 222, xpEarned: 40, duration: 1200, exercisesCompleted: 2, totalExercises: 4 };
const OLDEST = { name: 'Oldest', completedAt: '2026-09-01T12:00:00.000Z', caloriesBurned: 111, xpEarned: 20, duration: 600, exercisesCompleted: 1, totalExercises: 3 };

const open = (completedWorkouts) => {
  global.__router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  global.__params = {};
  global.__workouts = { completedWorkouts };
  global.__userStore = { user: { uid: 'u1', displayName: 'Cj' } };
  global.__badges = { badges: [], loadBadges: jest.fn() };
  global.__running = { runs: [], loadRuns: jest.fn(async () => undefined), markRunShared: jest.fn() };
  global.__hiking = { completedHikes: [], markHikeShared: jest.fn() };
  global.__community = { createPost: jest.fn(async () => 'post-1') };
  return render(<WorkoutCompleteScreen />);
};

describe('Workout complete shows the workout that was just finished', () => {
  it('from a list that is newest first, as the server sends it', () => {
    const utils = open([FINISHED, MIDDLE, OLDEST]);
    expect(utils.getByText('421 kcal')).toBeTruthy();
    expect(utils.getByText('+75 XP')).toBeTruthy();
    expect(utils.getByText('5/6')).toBeTruthy();
    expect(utils.queryByText('111 kcal')).toBeNull();
  });

  it('from a list that is oldest first, as the phone used to save it', () => {
    const utils = open([OLDEST, MIDDLE, FINISHED]);
    expect(utils.getByText('421 kcal')).toBeTruthy();
    expect(utils.getByText('+75 XP')).toBeTruthy();
    expect(utils.queryByText('111 kcal')).toBeNull();
  });

  it('from a list in no order', () => {
    const utils = open([MIDDLE, FINISHED, OLDEST]);
    expect(utils.getByText('421 kcal')).toBeTruthy();
    expect(utils.queryByText('222 kcal')).toBeNull();
  });

  it('as a list with no workout in it says zero, not someone else\'s numbers', () => {
    const utils = open([]);
    expect(utils.getByText('0 kcal')).toBeTruthy();
    expect(utils.getByText('0/0')).toBeTruthy();
  });
});

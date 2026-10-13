import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

// These read Settings > Distance Units from the real settings store; the next two keep it off the network and the phone's storage.
// The tests below were written in kilometres, so they start there (the miles tests set 'imperial' themselves).
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
jest.mock('@/services/distanceBoard', () => ({ publishMyDistance: jest.fn() }));

import WorkoutCompleteScreen from '../app/workout/complete';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const open = (workout = {}) => {
  global.__router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  global.__params = {};
  global.__workouts = {
    completedWorkouts: [{
      caloriesBurned: 333, xpEarned: 50, duration: 1800, exercisesCompleted: 3, totalExercises: 4, ...workout,
    }],
  };
  global.__userStore = { user: { uid: 'u1', displayName: 'Cj' } };
  global.__badges = { badges: [], loadBadges: jest.fn() };
  global.__running = { runs: [], loadRuns: jest.fn(async () => undefined), markRunShared: jest.fn() };
  global.__hiking = { completedHikes: [], markHikeShared: jest.fn() };
  global.__community = { createPost: jest.fn(async () => 'post-1') };
  return render(<WorkoutCompleteScreen />);
};

describe('Workout complete tabs', () => {
  it('offers a Summary tab and an Exercises tab, and nothing that is not built yet', () => {
    const utils = open();
    expect(utils.getByText('Summary')).toBeTruthy();
    expect(utils.getByText('Exercises')).toBeTruthy();
    expect(utils.queryByText('Stats')).toBeNull();
  });

  it('opens on the summary of the workout', () => {
    const utils = open();
    expect(utils.getByText('Workout Summary')).toBeTruthy();
  });

  it('says there is no detail, rather than "coming soon", on the Exercises tab of a session without any', () => {
    const utils = open();
    fireEvent.press(utils.getByText('Exercises'));
    expect(utils.getByText('No exercise detail recorded for this session.')).toBeTruthy();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });

  it('goes back to the summary from the Exercises tab', () => {
    const utils = open();
    fireEvent.press(utils.getByText('Exercises'));
    expect(utils.queryByText('Workout Summary')).toBeNull();
    fireEvent.press(utils.getByText('Summary'));
    expect(utils.getByText('Workout Summary')).toBeTruthy();
  });

  it('never says "coming soon" anywhere on either tab', () => {
    const utils = open();
    expect(utils.queryByText(/coming soon/i)).toBeNull();
    fireEvent.press(utils.getByText('Exercises'));
    expect(utils.queryByText(/coming soon/i)).toBeNull();
  });
});

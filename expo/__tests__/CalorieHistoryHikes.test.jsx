// The Calorie History screen lists hikes with workouts and runs, and counts them in its totals.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1', dailyCalorieGoal: 500 } }) }));
const mockWorkouts = { completedWorkouts: [], loadWorkouts: jest.fn() };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRunning = { runs: [], loadRuns: jest.fn() };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRunning }));
const mockHiking = { completedHikes: [], loadCompletedHikes: jest.fn() };
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => mockHiking }));

import { RefreshControl } from 'react-native';
import CalorieHistoryScreen from '../app/profile/calorie-history';

const NOW = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const HIKE = { id: 'hike-1', startTime: '2026-10-14T15:00:00.000Z', completedAt: '2026-10-14T17:00:00.000Z', calories: 900, durationSeconds: 7200 };

beforeEach(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockWorkouts.completedWorkouts = [];
  mockRunning.runs = [];
  mockHiking.completedHikes = [];
  [mockWorkouts.loadWorkouts, mockRunning.loadRuns, mockHiking.loadCompletedHikes].forEach((f) => f.mockClear());
});
afterEach(() => { jest.useRealTimers(); });

// The value above a label in the stats card, e.g. "Today".
const statAbove = (utils, label) => {
  let cell = utils.getByText(label).parent;
  while (cell && cell.type !== 'View') cell = cell.parent;
  return cell.findAll((n) => n.type === 'Text').map((n) => n.props.children).find((c) => c !== label);
};

describe('Calorie History with hikes', () => {
  it('lists a hike as a "Hiking" session with its calories and burn rate', () => {
    mockHiking.completedHikes = [HIKE];
    const utils = render(<CalorieHistoryScreen />);
    expect(utils.getByText('Hiking')).toBeTruthy();
    expect(utils.getByText('900 cal')).toBeTruthy();
    expect(utils.getByText('7.5 cal/min')).toBeTruthy(); // 900 kcal in 120 minutes
    expect(utils.queryByText('No Calories Logged')).toBeNull();
  });

  it('counts the hike in today and the lifetime total', () => {
    mockWorkouts.completedWorkouts = [{ id: 'w1', completedAt: '2026-10-14T13:00:00.000Z', caloriesBurned: 300, duration: 1800, category: 'Strength' }];
    mockHiking.completedHikes = [HIKE];
    const utils = render(<CalorieHistoryScreen />);
    expect(statAbove(utils, 'Today')).toBe(1200);
    expect(statAbove(utils, 'Lifetime')).toBe('1,200');
    expect(statAbove(utils, 'Day Streak')).toBe(1);
  });

  it('adds a hike to the list when it arrives while the screen is open', () => {
    const utils = render(<CalorieHistoryScreen />);
    expect(utils.queryByText('Hiking')).toBeNull();
    mockHiking.completedHikes = [HIKE];
    utils.rerender(<CalorieHistoryScreen />);
    expect(utils.getByText('Hiking')).toBeTruthy();
    expect(statAbove(utils, 'Today')).toBe(900);
  });

  it('still says no calories are logged when there is nothing, and now mentions hikes', () => {
    const utils = render(<CalorieHistoryScreen />);
    expect(utils.getByText('No Calories Logged')).toBeTruthy();
    expect(utils.getByText('Completed workouts, runs and hikes will appear here.')).toBeTruthy();
  });

  it('loads the hikes again on pull-to-refresh', async () => {
    const utils = render(<CalorieHistoryScreen />);
    await act(async () => { await utils.UNSAFE_getByType(RefreshControl).props.onRefresh(); });
    expect(mockWorkouts.loadWorkouts).toHaveBeenCalledWith('u1');
    expect(mockRunning.loadRuns).toHaveBeenCalledWith('u1');
    expect(mockHiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
  });
});

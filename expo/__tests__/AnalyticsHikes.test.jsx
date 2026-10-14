// The Analysis screen counts hikes with workouts and runs: in the totals, the chart, the records and the recent list,
// and a hike (or a run) keeps the streak going. A person with only hikes is not told they have no activity.
// jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { SafeAreaView: (props) => mockReact.createElement(mockRn.View, null, props.children) };
}, { virtual: true });
jest.mock('@/src/components/EmptyState', () => ({ __esModule: true, default: ({ title, subtitle }) => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return mockReact.createElement(mockRn.View, null,
    mockReact.createElement(mockRn.Text, null, `EMPTY: ${title}`),
    mockReact.createElement(mockRn.Text, null, `SUB: ${subtitle}`));
} }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
const mockWorkouts = { completedWorkouts: [], loadWorkouts: () => {}, getWorkoutStreak: () => ({ current: 0, longest: 0 }) };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRunning = { runs: [], loadRuns: () => {} };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRunning }));
const mockHiking = { completedHikes: [], loadCompletedHikes: jest.fn() };
jest.mock('@/store/hikingStore', () => ({ useHikingStore: () => mockHiking }));

import AnalysisScreen from '../app/analytics';
import { useSettingsStore } from '../store/settingsStore';

const NOW = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const HIKE = {
  id: 'hike-1', trailName: 'Bear Mountain Loop', startTime: '2026-10-14T15:00:00.000Z', completedAt: '2026-10-14T17:00:00.000Z',
  distanceKm: 8, durationSeconds: 7200, calories: 900,
};

beforeEach(() => {
  mockWorkouts.completedWorkouts = [];
  mockRunning.runs = [];
  mockHiking.completedHikes = [];
  mockHiking.loadCompletedHikes.mockClear();
  useSettingsStore.setState({ units: 'metric' });
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterEach(() => { jest.useRealTimers(); });

// The number that sits above a label: both are Text inside the same card View.
const numberAbove = (utils, label) => {
  let cell = utils.getAllByText(label)[0].parent;
  while (cell && cell.type !== 'View') cell = cell.parent;
  return cell.findAll((n) => n.type === 'Text').map((n) => n.props.children).find((c) => c !== label);
};

describe('Analysis screen with hikes', () => {
  it('shows the stats, not "No activity yet", when the only activity is a hike', () => {
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.queryByText('EMPTY: No activity yet')).toBeNull();
    expect(numberAbove(utils, 'Activities')).toBe(1);
  });

  it('still says "No activity yet" when there is nothing at all, and mentions hikes in what to do', () => {
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('EMPTY: No activity yet')).toBeTruthy();
    expect(utils.getByText('SUB: Complete a workout, log a run or finish a hike to see real stats here')).toBeTruthy();
  });

  it('draws a bar for the day of a hike in the activity chart', () => {
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.queryByText('No activity in this week yet')).toBeNull();
    expect(utils.getByText('Wed')).toBeTruthy();
  });

  it('puts a hike in the week it finished, not the week it started', () => {
    // started 11:00 PM Sunday 11 Oct, finished 2:00 AM Monday 12 Oct (the start of this week)
    mockHiking.completedHikes = [{ ...HIKE, startTime: '2026-10-12T03:00:00.000Z', completedAt: '2026-10-12T06:00:00.000Z' }];
    const utils = render(<AnalysisScreen />);
    expect(numberAbove(utils, 'Activities')).toBe(1);
  });

  it('adds a workout to the streak with a hike on the next day', () => {
    mockWorkouts.completedWorkouts = [{ id: 'w1', name: 'Push', completedAt: '2026-10-13T13:00:00.000Z', caloriesBurned: 300, duration: 2400 }];
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('2 days')).toBeTruthy();
  });

  it('uses the walking icon for a hike in the recent list', () => {
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.UNSAFE_queryAllByProps({ name: 'walk' }).length).toBeGreaterThan(0);
  });

  it('updates the totals, the records and the recent list when a hike arrives while the screen is open', () => {
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-14T14:00:00.000Z', endTime: '2026-10-14T14:30:00.000Z', distance: 5, duration: 1800, pace: 360, calories: 300 }];
    const utils = render(<AnalysisScreen />);
    expect(numberAbove(utils, 'Activities')).toBe(1);
    expect(utils.queryByText('Bear Mountain Loop')).toBeNull();
    expect(utils.queryByText('900 kcal')).toBeNull();
    mockHiking.completedHikes = [{ ...HIKE, startTime: '2026-10-13T15:00:00.000Z', completedAt: '2026-10-13T17:00:00.000Z' }];
    utils.rerender(<AnalysisScreen />);
    expect(numberAbove(utils, 'Activities')).toBe(2);
    expect(utils.getByText('Bear Mountain Loop')).toBeTruthy();
    expect(utils.getByText('900 kcal')).toBeTruthy(); // the most-calories record
    expect(utils.getByText('2 days')).toBeTruthy(); // the 13th and the 14th
  });

  it('adds a hike to the activity count and the calories beside a workout and a run', () => {
    mockWorkouts.completedWorkouts = [{ id: 'w1', name: 'Push', completedAt: '2026-10-14T13:00:00.000Z', caloriesBurned: 300, duration: 2400 }];
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-14T14:00:00.000Z', endTime: '2026-10-14T14:30:00.000Z', distance: 5, duration: 1800, pace: 360, calories: 320 }];
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(numberAbove(utils, 'Activities')).toBe(3);
    expect(numberAbove(utils, 'Calories')).toBe('1,520');
  });

  it('leaves out a hike from another week when the week is selected', () => {
    mockHiking.completedHikes = [HIKE, { ...HIKE, id: 'hike-0', startTime: '2026-09-20T15:00:00.000Z', completedAt: '2026-09-20T17:00:00.000Z' }];
    const utils = render(<AnalysisScreen />);
    expect(numberAbove(utils, 'Activities')).toBe(1);
    fireEvent.press(utils.getByText('Month'));
    expect(numberAbove(utils, 'Activities')).toBe(1); // 20 Sep is not in October
  });

  it('lists the hike in the recent activity with its trail, time, distance and calories', () => {
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('Bear Mountain Loop')).toBeTruthy();
    expect(utils.getByText('Hiking • 2h 0m • 8.0 km • 900 kcal')).toBeTruthy();
  });

  it('shows the hike distance in miles when Settings say so', () => {
    useSettingsStore.setState({ units: 'imperial' });
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('Hiking • 2h 0m • 5.0 mi • 900 kcal')).toBeTruthy();
    expect(utils.queryByText(/ km/)).toBeNull();
  });

  it('names a hike with no trail name "Hike"', () => {
    mockHiking.completedHikes = [{ ...HIKE, trailName: '' }];
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('Hike')).toBeTruthy();
  });

  it('shows the hike only under the All filter', () => {
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.queryByText('Bear Mountain Loop')).toBeTruthy();
    fireEvent.press(utils.getByText('Workouts'));
    expect(utils.queryByText('Bear Mountain Loop')).toBeNull();
    fireEvent.press(utils.getByText('Running'));
    expect(utils.queryByText('Bear Mountain Loop')).toBeNull();
    fireEvent.press(utils.getByText('All'));
    expect(utils.queryByText('Bear Mountain Loop')).toBeTruthy();
  });

  it('uses a hike for the most-calories record', () => {
    mockWorkouts.completedWorkouts = [{ id: 'w1', name: 'Push', completedAt: '2026-10-14T13:00:00.000Z', caloriesBurned: 300, duration: 2400 }];
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('900 kcal')).toBeTruthy();
    expect(utils.getByText('Most Calories (Single)')).toBeTruthy();
  });

  it('keeps a streak going through runs and hikes, though the workout streak is 0', () => {
    mockRunning.runs = [{ id: 'r1', startTime: '2026-10-13T14:00:00.000Z', endTime: '2026-10-13T14:30:00.000Z', distance: 5, duration: 1800, pace: 360, calories: 320 }];
    mockHiking.completedHikes = [HIKE];
    const utils = render(<AnalysisScreen />);
    expect(utils.getByText('Longest Streak')).toBeTruthy();
    expect(utils.getByText('2 days')).toBeTruthy();
    expect(utils.getByText('Current')).toBeTruthy();
  });

  it('does not show a streak record when there is no activity on any day', () => {
    mockWorkouts.completedWorkouts = [];
    const utils = render(<AnalysisScreen />);
    expect(utils.queryByText('Longest Streak')).toBeNull();
  });

  it('asks for the hikes to be loaded when it opens', async () => {
    render(<AnalysisScreen />);
    expect(mockHiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
  });
});

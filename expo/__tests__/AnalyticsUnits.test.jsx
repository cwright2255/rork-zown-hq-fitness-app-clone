import React from 'react';
import { act, render } from '@testing-library/react-native';

// The Analysis screen reads Settings > Distance Units from the real settings store; the next two
// keep it off the network and the phone's storage.
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
jest.mock('@/src/components/EmptyState', () => ({ __esModule: true, default: () => null }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
// The lists and functions are the same objects on every render, like the real stores' are, so a
// screen that forgets to recalculate when the unit changes would show the old unit here too.
const mockWorkouts = { completedWorkouts: [], loadWorkouts: () => {}, getWorkoutStreak: () => ({ current: 0, longest: 0 }) };
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: () => mockWorkouts }));
const mockRunning = { runs: [], loadRuns: () => {} };
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => mockRunning }));

import AnalysisScreen from '../app/analytics';
import { useSettingsStore } from '../store/settingsStore';

// One run today: 5.2 km in 26:00, 5:00 per km.
const RUN = { id: 'r1', distance: 5.2, duration: 1560, pace: 300, calories: 320 };

const open = () => {
  mockRunning.runs = [{ ...RUN, endTime: new Date().toISOString() }];
  return render(<AnalysisScreen />);
};

// The value that sits beside a label: both are Text inside the same stat cell View.
const valueNextTo = (utils, label, which = 0) => {
  let cell = utils.getAllByText(label)[which].parent;
  while (cell && cell.type !== 'View') cell = cell.parent;
  return cell.findAll((n) => n.type === 'Text').map((n) => n.props.children).find((c) => c !== label);
};

describe('Analysis screen distances', () => {
  beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

  it('gives the running stats, the longest-run record and the recent run in kilometres', () => {
    const utils = open();
    expect(valueNextTo(utils, 'Total Distance')).toBe('5.2 km');
    expect(valueNextTo(utils, 'Avg Pace')).toBe('5\'00"/km');
    expect(valueNextTo(utils, 'Longest Run')).toBe('5.2 km'); // the running stats
    expect(valueNextTo(utils, 'Longest Run', 1)).toBe('5.2 km'); // the personal record
    expect(utils.getByText(/^Running • .* • 5\.2 km$/)).toBeTruthy();
  });

  it('gives all of them in miles and minutes per mile when Settings say so', () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = open();
    expect(valueNextTo(utils, 'Total Distance')).toBe('3.2 mi'); // 5.2 km
    expect(valueNextTo(utils, 'Avg Pace')).toBe('8\'03"/mi'); // 5:00 per km
    expect(valueNextTo(utils, 'Longest Run')).toBe('3.2 mi');
    expect(valueNextTo(utils, 'Longest Run', 1)).toBe('3.2 mi');
    expect(utils.getByText(/^Running • .* • 3\.2 mi$/)).toBeTruthy();
    expect(utils.queryByText(/ km/)).toBeNull();
    expect(utils.queryByText(/"\/km/)).toBeNull();
  });

  it('changes when the setting changes while the screen is open', () => {
    const utils = open();
    expect(valueNextTo(utils, 'Total Distance')).toBe('5.2 km');
    act(() => { useSettingsStore.setState({ units: 'imperial' }); });
    expect(valueNextTo(utils, 'Total Distance')).toBe('3.2 mi');
    expect(valueNextTo(utils, 'Longest Run', 1)).toBe('3.2 mi'); // the personal record changes too
    expect(utils.getByText(/^Running • .* • 3\.2 mi$/)).toBeTruthy();
  });
});

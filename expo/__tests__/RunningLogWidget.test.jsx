// Home > Running Log: distance, time and average pace for the last 7 days, this month and everything logged, the latest run, and a
// button that opens the Running Log. jest.global-setup.js pins the zone to America/New_York; 9:30 PM on Wed 14 Oct there is 01:30Z on the 15th.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../src/config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('expo-location', () => ({}), { virtual: true }); // the running store imports it; no GPS is used here
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });

import { router } from 'expo-router';
import RunningLogWidget from '../components/RunningLogWidget';
import { useRunningStore } from '../store/runningStore';
import { useSettingsStore } from '../store/settingsStore';

const EVENING = new Date('2026-10-15T01:30:00Z'); // 9:30 PM on Wed 14 Oct in New Jersey
const at = (back, h, mi = 0) => new Date(2026, 9, 14 - back, h, mi).toISOString(); // `back` days before the 14th
const run = (back, o = {}) => ({ id: `r${back}`, startTime: at(back, 7), endTime: at(back, 7, 25), distance: 5, duration: 1500, ...o });
const pageValues = (utils, key) => utils.getByTestId(`home-widget-runninglog-page-${key}`)
  .findAll((n) => n.type === 'Text')
  .map((n) => n.props.children);

beforeEach(() => {
  jest.useFakeTimers({ now: EVENING, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  useRunningStore.setState({ runs: [] });
  useSettingsStore.setState({ units: 'metric' });
  router.push.mockClear();
});
afterEach(() => { jest.useRealTimers(); });

describe('Home > Running Log', () => {
  it('says there are no runs yet for someone who has not recorded one, and still offers the full log', () => {
    const utils = render(<RunningLogWidget />);
    expect(utils.getByText('Running Log')).toBeTruthy();
    expect(utils.getByTestId('home-widget-runninglog-empty').props.children).toBe('No runs yet. Record one and it shows up here.');
    expect(utils.queryByTestId('home-widget-runninglog-pager')).toBeNull();
    expect(utils.getByText('View Full Log')).toBeTruthy();
  });

  it('shows distance, time and average pace on each page, with how many runs', () => {
    useRunningStore.setState({ runs: [run(0), run(3, { distance: 10, duration: 3000 }), run(10, { distance: 4, duration: 1200 })] });
    const utils = render(<RunningLogWidget />);
    expect(pageValues(utils, 'week')).toEqual(['Last 7 days', '2 runs', '15.0 km', 'Distance', '1h 15m', 'Time', '5:00 /km', 'Avg pace']);
    expect(pageValues(utils, 'month')).toEqual(['This month', '3 runs', '19.0 km', 'Distance', '1h 35m', 'Time', '5:00 /km', 'Avg pace']);
    expect(pageValues(utils, 'all')).toEqual(['All logged', '3 runs', '19.0 km', 'Distance', '1h 35m', 'Time', '5:00 /km', 'Avg pace']);
  });

  it('follows Settings > Distance Units: miles and a pace per mile when it says imperial', () => {
    useRunningStore.setState({ runs: [run(0, { distance: 8.04672, duration: 2400 })] });
    act(() => { useSettingsStore.setState({ units: 'imperial' }); });
    const utils = render(<RunningLogWidget />);
    expect(pageValues(utils, 'week')).toEqual(['Last 7 days', '1 run', '5.0 mi', 'Distance', '40m', 'Time', '8:00 /mi', 'Avg pace']);
    act(() => { useSettingsStore.setState({ units: 'metric' }); });
    expect(pageValues(utils, 'week')).toEqual(['Last 7 days', '1 run', '8.0 km', 'Distance', '40m', 'Time', '4:58 /km', 'Avg pace']);
  });

  it('shows the latest run, whichever end of the list it is at, with its distance', () => {
    useRunningStore.setState({ runs: [run(0, { startTime: at(0, 6), endTime: at(0, 6, 40), distance: 6 }), run(3)] }); // newest first, as the phone keeps them
    const utils = render(<RunningLogWidget />);
    expect(utils.getByTestId('home-widget-runninglog-latest').props.children).toBe('Latest: Morning Run, 6.0 km \u00B7 Today');
    act(() => { useRunningStore.setState({ runs: [run(3), run(0, { startTime: at(0, 6), endTime: at(0, 6, 40), distance: 6 })] }); });
    expect(utils.getByTestId('home-widget-runninglog-latest').props.children).toBe('Latest: Morning Run, 6.0 km \u00B7 Today');
  });

  it('calls it "activities" once a walk is saved', () => {
    useRunningStore.setState({ runs: [run(0), run(1, { activity: 'walk', distance: 2, duration: 1500 })] });
    const utils = render(<RunningLogWidget />);
    expect(pageValues(utils, 'week').slice(0, 2)).toEqual(['Last 7 days', '2 activities']);
  });

  it('is titled and iconed as its Home widget', () => {
    const utils = render(<RunningLogWidget />);
    expect(utils.UNSAFE_root.findAll((n) => n.type === 'Ionicons').map((n) => n.props.name)).toEqual(['walk-outline']);
    expect(utils.getByTestId('home-widget-runninglog')).toBeTruthy();
  });

  it('opens the Running Log from the button', () => {
    const utils = render(<RunningLogWidget />);
    fireEvent.press(utils.getByTestId('home-widget-runninglog-open'));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/profile/running-log');
  });

  it('reads the card to a screen reader as a sentence', () => {
    useRunningStore.setState({ runs: [run(0)] });
    const utils = render(<RunningLogWidget />);
    expect(utils.getByLabelText(/^Running log\. Last 7 days: 1 run, 5\.0 km, 25m, average pace 5:00 \/km\./)).toBeTruthy();
  });

  it('updates when a run is saved', () => {
    const utils = render(<RunningLogWidget />);
    expect(utils.getByTestId('home-widget-runninglog-empty')).toBeTruthy();
    act(() => { useRunningStore.setState({ runs: [run(0)] }); });
    expect(utils.queryByTestId('home-widget-runninglog-empty')).toBeNull();
    expect(pageValues(utils, 'week').slice(0, 3)).toEqual(['Last 7 days', '1 run', '5.0 km']);
  });
});

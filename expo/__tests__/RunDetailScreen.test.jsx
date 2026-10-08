import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }), { virtual: true });
jest.mock('expo-router', () => ({
  useRouter: () => global.__router,
  useLocalSearchParams: () => global.__params,
}), { virtual: true });
jest.mock('@/components/RunRouteMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__routeProps = props;
      return mockReact.createElement(mockRn.View, { testID: 'route-map' });
    },
  };
});
jest.mock('@/store/runningStore', () => ({
  useRunningStore: (select) => select(global.__runningStore),
}));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));

import RunDetailScreen from '../app/running/run/[id]';

// 7:05 in the morning on Thu 8 Oct 2026 (local time, the screen reads local time too).
const START = new Date(2026, 9, 8, 7, 5, 0).toISOString();

const run = (extra = {}) => ({
  id: 'run-1',
  uid: 'u1',
  startTime: START,
  endTime: new Date(2026, 9, 8, 7, 31, 50).toISOString(),
  distance: 5.234,
  duration: 1610,
  pace: 308,
  calories: 366,
  track: [40, -74, 40.01, -74.01, 40.02, -74.02],
  splits: [300, 310, 305, 320, 295],
  elevGain: 42,
  elevLoss: 38,
  ...extra,
});

const open = (id, runs, { user = { uid: 'u1' }, loadRuns } = {}) => {
  global.__params = { id };
  global.__user = user;
  global.__router = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
  global.__runningStore = { runs, loadRuns: loadRuns || jest.fn(async () => undefined) };
  return render(<RunDetailScreen />);
};

describe('RunDetailScreen', () => {
  it('shows the title, date and headline numbers of the run', () => {
    const utils = open('run-1', [run()]);
    expect(utils.getByTestId('run-detail-title').props.children).toBe('Morning Run');
    expect(utils.getByText('Thu, Oct 8 • 7:05 AM')).toBeTruthy();
    expect(utils.getByTestId('run-detail-distance').props.children).toBe('5.23');
    expect(utils.getByTestId('run-detail-time').props.children).toEqual(['26:50', null]);
    expect(utils.getByTestId('run-detail-calories')).toBeTruthy();
    expect(utils.getByTestId('run-detail-pace')).toBeTruthy();
  });

  it('calls a walk a walk', () => {
    const utils = open('run-1', [run({ activity: 'walk' })]);
    expect(utils.getByTestId('run-detail-title').props.children).toBe('Morning Walk');
  });

  it('hands the route to the map', () => {
    open('run-1', [run()]);
    expect(global.__routeProps.points).toHaveLength(3);
    expect(global.__routeProps.points[0]).toEqual({ latitude: 40, longitude: -74 });
  });

  it('shows the climb and descent when they were recorded', () => {
    const utils = open('run-1', [run()]);
    expect(utils.getByTestId('run-detail-climb').props.children).toBe('42 m climb');
    expect(utils.getByText('38 m descent')).toBeTruthy();
  });

  it('leaves the elevation line out when there was none', () => {
    const utils = open('run-1', [run({ elevGain: 0, elevLoss: 0 })]);
    expect(utils.queryByTestId('run-detail-elevation')).toBeNull();
  });

  it('draws a pace bar and a table row for each kilometre, plus the part-kilometre at the end', () => {
    const utils = open('run-1', [run()]);
    for (let i = 0; i < 6; i += 1) {
      expect(utils.getByTestId(`pace-bar-${i}`)).toBeTruthy();
      expect(utils.getByTestId(`split-row-${i}`)).toBeTruthy();
    }
    expect(utils.queryByTestId('split-row-6')).toBeNull();
    expect(utils.getAllByText('0.23')).toHaveLength(2); // under its bar and in the table
  });

  it('paints the fastest kilometre green and makes it the tallest bar', () => {
    const utils = open('run-1', [run()]);
    const flat = (node) => [].concat(...[].concat(node.props.style).map((s) => (Array.isArray(s) ? s : [s]))).filter(Boolean);
    const fastest = flat(utils.getByTestId('pace-bar-4'));
    const slowest = flat(utils.getByTestId('pace-bar-3'));
    expect(fastest.some((s) => s.backgroundColor === '#22C55E')).toBe(true);
    expect(slowest.some((s) => s.backgroundColor === '#22C55E')).toBe(false);
    expect(fastest.find((s) => s.height).height).toBe('100%');
  });

  it('shows how far each kilometre was from the average', () => {
    const utils = open('run-1', [run({ splits: [300, 320], distance: 2, duration: 620 })]);
    expect(utils.getByText('-0:10')).toBeTruthy();
    expect(utils.getByText('+0:10')).toBeTruthy();
  });

  it('explains a run saved before splits were recorded', () => {
    const utils = open('run-1', [run({ splits: undefined })]);
    expect(utils.queryByTestId('pace-bar-0')).toBeNull();
    expect(utils.getByTestId('run-detail-nosplits').props.children).toBe('This run was saved before splits were recorded.');
  });

  it('explains a run too short to have splits', () => {
    const utils = open('run-1', [run({ splits: undefined, distance: 0.6, duration: 200 })]);
    expect(utils.getByTestId('run-detail-nosplits').props.children).toBe('Splits appear for runs of 1 km or more.');
  });

  it('says where an imported run came from', () => {
    const utils = open('run-1', [run({ source: 'apple-health' })]);
    expect(utils.getByTestId('run-detail-source').props.children).toBe('Imported from Apple Health');
  });

  it('shows no source line on a run recorded in Zown', () => {
    const utils = open('run-1', [run()]);
    expect(utils.queryByTestId('run-detail-source')).toBeNull();
  });

  it('explains why an imported run has no splits, instead of saying it was saved before they existed', () => {
    const utils = open('run-1', [run({ source: 'apple-health', splits: undefined, track: [] })]);
    expect(utils.getByTestId('run-detail-nosplits').props.children).toBe('Kilometre splits need a GPS route that matches the workout, and this one has none.');
  });

  it('shows the splits of an imported run that has them', () => {
    const utils = open('run-1', [run({ source: 'apple-health' })]);
    expect(utils.getByTestId('pace-bar-0')).toBeTruthy();
    expect(utils.queryByTestId('run-detail-nosplits')).toBeNull();
  });

  it('still opens a run with no route', () => {
    const utils = open('run-1', [run({ track: undefined })]);
    expect(utils.getByTestId('run-detail-title')).toBeTruthy();
    expect(global.__routeProps.points).toEqual([]);
  });

  it('finds the run by its id, whatever type it was saved with', () => {
    const utils = open('7', [run({ id: 7, distance: 3, duration: 900, splits: [300, 300, 300] })]);
    expect(utils.getByTestId('run-detail-distance').props.children).toBe('3.00');
  });

  it('goes back to the previous screen', () => {
    const utils = open('run-1', [run()]);
    fireEvent.press(utils.getByTestId('run-detail-back'));
    expect(global.__router.back).toHaveBeenCalled();
  });

  it('goes to the running hub when there is nothing to go back to', () => {
    const utils = open('run-1', [run()]);
    global.__router.canGoBack.mockReturnValue(false);
    fireEvent.press(utils.getByTestId('run-detail-back'));
    expect(global.__router.replace).toHaveBeenCalledWith('/running/program');
  });
});

describe('RunDetailScreen when the run is not in the list', () => {
  it('says the run was not found', () => {
    const utils = open('nope', [run()], { user: null });
    expect(utils.getByTestId('run-detail-notfound').props.children).toBe('Run not found');
  });

  it('loads the list when opened straight from a link, then shows the run', async () => {
    let resolve;
    const loadRuns = jest.fn(() => new Promise((r) => { resolve = r; }));
    const utils = open('run-1', [], { loadRuns });
    expect(loadRuns).toHaveBeenCalledWith('u1');
    expect(utils.getByTestId('run-detail-notfound').props.children).toBe('Loading your run...');

    global.__runningStore.runs = [run()];
    await act(async () => { resolve(); });
    utils.rerender(<RunDetailScreen />);
    expect(utils.getByTestId('run-detail-title')).toBeTruthy();
  });

  it('stops saying "loading" if the list could not be loaded', async () => {
    const loadRuns = jest.fn(async () => undefined);
    const utils = open('gone', [], { loadRuns });
    await act(async () => { await Promise.resolve(); });
    expect(utils.getByTestId('run-detail-notfound').props.children).toBe('Run not found');
  });

  it('does not try to load anything when nobody is signed in', () => {
    const loadRuns = jest.fn();
    open('run-1', [], { user: null, loadRuns });
    expect(loadRuns).not.toHaveBeenCalled();
  });
});

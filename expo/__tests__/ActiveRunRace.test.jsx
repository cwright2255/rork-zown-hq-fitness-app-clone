import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

// The run screen when it is started as a virtual race (from app/running/races/[kind].jsx):
// the race distance is the goal, and the time is posted when it is crossed.
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
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}), { virtual: true });
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }), { virtual: true });
jest.mock('@/components/RunningMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return { __esModule: true, default: () => mockReact.createElement(mockRn.View, { testID: 'map' }) };
});
jest.mock('@/services/radarService', () => ({ radarService: { reverseGeocode: jest.fn() } }));
jest.mock('@/services/runTracking', () => ({
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
}));
jest.mock('@/services/raceBoard', () => ({ finishRace: (...args) => global.__finishRace(...args) }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: () => global.__runningStore }));
jest.mock('@/store/virtualChallengeStore', () => ({
  useVirtualChallengeStore: { getState: () => ({ creditDistance: global.__creditDistance }) },
}));
jest.mock('@/store/expStore', () => ({ useExpStore: () => ({ addExpActivity: global.__addExp }) }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: global.__user }) }));
jest.mock('@/store/useActiveMusicPlayer', () => ({ useActiveMusicPlayer: () => global.__music }));

import ActiveRunScreen from '../app/running/active';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { useSettingsStore } from '../store/settingsStore';
import { currentRace } from '../lib/virtualRaces';
import { getSessionIntervals } from '../data/runningPrograms';

const Speech = require('expo-speech');

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
const store = () => useRunTrackerStore.getState();
const race = (kind) => currentRace(kind, new Date(T0));

// A reading at `sec` seconds after the start, `x` metres east of the start line.
const fix = (sec, x) => ({
  timestamp: T0 + sec * 1000,
  coords: { latitude: 40.7, longitude: -74 + x / 84300, accuracy: 4, speed: 4, altitude: null, altitudeAccuracy: -1, heading: 0 },
});
const tick = (seconds) => act(() => { jest.advanceTimersByTime(seconds * 1000); });
const mount = async () => {
  const utils = render(<ActiveRunScreen />);
  await act(async () => {});
  return utils;
};
// Runs `metres` at 4 metres a second from the start, in one go.
const runMetres = async (metres) => {
  const count = Math.floor(metres / 4);
  // async, so the result of the finish (a promise) lands inside the same act
  await act(async () => { store().ingest(Array.from({ length: count }, (_, i) => fix(i + 1, (i + 1) * 4))); });
  await tick(count);
  await act(async () => {});
};
const result = (extra = {}) => ({
  status: 'finished', timeSec: 1250, bestSec: 1250, first: true, improved: false, posted: 'posted', ...extra,
});
const goalValue = (utils) => [].concat(utils.getByTestId('run-goal-value').props.children).join('');

let warn;
beforeEach(() => {
  jest.useFakeTimers({ now: T0 });
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  useSettingsStore.setState({ units: 'metric' });
  global.__router = { replace: jest.fn(), push: jest.fn() };
  global.__music = {
    isConnected: false, trackName: '', artistName: '', isPlaying: false,
    playTrack: jest.fn(), pauseTrack: jest.fn(), nextTrack: jest.fn(), previousTrack: jest.fn(), updateCurrentTrack: jest.fn(),
  };
  global.__params = { raceKind: 'local' };
  global.__user = { uid: 'u1', name: 'Cj' };
  global.__creditDistance = jest.fn();
  global.__addExp = jest.fn();
  global.__runningStore = {
    endRun: jest.fn((uid, data) => (data.duration >= 10 ? { id: 'run-1', ...data } : null)),
    completeProgramSession: jest.fn(),
  };
  global.__finishRace = jest.fn(async () => result());
  store().reset();
  Speech.speak.mockClear();
  Speech.stop.mockClear();
});
afterEach(() => { warn.mockRestore(); jest.restoreAllMocks(); });

describe('a run started as a race', () => {
  it('is a run of its own kind, with the race distance counting down as the goal', async () => {
    const utils = await mount();
    expect(store().tracker.status).toBe('running');
    expect(store().tracker.kind).toBe(`race:${race('local').id}`);
    expect(utils.getByText('Local 5K')).toBeTruthy();
    expect(utils.queryByText('Distance Goal')).toBeNull();
    expect(goalValue(utils)).toBe('5.00 km to go');
    expect(utils.getByTestId('run-goal-percent').props.children).toEqual([0, '%']);
  });

  it('counts the distance down as the run goes, and fills the bar', async () => {
    const utils = await mount();
    await runMetres(1000);
    const left = Number(goalValue(utils).replace(' km to go', ''));
    expect(left).toBeGreaterThan(3.9);
    expect(left).toBeLessThan(4.1);
    expect(utils.getByTestId('run-goal-percent').props.children[0]).toBeGreaterThanOrEqual(19);
    expect(StyleSheet.flatten(utils.getByTestId('run-goal-fill').props.style).width).toMatch(/^(19|2\d)%$/);
  });

  it('counts down in miles for a person who reads miles', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await mount();
    expect(goalValue(utils)).toBe('3.11 mi to go');
  });

  it('names the race for the screen reader and does not offer to change the distance', async () => {
    const utils = await mount();
    const row = utils.getByTestId('run-goal-row');
    expect(row.props.accessibilityLabel).toBe('Local 5K. 5.00 km to go.');
    fireEvent.press(row);
    expect(utils.queryByTestId('run-goal-sheet')).toBeNull();
    expect(store().goalKm).toBeNull();
  });

  it('is the worldwide 10K when that race is started', async () => {
    global.__params = { raceKind: 'world' };
    const utils = await mount();
    expect(store().tracker.kind).toBe(`race:${race('world').id}`);
    expect(utils.getByText('Worldwide 10K')).toBeTruthy();
    expect(goalValue(utils)).toBe('10.00 km to go');
  });

  it('does not take a free run that was left paused for the race', async () => {
    global.__params = {};
    const free = await mount();
    await runMetres(200);
    free.unmount();
    expect(store().tracker.status).toBe('paused');
    expect(store().tracker.kind).toBe('run');
    global.__params = { raceKind: 'local' };
    await mount();
    expect(store().tracker.kind).toBe(`race:${race('local').id}`);
    expect(store().tracker.status).toBe('running');
    expect(store().tracker.distanceM).toBe(0);
  });

  it.each([
    ['a walk', { raceKind: 'local', activity: 'walk' }],
    ['a program session', { raceKind: 'local', programId: 'couch-to-5k', week: '1', sessionIndex: '0' }],
    ['something that is not a race', { raceKind: 'marathon' }],
    ['no race at all', {}],
  ])('is an ordinary goal row for %s', async (name, params) => {
    global.__params = params;
    const utils = await mount();
    expect(utils.getByText('Distance Goal')).toBeTruthy();
    expect(utils.queryByText('Local 5K')).toBeNull();
    expect(utils.getByTestId('run-goal-value').props.children).toBe('Not set');
    expect(store().tracker.kind).not.toMatch(/^race:/);
  });
});

describe('crossing the line', () => {
  it('posts the time once the race distance is done, with the run so far', async () => {
    const utils = await mount();
    await runMetres(5200);
    expect(global.__finishRace).toHaveBeenCalledTimes(1);
    const arg = global.__finishRace.mock.calls[0][0];
    expect(arg.race).toEqual(race('local'));
    expect(arg.user).toEqual({ uid: 'u1', name: 'Cj' });
    expect(arg.splits.length).toBeGreaterThanOrEqual(5);
    expect(arg.coords).toEqual(store().tracker.route.slice(0, arg.coords.length));
    expect(arg.coords.length).toBeGreaterThan(100);
    expect(arg.now).toBe(T0); // the clock when the line was crossed (the test feeds the run in before the clock moves on)
    expect(utils.getByTestId('run-race-result').props.children).toBe('Race finished in 20:50. It is on the Local 5K board.');
    expect(goalValue(utils)).toBe('Distance done');
    expect(utils.getByTestId('run-goal-percent').props.children).toEqual([100, '%']);
  });

  it('does nothing before the distance is done', async () => {
    const utils = await mount();
    await runMetres(4800);
    expect(global.__finishRace).not.toHaveBeenCalled();
    expect(utils.queryByTestId('run-race-result')).toBeNull();
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('says the time out loud, once, and the usual distance-goal cue is not used', async () => {
    await mount();
    await runMetres(5200);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    expect(Speech.speak.mock.calls[0][0]).toBe('Race finished. Your time is 20 minutes 50 seconds');
    expect(Speech.stop).toHaveBeenCalledTimes(1); // anything still being said gives way to the result
    expect(Speech.stop.mock.invocationCallOrder[0]).toBeLessThan(Speech.speak.mock.invocationCallOrder[0]);
    await tick(60);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when the sound is switched off, but still shows the result', async () => {
    const utils = await mount();
    fireEvent.press(utils.getByTestId('run-sound-button'));
    await runMetres(5200);
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(utils.getByTestId('run-race-result')).toBeTruthy();
  });

  it('posts only once however far the run goes on', async () => {
    await mount();
    await runMetres(5200);
    act(() => { store().ingest(Array.from({ length: 300 }, (_, i) => fix(1301 + i, 5200 + (i + 1) * 4))); });
    await tick(300);
    await act(async () => {});
    expect(global.__finishRace).toHaveBeenCalledTimes(1);
  });

  it('posts only once even if the splits fall back and the distance is reached again', async () => {
    await mount();
    await runMetres(5200);
    expect(global.__finishRace).toHaveBeenCalledTimes(1);
    const { tracker } = store();
    act(() => { useRunTrackerStore.setState({ tracker: { ...tracker, splits: [] } }); });
    await act(async () => {});
    expect(global.__finishRace).toHaveBeenCalledTimes(1);
    act(() => { useRunTrackerStore.setState({ tracker }); });
    await act(async () => {});
    expect(global.__finishRace).toHaveBeenCalledTimes(1);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('does not post a free run that happens to be 5K', async () => {
    global.__params = {};
    const utils = await mount();
    await runMetres(5200);
    expect(global.__finishRace).not.toHaveBeenCalled();
    expect(utils.queryByTestId('run-race-result')).toBeNull();
  });

  it.each([
    [{ status: 'finished', timeSec: 1250, bestSec: 1250, first: true, improved: false, posted: 'hidden' }, 'Finished in 20:50. Not posted, because you are hidden from leaderboards in Settings.'],
    [{ status: 'finished', timeSec: 1300, bestSec: 1250, first: false, improved: false, posted: 'posted' }, 'Finished in 21:40. Your best this week is 20:50.'],
    [{ status: 'closed', timeSec: 1250 }, 'The race ended before you reached the finish, so this time was not counted.'],
    [{ status: 'implausible', timeSec: 300 }, 'That pace is too fast for a run, so this time was not counted.'],
  ])('shows what happened to the time (%#)', async (outcome, message) => {
    global.__finishRace = jest.fn(async () => outcome);
    const utils = await mount();
    await runMetres(5200);
    expect(utils.getByTestId('run-race-result').props.children).toBe(message);
    expect(Speech.speak).toHaveBeenCalledTimes(outcome.status === 'finished' ? 1 : 0);
  });

  it('carries on when the post blows up', async () => {
    global.__finishRace = jest.fn(async () => { throw new Error('boom'); });
    const utils = await mount();
    await runMetres(5200);
    expect(warn).toHaveBeenCalledWith('Failed to post race:', 'boom');
    expect(utils.queryByTestId('run-race-result')).toBeNull();
    expect(store().tracker.status).toBe('running');
  });

  it('keeps recording after the line and saves the whole run when it is ended', async () => {
    const utils = await mount();
    await runMetres(5200);
    fireEvent.press(utils.getByTestId('run-main-button'));
    fireEvent.press(utils.getByText('End Run'));
    const saved = global.__runningStore.endRun.mock.calls[0][1];
    expect(saved.activity).toBe('run');
    expect(saved.distance).toBeGreaterThan(5.1);
    expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1');
  });
});

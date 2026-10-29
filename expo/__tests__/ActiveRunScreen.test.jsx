import React from 'react';
import { Alert, BackHandler, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}), { virtual: true });
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }), { virtual: true });
jest.mock('@/components/RunningMap', () => {
  const mockReact = require('react');
  const mockRn = require('react-native');
  return {
    __esModule: true,
    default: (props) => {
      global.__mapProps = props;
      return mockReact.createElement(mockRn.View, { testID: 'map' });
    },
  };
});
jest.mock('@/services/radarService', () => ({ radarService: { reverseGeocode: jest.fn() } }));
jest.mock('@/services/runTracking', () => ({
  startTracking: jest.fn(async () => 'background'),
  stopTracking: jest.fn(async () => undefined),
}));
jest.mock('@/store/runningStore', () => ({
  useRunningStore: () => global.__runningStore,
}));
jest.mock('@/store/virtualChallengeStore', () => ({
  useVirtualChallengeStore: { getState: () => ({ creditDistance: global.__creditDistance }) },
}));
jest.mock('@/store/expStore', () => ({ useExpStore: () => ({ addExpActivity: global.__addExp }) }));
jest.mock('@/store/userStore', () => ({ useUserStore: () => ({ user: { uid: 'u1' } }) }));
// The analytics event sent when a run is finished (the rest of the service is left as it is).
jest.mock('../src/services/analytics', () => ({
  ...jest.requireActual('../src/services/analytics'),
  logRunFinished: jest.fn(),
}));
// The music sheet reads whichever player is connected; here the test decides what it says.
jest.mock('@/store/useActiveMusicPlayer', () => ({ useActiveMusicPlayer: () => global.__music }));

import ActiveRunScreen from '../app/running/active';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { trackedMs } from '../lib/runTracker';
import { getSessionIntervals } from '../data/runningPrograms';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const Location = require('expo-location');
const Speech = require('expo-speech');
const analytics = require('../src/services/analytics');
const tracking = require('@/services/runTracking');

const T0 = Date.UTC(2026, 9, 8, 12, 0, 0);
const store = () => useRunTrackerStore.getState();

// A reading at `sec` seconds after the start, `x` metres east of the start line.
const fix = (sec, x, extra = {}) => ({
  timestamp: T0 + sec * 1000,
  coords: {
    latitude: 40.7, longitude: -74 + x / 84300, accuracy: 4, speed: 3, altitude: null, altitudeAccuracy: -1, heading: 0, ...extra,
  },
});

// Moves the clock on and lets the screen redraw.
const tick = (seconds) => act(() => { jest.advanceTimersByTime(seconds * 1000); });
const mount = async () => {
  const utils = render(<ActiveRunScreen />);
  await act(async () => {});
  return utils;
};
const textOf = (utils, id) => utils.getByTestId(id).props.children;

describe('ActiveRunScreen', () => {
  let alert;
  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
    global.__router = { replace: jest.fn(), push: jest.fn() };
    global.__music = {
      isConnected: true, trackName: 'Run the World', artistName: 'Beyonc\u00E9', isPlaying: false,
      playTrack: jest.fn(async () => undefined), pauseTrack: jest.fn(async () => undefined),
      nextTrack: jest.fn(async () => undefined), previousTrack: jest.fn(async () => undefined),
      updateCurrentTrack: jest.fn(async () => undefined),
    };
    global.__params = {};
    global.__creditDistance = jest.fn();
    global.__addExp = jest.fn();
    global.__runningStore = {
      endRun: jest.fn((uid, data) => (data.duration >= 10 ? { id: 'run-1', ...data } : null)),
      completeProgramSession: jest.fn(),
    };
    store().reset();
    Location.requestForegroundPermissionsAsync.mockClear();
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    tracking.startTracking.mockClear();
    tracking.stopTracking.mockClear();
    Speech.speak.mockClear();
    analytics.logRunFinished.mockClear();
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    alert.mockRestore();
  });

  it('starts recording and GPS once location is allowed', async () => {
    await mount();
    expect(store().tracker.status).toBe('running');
    expect(store().tracker.autoPause).toBe(true);
    expect(tracking.startTracking).toHaveBeenCalledTimes(1);
  });

  it('records nothing and explains why when location is refused', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await mount();
    expect(alert).toHaveBeenCalledWith('Permission Needed', expect.stringMatching(/Settings/));
    expect(store().tracker.status).toBe('idle');
    expect(tracking.startTracking).not.toHaveBeenCalled();
  });

  it('shows time, distance and pace from the tracker, and the route on the map', async () => {
    const utils = await mount();
    act(() => { store().ingest(Array.from({ length: 120 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
    await tick(120);
    expect(utils.getByText('0:02:00')).toBeTruthy();
    expect(utils.getByText('0.35')).toBeTruthy(); // 360 m, counted in 10 m steps and a little behind
    expect(utils.getByText(/^5'(3[5-9]|4\d)"$/)).toBeTruthy(); // about 5:44 per km
    expect(global.__mapProps.coordinates).toBe(store().tracker.route);
    expect(global.__mapProps.coordinates.length).toBeGreaterThan(20);
    expect(global.__mapProps.currentLocation).toBe(store().tracker.current);
  });

  it('labels the distance in kilometres when Settings are in km', async () => {
    const utils = await mount();
    expect(utils.getByText('Kilometers')).toBeTruthy();
    expect(utils.queryByText('Miles')).toBeNull();
  });

  it('shows the distance in miles and the pace per mile when Settings say so', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    const utils = await mount();
    act(() => { store().ingest(Array.from({ length: 120 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
    await tick(120);
    expect(utils.getByText('0:02:00')).toBeTruthy();
    expect(utils.getByText('0.22')).toBeTruthy(); // the same 0.35 km, as miles
    expect(utils.getByText('Miles')).toBeTruthy();
    expect(utils.queryByText('Kilometers')).toBeNull();
    // about 5:44 per km is about 9:14 per mile
    const paceTexts = utils.queryAllByText(/^\d+'\d\d"$/).map((n) => n.props.children);
    expect(paceTexts).toHaveLength(1);
    const [m, s] = paceTexts[0].split("'").map((x) => parseInt(x, 10));
    expect(m * 60 + s).toBeGreaterThanOrEqual(8 * 60 + 55);
    expect(m * 60 + s).toBeLessThanOrEqual(9 * 60 + 25);
  });

  it('keeps counting the clock while no readings come in', async () => {
    const utils = await mount();
    await tick(75);
    expect(utils.getByText('0:01:15')).toBeTruthy();
  });

  it('shows a GPS banner until the first reading, and removes it once there is one', async () => {
    const utils = await mount();
    expect(utils.getByText('Searching for GPS...')).toBeTruthy();
    act(() => { store().ingest([fix(1, 0)]); });
    await tick(1);
    expect(utils.queryByText('Searching for GPS...')).toBeNull();
    await tick(20);
    expect(utils.getByText('GPS signal lost')).toBeTruthy();
  });

  it('shows the climb once there is some', async () => {
    const utils = await mount();
    expect(utils.queryByTestId('run-climb')).toBeNull();
    act(() => {
      store().ingest(Array.from({ length: 250 }, (_, i) => fix(i + 1, (i + 1) * 3, { altitude: 50 + (i + 1) * 0.2, altitudeAccuracy: 4 })));
    });
    await tick(250);
    expect(textOf(utils, 'run-climb').join('')).toMatch(/^\d+ m climb$/);
    expect(Number(textOf(utils, 'run-climb')[0])).toBeGreaterThan(30);
  });

  describe('pausing', () => {
    it('the big button pauses, shows Resume and End, and resumes', async () => {
      const utils = await mount();
      await tick(30);
      fireEvent.press(utils.getByTestId('run-main-button'));
      expect(store().tracker.status).toBe('paused');
      expect(utils.getByText('Paused')).toBeTruthy();
      expect(utils.getByText('Resume')).toBeTruthy();
      await tick(30);
      expect(utils.getByText('0:00:30')).toBeTruthy(); // the clock stood still

      tracking.startTracking.mockClear();
      fireEvent.press(utils.getByText('Resume'));
      expect(store().tracker.status).toBe('running');
      expect(utils.queryByText('Paused')).toBeNull();
      expect(tracking.startTracking).toHaveBeenCalledTimes(1);
    });

    it('shows an auto-pause banner, and tapping the big button carries on', async () => {
      const utils = await mount();
      act(() => {
        store().ingest(Array.from({ length: 40 }, (_, i) => fix(i + 1, (i + 1) * 3)));
        store().ingest(Array.from({ length: 30 }, (_, i) => fix(41 + i, 120, { speed: 0 })));
      });
      await tick(70);
      expect(store().tracker.status).toBe('auto');
      expect(utils.getByText(/Auto-paused/)).toBeTruthy();
      fireEvent.press(utils.getByTestId('run-main-button'));
      expect(store().tracker.status).toBe('running');
      expect(utils.queryByText(/Auto-paused/)).toBeNull();
    });

    it('can turn auto-pause off and on from the menu', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-menu-button'));
      fireEvent.press(utils.getByText('Auto-pause: On'));
      expect(store().tracker.autoPause).toBe(false);
      fireEvent.press(utils.getByTestId('run-menu-button'));
      expect(utils.getByText('Auto-pause: Off')).toBeTruthy();
      fireEvent.press(utils.getByText('Auto-pause: Off'));
      expect(store().tracker.autoPause).toBe(true);
    });

    it('leaving the screen pauses the run, and coming back offers to resume it', async () => {
      const first = await mount();
      act(() => { store().ingest(Array.from({ length: 30 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
      await tick(30);
      const startedAt = store().tracker.startedAt;
      first.unmount();
      expect(store().tracker.status).toBe('paused');

      await tick(60);
      const second = await mount();
      expect(store().tracker.startedAt).toBe(startedAt);
      expect(second.getByText('Resume')).toBeTruthy();
      expect(second.getByText('0:00:30')).toBeTruthy();
    });
  });

  describe('ending a run', () => {
    const runFor = async (seconds) => {
      const utils = await mount();
      act(() => {
        store().ingest(Array.from({ length: seconds }, (_, i) => fix(i + 1, (i + 1) * 4, {
          speed: 4, altitude: 50 + (i + 1) * 0.1, altitudeAccuracy: 4,
        })));
      });
      await tick(seconds);
      return utils;
    };

    it('tells the results which journey the run took over the line', async () => {
      global.__creditDistance.mockReturnValue({ completed: ['grand-canyon-rim'] });
      const utils = await runFor(520);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1&journeys=grand-canyon-rim');
    });

    it('adds nothing about journeys when the run finished none', async () => {
      global.__creditDistance.mockReturnValue({ completed: [] });
      const utils = await runFor(520);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1');
    });

    it('saves what the tracker measured, credits it, and opens the results', async () => {
      const utils = await runFor(520);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));

      const { endRun } = global.__runningStore;
      expect(endRun).toHaveBeenCalledTimes(1);
      const [uid, data] = endRun.mock.calls[0];
      expect(uid).toBe('u1');
      expect(data.duration).toBe(520);
      expect(data.distance).toBeGreaterThan(1.9);
      expect(data.distance).toBeLessThan(2.09);
      expect(data.splits).toHaveLength(2);
      expect(data.splits[0]).toBeGreaterThan(240);
      expect(data.splits[0]).toBeLessThan(262);
      expect(data.elevGain).toBeGreaterThan(0);
      expect(data.coords.length).toBeGreaterThan(100);
      expect(data.calories).toBe(Math.round(data.distance * 70));
      expect(data.startTime).toBe(new Date(T0).toISOString());

      expect(global.__creditDistance).toHaveBeenCalledWith(data.distance, 'u1');
      expect(global.__addExp).toHaveBeenCalledTimes(1);
      expect(tracking.stopTracking).toHaveBeenCalledTimes(1);
      expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1');
      expect(store().tracker.status).toBe('idle');
    });

    it('saves the distance in kilometres whatever the setting, and words the XP note in miles', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      const utils = await runFor(520);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      const [, data] = global.__runningStore.endRun.mock.calls[0];
      expect(data.distance).toBeGreaterThan(1.9); // kilometres, as always
      expect(data.distance).toBeLessThan(2.09);
      const note = global.__addExp.mock.calls[0][0].description;
      expect(note).toBe(`Completed a ${(data.distance / 1.609344).toFixed(2)}mi run`);
    });

    it('counts only moving time: a long pause is not in the saved duration', async () => {
      const utils = await runFor(100);
      fireEvent.press(utils.getByTestId('run-main-button'));
      await tick(300);
      fireEvent.press(utils.getByText('Resume'));
      await tick(20);
      fireEvent.press(utils.getByTestId('run-menu-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(global.__runningStore.endRun.mock.calls[0][1].duration).toBe(120);
    });

    it('saves nothing for a run under 10 seconds', async () => {
      const utils = await mount();
      await tick(4);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(global.__creditDistance).not.toHaveBeenCalled();
      expect(global.__addExp).not.toHaveBeenCalled();
      expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=none');
    });

    it('saves only once if End is tapped twice', async () => {
      const utils = await runFor(60);
      fireEvent.press(utils.getByTestId('run-main-button'));
      const end = utils.getByText('End Run');
      // both taps land before the screen has had time to redraw
      act(() => {
        fireEvent.press(end);
        fireEvent.press(end);
      });
      expect(global.__runningStore.endRun).toHaveBeenCalledTimes(1);
      expect(global.__router.replace).toHaveBeenCalledTimes(1);
    });

    it('sends one run_finished event, naming only the kind of outing, when a run is saved', async () => {
      const utils = await runFor(520);
      expect(analytics.logRunFinished).not.toHaveBeenCalled();
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(analytics.logRunFinished).toHaveBeenCalledTimes(1);
      expect(analytics.logRunFinished).toHaveBeenCalledWith('run');
    });

    it('sends no run_finished event for a run under 10 seconds, which is not saved', async () => {
      const utils = await mount();
      await tick(4);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(analytics.logRunFinished).not.toHaveBeenCalled();
    });

    it('sends the run_finished event once if End is tapped twice', async () => {
      const utils = await runFor(60);
      fireEvent.press(utils.getByTestId('run-main-button'));
      const end = utils.getByText('End Run');
      act(() => {
        fireEvent.press(end);
        fireEvent.press(end);
      });
      expect(analytics.logRunFinished).toHaveBeenCalledTimes(1);
    });

    it('does not pause a run that has ended when the screen closes', async () => {
      const utils = await runFor(60);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      utils.unmount();
      expect(store().tracker.status).toBe('idle');
    });
  });

  describe('a free walk', () => {
    beforeEach(() => { global.__params = { activity: 'walk' }; });

    const walkFor = async (seconds) => {
      const utils = await mount();
      act(() => {
        store().ingest(Array.from({ length: seconds }, (_, i) => fix(i + 1, (i + 1) * 2, { speed: 2 })));
      });
      await tick(seconds);
      return utils;
    };

    it('records like a run, with auto-pause on, and remembers it is a walk', async () => {
      await mount();
      expect(store().tracker.status).toBe('running');
      expect(store().tracker.autoPause).toBe(true);
      expect(store().tracker.kind).toBe('walk');
    });

    it('tells the results which journeys the walk took over the line', async () => {
      global.__creditDistance.mockReturnValue({ completed: ['grand-canyon-rim', 'inca-trail'] });
      const utils = await walkFor(900);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Walk'));
      expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1&journeys=grand-canyon-rim,inca-trail');
    });

    it('calls the buttons and menu "walk"', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-main-button'));
      expect(utils.getByText('End Walk')).toBeTruthy();
      expect(utils.queryByText('End Run')).toBeNull();
    });

    it('sends the run_finished event for a walk with the activity "walk"', async () => {
      const utils = await walkFor(900);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Walk'));
      expect(analytics.logRunFinished).toHaveBeenCalledTimes(1);
      expect(analytics.logRunFinished).toHaveBeenCalledWith('walk');
    });

    it('saves it as a walk, with walking calories and walking XP', async () => {
      const utils = await walkFor(900);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Walk'));

      const [, data] = global.__runningStore.endRun.mock.calls[0];
      expect(data.activity).toBe('walk');
      expect(data.distance).toBeGreaterThan(1.5);
      expect(data.calories).toBe(Math.round(data.distance * 40));
      const exp = global.__addExp.mock.calls[0][0];
      expect(exp.baseExp).toBe(Math.round(data.distance * 18));
      expect(exp.description).toMatch(/km walk$/);
      expect(global.__creditDistance).toHaveBeenCalledWith(data.distance, 'u1');
      expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1');
    });

    it('never counts toward a running program, and never asks about ending early', async () => {
      const utils = await walkFor(30);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Walk'));
      expect(utils.queryByTestId('run-confirm-end')).toBeNull();
      expect(global.__runningStore.completeProgramSession).not.toHaveBeenCalled();
    });

    it('ignores a walk request that comes with a program', async () => {
      global.__params = { activity: 'walk', programId: 'c25k', week: '1', sessionIndex: '0' };
      await mount();
      expect(store().tracker.kind).toBe('c25k:1:0');
    });

    it('a free run still saves as a run, with no activity tag', async () => {
      global.__params = {};
      const utils = await mount();
      await tick(30);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      const [, data] = global.__runningStore.endRun.mock.calls[0];
      expect(data.activity).toBe('run');
      expect(global.__addExp.mock.calls[0][0].description).toMatch(/km run$/);
    });

    it('does not pick up a paused run when you start a walk', async () => {
      global.__params = {};
      const first = await mount();
      act(() => { store().ingest(Array.from({ length: 30 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
      await tick(30);
      const runStartedAt = store().tracker.startedAt;
      first.unmount();
      expect(store().tracker.status).toBe('paused');

      await tick(60);
      global.__params = { activity: 'walk' };
      await mount();
      expect(store().tracker.kind).toBe('walk');
      expect(store().tracker.startedAt).not.toBe(runStartedAt);
      expect(store().tracker.status).toBe('running');
    });

    it('does pick up a paused walk when you open Free walk again', async () => {
      const first = await mount();
      act(() => { store().ingest(Array.from({ length: 30 }, (_, i) => fix(i + 1, (i + 1) * 2, { speed: 2 }))); });
      await tick(30);
      const startedAt = store().tracker.startedAt;
      first.unmount();

      await tick(60);
      const second = await mount();
      expect(store().tracker.startedAt).toBe(startedAt);
      expect(second.getByText('Resume')).toBeTruthy();
    });
  });

  describe('a run/walk program session', () => {
    const intervals = getSessionIntervals('c25k', 1, 0);
    const total = intervals.reduce((sum, i) => sum + i.seconds, 0);
    beforeEach(() => { global.__params = { programId: 'c25k', week: '1', sessionIndex: '0' }; });

    it('starts with auto-pause off and shows the first interval', async () => {
      const utils = await mount();
      expect(store().tracker.autoPause).toBe(false);
      expect(utils.getByText(intervals[0].cue.toUpperCase())).toBeTruthy();
    });

    it('speaks the next cue when the phase changes, from moving time', async () => {
      await mount();
      expect(Speech.speak).not.toHaveBeenCalled();
      await tick(intervals[0].seconds + 1);
      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(Speech.speak.mock.calls[0][0]).toMatch(intervals[1].cue === 'Run' ? /Run now/ : /Walk now/);
    });

    it('does not speak when sound is switched off', async () => {
      global.__params = { programId: 'c25k', week: '1', sessionIndex: '0', audioCues: 'false' };
      await mount();
      await tick(intervals[0].seconds + 1);
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('the countdown stops while paused', async () => {
      const utils = await mount();
      await tick(10);
      fireEvent.press(utils.getByTestId('run-main-button'));
      await tick(500);
      expect(Speech.speak).not.toHaveBeenCalled();
      expect(store().tracker.movingMs).toBe(10000);
    });

    it('ends and credits the session when the last interval is done', async () => {
      await mount();
      await tick(total - 5);
      expect(global.__runningStore.endRun).not.toHaveBeenCalled();
      for (let i = 0; i < 10; i += 1) await tick(1); // the screen redraws once a second
      const { endRun, completeProgramSession } = global.__runningStore;
      expect(endRun).toHaveBeenCalledTimes(1);
      expect(endRun.mock.calls[0][1].duration).toBeGreaterThanOrEqual(total);
      expect(endRun.mock.calls[0][1].duration).toBeLessThanOrEqual(total + 1);
      expect(completeProgramSession).toHaveBeenCalledWith('c25k', expect.any(Number), 'u1');
      expect(global.__router.replace).toHaveBeenCalledTimes(1);
    });

    describe('ending early', () => {
      const endFromMenu = (utils) => {
        fireEvent.press(utils.getByTestId('run-menu-button'));
        fireEvent.press(utils.getByText('End Run'));
      };
      const threshold = Math.round(total * 0.8);

      it('asks first, and the clock stands still while it asks', async () => {
        const utils = await mount();
        const half = Math.floor(total / 2);
        await tick(half);
        endFromMenu(utils);
        expect(utils.getByTestId('run-confirm-end')).toBeTruthy();
        expect(utils.getByText(new RegExp(`${Math.round((half / total) * 100)}% through this session`))).toBeTruthy();
        expect(store().tracker.status).toBe('paused');
        expect(global.__runningStore.endRun).not.toHaveBeenCalled();
        await tick(120);
        expect(store().tracker.movingMs).toBe(half * 1000);
      });

      it('Keep going carries on with the session', async () => {
        const utils = await mount();
        await tick(100);
        endFromMenu(utils);
        fireEvent.press(utils.getByTestId('run-keep-going'));
        expect(utils.queryByTestId('run-confirm-end')).toBeNull();
        expect(store().tracker.status).toBe('running');
        await tick(10);
        expect(trackedMs(store().tracker, Date.now())).toBe(110000);
        expect(global.__runningStore.endRun).not.toHaveBeenCalled();
      });

      it('End anyway saves the run but does not tick the session off', async () => {
        const utils = await mount();
        await tick(300);
        endFromMenu(utils);
        fireEvent.press(utils.getByTestId('run-end-anyway'));
        const { endRun, completeProgramSession } = global.__runningStore;
        expect(endRun).toHaveBeenCalledTimes(1);
        expect(endRun.mock.calls[0][1].duration).toBe(300);
        expect(completeProgramSession).not.toHaveBeenCalled();
        expect(global.__addExp.mock.calls[0][0].description).toMatch(/^Completed a .*km run$/);
        expect(global.__router.replace).toHaveBeenCalledWith('/workout/complete?type=run&runId=run-1');
        expect(store().tracker.status).toBe('idle');
      });

      it('asks from the pause panel too', async () => {
        const utils = await mount();
        await tick(60);
        fireEvent.press(utils.getByTestId('run-main-button'));
        fireEvent.press(utils.getByText('End Run'));
        expect(utils.getByTestId('run-confirm-end')).toBeTruthy();
        expect(utils.queryByText('Resume')).toBeNull();
        expect(global.__runningStore.endRun).not.toHaveBeenCalled();
      });

      it('still asks just under the line', async () => {
        const utils = await mount();
        await tick(threshold - 2);
        endFromMenu(utils);
        expect(utils.getByTestId('run-confirm-end')).toBeTruthy();
      });

      it('does not ask once enough is done, and ticks the session off', async () => {
        const utils = await mount();
        await tick(threshold);
        endFromMenu(utils);
        expect(utils.queryByTestId('run-confirm-end')).toBeNull();
        const { endRun, completeProgramSession } = global.__runningStore;
        expect(endRun).toHaveBeenCalledTimes(1);
        expect(completeProgramSession).toHaveBeenCalledWith('c25k', 3, 'u1');
        expect(global.__addExp.mock.calls[0][0].description).toMatch(/c25k week 1, session 1/);
      });

      it('never asks on a free run', async () => {
        global.__params = {};
        const utils = await mount();
        await tick(20);
        endFromMenu(utils);
        expect(utils.queryByTestId('run-confirm-end')).toBeNull();
        expect(global.__runningStore.endRun).toHaveBeenCalledTimes(1);
        expect(global.__runningStore.completeProgramSession).not.toHaveBeenCalled();
      });
    });
  });

  describe('the lock', () => {
    it('is off to begin with, and the lock button turns it on', async () => {
      const utils = await mount();
      expect(utils.queryByTestId('run-lock-overlay')).toBeNull();
      fireEvent.press(utils.getByTestId('run-lock-button'));
      expect(utils.getByTestId('run-lock-overlay')).toBeTruthy();
      expect(utils.getByTestId('run-lock-hint').props.children).toBe('Locked. Hold to unlock.');
    });

    it('covers the whole screen, above the controls', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-lock-button'));
      const style = StyleSheet.flatten(utils.getByTestId('run-lock-overlay').props.style);
      expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
      expect(style.zIndex).toBeGreaterThan(10); // over the header buttons (10) and the stats panel (5)
    });

    it('keeps recording while it is locked', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-lock-button'));
      act(() => { store().ingest(Array.from({ length: 60 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
      await tick(60);
      expect(store().tracker.status).toBe('running');
      expect(utils.getByText('0:01:00')).toBeTruthy();
      expect(utils.getByText('0.17')).toBeTruthy();
    });

    it('stays locked when the screen is tapped, and opens only when it is held', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-lock-button'));
      fireEvent.press(utils.getByTestId('run-lock-overlay'));
      expect(utils.getByTestId('run-lock-overlay')).toBeTruthy();
      const hold = utils.UNSAFE_getAllByProps({ testID: 'run-lock-overlay' })[0].props.delayLongPress;
      expect(hold).toBeGreaterThanOrEqual(500); // a real hold, not a touch
      fireEvent(utils.getByTestId('run-lock-overlay'), 'longPress');
      expect(utils.queryByTestId('run-lock-overlay')).toBeNull();
      // and the controls work again
      fireEvent.press(utils.getByTestId('run-main-button'));
      expect(store().tracker.status).toBe('paused');
    });

    it('can be turned on again after it was opened', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-lock-button'));
      fireEvent(utils.getByTestId('run-lock-overlay'), 'longPress');
      fireEvent.press(utils.getByTestId('run-lock-button'));
      expect(utils.getByTestId('run-lock-overlay')).toBeTruthy();
    });

    it('makes the Android back button do nothing while locked, and gives it back afterwards', async () => {
      const handlers = [];
      const remove = jest.fn();
      const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, handler) => {
        handlers.push({ event, handler });
        return { remove };
      });
      try {
        const utils = await mount();
        expect(handlers).toHaveLength(0);
        fireEvent.press(utils.getByTestId('run-lock-button'));
        expect(handlers).toHaveLength(1);
        expect(handlers[0].event).toBe('hardwareBackPress');
        expect(handlers[0].handler()).toBe(true); // true means "handled": the screen does not go back
        fireEvent(utils.getByTestId('run-lock-overlay'), 'longPress');
        expect(remove).toHaveBeenCalledTimes(1);
      } finally {
        add.mockRestore();
      }
    });

    it('is drawn in white and grey', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-lock-button'));
      const json = JSON.stringify(utils.toJSON());
      expect(json).not.toMatch(/22C55E|4A90D9|FFD700/i);
    });
  });

  describe('the distance goal', () => {
    // 360 m in two minutes, as above: 0.35 km counted.
    const walkSomeMetres = async () => {
      act(() => { store().ingest(Array.from({ length: 120 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
      await tick(120);
    };
    // 1.2 km at 4 m a second.
    const runOneTwoKm = async () => {
      act(() => { store().ingest(Array.from({ length: 300 }, (_, i) => fix(i + 1, (i + 1) * 4, { speed: 4 }))); });
      await tick(300);
    };
    const pick = (utils, value) => fireEvent.press(utils.getByTestId(`run-goal-option-${value}`));

    it('is not set to begin with: no percent, and no 5 km nobody asked for', async () => {
      const utils = await mount();
      await walkSomeMetres();
      expect(utils.getByTestId('run-goal-value').props.children).toBe('Not set');
      expect(utils.queryByTestId('run-goal-percent')).toBeNull();
      expect(utils.queryByTestId('run-goal-fill')).toBeNull();
    });

    it('opens a sheet of round distances in kilometres, and closes it again', async () => {
      const utils = await mount();
      expect(utils.queryByTestId('run-goal-sheet')).toBeNull();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      expect(utils.getByTestId('run-goal-sheet')).toBeTruthy();
      [1, 3, 5, 10, 15, 21.1].forEach((km) => expect(utils.getByTestId(`run-goal-option-${km}`)).toBeTruthy());
      expect(utils.getByText('21.1 km')).toBeTruthy();
      expect(utils.queryByTestId('run-goal-clear')).toBeNull(); // nothing to clear yet
      fireEvent.press(utils.getByTestId('run-goal-backdrop'));
      expect(utils.queryByTestId('run-goal-sheet')).toBeNull();
    });

    it('shows the goal with how far along the run is, and a bar that fills', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 5);
      expect(utils.queryByTestId('run-goal-sheet')).toBeNull();
      expect(utils.getByTestId('run-goal-value').props.children).toBe('5 km');
      expect(utils.getByTestId('run-goal-percent').props.children).toEqual([0, '%']);
      await walkSomeMetres();
      // The tracker counts a little under 0.35 km here, and the percent never rounds up.
      const expected = Math.floor((store().tracker.distanceM / 1000 / 5) * 100);
      expect(expected).toBe(6);
      expect(utils.getByTestId('run-goal-percent').props.children).toEqual([expected, '%']);
      expect(StyleSheet.flatten(utils.getByTestId('run-goal-fill').props.style).width).toBe(`${expected}%`);
      expect(store().goalKm).toBe(5);
    });

    it('offers miles when Settings are in miles, and keeps the goal in km underneath', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      [1, 2, 3, 5, 10, 13.1].forEach((mi) => expect(utils.getByTestId(`run-goal-option-${mi}`)).toBeTruthy());
      pick(utils, 3);
      expect(utils.getByTestId('run-goal-value').props.children).toBe('3 mi');
      expect(store().goalKm).toBeCloseTo(4.828032, 5);
      await walkSomeMetres();
      expect(utils.getByTestId('run-goal-percent').props.children).toEqual([7, '%']); // 0.35 km of 4.83 km
    });

    it('rewrites the goal when the unit changes during the run', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 5);
      expect(utils.getByTestId('run-goal-value').props.children).toBe('5 km');
      act(() => { useSettingsStore.setState({ units: 'imperial' }); });
      expect(utils.getByTestId('run-goal-value').props.children).toBe('3.1 mi');
    });

    it('marks the goal that is set, and clears it', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 10);
      fireEvent.press(utils.getByTestId('run-goal-row'));
      expect(utils.getByTestId('run-goal-option-10').props.accessibilityState.selected).toBe(true);
      expect(utils.getByTestId('run-goal-option-5').props.accessibilityState.selected).toBe(false);
      fireEvent.press(utils.getByTestId('run-goal-clear'));
      expect(utils.getByTestId('run-goal-value').props.children).toBe('Not set');
      expect(store().goalKm).toBeNull();
    });

    it('says so out loud when the goal is reached, once, and shows it done', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 1);
      await runOneTwoKm();
      expect(utils.getByTestId('run-goal-percent').props.children).toEqual([100, '%']);
      expect(utils.UNSAFE_getAllByType('Ionicons').some((i) => i.props.name === 'checkmark')).toBe(true);
      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(Speech.speak.mock.calls[0][0]).toBe('Distance goal reached');
      await tick(60);
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });

    it('stays quiet when the sound is switched off', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-sound-button'));
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 1);
      await runOneTwoKm();
      expect(utils.getByTestId('run-goal-percent').props.children).toEqual([100, '%']);
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('does not announce a goal that is already behind the run', async () => {
      const utils = await mount();
      await runOneTwoKm();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 1);
      expect(utils.getByTestId('run-goal-percent').props.children).toEqual([100, '%']);
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('announces a new goal when that one is reached', async () => {
      const utils = await mount();
      await walkSomeMetres();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 1);
      await runOneTwoKm();
      expect(Speech.speak).toHaveBeenCalledTimes(1);
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 3); // further on than the run has got
      expect(utils.getByTestId('run-goal-percent').props.children[0]).toBeLessThan(100);
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });

    it('is still there when the screen is closed and opened again on the same run', async () => {
      const first = await mount();
      fireEvent.press(first.getByTestId('run-goal-row'));
      pick(first, 5);
      first.unmount();
      const second = await mount();
      expect(second.getByTestId('run-goal-value').props.children).toBe('5 km');
    });

    it('is dropped when a new run starts instead of picking up the old one', async () => {
      store().begin({ kind: 'run', now: T0 });
      store().setGoalKm(5);
      store().pause(T0 + 1000);
      expect(store().begin({ kind: 'run', now: T0 + 12 * 3600 * 1000 })).toBe('new'); // left long ago: not picked up
      expect(store().goalKm).toBeNull();
    });

    it('is kept when the same run is picked up again', async () => {
      store().begin({ kind: 'run', now: T0 });
      store().setGoalKm(5);
      store().pause(T0 + 1000);
      expect(store().begin({ kind: 'run', now: T0 + 60 * 1000 })).toBe('resumed');
      expect(store().goalKm).toBe(5);
    });

    it('is dropped when the run is thrown away', async () => {
      store().begin({ kind: 'run', now: T0 });
      store().setGoalKm(5);
      store().reset();
      expect(store().goalKm).toBeNull();
    });

    it('only keeps a distance above zero', async () => {
      store().setGoalKm(-2);
      expect(store().goalKm).toBeNull();
      store().setGoalKm('abc');
      expect(store().goalKm).toBeNull();
      store().setGoalKm(8);
      expect(store().goalKm).toBe(8);
    });

    it('is gone when the run ends, so the next run starts with none', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-goal-row'));
      pick(utils, 5);
      await tick(20);
      fireEvent.press(utils.getByTestId('run-main-button'));
      fireEvent.press(utils.getByText('End Run'));
      expect(store().goalKm).toBeNull();
      const next = await mount();
      expect(next.getByTestId('run-goal-value').props.children).toBe('Not set');
    });

    it('still shows the climb on the same row', async () => {
      const utils = await mount();
      act(() => {
        store().ingest(Array.from({ length: 60 }, (_, i) => fix(i + 1, (i + 1) * 3, { altitude: 50 + (i + 1) * 0.5, altitudeAccuracy: 4 })));
      });
      await tick(60);
      expect(utils.getByTestId('run-climb')).toBeTruthy();
    });
  });

  describe('music', () => {
    const openMusic = (utils) => {
      fireEvent.press(utils.getByTestId('run-menu-button'));
      fireEvent.press(utils.getByText('Music'));
      act(() => { jest.advanceTimersByTime(400); }); // the menu fades out first
    };

    it('does nothing until the menu has closed, then opens the music sheet', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-menu-button'));
      fireEvent.press(utils.getByText('Music'));
      expect(utils.queryByText('Music')).toBeNull(); // the menu is gone
      expect(utils.queryByTestId('run-music-sheet')).toBeNull();
      act(() => { jest.advanceTimersByTime(200); });
      expect(utils.queryByTestId('run-music-sheet')).toBeNull(); // still fading: a second sheet cannot open yet
      act(() => { jest.advanceTimersByTime(200); });
      expect(utils.getByTestId('run-music-sheet')).toBeTruthy();
    });

    it('shows what is playing', async () => {
      const utils = await mount();
      openMusic(utils);
      expect(utils.getByTestId('run-music-track').props.children).toBe('Run the World');
      expect(utils.getByTestId('run-music-artist').props.children).toBe('Beyoncé');
    });

    it('says when nothing is playing', async () => {
      global.__music = { ...global.__music, trackName: null, artistName: null };
      const utils = await mount();
      openMusic(utils);
      expect(utils.getByTestId('run-music-track').props.children).toBe('No Track Playing');
      expect(utils.getByTestId('run-music-artist').props.children).toBe('Unknown Artist');
    });

    it('plays, pauses and skips', async () => {
      const utils = await mount();
      openMusic(utils);
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-toggle')); });
      expect(global.__music.playTrack).toHaveBeenCalledTimes(1);
      expect(global.__music.pauseTrack).not.toHaveBeenCalled();
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-next')); });
      expect(global.__music.nextTrack).toHaveBeenCalledTimes(1);
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-prev')); });
      expect(global.__music.previousTrack).toHaveBeenCalledTimes(1);
    });

    it('pauses when it is playing', async () => {
      global.__music = { ...global.__music, isPlaying: true };
      const utils = await mount();
      openMusic(utils);
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-toggle')); });
      expect(global.__music.pauseTrack).toHaveBeenCalledTimes(1);
      expect(global.__music.playTrack).not.toHaveBeenCalled();
    });

    it('tells the person when playback fails, and what to do when no device is awake', async () => {
      global.__music.playTrack.mockRejectedValueOnce(new Error('No active device found'));
      const utils = await mount();
      openMusic(utils);
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-toggle')); });
      expect(alert).toHaveBeenCalledWith('Playback Failed', expect.stringMatching(/Open Spotify once on this phone/));
      global.__music.nextTrack.mockRejectedValueOnce(new Error('Rate limited'));
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-next')); });
      expect(alert).toHaveBeenLastCalledWith('Playback Failed', 'Rate limited');
    });

    it('tells the person when an action fails at once, not only when it is awaited', async () => {
      global.__music.previousTrack = jest.fn(() => { throw new Error('boom'); });
      const utils = await mount();
      openMusic(utils);
      await act(async () => { fireEvent.press(utils.getByTestId('run-music-prev')); });
      expect(alert).toHaveBeenCalledWith('Playback Failed', 'boom');
    });

    it('looks up what is playing when it opens, and again while it stays open', async () => {
      const utils = await mount();
      expect(global.__music.updateCurrentTrack).not.toHaveBeenCalled();
      openMusic(utils);
      expect(global.__music.updateCurrentTrack).toHaveBeenCalledTimes(1);
      await tick(15);
      expect(global.__music.updateCurrentTrack).toHaveBeenCalledTimes(2);
      fireEvent.press(utils.getByTestId('run-music-backdrop'));
      await tick(30);
      expect(global.__music.updateCurrentTrack).toHaveBeenCalledTimes(2); // closed: stopped asking
    });

    it('carries on if looking up what is playing fails', async () => {
      global.__music.updateCurrentTrack = jest.fn(async () => { throw new Error('offline'); });
      const utils = await mount();
      openMusic(utils);
      await act(async () => {});
      expect(utils.getByTestId('run-music-track')).toBeTruthy();
      expect(alert).not.toHaveBeenCalled();
    });

    it('opens the search screen, closing the sheet first so it is not left over the new screen', async () => {
      const utils = await mount();
      openMusic(utils);
      fireEvent.press(utils.getByTestId('run-music-search'));
      expect(utils.queryByTestId('run-music-sheet')).toBeNull();
      expect(global.__router.push).toHaveBeenCalledWith('/music-search');
    });

    it('offers to connect a player when none is connected', async () => {
      global.__music = { isConnected: false, trackName: null, artistName: null, isPlaying: false };
      const utils = await mount();
      openMusic(utils);
      expect(utils.getByText('Connect Music')).toBeTruthy();
      expect(utils.queryByTestId('run-music-toggle')).toBeNull();
      fireEvent.press(utils.getByTestId('run-music-connect'));
      expect(utils.queryByTestId('run-music-sheet')).toBeNull();
      expect(global.__router.push).toHaveBeenCalledWith('/profile/settings');
    });

    it('closes from the backdrop and leaves the run going', async () => {
      const utils = await mount();
      openMusic(utils);
      fireEvent.press(utils.getByTestId('run-music-backdrop'));
      expect(utils.queryByTestId('run-music-sheet')).toBeNull();
      expect(store().tracker.status).toBe('running');
    });

    it('does not open if the screen is closed while the menu is fading', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-menu-button'));
      fireEvent.press(utils.getByText('Music'));
      utils.unmount();
      expect(() => act(() => { jest.advanceTimersByTime(400); })).not.toThrow();
    });

    it('is drawn in white and grey', async () => {
      const utils = await mount();
      openMusic(utils);
      expect(JSON.stringify(utils.toJSON())).not.toMatch(/1DB954|22C55E|4A90D9|FFD700/i);
    });
  });

  // Zown's black and white, like the run maps, saved runs and the feed. The screen used to
  // show the time in blue, pace in yellow, calories in green, and a blue ring and buttons.
  describe('the black and white look', () => {
    // The old blue, yellow and green, in any way of writing them.
    const OLD_COLOURS = [/^#4A90D9$/, /^#FFD700$/, /^#22C55E$/, /^RGBA\(74,144,217\b/, /^RGBA\(255,215,0\b/, /^RGBA\(34,197,94\b/];

    // Every colour drawn on the screen: text, backgrounds, borders and icon colours.
    const coloursOnScreen = (utils) => {
      const found = new Set();
      const visit = (node) => {
        if (!node || typeof node === 'string') return;
        const style = StyleSheet.flatten(node.props && node.props.style) || {};
        const add = (value) => found.add(String(value).toUpperCase().replace(/\s+/g, ''));
        ['color', 'backgroundColor', 'borderColor'].forEach((key) => { if (style[key]) add(style[key]); });
        if (node.props && typeof node.props.color === 'string') add(node.props.color);
        (node.children || []).forEach(visit);
      };
      const tree = utils.toJSON();
      (Array.isArray(tree) ? tree : [tree]).forEach(visit);
      return found;
    };
    const expectNoOldColours = (utils) => {
      const found = coloursOnScreen(utils);
      const old = [...found].filter((colour) => OLD_COLOURS.some((pattern) => pattern.test(colour)));
      expect(old).toEqual([]);
    };
    const colourOf = (node) => String(StyleSheet.flatten(node.props.style).color).toUpperCase();
    const fillOf = (node) => String(StyleSheet.flatten(node.props.style).backgroundColor).toUpperCase();
    // The View that holds a piece of text: wrappers in between are skipped.
    const viewAround = (node) => {
      let up = node.parent;
      while (up && up.type !== 'View') up = up.parent;
      return up;
    };

    it('shows time, pace and calories in white', async () => {
      const utils = await mount();
      act(() => { store().setGoalKm(5); });
      act(() => { store().ingest(Array.from({ length: 120 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
      await tick(120);
      expect(colourOf(utils.getByText('0:02:00'))).toBe('#FFF');
      expect(colourOf(utils.getByText(/^5'(3[5-9]|4\d)"$/))).toBe('#FFF');
      expect(colourOf(utils.getByText('0.35'))).toBe('#FFF');
      expect(colourOf(utils.getByText('Distance Goal'))).toBe('#FFF');
      expect(colourOf(utils.getByText(/^\d+%$/))).toBe('#FFFFFF');
      expectNoOldColours(utils);
    });

    it('draws a running run in white and grey only', async () => {
      const utils = await mount();
      act(() => { store().ingest(Array.from({ length: 30 }, (_, i) => fix(i + 1, (i + 1) * 3))); });
      await tick(30);
      expectNoOldColours(utils);
    });

    it('draws the paused panel and its banner in white and grey, with a white Resume button', async () => {
      const utils = await mount();
      await tick(30);
      fireEvent.press(utils.getByTestId('run-main-button'));
      expect(utils.getByText('Paused')).toBeTruthy();
      const resume = utils.getByText('Resume');
      expect(colourOf(resume)).toBe('#000');
      expect(fillOf(viewAround(resume))).toBe('#FFFFFF');
      expectNoOldColours(utils);
    });

    it('draws the auto-pause banner in white and grey', async () => {
      const utils = await mount();
      act(() => {
        store().ingest(Array.from({ length: 40 }, (_, i) => fix(i + 1, (i + 1) * 3)));
        store().ingest(Array.from({ length: 30 }, (_, i) => fix(41 + i, 120, { speed: 0 })));
      });
      await tick(70);
      expect(utils.getByText(/Auto-paused/)).toBeTruthy();
      expectNoOldColours(utils);
    });

    it('keeps amber for a GPS problem and red for ending the run, because those mean something', async () => {
      const utils = await mount();
      expect(utils.getByText('Searching for GPS...')).toBeTruthy();
      expect(coloursOnScreen(utils).has('RGBA(217,119,6,0.92)')).toBe(true);
      fireEvent.press(utils.getByTestId('run-main-button'));
      const end = utils.getByText('End Run');
      expect(colourOf(end)).toBe('#FF3B30');
      expect(String(StyleSheet.flatten(viewAround(end).props.style).borderColor).toUpperCase()).toBe('#FF3B30');
    });

    describe('in a program session', () => {
      const intervals = getSessionIntervals('c25k', 1, 0);
      beforeEach(() => { global.__params = { programId: 'c25k', week: '1', sessionIndex: '0' }; });

      // The banner follows the phase: dark text on the white Run banner, white text on the grey Walk banner.
      const expectBannerFor = (utils, interval) => {
        const label = utils.getByText(interval.cue.toUpperCase());
        const banner = viewAround(label);
        if (interval.type === 'run') {
          expect(fillOf(banner)).toBe('#FFFFFF');
          expect(colourOf(label)).toBe('#0D1117');
        } else {
          expect(fillOf(banner)).toBe('#2A2F38');
          expect(colourOf(label)).toBe('#FFF');
        }
      };

      it('shows each phase in white or grey, with text you can read on it', async () => {
        const utils = await mount();
        expectBannerFor(utils, intervals[0]);
        expectNoOldColours(utils);
        await tick(intervals[0].seconds + 1);
        expectBannerFor(utils, intervals[1]);
        expectNoOldColours(utils);
      });

      it('has a white run phase and a grey walk phase somewhere in the session', () => {
        expect(intervals.some((i) => i.type === 'run')).toBe(true);
        expect(intervals.some((i) => i.type !== 'run')).toBe(true);
      });

      it('draws the end-early question in white and grey', async () => {
        const utils = await mount();
        await tick(100);
        fireEvent.press(utils.getByTestId('run-menu-button'));
        fireEvent.press(utils.getByText('End Run'));
        expect(utils.getByTestId('run-confirm-end')).toBeTruthy();
        expectNoOldColours(utils);
      });
    });
  });
});

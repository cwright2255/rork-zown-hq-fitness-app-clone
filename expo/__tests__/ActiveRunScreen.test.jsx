import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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

import ActiveRunScreen from '../app/running/active';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { trackedMs } from '../lib/runTracker';
import { getSessionIntervals } from '../data/runningPrograms';

const Location = require('expo-location');
const Speech = require('expo-speech');
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
    global.__router = { replace: jest.fn() };
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

    it('calls the buttons and menu "walk"', async () => {
      const utils = await mount();
      fireEvent.press(utils.getByTestId('run-main-button'));
      expect(utils.getByText('End Walk')).toBeTruthy();
      expect(utils.queryByText('End Run')).toBeNull();
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
});

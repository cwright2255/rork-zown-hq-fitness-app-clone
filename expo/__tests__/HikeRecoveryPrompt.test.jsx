import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

// These read Settings > Distance Units from the real settings store; the next two keep it off the network and the phone's storage.
// The tests below were written in kilometres, so they start there (the miles tests set 'imperial' themselves).
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock('@/services/runTracking', () => ({ stopTracking: jest.fn(async () => undefined) }));

import { router } from 'expo-router';
import { stopTracking } from '@/services/runTracking';
import HikeRecoveryPrompt from '../components/HikeRecoveryPrompt';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { createTracker } from '../lib/runTracker';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const NOW = 1_760_000_000_000;
const store = () => useRunTrackerStore.getState();

// An unfinished hike as the store holds it after the app is opened: 5.4 km in 1h 2m.
function foundHike({ context = { mapId: 'm1', pathName: 'Ridge' }, kind = 'hike:t7', recovered = true } = {}) {
  act(() => useRunTrackerStore.setState({
    tracker: {
      ...createTracker({ autoPause: false, kind }),
      status: 'paused', startedAt: NOW - 7_200_000, lastT: NOW - 600_000, lastFixT: NOW - 600_000, pausedAt: NOW - 600_000,
      movingMs: 3_725_000, distanceM: 5432,
    },
    context,
    recovered,
  }));
}

const MESSAGE = 'You have an unfinished hike: 5.4 km in 1h 2m. Open it to carry on or to save it.';
const resetStore = () => { act(() => { store().reset(); }); };
const alerts = () => Alert.alert.mock.calls;
const press = (call, label) => {
  const button = call[2].find((b) => b.text === label);
  act(() => { button.onPress(); });
};

describe('HikeRecoveryPrompt', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    resetStore();
    router.push.mockClear();
    stopTracking.mockClear();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    resetStore();
  });

  it('shows nothing of its own', () => {
    foundHike();
    expect(render(<HikeRecoveryPrompt />).toJSON()).toBeNull();
  });

  it('asks what to do with the unfinished hike', () => {
    foundHike();
    render(<HikeRecoveryPrompt />);
    expect(alerts()).toHaveLength(1);
    const [title, message, buttons, options] = alerts()[0];
    expect(title).toBe('Unfinished hike');
    expect(message).toBe(MESSAGE);
    expect(buttons.map((b) => [b.text, b.style])).toEqual([['Discard', 'destructive'], ['Open hike', undefined]]);
    expect(options).toEqual({ cancelable: false });
  });

  it('counts the time a hike that is still going has run since it was last heard from', () => {
    foundHike();
    act(() => {
      useRunTrackerStore.setState({
        tracker: { ...store().tracker, status: 'running', pausedAt: 0, movingMs: 3_580_000, lastT: NOW - 30_000 },
      });
    });
    render(<HikeRecoveryPrompt />);
    expect(alerts()[0][1]).toBe('You have an unfinished hike: 5.4 km in 1h 0m. Open it to carry on or to save it.');
  });

  it('asks how far in miles when Settings say so', () => {
    useSettingsStore.setState({ units: 'imperial' });
    foundHike();
    render(<HikeRecoveryPrompt />);
    expect(alerts()[0][1]).toBe('You have an unfinished hike: 3.4 mi in 1h 2m. Open it to carry on or to save it.'); // 5.4 km
  });

  it('asks when it is not told otherwise', () => {
    foundHike();
    render(<HikeRecoveryPrompt />);
    expect(alerts()).toHaveLength(1);
  });

  it('does not ask while it is not enabled, and asks as soon as it is', () => {
    foundHike();
    const view = render(<HikeRecoveryPrompt enabled={false} />);
    expect(alerts()).toHaveLength(0);
    view.rerender(<HikeRecoveryPrompt enabled />);
    expect(alerts()).toHaveLength(1);
  });

  it('does not ask when no hike was found', () => {
    foundHike({ recovered: false });
    render(<HikeRecoveryPrompt />);
    expect(alerts()).toHaveLength(0);
  });

  it('asks when a hike is found after it has been shown', () => {
    foundHike({ recovered: false });
    render(<HikeRecoveryPrompt />);
    expect(alerts()).toHaveLength(0);
    act(() => { useRunTrackerStore.setState({ recovered: true }); });
    expect(alerts()).toHaveLength(1);
  });

  it('asks only once', () => {
    foundHike();
    const view = render(<HikeRecoveryPrompt />);
    view.rerender(<HikeRecoveryPrompt enabled />);
    view.rerender(<HikeRecoveryPrompt enabled={false} />);
    view.rerender(<HikeRecoveryPrompt enabled />);
    act(() => { useRunTrackerStore.setState({ recovered: false }); });
    act(() => { useRunTrackerStore.setState({ recovered: true }); });
    expect(alerts()).toHaveLength(1);
  });

  describe('Open hike', () => {
    it('opens the hike screen on its trail, to carry on, with its map and path', () => {
      foundHike();
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Open hike');
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/running/hiking/monitor',
        params: { id: 't7', resume: '1', mapId: 'm1', pathName: 'Ridge' },
      });
    });

    it('says the hike has been dealt with before it goes there, and leaves the hike as it is', () => {
      foundHike();
      const tracker = store().tracker;
      let recoveredWhenOpened = null;
      router.push.mockImplementationOnce(() => { recoveredWhenOpened = store().recovered; });
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Open hike');
      expect(recoveredWhenOpened).toBe(false);
      expect(store().recovered).toBe(false);
      expect(store().tracker).toBe(tracker);
      expect(stopTracking).not.toHaveBeenCalled();
    });

    it('sends nothing about a map and path the hike did not have', () => {
      foundHike({ context: null });
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Open hike');
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/running/hiking/monitor',
        params: { id: 't7', resume: '1' },
      });
    });

    it('sends only the part of the map and path there is', () => {
      foundHike({ context: { pathName: 'Ridge' } });
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Open hike');
      expect(router.push.mock.calls[0][0].params).toEqual({ id: 't7', resume: '1', pathName: 'Ridge' });
    });

    it('goes to the trail the hike was on', () => {
      foundHike({ kind: 'hike:trail-42' });
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Open hike');
      expect(router.push.mock.calls[0][0].params.id).toBe('trail-42');
    });
  });

  describe('Discard', () => {
    it('asks again before anything is thrown away', () => {
      foundHike();
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Discard');
      expect(alerts()).toHaveLength(2);
      const [title, message, buttons, options] = alerts()[1];
      expect(title).toBe('Discard this hike?');
      expect(message).toBe('The distance and route recorded so far will be lost.');
      expect(buttons.map((b) => [b.text, b.style])).toEqual([['Keep it', 'cancel'], ['Discard hike', 'destructive']]);
      expect(options).toEqual({ cancelable: false });
      expect(store().tracker.status).toBe('paused');
      expect(stopTracking).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });

    it('asks about the hike again when it is kept', () => {
      foundHike();
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Discard');
      press(alerts()[1], 'Keep it');
      expect(alerts()).toHaveLength(3);
      expect(alerts()[2][0]).toBe('Unfinished hike');
      expect(alerts()[2][1]).toBe(MESSAGE);
      expect(store().tracker.status).toBe('paused');
      expect(store().recovered).toBe(true);
      expect(stopTracking).not.toHaveBeenCalled();
    });

    it('can be kept, then opened', () => {
      foundHike();
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Discard');
      press(alerts()[1], 'Keep it');
      press(alerts()[2], 'Open hike');
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(store().recovered).toBe(false);
    });

    it('throws the hike away, and switches the GPS off, once it is confirmed', () => {
      foundHike();
      render(<HikeRecoveryPrompt />);
      press(alerts()[0], 'Discard');
      press(alerts()[1], 'Discard hike');
      expect(stopTracking).toHaveBeenCalledTimes(1);
      expect(store().tracker.status).toBe('idle');
      expect(store().context).toBeNull();
      expect(store().recovered).toBe(false);
      expect(router.push).not.toHaveBeenCalled();
      expect(alerts()).toHaveLength(2);
    });
  });
});

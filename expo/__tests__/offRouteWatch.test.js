// These read Settings > Distance Units from the real settings store; the next two keep it off the network and the phone's storage.
// The tests below were written in kilometres, so they start there (the miles tests set 'imperial' themselves).
jest.mock('../src/config/firebase', () => ({ db: {} }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }), { virtual: true });
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}), { virtual: true });
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
}), { virtual: true });

import { AppState } from 'react-native';
import { alertOffRoute, watchOffRoute } from '../services/offRouteWatch';
import { useRunTrackerStore } from '../store/runTrackerStore';
import { OFF_ROUTE_AFTER_MS, REMIND_EVERY_MS } from '../lib/offRoute';
import { useSettingsStore } from '../store/settingsStore';

beforeEach(() => { useSettingsStore.setState({ units: 'metric' }); });

const Speech = require('expo-speech');
const Haptics = require('expo-haptics');
const Notifications = require('expo-notifications');

const T0 = 1_700_000_000_000;
const M_LAT = 111195;
const M_LNG = 84300;
const pt = (x, y = 0) => ({ latitude: 40.7 + y / M_LAT, longitude: -74 + x / M_LNG });
const LINE = [pt(0), pt(500), pt(1000)];

// A stand-in for the tracker store whose readings are fully in the test's hands.
function fakeStore(initial = {}) {
  let state = { tracker: { lastFixT: 0, status: 'running', current: null, acc: 5, ...initial } };
  const listeners = new Set();
  return {
    getState: () => state,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    listenerCount: () => listeners.size,
    emit: (patch) => {
      state = { tracker: { ...state.tracker, ...patch } };
      listeners.forEach((fn) => fn(state));
    },
  };
}
// A reading `sec` seconds after the start, `x` metres east and `y` north.
const at = (store, sec, x, y = 0, extra = {}) => store.emit({ lastFixT: T0 + sec * 1000, current: pt(x, y), ...extra });
// A reading every 5 seconds over a stretch.
const stay = (store, from, to, x, y = 0, extra = {}) => {
  for (let sec = from; sec <= to; sec += 5) at(store, sec, x, y, extra);
};
const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

const setAppState = (value) => Object.defineProperty(AppState, 'currentState', { value, configurable: true });

describe('watchOffRoute', () => {
  let store;
  let onChange;
  let warn;
  beforeEach(() => {
    jest.clearAllMocks();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Haptics.notificationAsync.mockResolvedValue(undefined);
    setAppState('active');
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    store = fakeStore();
    onChange = jest.fn();
  });
  afterEach(() => warn.mockRestore());

  const start = (opts = {}) => watchOffRoute({ route: LINE, onChange, store, ...opts });

  describe('while the hiker is on the trail', () => {
    it('says and does nothing', async () => {
      start();
      stay(store, 0, 120, 100, 5);
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Speech.speak).not.toHaveBeenCalled();
    });

    it('says nothing on the walk to the trailhead, however long and far', async () => {
      start();
      stay(store, 0, 300, 100, 500);
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      expect(Speech.speak).not.toHaveBeenCalled();
    });
  });

  describe('when the hiker strays', () => {
    const stray = () => {
      at(store, 0, 100, 0);
      stay(store, 5, 5 + OFF_ROUTE_AFTER_MS / 1000 + 5, 100, 150);
    };

    it('tells the screen, buzzes and speaks, with how far off', async () => {
      start();
      stray();
      await flush();
      expect(onChange).toHaveBeenCalledTimes(1);
      const call = onChange.mock.calls[0][0];
      expect(call.off).toBe(true);
      expect(call.event).toBe('off');
      expect(call.distanceM).toBeGreaterThanOrEqual(149);
      expect(call.distanceM).toBeLessThanOrEqual(151);
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
      expect(Speech.stop).toHaveBeenCalled();
      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(Speech.speak.mock.calls[0][0]).toBe('You may be off the trail. You are about 150 meters from the route.');
    });

    it('speaks the distance in feet when Settings are in miles', async () => {
      useSettingsStore.setState({ units: 'imperial' });
      start();
      stray();
      await flush();
      expect(onChange.mock.calls[0][0].distanceM).toBeGreaterThanOrEqual(149); // the screen gets metres and says them in its own unit
      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(Speech.speak.mock.calls[0][0]).toBe('You may be off the trail. You are about 500 feet from the route.');
    });

    it('waits for the hiker to stay off before it says anything', async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 20, 100, 150); // 15 s off
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('does not speak when the sound is switched off, but still buzzes and tells the screen', async () => {
      start({ speak: () => false });
      stray();
      await flush();
      expect(Speech.speak).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('asks whether to speak each time, so the switch can change during the hike', async () => {
      let sound = false;
      start({ speak: () => sound });
      stray();
      await flush();
      expect(Speech.speak).not.toHaveBeenCalled();
      sound = true;
      at(store, 5 + REMIND_EVERY_MS / 1000 + 40, 100, 160);
      await flush();
      expect(Speech.speak).toHaveBeenCalledTimes(1);
    });

    it('shows the distance again as it grows, in steps, not on every reading', async () => {
      start();
      stray();
      onChange.mockClear();
      at(store, 40, 100, 152);
      at(store, 41, 100, 153);
      at(store, 42, 100, 154); // same 10 m step as 150
      expect(onChange).not.toHaveBeenCalled();
      at(store, 43, 100, 170); // next step
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({ off: true, event: null });
      expect(onChange.mock.calls[0][0].distanceM).toBeGreaterThanOrEqual(169);
      await flush();
      expect(Speech.speak).toHaveBeenCalledTimes(1); // not spoken again for a bigger number
    });

    it('reminds, aloud, when still off after the reminder time', async () => {
      start();
      stray();
      await flush();
      Speech.speak.mockClear();
      onChange.mockClear();
      at(store, 30 + REMIND_EVERY_MS / 1000, 100, 200);
      await flush();
      expect(Speech.speak).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({ off: true, event: 'remind' });
    });
  });

  describe('when the hiker comes back', () => {
    it('tells the screen, buzzes the happy way and says so', async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 40, 100, 150);
      await flush();
      onChange.mockClear();
      Speech.speak.mockClear();
      Haptics.notificationAsync.mockClear();
      at(store, 45, 100, 5);
      await flush();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0]).toMatchObject({ off: false, event: 'back' });
      expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
      expect(Speech.speak).toHaveBeenCalledWith('Back on the trail.', expect.anything());
    });

    it('goes quiet again afterwards', async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 40, 100, 150);
      at(store, 45, 100, 5);
      await flush();
      onChange.mockClear();
      stay(store, 50, 200, 200, 5);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('which readings count', () => {
    it('ignores a hike that is paused, and does not warn about time spent standing off the trail', async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 15, 100, 150); // 10 s off, then paused
      store.emit({ status: 'paused' });
      stay(store, 20, 300, 100, 150); // paused readings are not judged
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      store.emit({ status: 'running' });
      stay(store, 305, 320, 100, 150); // 15 s after resuming: still not long enough
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      stay(store, 325, 335, 100, 150);
      await flush();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].event).toBe('off');
    });

    it('ignores an auto-paused hike too', async () => {
      start();
      at(store, 0, 100, 0);
      store.emit({ status: 'auto' });
      stay(store, 5, 100, 100, 150);
      await flush();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores the same reading arriving again', async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 35, 100, 150);
      await flush();
      onChange.mockClear();
      Haptics.notificationAsync.mockClear();
      store.emit({ acc: 6 }); // something else about the tracker changed, not a reading
      store.emit({ status: 'running' });
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('only judges readings that arrive after it started', async () => {
      const busy = fakeStore({ lastFixT: T0, current: pt(100, 300) });
      watchOffRoute({ route: LINE, onChange, store: busy });
      busy.emit({ status: 'running' }); // same reading as before
      await flush();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores a reading with no position', async () => {
      start();
      store.emit({ lastFixT: T0 + 1000, current: null });
      await flush();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('lets a vague GPS reading have more room', async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 100, 100, 80, { acc: 30 });
      await flush();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('muting, and stopping', () => {
    it('mute tells the screen the warning is gone, once', async () => {
      const watch = start();
      watch.mute();
      watch.mute();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ off: false, distanceM: null, event: null });
    });

    it('a muted hike gets no buzz, no voice, no notification and no banner', async () => {
      const watch = start();
      at(store, 0, 100, 0);
      watch.mute();
      onChange.mockClear();
      stay(store, 5, 400, 100, 300);
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
      expect(Speech.speak).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('muting while off the trail clears the warning and stays quiet when the hiker returns', async () => {
      const watch = start();
      at(store, 0, 100, 0);
      stay(store, 5, 40, 100, 150);
      await flush();
      Haptics.notificationAsync.mockClear();
      Speech.speak.mockClear();
      watch.mute();
      onChange.mockClear();
      at(store, 45, 100, 5);
      await flush();
      expect(onChange).not.toHaveBeenCalled();
      expect(Speech.speak).not.toHaveBeenCalled();
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });

    it('stop stops listening to the tracker', async () => {
      const watch = start();
      expect(store.listenerCount()).toBe(1);
      watch.stop();
      expect(store.listenerCount()).toBe(0);
      at(store, 0, 100, 0);
      stay(store, 5, 100, 100, 150);
      await flush();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('works without anyone listening for changes', async () => {
      const watch = watchOffRoute({ route: LINE, store });
      at(store, 0, 100, 0);
      expect(() => stay(store, 5, 40, 100, 150)).not.toThrow();
      expect(() => watch.mute()).not.toThrow();
      await flush();
    });
  });

  describe('with the app in the background (phone in a pocket)', () => {
    const strayInBackground = async () => {
      start();
      at(store, 0, 100, 0);
      stay(store, 5, 40, 100, 150);
      await flush();
    };

    it('sends a notification instead of speaking, if notifications are allowed', async () => {
      setAppState('background');
      await strayInBackground();
      expect(Speech.speak).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = Notifications.scheduleNotificationAsync.mock.calls[0][0];
      expect(call.trigger).toBeNull();
      expect(call.content.title).toBe('Off the trail');
      expect(call.content.body).toBe('About 150 m from the trail you chose.');
      expect(call.content.sound).toBe(true);
      expect(call.content.data).toEqual({ type: 'off-route' });
    });

    it('sends nothing when notifications are not allowed, and never asks for permission', async () => {
      setAppState('background');
      Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
      await strayInBackground();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.requestPermissionsAsync).toBeUndefined();
    });

    it('does not notify for coming back', async () => {
      setAppState('background');
      await strayInBackground();
      Notifications.scheduleNotificationAsync.mockClear();
      at(store, 45, 100, 5);
      await flush();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'back' }));
    });

    it('does not notify when the app is open', async () => {
      await strayInBackground();
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('treats the inactive state (app switcher, call coming in) as not open', async () => {
      setAppState('inactive');
      await strayInBackground();
      expect(Speech.speak).not.toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });
  });
});

describe('watchOffRoute: details', () => {
  let store;
  let onChange;
  beforeEach(() => {
    jest.clearAllMocks();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Haptics.notificationAsync.mockResolvedValue(undefined);
    setAppState('active');
    store = fakeStore();
    onChange = jest.fn();
  });

  it('shows the distance again only when it has changed by about 10 m', () => {
    watchOffRoute({ route: LINE, onChange, store });
    at(store, 0, 100, 0);
    stay(store, 5, 30, 100, 150);
    expect(onChange).toHaveBeenCalledTimes(1); // the warning, at 150 m
    at(store, 35, 100, 154);
    expect(onChange).toHaveBeenCalledTimes(1); // 4 m further: not worth redrawing
    at(store, 40, 100, 156);
    expect(onChange).toHaveBeenCalledTimes(2); // 6 m further: nearer to 160 than 150
    expect(onChange.mock.calls[1][0]).toMatchObject({ off: true, distanceM: 156, event: null });
    at(store, 45, 100, 163);
    expect(onChange).toHaveBeenCalledTimes(2); // still 160 to the nearest 10
  });

  it('speaks at the pace it was tuned to', async () => {
    watchOffRoute({ route: LINE, onChange, store });
    at(store, 0, 100, 0);
    stay(store, 5, 30, 100, 150);
    await flush();
    expect(Speech.speak).toHaveBeenCalledWith(
      'You may be off the trail. You are about 150 meters from the route.',
      { rate: 0.95 },
    );
  });

  it('ignores a reading that was already there when it started, even if the tracker changes', async () => {
    store = fakeStore({ lastFixT: T0, current: pt(100, 0) }); // an earlier reading, on the trail
    watchOffRoute({ route: LINE, onChange, store });
    store.emit({ status: 'running' }); // something else about the tracker changed
    stay(store, 5, 60, 100, 150); // then the hiker is only ever seen off the trail
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('copes with a store that has no tracker', () => {
    const listeners = [];
    const bare = { getState: () => ({ tracker: { lastFixT: 0 } }), subscribe: (fn) => { listeners.push(fn); return () => {}; } };
    watchOffRoute({ route: LINE, onChange, store: bare });
    expect(() => listeners[0]({})).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not report again for a reading that has no usable position while off the trail', () => {
    watchOffRoute({ route: LINE, onChange, store });
    at(store, 0, 100, 0);
    stay(store, 5, 30, 100, 150);
    expect(onChange).toHaveBeenCalledTimes(1);
    store.emit({ lastFixT: T0 + 35000, current: { latitude: NaN, longitude: 0 } });
    store.emit({ lastFixT: T0 + 40000, current: null });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('alertOffRoute', () => {
  let warn;
  beforeEach(() => {
    jest.clearAllMocks();
    Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Haptics.notificationAsync.mockResolvedValue(undefined);
    setAppState('active');
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('finishes only once the background notification has been handed over', async () => {
    setAppState('background');
    let allow;
    Notifications.getPermissionsAsync.mockReturnValue(new Promise((resolve) => { allow = resolve; }));
    let finished = false;
    const done = alertOffRoute('off', 80).then(() => { finished = true; });
    await flush();
    expect(finished).toBe(false);
    allow({ status: 'granted' });
    await done;
    expect(finished).toBe(true);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('says the distance in the unit Settings have when the warning is given, not when the hike began', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    await alertOffRoute('off', 120);
    expect(Speech.speak.mock.calls[0][0]).toBe('You may be off the trail. You are about 400 feet from the route.');
    useSettingsStore.setState({ units: 'metric' });
    await alertOffRoute('off', 120);
    expect(Speech.speak.mock.calls[1][0]).toBe('You may be off the trail. You are about 100 meters from the route.');
  });

  it('puts the distance in the background notification in the same unit', async () => {
    useSettingsStore.setState({ units: 'imperial' });
    setAppState('background');
    await alertOffRoute('off', 120);
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].content.body).toBe('About 400 ft from the trail you chose.');
  });

  it('does nothing for an event with no warning', async () => {
    await alertOffRoute(null, 10);
    await alertOffRoute('maybe', 10);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('still speaks when the phone cannot buzz', async () => {
    Haptics.notificationAsync.mockRejectedValue(new Error('no haptics'));
    await alertOffRoute('off', 120);
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('copes with speech failing', async () => {
    Speech.speak.mockImplementationOnce(() => { throw new Error('no voice'); });
    await expect(alertOffRoute('off', 120)).resolves.toBeUndefined();
  });

  it('copes with the notification failing', async () => {
    setAppState('background');
    Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error('denied by system'));
    await expect(alertOffRoute('remind', 120)).resolves.toBeUndefined();
  });

  it('speaks by default', async () => {
    await alertOffRoute('remind', 1500);
    expect(Speech.speak.mock.calls[0][0]).toBe('You may be off the trail. You are about 1.5 kilometers from the route.');
  });

  it('can be asked not to speak', async () => {
    await alertOffRoute('remind', 120, { speak: false });
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
  });
});

describe('watching the real tracker', () => {
  const T1 = 1_700_100_000_000;
  const fixAt = (sec, x, y) => ({
    timestamp: T1 + sec * 1000,
    coords: {
      latitude: 40.7 + y / M_LAT, longitude: -74 + x / M_LNG, accuracy: 4, speed: 3, altitude: null, altitudeAccuracy: -1, heading: 0,
    },
  });
  beforeEach(() => {
    jest.clearAllMocks();
    setAppState('active');
    useRunTrackerStore.getState().reset();
  });

  it('warns a hiker who walks off the trail, and notices when they come back', async () => {
    const changes = [];
    useRunTrackerStore.getState().begin({ now: T1, autoPause: false, kind: 'hike:t' });
    const watch = watchOffRoute({ route: LINE, onChange: (c) => changes.push(c) });
    let sec = 0;
    const go = (x, y) => { sec += 1; useRunTrackerStore.getState().ingest([fixAt(sec, x, y)]); };
    for (let i = 0; i < 40; i += 1) go(100 + i * 3, 0); // along the trail
    expect(changes).toHaveLength(0);
    for (let i = 1; i <= 90; i += 1) go(220, i * 3); // turn north and keep going
    expect(changes.some((c) => c.event === 'off')).toBe(true);
    expect(changes[changes.length - 1].off).toBe(true);
    for (let i = 1; i <= 90; i += 1) go(220, 270 - i * 3); // and back
    expect(changes.some((c) => c.event === 'back')).toBe(true);
    expect(changes[changes.length - 1].off).toBe(false);
    watch.stop();
    await flush();
    expect(Speech.speak).toHaveBeenCalled();
  });
});

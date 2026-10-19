// src/services/analytics.js: the events the app sends, and how they get to Firebase.
//
// They go to @react-native-firebase/analytics, the phone's own module. The service used to use the web package, which cannot
// run on a phone, so nothing was ever sent. Here the native module is a stand-in that records what it was asked to log.
const fs = require('fs');
const path = require('path');

let warn;
let log;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  log.mockRestore();
});

const nativeModule = () => {
  const instance = { is: 'the analytics instance' };
  return {
    instance,
    getAnalytics: jest.fn(() => instance),
    logEvent: jest.fn(),
    setUserId: jest.fn(() => Promise.resolve()),
  };
};

// Loads the service fresh, with `native` as what require('@react-native-firebase/analytics') gives (an Error means the
// require itself fails, as in a build made before the module was added).
function load({ native = nativeModule(), expoGo = false } = {}) {
  jest.resetModules();
  const loads = { count: 0 };
  jest.doMock('expo-constants', () => ({ appOwnership: expoGo ? 'expo' : 'standalone' }));
  jest.doMock('@react-native-firebase/analytics', () => {
    loads.count += 1;
    if (native instanceof Error) throw native;
    return native;
  }, { virtual: true });
  return { service: require('../src/services/analytics'), native, loads };
}

describe('the four events', () => {
  it('a workout starting: its id (as text) and name', () => {
    const { service, native } = load();
    service.logWorkoutStarted(12, 'Push Day');
    expect(native.logEvent).toHaveBeenCalledTimes(1);
    expect(native.logEvent).toHaveBeenCalledWith(native.instance, 'workout_started', { workout_id: '12', workout_name: 'Push Day' });
  });

  it('a workout finishing: its id, the minutes and the calories', () => {
    const { service, native } = load();
    service.logWorkoutCompleted('w-7', 42, 380);
    expect(native.logEvent).toHaveBeenCalledWith(native.instance, 'workout_completed', {
      workout_id: 'w-7', duration_minutes: 42, calories: 380,
    });
  });

  it('the coach being used: what kind of answer it was', () => {
    const { service, native } = load();
    service.logAICoachUsed('proposal');
    expect(native.logEvent).toHaveBeenCalledWith(native.instance, 'ai_coach_used', { feature_type: 'proposal' });
  });

  it('Spotify being connected: just the event', () => {
    const { service, native } = load();
    service.logSpotifyConnected();
    expect(native.logEvent).toHaveBeenCalledWith(native.instance, 'spotify_connected', {});
  });

  it('an id of 0 is still an id: it is a number to the app and text to Firebase', () => {
    const { service, native } = load();
    service.logWorkoutStarted(0, 'Warm-up');
    expect(native.logEvent.mock.calls[0][2]).toEqual({ workout_id: '0', workout_name: 'Warm-up' });
  });
});

describe('what Firebase would refuse is left out, and the rest is still sent', () => {
  it('leaves out a missing id, a number that is not a number and a missing value', () => {
    const { service, native } = load();
    service.logWorkoutCompleted(null, 30, NaN);
    service.logWorkoutCompleted(undefined, Infinity, 250);
    expect(native.logEvent.mock.calls[0][2]).toEqual({ duration_minutes: 30 });
    expect(native.logEvent.mock.calls[1][2]).toEqual({ calories: 250 });
  });

  it('leaves out text that is empty or only spaces, and trims the rest', () => {
    const { service, native } = load();
    service.logWorkoutStarted('a', '   ');
    service.logWorkoutStarted('a', '  Leg Day  ');
    expect(native.logEvent.mock.calls[0][2]).toEqual({ workout_id: 'a' });
    expect(native.logEvent.mock.calls[1][2]).toEqual({ workout_id: 'a', workout_name: 'Leg Day' });
  });

  it('cuts text to the 100 characters Firebase takes', () => {
    const { service, native } = load();
    service.logWorkoutStarted('a', 'x'.repeat(300));
    expect(native.logEvent.mock.calls[0][2].workout_name).toBe('x'.repeat(100));
  });

  it('sends only text and numbers: a list, an object or a yes/no is left out', () => {
    const { service, native } = load();
    service.logEvent('custom_event', { a: 1, b: 'two', c: [1], d: { e: 1 }, f: true, g: null, h: () => 1 });
    expect(native.logEvent).toHaveBeenCalledWith(native.instance, 'custom_event', { a: 1, b: 'two' });
  });

  it('keeps at most 25 values on an event, and only ones with a name Firebase accepts', () => {
    const { service, native } = load();
    const many = {};
    for (let i = 0; i < 40; i += 1) many[`v${i}`] = i;
    // The bad names come first, so they would be among the 25 if they were not turned away.
    service.logEvent('big_event', { 'bad name': 1, '1st': 2, ['x'.repeat(41)]: 3, ...many });
    const sent = native.logEvent.mock.calls[0][2];
    expect(Object.keys(sent)).toHaveLength(25);
    expect(Object.keys(sent)).toEqual(Array.from({ length: 25 }, (_, i) => `v${i}`));
  });

  it('does not log an event whose name Firebase would refuse', () => {
    const { service, native } = load();
    service.logEvent('', {});
    service.logEvent('has space', {});
    service.logEvent('1starts_with_digit', {});
    service.logEvent('x'.repeat(41), {});
    service.logEvent(undefined, {});
    service.logEvent(42, {});
    expect(native.logEvent).not.toHaveBeenCalled();
    service.logEvent('x'.repeat(40), {});
    service.logEvent('ok_name_2', {});
    expect(native.logEvent).toHaveBeenCalledTimes(2);
  });

  it('copes with values that are not an object at all', () => {
    const { service, native } = load();
    service.logEvent('plain_event', undefined);
    service.logEvent('plain_event', 'text');
    service.logEvent('plain_event', null);
    expect(native.logEvent.mock.calls.map((c) => c[2])).toEqual([{}, {}, {}]);
  });
});

describe('getting the module', () => {
  it('asks for the analytics instance once, however many events follow', () => {
    const { service, native, loads } = load();
    service.logWorkoutStarted('a', 'A');
    service.logWorkoutCompleted('a', 1, 2);
    service.logSpotifyConnected();
    expect(loads.count).toBe(1);
    expect(native.getAnalytics).toHaveBeenCalledTimes(1);
    expect(native.logEvent).toHaveBeenCalledTimes(3);
  });

  it('does not load the module until there is something to send', () => {
    const { loads } = load();
    expect(loads.count).toBe(0);
  });
});

describe('when logging goes wrong, nothing reaches the screen', () => {
  it('a module that is not in this build: every call does nothing, and it is looked for once', () => {
    const { service, loads } = load({ native: new Error('Cannot find module') });
    expect(() => {
      service.logWorkoutStarted('a', 'A');
      service.logWorkoutCompleted('a', 1, 2);
      service.logAICoachUsed('chat');
      service.logSpotifyConnected();
      service.setAnalyticsUser('u1');
      service.setAnalyticsUser(null);
    }).not.toThrow();
    expect(loads.count).toBe(1);
  });

  it('a module that loads but has no native side (an older build): the same', () => {
    const native = nativeModule();
    native.getAnalytics.mockImplementation(() => { throw new Error('You attempted to use a Firebase module that is not installed natively'); });
    const { service } = load({ native });
    expect(() => {
      service.logWorkoutStarted('a', 'A');
      service.setAnalyticsUser('u1');
    }).not.toThrow();
    expect(native.logEvent).not.toHaveBeenCalled();
    expect(native.setUserId).not.toHaveBeenCalled();
  });

  it('an instance that comes back empty is treated as not there', () => {
    const native = nativeModule();
    native.getAnalytics.mockReturnValue(undefined);
    const { service } = load({ native });
    expect(() => service.logWorkoutStarted('a', 'A')).not.toThrow();
    expect(native.logEvent).not.toHaveBeenCalled();
  });

  it('a log that throws is said so in development and the next one still goes', () => {
    const native = nativeModule();
    native.logEvent.mockImplementationOnce(() => { throw new Error('boom'); });
    const { service } = load({ native });
    expect(() => service.logWorkoutStarted('a', 'A')).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[analytics] could not log', 'workout_started', 'boom');
    service.logSpotifyConnected();
    expect(native.logEvent).toHaveBeenCalledTimes(2);
    expect(native.logEvent).toHaveBeenLastCalledWith(native.instance, 'spotify_connected', {});
  });

  it('returns nothing to wait for', () => {
    const { service } = load();
    expect(service.logWorkoutStarted('a', 'A')).toBeUndefined();
    expect(service.logSpotifyConnected()).toBeUndefined();
    expect(service.setAnalyticsUser('u1')).toBeUndefined();
  });
});

describe('Expo Go has no native Firebase, so it only prints the event', () => {
  it('prints what would have been sent, and never loads the module', () => {
    const { service, loads } = load({ expoGo: true });
    service.logWorkoutStarted(5, 'Pull Day');
    service.logWorkoutCompleted(5, NaN, 300);
    service.setAnalyticsUser('u1');
    expect(log).toHaveBeenCalledWith('[Analytics]', 'workout_started', { workout_id: '5', workout_name: 'Pull Day' });
    expect(log).toHaveBeenCalledWith('[Analytics]', 'workout_completed', { workout_id: '5', calories: 300 });
    expect(loads.count).toBe(0);
  });
});

describe('setAnalyticsUser', () => {
  it('ties the events to the signed-in account', () => {
    const { service, native } = load();
    service.setAnalyticsUser('uid-123');
    expect(native.setUserId).toHaveBeenCalledWith(native.instance, 'uid-123');
  });

  it('clears it when there is no account (signed out), for nothing, an empty id or something that is not an id', () => {
    const { service, native } = load();
    service.setAnalyticsUser(undefined);
    service.setAnalyticsUser(null);
    service.setAnalyticsUser('');
    service.setAnalyticsUser(123);
    expect(native.setUserId.mock.calls.map((c) => c[1])).toEqual([null, null, null, null]);
  });

  it('does not let a failed call become an error nobody catches', async () => {
    const native = nativeModule();
    native.setUserId.mockImplementation(() => Promise.reject(new Error('no network')));
    const { service } = load({ native });
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      expect(() => service.setAnalyticsUser('u1')).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.removeListener('unhandledRejection', unhandled);
    }
  });

  it('copes with a call that throws', () => {
    const native = nativeModule();
    native.setUserId.mockImplementation(() => { throw new Error('boom'); });
    const { service } = load({ native });
    expect(() => service.setAnalyticsUser('u1')).not.toThrow();
    expect(warn).toHaveBeenCalledWith('[analytics] could not set the user', 'boom');
  });

  it('copes with a call that returns nothing to wait for', () => {
    const native = nativeModule();
    native.setUserId.mockImplementation(() => undefined);
    const { service } = load({ native });
    expect(() => service.setAnalyticsUser('u1')).not.toThrow();
  });
});

describe('the web package', () => {
  it('is not what the service uses: it cannot run on a phone', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'analytics.js'), 'utf8');
    expect(source).not.toMatch(/['"]firebase\/analytics['"]/);
    expect(source).toMatch(/require\('@react-native-firebase\/analytics'\)/);
  });
});

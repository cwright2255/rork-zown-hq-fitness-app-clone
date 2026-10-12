// A hike in progress is kept on the phone and found again when the app opens.
// Each "app" below is a fresh copy of the store module reading the same fake
// phone storage, which is what closing and reopening the app comes to.

import { trackedMs } from '../lib/runTracker';

const KEY = 'zown-run-tracker';
const T0 = 1_760_000_000_000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// A reading `sec` seconds after the start, `metres` east of the start.
const fix = (sec, metres) => ({
  timestamp: T0 + sec * 1000,
  coords: {
    latitude: 40.7, longitude: -74 + metres / 84300, accuracy: 4, speed: 1.5, altitude: null, altitudeAccuracy: -1, heading: 0,
  },
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function phoneStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: jest.fn(async (k) => (k in data ? data[k] : null)),
    setItem: jest.fn(async (k, v) => { data[k] = v; }),
    removeItem: jest.fn(async (k) => { delete data[k]; }),
  };
}

// Opens the app: a fresh store module that has started reading the phone storage.
function launch(storage, { shape = 'default' } = {}) {
  jest.resetModules();
  jest.doMock('@react-native-async-storage/async-storage', () => {
    if (shape === 'throws') throw new Error('[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.');
    if (shape === 'bare') return storage; // the storage itself, with no default export
    if (shape === 'empty') return {};
    return { __esModule: true, default: storage };
  });
  const mod = require('../store/runTrackerStore');
  return { ...mod, state: () => mod.useRunTrackerStore.getState() };
}

// Opens the app and waits for the saved hike (if any) to be read.
async function openApp(storage, options) {
  const app = launch(storage, options);
  await app.whenTrackerReady();
  return app;
}

const saved = (storage) => JSON.parse(storage.data[KEY]);

// Records a hike for `seconds` seconds, then leaves it as it is (the app is "killed").
async function recordHike(storage, { kind = 'hike:t1', context = { mapId: 'm1', pathName: 'Ridge' }, seconds = 60, flush = true } = {}) {
  const app = await openApp(storage);
  app.state().begin({ kind, context, autoPause: false, now: Date.now() });
  for (let s = 1; s <= seconds; s += 1) {
    jest.advanceTimersByTime(1000);
    app.state().ingest([fix(s, s * 1.5)]);
  }
  if (flush) app.flushRunTracker();
  return { app, before: app.state().tracker, context: app.state().context };
}

// A saved tracker written by hand.
const savedTracker = (o = {}) => ({
  status: 'paused', autoPause: false, kind: 'hike:t1', startedAt: T0, lastT: T0 + MIN, lastFixT: T0 + MIN, pausedAt: T0 + MIN,
  movingMs: MIN, distanceM: 1234, splits: [400], splitMs: 30000,
  route: [{ latitude: 40.7, longitude: -74 }, { latitude: 40.701, longitude: -74 }],
  current: { latitude: 40.701, longitude: -74 }, elev: { gain: 10, loss: 5 }, ...o,
});
const putSaved = (storage, tracker, context = { mapId: 'm1', pathName: 'Ridge' }, version = 1) => {
  storage.data[KEY] = JSON.stringify({ state: { tracker, context }, version });
};

describe('the hike kept on the phone', () => {
  let warn;
  let error;
  beforeEach(() => {
    jest.useFakeTimers({ now: T0, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    error = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    warn.mockRestore();
    error.mockRestore();
    jest.dontMock('@react-native-async-storage/async-storage');
  });

  describe('saving', () => {
    it('keeps a hike on the phone with the map and path chosen for it', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'hike:t1', context: { mapId: 'm1', pathName: 'Ridge' }, now: Date.now() });
      const file = saved(storage);
      expect(file.version).toBe(1);
      expect(file.state.tracker.kind).toBe('hike:t1');
      expect(file.state.tracker.status).toBe('running');
      expect(file.state.context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
      expect(Object.keys(storage.data)).toEqual([KEY]);
    });

    it('keeps the route and distance, not the smoothing work', async () => {
      const storage = phoneStorage();
      const { before } = await recordHike(storage);
      expect(before.distanceM).toBeGreaterThan(0);
      const file = saved(storage);
      expect(file.state.tracker.distanceM).toBe(before.distanceM);
      expect(file.state.tracker.route).toEqual(before.route);
      expect(file.state.tracker.kf).toBeUndefined();
      expect(file.state.tracker.win).toBeUndefined();
      expect(file.state.recovered).toBeUndefined();
    });

    it('does not keep a run', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'run', now: Date.now() });
      app.state().ingest([fix(1, 1.5), fix(2, 3), fix(3, 4.5)]);
      app.flushRunTracker();
      expect(saved(storage).state.tracker).toBeNull();
    });

    it('does not keep a walk or a program session', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'walk', now: Date.now() });
      expect(saved(storage).state.tracker).toBeNull();
      app.state().reset();
      app.state().begin({ kind: 'program:p1', now: Date.now() });
      expect(saved(storage).state.tracker).toBeNull();
    });

    it('does not keep the map and path of something that is not a hike', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'run', context: { mapId: 'm1', pathName: 'Ridge' }, now: Date.now() });
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
      expect(saved(storage).state.context).toBeNull();
    });

    it('lets a run replace the hike that was kept', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      expect(saved(storage).state.tracker).not.toBeNull();
      const app = await openApp(storage);
      app.state().begin({ kind: 'run', now: Date.now() });
      expect(saved(storage).state.tracker).toBeNull();
    });

    it('writes at most once every five seconds while the hike goes on', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'hike:t1', now: Date.now() });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      for (let s = 1; s <= 4; s += 1) {
        jest.advanceTimersByTime(1000);
        app.state().ingest([fix(s, s * 1.5)]);
      }
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(1000);
      expect(storage.setItem).toHaveBeenCalledTimes(2);
      expect(saved(storage).state.tracker.lastFixT).toBe(T0 + 4000);
    });

    it('keeps saving as the hike goes on, one write in each five seconds', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'hike:t1', now: Date.now() });
      for (let s = 1; s <= 30; s += 1) {
        jest.advanceTimersByTime(1000);
        app.state().ingest([fix(s, s * 1.5)]);
      }
      jest.advanceTimersByTime(5000);
      expect(storage.setItem.mock.calls.length).toBeGreaterThanOrEqual(6);
      expect(storage.setItem.mock.calls.length).toBeLessThanOrEqual(8);
      expect(saved(storage).state.tracker.lastFixT).toBe(app.state().tracker.lastFixT);
    });

    it('writes a waiting change at once when asked', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'hike:t1', now: Date.now() });
      jest.advanceTimersByTime(1000);
      app.state().ingest([fix(1, 1.5), fix(2, 3)]);
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      app.flushRunTracker();
      expect(storage.setItem).toHaveBeenCalledTimes(2);
      expect(saved(storage).state.tracker.lastFixT).toBe(T0 + 2000);
    });

    describe('at once, without waiting for the next save', () => {
      async function midHike() {
        const storage = phoneStorage();
        const app = await openApp(storage);
        app.state().begin({ kind: 'hike:t1', autoPause: false, now: Date.now() });
        jest.advanceTimersByTime(1000);
        app.state().ingest([fix(1, 1.5), fix(2, 3)]);
        return { storage, app };
      }

      it('when it is paused', async () => {
        const { storage, app } = await midHike();
        app.state().pause(Date.now());
        expect(saved(storage).state.tracker.status).toBe('paused');
      });

      it('when it is resumed', async () => {
        const { storage, app } = await midHike();
        app.state().pause(Date.now());
        app.state().resume(Date.now());
        expect(saved(storage).state.tracker.status).toBe('running');
      });

      it('when auto-pause is changed', async () => {
        const { storage, app } = await midHike();
        app.state().setAutoPause(true, Date.now());
        expect(saved(storage).state.tracker.autoPause).toBe(true);
      });

      it('when it is finished', async () => {
        const { storage, app } = await midHike();
        app.state().finish(Date.now());
        expect(saved(storage).state.tracker).toBeNull();
        expect(saved(storage).state.context).toBeNull();
      });

      it('when it is thrown away', async () => {
        const { storage, app } = await midHike();
        app.state().reset();
        expect(saved(storage).state.tracker).toBeNull();
        expect(saved(storage).state.context).toBeNull();
      });
    });

    it('carries on if the phone cannot save', async () => {
      const storage = phoneStorage();
      storage.setItem = jest.fn(async () => { throw new Error('disk full'); });
      const app = await openApp(storage);
      expect(() => app.state().begin({ kind: 'hike:t1', now: Date.now() })).not.toThrow();
      jest.advanceTimersByTime(1000);
      app.state().ingest([fix(1, 1.5), fix(2, 3)]);
      await flushPromises();
      expect(app.state().tracker.status).toBe('running');
      expect(app.state().tracker.lastFixT).toBe(T0 + 2000);
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('without storage on the phone', () => {
    it.each([
      ['an old build where the storage cannot be loaded', 'throws'],
      ['a storage with nothing in it', 'empty'],
    ])('works as it always did with %s', async (_name, shape) => {
      const app = launch(null, { shape });
      expect(app.isTrackerReady()).toBe(true);
      await expect(app.whenTrackerReady()).resolves.toBeUndefined();
      expect(app.state().begin({ kind: 'hike:t1', now: Date.now() })).toBe('new');
      app.state().ingest([fix(1, 1.5), fix(2, 3)]);
      expect(() => app.flushRunTracker()).not.toThrow();
      expect(app.state().tracker.status).toBe('running');
      expect(app.state().recovered).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });

    it('uses a storage that is the module itself, with no default export', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage, { shape: 'bare' });
      app.state().begin({ kind: 'hike:t1', now: Date.now() });
      expect(saved(storage).state.tracker.kind).toBe('hike:t1');
    });
  });

  describe('opening the app again', () => {
    it('picks up a hike that was last heard from a moment ago and keeps recording it', async () => {
      const storage = phoneStorage();
      const { before } = await recordHike(storage);
      jest.setSystemTime(Date.now() + 45 * 1000);
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(true);
      expect(app.state().tracker.status).toBe('running');
      expect(app.state().tracker.pausedAt).toBe(0);
      expect(app.state().tracker.distanceM).toBe(before.distanceM);
      expect(app.state().tracker.startedAt).toBe(before.startedAt);
      expect(app.state().tracker.kind).toBe('hike:t1');
      expect(app.state().tracker.route).toEqual(before.route);
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
    });

    it('brings a hike left longer ago back paused where it stopped', async () => {
      const storage = phoneStorage();
      const { before } = await recordHike(storage);
      jest.setSystemTime(Date.now() + 10 * MIN);
      const app = await openApp(storage);
      const tracker = app.state().tracker;
      expect(app.state().recovered).toBe(true);
      expect(tracker.status).toBe('paused');
      expect(tracker.pausedAt).toBe(before.lastT);
      expect(tracker.movingMs).toBe(before.movingMs);
      expect(tracker.distanceM).toBe(before.distanceM);
      // The time the app was closed is not hiking time, now or later.
      expect(trackedMs(tracker, Date.now())).toBe(before.movingMs);
      expect(trackedMs(tracker, Date.now() + HOUR)).toBe(before.movingMs);
    });

    it('brings back a hike that was paused as paused', async () => {
      const storage = phoneStorage();
      const { app: first } = await recordHike(storage);
      jest.advanceTimersByTime(3000);
      first.state().pause(Date.now());
      const pausedAt = first.state().tracker.pausedAt;
      jest.setSystemTime(Date.now() + 30 * 1000);
      const app = await openApp(storage);
      expect(app.state().tracker.status).toBe('paused');
      expect(app.state().tracker.pausedAt).toBe(pausedAt);
    });

    it('brings back the map and path with the hike', async () => {
      const storage = phoneStorage();
      await recordHike(storage, { context: { mapId: 'm9', pathName: 'Summit loop' } });
      jest.setSystemTime(Date.now() + HOUR);
      const app = await openApp(storage);
      expect(app.state().context).toEqual({ mapId: 'm9', pathName: 'Summit loop' });
    });

    it('lets go of a hike left more than a week ago', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      jest.setSystemTime(Date.now() + 8 * DAY);
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(false);
      expect(app.state().tracker.status).toBe('idle');
      expect(app.state().context).toBeNull();
    });

    it('keeps a hike left six days ago', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      jest.setSystemTime(Date.now() + 6 * DAY);
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(true);
      expect(app.state().tracker.status).toBe('paused');
    });

    it('finds nothing after a hike was finished', async () => {
      const storage = phoneStorage();
      const { app: first } = await recordHike(storage);
      first.state().finish(Date.now());
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(false);
      expect(app.state().tracker.status).toBe('idle');
    });

    it('finds nothing after a hike was thrown away', async () => {
      const storage = phoneStorage();
      const { app: first } = await recordHike(storage);
      first.state().reset();
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(false);
      expect(app.state().tracker.status).toBe('idle');
    });

    it('finds nothing the first time the app is opened, and says it has read what there is', async () => {
      const app = await openApp(phoneStorage());
      expect(app.useRunTrackerStore.persist.hasHydrated()).toBe(true);
      expect(app.state().recovered).toBe(false);
      expect(app.state().tracker.status).toBe('idle');
      expect(app.state().context).toBeNull();
    });

    it('loses at most the last few seconds when the app is killed without warning', async () => {
      const storage = phoneStorage();
      const { app: first } = await recordHike(storage, { seconds: 60 });
      const lastSaved = first.state().tracker.lastFixT;
      for (let s = 61; s <= 66; s += 1) {
        jest.advanceTimersByTime(1000);
        first.state().ingest([fix(s, s * 1.5)]);
      }
      const killedAt = first.state().tracker.lastFixT;
      expect(killedAt).toBeGreaterThan(lastSaved);
      // killed here: nothing more is written (the pending timer never runs)
      const copy = JSON.parse(storage.data[KEY]);
      jest.setSystemTime(Date.now() + 20 * 1000);
      const app = await openApp(phoneStorage({ [KEY]: JSON.stringify(copy) }));
      expect(app.state().tracker.lastFixT).toBeLessThanOrEqual(killedAt);
      expect(app.state().tracker.lastFixT).toBeGreaterThanOrEqual(killedAt - 5000);
    });

    it('is not ready until the saved hike has been read, then is', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      const app = launch(storage);
      expect(app.isTrackerReady()).toBe(false);
      const first = app.whenTrackerReady();
      const second = app.whenTrackerReady();
      await Promise.all([first, second]);
      expect(app.isTrackerReady()).toBe(true);
      expect(app.state().recovered).toBe(true);
      await expect(app.whenTrackerReady()).resolves.toBeUndefined();
    });

    it('is ready even when there is nothing saved', async () => {
      const app = launch(phoneStorage());
      expect(app.isTrackerReady()).toBe(false);
      await app.whenTrackerReady();
      expect(app.isTrackerReady()).toBe(true);
    });

    it('is ready even when the phone cannot be read', async () => {
      const storage = phoneStorage();
      storage.getItem = jest.fn(async () => { throw new Error('unreadable'); });
      const app = await openApp(storage);
      expect(app.isTrackerReady()).toBe(true);
      expect(app.state().tracker.status).toBe('idle');
    });

    it('keeps what was started while the saved hike was still being read', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      jest.setSystemTime(Date.now() + 10 * MIN);
      const app = launch(storage);
      app.state().begin({ kind: 'hike:other', now: Date.now() });
      await app.whenTrackerReady();
      expect(app.state().tracker.kind).toBe('hike:other');
      expect(app.state().tracker.status).toBe('running');
      expect(app.state().recovered).toBe(false);
    });
  });

  describe('a saved hike that is no use', () => {
    const idleAfter = async (text) => {
      const storage = phoneStorage({ [KEY]: text });
      jest.setSystemTime(T0 + 2 * MIN);
      const app = await openApp(storage);
      expect(app.isTrackerReady()).toBe(true);
      return app;
    };

    it.each([
      ['text that is not JSON', 'this is not json'],
      ['empty text', ''],
      ['null', 'null'],
      ['a list', '[]'],
      ['a number', '42'],
      ['text in quotes', '"hello"'],
      ['an empty object', '{}'],
      ['no state', JSON.stringify({ version: 1 })],
      ['a null state', JSON.stringify({ state: null, version: 1 })],
      ['no tracker', JSON.stringify({ state: {}, version: 1 })],
      ['a tracker that is text', JSON.stringify({ state: { tracker: 'running' }, version: 1 })],
      ['a tracker with no times', JSON.stringify({ state: { tracker: { status: 'running', kind: 'hike:t1' } }, version: 1 })],
      ['a tracker with the wrong status', JSON.stringify({ state: { tracker: savedTracker({ status: 'idle' }) }, version: 1 })],
      ['a tracker that is not a hike', JSON.stringify({ state: { tracker: savedTracker({ kind: 'run' }) }, version: 1 })],
      ['a tracker with a distance that is not a number', JSON.stringify({ state: { tracker: savedTracker({ distanceM: 'far' }) }, version: 1 })],
      ['a version that is not known', JSON.stringify({ state: { tracker: savedTracker() }, version: 2 })],
      ['an older version', JSON.stringify({ state: { tracker: savedTracker() }, version: 0 })],
    ])('starts with nothing for %s', async (_name, text) => {
      const app = await idleAfter(text);
      expect(app.state().tracker.status).toBe('idle');
      expect(app.state().recovered).toBe(false);
      expect(app.state().context).toBeNull();
      expect(app.state().begin({ kind: 'hike:t1', now: Date.now() })).toBe('new');
    });

    it('still recovers a tracker whose route and splits are partly damaged, keeping the good parts', async () => {
      const text = JSON.stringify({
        state: {
          tracker: savedTracker({
            route: [{ latitude: 40.7, longitude: -74 }, 'x', null, { latitude: 'a', longitude: 1 }, { latitude: 40.8, longitude: -74.1 }],
            splits: [400, 'x', -5, 0, 380],
            current: 'here',
            elev: { gain: 'a' },
          }),
          context: { mapId: 7, pathName: 'Ridge' },
        },
        version: 1,
      });
      const app = await idleAfter(text);
      const tracker = app.state().tracker;
      expect(app.state().recovered).toBe(true);
      expect(tracker.route).toEqual([{ latitude: 40.7, longitude: -74 }, { latitude: 40.8, longitude: -74.1 }]);
      expect(tracker.splits).toEqual([400, 380]);
      expect(tracker.current).toBeNull();
      expect(tracker.elev).toBeNull();
      expect(app.state().context).toEqual({ pathName: 'Ridge' });
    });

    it('recovers a hike saved with no map or path', async () => {
      const storage = phoneStorage();
      putSaved(storage, savedTracker(), null);
      jest.setSystemTime(T0 + 2 * MIN);
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(true);
      expect(app.state().context).toBeNull();
    });

    it('tells the log when the version is not known, and starts with nothing', async () => {
      const storage = phoneStorage();
      putSaved(storage, savedTracker(), null, 5);
      const app = await openApp(storage);
      expect(app.state().tracker.status).toBe('idle');
      expect(error).toHaveBeenCalled();
    });
  });

  describe('beginning a hike', () => {
    async function leftHike({ ago = 10 * HOUR, context } = {}) {
      const storage = phoneStorage();
      const { before } = await recordHike(storage, context ? { context } : {});
      jest.setSystemTime(Date.now() + ago);
      const app = await openApp(storage);
      return { storage, app, before };
    }

    it('picks up the unfinished hike, however long ago, when asked to resume', async () => {
      const { app, before } = await leftHike();
      expect(app.state().begin({ kind: 'hike:t1', resume: true, now: Date.now() })).toBe('resumed');
      expect(app.state().tracker.startedAt).toBe(before.startedAt);
      expect(app.state().tracker.distanceM).toBe(before.distanceM);
      expect(app.state().tracker.status).toBe('paused');
      expect(app.state().recovered).toBe(false);
    });

    it('starts afresh without being asked to resume when the hike is old', async () => {
      const { app, before } = await leftHike();
      const now = Date.now();
      expect(app.state().begin({ kind: 'hike:t1', now })).toBe('new');
      expect(app.state().tracker.startedAt).toBe(now);
      expect(app.state().tracker.startedAt).not.toBe(before.startedAt);
      expect(app.state().tracker.distanceM).toBe(0);
      expect(app.state().recovered).toBe(false);
    });

    it('picks up a hike left a little while ago without being asked', async () => {
      const { app, before } = await leftHike({ ago: 10 * MIN });
      expect(app.state().begin({ kind: 'hike:t1', now: Date.now() })).toBe('resumed');
      expect(app.state().tracker.startedAt).toBe(before.startedAt);
    });

    it('does not resume a different trail', async () => {
      const { app, before } = await leftHike();
      expect(app.state().begin({ kind: 'hike:t2', resume: true, now: Date.now() })).toBe('new');
      expect(app.state().tracker.kind).toBe('hike:t2');
      expect(app.state().tracker.startedAt).not.toBe(before.startedAt);
      expect(app.state().recovered).toBe(false);
    });

    it('starts a new hike when asked to resume and there is nothing to resume', async () => {
      const app = await openApp(phoneStorage());
      const now = Date.now();
      expect(app.state().begin({ kind: 'hike:t1', resume: true, now })).toBe('new');
      expect(app.state().tracker.startedAt).toBe(now);
    });

    it('saves the map and path of a resumed hike at once, even just after another save', async () => {
      const { app, storage } = await leftHike();
      app.state().acknowledgeRecovery();
      app.flushRunTracker();
      app.state().pause(Date.now()); // writes, so the next change would normally wait
      const writes = storage.setItem.mock.calls.length;
      app.state().begin({ kind: 'hike:t1', resume: true, context: { mapId: 'm3', pathName: 'Gorge' }, now: Date.now() });
      expect(storage.setItem.mock.calls.length).toBe(writes + 1);
      expect(saved(storage).state.context).toEqual({ mapId: 'm3', pathName: 'Gorge' });
    });

    it('saves a new hike at once, even just after another save', async () => {
      const storage = phoneStorage();
      const app = await openApp(storage);
      app.state().begin({ kind: 'hike:a', now: Date.now() });
      app.state().begin({ kind: 'hike:b', now: Date.now() });
      expect(app.state().tracker.kind).toBe('hike:b');
      expect(saved(storage).state.tracker.kind).toBe('hike:b');
    });

    it('keeps the saved map and path when the resumed hike is opened without them', async () => {
      const { app } = await leftHike();
      app.state().begin({ kind: 'hike:t1', resume: true, now: Date.now() });
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
      app.state().begin({ kind: 'hike:t1', resume: true, context: { mapId: 5 }, now: Date.now() });
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
    });

    it('takes the map and path it is given when it resumes', async () => {
      const { app, storage } = await leftHike();
      app.state().begin({ kind: 'hike:t1', resume: true, context: { mapId: 'm2', pathName: 'Valley' }, now: Date.now() });
      expect(app.state().context).toEqual({ mapId: 'm2', pathName: 'Valley' });
      expect(saved(storage).state.context).toEqual({ mapId: 'm2', pathName: 'Valley' });
    });

    it('keeps only the map and path of a new hike, and only if they are text', async () => {
      const app = await openApp(phoneStorage());
      app.state().begin({ kind: 'hike:t1', context: { mapId: 'm1', pathName: 'Ridge', other: 'x' }, now: Date.now() });
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
      app.state().begin({ kind: 'hike:t2', context: { mapId: 3, pathName: '' }, now: Date.now() });
      expect(app.state().context).toBeNull();
    });

    it('forgets that a hike was found once it is begun', async () => {
      const { app } = await leftHike();
      expect(app.state().recovered).toBe(true);
      app.state().begin({ kind: 'hike:t1', resume: true, now: Date.now() });
      expect(app.state().recovered).toBe(false);
    });
  });

  describe('finishing', () => {
    it('clears the map and path and the question as well as the hike', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      jest.setSystemTime(Date.now() + 10 * MIN);
      const app = await openApp(storage);
      expect(app.state().recovered).toBe(true);
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
      const summary = app.state().finish(Date.now());
      expect(summary.distance).toBeGreaterThan(0);
      expect(app.state().tracker.status).toBe('idle');
      expect(app.state().context).toBeNull();
      expect(app.state().recovered).toBe(false);
    });
  });

  describe('acknowledgeRecovery', () => {
    it('says the hike has been dealt with and leaves it as it is', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      jest.setSystemTime(Date.now() + 10 * MIN);
      const app = await openApp(storage);
      const tracker = app.state().tracker;
      expect(app.state().recovered).toBe(true);
      app.state().acknowledgeRecovery();
      expect(app.state().recovered).toBe(false);
      expect(app.state().tracker).toBe(tracker);
      expect(app.state().context).toEqual({ mapId: 'm1', pathName: 'Ridge' });
    });
  });

  describe('discarding', () => {
    it('clears the hike, the map and path and the question', async () => {
      const storage = phoneStorage();
      await recordHike(storage);
      jest.setSystemTime(Date.now() + 10 * MIN);
      const app = await openApp(storage);
      app.state().reset();
      expect(app.state().tracker.status).toBe('idle');
      expect(app.state().context).toBeNull();
      expect(app.state().recovered).toBe(false);
    });
  });
});

// GPS readings and a hike that was saved on the phone: the phone can wake the app
// with a reading before the saved hike has been read back, and the hike is written
// out when the app leaves the screen.

const KEY = 'zown-run-tracker';
const T0 = 1_760_000_000_000;
const MIN = 60 * 1000;

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

const savedHike = (o = {}) => JSON.stringify({
  state: {
    tracker: {
      status: 'running', autoPause: false, kind: 'hike:t1', startedAt: T0, lastT: T0 + 60 * 1000, lastFixT: T0 + 60 * 1000,
      pausedAt: 0, movingMs: 60 * 1000, distanceM: 90, splits: [], splitMs: 0,
      route: [{ latitude: 40.7, longitude: -74 }, { latitude: 40.7, longitude: -73.999 }],
      current: { latitude: 40.7, longitude: -73.999 }, elev: null, ...o,
    },
    context: { mapId: 'm1', pathName: 'Ridge' },
  },
  version: 1,
});

// Loads the store and the service fresh, as the app does when it opens.
function load({ storage, appState = 'works' } = {}) {
  jest.resetModules();
  jest.doMock('expo-location', () => ({
    Accuracy: { BestForNavigation: 6 },
    ActivityType: { Fitness: 3 },
    hasStartedLocationUpdatesAsync: jest.fn(async () => true),
    startLocationUpdatesAsync: jest.fn(async () => undefined),
    stopLocationUpdatesAsync: jest.fn(async () => undefined),
    watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  }), { virtual: true });
  jest.doMock('expo-task-manager', () => ({ defineTask: jest.fn() }), { virtual: true });
  jest.doMock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: storage }));
  const listener = { fn: null, calls: [] };
  const { AppState } = require('react-native');
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, fn) => {
    if (appState === 'throws') throw new Error('no app state');
    listener.calls.push(type);
    listener.fn = fn;
    return { remove: jest.fn() };
  });
  const Location = require('expo-location');
  const store = require('../store/runTrackerStore');
  const service = require('../services/runTracking');
  return { Location, store, service, listener, state: () => store.useRunTrackerStore.getState() };
}

describe('services/runTracking with a hike saved on the phone', () => {
  let warn;
  beforeEach(() => {
    jest.useFakeTimers({ now: T0 + 70 * 1000, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.dontMock('@react-native-async-storage/async-storage');
  });

  describe('readings that arrive before the saved hike has been read', () => {
    it('are held, then added to the hike that is found', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      expect(app.store.isTrackerReady()).toBe(false);
      app.service.handleLocations([fix(70, 105)]);
      expect(app.state().tracker.status).toBe('idle');
      expect(app.state().tracker.lastFixT).toBe(0);
      await flushPromises();
      expect(app.store.isTrackerReady()).toBe(true);
      expect(app.state().recovered).toBe(true);
      expect(app.state().tracker.kind).toBe('hike:t1');
      expect(app.state().tracker.lastFixT).toBe(T0 + 70 * 1000);
    });

    it('are handed over together, in the order they came, once', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      const a = [fix(62, 93), fix(63, 94.5)];
      const b = [fix(64, 96)];
      const c = [fix(65, 97.5), fix(66, 99)];
      app.service.handleLocations(a);
      app.service.handleLocations(b);
      app.service.handleLocations(c);
      expect(ingest).not.toHaveBeenCalled();
      await flushPromises();
      expect(ingest).toHaveBeenCalledTimes(1);
      expect(ingest).toHaveBeenCalledWith([...a, ...b, ...c]);
    });

    it('keep only the most recent 120 when there are more', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      const all = Array.from({ length: 130 }, (_, i) => fix(61 + i, 90 + i));
      for (let i = 0; i < all.length; i += 10) app.service.handleLocations(all.slice(i, i + 10));
      await flushPromises();
      expect(ingest).toHaveBeenCalledTimes(1);
      const given = ingest.mock.calls[0][0];
      expect(given).toHaveLength(120);
      expect(given[0]).toBe(all[10]);
      expect(given[119]).toBe(all[129]);
    });

    it('keep exactly 120 when there are exactly that many', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      const all = Array.from({ length: 120 }, (_, i) => fix(61 + i, 90 + i));
      app.service.handleLocations(all);
      await flushPromises();
      expect(ingest.mock.calls[0][0]).toHaveLength(120);
      expect(ingest.mock.calls[0][0][0]).toBe(all[0]);
    });

    it('wait for the saved hike to be read, not just for the next moment', async () => {
      const text = savedHike();
      const storage = phoneStorage({ [KEY]: text });
      let release;
      storage.getItem = jest.fn(() => new Promise((resolve) => { release = () => resolve(text); }));
      const app = load({ storage });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([fix(62, 93)]);
      await flushPromises();
      await flushPromises();
      expect(ingest).not.toHaveBeenCalled();
      expect(app.store.isTrackerReady()).toBe(false);
      release();
      await flushPromises();
      expect(ingest).toHaveBeenCalledTimes(1);
      expect(app.state().recovered).toBe(true);
    });

    it('do not keep the GPS going for a hike that is not there', async () => {
      const app = load({ storage: phoneStorage() });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([fix(70, 105)]);
      await flushPromises();
      expect(ingest).not.toHaveBeenCalled();
      expect(app.Location.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    });

    it('do not switch the GPS off for the hike that was found', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      app.service.handleLocations([fix(70, 105)]);
      await flushPromises();
      expect(app.Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('go to a hike that was found paused, as they would to any paused hike', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike({ status: 'paused', pausedAt: T0 + 60 * 1000 }) }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([fix(70, 105)]);
      await flushPromises();
      expect(app.state().tracker.status).toBe('paused');
      expect(ingest).toHaveBeenCalledTimes(1);
      expect(app.Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('switch the GPS off for a hike found paused for so long that it would have been switched off anyway', async () => {
      jest.setSystemTime(T0 + 90 * MIN);
      const app = load({ storage: phoneStorage({ [KEY]: savedHike({ status: 'paused', pausedAt: T0 + 60 * 1000 }) }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([fix(70, 105)]);
      await flushPromises();
      expect(app.state().tracker.status).toBe('paused');
      expect(ingest).not.toHaveBeenCalled();
      expect(app.Location.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
    });

    it('are not held for readings that arrive in the next batch', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([fix(62, 93)]);
      await flushPromises();
      expect(ingest).toHaveBeenCalledTimes(1);
      app.service.handleLocations([fix(63, 94.5)]);
      await flushPromises();
      expect(ingest).toHaveBeenCalledTimes(2);
      expect(ingest).toHaveBeenLastCalledWith([fix(63, 94.5)]);
    });
  });

  describe('readings that arrive after it has been read', () => {
    it('go straight to the hike', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      await app.store.whenTrackerReady();
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([fix(62, 93)]);
      expect(ingest).toHaveBeenCalledTimes(1);
    });

    it('ignore an empty batch, ready or not', async () => {
      const app = load({ storage: phoneStorage({ [KEY]: savedHike() }) });
      const ingest = jest.fn();
      app.store.useRunTrackerStore.setState({ ingest });
      app.service.handleLocations([]);
      app.service.handleLocations(undefined);
      await flushPromises();
      expect(ingest).not.toHaveBeenCalled();
      expect(app.Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    });
  });

  describe('when the app leaves the screen', () => {
    async function recording() {
      const storage = phoneStorage();
      const app = load({ storage });
      await app.store.whenTrackerReady();
      app.state().begin({ kind: 'hike:t1', now: Date.now() });
      jest.advanceTimersByTime(1000);
      app.state().ingest([fix(71, 106.5), fix(72, 108)]);
      return { storage, app };
    }

    it('listens for changes in whether the app is on screen', () => {
      const app = load({ storage: phoneStorage() });
      expect(app.listener.calls).toEqual(['change']);
    });

    it.each(['background', 'inactive'])('saves the hike at once when the app goes to %s', async (state) => {
      const { storage, app } = await recording();
      const writes = storage.setItem.mock.calls.length;
      app.listener.fn(state);
      expect(storage.setItem).toHaveBeenCalledTimes(writes + 1);
      expect(JSON.parse(storage.data[KEY]).state.tracker.lastFixT).toBe(T0 + 72 * 1000);
    });

    it('does not save when the app comes back to the screen', async () => {
      const { storage, app } = await recording();
      const writes = storage.setItem.mock.calls.length;
      app.listener.fn('active');
      expect(storage.setItem).toHaveBeenCalledTimes(writes);
    });

    it('still loads when there is no app state to listen to', () => {
      expect(() => load({ storage: phoneStorage(), appState: 'throws' })).not.toThrow();
    });
  });
});

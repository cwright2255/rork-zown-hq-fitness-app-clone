const T0 = Date.now();
const fix = (sec, x) => ({
  timestamp: T0 + sec * 1000,
  coords: {
    latitude: 40.7, longitude: -74 + x / 84300, accuracy: 4, speed: 3, altitude: null, altitudeAccuracy: -1, heading: 0,
  },
});

// Loads the service fresh, with fake expo-location and (optionally) a fake or missing expo-task-manager.
function load({ taskManager = true } = {}) {
  jest.resetModules();
  jest.doMock('expo-location', () => ({
    Accuracy: { BestForNavigation: 6 },
    ActivityType: { Fitness: 3 },
    hasStartedLocationUpdatesAsync: jest.fn(async () => false),
    startLocationUpdatesAsync: jest.fn(async () => undefined),
    stopLocationUpdatesAsync: jest.fn(async () => undefined),
    watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  }), { virtual: true });
  if (taskManager) {
    jest.doMock('expo-task-manager', () => ({ defineTask: jest.fn() }), { virtual: true });
  } else {
    jest.doMock('expo-task-manager', () => { throw new Error('Cannot find native module ExpoTaskManager'); }, { virtual: true });
  }
  const Location = require('expo-location');
  const TaskManager = taskManager ? require('expo-task-manager') : null;
  const { useRunTrackerStore: store } = require('../store/runTrackerStore');
  const service = require('../services/runTracking');
  const handler = TaskManager ? TaskManager.defineTask.mock.calls[0][1] : null;
  return { Location, TaskManager, store, service, handler };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('services/runTracking', () => {
  let warn;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warn.mockRestore(); });

  describe('with the background task available', () => {
    it('registers the background task as soon as it loads', () => {
      const { TaskManager, service } = load();
      expect(TaskManager.defineTask).toHaveBeenCalledTimes(1);
      expect(TaskManager.defineTask.mock.calls[0][0]).toBe(service.RUN_TRACKING_TASK);
    });

    it('starts background updates for a fitness activity that keeps going on a long run', async () => {
      const { Location, service } = load();
      await expect(service.startTracking()).resolves.toBe('background');
      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
      const [name, options] = Location.startLocationUpdatesAsync.mock.calls[0];
      expect(name).toBe(service.RUN_TRACKING_TASK);
      expect(options.accuracy).toBe(Location.Accuracy.BestForNavigation);
      expect(options.activityType).toBe(Location.ActivityType.Fitness);
      expect(options.pausesUpdatesAutomatically).toBe(false);
      expect(options.showsBackgroundLocationIndicator).toBe(true);
      expect(options.foregroundService.notificationBody).toBe('Recording your run');
      expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('says what is being recorded in the notification, a run unless told otherwise', async () => {
      const { Location, service } = load();
      await service.startTracking({ label: 'hike' });
      expect(Location.startLocationUpdatesAsync.mock.calls[0][1].foregroundService.notificationBody).toBe('Recording your hike');
    });

    it('does not start a second time when already going', async () => {
      const { Location, service } = load();
      Location.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      await expect(service.startTracking()).resolves.toBe('background');
      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('falls back to watching the position if background updates cannot start', async () => {
      const { Location, store, service } = load();
      Location.startLocationUpdatesAsync.mockRejectedValue(new Error('Background location has not been configured'));
      store.getState().begin({ now: T0 });
      await expect(service.startTracking()).resolves.toBe('foreground');
      expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
      const onLocation = Location.watchPositionAsync.mock.calls[0][1];
      onLocation(fix(1, 0));
      onLocation(fix(2, 3));
      expect(store.getState().tracker.lastFixT).toBe(T0 + 2000);
    });

    it('hands task readings to the run', () => {
      const { store, handler } = load();
      store.getState().begin({ now: T0 });
      handler({ data: { locations: [fix(1, 0), fix(2, 3), fix(3, 6)] }, error: null });
      expect(store.getState().tracker.lastFixT).toBe(T0 + 3000);
      expect(store.getState().tracker.route.length).toBeGreaterThan(0);
    });

    it('switches GPS off when a reading arrives and no run is recording', async () => {
      const { Location, store, handler } = load();
      Location.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      handler({ data: { locations: [fix(1, 0)] }, error: null });
      await flush();
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
      expect(store.getState().tracker.status).toBe('idle');
      expect(store.getState().tracker.lastFixT).toBe(0);
    });

    it('switches GPS off after a very long pause, without recording the readings', async () => {
      const { Location, store, handler } = load();
      Location.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      store.getState().begin({ now: Date.now() - 3600000 });
      store.getState().pause(Date.now() - 30 * 60 * 1000);
      handler({ data: { locations: [fix(1, 0)] }, error: null });
      await flush();
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledTimes(1);
      expect(store.getState().tracker.lastFixT).toBe(0);
    });

    it('keeps recording through a short pause', async () => {
      const { Location, store, handler } = load();
      store.getState().begin({ now: T0 });
      store.getState().pause(T0 + 1000);
      handler({ data: { locations: [fix(5, 0)] }, error: null });
      await flush();
      expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
      expect(store.getState().tracker.lastFixT).toBe(T0 + 5000);
    });

    it('survives an error from the phone and empty deliveries', () => {
      const { store, handler } = load();
      store.getState().begin({ now: T0 });
      expect(() => handler({ data: null, error: { message: 'denied' } })).not.toThrow();
      expect(() => handler({ data: {}, error: null })).not.toThrow();
      expect(() => handler({ data: { locations: [] }, error: null })).not.toThrow();
      expect(store.getState().tracker.lastFixT).toBe(0);
    });

    it('stops background updates', async () => {
      const { Location, service } = load();
      Location.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      await service.stopTracking();
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(service.RUN_TRACKING_TASK);
    });

    it('is fine to stop when nothing is running', async () => {
      const { Location, service } = load();
      await service.stopTracking();
      expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    });

    it('survives the phone refusing to stop', async () => {
      const { Location, service } = load();
      Location.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
      Location.stopLocationUpdatesAsync.mockRejectedValue(new Error('nope'));
      await expect(service.stopTracking()).resolves.toBeUndefined();
    });
  });

  describe('on a build without expo-task-manager', () => {
    it('loads without crashing and watches the position instead', async () => {
      const { Location, store, service } = load({ taskManager: false });
      store.getState().begin({ now: T0 });
      await expect(service.startTracking()).resolves.toBe('foreground');
      expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
      expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
      Location.watchPositionAsync.mock.calls[0][1](fix(1, 0));
      expect(store.getState().tracker.lastFixT).toBe(T0 + 1000);
    });

    it('does not start watching twice', async () => {
      const { Location, service } = load({ taskManager: false });
      await service.startTracking();
      await service.startTracking();
      expect(Location.watchPositionAsync).toHaveBeenCalledTimes(1);
    });

    it('stops watching', async () => {
      const { Location, service } = load({ taskManager: false });
      const remove = jest.fn();
      Location.watchPositionAsync.mockResolvedValue({ remove });
      await service.startTracking();
      await service.stopTracking();
      expect(remove).toHaveBeenCalledTimes(1);
      await service.startTracking();
      expect(Location.watchPositionAsync).toHaveBeenCalledTimes(2);
    });
  });
});

import { useRunTrackerStore } from '../store/runTrackerStore';
import { ADOPT_WITHIN_MS } from '../lib/runTracker';

const T0 = 1_700_000_000_000;
const fix = (sec, x) => ({
  timestamp: T0 + sec * 1000,
  coords: {
    latitude: 40.7, longitude: -74 + x / 84300, accuracy: 4, speed: 3, altitude: null, altitudeAccuracy: -1, heading: 0,
  },
});

const store = () => useRunTrackerStore.getState();

describe('runTrackerStore', () => {
  beforeEach(() => store().reset());

  it('starts idle', () => {
    expect(store().tracker.status).toBe('idle');
  });

  it('begins a new run', () => {
    expect(store().begin({ now: T0 })).toBe('new');
    expect(store().tracker.status).toBe('running');
    expect(store().tracker.startedAt).toBe(T0);
  });

  it('takes the auto-pause choice when it begins', () => {
    store().begin({ now: T0, autoPause: false });
    expect(store().tracker.autoPause).toBe(false);
  });

  it('feeds readings into the run', () => {
    store().begin({ now: T0 });
    store().ingest([fix(1, 0), fix(2, 3), fix(3, 6)]);
    expect(store().tracker.route.length).toBeGreaterThan(0);
    expect(store().tracker.lastFixT).toBe(T0 + 3000);
  });

  it('picks up a recent run again instead of starting over', () => {
    store().begin({ now: T0 });
    store().ingest([fix(1, 0), fix(2, 3)]);
    store().pause(T0 + 2000);
    const startedAt = store().tracker.startedAt;
    expect(store().begin({ now: T0 + 60000 })).toBe('resumed');
    expect(store().tracker.startedAt).toBe(startedAt);
    expect(store().tracker.status).toBe('paused');
  });

  it('starts a new run when the last one is old', () => {
    store().begin({ now: T0 });
    store().pause(T0 + 1000);
    expect(store().begin({ now: T0 + ADOPT_WITHIN_MS + 5000 })).toBe('new');
    expect(store().tracker.startedAt).toBe(T0 + ADOPT_WITHIN_MS + 5000);
    expect(store().tracker.status).toBe('running');
  });

  it('pauses and resumes', () => {
    store().begin({ now: T0 });
    store().pause(T0 + 5000);
    expect(store().tracker.status).toBe('paused');
    store().resume(T0 + 9000);
    expect(store().tracker.status).toBe('running');
    expect(store().tracker.movingMs).toBe(5000);
  });

  it('changes the auto-pause setting', () => {
    store().begin({ now: T0 });
    store().setAutoPause(false, T0 + 1000);
    expect(store().tracker.autoPause).toBe(false);
  });

  it('finishing returns the run and clears it', () => {
    store().begin({ now: T0 });
    store().ingest(Array.from({ length: 60 }, (_, i) => fix(i + 1, (i + 1) * 3)));
    const summary = store().finish(T0 + 60000);
    expect(summary.duration).toBe(60);
    expect(summary.distance).toBeGreaterThan(0.1);
    expect(summary.coords.length).toBeGreaterThan(5);
    expect(store().tracker.status).toBe('idle');
    expect(store().tracker.route).toHaveLength(0);
  });

  it('finishing with nothing running returns an empty run', () => {
    const summary = store().finish(T0);
    expect(summary.duration).toBe(0);
    expect(summary.distance).toBe(0);
  });
});

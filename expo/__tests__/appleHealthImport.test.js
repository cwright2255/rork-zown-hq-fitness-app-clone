import { Platform } from 'react-native';

// The package is native, so tests stand in for it.
const mockHK = {
  requestAuthorization: jest.fn(async () => true),
  queryWorkoutSamples: jest.fn(async () => []),
  WorkoutActivityType: { running: 37, walking: 52 },
};
jest.mock('@kingstinct/react-native-healthkit', () => mockHK, { virtual: true });

import { appleHealthService } from '../services/appleHealthService';

const T0 = Date.UTC(2026, 9, 7, 11, 0, 0);
const lngAt = (metres) => -74 + metres / (111194.93 * Math.cos((40.7 * Math.PI) / 180));

// A HealthKit workout object as the native package returns it.
const hkWorkout = (uuid, { type = 37, startMin = 0, minutes = 10, metres = 2500, routes } = {}) => {
  const start = new Date(T0 + startMin * 60000);
  const end = new Date(start.getTime() + minutes * 60000);
  const seconds = minutes * 60;
  const defaultRoutes = [{
    locations: Array.from({ length: seconds + 1 }, (_, i) => ({
      latitude: 40.7, longitude: lngAt((i * metres) / seconds), altitude: 20, course: 90, speed: 4,
      horizontalAccuracy: 5, verticalAccuracy: 3, speedAccuracy: 1, date: new Date(start.getTime() + i * 1000),
    })),
  }];
  return {
    uuid,
    workoutActivityType: type,
    startDate: start,
    endDate: end,
    duration: { unit: 's', quantity: seconds },
    totalDistance: { unit: 'meters', quantity: metres },
    totalEnergyBurned: { unit: 'kcal', quantity: 150 },
    getWorkoutRoutes: jest.fn(async () => routes || defaultRoutes),
  };
};

beforeEach(() => {
  mockHK.requestAuthorization.mockReset().mockResolvedValue(true);
  mockHK.queryWorkoutSamples.mockReset().mockResolvedValue([]);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('requestWorkoutAccess', () => {
  it('asks to read workouts and their routes, and nothing else', async () => {
    expect(await appleHealthService.requestWorkoutAccess()).toBe(true);
    expect(mockHK.requestAuthorization).toHaveBeenCalledWith({ toRead: ['HKWorkoutTypeIdentifier', 'HKWorkoutRouteTypeIdentifier'] });
  });

  it('reports failure instead of throwing', async () => {
    mockHK.requestAuthorization.mockRejectedValue(new Error('nope'));
    expect(await appleHealthService.requestWorkoutAccess()).toBe(false);
  });

  it('does nothing off iPhone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    expect(await appleHealthService.requestWorkoutAccess()).toBe(false);
    expect(mockHK.requestAuthorization).not.toHaveBeenCalled();
  });
});

describe('readWorkouts', () => {
  it('asks Health for runs and for walks since the start date, newest first', async () => {
    await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1', limit: 50 });
    expect(mockHK.queryWorkoutSamples).toHaveBeenCalledTimes(2);
    const calls = mockHK.queryWorkoutSamples.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.filter.workoutActivityType).sort()).toEqual([37, 52]);
    calls.forEach((c) => {
      expect(c.limit).toBe(50);
      expect(c.ascending).toBe(false);
      expect(c.filter.date.startDate).toEqual(new Date(T0 - 86400000));
    });
  });

  it('turns each workout into a saved run with its route, splits and the uid', async () => {
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (filter.workoutActivityType === 37 ? [hkWorkout('R1')] : []));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out.ok).toBe(true);
    expect(out.found).toBe(1);
    expect(out.runs).toHaveLength(1);
    expect(out.runs[0]).toMatchObject({ id: 'hk-R1', uid: 'u1', source: 'apple-health', distance: 2.5, duration: 600, calories: 150 });
    expect(out.runs[0].splits).toHaveLength(2);
    expect(out.runs[0].track.length).toBeGreaterThan(3);
  });

  it('marks walking workouts as walks', async () => {
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (filter.workoutActivityType === 52 ? [hkWorkout('W1', { type: 52 })] : []));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out.runs[0].activity).toBe('walk');
  });

  it('puts runs and walks together, newest first', async () => {
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (
      filter.workoutActivityType === 37 ? [hkWorkout('R1', { startMin: 0 })] : [hkWorkout('W1', { type: 52, startMin: 300 })]
    ));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out.runs.map((r) => r.id)).toEqual(['hk-W1', 'hk-R1']);
  });

  it('does not fetch the route again for a workout that is already imported', async () => {
    const known = hkWorkout('R1');
    const fresh = hkWorkout('R2', { startMin: 100 });
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (filter.workoutActivityType === 37 ? [known, fresh] : []));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1', skipIds: new Set(['hk-R1']) });
    expect(known.getWorkoutRoutes).not.toHaveBeenCalled();
    expect(fresh.getWorkoutRoutes).toHaveBeenCalledTimes(1);
    expect(out.skipped).toBe(1);
    expect(out.runs.map((r) => r.id)).toEqual(['hk-R2']);
  });

  it('still imports a workout whose route can not be read', async () => {
    const treadmill = hkWorkout('T1');
    treadmill.getWorkoutRoutes.mockRejectedValue(new Error('no route'));
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (filter.workoutActivityType === 37 ? [treadmill] : []));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out.runs).toHaveLength(1);
    expect(out.runs[0].track).toEqual([]);
    expect('splits' in out.runs[0]).toBe(false);
  });

  it('counts workouts too short to keep as ignored', async () => {
    const tap = hkWorkout('X1', { minutes: 0.5, metres: 20 });
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (filter.workoutActivityType === 37 ? [tap] : []));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out.runs).toEqual([]);
    expect(out.ignored).toBe(1);
    expect(out.found).toBe(1);
  });

  it('reports progress, ending on all of them', async () => {
    mockHK.queryWorkoutSamples.mockImplementation(async ({ filter }) => (
      filter.workoutActivityType === 37 ? [hkWorkout('R1'), hkWorkout('R2', { startMin: 100 })] : []
    ));
    const seen = [];
    await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1', onProgress: (p) => seen.push(p) });
    expect(seen[0]).toEqual({ done: 0, total: 2 });
    expect(seen[seen.length - 1]).toEqual({ done: 2, total: 2 });
  });

  it('never throws when Health fails', async () => {
    mockHK.queryWorkoutSamples.mockRejectedValue(new Error('boom'));
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out).toMatchObject({ ok: false, reason: 'error', message: 'boom', runs: [] });
  });

  it('does nothing off iPhone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const out = await appleHealthService.readWorkouts({ sinceMs: T0 - 86400000, uid: 'u1' });
    expect(out).toMatchObject({ ok: false, reason: 'unsupported' });
    expect(mockHK.queryWorkoutSamples).not.toHaveBeenCalled();
  });
});

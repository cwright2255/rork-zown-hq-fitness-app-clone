// Building today's session from the app's stores (services/sessionService.js): the same recovery the Health screen shows, the same sets the weekly
// volume is counted from, the same target the workout screen shows for each lift, and a session that can always be asked for without it throwing
// or waiting for long. The stores are replaced here; the picker's own rules are tested in sessionPicker.test.js.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: { getState: () => { if (global.__stores.workout === 'throw') throw new Error('store failed'); return global.__stores.workout; } } }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: { getState: () => global.__stores.running } }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: { getState: () => global.__stores.hiking } }));
jest.mock('@/store/healthStore', () => ({ useHealthStore: { getState: () => { if (global.__stores.health === 'throw') throw new Error('store failed'); return global.__stores.health; } } }));
jest.mock('@/services/wearableService', () => ({ getCurrentReadiness: jest.fn(async () => 'medium') }));

import {
  SESSION_PATIENCE_MS, refreshSessionSources, readSessionInputs, loadPrescriptions, buildTodaySession,
} from '../services/sessionService';
import { getCurrentReadiness } from '@/services/wearableService';
import { calculateMuscleRecovery } from '../lib/muscleRecovery';
import { recoveryInputs } from '../lib/homeWidgetData';
import { weeklyVolume, currentRungs, pickSession, attachTargets } from '../lib/sessionPicker';
import { getNextPrescription } from '../services/progressiveOverloadService';
import { countLowReadinessDays } from '../lib/loadRules';
import { MUSCLES } from '../lib/muscleVocabulary';
import { getExercise } from '../lib/exerciseLibrary';
import { localDateKey, shiftDateKey } from '../lib/localDate';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T12:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const TODAY = localDateKey(NOW);
const lift = (name, n, rpe = 'hard') => ({ name, sets: n, done: true, performed: Array.from({ length: n }, () => ({ weight: 100, reps: 8, rpe })) });
const workout = (days, exercises) => ({ completedAt: ago(days).toISOString(), exercises });
const logged = (weight, reps, days, rpe = 'moderate') => reps.map((r) => ({ weight, reps: r, rpe, date: shiftDateKey(TODAY, -days) }));
const user = { uid: 'u1', fitnessLevel: 'intermediate', fitnessMetrics: { targetGoals: ['build_muscle'], injuries: ['knee'] } };

const stores = (over = {}) => ({
  workout: { completedWorkouts: [], loadWorkouts: jest.fn(async () => {}), getExerciseHistory: jest.fn(async () => []), ...over.workout },
  running: { runs: [], loadRuns: jest.fn(async () => {}), ...over.running },
  hiking: { completedHikes: [], loadCompletedHikes: jest.fn(async () => {}), ...over.hiking },
  health: {
    rookRecovery: null, sleep: null, readingsHistory: {}, loadAllHealth: jest.fn(async () => {}), loadRookRecovery: jest.fn(async () => {}), ...over.health,
  },
});

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
      'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
  global.__stores = stores();
  getCurrentReadiness.mockReset().mockResolvedValue('medium');
});
afterEach(() => {
  jest.useRealTimers();
  delete global.__stores;
});

const never = () => new Promise(() => {});

describe('refreshSessionSources', () => {
  it('brings the workouts, runs, hikes and health up to date for this person', async () => {
    await refreshSessionSources('u1');
    expect(global.__stores.workout.loadWorkouts).toHaveBeenCalledWith('u1');
    expect(global.__stores.running.loadRuns).toHaveBeenCalledWith('u1');
    expect(global.__stores.hiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
    expect(global.__stores.health.loadAllHealth).toHaveBeenCalledWith('u1');
    expect(global.__stores.health.loadRookRecovery).toHaveBeenCalledTimes(1);
  });

  it('loads nothing without a person', async () => {
    await refreshSessionSources(undefined);
    await refreshSessionSources('');
    expect(global.__stores.workout.loadWorkouts).not.toHaveBeenCalled();
    expect(global.__stores.health.loadAllHealth).not.toHaveBeenCalled();
  });

  it('is not held up or broken by a load that fails, whether it throws or rejects', async () => {
    global.__stores = stores({
      workout: { loadWorkouts: jest.fn(() => { throw new Error('sync'); }) },
      running: { loadRuns: jest.fn(async () => { throw new Error('async'); }) },
    });
    await expect(refreshSessionSources('u1')).resolves.toBeUndefined();
    expect(global.__stores.hiking.loadCompletedHikes).toHaveBeenCalled();
    expect(global.__stores.health.loadRookRecovery).toHaveBeenCalled();
  });

  it('works when the health store cannot be had', async () => {
    global.__stores.health = 'throw';
    await expect(refreshSessionSources('u1')).resolves.toBeUndefined();
    expect(global.__stores.workout.loadWorkouts).toHaveBeenCalled();
  });

  it('waits no longer than the patience it is given', async () => {
    global.__stores = stores({ workout: { loadWorkouts: jest.fn(never) } });
    const realStart = process.hrtime.bigint();
    await refreshSessionSources('u1', { patience: 40 });
    const waited = Number(process.hrtime.bigint() - realStart) / 1e6;
    expect(waited).toBeGreaterThanOrEqual(30);
    expect(waited).toBeLessThan(1500);
  });

  it('is patient for 4 seconds unless told otherwise', () => {
    expect(SESSION_PATIENCE_MS).toBe(4000);
  });
});

describe('readSessionInputs', () => {
  const workouts = [workout(1, [lift('Barbell Bench Press', 4)]), workout(2, [lift('Push-Up', 3), lift('Barbell Back Squat', 3)]), workout(9, [lift('Wall Push-Up', 3)])];
  const runs = [{ duration: 3600, endTime: ago(1).toISOString() }];
  const hikes = [{ durationSeconds: 7200, completedAt: ago(1).toISOString() }];

  it('reads the recovery the way the Health screen does, from workouts, runs, hikes and sleep', () => {
    const sleep = { totalSleepHours: 5 };
    global.__stores = stores({ workout: { completedWorkouts: workouts }, running: { runs }, hiking: { completedHikes: hikes }, health: { sleep } });
    const inputs = readSessionInputs({ user, now: NOW });
    const expected = calculateMuscleRecovery({ completedWorkouts: workouts, runs, completedHikes: hikes, recovery: recoveryInputs(null, sleep), now: NOW });
    expect(inputs.recovery).toEqual(expected);
    expect(inputs.recovery.chest).toBeLessThan(100);
    expect(inputs.recovery.quadriceps).toBeLessThan(100);
    // the runs and the hikes count: without them the picture would be different
    const without = calculateMuscleRecovery({ completedWorkouts: workouts, recovery: recoveryInputs(null, sleep), now: NOW });
    expect(inputs.recovery).not.toEqual(without);
  });

  it('works to the time it is given, not the clock: a month later the same workouts have worn off', () => {
    global.__stores = stores({ workout: { completedWorkouts: workouts } });
    const later = new Date(NOW.getTime() + 30 * DAY);
    const inputs = readSessionInputs({ user, now: later });
    expect(inputs.recovery).toEqual({});
    expect(inputs.volume).toEqual({ thisWeek: {}, lastWeek: {}, sessions: {} });
    expect(readSessionInputs({ user, now: NOW }).volume.thisWeek.chest).toBeGreaterThan(0);
  });

  it('counts the weekly sets and the ladder rungs from the logged workouts', () => {
    global.__stores = stores({ workout: { completedWorkouts: workouts } });
    const inputs = readSessionInputs({ user, now: NOW });
    expect(inputs.volume).toEqual(weeklyVolume({ workouts, now: NOW }));
    expect(inputs.volume.thisWeek.chest).toBeGreaterThan(0);
    expect(inputs.ladderRungs).toEqual(currentRungs(workouts));
    expect(inputs.ladderRungs).toEqual({ push: 4 });
  });

  it('takes the goal, the level and the injuries from the profile', () => {
    const inputs = readSessionInputs({ user, now: NOW });
    expect(inputs.goal).toBe('muscle');
    expect(inputs.level).toBe('intermediate');
    expect(inputs.injuries).toEqual(['knee']);
    const strength = { ...user, fitnessMetrics: { targetGoals: ['increase_strength'], injuries: ['shoulder', 'wrist'] } };
    expect(readSessionInputs({ user: strength, now: NOW })).toEqual(expect.objectContaining({ goal: 'strength', injuries: ['shoulder', 'wrist'] }));
  });

  it('reads a profile with nothing on it, and no profile, as general fitness with no injuries', () => {
    [undefined, null, {}, { fitnessMetrics: { injuries: 'knee' } }, { fitnessMetrics: null }].forEach((u) => {
      const inputs = readSessionInputs({ user: u, now: NOW });
      expect(inputs.goal).toBe('general');
      expect(inputs.injuries).toEqual([]);
      expect(inputs.level).toBeUndefined();
    });
    expect(readSessionInputs().goal).toBe('general');
  });

  it('copes with stores that hold nothing yet', () => {
    global.__stores = { workout: {}, running: {}, hiking: {}, health: {} };
    const inputs = readSessionInputs({ user, now: NOW });
    expect(inputs.recovery).toEqual({});
    expect(inputs.volume).toEqual({ thisWeek: {}, lastWeek: {}, sessions: {} });
    expect(inputs.ladderRungs).toEqual({});
  });

  it('copes with a health store that cannot be had', () => {
    global.__stores.health = 'throw';
    expect(() => readSessionInputs({ user, now: NOW })).not.toThrow();
  });
});

describe('loadPrescriptions', () => {
  const benchHistory = logged(100, [10, 10, 10], 3);
  const options = (extra = {}) => ({
    readiness: 'medium', bodyweight: false, goal: 'muscle', level: 'intermediate', unit: 'lb', lowReadinessDays: 0, ...extra,
  });
  const barbell = { id: 'barbell-bench-press', name: 'Barbell Bench Press' };
  const pushUp = { id: 'push-up', name: 'Push-Up' };
  const plank = { id: 'plank', name: 'Plank', timed: true };

  it('gives each lift the target the workout screen would show for its history', async () => {
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async (name) => (name === 'Barbell Bench Press' ? benchHistory : [])) } });
    const out = await loadPrescriptions([barbell, pushUp], { uid: 'u1', user });
    expect(out['barbell-bench-press']).toEqual(getNextPrescription(benchHistory, { ...options(), exerciseName: 'Barbell Bench Press' }));
    expect(out['barbell-bench-press'].weight).toBeGreaterThan(0);
    expect(out['push-up']).toBeNull(); // no history: no target
    expect(global.__stores.workout.getExerciseHistory).toHaveBeenCalledWith('Barbell Bench Press', 'u1');
  });

  it('treats a bodyweight move as one, so a history of zero weights still gives a target', async () => {
    const history = logged(0, [12, 12, 12], 3);
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => history) } });
    const out = await loadPrescriptions([pushUp], { uid: 'u1', user });
    expect(out['push-up']).toEqual(getNextPrescription(history, { ...options({ bodyweight: true }), exerciseName: 'Push-Up' }));
    expect(out['push-up']).not.toBeNull();
    expect(out['push-up'].targetReps).toBeGreaterThan(0);
  });

  it('does not ask about a timed hold', async () => {
    const out = await loadPrescriptions([plank], { uid: 'u1', user });
    expect(out).toEqual({});
    expect(global.__stores.workout.getExerciseHistory).not.toHaveBeenCalled();
    expect(getCurrentReadiness).not.toHaveBeenCalled();
  });

  it('answers {} without a person, without exercises, or without a list', async () => {
    expect(await loadPrescriptions([barbell], { user })).toEqual({});
    expect(await loadPrescriptions([], { uid: 'u1', user })).toEqual({});
    expect(await loadPrescriptions(undefined, { uid: 'u1', user })).toEqual({});
    expect(await loadPrescriptions('x', { uid: 'u1', user })).toEqual({});
    expect(await loadPrescriptions([null, undefined], { uid: 'u1', user })).toEqual({});
    expect(await loadPrescriptions()).toEqual({});
    expect(global.__stores.workout.getExerciseHistory).not.toHaveBeenCalled();
  });

  it("passes today's readiness: a low one holds the weight where it was instead of raising it", async () => {
    const pushdown = { id: 'triceps-pushdown', name: 'Tricep Pushdown' };
    const top = logged(50, [12, 12, 12], 3); // every set at the top of the range: a normal day raises the weight
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => top) } });
    const normal = await loadPrescriptions([pushdown], { uid: 'u1', user });
    expect(normal['triceps-pushdown'].weight).toBe(55);
    getCurrentReadiness.mockResolvedValue('low');
    const low = await loadPrescriptions([pushdown], { uid: 'u1', user });
    expect(low['triceps-pushdown']).toEqual(getNextPrescription(top, { ...options({ readiness: 'low' }), exerciseName: 'Tricep Pushdown' }));
    expect(low['triceps-pushdown'].weight).toBe(50);
    expect(getCurrentReadiness).toHaveBeenCalledTimes(2);
  });

  it('goes on without a readiness that does not arrive in time', async () => {
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => benchHistory) } });
    getCurrentReadiness.mockImplementation(never);
    const out = await loadPrescriptions([barbell], { uid: 'u1', user, patience: 30 });
    expect(out['barbell-bench-press']).toEqual(getNextPrescription(benchHistory, { ...options({ readiness: undefined }), exerciseName: 'Barbell Bench Press' }));
  });

  it('counts the low-readiness days from the Health store: three in a week is a deload', async () => {
    const readings = {};
    for (let i = 1; i <= 28; i += 1) readings[shiftDateKey(TODAY, -i)] = { hrv: 50, restingHeartRate: 60, sleepHours: 8 };
    const rough = { hrv: 25, restingHeartRate: 80, sleepHours: 4 };
    const history = { ...readings, [TODAY]: rough, [shiftDateKey(TODAY, -2)]: rough, [shiftDateKey(TODAY, -5)]: rough };
    expect(countLowReadinessDays(history, TODAY)).toBe(3);
    const tired = logged(50, [10, 10, 10], 3);
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => tired) }, health: { readingsHistory: history } });
    const out = await loadPrescriptions([{ id: 'barbell-bench-press', name: 'Barbell Bench Press' }], { uid: 'u1', user });
    expect(out['barbell-bench-press'].deload).toBe(true);
    expect(out['barbell-bench-press']).toEqual(getNextPrescription(tired, { ...options({ lowReadinessDays: 3 }), exerciseName: 'Barbell Bench Press' }));
    global.__stores.health.readingsHistory = readings;
    const calm = await loadPrescriptions([{ id: 'barbell-bench-press', name: 'Barbell Bench Press' }], { uid: 'u1', user });
    expect(calm['barbell-bench-press'].deload).toBe(false);
  });

  it('keeps the histories it fetched, so asking again fetches nothing', async () => {
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => benchHistory) } });
    const cache = new Map();
    await loadPrescriptions([barbell, pushUp], { uid: 'u1', user, cache });
    await loadPrescriptions([barbell, pushUp], { uid: 'u1', user, cache });
    expect(global.__stores.workout.getExerciseHistory).toHaveBeenCalledTimes(2); // once for each name
    expect([...cache.keys()].sort()).toEqual(['Barbell Bench Press', 'Push-Up']);
    await loadPrescriptions([barbell], { uid: 'u1', user, cache: new Map() });
    expect(global.__stores.workout.getExerciseHistory).toHaveBeenCalledTimes(3);
  });

  it('leaves a lift without a target when its history fails or is late, does not remember that, and does not hold up the others', async () => {
    const fetch = jest.fn(async (name) => {
      if (name === 'Barbell Bench Press') throw new Error('offline');
      if (name === 'Push-Up') return never();
      return logged(100, [10, 10, 10], 3);
    });
    global.__stores = stores({ workout: { getExerciseHistory: fetch } });
    const cache = new Map();
    const row = { id: 'barbell-row', name: 'Barbell Row' };
    const out = await loadPrescriptions([barbell, pushUp, row], { uid: 'u1', user, cache, patience: 30 });
    expect(out['barbell-bench-press']).toBeNull();
    expect(out['push-up']).toBeNull();
    expect(out['barbell-row'].weight).toBeGreaterThan(0);
    expect([...cache.keys()]).toEqual(['Barbell Row']);
    await loadPrescriptions([barbell], { uid: 'u1', user, cache, patience: 30 });
    expect(fetch.mock.calls.filter(([name]) => name === 'Barbell Bench Press')).toHaveLength(2);
  });

  it('turns a history that is not a list into no target, and does not keep it', async () => {
    for (const answer of [null, undefined, {}, 'x']) {
      global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => answer) } });
      const cache = new Map();
      expect((await loadPrescriptions([barbell], { uid: 'u1', user, cache }))['barbell-bench-press']).toBeNull();
      expect(cache.size).toBe(0);
    }
  });

  it('uses pounds', async () => {
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async () => benchHistory) } });
    const out = await loadPrescriptions([barbell], { uid: 'u1', user });
    expect(out['barbell-bench-press']).toEqual(getNextPrescription(benchHistory, { ...options(), exerciseName: 'Barbell Bench Press' }));
    expect(out['barbell-bench-press']).not.toEqual(getNextPrescription(benchHistory, { ...options({ unit: 'kg' }), exerciseName: 'Barbell Bench Press' }));
  });
});

describe('buildTodaySession', () => {
  const ask = (extra = {}) => buildTodaySession({ uid: 'u1', user, minutes: 45, equipment: 'gym', now: NOW, ...extra });

  it('is the picker\'s session for what the stores hold, with the targets of the lifts that have a history', async () => {
    const deadliftHistory = logged(200, [5, 5, 5], 4);
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(async (name) => (name === 'Deadlift' ? deadliftHistory : [])) } });
    const session = await ask({ user: { ...user, fitnessMetrics: { targetGoals: ['build_muscle'], injuries: [] } } });
    const inputs = readSessionInputs({ user: { ...user, fitnessMetrics: { targetGoals: ['build_muscle'], injuries: [] } }, now: NOW });
    const picked = pickSession({ ...inputs, minutes: 45, equipment: 'gym' });
    expect(session.status).toBe('ok');
    expect(session.exercises.map((x) => x.id)).toEqual(picked.exercises.map((x) => x.id));
    const deadlift = session.exercises.find((x) => x.id === 'deadlift');
    expect(deadlift.weight).toBeGreaterThan(0);
    expect(deadlift.unit).toBe('lb');
    expect(deadlift.target).toMatch(/^\d+ lb x \d+ reps$/);
    session.exercises.filter((x) => x.id !== 'deadlift').forEach((x) => { expect(x.weight).toBeNull(); expect(x.target).toBeNull(); });
    const prescriptions = await loadPrescriptions(picked.exercises, { uid: 'u1', user });
    expect(session).toEqual(attachTargets(picked, prescriptions));
  });

  it('uses the time and the equipment it is given', async () => {
    const bodyweight = await ask({ minutes: 15, equipment: 'bodyweight' });
    expect(bodyweight.minutes).toBeLessThanOrEqual(15);
    bodyweight.exercises.forEach((x) => getExercise(x.id).equipment.forEach((q) => expect(q).toBe('bodyweight')));
    const long = await ask({ minutes: 60 });
    expect(long.minutes).toBeGreaterThan(bodyweight.minutes);
  });

  it('leaves out what the injuries on the profile rule out, and says so', async () => {
    const session = await ask({ user: { ...user, fitnessMetrics: { targetGoals: ['build_muscle'], injuries: ['shoulder'] } } });
    expect(session.leftOutFor).toEqual(['shoulder']);
    session.exercises.forEach((x) => expect(x.secondary).not.toContain('shoulders'));
  });

  it('keeps off tired muscles: after a hard legs day no leg muscle is the main one of a pick', async () => {
    const legsDay = workout(0.1, [lift('Barbell Back Squat', 8), lift('Leg Press', 8), lift('Romanian Deadlift', 8)]);
    global.__stores = stores({ workout: { completedWorkouts: [legsDay] } });
    const session = await ask();
    expect(session.status).toBe('ok');
    session.exercises.forEach((x) => ['quadriceps', 'glutes', 'hamstrings'].forEach((m) => expect(x.primary).not.toContain(m)));
  });

  it('works to the time it is given: the legs of a legs day are fresh a month later', async () => {
    const legsDay = workout(0.1, [lift('Barbell Back Squat', 8), lift('Leg Press', 8), lift('Romanian Deadlift', 8)]);
    global.__stores = stores({ workout: { completedWorkouts: [legsDay] } });
    const later = await ask({ now: new Date(NOW.getTime() + 30 * DAY) });
    expect(later.exercises.some((x) => ['quadriceps', 'glutes', 'hamstrings'].some((m) => x.primary.includes(m)))).toBe(true);
    expect(later.exercises.some((x) => /no sets logged this week/.test(x.reason))).toBe(true);
  });

  it('asks for each lift\'s history once across several sessions that share a cache', async () => {
    const fetch = jest.fn(async () => logged(100, [10, 10, 10], 3));
    global.__stores = stores({ workout: { getExerciseHistory: fetch } });
    const cache = new Map();
    const first = await ask({ cache });
    const calls = fetch.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const second = await ask({ cache });
    expect(fetch.mock.calls.length).toBe(calls);
    expect(second.exercises.map((x) => x.id)).toEqual(first.exercises.map((x) => x.id));
  });

  it('returns a rest day as it is, without looking up any lift', async () => {
    const everything = workout(0.05, MUSCLES.map((m) => ({ name: 'Custom move', muscleGroups: [m], sets: 12, done: true, performed: Array.from({ length: 12 }, () => ({ weight: 100, reps: 5, rpe: 'hard' })) })));
    global.__stores = stores({ workout: { completedWorkouts: [everything] } });
    const session = await ask();
    expect(session.status).toBe('rest');
    expect(session).toEqual(pickSession({ ...readSessionInputs({ user, now: NOW }), minutes: 45, equipment: 'gym' }));
    expect(session.exercises).toEqual([]);
    expect(global.__stores.workout.getExerciseHistory).not.toHaveBeenCalled();
  });

  it('is null, and never throws, when it cannot be built', async () => {
    global.__stores.workout = 'throw';
    await expect(ask()).resolves.toBeNull();
    global.__stores = stores();
    global.__stores.workout.completedWorkouts = { not: 'a list' };
    await expect(ask()).resolves.not.toBeUndefined();
    await expect(buildTodaySession()).resolves.not.toBeUndefined();
  });

  it('still gives the session when the lift histories are late, just without targets', async () => {
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(never) } });
    const realStart = process.hrtime.bigint();
    const session = await ask({ patience: 30 });
    expect(Number(process.hrtime.bigint() - realStart) / 1e6).toBeLessThan(1500);
    expect(session.status).toBe('ok');
    session.exercises.forEach((x) => { expect(x.weight).toBeNull(); expect(x.target).toBeNull(); });
  });
});

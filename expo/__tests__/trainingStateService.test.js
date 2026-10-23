// Reading the training state from the app's stores (services/trainingStateService.js): the same muscle recovery, readiness and training load
// the Health screen works out, the lift records from the logged sets, and a state that can always be had without it ever throwing.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}));
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: { getState: () => global.__stores.workout } }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: { getState: () => global.__stores.running } }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: { getState: () => global.__stores.hiking } }));
jest.mock('@/store/healthStore', () => ({ useHealthStore: { getState: () => global.__stores.health } }));

import { readTrainingState, loadTrainingSources, getTrainingState } from '../services/trainingStateService';
import { localDateKey, shiftDateKey } from '../lib/localDate';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T12:00:00Z');
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const workout = (days, muscles, extra = {}) => ({
  date: ago(days), caloriesBurned: 300, exercises: [{ muscleGroups: muscles }], ...extra,
});
const sets = (weight, reps, days) => [{ weight, reps, date: ago(days), exerciseName: 'x' }];
// A hard day for one muscle: an exercise the library does not know, tagged with the muscle, with k hard sets logged.
const hardDay = (days, muscle, k) => workout(days, [muscle], {
  exercises: [{ name: 'Custom move', muscleGroups: [muscle], sets: k, done: true, performed: Array.from({ length: k }, () => ({ weight: 100, reps: 5, rpe: 'hard' })) }],
});

// A quiet fortnight of readings and a good morning, so readiness has its own usual to compare with.
const readings = () => {
  const today = localDateKey(NOW);
  const history = { [today]: { hrv: 58, restingHeartRate: 57, sleepHours: 7.5 } };
  for (let i = 1; i <= 14; i += 1) history[shiftDateKey(today, -i)] = { hrv: 50, restingHeartRate: 60, sleepHours: 7.5 };
  return history;
};

const stores = (over = {}) => ({
  workout: {
    completedWorkouts: [], loadWorkouts: jest.fn(async () => {}), getExerciseHistory: jest.fn(async () => []), ...over.workout,
  },
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
});
afterEach(() => {
  jest.useRealTimers();
  delete global.__stores;
});

describe('readTrainingState', () => {
  it('counts the last 14 days\' workouts, ranks the muscles they worked, and ranks how recovered the tired ones are', () => {
    global.__stores = stores({
      workout: {
        completedWorkouts: [
          workout(1, ['chest', 'triceps'], { exercises: [{ muscleGroups: ['chest', 'triceps'] }, { muscleGroups: ['chest'] }] }),
          workout(10, ['chest', 'quadriceps']),
          workout(30, ['back']),
        ],
      },
    });
    const state = readTrainingState({ now: NOW });
    expect(state.recentWorkouts).toBe(2);
    expect(state.musclesWorked).toEqual([
      { muscle: 'chest', sessions: 2 }, { muscle: 'quadriceps', sessions: 1 }, { muscle: 'triceps', sessions: 1 },
    ]);
    // Yesterday's two chest exercises are 3.6 effective sets for the chest (three planned sets each, counted as moderate: 1.8) and 0.9 for the
    // triceps, a day ago: the chest is 79% recovered, the triceps 97%. The leg day 10 days ago and the back day have cleared.
    expect(state.muscleRecovery).toEqual([{ muscle: 'chest', recovery: 79 }, { muscle: 'triceps', recovery: 97 }]);
    expect('muscleLoad' in state).toBe(false);
  });

  it('keeps only whether an injury was reported', () => {
    global.__stores = stores({ workout: { completedWorkouts: [workout(1, ['chest'])] } });
    expect(readTrainingState({ now: NOW, injuries: ['shoulder', 'knee'] }).hasInjuries).toBe(true);
    expect(readTrainingState({ now: NOW, injuries: [] }).hasInjuries).toBe(false);
    expect(readTrainingState({ now: NOW }).hasInjuries).toBe(false);
    expect(JSON.stringify(readTrainingState({ now: NOW, injuries: ['shoulder', 'knee'] }))).not.toMatch(/shoulder|knee/);
  });

  it('works the muscle recovery out with how rested the person is, the way the Health screen does', () => {
    const chestThenLegs = [workout(1, ['chest']), hardDay(4, 'quadriceps', 12)];
    const quads = () => readTrainingState({ now: NOW }).muscleRecovery.find((m) => m.muscle === 'quadriceps').recovery;
    global.__stores = stores({ workout: { completedWorkouts: chestThenLegs } });
    const neutral = quads();

    global.__stores = stores({ workout: { completedWorkouts: chestThenLegs }, health: { sleep: { hours: 5, quality: 'poor' } } });
    const poorSleep = quads();

    global.__stores = stores({ workout: { completedWorkouts: chestThenLegs }, health: { sleep: { hours: 8, quality: 'good' } } });
    const goodSleep = quads();

    // Twelve hard sets clear in 168 hours; four days (96 hours) in, 57% recovered. Poor sleep stretches the 168 hours to 224, good sleep shrinks it to 146.
    expect(neutral).toBe(57);
    expect(poorSleep).toBe(43);
    expect(goodSleep).toBe(66);
  });

  it('uses the wearable\'s recovery before the logged sleep', () => {
    const list = [workout(1, ['chest']), hardDay(4, 'quadriceps', 12)];
    global.__stores = stores({ workout: { completedWorkouts: list }, health: { sleep: { hours: 8, quality: 'good' }, rookRecovery: { sleepHours: 5, sleepEfficiency: 40 } } });
    const quads = readTrainingState({ now: NOW }).muscleRecovery.find((m) => m.muscle === 'quadriceps').recovery;
    expect(quads).toBe(43); // the wearable's poor night wins over the logged good one, which would have given 66
  });

  it('works the recovery out as of the time it is asked for, not the clock', () => {
    global.__stores = stores({ workout: { completedWorkouts: [workout(1, ['chest'])] } });
    expect(readTrainingState({ now: NOW }).muscleRecovery).toEqual([{ muscle: 'chest', recovery: 91 }]);
    expect(readTrainingState({ now: new Date(NOW.getTime() + 2 * DAY) }).muscleRecovery).toEqual([]); // three days on, the three sets have cleared
  });

  it('lists a muscle only while it is still recovering: nothing at all once everything has cleared', () => {
    global.__stores = stores({ workout: { completedWorkouts: [hardDay(9, 'chest', 12), workout(30, ['back'])] } });
    const state = readTrainingState({ now: NOW });
    expect(state.recentWorkouts).toBe(1);
    expect(state.muscleRecovery).toEqual([]);
  });

  it('includes runs and hikes in the muscle recovery, by how long they lasted', () => {
    global.__stores = stores({
      running: { runs: [{ endTime: ago(1).toISOString(), duration: 3600, calories: 400 }] },
      hiking: { completedHikes: [{ completedAt: ago(2).toISOString(), durationSeconds: 3600, calories: 500 }] },
    });
    const state = readTrainingState({ now: NOW });
    expect(state.recentWorkouts).toBeNull(); // no gym workouts to count from
    expect(state.musclesWorked).toEqual([
      { muscle: 'calves', sessions: 2 }, { muscle: 'core', sessions: 2 }, { muscle: 'glutes', sessions: 2 },
      { muscle: 'hamstrings', sessions: 2 }, { muscle: 'quadriceps', sessions: 2 },
    ]);
    // An hour is three effective sets, spread over the legs by the running and hiking weights.
    expect(state.muscleRecovery).toEqual([
      { muscle: 'quadriceps', recovery: 75 }, { muscle: 'glutes', recovery: 79 }, { muscle: 'hamstrings', recovery: 82 },
      { muscle: 'calves', recovery: 91 }, { muscle: 'core', recovery: 96 },
    ]);
  });

  it('counts a run or hike with no duration as worked, but adds no recovery figure for it', () => {
    global.__stores = stores({ running: { runs: [{ endTime: ago(1).toISOString(), calories: 400 }] } });
    const state = readTrainingState({ now: NOW });
    expect(state.musclesWorked).toHaveLength(5);
    expect(state.muscleRecovery).toEqual([]);
  });

  it('gives readiness once the daily record can score it, and leaves it out before', () => {
    global.__stores = stores({ workout: { completedWorkouts: [workout(1, ['chest'])] }, health: { readingsHistory: readings() } });
    const state = readTrainingState({ now: NOW });
    expect(Number.isInteger(state.readiness.score)).toBe(true);
    expect(state.readiness.score).toBeGreaterThan(0);
    expect(['High', 'Moderate', 'Low']).toContain(state.readiness.label);

    global.__stores = stores({ workout: { completedWorkouts: [workout(1, ['chest'])] } });
    expect(readTrainingState({ now: NOW }).readiness).toBeNull();
  });

  it('gives the training load once there are enough days of history, and leaves it out before', () => {
    const many = [1, 2, 4, 6, 9, 12, 16, 20].map((d) => workout(d, ['chest']));
    global.__stores = stores({ workout: { completedWorkouts: many } });
    const state = readTrainingState({ now: NOW });
    expect(typeof state.trainingLoad.zone).toBe('string');
    expect(state.trainingLoad.zone).not.toBe('insufficient_data');
    expect(Number.isFinite(state.trainingLoad.ratio)).toBe(true);

    global.__stores = stores({ workout: { completedWorkouts: [workout(1, ['chest']), workout(2, ['chest'])] } });
    expect(readTrainingState({ now: NOW }).trainingLoad).toBeNull();
  });

  it('carries the lift records it is given', () => {
    const liftPRs = [{ name: 'Squat', bestWeight: 225, bestReps: 3, bestE1RM: 248, bestDate: '2026-10-01', lastSessionDate: '2026-10-18', sessionCount: 9 }];
    expect(readTrainingState({ liftPRs, now: NOW }).lifts).toEqual([
      { name: 'Squat', e1rm: 248, bestWeight: 225, bestReps: 3, lastSessionDate: '2026-10-18', sessions: 9 },
    ]);
  });

  it('is empty for an account with nothing logged', () => {
    expect(readTrainingState({ now: NOW })).toEqual({
      v: 3, recentWorkouts: null, musclesWorked: null, muscleRecovery: null, lifts: [], readiness: null, trainingLoad: null, hasInjuries: false,
    });
  });
});

describe('loadTrainingSources', () => {
  it('brings every store up to date for the person and reads the three main lifts', async () => {
    await loadTrainingSources('u1');
    const s = global.__stores;
    expect(s.workout.loadWorkouts).toHaveBeenCalledWith('u1');
    expect(s.running.loadRuns).toHaveBeenCalledWith('u1');
    expect(s.hiking.loadCompletedHikes).toHaveBeenCalledWith('u1');
    expect(s.health.loadAllHealth).toHaveBeenCalledWith('u1');
    expect(s.health.loadRookRecovery).toHaveBeenCalledTimes(1);
    expect(s.workout.getExerciseHistory.mock.calls.map((c) => c[0]).sort()).toEqual(['Bench Press', 'Deadlift', 'Squat']);
    s.workout.getExerciseHistory.mock.calls.forEach((c) => expect(c[1]).toBe('u1'));
  });

  it('gives each lift\'s best set and estimated one-rep max from its logged sets', async () => {
    global.__stores = stores({
      workout: {
        getExerciseHistory: jest.fn(async (name) => (name === 'Bench Press' ? [...sets(135, 8, 20), ...sets(185, 5, 3)] : [])),
      },
    });
    const prs = await loadTrainingSources('u1');
    expect(prs).toEqual([{
      name: 'Bench Press', bestWeight: 185, bestReps: 5, bestE1RM: 216,
      bestDate: localDateKey(ago(3)), lastSessionDate: localDateKey(ago(3)), sessionCount: 2,
    }]);
  });

  it('carries on when one load fails, and never rejects', async () => {
    global.__stores = stores({
      workout: { loadWorkouts: jest.fn(async () => { throw new Error('offline'); }), getExerciseHistory: jest.fn(async (name) => { if (name === 'Squat') throw new Error('offline'); return sets(100, 5, 2); }) },
      running: { loadRuns: jest.fn(() => { throw new Error('sync throw'); }) },
      health: { loadAllHealth: jest.fn(async () => { throw new Error('offline'); }) },
    });
    const prs = await loadTrainingSources('u1');
    expect(prs.map((p) => p.name).sort()).toEqual(['Bench Press', 'Deadlift']);
  });

  it('gives up waiting after the patience it is given, and says it found nothing', async () => {
    global.__stores = stores({ workout: { getExerciseHistory: jest.fn(() => new Promise(() => {})) } });
    const started = Date.now();
    expect(await loadTrainingSources('u1', { patience: 20 })).toEqual([]);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('getTrainingState', () => {
  it('is the state, with the lifts, for a person who has trained', async () => {
    global.__stores = stores({
      workout: {
        completedWorkouts: [workout(1, ['chest']), workout(2, ['quadriceps'])],
        getExerciseHistory: jest.fn(async (name) => (name === 'Squat' ? sets(225, 3, 3) : [])),
      },
      health: { readingsHistory: readings() },
    });
    const state = await getTrainingState('u1', { now: NOW });
    expect(state.v).toBe(3);
    expect(state.recentWorkouts).toBe(2);
    expect(state.musclesWorked.map((m) => m.muscle)).toEqual(['chest', 'quadriceps']);
    expect(state.muscleRecovery).toEqual([{ muscle: 'chest', recovery: 91 }, { muscle: 'quadriceps', recovery: 97 }]);
    expect(state.lifts).toEqual([expect.objectContaining({ name: 'Squat', bestWeight: 225, bestReps: 3, sessions: 1 })]);
    expect(state.readiness).not.toBeNull();
  });

  it('is null for a brand-new account with nothing to tell the AI', async () => {
    expect(await getTrainingState('u1', { now: NOW })).toBeNull();
  });

  it('is null with no one signed in, and reads nothing', async () => {
    expect(await getTrainingState(undefined, { now: NOW })).toBeNull();
    expect(await getTrainingState('', { now: NOW })).toBeNull();
    expect(global.__stores.workout.loadWorkouts).not.toHaveBeenCalled();
  });

  it('is null, not an error, when a store breaks while it is read', async () => {
    global.__stores = { ...stores(), workout: undefined };
    await expect(getTrainingState('u1', { now: NOW })).resolves.toBeNull();
  });

  it('does not wait past its patience for slow stores', async () => {
    global.__stores = stores({
      workout: { completedWorkouts: [workout(1, ['chest'])], loadWorkouts: jest.fn(() => new Promise(() => {})), getExerciseHistory: jest.fn(() => new Promise(() => {})) },
    });
    const state = await getTrainingState('u1', { now: NOW, patience: 20 });
    expect(state.recentWorkouts).toBe(1);
    expect(state.lifts).toEqual([]);
  });
});

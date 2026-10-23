// The health store opens the phone's storage as soon as it loads. If that fails, the training state is still read from the rest, with
// the muscle recovery worked out without sleep and readiness left out (services/trainingStateService.js takes the store only when it needs it).
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), addDoc: jest.fn(), query: jest.fn(), where: jest.fn(), getDocs: jest.fn(), serverTimestamp: jest.fn(),
}));
jest.mock('@/store/healthStore', () => { throw new Error('[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.'); });
jest.mock('@/store/workoutStore', () => ({ useWorkoutStore: { getState: () => global.__stores.workout } }));
jest.mock('@/store/runningStore', () => ({ useRunningStore: { getState: () => ({ runs: [] }) } }));
jest.mock('@/store/hikingStore', () => ({ useHikingStore: { getState: () => ({ completedHikes: [] }) } }));

import { readTrainingState, loadTrainingSources, getTrainingState } from '../services/trainingStateService';

const NOW = new Date('2026-10-23T12:00:00Z');
const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

beforeEach(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
      'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
  global.__stores = {
    workout: {
      completedWorkouts: [{ date: yesterday, caloriesBurned: 300, exercises: [{ muscleGroups: ['chest'] }] }],
      loadWorkouts: jest.fn(async () => {}),
      getExerciseHistory: jest.fn(async () => []),
    },
  };
});
afterEach(() => {
  jest.useRealTimers();
  delete global.__stores;
});

describe('with no health store', () => {
  it('still gives the 14 days and the muscle recovery, and leaves readiness out', () => {
    const state = readTrainingState({ now: NOW });
    expect(state.recentWorkouts).toBe(1);
    expect(state.muscleRecovery).toEqual([{ muscle: 'chest', recovery: 91 }]); // three planned sets, a day ago
    expect(state.readiness).toBeNull();
  });

  it('still loads the others and reads the lifts', async () => {
    await expect(loadTrainingSources('u1')).resolves.toEqual([]);
    expect(global.__stores.workout.loadWorkouts).toHaveBeenCalledWith('u1');
    expect(global.__stores.workout.getExerciseHistory).toHaveBeenCalledTimes(3);
  });

  it('still gives a state for the plan call', async () => {
    const state = await getTrainingState('u1', { now: NOW });
    expect(state.recentWorkouts).toBe(1);
  });
});

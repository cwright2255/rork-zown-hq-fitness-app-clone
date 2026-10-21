// Finishing a workout (store/workoutStore.js addCompletedWorkout). Two things used to lose it:
//   1. the list was trimmed from the wrong end. After the server's list (newest first) was loaded, saving one more workout kept the
//      OLDEST 20 and dropped the rest, so Total Workouts, the streak and Workout History came up short;
//   2. Firestore refuses a document with an undefined field, and a session started from a program day has no template (no category,
//      no difficulty), so the save failed and the workout stayed on the phone only.
jest.mock('../src/config/firebase', () => ({ db: { name: 'db' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) },
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((db, name) => ({ collection: name })),
  addDoc: jest.fn(),
  query: jest.fn((...args) => ({ args })),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  serverTimestamp: jest.fn(() => ({ __serverTimestamp: true })),
  doc: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

import { addDoc, getDocs, limit } from 'firebase/firestore';
import { useWorkoutStore } from '../store/workoutStore';

const store = () => useWorkoutStore.getState();
const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date('2026-09-01T12:00:00Z').getTime();
// The record for day n after the 1st of September: a higher n is a newer workout.
const rec = (n, extra = {}) => ({ id: `srv-${n}`, name: `Workout ${n}`, completedAt: new Date(BASE + n * DAY).toISOString(), ...extra });
const newestFirstList = (count) => Array.from({ length: count }, (_, i) => rec(count - i)); // day count ... day 1
const oldestFirstList = (count) => Array.from({ length: count }, (_, i) => rec(i + 1)); // day 1 ... day count
const finishedNow = (extra = {}) => ({ workoutId: null, name: 'Just finished', completedAt: new Date(BASE + 500 * DAY).toISOString(), duration: 1800, ...extra });
const names = () => store().completedWorkouts.map((w) => w.name);

let errorSpy;
let warnSpy;
beforeEach(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  addDoc.mockReset();
  getDocs.mockReset();
  addDoc.mockResolvedValue({ id: 'srv-new' });
  useWorkoutStore.setState({ completedWorkouts: [] });
});
afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('a finished workout joins the list', () => {
  it('is added at the top of a list loaded from the server, and every earlier workout stays', async () => {
    getDocs.mockResolvedValue({ docs: newestFirstList(30).map((w) => ({ id: w.id, data: () => { const { id, ...rest } = w; return rest; } })) });
    await store().loadWorkouts('u1');
    expect(store().completedWorkouts).toHaveLength(30);

    await store().addCompletedWorkout(finishedNow(), 'u1');

    expect(store().completedWorkouts).toHaveLength(31); // it used to drop to 20
    expect(names()[0]).toBe('Just finished');
    expect(names()[1]).toBe('Workout 30'); // the previous newest is still next
    expect(names()[30]).toBe('Workout 1'); // and the oldest is still there
  });

  it('keeps the newest 240 and lets the oldest go, once the list is full', async () => {
    useWorkoutStore.setState({ completedWorkouts: newestFirstList(240) });
    await store().addCompletedWorkout(finishedNow(), 'u1');
    const list = store().completedWorkouts;
    expect(list).toHaveLength(240);
    expect(list[0].name).toBe('Just finished');
    expect(list[1].name).toBe('Workout 240');
    expect(list.map((w) => w.name)).not.toContain('Workout 1'); // the oldest of them made room
    expect(list[239].name).toBe('Workout 2');
  });

  it('puts it first in a list the phone had saved oldest first, and puts the rest in order too', async () => {
    useWorkoutStore.setState({ completedWorkouts: oldestFirstList(5) });
    await store().addCompletedWorkout(finishedNow(), 'u1');
    expect(names()).toEqual(['Just finished', 'Workout 5', 'Workout 4', 'Workout 3', 'Workout 2', 'Workout 1']);
  });

  it('is placed by the time it finished, not by being the latest to be added', async () => {
    useWorkoutStore.setState({ completedWorkouts: newestFirstList(3) });
    await store().addCompletedWorkout(finishedNow({ name: 'Logged late', completedAt: new Date(BASE + 2 * DAY + 1000).toISOString() }), 'u1');
    expect(names()).toEqual(['Workout 3', 'Logged late', 'Workout 2', 'Workout 1']);
  });

  it('is in the list at once, before the server has answered', async () => {
    let finish;
    addDoc.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const saving = store().addCompletedWorkout(finishedNow(), 'u1');
    expect(names()).toEqual(['Just finished']);
    expect(store().completedWorkouts[0].id).toMatch(/^local-/);
    finish({ id: 'srv-new' });
    await saving;
  });

  it('takes the server id once saved, and keeps its place', async () => {
    useWorkoutStore.setState({ completedWorkouts: newestFirstList(3) });
    const saved = await store().addCompletedWorkout(finishedNow(), 'u1');
    expect(saved.id).toBe('srv-new');
    expect(store().completedWorkouts[0]).toMatchObject({ id: 'srv-new', name: 'Just finished' });
    expect(store().completedWorkouts).toHaveLength(4);
  });

  it('stays in the list, on the phone, with no one signed in', async () => {
    const saved = await store().addCompletedWorkout(finishedNow(), undefined);
    expect(addDoc).not.toHaveBeenCalled();
    expect(saved.id).toMatch(/^local-/);
    expect(names()).toEqual(['Just finished']);
  });

  it('stays in the list when the save is refused, and says so in the log', async () => {
    addDoc.mockRejectedValue(new Error('permission-denied'));
    const saved = await store().addCompletedWorkout(finishedNow(), 'u1');
    expect(saved.id).toMatch(/^local-/);
    expect(names()).toEqual(['Just finished']);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Firestore write failed'), 'permission-denied');
  });
});

describe('loading the list from the server', () => {
  const docsOf = (list) => ({ docs: list.map((w) => ({ id: w.id, data: () => { const { id, ...rest } = w; return rest; } })) });

  it('asks the server for the newest 240', async () => {
    limit.mockClear();
    getDocs.mockResolvedValue(docsOf([]));
    await store().loadWorkouts('u1');
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(240);
  });

  it('holds all 240 it is sent, and one more finished workout keeps 240 with the newest on top', async () => {
    getDocs.mockResolvedValue(docsOf(newestFirstList(240)));
    await store().loadWorkouts('u1');
    expect(store().completedWorkouts).toHaveLength(240);
    expect(names()[0]).toBe('Workout 240');
    expect(names()[239]).toBe('Workout 1');
    await store().addCompletedWorkout(finishedNow(), 'u1');
    expect(store().completedWorkouts).toHaveLength(240);
    expect(names()[0]).toBe('Just finished');
    expect(names()[239]).toBe('Workout 2');
  });
});

describe('what is written to the server', () => {
  it('has no undefined field, so a session with no template (a program day) is saved', async () => {
    await store().addCompletedWorkout(finishedNow({
      category: undefined,
      difficulty: undefined,
      exercises: [{ name: 'Squat', sets: 3, reps: 8, muscleGroups: [], note: undefined }],
      startedAt: undefined,
    }), 'u1');

    expect(addDoc).toHaveBeenCalledTimes(1);
    const doc = addDoc.mock.calls[0][1];
    const undefinedPaths = [];
    const walk = (value, path) => {
      if (value === undefined) undefinedPaths.push(path);
      else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
      else if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) Object.keys(value).forEach((k) => walk(value[k], `${path}.${k}`));
    };
    walk(doc, 'doc');
    expect(undefinedPaths).toEqual([]);
    expect('category' in doc).toBe(false);
    expect('difficulty' in doc).toBe(false);
    expect('startedAt' in doc).toBe(false);
    expect(doc.exercises).toEqual([{ name: 'Squat', sets: 3, reps: 8, muscleGroups: [] }]);
  });

  it('still carries everything else: the owner, the name, the time it finished, and the server time', async () => {
    await store().addCompletedWorkout(finishedNow({ category: 'strength', caloriesBurned: 250 }), 'u1');
    const [target, doc] = addDoc.mock.calls[0];
    expect(target).toEqual({ collection: 'workouts' });
    expect(doc).toMatchObject({
      userId: 'u1', name: 'Just finished', category: 'strength', caloriesBurned: 250, duration: 1800, completed: true,
      completedAt: new Date(BASE + 500 * DAY).toISOString(),
      date: { __serverTimestamp: true },
    });
  });

  it('writes completed: false for a workout saved part way, and true when nothing is said', async () => {
    await store().addCompletedWorkout(finishedNow({ completed: false, partial: true }), 'u1');
    await store().addCompletedWorkout(finishedNow(), 'u1');
    expect(addDoc.mock.calls[0][1]).toMatchObject({ completed: false, partial: true });
    expect(addDoc.mock.calls[1][1]).toMatchObject({ completed: true });
  });

  it('does not change the record it was handed', async () => {
    const workout = finishedNow({ category: undefined });
    await store().addCompletedWorkout(workout, 'u1');
    expect('category' in workout).toBe(true);
    expect('userId' in workout).toBe(false);
  });
});

describe('what the phone keeps for next time', () => {
  const kept = (list) => useWorkoutStore.persist.getOptions().partialize({
    workouts: [], customWorkouts: [], completedWorkouts: list, favoriteWorkoutIds: [], inProgress: null,
    runningPrograms: [], activeProgram: null, runHistory: [], runningChallenges: [], virtualRaces: [], runningBuddy: null,
  }).completedWorkouts;

  it('is the newest 20, from a list that is newest first', () => {
    const out = kept(newestFirstList(60));
    expect(out).toHaveLength(20);
    expect(out[0].name).toBe('Workout 60'); // it used to keep the OLDEST 20 of this list
    expect(out[19].name).toBe('Workout 41');
  });

  it('is the newest 20, from a list that is oldest first', () => {
    const out = kept(oldestFirstList(60));
    expect(out).toHaveLength(20);
    expect(out[0].name).toBe('Workout 60');
    expect(out[19].name).toBe('Workout 41');
  });

  it('keeps a shorter list whole', () => {
    expect(kept(newestFirstList(3)).map((w) => w.name)).toEqual(['Workout 3', 'Workout 2', 'Workout 1']);
    expect(kept([])).toEqual([]);
  });
});

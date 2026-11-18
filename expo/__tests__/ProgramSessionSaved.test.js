// A Training Program day finished all the way is saved with which program, week and day it was, so the program's tile on the Workouts tab can
// say where the person is (lib/trainingProgramProgress.js). A day saved part-way ("Save and exit") does not carry them, so it does not count.
//
// The finish button of app/workout/active.jsx is not driven here (nothing in this repo renders a workout through to its end); what it hands
// to the store is checked in its source, and what the store does with it is run for real.
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

import fs from 'fs';
import path from 'path';
import { addDoc } from 'firebase/firestore';
import { useWorkoutStore } from '../store/workoutStore';
import { WORKOUT_PROGRAMS } from '../data/workoutPrograms';
import { programProgress, progressLabel } from '../lib/trainingProgramProgress';

const PROGRAM = WORKOUT_PROGRAMS[0];

describe('what app/workout/active.jsx saves', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'workout', 'active.jsx'), 'utf8');
  // The text of each call that saves a finished workout: from `addCompletedWorkout({` to its closing `}, user?.uid);`.
  const calls = source.split('await addCompletedWorkout({').slice(1).map((rest) => rest.slice(0, rest.indexOf('}, user?.uid);')));
  const partCall = calls.find((c) => /partial: true/.test(c));
  const fullCall = calls.find((c) => !/partial: true/.test(c));

  it('saves a workout in two places: one finished all the way and one saved part-way', () => {
    expect(calls).toHaveLength(2);
    expect(partCall).toBeDefined();
    expect(fullCall).toBeDefined();
  });

  it('puts the program, the week and the day on a program day finished all the way, and only for a program day', () => {
    expect(fullCall).toContain('...(isProgramSession ? { programId, programWeek: programWeekParam, programDay: programDayIndexParam } : {})');
  });

  it('does not put them on a day saved part-way, so a day not finished is not counted', () => {
    expect(partCall).not.toMatch(/programId|programWeek|programDay/);
  });

  it('takes the three values from the same place the screen reads which day it is running', () => {
    expect(source).toContain("const programId = typeof params.programId === 'string' ? params.programId : '';");
    expect(source).toContain("const programWeekParam = typeof params.week === 'string' ? parseInt(params.week, 10) : null;");
    expect(source).toContain("const programDayIndexParam = typeof params.dayIndex === 'string' ? parseInt(params.dayIndex, 10) : null;");
  });
});

describe('what the store does with a program day', () => {
  let errorSpy;
  let warnSpy;
  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    addDoc.mockReset();
    let n = 0;
    addDoc.mockImplementation(async () => ({ id: `srv-${(n += 1)}` }));
    useWorkoutStore.setState({ completedWorkouts: [] });
  });
  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // As the finish button builds it for a program day: no template, so no workoutId, category or difficulty.
  const programDay = (week, day, at) => ({
    workoutId: null, name: `${PROGRAM.title} - ${PROGRAM.weeks[0].days[day].day}`, category: undefined, difficulty: undefined,
    exercises: [], duration: 1800, completedAt: new Date(at).toISOString(),
    programId: PROGRAM.id, programWeek: week, programDay: day,
  });
  const label = () => progressLabel(programProgress(PROGRAM, useWorkoutStore.getState().completedWorkouts));

  it('keeps the program, week and day on the workout, on the phone and in what is sent to Firestore', async () => {
    await useWorkoutStore.getState().addCompletedWorkout(programDay(1, 0, '2026-11-16T10:00:00Z'), 'u1');
    expect(useWorkoutStore.getState().completedWorkouts[0]).toMatchObject({ programId: PROGRAM.id, programWeek: 1, programDay: 0 });
    const sent = addDoc.mock.calls[0][1];
    expect(sent).toMatchObject({ programId: PROGRAM.id, programWeek: 1, programDay: 0, completed: true, userId: 'u1' });
    expect(Object.values(sent).includes(undefined)).toBe(false); // Firestore refuses an undefined field
  });

  it('gives the program\'s tile its week as days are finished, one after another', async () => {
    const add = (week, day, at) => useWorkoutStore.getState().addCompletedWorkout(programDay(week, day, at), 'u1');
    expect(label()).toBeNull();
    await add(1, 0, '2026-11-16T10:00:00Z');
    expect(label()).toBe('Week 1 of 9');
    await add(1, 1, '2026-11-17T10:00:00Z');
    expect(label()).toBe('Week 1 of 9');
    await add(1, 2, '2026-11-18T10:00:00Z');
    expect(label()).toBe('Week 2 of 9');
  });

  it('does not move the program on for a day saved part-way', async () => {
    await useWorkoutStore.getState().addCompletedWorkout(
      { ...programDay(1, 0, '2026-11-16T10:00:00Z'), programId: undefined, programWeek: undefined, programDay: undefined, partial: true, completed: false },
      'u1',
    );
    expect(label()).toBeNull();
  });

  it('does not count a workout that was not a program day', async () => {
    await useWorkoutStore.getState().addCompletedWorkout({ workoutId: 'w1', name: 'Iron Hour', completedAt: '2026-11-16T10:00:00Z', duration: 1800 }, 'u1');
    expect(label()).toBeNull();
    expect('programId' in useWorkoutStore.getState().completedWorkouts[0]).toBe(false);
  });
});

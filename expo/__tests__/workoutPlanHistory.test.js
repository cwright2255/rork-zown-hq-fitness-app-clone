// The recent workouts sent with a request for a plan (lib/planHistory.js, used by store/workoutStore.js generateNewWorkoutRecommendation). A workout's
// name is a made-up one now ("Quad Squad", lib/workoutNames.js), which says nothing about what it trained, so each one goes with the muscles it worked.
// The server puts the history in the AI's prompt as it is received (functions/src/index.js), so nothing there has to change.
import fs from 'fs';
import path from 'path';
import { historyForPlan, musclesOfWorkout, PLAN_HISTORY_WORKOUTS, PLAN_HISTORY_MUSCLES } from '../lib/planHistory';

const done = (n, extra = {}) => ({ id: `w${n}`, name: `Quad Squad ${n}`, category: 'Strength', completedAt: `2026-09-${String(n).padStart(2, '0')}T12:00:00.000Z`, ...extra });
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('musclesOfWorkout', () => {
  it('lists the muscles once each, in the order the exercises give them', () => {
    expect(musclesOfWorkout({
      exercises: [
        { name: 'Barbell Squat', muscleGroups: ['quadriceps', 'glutes'] },
        { name: 'Leg Press', muscleGroups: ['quadriceps', 'glutes'] },
        { name: 'Leg Curl', muscleGroups: ['hamstrings'] },
      ],
    })).toEqual(['quadriceps', 'glutes', 'hamstrings']);
  });

  it('keeps at most six', () => {
    expect(PLAN_HISTORY_MUSCLES).toBe(6);
    expect(musclesOfWorkout({ exercises: [{ muscleGroups: ['chest', 'shoulders', 'triceps', 'lats', 'biceps', 'core', 'glutes', 'calves'] }] }))
      .toEqual(['chest', 'shoulders', 'triceps', 'lats', 'biceps', 'core']);
  });

  it('is empty for anything that does not say, without failing', () => {
    [undefined, null, 5, 'x', {}, { exercises: null }, { exercises: [] }, { exercises: [null, 3, { name: 'Mystery' }, { muscleGroups: 'chest' }, { muscleGroups: [null, 4, ''] }] }]
      .forEach((w) => expect(musclesOfWorkout(w)).toEqual([]));
  });
});

describe('historyForPlan', () => {
  it('has the name, category and date of each workout, and the muscles it worked', () => {
    const w = done(3, { exercises: [{ name: 'Barbell Squat', muscleGroups: ['quadriceps', 'glutes'] }, { name: 'Leg Curl', muscleGroups: ['hamstrings'] }] });
    expect(historyForPlan([w])).toEqual([
      { name: 'Quad Squad 3', category: 'Strength', completedAt: '2026-09-03T12:00:00.000Z', muscles: ['quadriceps', 'glutes', 'hamstrings'] },
    ]);
  });

  it('leaves the field out, rather than sending an empty one, when the workout does not say', () => {
    historyForPlan([done(1), done(2, { exercises: [] }), done(3, { exercises: [{ name: 'Mystery' }] })])
      .forEach((w) => expect(Object.keys(w)).toEqual(['name', 'category', 'completedAt']));
  });

  it('is the newest ten workouts, as the list holds them', () => {
    expect(PLAN_HISTORY_WORKOUTS).toBe(10);
    const out = historyForPlan(Array.from({ length: 14 }, (_, i) => done(i + 1)));
    expect(out.map((w) => w.name)).toEqual(Array.from({ length: 10 }, (_, i) => `Quad Squad ${i + 1}`));
  });

  it('is an empty list for someone who has not trained yet, and for anything that is not a list', () => {
    [[], undefined, null, 'x', {}].forEach((v) => expect(historyForPlan(v)).toEqual([]));
  });

  it('skips entries that are not workouts', () => {
    expect(historyForPlan([null, 4, done(2)]).map((w) => w.name)).toEqual(['Quad Squad 2']);
  });
});

describe('the store', () => {
  it('sends it with the request for a plan', () => {
    const store = read('store/workoutStore.js');
    expect(store).toMatch(/import \{ historyForPlan \} from '@\/lib\/planHistory'/);
    expect(store).toMatch(/const history = historyForPlan\(get\(\)\.completedWorkouts\)/);
    expect(store).toMatch(/workoutPlanRequest\(\{ fitnessLevel, goals, history, profile, trainingState \}\)/);
  });

  it('and the server puts it in the prompt untouched, so the muscles reach the AI with no deploy', () => {
    expect(read('functions/src/index.js')).toMatch(/Recent workout history: \$\{JSON\.stringify\(history \?\? \[\]\)\}/);
  });
});

import {
  RECOVERY_RULES, LARGE_MUSCLES, timeOf, workoutTime, exerciseMuscles, workoutLoads, recoveryHours,
  calculateMuscleRecovery, fatigueFromRecovery,
} from '../lib/muscleRecovery';
import { MUSCLES } from '../lib/muscleVocabulary';

// Every expected number below was worked out by hand from the rules at the top of lib/muscleRecovery.js (not by running the module), e.g.
//   4 hard bench sets: chest 4 effective sets of 12 = 33% tired, clearing over 48 + 96 x (0.333 / 0.25) ... = 82.7 hours; at once: 67% recovered.
const NOW = new Date('2026-10-23T12:00:00.000Z');
const HOUR = 3600000;
const ago = (hours) => new Date(NOW.getTime() - hours * HOUR).toISOString();
const sets = (n, rpe = 'hard') => Array.from({ length: n }, () => ({ weight: 100, reps: 8, rpe }));
const lift = (name, n, rpe = 'hard') => ({ name, sets: n, reps: 8, done: true, performed: sets(n, rpe) });
const workout = (hours, exercises, extra = {}) => ({ completedAt: ago(hours), exercises, ...extra });
const recovered = (workouts, extra = {}) => calculateMuscleRecovery({ completedWorkouts: workouts, now: NOW, ...extra });

describe('the rules', () => {
  it('are fixed, so nothing can change them from outside', () => {
    expect(Object.isFrozen(RECOVERY_RULES)).toBe(true);
    expect(Object.isFrozen(RECOVERY_RULES.setEffort)).toBe(true);
    expect(Object.isFrozen(LARGE_MUSCLES)).toBe(true);
  });

  it('count a harder set for more than an easier one, and none for nothing', () => {
    const { hard, moderate, easy } = RECOVERY_RULES.setEffort;
    expect(hard).toBe(1);
    expect(hard).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(easy);
    expect(easy).toBeGreaterThan(0);
    expect(RECOVERY_RULES.unratedSetEffort).toBe(moderate);
  });

  it('take 48 to 72 hours after a light session and 7 days after the hardest, rising evenly in between', () => {
    expect(recoveryHours(0)).toBe(48);
    expect(recoveryHours(0.25)).toBe(72);
    expect(recoveryHours(1)).toBe(168);
    expect(recoveryHours(0.1)).toBeCloseTo(57.6, 5);
    expect(recoveryHours(0.5)).toBeCloseTo(104, 5);
    expect(recoveryHours(0.75)).toBeCloseTo(136, 5);
    let last = 0;
    for (let x = 0; x <= 1.0001; x += 0.05) {
      const h = recoveryHours(x);
      expect(h).toBeGreaterThanOrEqual(last);
      last = h;
    }
  });

  it('never read a share outside 0 to 1 or a non-number as anything but the ends', () => {
    expect(recoveryHours(7)).toBe(168);
    expect(recoveryHours(-3)).toBe(48);
    [NaN, undefined, null, 'x', {}].forEach((v) => expect(recoveryHours(v)).toBe(48));
  });

  it('call only muscles on the list large', () => {
    LARGE_MUSCLES.forEach((m) => expect(MUSCLES).toContain(m));
    expect(LARGE_MUSCLES).toEqual(['chest', 'lats', 'upper_back', 'lower_back', 'quadriceps', 'hamstrings', 'glutes']);
  });
});

describe('timeOf and workoutTime', () => {
  it('read a Firestore timestamp, a Date, a number or a date text', () => {
    const t = Date.parse('2026-10-01T10:00:00.000Z');
    expect(timeOf({ toDate: () => new Date(t) })).toBe(t);
    expect(timeOf(new Date(t))).toBe(t);
    expect(timeOf(t)).toBe(t);
    expect(timeOf('2026-10-01T10:00:00.000Z')).toBe(t);
  });

  it('turn away what is not a date, including the values that turn into 1970', () => {
    [null, undefined, true, false, '', 'not a date', {}, NaN, new Date('x')].forEach((v) => expect(timeOf(v)).toBeNull());
  });

  it('read a workout the way Workout History does: completedAt, then date, then timestamp', () => {
    const a = '2026-10-01T10:00:00.000Z';
    const b = '2026-10-02T10:00:00.000Z';
    expect(workoutTime({ completedAt: a, date: b })).toBe(Date.parse(a));
    expect(workoutTime({ date: { toDate: () => new Date(b) } })).toBe(Date.parse(b));
    expect(workoutTime({ timestamp: b })).toBe(Date.parse(b));
    expect(workoutTime({})).toBeNull();
    [null, undefined, 'x', 4].forEach((v) => expect(workoutTime(v)).toBeNull());
  });
});

describe('exerciseMuscles', () => {
  it('uses the library first: primary muscles count 1, secondary 0.5', () => {
    expect(exerciseMuscles({ name: 'Barbell Bench Press' })).toEqual({ chest: 1, shoulders: 0.5, triceps: 0.5 });
    expect(exerciseMuscles({ name: 'Barbell Curl' })).toEqual({ biceps: 1, forearms: 0.5 });
  });

  it('finds the library entry by an alias or a program name, so program-day exercises count', () => {
    expect(exerciseMuscles({ name: 'Bench Press' })).toEqual(exerciseMuscles({ name: 'Barbell Bench Press' }));
    expect(Object.keys(exerciseMuscles({ name: 'Squat' }))).toEqual(expect.arrayContaining(['quadriceps', 'glutes', 'hamstrings']));
    expect(exerciseMuscles({ name: 'Plank' }).core).toBe(1);
  });

  it('prefers the library to the workout\'s own muscle tags', () => {
    expect(exerciseMuscles({ name: 'Barbell Curl', muscleGroups: ['legs'] })).toEqual({ biceps: 1, forearms: 0.5 });
  });

  it('falls back to the muscle tags for an exercise the library does not know, the first named counting as the main one', () => {
    expect(exerciseMuscles({ name: 'Mystery Lift', muscleGroups: ['Pecs', 'delts', 'triceps'] })).toEqual({ chest: 1, shoulders: 0.5, triceps: 0.5 });
  });

  it('reads a group tag as all its muscles, and skips tags that are not muscles when finding the main one', () => {
    expect(exerciseMuscles({ name: 'Mystery Row', muscleGroups: ['back', 'biceps'] })).toEqual({ lats: 1, upper_back: 1, traps: 1, biceps: 0.5 });
    expect(exerciseMuscles({ name: 'Mystery Move', muscleGroups: ['full body', 'quads', 'glutes'] })).toEqual({ quadriceps: 1, glutes: 0.5 });
  });

  it('counts a muscle named twice once, at its larger weight', () => {
    expect(exerciseMuscles({ name: 'Mystery Lift', muscleGroups: ['chest', 'pecs', 'triceps'] })).toEqual({ chest: 1, triceps: 0.5 });
  });

  it('gives {} when nothing names a muscle, and for anything that is not an exercise', () => {
    expect(exerciseMuscles({ name: 'Mystery Lift' })).toEqual({});
    expect(exerciseMuscles({ name: 'Mystery Lift', muscleGroups: ['cardio', 'full body', 3, null] })).toEqual({});
    expect(exerciseMuscles({ name: 'Mystery Lift', muscleGroups: 'chest' })).toEqual({});
    [null, undefined, 'Bench Press', 4, []].forEach((v) => expect(exerciseMuscles(v)).toEqual({}));
    expect(exerciseMuscles({ name: 7 })).toEqual({});
  });
});

describe('workoutLoads: the effective sets each muscle got', () => {
  it('adds up the sets that were logged, by how hard each was, times the muscle\'s count', () => {
    const w = workout(0, [{ ...lift('Barbell Bench Press', 4), performed: [...sets(2, 'hard'), ...sets(1, 'moderate'), ...sets(1, 'easy')] }]);
    // 2 x 1 + 0.6 + 0.3 = 2.9 sets; chest x 1, shoulders and triceps x 0.5
    const loads = workoutLoads(w);
    expect(loads.chest).toBeCloseTo(2.9, 10);
    expect(loads.shoulders).toBeCloseTo(1.45, 10);
    expect(loads.triceps).toBeCloseTo(1.45, 10);
    expect(Object.keys(loads).sort()).toEqual(['chest', 'shoulders', 'triceps']);
  });

  it('adds the same muscle across exercises', () => {
    const loads = workoutLoads(workout(0, [lift('Barbell Bench Press', 3), lift('Incline Dumbbell Press', 2)]));
    expect(loads.chest).toBeCloseTo(5, 10);
    expect(loads.triceps).toBeCloseTo(2.5, 10);
  });

  it('counts logged sets even when the exercise was not marked finished', () => {
    expect(workoutLoads(workout(0, [{ ...lift('Barbell Curl', 2), done: false }])).biceps).toBeCloseTo(2, 10);
  });

  it('counts nothing for an exercise marked not done with no sets logged', () => {
    expect(workoutLoads(workout(0, [{ name: 'Barbell Curl', sets: 3, reps: 8, done: false, performed: [] }]))).toEqual({});
  });

  it('counts the planned sets, as unrated, for an exercise marked done with none logged', () => {
    const loads = workoutLoads(workout(0, [{ name: 'Barbell Curl', sets: 4, reps: 8, done: true, performed: [] }]));
    expect(loads.biceps).toBeCloseTo(2.4, 10);
  });

  it('counts three sets when a finished exercise does not say how many', () => {
    expect(workoutLoads(workout(0, [{ name: 'Barbell Curl', done: true }])).biceps).toBeCloseTo(1.8, 10);
    ['x', 0, -2, null, NaN].forEach((s) => expect(workoutLoads(workout(0, [{ name: 'Barbell Curl', sets: s, done: true }])).biceps).toBeCloseTo(1.8, 10));
  });

  it('counts a set with no rating, or one the app does not know, as moderate', () => {
    const exercise = { name: 'Barbell Curl', done: true, performed: [{ weight: 20, reps: 8 }, { weight: 20, reps: 8, rpe: 'brutal' }, { weight: 20, reps: 8, rpe: 4 }] };
    expect(workoutLoads(workout(0, [exercise])).biceps).toBeCloseTo(1.8, 10);
  });

  it('reads the rating in any case', () => {
    expect(workoutLoads(workout(0, [{ name: 'Barbell Curl', done: true, performed: [{ rpe: ' HARD ' }] }])).biceps).toBeCloseTo(1, 10);
  });

  it('reads a workout saved before sets were recorded from its planned sets', () => {
    const loads = workoutLoads(workout(0, [{ name: 'Barbell Bench Press', sets: 4, reps: 8 }]));
    expect(loads.chest).toBeCloseTo(2.4, 10);
  });

  it('scales an older partial workout by how much of it was finished', () => {
    const w = workout(0, [{ name: 'Barbell Bench Press', sets: 4, reps: 8 }], { partial: true, completed: false, exercisesCompleted: 1, totalExercises: 4 });
    expect(workoutLoads(w).chest).toBeCloseTo(0.6, 10);
  });

  it('does not scale a workout that records which exercises were done', () => {
    const w = workout(0, [{ name: 'Barbell Bench Press', sets: 4, reps: 8, done: true }], { partial: true, exercisesCompleted: 1, totalExercises: 4 });
    expect(workoutLoads(w).chest).toBeCloseTo(2.4, 10);
  });

  it('does not scale for a partial workout that does not say how much was finished', () => {
    expect(workoutLoads(workout(0, [{ name: 'Barbell Bench Press', sets: 4 }], { partial: true })).chest).toBeCloseTo(2.4, 10);
  });

  it('counts a program-day exercise that has no muscle tags, through the library', () => {
    const loads = workoutLoads(workout(0, [{ name: 'Squat', sets: 3, reps: '8-10' }, { name: 'Bench Press', sets: 3, reps: '8-10' }]));
    expect(loads.quadriceps).toBeCloseTo(1.8, 10);
    expect(loads.chest).toBeCloseTo(1.8, 10);
  });

  it('counts an exercise the library does not know through the tags the workout carries', () => {
    const loads = workoutLoads(workout(0, [{ name: 'Mystery Lift', sets: 4, muscleGroups: ['Pecs', 'delts'], done: true }]));
    expect(loads.chest).toBeCloseTo(2.4, 10);
    expect(loads.shoulders).toBeCloseTo(1.2, 10);
  });

  it('ignores an exercise that works no known muscle', () => {
    expect(workoutLoads(workout(0, [{ name: 'Mystery Lift', sets: 4, done: true }]))).toEqual({});
  });

  it('stops reading sets at a limit, so one typo cannot fill the scale', () => {
    const loads = workoutLoads(workout(0, [{ name: 'Barbell Curl', done: true, performed: sets(500) }]));
    expect(loads.biceps).toBe(RECOVERY_RULES.maxSetsPerExercise);
    expect(workoutLoads(workout(0, [{ name: 'Barbell Curl', sets: 900, done: true }])).biceps).toBeCloseTo(30 * 0.6, 10);
  });

  it('skips entries that are not sets or not exercises, and anything that is not a workout', () => {
    const w = workout(0, [null, 'x', 4, { name: 'Barbell Curl', done: true, performed: [null, 'x', { rpe: 'hard' }] }]);
    expect(workoutLoads(w).biceps).toBeCloseTo(1, 10);
    [null, undefined, 'x', 4, {}, { exercises: 'x' }, { exercises: null }].forEach((v) => expect(workoutLoads(v)).toEqual({}));
  });
});

describe('calculateMuscleRecovery on known sessions', () => {
  it('is {} with no history, and for anything that is not a list', () => {
    expect(calculateMuscleRecovery({ now: NOW })).toEqual({});
    expect(calculateMuscleRecovery()).toEqual({});
    expect(recovered([])).toEqual({});
    expect(recovered('x')).toEqual({});
    expect(calculateMuscleRecovery({ completedWorkouts: null, runs: 'x', completedHikes: 4, now: NOW })).toEqual({});
  });

  it('puts four hard bench sets at once at chest 67, shoulders 83 and triceps 83', () => {
    expect(recovered([workout(0, [lift('Barbell Bench Press', 4)])])).toEqual({ chest: 67, shoulders: 83, triceps: 83 });
  });

  it('clears the large chest more slowly than the small shoulders and triceps: a day later 76, 92, 92', () => {
    expect(recovered([workout(24, [lift('Barbell Bench Press', 4)])])).toEqual({ chest: 76, shoulders: 92, triceps: 92 });
  });

  it('has cleared it all after the time it takes (chest 82.7 hours, shoulders 48)', () => {
    expect(recovered([workout(47, [lift('Barbell Bench Press', 4)])])).toEqual({ chest: 86 });
    expect(recovered([workout(60, [lift('Barbell Bench Press', 4)])])).toEqual({ chest: 91 });
    expect(recovered([workout(83, [lift('Barbell Bench Press', 4)])])).toEqual({});
    expect(recovered([workout(100, [lift('Barbell Bench Press', 4)])])).toEqual({});
  });

  it('takes the most fatigued muscles to 0 after twelve hard back squat sets, and clears them over 7 days', () => {
    const squats = [lift('Barbell Back Squat', 12)];
    expect(recovered([workout(0, squats)])).toEqual({
      quadriceps: 0, glutes: 0, hamstrings: 50, adductors: 50, lower_back: 50, core: 50,
    });
    expect(recovered([workout(84, squats)])).toEqual({ quadriceps: 50, glutes: 50, hamstrings: 90, lower_back: 90 });
    expect(recovered([workout(167, squats)]).quadriceps).toBe(99);
    expect(recovered([workout(170, squats)])).toEqual({});
  });

  it('counts a muscle no further than the ceiling: twenty hard sets tire the quads and glutes no more than twelve, at once or later', () => {
    [0, 40, 100].forEach((h) => {
      const twenty = recovered([workout(h, [lift('Barbell Back Squat', 20)])]);
      const twelve = recovered([workout(h, [lift('Barbell Back Squat', 12)])]);
      expect([h, twenty.quadriceps, twenty.glutes]).toEqual([h, twelve.quadriceps, twelve.glutes]);
    });
    // the secondary muscles are below the ceiling at twelve sets (6 effective) and reach it at twenty-four (12)
    expect(recovered([workout(0, [lift('Barbell Back Squat', 12)])]).hamstrings).toBe(50);
    expect(recovered([workout(0, [lift('Barbell Back Squat', 24)])]).hamstrings).toBe(0);
  });

  it('leaves a light session nearly recovered: four easy curls leave the biceps at 90', () => {
    expect(recovered([workout(0, [lift('Barbell Curl', 4, 'easy')])]).biceps).toBe(90);
  });

  it('clears a small muscle in three quarters of the time: twelve hard curls are half cleared at 63 hours, a large muscle (squats) only a third by 56', () => {
    expect(recovered([workout(63, [lift('Barbell Curl', 12)])]).biceps).toBe(50);
    expect(recovered([workout(56, [lift('Barbell Back Squat', 12)])]).quadriceps).toBe(33);
  });

  it('adds two sessions, each clearing on its own clock: bench two days ago and yesterday leaves the chest at 62', () => {
    const bench = [lift('Barbell Bench Press', 4)];
    expect(recovered([workout(48, bench), workout(24, bench)]).chest).toBe(62);
  });

  it('never goes below 0 however much is piled on', () => {
    const heavy = Array.from({ length: 6 }, () => workout(1, [lift('Barbell Back Squat', 12)]));
    const result = recovered(heavy);
    expect(result.quadriceps).toBe(0);
    Object.values(result).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('counts a workout saved before sets were recorded by its planned sets: chest 80', () => {
    expect(recovered([workout(0, [{ name: 'Barbell Bench Press', sets: 4, reps: 8 }])]).chest).toBe(80);
  });

  it('counts a saved-and-left workout\'s quarter: chest 95', () => {
    const w = workout(0, [{ name: 'Barbell Bench Press', sets: 4, reps: 8 }], { partial: true, completed: false, exercisesCompleted: 1, totalExercises: 4 });
    expect(recovered([w]).chest).toBe(95);
  });

  it('counts a program-day session with no muscle tags (it counted for nothing before)', () => {
    const day = workout(0, [{ name: 'Squat', sets: 4, reps: '8-10' }, { name: 'Bench Press', sets: 4, reps: '8-10' }, { name: 'Bent-Over Row', sets: 4, reps: '8-10' }, { name: 'Plank', sets: 4, reps: '30s' }]);
    const result = recovered([day]);
    ['quadriceps', 'glutes', 'chest', 'upper_back', 'lats', 'core'].forEach((m) => expect(result[m]).toBeLessThan(100));
  });

  it('counts an AI exercise by its tags when the library does not know it: chest 80, shoulders 90', () => {
    const w = workout(0, [{ name: 'Mystery Lift', sets: 4, muscleGroups: ['Pecs', 'delts'], done: true }]);
    expect(recovered([w])).toEqual({ chest: 80, shoulders: 90 });
  });

  it('counts a one-hour run: quads 75, hamstrings 80, glutes 80, calves 84, core 91', () => {
    const run = { startTime: ago(1), endTime: ago(0), duration: 3600, calories: 600 };
    expect(calculateMuscleRecovery({ runs: [run], now: NOW })).toEqual({ quadriceps: 75, hamstrings: 80, glutes: 80, calves: 84, core: 91 });
  });

  it('counts a one-hour hike: quads 75, glutes 75, hamstrings 80, calves 80, core 90', () => {
    const hike = { completedAt: ago(0), durationSeconds: 3600, calories: 500 };
    expect(calculateMuscleRecovery({ completedHikes: [hike], now: NOW })).toEqual({ quadriceps: 75, glutes: 75, hamstrings: 80, calves: 80, core: 90 });
  });

  it('counts a run or hike by its end, falling back to its start; with no duration it counts for nothing', () => {
    const base = { duration: 3600, calories: 600 };
    expect(calculateMuscleRecovery({ runs: [{ ...base, startTime: ago(0) }], now: NOW }).quadriceps).toBe(75);
    expect(calculateMuscleRecovery({ runs: [{ ...base, startTime: ago(200), endTime: ago(0) }], now: NOW }).quadriceps).toBe(75);
    expect(calculateMuscleRecovery({ runs: [{ startTime: ago(0), calories: 600 }], now: NOW })).toEqual({});
    expect(calculateMuscleRecovery({ runs: [{ startTime: ago(0), duration: 0 }], now: NOW })).toEqual({});
    expect(calculateMuscleRecovery({ completedHikes: [{ completedAt: ago(0), calories: 500 }], now: NOW })).toEqual({});
  });

  it('adds a run to a lift on the same muscles', () => {
    const run = { endTime: ago(0), duration: 3600 };
    const lifted = recovered([workout(0, [lift('Barbell Back Squat', 4)])]).quadriceps;
    const both = calculateMuscleRecovery({ completedWorkouts: [workout(0, [lift('Barbell Back Squat', 4)])], runs: [run], now: NOW }).quadriceps;
    expect(both).toBe(42);
    expect(both).toBeLessThan(lifted);
  });

  it('lengthens the time when sleep was poor and shortens it when sleep was good: a day after bench, 74 and 78 against 76', () => {
    const w = [workout(24, [lift('Barbell Bench Press', 4)])];
    expect(recovered(w, { recovery: { sleepHours: 5, sleepQuality: 'poor' } }).chest).toBe(74);
    expect(recovered(w, { recovery: { sleepHours: 8, sleepQuality: 'good' } }).chest).toBe(78);
    expect(recovered(w, { recovery: undefined }).chest).toBe(76);
  });

  it('never lets a bad reading stretch the time past the floor the old map used', () => {
    const w = [workout(24, [lift('Barbell Bench Press', 4)])];
    const worst = recovered(w, { recovery: { recoveryScore: 0 } }).chest;
    expect(worst).toBeGreaterThanOrEqual(0);
    expect(worst).toBeLessThan(76);
  });

  it('ignores a workout dated in the future, or with no usable date', () => {
    const bench = [lift('Barbell Bench Press', 4)];
    expect(recovered([workout(-5, bench), { exercises: bench }, { completedAt: 'soon', exercises: bench }])).toEqual({});
  });

  it('reads a Firestore timestamp date when there is no completedAt', () => {
    const w = { date: { toDate: () => new Date(NOW.getTime()) }, exercises: [lift('Barbell Bench Press', 4)] };
    expect(recovered([w]).chest).toBe(67);
  });

  it('skips records that are not objects without throwing', () => {
    expect(() => calculateMuscleRecovery({ completedWorkouts: [null, 4, 'x', {}], runs: [null, 3], completedHikes: [undefined, 'x'], now: NOW })).not.toThrow();
  });

  it('uses the real clock when now is not a date', () => {
    const justNow = { completedAt: new Date().toISOString(), exercises: [lift('Barbell Bench Press', 4)] };
    expect(calculateMuscleRecovery({ completedWorkouts: [justNow], now: 'later' }).chest).toBeLessThanOrEqual(68);
    expect(calculateMuscleRecovery({ completedWorkouts: [justNow], now: new Date('x') }).chest).toBeLessThanOrEqual(68);
  });

  it('only ever answers with whole numbers from 0 to 99 for muscles on the list, however messy the history', () => {
    const history = [
      workout(1, [lift('Barbell Back Squat', 8), lift('Barbell Bench Press', 5)]),
      workout(30, [{ name: 'Mystery Lift', sets: 3, muscleGroups: ['back'], done: true }, { name: 'Pull-Up', sets: 3 }]),
      workout(70, [lift('Barbell Curl', 6, 'easy')]),
    ];
    const result = calculateMuscleRecovery({
      completedWorkouts: history, runs: [{ endTime: ago(12), duration: 2700 }], completedHikes: [{ completedAt: ago(40), durationSeconds: 7200 }], now: NOW,
    });
    expect(Object.keys(result).length).toBeGreaterThan(3);
    Object.entries(result).forEach(([muscle, value]) => {
      expect(MUSCLES).toContain(muscle);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(99);
    });
  });

  it('only ever gets better as time passes with nothing new done', () => {
    const history = [
      { at: 5, exercises: [lift('Barbell Back Squat', 10), lift('Barbell Bench Press', 6)] },
      { at: 40, exercises: [lift('Pull-Up', 6), lift('Barbell Curl', 6)] },
    ];
    let before = null;
    for (let wait = 0; wait <= 200; wait += 4) {
      const result = calculateMuscleRecovery({
        completedWorkouts: history.map((h) => workout(h.at + wait, h.exercises)),
        runs: [{ endTime: ago(10 + wait), duration: 3000 }],
        now: NOW,
      });
      if (before) Object.entries(before).forEach(([m, v]) => expect(result[m] === undefined ? 100 : result[m]).toBeGreaterThanOrEqual(v));
      before = result;
    }
    expect(before).toEqual({});
  });

  it('does not change the records it is given', () => {
    const history = [workout(3, [lift('Barbell Bench Press', 4)])];
    const copy = JSON.parse(JSON.stringify(history));
    recovered(history);
    expect(history).toEqual(copy);
  });
});

describe('fatigueFromRecovery', () => {
  it('turns recovered into tired, for the muscles that are not fully recovered', () => {
    expect(fatigueFromRecovery({ chest: 67, quadriceps: 0, upper_back: 100, biceps: 99 })).toEqual({ chest: 33, quadriceps: 100, biceps: 1 });
  });

  it('keeps only muscles on the list and numbers, and clamps what is out of range', () => {
    expect(fatigueFromRecovery({ chest: 130, lats: -20, forearms: 'x', nonsense: 40, glutes: NaN })).toEqual({ lats: 100 });
  });

  it('is {} for no recovery and for anything that is not an object', () => {
    expect(fatigueFromRecovery({})).toEqual({});
    [null, undefined, 'x', 4].forEach((v) => expect(fatigueFromRecovery(v)).toEqual({}));
  });

  it('round-trips the model\'s own answer: tired is 100 minus recovered', () => {
    const recovery = recovered([workout(2, [lift('Barbell Back Squat', 6)])]);
    const fatigue = fatigueFromRecovery(recovery);
    Object.keys(recovery).forEach((m) => expect(fatigue[m]).toBe(100 - recovery[m]));
  });
});

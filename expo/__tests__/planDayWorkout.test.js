// A day of the Recommended For You plan, made into a workout that can be opened and started (lib/planDayWorkout.js).
import fs from 'fs';
import path from 'path';
import {
  estimateDurationMinutes, calculateXpReward, dayHasExercises, planDayWorkoutId, workoutFromPlanDay,
} from '../lib/planDayWorkout';

const DAY = {
  day: 'Monday',
  focus: 'Upper Body Push',
  exercises: [
    { name: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 90 },
    { name: 'Overhead Press', sets: 3, reps: '8-10', restSeconds: 60 },
    { name: 'Plank', sets: 3, reps: '45 sec' }, // a plan does not always give a rest or every field
  ],
};

describe('the sums are the ones Quick Workout uses', () => {
  const quick = fs.readFileSync(path.join(__dirname, '..', 'app', 'workout', 'quick.jsx'), 'utf8');

  it('are written the same way in app/workout/quick.jsx, so a plan day and a Quick Workout of the same size earn the same', () => {
    expect(quick).toContain('const WORK_SECONDS_PER_SET = 30;');
    expect(quick).toContain('const sets = ex.sets || 1;');
    expect(quick).toContain('const rest = ex.restSeconds || 60;');
    expect(quick).toContain('return sum + sets * (WORK_SECONDS_PER_SET + rest);');
    expect(quick).toContain('return Math.max(5, Math.round(totalSeconds / 60));');
    expect(quick).toContain('const baseXp = 50;');
    expect(quick).toContain("const mult = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 1.5 : difficulty === 'advanced' ? 2 : 1;");
    expect(quick).toContain('return Math.round(baseXp * mult * Math.ceil(durationMinutes / 15));');
  });

  it('give the figures worked out by hand', () => {
    // 4 x (30 + 90) + 3 x (30 + 60) + 3 x (30 + 60 default) = 480 + 270 + 270 = 1020 s = 17 min
    expect(estimateDurationMinutes(DAY.exercises)).toBe(17);
    expect(estimateDurationMinutes([])).toBe(5); // never under five
    expect(estimateDurationMinutes(null)).toBe(5);
    expect(calculateXpReward('beginner', 17)).toBe(100); // 50 x 1 x 2
    expect(calculateXpReward('intermediate', 17)).toBe(150);
    expect(calculateXpReward('advanced', 17)).toBe(200);
    expect(calculateXpReward('something else', 17)).toBe(100);
  });
});

describe('dayHasExercises', () => {
  it('is true for a day with exercises and false for a rest day or a day with nothing in it', () => {
    expect(dayHasExercises(DAY)).toBe(true);
    expect(dayHasExercises({ day: 'Wednesday', focus: 'Rest and Recovery', exercises: [] })).toBe(false);
    expect(dayHasExercises({ day: 'Wednesday' })).toBe(false);
    expect(dayHasExercises({ exercises: null })).toBe(false);
    expect(dayHasExercises(null)).toBe(false);
  });
});

describe('planDayWorkoutId', () => {
  it('gives a day of a plan one fixed id', () => {
    expect(planDayWorkoutId('rec-1', 0)).toBe('plan-rec-1-d0');
    expect(planDayWorkoutId('rec-1', 0)).toBe(planDayWorkoutId('rec-1', 0));
    expect(planDayWorkoutId('rec-1', 3)).toBe('plan-rec-1-d3');
  });

  it('gives different plans, and different days, different ids', () => {
    expect(planDayWorkoutId('rec-1', 0)).not.toBe(planDayWorkoutId('rec-2', 0));
    expect(planDayWorkoutId('rec-1', 0)).not.toBe(planDayWorkoutId('rec-1', 1));
  });

  it('keeps only characters a Firestore document id can hold', () => {
    expect(planDayWorkoutId('a/b c.d', 1)).toBe('plan-abcd-d1');
  });

  it('is null when the plan has no id or the day is not a number, so the store makes its own', () => {
    expect(planDayWorkoutId('', 0)).toBeNull();
    expect(planDayWorkoutId(undefined, 0)).toBeNull();
    expect(planDayWorkoutId('///', 0)).toBeNull();
    expect(planDayWorkoutId('rec-1', -1)).toBeNull();
    expect(planDayWorkoutId('rec-1', 1.5)).toBeNull();
    expect(planDayWorkoutId('rec-1', 'x')).toBeNull();
  });
});

describe('workoutFromPlanDay', () => {
  const make = (over = {}) => workoutFromPlanDay(DAY, {
    name: 'Iron Hour', difficulty: 'beginner', goalLabel: 'Build Muscle', planId: 'rec-1', dayIndex: 0, ...over,
  });

  it('carries the made-up name the person tapped, the exercises, and the figures for the day', () => {
    const w = make();
    expect(w.id).toBe('plan-rec-1-d0');
    expect(w.name).toBe('Iron Hour');
    expect(w.category).toBe('Build Muscle');
    expect(w.difficulty).toBe('beginner');
    expect(w.duration).toBe(17);
    expect(w.xpReward).toBe(100);
    expect(w.source).toBe('ai_plan_day');
    expect(w.exercises.map((e) => e.name)).toEqual(['Bench Press', 'Overhead Press', 'Plank']);
    expect(w.exercises[0]).toEqual({ name: 'Bench Press', sets: 4, reps: '6-8', restSeconds: 90 });
    expect(w.description).toMatch(/17-minute workout from your plan \(Monday\), focused on build muscle, built for your beginner fitness level/);
  });

  it('leaves out a field the plan did not give, because Firestore refuses a field that is undefined', () => {
    const plank = make().exercises[2];
    expect(plank).toEqual({ name: 'Plank', sets: 3, reps: '45 sec' });
    expect('restSeconds' in plank).toBe(false);
    const hasUndefined = (v) => v === undefined || (v && typeof v === 'object' && Object.values(v).some(hasUndefined));
    expect(hasUndefined(make())).toBe(false);
  });

  it('has no id when the plan has none', () => {
    expect('id' in make({ planId: '' })).toBe(false);
  });

  it('falls back to the day\'s focus for a name, and to sensible words for the rest', () => {
    const w = workoutFromPlanDay(DAY, { planId: 'rec-1', dayIndex: 0 });
    expect(w.name).toBe('Upper Body Push');
    expect(w.difficulty).toBe('intermediate');
    expect(w.category).toBe('General Fitness');
    expect(workoutFromPlanDay({ exercises: [{ name: 'Plank' }] }, {}).name).toBe('Workout');
  });
});

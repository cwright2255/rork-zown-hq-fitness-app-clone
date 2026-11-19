// lib/planDayWorkout.js
//
// A day of the Recommended For You plan, made into a workout that can be opened and started (app/workouts.jsx). It is the same thing
// Quick Workout does with day one of a plan (app/workout/quick.jsx): save the day as a workout, then open the workout screen, which already
// has Start. The duration and XP formulas below are the ones Quick Workout uses, so a plan day and a Quick Workout of the same size earn
// the same.
//
// Each day of a plan gets one fixed id, so tapping the same day again opens the workout it already made instead of saving another copy.

const WORK_SECONDS_PER_SET = 30;

/** About how long the day takes: the sets, 30 s of work each, and the rest between them (a plan gives reps, not times). */
export function estimateDurationMinutes(exercises) {
  const totalSeconds = (exercises || []).reduce((sum, ex) => {
    const sets = ex.sets || 1;
    const rest = ex.restSeconds || 60;
    return sum + sets * (WORK_SECONDS_PER_SET + rest);
  }, 0);
  return Math.max(5, Math.round(totalSeconds / 60));
}

export function calculateXpReward(difficulty, durationMinutes) {
  const baseXp = 50;
  const mult = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 1.5 : difficulty === 'advanced' ? 2 : 1;
  return Math.round(baseXp * mult * Math.ceil(durationMinutes / 15));
}

/** Whether the day has anything to do: a rest day has no exercises, so there is nothing to open. */
export function dayHasExercises(day) {
  return Array.isArray(day?.exercises) && day.exercises.length > 0;
}

/** The one id a plan's day is saved under, or null when the plan has no usable id (then the store makes one, and a second tap saves another copy). */
export function planDayWorkoutId(planId, dayIndex) {
  const safe = String(planId ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  return safe && Number.isInteger(dayIndex) && dayIndex >= 0 ? `plan-${safe}-d${dayIndex}` : null;
}

// Firestore refuses a field that is undefined, and a plan's exercise does not always have every field.
function present(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

/** The workout to save for a day of the plan. `name` is the day's made-up name from the tab, so the workout carries the name the person tapped. */
export function workoutFromPlanDay(day, { name, difficulty = 'intermediate', goalLabel = 'General Fitness', planId, dayIndex } = {}) {
  const exercises = day.exercises.map((ex) => present({ name: ex.name, sets: ex.sets, reps: ex.reps, restSeconds: ex.restSeconds }));
  const duration = estimateDurationMinutes(day.exercises);
  const id = planDayWorkoutId(planId, dayIndex);
  return {
    ...(id ? { id } : {}),
    name: name || day.focus || 'Workout',
    description: `A ${duration}-minute workout from your plan (${day.day || 'one day'}), focused on ${goalLabel.toLowerCase()}, built for your ${difficulty} fitness level.`,
    category: goalLabel,
    difficulty,
    duration,
    xpReward: calculateXpReward(difficulty, duration),
    exercises,
    source: 'ai_plan_day',
  };
}

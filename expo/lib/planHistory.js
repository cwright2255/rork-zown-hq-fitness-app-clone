// The recent workouts that go with a request for a plan (store/workoutStore.js generateNewWorkoutRecommendation).
//
// A workout's name is a made-up one now ("Quad Squad", lib/workoutNames.js), which says nothing about what it trained, so each workout goes with the
// muscles it worked. The server puts the history in the AI's prompt exactly as it is received (functions/src/index.js), so nothing there has to change.

export const PLAN_HISTORY_WORKOUTS = 10;
export const PLAN_HISTORY_MUSCLES = 6;

/** The muscles a workout worked, once each, in the order its exercises list them: at most PLAN_HISTORY_MUSCLES of them. */
export function musclesOfWorkout(workout) {
  const exercises = workout && Array.isArray(workout.exercises) ? workout.exercises : [];
  const seen = new Set();
  exercises.forEach((x) => {
    if (x && Array.isArray(x.muscleGroups)) x.muscleGroups.forEach((m) => { if (typeof m === 'string' && m !== '') seen.add(m); });
  });
  return [...seen].slice(0, PLAN_HISTORY_MUSCLES);
}

/** The newest workouts (the list is newest first) as { name, category, completedAt }, with `muscles` when the workout says what it worked. */
export function historyForPlan(workouts) {
  const list = Array.isArray(workouts) ? workouts : [];
  return list.filter((w) => w && typeof w === 'object').slice(0, PLAN_HISTORY_WORKOUTS).map((w) => {
    const muscles = musclesOfWorkout(w);
    return { name: w.name, category: w.category, completedAt: w.completedAt, ...(muscles.length > 0 ? { muscles } : {}) };
  });
}

// lib/firstWorkout.js
//
// Whether the workout being finished is the first one this person has ever finished all the way. Used for the first_workout_completed
// analytics event (app/workout/active.jsx). `history` is the workouts already saved, not counting the one being finished.
//
// A workout saved part-way ("Save and exit" with exercises left, marked partial or not completed) is in the history but was not
// finished, so it does not make the next one a second workout.
export function isFirstFinishedWorkout(history) {
  const saved = Array.isArray(history) ? history : [];
  return !saved.some((workout) => workout && !workout.partial && workout.completed !== false);
}

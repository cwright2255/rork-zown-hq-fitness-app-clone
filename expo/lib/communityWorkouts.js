// lib/communityWorkouts.js
//
// Community Workouts on the Workouts tab (app/workouts.jsx): the pre-made workouts in data/communityWorkouts.js, shown as cards, and what a tap
// saves. A tapped one is saved to My Workouts and opened the same way a day of the Recommended For You plan is (lib/planDayWorkout.js): the
// same fields, the same length and XP formulas, and one fixed id per workout, so tapping the same card again opens the copy that is already
// there instead of saving another.
import { COMMUNITY_WORKOUTS, COMMUNITY_CATEGORIES } from '../data/communityWorkouts';
import { estimateDurationMinutes, calculateXpReward } from './planDayWorkout';

/** The one id a community workout is saved under. */
export function communityWorkoutId(slug) {
  return `community-${slug}`;
}

/** The workouts to show for a choice: every one for 'All' (or anything that is not a category), otherwise the ones in that category, in the order they are written. */
export function communityWorkoutsFor(category) {
  return category && COMMUNITY_CATEGORIES.includes(category)
    ? COMMUNITY_WORKOUTS.filter((w) => w.category === category)
    : COMMUNITY_WORKOUTS;
}

/** About how long it takes, in minutes: the sets, 30 s of work each, and the rest between them. */
export function communityWorkoutMinutes(workout) {
  return estimateDurationMinutes(workout.exercises);
}

/** "Beginner", "Intermediate", "Advanced". */
export function levelLabel(difficulty) {
  return difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : '';
}

/** The workout to save when a card is tapped. Same shape as a plan day's (lib/planDayWorkout.js), so the workout screen opens it the same way. */
export function workoutFromCommunity(workout) {
  const duration = communityWorkoutMinutes(workout);
  return {
    id: communityWorkoutId(workout.slug),
    name: workout.name,
    description: workout.description,
    category: workout.category,
    difficulty: workout.difficulty,
    duration,
    xpReward: calculateXpReward(workout.difficulty, duration),
    exercises: workout.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, restSeconds: e.restSeconds })),
    source: 'community',
  };
}

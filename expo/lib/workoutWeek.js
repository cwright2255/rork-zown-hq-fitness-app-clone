// lib/workoutWeek.js
//
// "This Week" on the Workouts tab: the workouts finished since this week began. A week begins on Monday at midnight (local time), the same
// week the run leaderboard and the meal plan use (lib/runLeaderboard.js, lib/mealPlan.js).
//
// It used to be "the last 7 days". That is a different number from what the label says: on a Wednesday it counted back to last Wednesday,
// so it ran higher than the week a person can see on their calendar, and it never started again on Monday.

/** Monday 00:00 (local time) of the week a moment falls in. */
export function startOfWeek(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** How many of these workouts were finished since this week began. One with no readable date is not counted. */
export function workoutsThisWeek(workouts, now = new Date()) {
  const from = startOfWeek(now).getTime();
  return (workouts || []).filter((w) => {
    const t = new Date(w?.completedAt || w?.timestamp).getTime();
    return Number.isFinite(t) && t >= from;
  }).length;
}

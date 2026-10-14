// services/streakService.js
//
// The person's streak: days in a row on which they did a workout, a run or a hike. It is worked out from the
// records themselves (lib/activity.js), never kept as a counter. The counter this replaces (user.streak, set by
// userStore.updateStreak) was never updated by anything, so the Profile, the Battle Pass, the achievements and the
// leaderboard all showed 0 whatever the person had done.
import { useMemo } from 'react';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { activeDays, activityStreak, sessionsOf } from '../lib/activity';
import { localDateKey } from '../lib/localDate';

/** The streak right now, read from the stores: { current, longest }. For code that is not a component. */
export function getActivityStreak() {
  const sessions = sessionsOf({
    workouts: useWorkoutStore.getState().completedWorkouts,
    runs: useRunningStore.getState().runs,
    hikes: useHikingStore.getState().completedHikes,
  });
  return activityStreak(sessions);
}

/** The same for a screen: { current, longest }, worked out again when a record arrives or the day changes. */
export function useActivityStreak() {
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const runs = useRunningStore((s) => s.runs);
  const hikes = useHikingStore((s) => s.completedHikes);
  const today = localDateKey();
  return useMemo(() => activityStreak(sessionsOf({ workouts, runs, hikes }), today), [workouts, runs, hikes, today]);
}

/** The calendar days with a workout, a run or a hike, oldest first ("YYYY-MM-DD"): what the streak calendar colours in. */
export function useActivityDays() {
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const runs = useRunningStore((s) => s.runs);
  const hikes = useHikingStore((s) => s.completedHikes);
  return useMemo(() => activeDays(sessionsOf({ workouts, runs, hikes })), [workouts, runs, hikes]);
}

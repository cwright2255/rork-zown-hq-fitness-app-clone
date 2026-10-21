import React from 'react';
import { router } from 'expo-router';
import LogPagerCard from './LogPagerCard';
import { useWorkoutStore } from '@/store/workoutStore';
import { useLifetimeStore } from '@/store/lifetimeStore';
import { workoutHistorySummary } from '@/lib/logWidgetData';

// Home > Workout History: workouts, calories and time for the last 7 days, this month and everything logged (swipe between them), the
// latest workout, and a View Full Log button that opens Workout History. The pages use the same filters as that screen.
export default function WorkoutHistoryWidget() {
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const lifetime = useLifetimeStore((s) => s.totals);
  const summary = workoutHistorySummary({ workouts, lifetime });
  return (
    <LogPagerCard
      testID="home-widget-workouthistory"
      icon="barbell-outline"
      label="Workout History"
      pages={summary.pages}
      latest={summary.latest}
      empty={summary.empty}
      emptyText="No workouts yet. Finish one and it shows up here."
      accessibilityLabel={summary.sentence}
      onOpen={() => router.push('/profile/workout-history')}
    />
  );
}

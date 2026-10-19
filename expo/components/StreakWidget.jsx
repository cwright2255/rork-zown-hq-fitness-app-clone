import React from 'react';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import StreakCalendar from './StreakCalendar';
import { useActivityDays, useActivityStreak } from '@/services/streakService';
import { streakCaption, streakSentence } from '@/lib/homeWidgetData';

// Home > Workout Streak: the days in a row with a workout, a run or a hike (the same count as Streak on the Profile) and the
// last 7 days as dots. A tap opens the Streak Calendar. It is the workout streak: the Calories and Steps cards keep their own
// counts of days in a row you reached your burn goal or your steps goal.
export default function StreakWidget() {
  const { current } = useActivityStreak();
  const days = useActivityDays();
  return (
    <HomeWidgetCard
      testID="home-widget-streak"
      label="Workout Streak"
      icon="flash-outline"
      value={String(current)}
      caption={streakCaption(current)}
      accessibilityLabel={`Workout streak: ${streakSentence(current)}. Opens the streak calendar.`}
      onPress={() => router.push('/profile/streak')}
    >
      <StreakCalendar compact days={days} />
    </HomeWidgetCard>
  );
}

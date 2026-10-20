import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useHealthStore } from '@/store/healthStore';
import { buildMissions } from '@/lib/battlePassMissions';
import { battlePassSummary } from '@/lib/homeWidgetData';
import { localDateKey } from '@/lib/localDate';

// Home > Battle Pass: the level, how far through it the XP bar is, and how many of today's three missions are done. The XP is the
// server's record (store/expStore.js follows it) and the missions are the Battle Pass screen's own (lib/battlePassMissions.js), so
// this card and that screen show the same thing. A tap opens the Battle Pass.
export default function BattlePassWidget() {
  const expSystem = useExpStore((s) => s.expSystem);
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const runs = useRunningStore((s) => s.runs);
  const hikes = useHikingStore((s) => s.completedHikes);
  const meals = useNutritionStore((s) => s.meals);
  const steps = useHealthStore((s) => s.steps);
  const stepsDate = useHealthStore((s) => s.stepsDate);
  const today = localDateKey();

  const summary = useMemo(() => {
    const now = new Date();
    const todayKey = localDateKey(now);
    const { daily } = buildMissions({
      completedWorkouts: workouts,
      runs,
      completedHikes: hikes,
      steps,
      stepsDate,
      mealsToday: (Array.isArray(meals) ? meals : []).filter((m) => m && m.date === todayKey),
      now,
    });
    return battlePassSummary({ level: expSystem?.level, totalExp: expSystem?.totalExp, dailyMissions: daily });
  }, [expSystem, workouts, runs, hikes, meals, steps, stepsDate, today]);

  return (
    <HomeWidgetCard
      testID="home-widget-battlepass"
      label="Battle Pass"
      icon="ribbon-outline"
      value={summary.value}
      caption={summary.caption}
      accessibilityLabel={`${summary.sentence}. Opens the Battle Pass.`}
      onPress={() => router.push('/battlepass')}
    >
      <View style={s.track}>
        <View testID="home-battlepass-bar" style={[s.fill, { width: `${summary.pct}%` }]} />
      </View>
    </HomeWidgetCard>
  );
}

const s = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', overflow: 'hidden', marginTop: 6 },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#000' },
});

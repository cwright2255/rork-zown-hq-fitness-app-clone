import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { useHealthStore } from '@/store/healthStore';
import { fatigueToColor } from '@/lib/muscleFatigue';
import { calculateMuscleRecovery, fatigueFromRecovery } from '@/lib/muscleRecovery';
import { musclesSentence, recoveryInputs, topMuscles } from '@/lib/homeWidgetData';
import { localDateKey } from '@/lib/localDate';

// Home > Muscles: the three muscles that are least recovered (lib/muscleRecovery.js), each with the colour the Health screen's Muscle
// Fatigue heatmap gives it. The scale is absolute: nothing shows when every muscle is recovered. A tap opens the Health screen, where
// the full heatmap is.
export default function MusclesWidget() {
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const runs = useRunningStore((s) => s.runs);
  const hikes = useHikingStore((s) => s.completedHikes);
  const rookRecovery = useHealthStore((s) => s.rookRecovery);
  const sleep = useHealthStore((s) => s.sleep);
  const today = localDateKey();

  const top = useMemo(() => {
    const recovery = calculateMuscleRecovery({
      completedWorkouts: workouts,
      runs,
      completedHikes: hikes,
      recovery: recoveryInputs(rookRecovery, sleep),
    });
    return topMuscles(fatigueFromRecovery(recovery), 3);
  }, [workouts, runs, hikes, rookRecovery, sleep, today]);

  return (
    <HomeWidgetCard
      testID="home-widget-muscles"
      label="Muscles"
      icon="body-outline"
      caption="Still recovering"
      accessibilityLabel={`${musclesSentence(top)}. Opens Health.`}
      onPress={() => router.push('/health')}
    >
      {top.length === 0 ? (
        <Text style={s.empty} testID="home-muscles-empty">No recent load</Text>
      ) : (
        <View>
          {top.map((m) => (
            <View key={m.muscle} style={s.row} testID={`home-muscle-${m.muscle}`}>
              <View style={[s.dot, { backgroundColor: fatigueToColor(m.intensity) }]} />
              <Text style={s.name} numberOfLines={1}>{m.label}</Text>
            </View>
          ))}
        </View>
      )}
    </HomeWidgetCard>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name: { fontSize: 14, fontWeight: '700', color: '#000', flexShrink: 1 },
  empty: { fontSize: 14, fontWeight: '700', color: '#999' },
});

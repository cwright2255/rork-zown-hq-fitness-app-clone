import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import { ZONE_COLOR } from './TrainingLoadCard';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { aggregateDailyLoad, calculateTrainingLoad } from '@/lib/trainingLoad';
import { trainingLoadSummary } from '@/lib/homeWidgetData';
import { localDateKey } from '@/lib/localDate';

// Home > Training Load: the same acute-to-chronic reading as the Training Load card on the Health screen (lib/trainingLoad.js), as
// one number, a few words and a small marker on the same scale. A tap opens the Health screen, where the full card is.
export default function TrainingLoadWidget() {
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const runs = useRunningStore((s) => s.runs);
  const hikes = useHikingStore((s) => s.completedHikes);
  const today = localDateKey();

  const summary = useMemo(() => {
    const load = calculateTrainingLoad(aggregateDailyLoad({ completedWorkouts: workouts, runs, completedHikes: hikes }));
    return trainingLoadSummary(load);
  }, [workouts, runs, hikes, today]);
  const color = ZONE_COLOR[summary.zone];

  return (
    <HomeWidgetCard
      testID="home-widget-trainingload"
      label="Training Load"
      icon="speedometer-outline"
      value={summary.value}
      caption={summary.caption}
      accessibilityLabel={`${summary.sentence}. Opens Health.`}
      onPress={() => router.push('/health')}
    >
      <View style={s.track}>
        <View testID="home-trainingload-band" style={s.band} />
        {summary.markerPct !== null && (
          <View testID="home-trainingload-marker" style={[s.marker, { left: `${summary.markerPct}%`, backgroundColor: color }]} />
        )}
      </View>
    </HomeWidgetCard>
  );
}

// The same bar as the Health card: 0 to 2 along it, the usual range (0.8 to 1.3) shaded, a dot at the reading.
const s = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', marginTop: 8, marginBottom: 2, position: 'relative' },
  band: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: 'rgba(34,197,94,0.3)', left: '40%', width: '25%' },
  marker: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, marginLeft: -6 },
});

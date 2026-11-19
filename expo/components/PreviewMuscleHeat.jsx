// components/PreviewMuscleHeat.jsx
//
// The "Muscles You'll Work" heat figure for a workout's preview screen, the same card the trail preview shows: the person's own 3D body scan
// painted blue to red by how hard each muscle is worked. A strength preview passes its exercises and the heat comes from them; a running
// preview passes `running`. A strength list with nothing to work out (no exercise the app knows a muscle for) shows nothing rather than an
// empty card. How the heat is worked out: lib/workoutMuscleHeat.js.
import React, { useMemo } from 'react';
import { View } from 'react-native';
import MuscleHeatmapCard from '@/components/MuscleHeatmapCard';
import { useLatestBodyScan } from '@/hooks/useLatestBodyScan';
import { strengthMuscleHeat, runningMuscleHeat } from '@/lib/workoutMuscleHeat';
import { spacing } from '@/constants/theme';

export default function PreviewMuscleHeat({ exercises, running = false, title = "Muscles You'll Work", style }) {
  const { scan, retry } = useLatestBodyScan();
  // Worked out on every render (it is a few lines of arithmetic), but handed to the figure as the same objects for as long as the
  // answer is the same, so a screen that builds its exercise list fresh each time does not make the 3D figure start over.
  const latest = running ? runningMuscleHeat() : strengthMuscleHeat(exercises);
  const heat = useMemo(() => latest, [JSON.stringify(latest)]);

  if (heat.targetMuscles.length === 0) return null;
  return (
    <View style={[{ marginTop: spacing.md }, style]} testID="preview-muscle-heat">
      <MuscleHeatmapCard
        mode="target"
        targetMuscles={heat.targetMuscles}
        muscleIntensities={heat.muscleIntensities}
        title={title}
        scan={scan}
        onRetryScan={retry}
      />
    </View>
  );
}

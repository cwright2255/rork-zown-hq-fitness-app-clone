// components/MuscleHeatmapCard.jsx
//
// Real anatomical muscle visualization in two modes, toggleable:
//   - "Target": which muscles a specific activity works (a fixed
//     highlight, one color) — used on activity preview screens, before
//     you've done it.
//   - "Fatigue": real per-muscle recent load, decayed on the real DOMS
//     recovery timeline (see lib/muscleFatigue.js) — a heatmap, colored
//     by actual recent activity, not a static highlight.
// Both modes render as real 3D coloring on the user's own body-scan mesh
// (components/MuscleMeshHighlight.jsx, lib/muscleAnchors.js's
// computeVertexColors) when a scan is available - fatigue mode feeds it
// fatigueByMuscle's own real intensities instead of target mode's
// targetMuscles/muscleIntensities, through the same code path. Both fall
// back to the 2D diagram service (services/muscleVisualizerService.js,
// fixed this session after finding it had never actually worked - wrong
// base path, wrong auth method, wrong muscle-name casing, see the audit)
// when no scan is provided, so callers without scan data still get a
// working visualization.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Pressable } from 'react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { getWorkoutVisualizeImage, getHeatmapVisualizeImage } from '@/services/muscleVisualizerService';
import { fatigueToColor } from '@/lib/muscleFatigue';
import MuscleMeshHighlight from '@/components/MuscleMeshHighlight';

/**
 * @param {{
 *   mode: 'target' | 'fatigue' | 'both',
 *   targetMuscles?: string[],
 *   secondaryMuscles?: string[],
 *   fatigueByMuscle?: Record<string, number>,
 *   title?: string,
 *   scan?: object,
 *   onRetryScan?: () => void,
 * }} props
 */
export default function MuscleHeatmapCard({
  mode = 'target',
  targetMuscles = [],
  secondaryMuscles = [],
  fatigueByMuscle = {},
  title = 'Muscles Worked',
  scan = null,
  onRetryScan = null,
  muscleIntensities = null,
}) {
  const [activeMode, setActiveMode] = useState(mode === 'both' ? 'target' : mode);
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Real fix: previously hardcoded to target mode only, so fatigue mode
  // always fell through to the 2D diagram service even when a real scan
  // existed - the exact gap this file's own header comment used to flag
  // as a separate follow-up, not built in that pass. Fatigue intensities
  // (lib/muscleFatigue.js's calculateMuscleFatigue, already 0-100
  // normalized) feed the identical computeVertexColors path target mode
  // already uses - just with fatigueByMuscle's own muscle names and
  // intensities instead of targetMuscles/muscleIntensities.
  const use3D = !!scan && (activeMode === 'target' || activeMode === 'fatigue');
  const fatigueMuscleNames = Object.keys(fatigueByMuscle).filter((m) => fatigueByMuscle[m] > 0);
  const mesh3DMuscleNames = activeMode === 'fatigue' ? fatigueMuscleNames : targetMuscles;
  const mesh3DIntensities = activeMode === 'fatigue' ? fatigueByMuscle : muscleIntensities;

  useEffect(() => {
    if (use3D) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    const load = async () => {
      let uri = null;
      if (activeMode === 'target') {
        if (targetMuscles.length === 0) {
          setLoading(false);
          return;
        }
        uri = await getWorkoutVisualizeImage({ targetMuscles, secondaryMuscles });
      } else {
        const entries = Object.entries(fatigueByMuscle).filter(([, v]) => v > 0);
        if (entries.length === 0) {
          setLoading(false);
          return;
        }
        const muscleColors = entries.map(([muscle, intensity]) => ({ muscle, color: fatigueToColor(intensity) }));
        uri = await getHeatmapVisualizeImage({ muscleColors });
      }
      if (!cancelled) {
        setImageUri(uri);
        setFailed(!uri);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [use3D, activeMode, targetMuscles.join(','), JSON.stringify(fatigueByMuscle)]);

  const hasDataForMode = activeMode === 'target' ? targetMuscles.length > 0 : Object.values(fatigueByMuscle).some((v) => v > 0);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {mode === 'both' && (
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleBtn, activeMode === 'target' && styles.toggleBtnActive]}
              onPress={() => setActiveMode('target')}
            >
              <Text style={[styles.toggleText, activeMode === 'target' && styles.toggleTextActive]}>Target</Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, activeMode === 'fatigue' && styles.toggleBtnActive]}
              onPress={() => setActiveMode('fatigue')}
            >
              <Text style={[styles.toggleText, activeMode === 'fatigue' && styles.toggleTextActive]}>Fatigue</Text>
            </Pressable>
          </View>
        )}
      </View>

      {use3D ? (
        !hasDataForMode ? (
          <View style={styles.imageWrap}>
            <Text style={styles.emptyText}>
              {activeMode === 'fatigue' ? 'Not enough recent activity to show fatigue yet.' : 'No muscle data for this activity yet.'}
            </Text>
          </View>
        ) : (
          <MuscleMeshHighlight scan={scan} muscleNames={mesh3DMuscleNames} muscleIntensities={mesh3DIntensities} height={280} onRetry={onRetryScan} />
        )
      ) : (
        <View style={styles.imageWrap}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : !hasDataForMode ? (
            <Text style={styles.emptyText}>
              {activeMode === 'target' ? 'No muscle data for this activity yet.' : 'Not enough recent activity to show fatigue yet.'}
            </Text>
          ) : failed ? (
            <Text style={styles.emptyText}>Muscle diagram unavailable right now.</Text>
          ) : (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          )}
        </View>
      )}

      {activeMode === 'fatigue' && hasDataForMode && !use3D && (
        <View style={styles.legendRow}>
          <LegendDot color="#3B82F6" label="Fresh" />
          <LegendDot color="#22C55E" label="Light" />
          <LegendDot color="#F59E0B" label="Moderate" />
          <LegendDot color="#DC2626" label="High" />
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.base },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { ...typography.h4, color: colors.text },
  toggleRow: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 2 },
  toggleBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: radius.pill },
  toggleBtnActive: { backgroundColor: colors.text },
  toggleText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: colors.bg },
  imageWrap: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  image: { width: 160, height: 200 },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.md },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...typography.caption, color: colors.textSecondary },
});

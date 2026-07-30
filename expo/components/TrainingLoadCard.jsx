// components/TrainingLoadCard.jsx
//
// The one thing genuinely nobody else can build well: Strava only sees
// runs/rides, AllTrails only sees hikes — Zown has real completed
// workouts, runs, AND hikes in one place. This surfaces that as a real
// acute:chronic training load reading (lib/trainingLoad.js), not a
// vague "how are you feeling" prompt.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/constants/theme';

const ZONE_COLOR = {
  detraining: '#3B82F6',
  sweet_spot: '#22C55E',
  elevated: '#D97706',
  high: '#DC2626',
  insufficient_data: colors.textSecondary,
};

const ZONE_ICON = {
  detraining: 'trending-down-outline',
  sweet_spot: 'checkmark-circle-outline',
  elevated: 'alert-circle-outline',
  high: 'warning-outline',
  insufficient_data: 'time-outline',
};

export default function TrainingLoadCard({ trainingLoad, aiInsight }) {
  if (!trainingLoad) return null;
  const color = ZONE_COLOR[trainingLoad.zone];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name={ZONE_ICON[trainingLoad.zone]} size={20} color={color} />
        <Text style={styles.title}>Training Load</Text>
      </View>

      {trainingLoad.zone === 'insufficient_data' ? (
        <Text style={styles.insufficientText}>
          Keep logging workouts, runs, and hikes — this needs about a week of history to give a real reading.
        </Text>
      ) : (
        <>
          <View style={styles.ratioRow}>
            <Text style={[styles.ratioValue, { color }]}>{trainingLoad.ratio.toFixed(2)}</Text>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.zoneLabel, { color }]}>{trainingLoad.zoneLabel}</Text>
              <Text style={styles.subText}>
                {trainingLoad.acuteLoad} kcal this week vs. {trainingLoad.chronicWeeklyAvg} kcal your usual week
              </Text>
            </View>
          </View>

          {/* Simple visual bar: sweet spot band 0.8-1.3, marker at the
              real ratio value. Range shown is 0-2.0+, clamped. */}
          <View style={styles.barTrack}>
            <View style={[styles.sweetSpotBand, { left: '40%', width: '25%' }]} />
            <View style={[styles.marker, { left: `${Math.min(100, (trainingLoad.ratio / 2) * 100)}%`, backgroundColor: color }]} />
          </View>

          {aiInsight && <Text style={styles.aiInsightText}>{aiInsight}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.base, marginHorizontal: spacing.base, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  title: { ...typography.h4, color: colors.text },
  insufficientText: { ...typography.bodySmall, color: colors.textSecondary },
  ratioRow: { flexDirection: 'row', alignItems: 'center' },
  ratioValue: { fontSize: 32, fontWeight: '800' },
  zoneLabel: { fontSize: 14, fontWeight: '700' },
  subText: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  barTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: spacing.md, position: 'relative' },
  sweetSpotBand: { position: 'absolute', height: 6, backgroundColor: 'rgba(34,197,94,0.3)', borderRadius: 3 },
  marker: { position: 'absolute', top: -3, width: 12, height: 12, borderRadius: 6, marginLeft: -6 },
  aiInsightText: { ...typography.bodySmall, color: colors.text, marginTop: spacing.md, fontStyle: 'italic' },
});

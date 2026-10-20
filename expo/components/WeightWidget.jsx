import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import HomeWidgetCard from './HomeWidgetCard';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useWeightLogStore } from '@/store/weightLogStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { weightSummary } from '@/lib/macroWeightData';

// Home > Weight: the latest logged weight, how far it has moved since the first log, how far it is from the target, and the body fat of
// the latest body scan. It follows Settings > Weight Units. It only reads: it never logs a weight or runs a scan (the Progress screen
// does those). `refreshTick` goes up each time Home is pulled down to refresh. A tap opens Progress.
export default function WeightWidget({ refreshTick = 0 }) {
  const uid = useUserStore((s) => s.user?.uid);
  const targetKg = useUserStore((s) => s.user?.targetWeightKg);
  const pounds = useSettingsStore((s) => s.weightUnits) !== 'metric';
  const logs = useWeightLogStore((s) => s.logs);
  const scans = useBodyCompositionStore((s) => s.scans);

  // Both loads do nothing without a signed-in person.
  useEffect(() => {
    useWeightLogStore.getState().loadLogs(uid);
    useBodyCompositionStore.getState().loadScans(uid);
  }, [uid, refreshTick]);

  const summary = useMemo(() => weightSummary({ logs, scans, pounds, targetKg }), [logs, scans, pounds, targetKg]);

  return (
    <HomeWidgetCard
      testID="home-widget-weight"
      label="Weight"
      icon="scale-outline"
      value={summary.value}
      caption={summary.caption}
      accessibilityLabel={`${summary.sentence}. Opens Progress.`}
      onPress={() => router.push('/progress')}
    >
      <View>
        {summary.change && (
          <Text style={s.change} numberOfLines={1} testID="home-weight-change">{summary.change.text}</Text>
        )}
        {summary.bodyFat && (
          <View style={s.fatRow} testID="home-weight-bodyfat">
            <Text style={s.fatLabel} numberOfLines={1}>Body fat</Text>
            <Text style={s.fatValue} numberOfLines={1} testID="home-weight-bodyfat-text">
              {summary.bodyFat.change ? `${summary.bodyFat.text} ${summary.bodyFat.change}` : summary.bodyFat.text}
            </Text>
          </View>
        )}
      </View>
    </HomeWidgetCard>
  );
}

const s = StyleSheet.create({
  change: { fontSize: 12, fontWeight: '600', color: '#666' },
  fatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  fatLabel: { fontSize: 12, fontWeight: '600', color: '#333', flexShrink: 1, marginRight: 6 },
  fatValue: { fontSize: 12, fontWeight: '700', color: '#000' },
});

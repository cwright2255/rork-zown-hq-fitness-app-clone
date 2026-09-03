// app/body-scan/compare.jsx
//
// Full side-by-side (stacked) scan comparison: two interactive, fully
// rotatable mesh viewers (ScanMeshViewer.jsx) plus real measurement
// deltas below. Reached from the "Open Full Comparison" button on the
// Progress tab's inline comparison card (which uses the smaller, static
// ScanMeshPreview.jsx instead - see that file for why a live-rotating
// mesh doesn't work embedded in a shared ScrollView).
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import ScanMeshViewer from '@/components/ScanMeshViewer';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useUserStore } from '@/store/userStore';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function CompareScansScreen() {
  const params = useLocalSearchParams();
  const idA = typeof params.a === 'string' ? params.a : '';
  const idB = typeof params.b === 'string' ? params.b : '';
  const { user } = useUserStore();
  const { scans, loadScans } = useBodyCompositionStore();

  React.useEffect(() => {
    if (user?.uid && scans.length === 0) loadScans(user.uid);
  }, [user?.uid]);

  const scanA = scans.find((s) => s.id === idA);
  const scanB = scans.find((s) => s.id === idB);

  const deltaRows = (scanA && scanB) ? [
    ['waistCircumferenceCm', 'Waist'],
    ['hipCircumferenceCm', 'Hip'],
    ['shoulderWidthCm', 'Shoulder width'],
  ].map(([key, label]) => {
    const before = scanA.measurements?.[key];
    const after = scanB.measurements?.[key];
    if (typeof before !== 'number' || typeof after !== 'number') return null;
    return { key, label, delta: after - before };
  }).filter(Boolean) : [];

  const otherRows = (scanA && scanB) ? [
    ['bodyFatPercent', 'Body fat', '%'],
    ['bmi', 'BMI', ''],
    ['weightKg', 'Weight', ' kg'],
  ].map(([key, label, unit]) => {
    const before = scanA[key];
    const after = scanB[key];
    if (typeof before !== 'number' || typeof after !== 'number') return null;
    return { key, label, unit, delta: after - before };
  }).filter(Boolean) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Compare Scans" showBack variant="light" />
      {(!scanA || !scanB) ? (
        <View style={styles.centerMessage}>
          <Text style={styles.centerMessageText}>
            Couldn't find both scans to compare.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <ScanMeshViewer
            scan={scanA}
            label={scanA.createdAtLocal ? new Date(scanA.createdAtLocal).toLocaleDateString() : 'Scan A'}
          />
          <View style={{ height: spacing.base }} />
          <ScanMeshViewer
            scan={scanB}
            label={scanB.createdAtLocal ? new Date(scanB.createdAtLocal).toLocaleDateString() : 'Scan B'}
          />

          {scanA.createdAtLocal && scanB.createdAtLocal && (
            <Text style={styles.daysText}>
              {daysBetween(scanA.createdAtLocal, scanB.createdAtLocal)} days apart
            </Text>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Body Composition</Text>
            {otherRows.length === 0 ? (
              <Text style={styles.emptyText}>No comparable data.</Text>
            ) : otherRows.map((r, i) => (
              <View key={r.key} style={[styles.row, i === otherRows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.delta === 0 ? (
                  <Text style={styles.rowValue}>No change</Text>
                ) : (
                  <Text style={[styles.rowValue, { color: r.delta < 0 ? colors.green : colors.orange }]}>
                    {(r.delta > 0 ? '+' : '') + r.delta.toFixed(1) + r.unit}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Measurements</Text>
            {deltaRows.length === 0 ? (
              <Text style={styles.emptyText}>No comparable measurements.</Text>
            ) : deltaRows.map((r, i) => (
              <View key={r.key} style={[styles.row, i === deltaRows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {r.delta === 0 ? (
                  <Text style={styles.rowValue}>No change</Text>
                ) : (
                  <Text style={[styles.rowValue, { color: r.delta < 0 ? colors.green : colors.orange }]}>
                    {(r.delta > 0 ? '+' : '') + r.delta.toFixed(1) + ' cm'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.base, paddingBottom: spacing.xxl },
  centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  centerMessageText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  daysText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.base },
  card: {
    backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.base,
  },
  cardTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { ...typography.bodySmall, color: colors.textSecondary },
  rowValue: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
});

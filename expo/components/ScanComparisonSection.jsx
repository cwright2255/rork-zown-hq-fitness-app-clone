// components/ScanComparisonSection.jsx
//
// Progress tab's scan viewer card, always present once at least one real
// scan exists (not gated behind having 2+, unlike the comparison-only
// version this replaced). Three modes:
//  - "Current": always the most recent scan, no picker needed.
//  - "Pick one": choose any single past scan from a horizontal picker.
//  - "Compare": choose two scans (defaults to the two most recent) and
//    see them side by side with real measurement deltas.
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import ScanMeshPreview from '@/components/ScanMeshPreview';

const MODES = { CURRENT: 'current', ONE: 'one', COMPARE: 'compare' };

const DELTA_FIELDS = [
  ['waistCircumferenceCm', 'Waist'],
  ['hipCircumferenceCm', 'Hip'],
  ['shoulderWidthCm', 'Shoulder width'],
];

function computeDeltas(scanA, scanB) {
  return DELTA_FIELDS.map(([key, label]) => {
    const before = scanA.measurements?.[key];
    const after = scanB.measurements?.[key];
    if (typeof before !== 'number' || typeof after !== 'number') return null;
    return { key, label, delta: after - before };
  }).filter(Boolean);
}

// Body composition fields (not nested under .measurements like the
// circumference fields above) - real fields the scan pipeline actually
// computes. Arm/leg circumference were also requested but do NOT exist
// anywhere in bodyCompositionService.js's output (confirmed directly,
// same gap as the Chest/Arms/Thighs rows already dropped from the
// Measurements card) - left out here for the same reason: no real data
// to show without fabricating it.
const COMPOSITION_FIELDS = [
  ['bodyFatPercent', 'Body fat', '%'],
  ['bmi', 'BMI', ''],
  ['weightKg', 'Weight', ' kg'],
];
function computeCompositionDeltas(scanA, scanB) {
  return COMPOSITION_FIELDS.map(([key, label, unit]) => {
    const before = scanA[key];
    const after = scanB[key];
    if (typeof before !== 'number' || typeof after !== 'number') return null;
    return { key, label, unit, delta: after - before };
  }).filter(Boolean);
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : '';
}

export default function ScanComparisonSection({ scans }) {
  const [mode, setMode] = useState(MODES.CURRENT);
  const [pickedId, setPickedId] = useState(null);
  const [compareIdA, setCompareIdA] = useState(null);
  const [compareIdB, setCompareIdB] = useState(null);

  const latest = scans.length ? scans[scans.length - 1] : null;
  const chronological = useMemo(() => [...scans].reverse(), [scans]);

  if (!latest) return null;

  const pickedScan = pickedId ? scans.find((s) => s.id === pickedId) : latest;

  const defaultB = scans[scans.length - 1];
  const defaultA = scans.length > 1 ? scans[scans.length - 2] : null;
  const scanA = compareIdA ? scans.find((s) => s.id === compareIdA) : defaultA;
  const scanB = compareIdB ? scans.find((s) => s.id === compareIdB) : defaultB;

  const deltaRows = (scanA && scanB) ? computeDeltas(scanA, scanB) : [];
  const compositionRows = (scanA && scanB) ? computeCompositionDeltas(scanA, scanB) : [];

  return (
    <View>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Body Scans</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.modeRow}>
          <ModeButton label="Current" active={mode === MODES.CURRENT} onPress={() => setMode(MODES.CURRENT)} />
          <ModeButton label="Pick one" active={mode === MODES.ONE} onPress={() => setMode(MODES.ONE)} disabled={scans.length < 1} />
          <ModeButton label="Compare" active={mode === MODES.COMPARE} onPress={() => setMode(MODES.COMPARE)} disabled={scans.length < 2} />
        </View>

        {mode === MODES.CURRENT && (
          <View>
            <Text style={styles.dateLabel}>{formatDate(latest.createdAtLocal)}</Text>
            <ScanMeshPreview scan={latest} height={220} />
            <Pressable style={styles.linkBtn} onPress={() => router.push('/body-scan/' + latest.id)}>
              <Text style={styles.linkBtnText}>View Full Scan</Text>
            </Pressable>
          </View>
        )}

        {mode === MODES.ONE && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
              {chronological.map((scan) => (
                <Pressable
                  key={scan.id}
                  style={[styles.pickerChip, (pickedScan?.id === scan.id) && styles.pickerChipActive]}
                  onPress={() => setPickedId(scan.id)}
                >
                  <Text style={[styles.pickerChipText, (pickedScan?.id === scan.id) && styles.pickerChipTextActive]}>
                    {formatDate(scan.createdAtLocal)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {pickedScan && (
              <View>
                <ScanMeshPreview scan={pickedScan} height={220} />
                <Pressable style={styles.linkBtn} onPress={() => router.push('/body-scan/' + pickedScan.id)}>
                  <Text style={styles.linkBtnText}>View Full Scan</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {mode === MODES.COMPARE && scanA && scanB && (
          <View>
            <View style={styles.compareRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>{formatDate(scanA.createdAtLocal)}</Text>
                <ScanMeshPreview scan={scanA} height={160} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dateLabel}>{formatDate(scanB.createdAtLocal)}</Text>
                <ScanMeshPreview scan={scanB} height={160} />
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.picker}>
              {chronological.map((scan) => {
                const isA = scanA.id === scan.id;
                const isB = scanB.id === scan.id;
                return (
                  <Pressable
                    key={scan.id}
                    style={[styles.pickerChip, (isA || isB) && styles.pickerChipActive]}
                    onPress={() => {
                      // Tapping a scan already in slot A or B is a no-op
                      // (both slots collapsing onto one scan would break
                      // the comparison). Otherwise: the tapped scan always
                      // becomes the new "B" (most recent side), and the
                      // old B shifts into "A" - simple, predictable, and
                      // matches how the default (two most recent scans)
                      // is chosen in the first place.
                      if (scan.id === scanA.id || scan.id === scanB.id) return;
                      setCompareIdA(scanB.id);
                      setCompareIdB(scan.id);
                    }}
                  >
                    <Text style={[styles.pickerChipText, (isA || isB) && styles.pickerChipTextActive]}>
                      {formatDate(scan.createdAtLocal)}{isA ? ' (A)' : isB ? ' (B)' : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {compositionRows.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <Text style={styles.subheading}>Body Composition</Text>
                {compositionRows.map((r, i) => (
                  <View key={r.key} style={[styles.measRow, i === compositionRows.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.measLabel}>{r.label}</Text>
                    {r.delta === 0 ? (
                      <Text style={styles.measChange}>No change</Text>
                    ) : (
                      <Text style={[styles.measChange, { color: r.delta < 0 ? '#22C55E' : '#F97316' }]}>
                        {(r.delta > 0 ? '+' : '') + r.delta.toFixed(1) + r.unit}
                      </Text>
                    )}
                  </View>
                ))}
                <Text style={styles.subheading}>Measurements</Text>
              </View>
            )}
            {deltaRows.length === 0 ? (
              <Text style={styles.emptyText}>No comparable measurements between these scans.</Text>
            ) : deltaRows.map((r, i) => (
              <View key={r.key} style={[styles.measRow, i === deltaRows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.measLabel}>{r.label}</Text>
                {r.delta === 0 ? (
                  <Text style={styles.measChange}>No change</Text>
                ) : (
                  <Text style={[styles.measChange, { color: r.delta < 0 ? '#22C55E' : '#F97316' }]}>
                    {(r.delta > 0 ? '\u2191 ' : '\u2193 ') + Math.abs(r.delta).toFixed(1) + ' cm'}
                  </Text>
                )}
              </View>
            ))}

            <Pressable
              style={styles.linkBtn}
              onPress={() => router.push('/body-scan/compare?a=' + scanA.id + '&b=' + scanB.id)}
            >
              <Text style={styles.linkBtnText}>Open Full Comparison</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

function ModeButton({ label, active, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.modeBtn, active && styles.modeBtnActive, disabled && styles.modeBtnDisabled]}
      onPress={disabled ? undefined : onPress}
    >
      <Text style={[styles.modeBtnText, active && styles.modeBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: '#F0F0F0' },
  modeBtnActive: { backgroundColor: '#1A1A2E' },
  modeBtnDisabled: { opacity: 0.4 },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: '#666' },
  modeBtnTextActive: { color: '#FFF' },
  dateLabel: { fontSize: 11, color: '#999', textAlign: 'center', marginBottom: 4 },
  linkBtn: { marginTop: 12, backgroundColor: '#000', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  linkBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  picker: { marginTop: 10, marginBottom: 4 },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F0F0F0', marginRight: 8 },
  pickerChipActive: { backgroundColor: '#1A1A2E' },
  pickerChipText: { fontSize: 12, color: '#666', fontWeight: '600' },
  pickerChipTextActive: { color: '#FFF' },
  compareRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  measRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  measLabel: { fontSize: 13, color: '#666' },
  measChange: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  emptyText: { fontSize: 12, color: '#999', marginBottom: 8 },
  subheading: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
});

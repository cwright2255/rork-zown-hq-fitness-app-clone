// app/running/import.jsx
//
// Brings runs and walks in from Apple Health: you pick how far back to look,
// tap Import, and see what came in. The work itself is in
// services/healthImport.js. iPhone only for now (Health Connect on Android is
// not set up).
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import { importWorkouts } from '@/services/healthImport';
import { DEFAULT_RANGE, IMPORT_RANGES } from '@/lib/runImport';

const GREEN = '#22C55E';

const PERMISSION_HELP = 'Open Settings, then Health, then Data Access & Devices, then ZOWN HQ, and turn on Workouts and Workout Routes.';

const ERROR_TEXT = {
  'signed-out': 'Sign in to import your runs.',
  unavailable: 'Apple Health is not available on this device.',
  denied: `Zown could not get access to Apple Health. ${PERMISSION_HELP}`,
  error: 'Something went wrong while reading Apple Health. Try again in a moment.',
};

export default function ImportRunsScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [rangeId, setRangeId] = useState(DEFAULT_RANGE);
  const [phase, setPhase] = useState('idle'); // idle | working | done | error
  const [progress, setProgress] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const busy = useRef(false);

  const goBack = () => {
    if (router.canGoBack && router.canGoBack()) router.back();
    else router.replace('/profile/running-log');
  };

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('working');
    setOutcome(null);
    setProgress(null);
    const store = useRunningStore.getState();
    try {
      const result = await importWorkouts({
        uid: user?.uid,
        rangeId,
        loadRuns: store.loadRuns,
        getRuns: () => useRunningStore.getState().runs,
        saveRuns: store.importRuns,
        onProgress: setProgress,
      });
      setOutcome(result);
      setPhase(result.ok ? 'done' : 'error');
    } catch (e) {
      // importWorkouts reports its own failures; this only keeps the screen from sitting on the spinner.
      setOutcome({ ok: false, reason: 'error' });
      setPhase('error');
    } finally {
      busy.current = false;
    }
  };

  const supported = Platform.OS === 'ios';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={goBack} testID="import-back">
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Import Runs</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Ionicons name="heart" size={22} color="#FFF" />
          </View>
          <Text style={styles.cardTitle}>Apple Health</Text>
          <Text style={styles.cardBody}>
            Bring in runs and walks recorded with your Apple Watch, your iPhone, or another app that saves to Apple Health.
            Each one keeps its route, splits and climb.
          </Text>
        </View>

        {!supported ? (
          <Text style={styles.unsupported} testID="import-unsupported">
            Importing works on iPhone for now. Health Connect on Android is not set up yet.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>How far back</Text>
            <View style={styles.rangeRow}>
              {IMPORT_RANGES.map((range) => (
                <Pressable
                  key={range.id}
                  style={[styles.rangePill, rangeId === range.id && styles.rangePillActive]}
                  onPress={() => phase !== 'working' && setRangeId(range.id)}
                  testID={`import-range-${range.id}`}
                >
                  <Text style={[styles.rangeText, rangeId === range.id && styles.rangeTextActive]}>{range.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.importButton, phase === 'working' && styles.importButtonBusy]}
              onPress={start}
              disabled={phase === 'working'}
              testID="import-start"
            >
              {phase === 'working' ? (
                <>
                  <ActivityIndicator color="#FFF" />
                  <Text style={styles.importButtonText} testID="import-progress">
                    {progress && progress.total > 0
                      ? `Reading workout ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
                      : 'Reading Apple Health...'}
                  </Text>
                </>
              ) : (
                <Text style={styles.importButtonText}>{phase === 'done' ? 'Import again' : 'Import from Apple Health'}</Text>
              )}
            </Pressable>

            {phase === 'done' && outcome && outcome.ok && (
              <View style={styles.result} testID="import-result">
                <Ionicons name={outcome.added.length > 0 ? 'checkmark-circle' : 'information-circle'} size={28} color={outcome.added.length > 0 ? GREEN : '#999'} />
                <Text style={styles.resultTitle} testID="import-headline">{outcome.headline}</Text>
                {outcome.lines.map((line) => (
                  <Text key={line} style={styles.resultLine}>{line}</Text>
                ))}
                {outcome.found === 0 && (
                  <Text style={styles.resultHint} testID="import-hint">
                    If you expected some, check that Zown is allowed to read them. {PERMISSION_HELP}
                  </Text>
                )}
                {outcome.added.length > 0 && (
                  <Pressable style={styles.logButton} onPress={goBack} testID="import-view-log">
                    <Text style={styles.logButtonText}>See them in your Running Log</Text>
                  </Pressable>
                )}
              </View>
            )}

            {phase === 'error' && outcome && !outcome.ok && (
              <View style={styles.result} testID="import-error">
                <Ionicons name="alert-circle" size={28} color="#EF4444" />
                <Text style={styles.resultTitle}>Could not import</Text>
                <Text style={styles.resultLine}>{ERROR_TEXT[outcome.reason] || ERROR_TEXT.error}</Text>
              </View>
            )}

            <Text style={styles.footnote}>
              Imported runs and walks do not earn XP or count toward challenges. Anything already in Zown is skipped, so importing twice is safe.
              Your history keeps your latest 100 outings.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  headerRightPlaceholder: { width: 32 },
  content: { padding: 16, paddingBottom: 60 },

  card: {
    backgroundColor: '#F7F7F7', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#ECECEC', marginBottom: 24,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#000' },
  cardBody: { fontSize: 14, lineHeight: 20, color: '#555', marginTop: 6 },

  label: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 10 },
  rangeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  rangePill: { flex: 1, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center' },
  rangePillActive: { backgroundColor: '#000' },
  rangeText: { fontSize: 13, fontWeight: '600', color: '#666' },
  rangeTextActive: { color: '#FFF' },

  importButton: {
    height: 52, borderRadius: 26, backgroundColor: '#000', flexDirection: 'row', gap: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  importButtonBusy: { backgroundColor: '#444' },
  importButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  result: {
    alignItems: 'center', gap: 6, marginTop: 24, padding: 18, borderRadius: 16, backgroundColor: '#FAFAFA',
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  resultTitle: { fontSize: 17, fontWeight: '800', color: '#000', textAlign: 'center' },
  resultLine: { fontSize: 14, color: '#666', textAlign: 'center' },
  resultHint: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  logButton: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#F0F0F0' },
  logButtonText: { fontSize: 14, fontWeight: '700', color: '#000' },

  unsupported: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
  footnote: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 24, lineHeight: 18 },
});

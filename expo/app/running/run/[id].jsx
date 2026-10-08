// app/running/run/[id].jsx
//
// One saved run (or walk) in detail: the route on a map with start and finish
// markers, the headline numbers, pace for each kilometre as bars, and a splits
// table. Opened from the Running Log and from the finished-run screen.
// Route id is the run's id; everything shown is worked out in lib/runDetail.js.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RunRouteMap from '@/components/RunRouteMap';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import { describeRun, formatDelta } from '@/lib/runDetail';
import { formatPace, runPaceSecPerKm } from '@/lib/runStats';

const GREEN = '#22C55E';
const BAR_WIDTH = 34;

function Stat({ value, label, unit, testID }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} testID={testID}>
        {value}
        {unit ? <Text style={styles.statUnit}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function RunDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';
  const runs = useRunningStore((s) => s.runs) || [];
  const loadRuns = useRunningStore((s) => s.loadRuns);
  const { user } = useUserStore();
  const [loading, setLoading] = useState(false);

  const run = useMemo(() => runs.find((r) => r && String(r.id) === id) || null, [runs, id]);

  // Opened straight from a link or after a restart: the list may not be here yet.
  useEffect(() => {
    if (run || !user?.uid || typeof loadRuns !== 'function') return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.resolve(loadRuns(user.uid)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [run, user?.uid]);

  const info = useMemo(() => (run ? describeRun(run) : null), [run]);

  const goBack = () => {
    if (router.canGoBack && router.canGoBack()) router.back();
    else router.replace('/running/program');
  };

  if (!run || !info) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Pressable style={[styles.backBtn, styles.backBtnPlain]} onPress={goBack} testID="run-detail-back">
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.notFound} testID="run-detail-notfound">
            {loading ? 'Loading your run...' : 'Run not found'}
          </Text>
        </View>
      </View>
    );
  }

  const { splits } = info;
  const olderRunNote = info.source
    ? 'Kilometre splits need a GPS route that matches the workout, and this one has none.'
    : run.distance >= 1
      ? 'This run was saved before splits were recorded.'
      : 'Splits appear for runs of 1 km or more.';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <RunRouteMap points={info.points} style={StyleSheet.absoluteFillObject} />
          <Pressable style={styles.backBtn} onPress={goBack} testID="run-detail-back">
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Pressable>
        </View>

        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <View style={styles.titleIcon}>
              <Ionicons name={info.activity === 'walk' ? 'walk-outline' : 'fitness-outline'} size={20} color={GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} testID="run-detail-title">{info.title}</Text>
              {info.when ? <Text style={styles.when}>{info.when}</Text> : null}
              {info.source ? <Text style={styles.sourceTag} testID="run-detail-source">{`Imported from ${info.source}`}</Text> : null}
            </View>
          </View>

          <View style={styles.bigRow}>
            <Text style={styles.bigValue} testID="run-detail-distance">{info.distanceText}</Text>
            <Text style={styles.bigUnit}>km</Text>
          </View>

          <View style={styles.statsRow}>
            <Stat value={info.timeText} label="Time" testID="run-detail-time" />
            <Stat value={formatPace(runPaceSecPerKm(run))} unit="/km" label="Avg pace" testID="run-detail-pace" />
            <Stat value={String(info.calories)} unit="kcal" label="Calories" testID="run-detail-calories" />
          </View>

          {(info.climb > 0 || info.descent > 0) && (
            <View style={styles.elevRow} testID="run-detail-elevation">
              <Ionicons name="trending-up" size={16} color={GREEN} />
              <Text style={styles.elevText} testID="run-detail-climb">{`${info.climb} m climb`}</Text>
              <Ionicons name="trending-down" size={16} color="rgba(255,255,255,0.55)" style={{ marginLeft: 18 }} />
              <Text style={styles.elevText}>{`${info.descent} m descent`}</Text>
            </View>
          )}

          {splits.rows.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Pace by km</Text>
              <Text style={styles.sectionHint}>Taller is faster</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chart}>
                {splits.rows.map((row) => (
                  <View key={`bar-${row.index}`} style={styles.barCol}>
                    <Text style={styles.barPace}>{formatPace(row.pace)}</Text>
                    <View style={styles.barTrack}>
                      <View
                        testID={`pace-bar-${row.index}`}
                        style={[
                          styles.bar,
                          { height: `${Math.round(row.bar * 100)}%` },
                          row.isFastest && styles.barFastest,
                          row.partial && styles.barPartial,
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{row.label}</Text>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.sectionTitle}>Splits</Text>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { width: 56 }]}>KM</Text>
                <Text style={[styles.th, { width: 84 }]}>PACE</Text>
                <Text style={[styles.th, { flex: 1 }]} />
                <Text style={[styles.th, { width: 56, textAlign: 'right' }]}>VS AVG</Text>
              </View>
              {splits.rows.map((row) => (
                <View key={`split-${row.index}`} style={styles.tableRow} testID={`split-row-${row.index}`}>
                  <Text style={[styles.td, { width: 56 }]}>{row.label}</Text>
                  <Text style={[styles.td, styles.tdBold, { width: 84 }]}>{formatPace(row.pace)}</Text>
                  <View style={styles.rowBarTrack}>
                    <View style={[styles.rowBar, { width: `${Math.round(row.bar * 100)}%` }, row.isFastest && styles.rowBarFastest]} />
                  </View>
                  <Text
                    style={[
                      styles.td,
                      { width: 56, textAlign: 'right' },
                      row.delta < -0.5 ? styles.faster : row.delta > 0.5 ? styles.slower : null,
                    ]}
                  >
                    {formatDelta(row.delta)}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.note} testID="run-detail-nosplits">{olderRunNote}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },
  scrollContent: { paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 15, color: 'rgba(255,255,255,0.6)' },

  hero: { height: 330, backgroundColor: '#0D1117' },
  backBtn: {
    position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 54 : 40,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(13,17,23,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  backBtnPlain: { zIndex: 2 },

  sheet: {
    marginTop: -26, backgroundColor: '#0D1117', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 22,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  when: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  sourceTag: { fontSize: 12, fontWeight: '600', color: GREEN, marginTop: 3 },

  bigRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 20 },
  bigValue: { fontSize: 64, fontWeight: '800', color: '#FFF', lineHeight: 68 },
  bigUnit: { fontSize: 20, fontWeight: '700', color: GREEN, marginLeft: 8, marginBottom: 10 },

  statsRow: {
    flexDirection: 'row', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  statUnit: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, textTransform: 'uppercase' },

  elevRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  elevText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#FFF', marginTop: 28 },
  sectionHint: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, marginBottom: 10 },

  chart: { paddingVertical: 6, gap: 8, alignItems: 'flex-end' },
  barCol: { width: BAR_WIDTH, alignItems: 'center' },
  barPace: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  barTrack: { height: 120, width: BAR_WIDTH - 8, justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 6 },
  barFastest: { backgroundColor: GREEN },
  barPartial: { backgroundColor: 'rgba(255,255,255,0.14)' },
  barLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 6 },

  tableHead: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  th: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  td: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  tdBold: { fontWeight: '800', color: '#FFF' },
  rowBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 8, overflow: 'hidden' },
  rowBar: { height: '100%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  rowBarFastest: { backgroundColor: GREEN },
  faster: { color: GREEN, fontWeight: '700' },
  slower: { color: '#F87171', fontWeight: '700' },

  note: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 28, textAlign: 'center' },
});

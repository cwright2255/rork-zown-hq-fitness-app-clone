// app/running/run/[id].jsx
//
// One saved run (or walk) in detail: the route on a dark map with start and
// finish markers and the distance over it, then a white card with the headline
// numbers, pace for each kilometre as a line, and a splits table. Black and
// white, like the rest of Zown. Opened from the Running Log and from the
// finished-run screen.
// Route id is the run's id; everything shown is worked out in lib/runDetail.js.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RunRouteMap from '@/components/RunRouteMap';
import PaceLineChart from '@/components/PaceLineChart';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import { useCommunityStore } from '@/store/communityStore';
import { describeRun, formatDelta } from '@/lib/runDetail';
import { shareRunToFeed, shareErrorText } from '@/services/runShare';
import { formatPace, runPaceSecPerKm } from '@/lib/runStats';

const INK = '#000000';
const MAP_BG = '#0D1117';
const SHEET_PAD = 20;
// Room kept clear of the route on the map: the back button above it and the
// distance and the card below it.
const MAP_EDGE_PADDING = { top: 110, right: 50, bottom: 200, left: 50 };

function Stat({ value, label, unit, icon, testID }) {
  return (
    <View style={styles.stat}>
      {icon ? <Ionicons name={icon} size={18} color="#8A8A8A" style={styles.statIcon} /> : null}
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
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const id = typeof params.id === 'string' ? params.id : '';
  const runs = useRunningStore((s) => s.runs) || [];
  const loadRuns = useRunningStore((s) => s.loadRuns);
  const { user } = useUserStore();
  const createPost = useCommunityStore((s) => s.createPost);
  const [loading, setLoading] = useState(false);
  // Sharing this run to the community feed: idle, sending, or done (the run
  // remembers its post, so "done" also shows after coming back to the screen).
  const [sharing, setSharing] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [shareError, setShareError] = useState('');

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

  const handleShare = async () => {
    if (!run || sharing || justShared || run.sharedPostId) return;
    setSharing(true);
    setShareError('');
    const result = await shareRunToFeed({
      run,
      user,
      createPost,
      markShared: useRunningStore.getState().markRunShared,
    });
    setSharing(false);
    if (result.ok || result.reason === 'already-shared') setJustShared(true);
    else setShareError(shareErrorText(result.reason));
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
  const isShared = justShared || !!run.sharedPostId;
  const olderRunNote = info.source
    ? 'Kilometre splits need a GPS route that matches the workout, and this one has none.'
    : run.distance >= 1
      ? 'This run was saved before splits were recorded.'
      : 'Splits appear for runs of 1 km or more.';
  const heroHeight = Math.max(380, Math.min(540, Math.round(screenHeight * 0.56)));
  const chartWidth = Math.max(240, Math.round(screenWidth - SHEET_PAD * 2));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <RunRouteMap points={info.points} style={StyleSheet.absoluteFillObject} edgePadding={MAP_EDGE_PADDING} />
          <Pressable style={styles.backBtn} onPress={goBack} testID="run-detail-back">
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.heading} testID="run-detail-heading" pointerEvents="none">
            {info.activity === 'walk' ? 'Walk Completed' : 'Run Completed'}
          </Text>

          <View style={styles.heroInfo} pointerEvents="none">
            <Text style={styles.title} testID="run-detail-title">{info.title}</Text>
            {info.when ? <Text style={styles.when}>{info.when}</Text> : null}
            {info.source ? <Text style={styles.sourceTag} testID="run-detail-source">{`Imported from ${info.source}`}</Text> : null}
            <View style={styles.bigRow}>
              <Text style={styles.bigValue} testID="run-detail-distance">{info.distanceText}</Text>
              <Text style={styles.bigUnit}>km</Text>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.statsRow}>
            <Stat value={info.timeText} label="Duration" icon="time-outline" testID="run-detail-time" />
            <View style={styles.statDivider} />
            <Stat value={formatPace(runPaceSecPerKm(run))} unit="/km" label="Avg pace" icon="speedometer-outline" testID="run-detail-pace" />
            <View style={styles.statDivider} />
            <Stat value={String(info.calories)} unit="kcal" label="Calories" icon="flame-outline" testID="run-detail-calories" />
          </View>

          {(info.climb > 0 || info.descent > 0) && (
            <View style={styles.elevRow} testID="run-detail-elevation">
              <Ionicons name="trending-up" size={16} color={INK} />
              <Text style={styles.elevText} testID="run-detail-climb">{`${info.climb} m climb`}</Text>
              <Ionicons name="trending-down" size={16} color="#8A8A8A" style={{ marginLeft: 18 }} />
              <Text style={styles.elevText}>{`${info.descent} m descent`}</Text>
            </View>
          )}

          {splits.rows.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Pace by km</Text>
              <Text style={styles.sectionHint}>Higher is faster</Text>
              <View style={styles.chartWrap}>
                <PaceLineChart rows={splits.rows} width={chartWidth} height={120} />
              </View>
            </>
          ) : (
            <Text style={styles.note} testID="run-detail-nosplits">{olderRunNote}</Text>
          )}

          <Pressable
            style={[styles.shareBtn, isShared && styles.shareBtnDone]}
            onPress={handleShare}
            disabled={sharing || isShared}
            accessibilityRole="button"
            testID="run-detail-share"
          >
            <Ionicons name={isShared ? 'checkmark-circle' : 'share-social-outline'} size={18} color={isShared ? INK : '#FFFFFF'} />
            <Text style={[styles.shareText, isShared && styles.shareTextDone]}>
              {isShared ? 'Shared to feed' : sharing ? 'Sharing...' : 'Share to feed'}
            </Text>
          </Pressable>
          {!!shareError && <Text style={styles.shareError} testID="run-detail-share-error">{shareError}</Text>}

          {splits.rows.length > 0 && (
            <>
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
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAP_BG },
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontSize: 15, color: 'rgba(255,255,255,0.6)' },

  hero: { backgroundColor: MAP_BG },
  backBtn: {
    position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 54 : 40,
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(13,17,23,0.85)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  backBtnPlain: { zIndex: 2 },
  heading: {
    position: 'absolute', left: 64, right: 64, top: Platform.OS === 'ios' ? 54 : 40, height: 40,
    lineHeight: 40, textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#FFFFFF',
  },
  heroInfo: { position: 'absolute', left: SHEET_PAD, right: SHEET_PAD, bottom: 44 },
  title: { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  when: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  sourceTag: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  bigValue: { fontSize: 64, fontWeight: '800', color: '#FFFFFF', lineHeight: 68 },
  bigUnit: { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginLeft: 8, marginBottom: 10 },

  sheet: {
    marginTop: -26, flexGrow: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: SHEET_PAD, paddingTop: 24, paddingBottom: 60,
  },

  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: INK },
  statUnit: { fontSize: 12, fontWeight: '600', color: '#8A8A8A' },
  statLabel: { fontSize: 11, color: '#8A8A8A', marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 44, backgroundColor: '#E5E5E5' },

  elevRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#EDEDED',
  },
  elevText: { fontSize: 14, fontWeight: '600', color: INK },

  sectionTitle: { fontSize: 17, fontWeight: '800', color: INK, marginTop: 28 },
  sectionHint: { fontSize: 12, color: '#8A8A8A', marginTop: 2, marginBottom: 6 },
  chartWrap: { marginTop: 4 },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28,
    backgroundColor: INK, borderRadius: 28, paddingVertical: 16,
  },
  shareBtnDone: { backgroundColor: '#F0F0F0' },
  shareText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  shareTextDone: { color: INK },
  shareError: { fontSize: 12, color: '#B91C1C', marginTop: 8, textAlign: 'center' },

  tableHead: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#E5E5E5',
  },
  th: { fontSize: 11, fontWeight: '700', color: '#8A8A8A' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  td: { fontSize: 14, color: '#333333' },
  tdBold: { fontWeight: '800', color: INK },
  rowBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#EEEEEE', marginHorizontal: 8, overflow: 'hidden' },
  rowBar: { height: '100%', borderRadius: 3, backgroundColor: '#BDBDBD' },
  rowBarFastest: { backgroundColor: INK },
  faster: { color: INK, fontWeight: '700' },
  slower: { color: '#8A8A8A', fontWeight: '700' },

  note: { fontSize: 13, color: '#8A8A8A', marginTop: 28, textAlign: 'center' },
});

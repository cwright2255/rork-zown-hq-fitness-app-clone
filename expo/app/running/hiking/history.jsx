// app/running/hiking/history.jsx
//
// My Hikes: every hike that was recorded (app/running/hiking/monitor.jsx),
// newest first, with the route walked drawn on each card and the totals across
// all of them at the top. Black and white, like the rest of Zown. Tapping a card
// opens that hike (app/running/hiking/log/[id].jsx). Everything shown is worked
// out in lib/hikeLog.js.
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import RunRouteMap from '@/components/RunRouteMap';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useHikingStore } from '@/store/hikingStore';
import { useUserStore } from '@/store/userStore';
import { describeHike, sortHikesNewest, summarizeHikes } from '@/lib/hikeLog';
import { formatClock } from '@/lib/runDetail';

const INK = '#000000';
// The route thumbnail sits in a short, wide frame, so it needs little room around it.
const THUMB_PADDING = { top: 20, right: 24, bottom: 20, left: 24 };

function Stat({ value, unit, label, testID }) {
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

function HikeCard({ info, onPress }) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" testID={`hike-card-${info.id}`}>
      {info.hasRoute && (
        <RunRouteMap
          points={info.points}
          sketch
          edgePadding={THUMB_PADDING}
          style={styles.thumb}
        />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} numberOfLines={1} testID={`hike-card-title-${info.id}`}>{info.title}</Text>
          {!!info.tier && <Text style={styles.tier}>{info.tier}</Text>}
        </View>
        {!!info.when && <Text style={styles.cardWhen}>{info.when}</Text>}
        <View style={styles.cardStats}>
          <Stat value={info.distanceText} unit="km" label="Distance" testID={`hike-card-distance-${info.id}`} />
          <Stat value={info.timeText} label="Time" />
          <Stat value={String(info.climb)} unit="m" label="Climb" />
        </View>
      </View>
    </Pressable>
  );
}

export default function HikeHistoryScreen() {
  const router = useRouter();
  const completedHikes = useHikingStore((s) => s.completedHikes);
  const loadCompletedHikes = useHikingStore((s) => s.loadCompletedHikes);
  const { user } = useUserStore();

  useEffect(() => {
    if (user?.uid && typeof loadCompletedHikes === 'function') loadCompletedHikes(user.uid);
  }, [user?.uid]);

  const hikes = useMemo(
    () => sortHikesNewest(completedHikes).map(describeHike).filter(Boolean),
    [completedHikes],
  );
  const totals = useMemo(() => summarizeHikes(completedHikes), [completedHikes]);

  const goBack = () => {
    if (router.canGoBack && router.canGoBack()) router.back();
    else router.replace('/running/hiking');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="My Hikes" showBack variant="light" onBack={goBack} />

      {hikes.length === 0 ? (
        <View style={styles.centerBlock} testID="hike-history-empty">
          <Ionicons name="trail-sign-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No hikes yet</Text>
          <Text style={styles.centerText}>
            Pick a trail and start a hike. It is recorded with the route you walk and will show up here.
          </Text>
          <PrimaryButton
            title="Find a trail"
            onPress={() => router.replace('/running/hiking')}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : (
        <FlatList
          data={hikes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={(
            <View style={styles.summary} testID="hike-history-summary">
              <Stat value={String(totals.count)} label={totals.count === 1 ? 'Hike' : 'Hikes'} testID="hike-total-count" />
              <View style={styles.divider} />
              <Stat value={totals.distanceKm.toFixed(1)} unit="km" label="Distance" testID="hike-total-distance" />
              <View style={styles.divider} />
              <Stat value={formatClock(totals.durationSeconds)} label="Time" testID="hike-total-time" />
              <View style={styles.divider} />
              <Stat value={String(Math.round(totals.climbM))} unit="m" label="Climbed" testID="hike-total-climb" />
            </View>
          )}
          renderItem={({ item }) => (
            <HikeCard info={item} onPress={() => router.push(`/running/hiking/log/${item.id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: INK, marginTop: spacing.sm },
  list: { padding: spacing.base, paddingBottom: 60 },

  summary: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg,
    paddingVertical: spacing.md, marginBottom: spacing.md,
  },
  divider: { width: 1, height: 32, backgroundColor: colors.border },

  card: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden', marginBottom: spacing.md },
  thumb: { height: 150 },
  cardBody: { padding: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: INK },
  tier: {
    fontSize: 11, fontWeight: '700', color: colors.bg, backgroundColor: INK,
    borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10, overflow: 'hidden',
  },
  cardWhen: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  cardStats: { flexDirection: 'row', marginTop: spacing.md },

  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 17, fontWeight: '800', color: INK },
  statUnit: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  statLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 3, textTransform: 'uppercase' },
});

// app/running/hiking/log/[id].jsx
//
// One recorded hike in detail: the route walked on a dark map with start and
// finish markers and the distance over it, then a white card with the headline
// numbers, the climb and descent, the difficulty, and a button to share it to the
// feed. Black and white, the same look as a finished run
// (app/running/run/[id].jsx). Opened from My Hikes
// (app/running/hiking/history.jsx). Route id is the hike's id; everything shown
// is worked out in lib/hikeLog.js.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import RunRouteMap from '@/components/RunRouteMap';
import { useHikingStore } from '@/store/hikingStore';
import { useUserStore } from '@/store/userStore';
import { useCommunityStore } from '@/store/communityStore';
import { describeHike } from '@/lib/hikeLog';
import { shareHikeToFeed, hikeShareErrorText } from '@/services/hikeShare';

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

export default function HikeDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const id = typeof params.id === 'string' ? params.id : '';
  const completedHikes = useHikingStore((s) => s.completedHikes) || [];
  const loadCompletedHikes = useHikingStore((s) => s.loadCompletedHikes);
  const { user } = useUserStore();
  const createPost = useCommunityStore((s) => s.createPost);
  const [loading, setLoading] = useState(false);
  // Sharing this hike to the community feed: idle, sending, or done (the hike
  // remembers its post, so "done" also shows after coming back to the screen).
  const [sharing, setSharing] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [shareError, setShareError] = useState('');

  const hike = useMemo(() => completedHikes.find((h) => h && String(h.id) === id) || null, [completedHikes, id]);

  // Opened straight from a link or after a restart: the list may not be here yet.
  useEffect(() => {
    if (hike || !user?.uid || typeof loadCompletedHikes !== 'function') return undefined;
    let cancelled = false;
    setLoading(true);
    Promise.resolve(loadCompletedHikes(user.uid)).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [hike, user?.uid]);

  const info = useMemo(() => (hike ? describeHike(hike) : null), [hike]);

  const goBack = () => {
    if (router.canGoBack && router.canGoBack()) router.back();
    else router.replace('/running/hiking/history');
  };

  const handleShare = async () => {
    if (!hike || sharing || justShared || hike.sharedPostId) return;
    setSharing(true);
    setShareError('');
    const result = await shareHikeToFeed({
      hike,
      user,
      createPost,
      markShared: useHikingStore.getState().markHikeShared,
    });
    setSharing(false);
    if (result.ok || result.reason === 'already-shared') setJustShared(true);
    else setShareError(hikeShareErrorText(result.reason));
  };

  if (!hike || !info) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Pressable style={[styles.backBtn, styles.backBtnPlain]} onPress={goBack} testID="hike-detail-back">
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.notFound} testID="hike-detail-notfound">
            {loading ? 'Loading your hike...' : 'Hike not found'}
          </Text>
        </View>
      </View>
    );
  }

  const isShared = justShared || info.shared;
  const heroHeight = Math.max(380, Math.min(540, Math.round(screenHeight * 0.56)));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.hero, { height: heroHeight }]}>
          <RunRouteMap
            points={info.points}
            style={StyleSheet.absoluteFillObject}
            edgePadding={MAP_EDGE_PADDING}
            emptyText="No route was recorded for this hike"
          />
          <Pressable style={styles.backBtn} onPress={goBack} testID="hike-detail-back">
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.heading} testID="hike-detail-heading" pointerEvents="none">Hike Completed</Text>

          <View style={styles.heroInfo} pointerEvents="none">
            <Text style={styles.title} testID="hike-detail-title">{info.title}</Text>
            {info.pathName ? <Text style={styles.when} testID="hike-detail-path">{info.pathName}</Text> : null}
            {info.when ? <Text style={styles.when}>{info.when}</Text> : null}
            <View style={styles.bigRow}>
              <Text style={styles.bigValue} testID="hike-detail-distance">{info.distanceText}</Text>
              <Text style={styles.bigUnit}>km</Text>
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <View style={styles.statsRow}>
            <Stat value={info.timeText} label="Duration" icon="time-outline" testID="hike-detail-time" />
            <View style={styles.statDivider} />
            <Stat value={info.paceText} unit="/km" label="Avg pace" icon="speedometer-outline" testID="hike-detail-pace" />
            <View style={styles.statDivider} />
            <Stat value={String(info.calories)} unit="kcal" label="Calories" icon="flame-outline" testID="hike-detail-calories" />
          </View>

          {(info.climb > 0 || info.descent > 0) && (
            <View style={styles.elevRow} testID="hike-detail-elevation">
              <Ionicons name="trending-up" size={16} color={INK} />
              <Text style={styles.elevText} testID="hike-detail-climb">{`${info.climb} m climb`}</Text>
              <Ionicons name="trending-down" size={16} color="#8A8A8A" style={{ marginLeft: 18 }} />
              <Text style={styles.elevText}>{`${info.descent} m descent`}</Text>
            </View>
          )}

          {!!info.tier && (
            <View style={styles.tierRow} testID="hike-detail-difficulty">
              <View style={styles.tierChip}>
                <Text style={styles.tierChipText} testID="hike-detail-tier">{info.tier}</Text>
              </View>
              {info.score > 0 && <Text style={styles.tierScore}>{`Difficulty score ${info.score}`}</Text>}
              {info.xp > 0 && <Text style={styles.xp} testID="hike-detail-xp">{`+${info.xp} XP`}</Text>}
            </View>
          )}

          <Pressable
            style={[styles.shareBtn, isShared && styles.shareBtnDone]}
            onPress={handleShare}
            disabled={sharing || isShared}
            accessibilityRole="button"
            testID="hike-detail-share"
          >
            <Ionicons name={isShared ? 'checkmark-circle' : 'share-social-outline'} size={18} color={isShared ? INK : '#FFFFFF'} />
            <Text style={[styles.shareText, isShared && styles.shareTextDone]}>
              {isShared ? 'Shared to feed' : sharing ? 'Sharing...' : 'Share to feed'}
            </Text>
          </Pressable>
          {!!shareError && <Text style={styles.shareError} testID="hike-detail-share-error">{shareError}</Text>}
          {!isShared && info.hasRoute && (
            <Text style={styles.privacy}>The first and last 200 m of your route are hidden when you share.</Text>
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

  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: '#EDEDED',
  },
  tierChip: { backgroundColor: INK, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 12 },
  tierChipText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  tierScore: { flex: 1, fontSize: 13, color: '#8A8A8A' },
  xp: { fontSize: 14, fontWeight: '800', color: INK, marginLeft: 'auto' },

  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28,
    backgroundColor: INK, borderRadius: 28, paddingVertical: 16,
  },
  shareBtnDone: { backgroundColor: '#F0F0F0' },
  shareText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  shareTextDone: { color: INK },
  shareError: { fontSize: 12, color: '#B91C1C', marginTop: 8, textAlign: 'center' },
  privacy: { fontSize: 12, color: '#8A8A8A', marginTop: 10, textAlign: 'center' },
});

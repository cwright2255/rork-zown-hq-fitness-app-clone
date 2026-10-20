import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { useSocialGraphStore } from '@/store/socialGraphStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useChallengeStore, getCurrentPeriodKey } from '@/store/challengeStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { audienceUids } from '@/lib/audience';
import { friendsRankSummary, liveChallengeSummary } from '@/lib/rankChallengeData';
import { fetchFriendEntries } from '@/services/friendsRank';

// Home > Challenges & Rank: two halves of one wide card. The left is where you stand among the people you follow, by XP (a tap opens
// the Leaderboard, or Friends when you follow nobody). The right is the live challenge you have joined and how far along you are, or
// the one to join (a tap opens Challenges). It only reads: it never joins you to anything, never publishes your progress and never asks
// the server to make new challenges (the Challenges screen does those). `refreshTick` goes up each time Home is pulled down to refresh.
const NOT_READY = { status: 'loading', entries: null, followingCount: 0 };

export default function RankChallengeWidget({ refreshTick = 0 }) {
  const uid = useUserStore((s) => s.user?.uid);
  const hidden = useSettingsStore((s) => s.showInLeaderboards) === false;
  const following = useSocialGraphStore((s) => s.following);
  const challenges = useChallengeStore((s) => s.challenges);
  const joinedIds = useChallengeStore((s) => s.joinedChallengeIds);
  const getProgress = useChallengeStore((s) => s.getProgress);
  const workouts = useWorkoutStore((s) => s.completedWorkouts);
  const runs = useRunningStore((s) => s.runs);
  const hikes = useHikingStore((s) => s.completedHikes);

  const [ranking, setRanking] = useState(NOT_READY);
  const requestId = useRef(0);
  const usedKey = useRef(null);
  const followKey = audienceUids('following', following).join(',');

  // Looks up the people you follow (when `reload`) and their entries. A newer lookup replaces an older one that is still running.
  const refreshRanking = async ({ reload }) => {
    const id = ++requestId.current;
    if (reload) await useSocialGraphStore.getState().loadFollowing(uid);
    if (id !== requestId.current) return;
    const social = useSocialGraphStore.getState();
    if (!social.isLoaded) {
      setRanking({ status: 'failed', entries: null, followingCount: 0 });
      return;
    }
    const uids = audienceUids('following', social.following);
    usedKey.current = uids.join(',');
    if (uids.length === 0) {
      setRanking({ status: 'ready', entries: [], followingCount: 0 });
      return;
    }
    const entries = await fetchFriendEntries(uids, uid);
    if (id !== requestId.current) return;
    setRanking(entries ? { status: 'ready', entries, followingCount: uids.length } : { status: 'failed', entries: null, followingCount: uids.length });
  };

  // Not looked up while "Show in Leaderboards" is off: the entry is gone, so there is no place to show.
  useEffect(() => {
    if (uid && !hidden) refreshRanking({ reload: true });
  }, [uid, hidden, refreshTick]);

  // Following or unfollowing someone on the Friends screen changes who is ranked: look again, without reloading the list.
  useEffect(() => {
    if (uid && !hidden && usedKey.current !== null && usedKey.current !== followKey) refreshRanking({ reload: false });
  }, [followKey]);

  useEffect(() => {
    if (uid) useChallengeStore.getState().loadChallenges(uid);
  }, [uid, refreshTick]);

  const friends = friendsRankSummary({ myUid: uid, hidden, status: ranking.status, followingCount: ranking.followingCount, entries: ranking.entries });
  const live = liveChallengeSummary({
    challenges,
    periodKeyOf: getCurrentPeriodKey,
    joinedIds,
    progressOf: (challenge) => getProgress(challenge, workouts, runs, hikes),
  });

  return (
    <View style={s.card} testID="home-widget-rankchallenge">
      <TouchableOpacity
        style={s.half}
        activeOpacity={0.8}
        onPress={() => router.push(friends.route)}
        accessibilityRole="button"
        accessibilityLabel={`${friends.sentence}. Opens ${friends.route === '/friends' ? 'Friends' : 'the Leaderboard'}.`}
        testID="home-widget-rankchallenge-friends"
      >
        <View style={s.header}>
          <Text style={s.label} numberOfLines={1}>Friends rank</Text>
          <Ionicons name="people-outline" size={20} color="#000" />
        </View>
        <Text style={s.value} numberOfLines={1} testID="home-rank-value">{friends.value}</Text>
        <View style={s.footer}>
          <Text style={s.caption} numberOfLines={1}>{friends.caption}</Text>
          <Ionicons name="chevron-forward" size={14} color="#999" />
        </View>
      </TouchableOpacity>

      <View style={s.divider} />

      <TouchableOpacity
        style={s.half}
        activeOpacity={0.8}
        onPress={() => router.push('/challenges')}
        accessibilityRole="button"
        accessibilityLabel={`${live.sentence}. Opens Challenges.`}
        testID="home-widget-rankchallenge-challenge"
      >
        <View style={s.header}>
          <Text style={s.label} numberOfLines={1}>{live.label}</Text>
          <Ionicons name="flag-outline" size={20} color="#000" />
        </View>
        <View>
          <Text style={s.value} numberOfLines={1} testID="home-challenge-value">{live.value}</Text>
          {live.pct !== null && (
            <View style={s.barTrack}>
              <View style={[s.barFill, { width: `${live.pct}%` }, live.completed && s.barDone]} testID="home-challenge-bar" />
            </View>
          )}
        </View>
        <View>
          {!!live.title && <Text style={s.title} numberOfLines={1} testID="home-challenge-title">{live.title}</Text>}
          <View style={s.footer}>
            <Text style={s.caption} numberOfLines={1}>{live.caption}</Text>
            <Ionicons name="chevron-forward" size={14} color="#999" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  half: { flex: 1, padding: 16, minHeight: 130, justifyContent: 'space-between' },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: '#E5E5E5', marginVertical: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', flexShrink: 1, marginRight: 6 },
  value: { fontSize: 28, fontWeight: '800', color: '#000' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#EEEEEE', marginTop: 6, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#000' },
  barDone: { backgroundColor: '#22C55E' },
  title: { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  caption: { fontSize: 12, color: '#999', marginTop: 2, flexShrink: 1 },
});

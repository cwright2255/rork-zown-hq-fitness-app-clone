import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { router } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import AudienceFilter from '@/components/AudienceFilter';
import BoardPicker from '@/components/BoardPicker';
import PersonSheet from '@/components/PersonSheet';
import { tokens } from '../../theme/tokens';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useUserStore } from '@/store/userStore';
import { useSocialGraphStore } from '@/store/socialGraphStore';
import { useAudience } from '@/store/useAudience';
import { emptyAudienceMessage } from '@/lib/audience';
import {
  DEFAULT_BOARD, boardValue, emptyBoardMessage, formatBoardValue, isDistanceBoard,
} from '@/lib/runLeaderboard';
import { publishMyDistance } from '@/services/distanceBoard';

export default function LeaderboardScreen() {
  const [sheetPerson, setSheetPerson] = useState(null);
  // What the board is ranked by: XP, or distance this week / this month.
  const [board, setBoard] = useState(DEFAULT_BOARD);
  const {
    entries, audienceEntries, isLoading, isLoadingAudience, subscribeTop, unsubscribe, computeMyRank, loadForUids,
  } = useLeaderboardStore();
  const { user } = useUserStore();
  const { audience, setAudience, uids, uidKey } = useAudience('leaderboard', user?.uid);
  const following = useSocialGraphStore((s) => s.following);

  useEffect(() => {
    // Live subscription, not a one-time fetch — this is a genuinely shared,
    // multi-user collection, so it updates in real time as other users'
    // XP changes, not just when this screen happens to reload.
    subscribeTop(50, board);
    return () => unsubscribe();
  }, [board]);

  // Put this person's own weekly and monthly distance on the board (it also
  // covers runs recorded before the distance boards existed).
  useEffect(() => {
    if (user?.uid) publishMyDistance({ user, loadFirst: true });
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) computeMyRank(user.uid);
  }, [entries, user?.uid]);

  // Following / Close Friends: fetch exactly those people (plus you) so
  // someone ranked below the global top 50 still shows up.
  useEffect(() => {
    if (uids !== null) loadForUids(uids, user?.uid, board);
  }, [audience, uidKey, user?.uid, board]);

  const list = audience === 'everyone' ? entries : audienceEntries;
  const loadingList = audience === 'everyone' ? isLoading : isLoadingAudience;

  const nowMs = Date.now();
  const distanceBoard = isDistanceBoard(board);
  // XP shows as a plain number (as it always has); distance as "12.4 km".
  const showPts = (v) => (distanceBoard ? formatBoardValue(board, v) : v);
  const sorted = list.map((e) => ({
    id: e.id, name: e.name || 'Zown User', pts: boardValue(e, board, nowMs), avatar: e.avatar, isMe: e.id === user?.uid,
    isClose: following.some((f) => f.uid === e.id && f.close),
  }));
  // The podium needs three people; with fewer (common when filtering to
  // friends) everyone is shown as a plain ranked row instead.
  const showPodium = sorted.length >= 3;
  const [first, second, third] = showPodium ? sorted : [];
  const rest = showPodium ? sorted.slice(3) : sorted;
  const restStart = showPodium ? 4 : 1;

  const openPerson = (u) => {
    if (u && !u.isMe) setSheetPerson({ uid: u.id, name: u.name, avatar: u.avatar });
  };

  const Avatar = ({ uri, size = 40 }) => (
    uri ? (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F5F5F5' }}
      />
    ) : (
      <View style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: '#F5F5F5',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: '#000000', fontWeight: '700', fontSize: size * 0.35 }}>
          {'?'}
        </Text>
      </View>
    )
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Leaderboard" showBack />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 40 }}>
        <BoardPicker board={board} onChange={setBoard} style={{ marginBottom: 12 }} />
        <AudienceFilter value={audience} onChange={setAudience} style={{ marginBottom: 8 }} />
        <TouchableOpacity onPress={() => router.push('/friends')} style={styles.manageLink}>
          <Text style={styles.manageLinkText}>Manage friends and close friends</Text>
        </TouchableOpacity>

        {loadingList && sorted.length === 0 ? (
          <ActivityIndicator size="large" color="#000000" style={{ marginTop: 40 }} />
        ) : sorted.length === 0 ? (
          <Text style={{ color: '#999999', textAlign: 'center', marginTop: 40 }}>
            {distanceBoard
              ? emptyBoardMessage(board, audience)
              : audience === 'everyone'
                ? 'No rankings yet — complete a workout to be the first on the board.'
                : emptyAudienceMessage('leaderboard', audience)}
          </Text>
        ) : (
          <>

        {showPodium && (
        <View style={styles.podium}>
          <TouchableOpacity style={styles.podiumSpot} activeOpacity={0.7} onPress={() => openPerson(second)}>
            <Avatar uri={second?.avatar} size={56} />
            <Text style={styles.podiumName} numberOfLines={1}>{second?.name}</Text>
            <Text style={styles.podiumPts}>{showPts(second?.pts)}</Text>
            <View style={[styles.podiumBar, { height: 80, backgroundColor: '#F5F5F5' }]}>
              <Text style={styles.podiumPlace}>2</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.podiumSpot} activeOpacity={0.7} onPress={() => openPerson(first)}>
            <Trophy size={20} color="#F59E0B" style={{ marginBottom: 4 }} />
            <Avatar uri={first?.avatar} size={72} />
            <Text style={styles.podiumName} numberOfLines={1}>{first?.name}</Text>
            <Text style={styles.podiumPts}>{showPts(first?.pts)}</Text>
            <View style={[styles.podiumBar, { height: 110, backgroundColor: '#000000' }]}>
              <Text style={[styles.podiumPlace, { color: '#FFFFFF' }]}>1</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.podiumSpot} activeOpacity={0.7} onPress={() => openPerson(third)}>
            <Avatar uri={third?.avatar} size={56} />
            <Text style={styles.podiumName} numberOfLines={1}>{third?.name}</Text>
            <Text style={styles.podiumPts}>{showPts(third?.pts)}</Text>
            <View style={[styles.podiumBar, { height: 60, backgroundColor: '#F5F5F5' }]}>
              <Text style={styles.podiumPlace}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
        )}

        <Text style={styles.sectionLabel}>Rankings</Text>
        {rest.map((u, idx) => (
          <TouchableOpacity
            key={u.id}
            activeOpacity={u.isMe ? 1 : 0.7}
            onPress={() => openPerson(u)}
            style={[styles.row, u.isMe && styles.rowMe]}>
            <Text style={styles.rank}>{idx + restStart}</Text>
            <Avatar uri={u.avatar} />
            <Text style={[styles.name, u.isMe && { color: '#000000', fontWeight: '700' }]}>
              {u.name}{u.isClose ? '  ★' : ''}
            </Text>
            <Text style={styles.pts}>{showPts(u.pts)}</Text>
          </TouchableOpacity>
        ))}
          </>
        )}
      </ScrollView>
      <PersonSheet person={sheetPerson} onClose={() => setSheetPerson(null)} />
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. Two genuine contrast cases here, not direct swaps:
// podiumPlace's default color (used by 2nd/3rd place) sat on bg_card,
// now light gray #F5F5F5 - was white, now black to stay legible; 1st
// place's bar (bg_primary) is now black, so its already-overridden
// white stays as an explicit override rather than the new black
// default. filterTextActive sits on filterPillActive's background
// (bg_primary, now black) - kept white rather than following the
// usual "text_primary becomes black" swap, since black text on the
// now-black active pill would be invisible.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  manageLink: { marginBottom: 20 },
  manageLinkText: { color: '#666666', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  podium: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', gap: tokens.spacing.md, marginBottom: tokens.spacing.lg,
  },
  podiumSpot: { alignItems: 'center', flex: 1 },
  podiumName: {
    color: '#000000', fontSize: 12, fontWeight: '600', marginTop: 6,
    maxWidth: 80,
  },
  podiumPts: { color: '#999999', fontSize: 11, marginTop: 2 },
  podiumBar: {
    width: '100%', marginTop: 8,
    alignItems: 'center', justifyContent: 'center',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  podiumPlace: { color: '#000000', fontSize: 20, fontWeight: '700' },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000000', marginBottom: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md,
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 12, marginBottom: tokens.spacing.sm,
  },
  rowMe: { borderColor: '#000000', borderWidth: 2 },
  rank: { color: '#999999', fontSize: 14, fontWeight: '700', width: 24 },
  name: { color: '#666666', fontSize: 14, fontWeight: '500', flex: 1 },
  pts: { color: '#000000', fontSize: 14, fontWeight: '700' },
});

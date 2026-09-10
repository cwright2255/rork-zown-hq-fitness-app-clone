import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { Trophy } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { tokens } from '../../theme/tokens';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useUserStore } from '@/store/userStore';

const FILTERS = ['Global', 'Friends', 'This Week'];

export default function LeaderboardScreen() {
  const [filter, setFilter] = useState('Global');
  const { entries, isLoading, subscribeTop, unsubscribe, computeMyRank } = useLeaderboardStore();
  const { user } = useUserStore();

  useEffect(() => {
    // Live subscription, not a one-time fetch — this is a genuinely shared,
    // multi-user collection, so it updates in real time as other users'
    // XP changes, not just when this screen happens to reload.
    subscribeTop(50);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.uid) computeMyRank(user.uid);
  }, [entries, user?.uid]);

  const handleFilter = (f) => {
    if (f !== 'Global') {
      // No friends/follow system and no time-windowed XP tracking exist
      // anywhere in this app yet — rather than fake these filters doing
      // something, they're honestly marked not-yet-available.
      Alert.alert(f, `${f} leaderboard is coming soon.`);
      return;
    }
    setFilter(f);
  };

  const sorted = entries.map((e) => ({
    id: e.id, name: e.name, pts: e.xp, avatar: e.avatar, isMe: e.id === user?.uid,
  }));
  const [first, second, third, ...rest] = sorted;

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
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 40 }}>
        <View style={styles.filters}>
          {FILTERS.map(f => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => handleFilter(f)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isLoading && sorted.length === 0 ? (
          <ActivityIndicator size="large" color="#000000" style={{ marginTop: 40 }} />
        ) : sorted.length === 0 ? (
          <Text style={{ color: '#999999', textAlign: 'center', marginTop: 40 }}>
            No rankings yet — complete a workout to be the first on the board.
          </Text>
        ) : (
          <>

        <View style={styles.podium}>
          <View style={styles.podiumSpot}>
            <Avatar uri={second?.avatar} size={56} />
            <Text style={styles.podiumName} numberOfLines={1}>{second?.name}</Text>
            <Text style={styles.podiumPts}>{second?.pts}</Text>
            <View style={[styles.podiumBar, { height: 80, backgroundColor: '#F5F5F5' }]}>
              <Text style={styles.podiumPlace}>2</Text>
            </View>
          </View>
          <View style={styles.podiumSpot}>
            <Trophy size={20} color="#F59E0B" style={{ marginBottom: 4 }} />
            <Avatar uri={first?.avatar} size={72} />
            <Text style={styles.podiumName} numberOfLines={1}>{first?.name}</Text>
            <Text style={styles.podiumPts}>{first?.pts}</Text>
            <View style={[styles.podiumBar, { height: 110, backgroundColor: '#000000' }]}>
              <Text style={[styles.podiumPlace, { color: '#FFFFFF' }]}>1</Text>
            </View>
          </View>
          <View style={styles.podiumSpot}>
            <Avatar uri={third?.avatar} size={56} />
            <Text style={styles.podiumName} numberOfLines={1}>{third?.name}</Text>
            <Text style={styles.podiumPts}>{third?.pts}</Text>
            <View style={[styles.podiumBar, { height: 60, backgroundColor: '#F5F5F5' }]}>
              <Text style={styles.podiumPlace}>3</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Rankings</Text>
        {rest.map((u, idx) => (
          <View key={u.id} style={[styles.row, u.isMe && styles.rowMe]}>
            <Text style={styles.rank}>{idx + 4}</Text>
            <Avatar uri={u.avatar} />
            <Text style={[styles.name, u.isMe && { color: '#000000', fontWeight: '700' }]}>
              {u.name}
            </Text>
            <Text style={styles.pts}>{u.pts}</Text>
          </View>
        ))}
          </>
        )}
      </ScrollView>
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
  android: { elevation: 3 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  filters: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: 20 },
  filterPill: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: 999,
  },
  filterPillActive: { backgroundColor: '#000000' },
  filterText: { color: '#999999', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
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
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: 12,
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

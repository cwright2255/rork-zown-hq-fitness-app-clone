import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
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
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.colors.dark_navy.bg_card }}
      />
    ) : (
      <View style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.colors.dark_navy.bg_card,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: tokens.colors.dark_navy.bg_primary, fontWeight: '700', fontSize: size * 0.35 }}>
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
          <ActivityIndicator size="large" color={tokens.colors.dark_navy.bg_primary} style={{ marginTop: 40 }} />
        ) : sorted.length === 0 ? (
          <Text style={{ color: tokens.colors.dark_navy.text_muted, textAlign: 'center', marginTop: 40 }}>
            No rankings yet — complete a workout to be the first on the board.
          </Text>
        ) : (
          <>

        <View style={styles.podium}>
          <View style={styles.podiumSpot}>
            <Avatar uri={second?.avatar} size={56} />
            <Text style={styles.podiumName} numberOfLines={1}>{second?.name}</Text>
            <Text style={styles.podiumPts}>{second?.pts}</Text>
            <View style={[styles.podiumBar, { height: 80, backgroundColor: tokens.colors.dark_navy.bg_card }]}>
              <Text style={styles.podiumPlace}>2</Text>
            </View>
          </View>
          <View style={styles.podiumSpot}>
            <Trophy size={20} color="#F59E0B" style={{ marginBottom: 4 }} />
            <Avatar uri={first?.avatar} size={72} />
            <Text style={styles.podiumName} numberOfLines={1}>{first?.name}</Text>
            <Text style={styles.podiumPts}>{first?.pts}</Text>
            <View style={[styles.podiumBar, { height: 110, backgroundColor: tokens.colors.dark_navy.bg_primary }]}>
              <Text style={[styles.podiumPlace, { color: tokens.colors.dark_navy.text_primary }]}>1</Text>
            </View>
          </View>
          <View style={styles.podiumSpot}>
            <Avatar uri={third?.avatar} size={56} />
            <Text style={styles.podiumName} numberOfLines={1}>{third?.name}</Text>
            <Text style={styles.podiumPts}>{third?.pts}</Text>
            <View style={[styles.podiumBar, { height: 60, backgroundColor: tokens.colors.dark_navy.bg_card }]}>
              <Text style={styles.podiumPlace}>3</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Rankings</Text>
        {rest.map((u, idx) => (
          <View key={u.id} style={[styles.row, u.isMe && styles.rowMe]}>
            <Text style={styles.rank}>{idx + 4}</Text>
            <Avatar uri={u.avatar} />
            <Text style={[styles.name, u.isMe && { color: tokens.colors.dark_navy.bg_primary, fontWeight: '700' }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  filters: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: 20 },
  filterPill: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: 999,
  },
  filterPillActive: { backgroundColor: tokens.colors.dark_navy.bg_primary, borderColor: tokens.colors.dark_navy.bg_primary },
  filterText: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: tokens.colors.dark_navy.text_primary },
  podium: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'center', gap: tokens.spacing.md, marginBottom: tokens.spacing.lg,
  },
  podiumSpot: { alignItems: 'center', flex: 1 },
  podiumName: {
    color: tokens.colors.dark_navy.bg_primary, fontSize: 12, fontWeight: '600', marginTop: 6,
    maxWidth: 80,
  },
  podiumPts: { color: tokens.colors.dark_navy.text_muted, fontSize: 11, marginTop: 2 },
  podiumBar: {
    width: '100%', marginTop: 8,
    alignItems: 'center', justifyContent: 'center',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  podiumPlace: { color: tokens.colors.dark_navy.bg_primary, fontSize: 20, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: tokens.colors.dark_navy.text_muted, marginBottom: 12,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md,
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: 12, marginBottom: tokens.spacing.sm,
  },
  rowMe: { borderColor: tokens.colors.dark_navy.bg_primary, borderWidth: 2 },
  rank: { color: tokens.colors.dark_navy.text_muted, fontSize: 14, fontWeight: '700', width: 24 },
  name: { color: tokens.colors.dark_navy.text_muted, fontSize: 14, fontWeight: '500', flex: 1 },
  pts: { color: tokens.colors.dark_navy.bg_primary, fontSize: 14, fontWeight: '700' },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Trophy } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const DATA = [
  { id: '1', name: 'Sarah Johnson', pts: 1250, isMe: false, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
  { id: '2', name: 'Michael Chen', pts: 1180, isMe: false, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
  { id: '3', name: 'Jessica Williams', pts: 1050, isMe: false, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200' },
  { id: '4', name: 'You', pts: 980, isMe: true, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
  { id: '5', name: 'Emma Thompson', pts: 920, isMe: false, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' },
  { id: '6', name: 'James Wilson', pts: 880, isMe: false, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200' },
  { id: '7', name: 'Olivia Martinez', pts: 820, isMe: false, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200' },
];

const FILTERS = ['Global', 'Friends', 'This Week'];

export default function LeaderboardScreen() {
  const [filter, setFilter] = useState('Global');
  const sorted = [...DATA].sort((a, b) => b.pts - a.pts);
  const [first, second, third, ...rest] = sorted;

  const Avatar = ({ uri, size = 40 }) => (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokens.colors.dark_navy.bg_card }}
    />
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
                onPress={() => setFilter(f)}
                style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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

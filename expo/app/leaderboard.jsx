import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Search, Users, Globe, Trophy } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const DATA = [
  { id: '1', name: 'Sarah Johnson', pts: 1250, isMe: false, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
  { id: '2', name: 'Michael Chen', pts: 1180, isMe: false, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' },
  { id: '3', name: 'Jessica Williams', pts: 1050, isMe: false, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200' },
  { id: '4', name: 'You', pts: 980, isMe: true, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
  { id: '5', name: 'Emma Thompson', pts: 920, isMe: false, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' },
  { id: '6', name: 'James Wilson', pts: 880, isMe: false, avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200' },
  { id: '7', name: 'Olivia Martinez', pts: 820, isMe: false, avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200' },
  { id: '8', name: 'Daniel Lee', pts: 780, isMe: false, avatar: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200' },
];

const FILTERS = [
  { label: 'Global', value: 'global', Icon: Globe },
  { label: 'Friends', value: 'friends', Icon: Users },
];

function Podium({ first, second, third }) {
  return (
    <View style={podium.row}>
      <PodiumSpot place={2} user={second} height={100} />
      <PodiumSpot place={1} user={first} height={140} crown />
      <PodiumSpot place={3} user={third} height={80} />
    </View>
  );
}

function PodiumSpot({ place, user, height, crown }) {
  if (!user) return <View style={[podium.spot, { height }]} />;
  return (
    <View style={podium.spotWrap}>
      <View style={podium.avatarWrap}>
        {crown && <Trophy size={18} color={colors.text} style={podium.crown} />}
        <Image source={{ uri: user.avatar }} style={podium.avatar} />
      </View>
      <Text style={podium.name} numberOfLines={1}>{user.name}</Text>
      <Text style={podium.pts}>{user.pts.toLocaleString()} pts</Text>
      <View style={[podium.block, { height }]}>
        <Text style={podium.place}>{place}</Text>
      </View>
    </View>
  );
}

const podium = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.md, marginVertical: spacing.lg, gap: spacing.sm },
  spotWrap: { flex: 1, alignItems: 'center', maxWidth: 120 },
  spot: { flex: 1 },
  avatarWrap: { alignItems: 'center', marginBottom: spacing.sm, position: 'relative' },
  crown: { marginBottom: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.text, backgroundColor: colors.card },
  name: { ...typography.body, fontWeight: '700', textAlign: 'center' },
  pts: { ...typography.caption, marginBottom: spacing.sm },
  block: {
    width: '100%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  place: { fontSize: 36, fontWeight: '900', color: colors.text, letterSpacing: 1 },
});

export default function LeaderboardScreen() {
  const [scope, setScope] = useState('global');

  const sorted = useMemo(() => [...DATA].sort((a, b) => b.pts - a.pts).map((u, i) => ({ ...u, rank: i + 1 })), []);
  const [first, second, third, ...rest] = sorted;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Text style={styles.title}>LEADERBOARD</Text>
        <TouchableOpacity style={styles.searchBtn} accessibilityLabel="Search">
          <Search size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.scopeRow}>
        {FILTERS.map(({ label, value, Icon }) => {
          const active = scope === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => setScope(value)}
              style={[styles.scopePill, active && styles.scopePillActive]}
            >
              <Icon size={14} color={active ? colors.bg : colors.textSecondary} />
              <Text style={[styles.scopeText, active && styles.scopeTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <Podium first={first} second={second} third={third} />

        <View style={styles.list}>
          {rest.map((user) => (
            <View key={user.id} style={[styles.row, user.isMe && styles.rowMe]}>
              <Text style={[styles.rank, user.isMe && styles.rankMe]}>{user.rank}</Text>
              <Image source={{ uri: user.avatar }} style={styles.rowAvatar} />
              <Text style={[styles.rowName, user.isMe && styles.rowNameMe]} numberOfLines={1}>{user.name}</Text>
              <Text style={[styles.rowPts, user.isMe && styles.rowPtsMe]}>{user.pts.toLocaleString()} pts</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { ...typography.h1 },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scopePillActive: { backgroundColor: colors.text, borderColor: colors.text },
  scopeText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  scopeTextActive: { color: colors.bg },
  body: { flex: 1 },
  bodyContent: { paddingBottom: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  rowMe: { backgroundColor: colors.text, borderColor: colors.text },
  rank: { width: 28, ...typography.body, fontWeight: '800', color: colors.textSecondary, textAlign: 'center' },
  rankMe: { color: colors.bg },
  rowAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface },
  rowName: { flex: 1, ...typography.body, fontWeight: '700' },
  rowNameMe: { color: colors.bg },
  rowPts: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  rowPtsMe: { color: colors.bg },
});

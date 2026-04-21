import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Flame, Dumbbell, Target, Zap, Users, Lock, Clock } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const SEASONS = [
  {
    name: 'Season 01',
    status: 'Completed',
    locked: false,
    challenges: [
      { icon: Flame, title: 'Streak Mode', percent: 100 },
      { icon: Dumbbell, title: 'Iron Grind', percent: 100 },
      { icon: Target, title: 'Precision', percent: 85 },
      { icon: Zap, title: 'Sprint It', percent: 72 },
    ],
  },
  {
    name: 'Season 02',
    status: 'In Progress',
    locked: false,
    challenges: [
      { icon: Flame, title: 'Cardio King', percent: 58 },
      { icon: Dumbbell, title: 'Strength PR', percent: 33 },
      { icon: Target, title: 'Form Focus', percent: 42 },
      { icon: Zap, title: 'HIIT Blitz', percent: 12 },
    ],
  },
  {
    name: 'Season 03',
    status: 'Starts in 14d 06h',
    locked: true,
    challenges: [],
  },
];

export default function CommunityScreen() {
  const totalActive = useMemo(() => SEASONS.reduce((sum, s) => sum + s.challenges.filter((c) => c.percent < 100).length, 0), []);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>CHALLENGES</Text>
          <TouchableOpacity
            style={styles.friendsBtn}
            onPress={() => router.push('/leaderboard')}
            accessibilityLabel="Friends"
          >
            <Users size={16} color={colors.text} />
            <Text style={styles.friendsText}>Friends</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>ACTIVE CHALLENGES</Text>
          <Text style={styles.summaryValue}>{totalActive}</Text>
        </View>

        {SEASONS.map((season) => (
          <View key={season.name} style={styles.season}>
            <View style={styles.seasonHeader}>
              <Text style={styles.seasonName}>{season.name}</Text>
              <View style={[styles.statusPill, season.locked && styles.statusPillLocked]}>
                {season.locked ? (
                  <Clock size={12} color={colors.textSecondary} />
                ) : season.status === 'Completed' ? (
                  <View style={styles.dotCompleted} />
                ) : (
                  <View style={styles.dotActive} />
                )}
                <Text style={styles.statusText}>{season.status}</Text>
              </View>
            </View>

            {season.locked ? (
              <View style={styles.lockedCard}>
                <Lock size={28} color={colors.textMuted} />
                <Text style={styles.lockedText}>Unlocks when timer ends</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {season.challenges.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <TouchableOpacity key={i} style={styles.card} activeOpacity={0.8}>
                      <View style={styles.iconCircle}>
                        <Icon size={20} color={colors.text} />
                      </View>
                      <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: `${c.percent}%` }]} />
                      </View>
                      <View style={styles.cardFooter}>
                        <Text style={styles.pct}>{c.percent}%</Text>
                        <TouchableOpacity>
                          <Text style={styles.trackLink}>Track Friends</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { ...typography.h1 },
  friendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  friendsText: { ...typography.caption, color: colors.text, fontWeight: '700' },
  summaryCard: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  summaryLabel: { ...typography.label, marginBottom: spacing.xs },
  summaryValue: { fontSize: 48, fontWeight: '900', color: colors.text, letterSpacing: 1 },
  season: { marginBottom: spacing.xl },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  seasonName: { ...typography.h3, letterSpacing: 1, textTransform: 'uppercase' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPillLocked: { opacity: 0.8 },
  dotActive: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.text },
  dotCompleted: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary },
  statusText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.body, fontWeight: '700', marginBottom: spacing.sm },
  track: { height: 4, borderRadius: radius.full, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.progressFill, borderRadius: radius.full },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  pct: { ...typography.caption, color: colors.text, fontWeight: '700' },
  trackLink: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', textDecorationLine: 'underline' },
  lockedCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: spacing.sm,
  },
  lockedText: { ...typography.caption },
});

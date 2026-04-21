import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Award, Flame, Zap, Medal, Target, Trophy, Crown, Star, Dumbbell } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAchievementStore } from '@/store/achievementStore';
import { useUserStore } from '@/store/userStore';

const BADGE_ICONS = [Flame, Zap, Medal, Target, Trophy, Crown, Star, Dumbbell, Award];

function ProgressRing({ percent = 0, size = 160, stroke = 6 }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const degrees = (clamped / 100) * 360;
  const isOver180 = degrees > 180;
  const rotateFirst = Math.min(degrees, 180);
  const rotateSecond = isOver180 ? degrees - 180 : 0;
  return (
    <View style={[ringStyles.wrap, { width: size, height: size }]}>
      <View style={[ringStyles.track, { width: size, height: size, borderRadius: size / 2, borderWidth: stroke }]} />
      <View
        style={[
          ringStyles.half,
          { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, transform: [{ rotate: `${rotateFirst}deg` }] },
        ]}
      />
      {isOver180 && (
        <View
          style={[
            ringStyles.half,
            { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, transform: [{ rotate: `${180 + rotateSecond}deg` }] },
          ]}
        />
      )}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', borderColor: colors.progressTrack },
  half: {
    position: 'absolute',
    borderColor: 'transparent',
    borderTopColor: colors.progressFill,
    borderRightColor: colors.progressFill,
  },
});

export default function AchievementsScreen() {
  const { achievements, initializeAchievements, getUnlockedAchievements } = useAchievementStore();
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (!achievements || achievements.length === 0) initializeAchievements();
  }, [achievements, initializeAchievements]);

  const unlocked = getUnlockedAchievements();
  const xp = user?.xp ?? 27975;
  const level = user?.level ?? 12;
  const position = 2;
  const nextLevelXp = (level + 1) * 1000;
  const currentLevelXp = level * 1000;
  const levelProgress = Math.min(100, Math.max(0, ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));

  const seasons = useMemo(() => {
    const list = achievements && achievements.length ? achievements : Array.from({ length: 6 }).map((_, i) => ({
      id: `a${i}`,
      title: ['Run', 'Lift', 'Mind', 'Burn', 'Streak', 'Hydrate'][i],
      progress: [72, 45, 90, 30, 100, 58][i],
      isUnlocked: i === 4,
    }));
    return [
      { name: 'Season 01', status: 'Completed', items: list.slice(0, 4) },
      { name: 'Season 02', status: 'In Progress', items: list.slice(4, 8) },
    ];
  }, [achievements]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>ACHIEVEMENTS</Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <ProgressRing percent={levelProgress} size={160} stroke={4} />
            <View style={styles.avatarInner}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{(user?.name || 'Z').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.xpValue}>{xp.toLocaleString()} XP</Text>
          <Text style={styles.subtitle}>
            Lv. {level} · {position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`} Place
          </Text>
        </View>

        <Text style={styles.sectionLabel}>BADGES</Text>
        <View style={styles.badgeGrid}>
          {Array.from({ length: 9 }).map((_, i) => {
            const Icon = BADGE_ICONS[i % BADGE_ICONS.length];
            const isUnlocked = i < unlocked.length || i < 4;
            return (
              <View key={i} style={styles.badgeCell}>
                <View style={[styles.badgeCircle, !isUnlocked && styles.badgeLocked]}>
                  <Icon size={28} color={isUnlocked ? colors.text : colors.textMuted} />
                </View>
                <Text style={[styles.badgeLabel, !isUnlocked && { color: colors.textMuted }]}>
                  {['Fire', 'Speed', 'Elite', 'Focus', 'Champ', 'King', 'Star', 'Strong', 'Pro'][i]}
                </Text>
              </View>
            );
          })}
        </View>

        {seasons.map((season) => (
          <View key={season.name} style={styles.seasonBlock}>
            <View style={styles.seasonHeader}>
              <Text style={styles.seasonName}>{season.name}</Text>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{season.status}</Text>
              </View>
            </View>
            <View style={styles.challengePair}>
              {season.items.slice(0, 2).map((it, idx) => {
                const pct = typeof it.progress === 'number' ? it.progress : 50;
                return (
                  <View key={it.id || idx} style={styles.challengeCard}>
                    <Text style={styles.challengeTitle}>{it.title || `Challenge ${idx + 1}`}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={styles.challengePct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: { ...typography.h1, textAlign: 'center', marginBottom: spacing.lg },
  avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
  avatarWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  avatarInner: {
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: 'hidden',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  avatarInitial: { fontSize: 48, fontWeight: '900', color: colors.text },
  xpValue: { ...typography.h2, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  sectionLabel: { ...typography.label, marginBottom: spacing.md, marginTop: spacing.md },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.lg },
  badgeCell: { width: '31%', alignItems: 'center', marginBottom: spacing.lg },
  badgeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeLocked: { opacity: 0.4 },
  badgeLabel: { ...typography.caption, color: colors.text, fontWeight: '600' },
  seasonBlock: { marginTop: spacing.lg },
  seasonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  seasonName: { ...typography.h3, letterSpacing: 1, textTransform: 'uppercase' },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statusText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  challengePair: { flexDirection: 'row', gap: spacing.md },
  challengeCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  challengeTitle: { ...typography.body, fontWeight: '700', marginBottom: spacing.sm },
  progressTrack: { height: 4, borderRadius: radius.full, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.progressFill, borderRadius: radius.full },
  challengePct: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, fontWeight: '600' },
});

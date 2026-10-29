import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Award, Flame, Zap, Medal, Target, Trophy, Crown, Star, Dumbbell, ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useAchievementStore } from '@/store/achievementStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';

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
  const { achievements, initializeAchievements, getUnlockedAchievements, getLockedAchievements, loadAchievements } = useAchievementStore();
  const { badges, loadBadges } = useBadgeStore();
  const { loadXP, getLevel, getExpForLevel, getTotalExp } = useExpStore();
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (!achievements || achievements.length === 0) initializeAchievements();
  }, [achievements, initializeAchievements]);

  useEffect(() => {
    if (user?.uid) {
      loadXP(user.uid);
      loadAchievements(user.uid);
      loadBadges(user.uid);
    }
  }, [user?.uid]);

  const unlocked = getUnlockedAchievements();
  const locked = getLockedAchievements();

  // XP and level are read the way the Profile screen reads them (store/expStore.js), so the two always agree.
  const totalXp = Math.round(getTotalExp() || 0);
  const level = getLevel();
  const levelStart = getExpForLevel(level);
  const levelSize = Math.max(1, getExpForLevel(level + 1) - levelStart);
  const levelProgress = Math.min(100, Math.max(0, ((getTotalExp() || 0) - levelStart) / levelSize * 100));

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back" hitSlop={8}>
            <ChevronLeft size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.pageTitle}>ACHIEVEMENTS</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <ProgressRing percent={levelProgress} size={160} stroke={4} />
            <View style={styles.avatarInner}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{(user?.name || 'Z').charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.xpValue}>{totalXp.toLocaleString()} XP</Text>
          <Text style={styles.subtitle}>Level {level}</Text>
        </View>

        <Text style={styles.sectionLabel}>BADGES</Text>
        <View style={styles.badgeGrid}>
          {(badges || []).map((badge, i) => {
            const Icon = BADGE_ICONS[i % BADGE_ICONS.length];
            const isUnlocked = !!badge.isUnlocked;
            return (
              <View key={badge.id} style={styles.badgeCell}>
                <View style={[styles.badgeCircle, !isUnlocked && styles.badgeLocked]}>
                  <Icon size={28} color={isUnlocked ? colors.text : colors.textMuted} />
                </View>
                <Text style={[styles.badgeLabel, !isUnlocked && { color: colors.textMuted }]} numberOfLines={2}>
                  {badge.name}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{`${unlocked.length} OF ${achievements.length} UNLOCKED`}</Text>
        {[...unlocked.map((a) => [a, true]), ...locked.map((a) => [a, false])].map(([a, isUnlocked]) => {
          return (
            <View key={a.id} style={[styles.achievementRow, !isUnlocked && styles.achievementLocked]}>
              <Text style={styles.achievementIcon}>{a.icon}</Text>
              <View style={styles.achievementText}>
                <Text style={styles.achievementName}>{a.name}</Text>
                <Text style={styles.achievementDesc}>{a.description}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{isUnlocked ? 'Unlocked' : 'Locked'}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 32, alignItems: 'flex-start' },
  pageTitle: { ...typography.h1, textAlign: 'center' },
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
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  statusText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  achievementLocked: { opacity: 0.55 },
  achievementIcon: { fontSize: 26, marginRight: spacing.md },
  achievementText: { flex: 1, marginRight: spacing.sm },
  achievementName: { ...typography.body, fontWeight: '700' },
  achievementDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});

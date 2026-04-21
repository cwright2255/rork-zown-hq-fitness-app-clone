import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  Dumbbell,
  Utensils,
  Users,
  ShoppingBag,
  Flame,
  Heart,
  Moon,
  TrendingUp,
  ChevronRight,
  Play,
} from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';

function Stat({ icon: Icon, value, label }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIconWrap}>
        <Icon size={16} color={colors.text} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon: Icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.qa} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.qaIcon}>
        <Icon size={22} color={colors.text} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HQScreen() {
  const router = useRouter();
  const { user, initializeDefaultUser } = useUserStore();
  const { expSystem, getLevel } = useExpStore();
  const { workouts, initializeDefaultWorkouts } = useWorkoutStore();

  const hasInitializedUser = useRef(false);
  useEffect(() => {
    if (!user && !hasInitializedUser.current) {
      hasInitializedUser.current = true;
      initializeDefaultUser();
    }
  }, [user, initializeDefaultUser]);

  const hasInitializedWorkouts = useRef(false);
  useEffect(() => {
    if ((!workouts || workouts.length === 0) && !hasInitializedWorkouts.current) {
      hasInitializedWorkouts.current = true;
      requestAnimationFrame(() => initializeDefaultWorkouts());
    }
  }, []);

  const level = user?.level || getLevel() || 1;
  const xp = user?.exp || user?.xp || expSystem?.totalExp || 27975;

  const todaysMission = useMemo(() => {
    const list = workouts || [];
    return list[0] || { id: 'default', name: 'Full Body Burn', duration: 32, difficulty: 'INTENSE' };
  }, [workouts]);

  const onStartMission = useCallback(() => {
    if (todaysMission?.id) router.push(`/workout/${todaysMission.id}`);
  }, [router, todaysMission]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>HELLO, {(user?.name || 'ATHLETE').split(' ')[0].toUpperCase()}</Text>
            <Text style={styles.title}>ZOWN HQ</Text>
          </View>
          <TouchableOpacity style={styles.xpBadge} onPress={() => router.push('/exp-dashboard')} activeOpacity={0.8}>
            <Text style={styles.xpLevel}>LVL {level}</Text>
            <Text style={styles.xpValue}>{xp.toLocaleString()} XP</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Stat icon={TrendingUp} value="8,432" label="STEPS" />
          <Stat icon={Flame} value="614" label="KCAL" />
          <Stat icon={Heart} value="72" label="BPM" />
        </View>

        <Text style={styles.sectionLabel}>TODAY&apos;S MISSION</Text>
        <TouchableOpacity style={styles.missionCard} onPress={onStartMission} activeOpacity={0.85}>
          <View style={styles.missionHeader}>
            <Text style={styles.missionLabel}>LIVE SESSION</Text>
            <View style={styles.missionPill}>
              <Text style={styles.missionPillText}>{todaysMission?.difficulty || 'INTENSE'}</Text>
            </View>
          </View>
          <Text style={styles.missionTitle} numberOfLines={2}>{todaysMission?.name || 'Full Body Burn'}</Text>
          <View style={styles.missionFooter}>
            <Text style={styles.missionMeta}>{todaysMission?.duration || 32} MIN</Text>
            <View style={styles.playBtn}>
              <Play size={16} color={colors.bg} fill={colors.bg} />
              <Text style={styles.playBtnText}>START</Text>
            </View>
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.qaGrid}>
          <QuickAction icon={Dumbbell} label="Workouts" onPress={() => router.push('/workouts')} />
          <QuickAction icon={Utensils} label="Nutrition" onPress={() => router.push('/nutrition')} />
          <QuickAction icon={Users} label="Community" onPress={() => router.push('/community')} />
          <QuickAction icon={ShoppingBag} label="Shop" onPress={() => router.push('/shop')} />
        </View>

        <Text style={styles.sectionLabel}>WEARABLES</Text>
        <View style={styles.wearRow}>
          <View style={styles.wearCard}>
            <Heart size={18} color={colors.text} />
            <Text style={styles.wearValue}>72 bpm</Text>
            <Text style={styles.wearLabel}>Resting HR</Text>
          </View>
          <View style={styles.wearCard}>
            <Moon size={18} color={colors.text} />
            <Text style={styles.wearValue}>7h 42m</Text>
            <Text style={styles.wearLabel}>Sleep</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.leaderLink} onPress={() => router.push('/leaderboard')} activeOpacity={0.85}>
          <Text style={styles.leaderLinkText}>VIEW LEADERBOARD</Text>
          <ChevronRight size={18} color={colors.text} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  hello: { ...typography.label, marginBottom: spacing.xs },
  title: { ...typography.h1, fontSize: 36 },
  xpBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  xpLevel: { ...typography.label, color: colors.textSecondary },
  xpValue: { ...typography.body, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  statIconWrap: { marginBottom: spacing.sm },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text },
  statLabel: { ...typography.label, marginTop: 2 },
  sectionLabel: { ...typography.label, marginBottom: spacing.md, marginTop: spacing.md },
  missionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  missionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  missionLabel: { ...typography.label },
  missionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.text,
  },
  missionPillText: { ...typography.caption, fontWeight: '800', color: colors.text, fontSize: 10, letterSpacing: 1 },
  missionTitle: { fontSize: 28, fontWeight: '900', color: colors.text, marginBottom: spacing.md },
  missionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missionMeta: { ...typography.body, fontWeight: '700', color: colors.textSecondary },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
  playBtnText: { color: colors.bg, fontWeight: '900', letterSpacing: 1 },
  qaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  qa: {
    width: '48%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 96,
  },
  qaIcon: {
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
  qaLabel: { ...typography.body, fontWeight: '800' },
  wearRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  wearCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  wearValue: { fontSize: 20, fontWeight: '900', color: colors.text },
  wearLabel: { ...typography.label },
  leaderLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  leaderLinkText: { ...typography.body, fontWeight: '800', letterSpacing: 1 },
});

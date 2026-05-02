import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
import { tokens } from '../../theme/tokens';
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
  CheckSquare,
  Square,
} from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import StatCard from '@/components/StatCard';
import ScreenHeader from '@/components/ScreenHeader';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';
import {
  getMuscleVisualizeUrl,
  normalizeMuscleNames,
} from '@/services/muscleVisualizerService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_VALUES = [40, 65, 50, 80, 70, 55, 90];

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

function StatChip({ value, label }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function WeeklyChart() {
  const todayIdx = new Date().getDay();
  return (
    <View style={styles.chartCard}>
      <View style={styles.chartBars}>
        {WEEK_VALUES.map((v, i) => {
          const isToday = i === todayIdx;
          return (
            <View key={i} style={styles.chartCol}>
              <View style={[styles.bar, { height: v, backgroundColor: isToday ? colors.text : 'transparent', borderColor: isToday ? colors.text : colors.border }]} />
              <Text style={[styles.chartDay, isToday && styles.chartDayActive]}>{DAYS[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TaskRow({ name, done, thumbUrl, onPress }) {
  const Icon = done ? CheckSquare : Square;
  const [imgError, setImgError] = React.useState(false);
  const showThumb = !!thumbUrl && !imgError;
  return (
    <TouchableOpacity style={styles.taskRow} onPress={onPress} activeOpacity={0.8}>
      <Icon size={22} color={done ? colors.text : colors.textSecondary} />
      <View style={styles.taskThumb}>
        <Dumbbell size={18} color={colors.text} />
      </View>
      <Text style={[styles.taskName, done && styles.taskNameDone]} numberOfLines={1}>{name}</Text>
      {showThumb && (
        <Image
          source={{ uri: thumbUrl }}
          style={styles.muscleThumb}
          resizeMode="contain"
          onError={() => setImgError(true)}
        />
      )}
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
  const firstName = (user?.name || 'Champion').split(' ')[0];

  const todaysMission = useMemo(() => {
    const list = workouts || [];
    return list[0] || { id: 'default', name: 'Full Body Burn', duration: 32, difficulty: 'INTENSE' };
  }, [workouts]);

  const taskItems = useMemo(() => {
    const list = (workouts || []).slice(0, 4);
    const buildThumb = (muscles) => {
      const normalized = normalizeMuscleNames(muscles || []);
      return getMuscleVisualizeUrl({ muscles: normalized, color: '#E74C3C' });
    };
    if (list.length === 0) {
      return [
        { id: '1', name: 'Full Body Burn', done: true, thumbUrl: buildThumb(['CHEST']) },
        { id: '2', name: 'Morning Cardio', done: false, thumbUrl: buildThumb(['QUADS']) },
        { id: '3', name: 'Core Strength', done: false, thumbUrl: buildThumb(['ABS']) },
      ];
    }
    return list.map((w, i) => {
      const muscles = w.targetMuscles || w.muscleGroups || ['CHEST'];
      return {
        id: w.id,
        name: w.name,
        done: i === 0,
        thumbUrl: buildThumb(muscles),
      };
    });
  }, [workouts]);

  const goalReach = user?.stats?.goalsReached || 156;
  const taskComplete = user?.stats?.tasksComplete || 153;

  const onStartMission = useCallback(() => {
    if (todaysMission?.id) router.push(`/workout/${todaysMission.id}`);
  }, [router, todaysMission]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title={`Hi, ${firstName}`}
        subtitle="OWN THE DAY"
        rightAction={
          <TouchableOpacity style={styles.xpBadge} onPress={() => router.push('/exp-dashboard')} activeOpacity={0.8}>
            <Text style={styles.xpLevel}>LVL {level}</Text>
            <Text style={styles.xpValue}>{xp.toLocaleString()}</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard value="8,432" label="Steps" icon={<TrendingUp size={16} color={colors.text} />} />
          <StatCard value="614" label="Kcal" icon={<Flame size={16} color={colors.text} />} />
          <StatCard value="72" label="BPM" icon={<Heart size={16} color={colors.text} />} />
        </View>

        <Text style={styles.sectionLabel}>THIS WEEK</Text>
        <WeeklyChart />

        <View style={styles.chipsRow}>
          <StatChip value={String(goalReach)} label="Goal Reach" />
          <StatChip value={String(taskComplete)} label="Task Complete" />
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

        <View style={styles.taskHeader}>
          <Text style={styles.sectionLabel}>TASK TODAY</Text>
          <TouchableOpacity onPress={() => router.push('/workouts')}>
            <Text style={styles.showAll}>Show all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.taskList}>
          {taskItems.map((t) => (
            <TaskRow
              key={t.id}
              name={t.name}
              done={t.done}
              thumbUrl={t.thumbUrl}
              onPress={() => router.push(`/workout/${t.id}`)}
            />
          ))}
        </View>

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

        <TouchableOpacity style={styles.upgradeCard} onPress={() => router.push('/champion-pass')} activeOpacity={0.9}>
          <View style={styles.upgradeImage}>
            <Flame size={28} color={colors.text} />
          </View>
          <View style={styles.upgradeBody}>
            <Text style={styles.upgradeLabel}>CHAMPION PASS</Text>
            <Text style={styles.upgradeText}>Unlock premium workouts, coaching & nutrition plans.</Text>
            <View style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnText}>Upgrade Now</Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greeting: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  greetingName: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: 0.5 },
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
  chipsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  chip: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  chipValue: { fontSize: 28, fontWeight: '900', color: colors.text },
  chipLabel: { ...typography.label, marginTop: 2 },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 14, borderRadius: 7, borderWidth: 1, marginBottom: spacing.sm },
  chartDay: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  chartDayActive: { color: colors.text },
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
  taskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  showAll: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  taskList: { gap: spacing.sm, marginBottom: spacing.xl },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  taskThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskName: { ...typography.body, fontWeight: '800', flex: 1 },
  taskNameDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  muscleThumb: { width: 60, height: 60, borderRadius: 4, backgroundColor: tokens.colors.ink.darker },
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
    marginBottom: spacing.xl,
  },
  leaderLinkText: { ...typography.body, fontWeight: '800', letterSpacing: 1 },
  upgradeCard: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.ink.darker,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  upgradeImage: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBody: { flex: 1, gap: spacing.sm },
  upgradeLabel: { ...typography.label, color: colors.text, letterSpacing: 1 },
  upgradeText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  upgradeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  upgradeBtnText: { color: colors.bg, fontWeight: '900', fontSize: 12 },
});

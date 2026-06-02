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
  CheckSquare,
  Square,
} from 'lucide-react-native';
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
import { tokens } from '../../theme/tokens';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_VALUES = [40, 65, 50, 80, 70, 55, 90];

function Stat({ icon: Icon, value, label }) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIconWrap}>
        <Icon size={18} color={tokens.colors.brand.base} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WeeklyChart() {
  const maxVal = Math.max(...WEEK_VALUES);
  const today = new Date().getDay();
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>Weekly Activity</Text>
      <View style={styles.chartBars}>
        {DAYS.map((day, i) => {
          const height = (WEEK_VALUES[i] / maxVal) * 100;
          const isToday = i === today;
          return (
            <View key={day} style={styles.chartBarCol}>
              <View style={styles.chartBarTrack}>
                <View
                  style={[
                    styles.chartBarFill,
                    { height: height + '%' },
                    isToday && styles.chartBarToday,
                  ]}
                />
              </View>
              <Text style={[styles.chartDayLabel, isToday && styles.chartDayLabelActive]}>
                {day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function QuickAction({ icon: Icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Icon size={22} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function DailyGoal({ label, current, target, done }) {
  const pct = Math.min((current / target) * 100, 100);
  return (
    <View style={styles.goalRow}>
      {done ? (
        <CheckSquare size={20} color={tokens.colors.green.base} />
      ) : (
        <Square size={20} color={tokens.colors.dark_navy.text_muted} />
      )}
      <View style={styles.goalInfo}>
        <Text style={styles.goalLabel}>{label}</Text>
        <View style={styles.goalBarTrack}>
          <View style={[styles.goalBarFill, { width: pct + '%' }]} />
        </View>
      </View>
      <Text style={styles.goalCount}>
        {current}/{target}
      </Text>
    </View>
  );
}

export default function HQScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const { totalExp, level } = useExpStore();
  const { completedWorkouts } = useWorkoutStore();
  const displayName = user?.name || 'Athlete';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const recentMuscles = useMemo(() => {
    if (!completedWorkouts || completedWorkouts.length === 0) return [];
    const last = completedWorkouts[completedWorkouts.length - 1];
    return normalizeMuscleNames(last.targetMuscles || []);
  }, [completedWorkouts]);

  const muscleUrl = useMemo(
    () => (recentMuscles.length > 0 ? getMuscleVisualizeUrl(recentMuscles) : null),
    [recentMuscles]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.nameText}>{displayName}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv {level}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <Stat icon={Flame} value={completedWorkouts?.length || 0} label="Workouts" />
          <Stat icon={TrendingUp} value={totalExp || 0} label="Total XP" />
          <Stat icon={Heart} value="72" label="Avg BPM" />
          <Stat icon={Moon} value="7.5h" label="Sleep" />
        </View>

        {/* Weekly Chart */}
        <WeeklyChart />

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon={Dumbbell}
            label="Workouts"
            color={tokens.colors.brand.base}
            onPress={() => router.push('/workouts')}
          />
          <QuickAction
            icon={Utensils}
            label="Nutrition"
            color={tokens.colors.green.base}
            onPress={() => router.push('/nutrition')}
          />
          <QuickAction
            icon={Users}
            label="Community"
            color={tokens.colors.blue.base}
            onPress={() => router.push('/community')}
          />
          <QuickAction
            icon={ShoppingBag}
            label="Shop"
            color={tokens.colors.yellow.base}
            onPress={() => router.push('/shop')}
          />
        </View>

        {/* Daily Goals */}
        <Text style={styles.sectionTitle}>Daily Goals</Text>
        <View style={styles.card}>
          <DailyGoal label="Complete a workout" current={completedWorkouts?.length || 0} target={1} done={(completedWorkouts?.length || 0) >= 1} />
          <DailyGoal label="Drink 8 glasses of water" current={5} target={8} done={false} />
          <DailyGoal label="Walk 10,000 steps" current={7200} target={10000} done={false} />
        </View>

        {/* Muscle Map */}
        {muscleUrl ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Muscle Groups</Text>
            <Image source={{ uri: muscleUrl }} style={styles.muscleImage} resizeMode="contain" />
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.dark_navy.bg_primary,
  },
  scroll: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
  },
  greetingText: {
    fontSize: 16,
    color: tokens.colors.dark_navy.text_secondary,
    fontWeight: '400',
  },
  nameText: {
    fontSize: 26,
    color: tokens.colors.dark_navy.text_primary,
    fontWeight: '700',
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: tokens.colors.brand.base + '20',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.full,
  },
  levelText: {
    color: tokens.colors.brand.base,
    fontWeight: '700',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.dark_navy.bg_card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.xs,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.dark_navy.text_primary,
  },
  statLabel: {
    fontSize: 11,
    color: tokens.colors.dark_navy.text_muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.dark_navy.text_primary,
    marginBottom: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
  },
  chartContainer: {
    backgroundColor: tokens.colors.dark_navy.bg_card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginTop: tokens.spacing.md,
  },
  chartBarCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarTrack: {
    width: 28,
    height: 100,
    backgroundColor: tokens.colors.dark_navy.bg_input,
    borderRadius: tokens.radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    backgroundColor: tokens.colors.brand.base + '60',
    borderRadius: tokens.radius.sm,
  },
  chartBarToday: {
    backgroundColor: tokens.colors.brand.base,
  },
  chartDayLabel: {
    fontSize: 11,
    color: tokens.colors.dark_navy.text_muted,
    marginTop: tokens.spacing.xs,
  },
  chartDayLabelActive: {
    color: tokens.colors.brand.base,
    fontWeight: '700',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.lg,
  },
  quickAction: {
    width: '48%',
    backgroundColor: tokens.colors.dark_navy.bg_card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.dark_navy.text_primary,
  },
  card: {
    backgroundColor: tokens.colors.dark_navy.bg_card,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.dark_navy.text_primary,
    marginBottom: tokens.spacing.md,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: tokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.dark_navy.divider,
  },
  goalInfo: {
    flex: 1,
    marginLeft: tokens.spacing.sm,
  },
  goalLabel: {
    fontSize: 14,
    color: tokens.colors.dark_navy.text_primary,
    marginBottom: 4,
  },
  goalBarTrack: {
    height: 6,
    backgroundColor: tokens.colors.dark_navy.bg_input,
    borderRadius: tokens.radius.full,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.green.base,
    borderRadius: tokens.radius.full,
  },
  goalCount: {
    fontSize: 12,
    color: tokens.colors.dark_navy.text_muted,
    marginLeft: tokens.spacing.sm,
  },
  muscleImage: {
    width: '100%',
    height: 200,
    borderRadius: tokens.radius.md,
  },
});

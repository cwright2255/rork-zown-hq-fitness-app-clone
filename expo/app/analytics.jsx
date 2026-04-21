import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import {
  TrendingUp,
  Activity,
  Flame,
  Clock,
  Award,
  Heart,
  Scale,
  Dumbbell,
  Footprints,
} from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import StatCard from '@/components/StatCard';
import ScreenHeader from '@/components/ScreenHeader';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useWorkoutStore } from '@/store/workoutStore';
import {
  getHeatmapVisualizeUrl,
  normalizeMuscleNames,
} from '@/services/muscleVisualizerService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function AnalyticsScreen() {
  const [timeRange, setTimeRange] = useState('month');
  const [heatmapError, setHeatmapError] = useState(false);
  const { getAnalytics } = useAnalyticsStore();
  const completedWorkouts = useWorkoutStore((s) => s.completedWorkouts) || [];

  const analytics = getAnalytics(timeRange);

  const weeklyMuscles = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = completedWorkouts.filter((w) => {
      const t = w.completedAt ? new Date(w.completedAt).getTime() : 0;
      return t >= sevenDaysAgo;
    });
    const all = [];
    recent.forEach((w) => {
      const list = w.targetMuscles || w.muscleGroups || [];
      list.forEach((m) => m && all.push(m));
    });
    const normalized = normalizeMuscleNames(all);
    return Array.from(new Set(normalized));
  }, [completedWorkouts]);

  const heatmapUrl = useMemo(
    () => getHeatmapVisualizeUrl({ muscles: weeklyMuscles }),
    [weeklyMuscles]
  );

  const timeRanges = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];

  const ProgressBar = ({ label, value, maxValue, color = colors.text }) => {
    const percentage = Math.min((value / maxValue) * 100, 100);
    return (
      <View style={styles.progressItem}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value}/{maxValue}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: color }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenHeader title="Analytics" subtitle="YOUR PROGRESS" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.statsRow}>
          <StatCard
            value={analytics.workoutsCompleted.toString()}
            label="Workouts"
            icon={<Activity size={16} color={colors.text} />}
          />
          <StatCard
            value={analytics.caloriesBurned.toLocaleString()}
            label="Calories"
            icon={<Flame size={16} color={colors.orange} />}
          />
          <StatCard
            value={analytics.streakDays.toString()}
            label="Streak"
            icon={<Award size={16} color={colors.purple} />}
          />
        </View>

        <View style={styles.pillRow}>
          {timeRanges.map((range) => (
            <TouchableOpacity
              key={range.key}
              style={[styles.pill, timeRange === range.key && styles.pillActive]}
              onPress={() => setTimeRange(range.key)}>
              <Text style={[styles.pillText, timeRange === range.key && styles.pillTextActive]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.planRow}>
          <View>
            <Text style={styles.planLabel}>CURRENT PLAN</Text>
            <Text style={styles.planValue}>Personal</Text>
          </View>
          <TouchableOpacity style={styles.upgradePill}>
            <Text style={styles.upgradePillText}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityTiles}>
          <View style={styles.activityTile}>
            <Heart size={22} color={colors.text} />
            <Text style={styles.activityTileLabel}>Cardio</Text>
          </View>
          <View style={styles.activityTile}>
            <Scale size={22} color={colors.text} />
            <Text style={styles.activityTileLabel}>Weight</Text>
          </View>
          <View style={styles.activityTile}>
            <Dumbbell size={22} color={colors.text} />
            <Text style={styles.activityTileLabel}>Gym</Text>
          </View>
        </View>

        <View style={styles.runCard}>
          <View style={styles.runIcon}>
            <Footprints size={28} color={colors.text} />
          </View>
          <View style={styles.runBody}>
            <Text style={styles.runTitle}>Run Session</Text>
            <View style={styles.runStats}>
              <View style={styles.runStat}>
                <Text style={styles.runStatValue}>1h 33m</Text>
                <Text style={styles.runStatLabel}>TIME</Text>
              </View>
              <View style={styles.runStat}>
                <Text style={styles.runStatValue}>970</Text>
                <Text style={styles.runStatLabel}>CAL</Text>
              </View>
              <View style={styles.runStat}>
                <Text style={styles.runStatValue}>7.5</Text>
                <Text style={styles.runStatLabel}>KM</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACTIVE MINUTES</Text>
        <View style={styles.card}>
          <View style={styles.rowSplit}>
            <View style={styles.rowIcon}>
              <Clock size={20} color={colors.green} />
            </View>
            <Text style={styles.rowValue}>{analytics.activeMinutes}</Text>
            <Text style={styles.rowDelta}>+{analytics.activeGrowth}%</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>GOAL PROGRESS</Text>
        <View style={styles.card}>
          <ProgressBar label="Weekly Workouts" value={analytics.weeklyWorkouts} maxValue={5} color={colors.text} />
          <ProgressBar label="Daily Calories" value={analytics.dailyCalories} maxValue={2000} color={colors.orange} />
          <ProgressBar label="Water Intake (L)" value={analytics.waterIntake} maxValue={8} color={colors.blue} />
          <ProgressBar label="Sleep Hours" value={analytics.sleepHours} maxValue={8} color={colors.purple} />
        </View>

        <Text style={styles.sectionLabel}>ACTIVITY BREAKDOWN</Text>
        <View style={styles.card}>
          {analytics.activityBreakdown.map((activity, index) => (
            <View key={index} style={styles.activityItem}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityName}>{activity.name}</Text>
                <Text style={styles.activityPercentage}>{activity.percentage}%</Text>
              </View>
              <View style={styles.activityBarContainer}>
                <View style={[styles.activityBar, { width: `${activity.percentage}%`, backgroundColor: activity.color }]} />
              </View>
              <Text style={styles.activityTime}>{activity.time} minutes</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>WEEKLY TRENDS</Text>
        <View style={styles.card}>
          <View style={styles.trendsContainer}>
            {analytics.weeklyTrends.map((day, index) => {
              const max = Math.max(...analytics.weeklyTrends.map((d) => d.value));
              return (
                <View key={index} style={styles.trendDay}>
                  <View style={styles.trendBar}>
                    <View style={[styles.trendBarFill, { height: `${(day.value / max) * 100}%` }]} />
                  </View>
                  <Text style={styles.trendDayLabel}>{day.day}</Text>
                  <Text style={styles.trendValue}>{day.value}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionLabel}>RECENT ACHIEVEMENTS</Text>
        <View style={styles.card}>
          {analytics.recentAchievements.map((achievement, index) => (
            <View key={index} style={styles.achievementItem}>
              <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDate}>{achievement.date}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>INSIGHTS</Text>
        <View style={styles.card}>
          {analytics.insights.map((insight, index) => (
            <View key={index} style={styles.insightItem}>
              <TrendingUp size={16} color={colors.green} />
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>THIS WEEK'S MUSCLE ACTIVITY</Text>
        {heatmapUrl && !heatmapError ? (
          <Image
            source={{ uri: heatmapUrl }}
            style={styles.heatmapImage}
            resizeMode="contain"
            onError={() => setHeatmapError(true)}
          />
        ) : (
          <View style={styles.heatmapPlaceholder}>
            <Text style={styles.heatmapPlaceholderText}>
              Log workouts to see your muscle heatmap
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: spacing.lg },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.text },
  pillTextActive: { color: '#000' },
  sectionLabel: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.base,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  rowValue: { flex: 1, ...typography.h3 },
  rowDelta: { ...typography.bodySmall, color: colors.green, fontWeight: '700' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  planLabel: { ...typography.label },
  planValue: { ...typography.h3, marginTop: 4 },
  upgradePill: {
    backgroundColor: colors.text,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  upgradePillText: { color: '#000', fontWeight: '700', fontSize: 13 },
  activityTiles: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  activityTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityTileLabel: { ...typography.caption, color: colors.text, textTransform: 'uppercase' },
  runCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  runIcon: {
    width: 56, height: 56, borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  runBody: { flex: 1 },
  runTitle: { ...typography.h4, marginBottom: spacing.sm },
  runStats: { flexDirection: 'row', gap: spacing.base },
  runStat: { alignItems: 'flex-start' },
  runStatValue: { ...typography.h4, color: colors.text },
  runStatLabel: { ...typography.caption, marginTop: 2 },
  progressItem: { gap: 8 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: { ...typography.body, fontWeight: '600' },
  progressValue: { ...typography.bodySmall },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.progressTrack,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 4 },
  activityItem: { gap: 8 },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: { ...typography.body, fontWeight: '600' },
  activityPercentage: { ...typography.bodySmall, color: colors.text, fontWeight: '700' },
  activityBarContainer: {
    height: 6,
    backgroundColor: colors.progressTrack,
    borderRadius: 3,
    overflow: 'hidden',
  },
  activityBar: { height: '100%', borderRadius: 3 },
  activityTime: { ...typography.caption },
  trendsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  trendDay: { alignItems: 'center', gap: 6 },
  trendBar: {
    width: 24,
    height: 80,
    backgroundColor: colors.progressTrack,
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    backgroundColor: colors.text,
    borderRadius: 12,
    minHeight: 4,
  },
  trendDayLabel: { ...typography.caption },
  trendValue: { ...typography.caption, color: colors.text, fontWeight: '700' },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  achievementIcon: { fontSize: 24 },
  achievementInfo: { flex: 1 },
  achievementTitle: { ...typography.body, fontWeight: '600' },
  achievementDate: { ...typography.bodySmall },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  insightText: { flex: 1, ...typography.body, fontWeight: '500' },
  heatmapImage: {
    width: '100%',
    height: 260,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  heatmapPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heatmapPlaceholderText: { ...typography.bodySmall },
});

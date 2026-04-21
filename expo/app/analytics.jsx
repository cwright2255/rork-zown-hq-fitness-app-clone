import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions } from
'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import {
  TrendingUp,
  Activity,
  Flame,
  Clock,
  Award,
  BarChart3,
  Heart,
  Scale,
  Dumbbell,
  Footprints } from
'lucide-react-native';
import Colors from '@/constants/colors';
import { useAnalyticsStore } from '@/store/analyticsStore';
import { useWorkoutStore } from '@/store/workoutStore';
import {
  getHeatmapVisualizeUrl,
  normalizeMuscleNames,
} from '@/services/muscleVisualizerService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const { width } = Dimensions.get('window');

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
      list.forEach((m) => {
        if (m) all.push(m);
      });
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
  { key: 'year', label: 'Year' }];


  const StatCard = ({
    title,
    value,
    change,
    icon,
    color = Colors.primary






  }) =>
  <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
          {icon}
        </View>
        <Text style={[styles.statChange, { color }]}>{change}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>;


  const ProgressBar = ({
    label,
    value,
    maxValue,
    color = Colors.primary





  }) => {
    const percentage = Math.min(value / maxValue * 100, 100);

    return (
      <View style={styles.progressItem}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={styles.progressValue}>{value}/{maxValue}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
            styles.progressBarFill,
            { width: `${percentage}%`, backgroundColor: color }]
            } />
          
        </View>
      </View>);

  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Analytics', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <BarChart3 size={24} color={Colors.primary} />
      </View>

      <View style={styles.timeRangeContainer}>
        {timeRanges.map((range) =>
        <TouchableOpacity
          key={range.key}
          style={[
          styles.timeRangeButton,
          timeRange === range.key && styles.activeTimeRange]
          }
          onPress={() => setTimeRange(range.key)}>
          
            <Text
            style={[
            styles.timeRangeText,
            timeRange === range.key && styles.activeTimeRangeText]
            }>
            
              {range.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* This Week Header */}
        <Text style={styles.weekHeader}>This Week</Text>

        {/* Current Plan Row */}
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planLabel}>Current Plan</Text>
            <Text style={styles.planValue}>Personal</Text>
          </View>
          <TouchableOpacity style={styles.upgradePill}>
            <Text style={styles.upgradePillText}>Upgrade</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Type Tiles */}
        <View style={styles.activityTiles}>
          <View style={styles.activityTile}>
            <Heart size={22} color={Colors.text.primary} />
            <Text style={styles.activityTileLabel}>Cardio</Text>
          </View>
          <View style={styles.activityTile}>
            <Scale size={22} color={Colors.text.primary} />
            <Text style={styles.activityTileLabel}>Weight</Text>
          </View>
          <View style={styles.activityTile}>
            <Dumbbell size={22} color={Colors.text.primary} />
            <Text style={styles.activityTileLabel}>Gym</Text>
          </View>
        </View>

        {/* Run Session Card */}
        <View style={styles.runCard}>
          <View style={styles.runIcon}>
            <Footprints size={28} color={Colors.text.primary} />
          </View>
          <View style={styles.runBody}>
            <Text style={styles.runTitle}>Run Session</Text>
            <View style={styles.runStats}>
              <View style={styles.runStat}>
                <Text style={styles.runStatValue}>1h 33m</Text>
                <Text style={styles.runStatLabel}>Time</Text>
              </View>
              <View style={styles.runStat}>
                <Text style={styles.runStatValue}>970</Text>
                <Text style={styles.runStatLabel}>cal</Text>
              </View>
              <View style={styles.runStat}>
                <Text style={styles.runStatValue}>7.5</Text>
                <Text style={styles.runStatLabel}>KM</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Workouts Completed"
            value={analytics.workoutsCompleted.toString()}
            change={`+${analytics.workoutGrowth}%`}
            icon={<Activity size={20} color={Colors.primary} />} />
          
          
          <StatCard
            title="Calories Burned"
            value={analytics.caloriesBurned.toLocaleString()}
            change={`+${analytics.calorieGrowth}%`}
            icon={<Flame size={20} color="#F59E0B" />}
            color="#F59E0B" />
          
          
          <StatCard
            title="Active Minutes"
            value={analytics.activeMinutes.toString()}
            change={`+${analytics.activeGrowth}%`}
            icon={<Clock size={20} color="#10B981" />}
            color="#10B981" />
          
          
          <StatCard
            title="Streak Days"
            value={analytics.streakDays.toString()}
            change={`+${analytics.streakGrowth}%`}
            icon={<Award size={20} color="#8B5CF6" />}
            color="#8B5CF6" />
          
        </View>

        {/* Goal Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Progress</Text>
          <View style={styles.progressContainer}>
            <ProgressBar
              label="Weekly Workouts"
              value={analytics.weeklyWorkouts}
              maxValue={5}
              color={Colors.primary} />
            
            <ProgressBar
              label="Daily Calories"
              value={analytics.dailyCalories}
              maxValue={2000}
              color="#F59E0B" />
            
            <ProgressBar
              label="Water Intake (L)"
              value={analytics.waterIntake}
              maxValue={8}
              color="#06B6D4" />
            
            <ProgressBar
              label="Sleep Hours"
              value={analytics.sleepHours}
              maxValue={8}
              color="#8B5CF6" />
            
          </View>
        </View>

        {/* Activity Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Breakdown</Text>
          <View style={styles.activityGrid}>
            {analytics.activityBreakdown.map((activity, index) =>
            <View key={index} style={styles.activityItem}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityName}>{activity.name}</Text>
                  <Text style={styles.activityPercentage}>{activity.percentage}%</Text>
                </View>
                <View style={styles.activityBarContainer}>
                  <View
                  style={[
                  styles.activityBar,
                  {
                    width: `${activity.percentage}%`,
                    backgroundColor: activity.color
                  }]
                  } />
                
                </View>
                <Text style={styles.activityTime}>{activity.time} minutes</Text>
              </View>
            )}
          </View>
        </View>

        {/* Weekly Trends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Trends</Text>
          <View style={styles.trendsContainer}>
            {analytics.weeklyTrends.map((day, index) =>
            <View key={index} style={styles.trendDay}>
                <Text style={styles.trendDayLabel}>{day.day}</Text>
                <View style={styles.trendBar}>
                  <View
                  style={[
                  styles.trendBarFill,
                  {
                    height: `${day.value / Math.max(...analytics.weeklyTrends.map((d) => d.value)) * 100}%`,
                    backgroundColor: Colors.primary
                  }]
                  } />
                
                </View>
                <Text style={styles.trendValue}>{day.value}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Achievements This Period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Achievements</Text>
          <View style={styles.achievementsContainer}>
            {analytics.recentAchievements.map((achievement, index) =>
            <View key={index} style={styles.achievementItem}>
                <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                <View style={styles.achievementInfo}>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.achievementDate}>{achievement.date}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightsContainer}>
            {analytics.insights.map((insight, index) =>
            <View key={index} style={styles.insightItem}>
                <TrendingUp size={16} color={Colors.primary} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Weekly Muscle Heatmap */}
        <View style={styles.section}>
          <Text style={styles.heatmapHeader}>This Week's Muscle Activity</Text>
          {heatmapUrl && !heatmapError ? (
            <Image
              source={{ uri: heatmapUrl }}
              style={styles.heatmapImage}
              resizeMode="contain"
              onError={() => setHeatmapError(true)} />
          ) : (
            <View style={styles.heatmapPlaceholder}>
              <Text style={styles.heatmapPlaceholderText}>
                Log workouts to see your muscle heatmap
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center'
  },
  activeTimeRange: {
    backgroundColor: Colors.primary
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary
  },
  activeTimeRangeText: {
    color: 'white'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  statCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    width: (width - 52) / 2
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statChange: {
    fontSize: 12,
    fontWeight: '600'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4
  },
  statTitle: {
    fontSize: 12,
    color: Colors.text.secondary
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16
  },
  progressContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 16
  },
  progressItem: {
    gap: 8
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary
  },
  progressValue: {
    fontSize: 12,
    color: Colors.text.secondary
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  activityGrid: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 16
  },
  activityItem: {
    gap: 8
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary
  },
  activityPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary
  },
  activityBarContainer: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 3,
    overflow: 'hidden'
  },
  activityBar: {
    height: '100%',
    borderRadius: 3
  },
  activityTime: {
    fontSize: 11,
    color: Colors.text.secondary
  },
  trendsContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  trendDay: {
    alignItems: 'center',
    gap: 8
  },
  trendDayLabel: {
    fontSize: 12,
    color: Colors.text.secondary
  },
  trendBar: {
    width: 24,
    height: 60,
    backgroundColor: Colors.background,
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 12,
    minHeight: 4
  },
  trendValue: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.primary
  },
  achievementsContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 12
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  achievementIcon: {
    fontSize: 24
  },
  achievementInfo: {
    flex: 1
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 2
  },
  achievementDate: {
    fontSize: 12,
    color: Colors.text.secondary
  },
  insightsContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    gap: 12
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20
  },
  weekHeader: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.text.primary,
    marginBottom: 16,
    marginTop: 4
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  planLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600'
  },
  planValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 2
  },
  upgradePill: {
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999
  },
  upgradePillText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13
  },
  activityTiles: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  activityTile: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8
  },
  activityTileLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary
  },
  runCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24
  },
  runIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center'
  },
  runBody: { flex: 1 },
  runTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 8
  },
  runStats: {
    flexDirection: 'row',
    gap: 16
  },
  runStat: { alignItems: 'flex-start' },
  runStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text.primary
  },
  runStatLabel: {
    fontSize: 10,
    color: Colors.text.secondary,
    fontWeight: '600'
  },
  heatmapHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  heatmapImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#111',
    borderRadius: 12
  },
  heatmapPlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A'
  },
  heatmapPlaceholderText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600'
  }
});
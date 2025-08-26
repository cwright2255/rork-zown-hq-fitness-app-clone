import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { 
  TrendingUp, 
  Calendar, 
  Target, 
  Activity,
  Flame,
  Clock,
  Award,
  BarChart3
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAnalyticsStore } from '@/store/analyticsStore';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const { getAnalytics } = useAnalyticsStore();
  
  const analytics = getAnalytics(timeRange);

  const timeRanges = [
    { key: 'week' as const, label: 'Week' },
    { key: 'month' as const, label: 'Month' },
    { key: 'year' as const, label: 'Year' },
  ];

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon, 
    color = Colors.primary.main 
  }: {
    title: string;
    value: string;
    change: string;
    icon: React.ReactNode;
    color?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
          {icon}
        </View>
        <Text style={[styles.statChange, { color }]}>{change}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const ProgressBar = ({ 
    label, 
    value, 
    maxValue, 
    color = Colors.primary.main 
  }: {
    label: string;
    value: number;
    maxValue: number;
    color?: string;
  }) => {
    const percentage = Math.min((value / maxValue) * 100, 100);
    
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
              { width: `${percentage}%`, backgroundColor: color }
            ]} 
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Analytics', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <BarChart3 size={24} color={Colors.primary.main} />
      </View>

      <View style={styles.timeRangeContainer}>
        {timeRanges.map((range) => (
          <TouchableOpacity
            key={range.key}
            style={[
              styles.timeRangeButton,
              timeRange === range.key && styles.activeTimeRange,
            ]}
            onPress={() => setTimeRange(range.key)}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === range.key && styles.activeTimeRangeText,
              ]}
            >
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Key Metrics */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Workouts Completed"
            value={analytics.workoutsCompleted.toString()}
            change={`+${analytics.workoutGrowth}%`}
            icon={<Activity size={20} color={Colors.primary.main} />}
          />
          
          <StatCard
            title="Calories Burned"
            value={analytics.caloriesBurned.toLocaleString()}
            change={`+${analytics.calorieGrowth}%`}
            icon={<Flame size={20} color="#F59E0B" />}
            color="#F59E0B"
          />
          
          <StatCard
            title="Active Minutes"
            value={analytics.activeMinutes.toString()}
            change={`+${analytics.activeGrowth}%`}
            icon={<Clock size={20} color="#10B981" />}
            color="#10B981"
          />
          
          <StatCard
            title="Streak Days"
            value={analytics.streakDays.toString()}
            change={`+${analytics.streakGrowth}%`}
            icon={<Award size={20} color="#8B5CF6" />}
            color="#8B5CF6"
          />
        </View>

        {/* Goal Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goal Progress</Text>
          <View style={styles.progressContainer}>
            <ProgressBar
              label="Weekly Workouts"
              value={analytics.weeklyWorkouts}
              maxValue={5}
              color={Colors.primary.main}
            />
            <ProgressBar
              label="Daily Calories"
              value={analytics.dailyCalories}
              maxValue={2000}
              color="#F59E0B"
            />
            <ProgressBar
              label="Water Intake (L)"
              value={analytics.waterIntake}
              maxValue={8}
              color="#06B6D4"
            />
            <ProgressBar
              label="Sleep Hours"
              value={analytics.sleepHours}
              maxValue={8}
              color="#8B5CF6"
            />
          </View>
        </View>

        {/* Activity Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Breakdown</Text>
          <View style={styles.activityGrid}>
            {analytics.activityBreakdown.map((activity, index) => (
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
                        backgroundColor: activity.color,
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.activityTime}>{activity.time} minutes</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Weekly Trends */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Trends</Text>
          <View style={styles.trendsContainer}>
            {analytics.weeklyTrends.map((day, index) => (
              <View key={index} style={styles.trendDay}>
                <Text style={styles.trendDayLabel}>{day.day}</Text>
                <View style={styles.trendBar}>
                  <View 
                    style={[
                      styles.trendBarFill,
                      { 
                        height: `${(day.value / Math.max(...analytics.weeklyTrends.map(d => d.value))) * 100}%`,
                        backgroundColor: Colors.primary.main,
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.trendValue}>{day.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements This Period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Achievements</Text>
          <View style={styles.achievementsContainer}>
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
        </View>

        {/* Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <View style={styles.insightsContainer}>
            {analytics.insights.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <TrendingUp size={16} color={Colors.primary.main} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeTimeRange: {
    backgroundColor: Colors.primary.main,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTimeRangeText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    width: (width - 52) / 2,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  progressContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  progressItem: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  progressValue: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: Colors.background.primary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  activityGrid: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  activityItem: {
    gap: 8,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  activityPercentage: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  activityBarContainer: {
    height: 6,
    backgroundColor: Colors.background.primary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  activityBar: {
    height: '100%',
    borderRadius: 3,
  },
  activityTime: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  trendsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  trendDay: {
    alignItems: 'center',
    gap: 8,
  },
  trendDayLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  trendBar: {
    width: 24,
    height: 60,
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  trendBarFill: {
    width: '100%',
    borderRadius: 12,
    minHeight: 4,
  },
  trendValue: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  achievementsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  achievementDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  insightsContainer: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
});
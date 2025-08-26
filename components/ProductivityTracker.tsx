import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { TrendingUp, Target, CheckCircle, Clock, Calendar, BarChart3 } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';

interface ProductivityMetric {
  id: string;
  title: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface HabitTracker {
  id: string;
  name: string;
  streak: number;
  completedToday: boolean;
  weeklyProgress: boolean[];
  color: string;
}

interface ProductivityTrackerProps {
  onMetricPress?: (metric: ProductivityMetric) => void;
  onHabitToggle?: (habitId: string) => void;
  onSetGoal?: () => void;
  onSchedule?: () => void;
  onTimer?: () => void;
}

const mockMetrics: ProductivityMetric[] = [
  {
    id: 'workouts',
    title: 'Workouts This Week',
    value: 4,
    target: 5,
    unit: 'sessions',
    color: Colors.primary,
    trend: 'up',
    trendValue: 12
  },
  {
    id: 'calories',
    title: 'Calories Burned',
    value: 2450,
    target: 3000,
    unit: 'kcal',
    color: Colors.secondary,
    trend: 'up',
    trendValue: 8
  },
  {
    id: 'sleep',
    title: 'Sleep Quality',
    value: 7.5,
    target: 8,
    unit: 'hours',
    color: Colors.info,
    trend: 'stable',
    trendValue: 0
  },
  {
    id: 'water',
    title: 'Water Intake',
    value: 6,
    target: 8,
    unit: 'glasses',
    color: Colors.success,
    trend: 'down',
    trendValue: -5
  }
];

const mockHabits: HabitTracker[] = [
  {
    id: 'morning-workout',
    name: 'Morning Workout',
    streak: 12,
    completedToday: true,
    weeklyProgress: [true, true, false, true, true, true, false],
    color: Colors.primary
  },
  {
    id: 'meditation',
    name: '10min Meditation',
    streak: 8,
    completedToday: false,
    weeklyProgress: [true, true, true, false, true, true, false],
    color: Colors.info
  },
  {
    id: 'protein-shake',
    name: 'Protein Shake',
    streak: 5,
    completedToday: true,
    weeklyProgress: [true, false, true, true, true, false, false],
    color: Colors.secondary
  },
  {
    id: 'steps',
    name: '10k Steps',
    streak: 15,
    completedToday: false,
    weeklyProgress: [true, true, true, true, false, true, true],
    color: Colors.success
  }
];

export default function ProductivityTracker({ onMetricPress, onHabitToggle, onSetGoal, onSchedule, onTimer }: ProductivityTrackerProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');

  const overallProgress = useMemo(() => {
    const totalProgress = mockMetrics.reduce((sum, metric) => {
      return sum + (metric.value / metric.target) * 100;
    }, 0);
    return Math.min(totalProgress / mockMetrics.length, 100);
  }, []);

  const completedHabitsToday = useMemo(() => {
    return mockHabits.filter(habit => habit.completedToday).length;
  }, []);

  const renderTrendIcon = (trend: 'up' | 'down' | 'stable', trendValue: number) => {
    if (trend === 'stable') {
      return <View style={styles.trendIconStable} />;
    }
    return (
      <TrendingUp 
        size={12} 
        color={trend === 'up' ? Colors.success : Colors.error}
        style={trend === 'down' ? { transform: [{ rotate: '180deg' }] } : {}}
      />
    );
  };

  const renderWeeklyProgress = (progress: boolean[]) => {
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
      <View style={styles.weeklyProgressContainer}>
        {progress.map((completed, index) => (
          <View key={index} style={styles.dayProgressContainer}>
            <View style={[
              styles.dayProgressDot,
              completed && styles.dayProgressDotCompleted
            ]} />
            <Text style={styles.dayProgressLabel}>{days[index]}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overview Card */}
      <Card style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <View>
            <Text style={styles.overviewTitle}>Today&apos;s Progress</Text>
            <Text style={styles.overviewSubtitle}>
              {completedHabitsToday}/{mockHabits.length} habits completed
            </Text>
          </View>
          <View style={styles.overviewProgress}>
            <Text style={styles.overallProgressText}>{Math.round(overallProgress)}%</Text>
            <ProgressBar 
              progress={overallProgress / 100} 
              progressColor={Colors.primary}
              style={styles.overallProgressBar}
            />
          </View>
        </View>
      </Card>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === 'week' && styles.periodButtonActive
          ]}
          onPress={() => setSelectedPeriod('week')}
        >
          <Text style={[
            styles.periodButtonText,
            selectedPeriod === 'week' && styles.periodButtonTextActive
          ]}>
            This Week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.periodButton,
            selectedPeriod === 'month' && styles.periodButtonActive
          ]}
          onPress={() => setSelectedPeriod('month')}
        >
          <Text style={[
            styles.periodButtonText,
            selectedPeriod === 'month' && styles.periodButtonTextActive
          ]}>
            This Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {mockMetrics.map(metric => {
          const progressPercentage = (metric.value / metric.target) * 100;
          return (
            <TouchableOpacity
              key={metric.id}
              style={styles.metricCard}
              onPress={() => onMetricPress?.(metric)}
            >
              <View style={styles.metricHeader}>
                <View style={[styles.metricColorBar, { backgroundColor: metric.color }]} />
                <View style={styles.metricTrend}>
                  {renderTrendIcon(metric.trend, metric.trendValue)}
                  {metric.trend !== 'stable' && (
                    <Text style={[
                      styles.trendText,
                      { color: metric.trend === 'up' ? Colors.success : Colors.error }
                    ]}>
                      {Math.abs(metric.trendValue)}%
                    </Text>
                  )}
                </View>
              </View>
              
              <Text style={styles.metricTitle}>{metric.title}</Text>
              
              <View style={styles.metricValueContainer}>
                <Text style={styles.metricValue}>
                  {metric.value.toLocaleString()}
                </Text>
                <Text style={styles.metricTarget}>
                  /{metric.target.toLocaleString()} {metric.unit}
                </Text>
              </View>
              
              <ProgressBar 
                progress={progressPercentage / 100}
                progressColor={metric.color}
                style={styles.metricProgress}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Habit Tracker */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Daily Habits</Text>
        <TouchableOpacity>
          <BarChart3 size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.habitsContainer}>
        {mockHabits.map(habit => (
          <Card key={habit.id} style={styles.habitCard}>
            <View style={styles.habitHeader}>
              <View style={styles.habitInfo}>
                <View style={styles.habitTitleRow}>
                  <Text style={styles.habitName}>{habit.name}</Text>
                  <Badge 
                    variant={habit.completedToday ? 'success' : 'neutral'}
                    style={styles.habitBadge}
                  >
                    <Text>{habit.streak} day streak</Text>
                  </Badge>
                </View>
                {renderWeeklyProgress(habit.weeklyProgress)}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.habitToggle,
                  habit.completedToday && styles.habitToggleCompleted
                ]}
                onPress={() => onHabitToggle?.(habit.id)}
              >
                {habit.completedToday && (
                  <CheckCircle size={24} color={Colors.text.inverse} />
                )}
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton} onPress={onSetGoal}>
          <Target size={20} color={Colors.primary} />
          <Text style={styles.quickActionText}>Set Goal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.quickActionButton} onPress={onSchedule}>
          <Calendar size={20} color={Colors.primary} />
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.quickActionButton} onPress={onTimer}>
          <Clock size={20} color={Colors.primary} />
          <Text style={styles.quickActionText}>Timer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overviewCard: {
    margin: 20,
    padding: 20,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  overviewSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  overviewProgress: {
    alignItems: 'flex-end',
  },
  overallProgressText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  overallProgressBar: {
    width: 80,
  },
  periodSelector: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 8,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: Colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  periodButtonTextActive: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricColorBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  metricTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendIconStable: {
    width: 12,
    height: 2,
    backgroundColor: Colors.text.tertiary,
    borderRadius: 1,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricTitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  metricValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  metricTarget: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginLeft: 2,
  },
  metricProgress: {
    height: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  habitsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  habitCard: {
    padding: 16,
  },
  habitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitInfo: {
    flex: 1,
    marginRight: 16,
  },
  habitTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  habitName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  habitBadge: {
    height: 20,
    paddingHorizontal: 8,
  },
  weeklyProgressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dayProgressContainer: {
    alignItems: 'center',
    gap: 4,
  },
  dayProgressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inactive,
  },
  dayProgressDotCompleted: {
    backgroundColor: Colors.success,
  },
  dayProgressLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
  },
  habitToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  habitToggleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
});
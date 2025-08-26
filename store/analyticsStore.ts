import { create } from 'zustand';

interface ActivityBreakdown {
  name: string;
  percentage: number;
  time: number;
  color: string;
}

interface WeeklyTrend {
  day: string;
  value: number;
}

interface Achievement {
  title: string;
  icon: string;
  date: string;
}

interface Analytics {
  workoutsCompleted: number;
  workoutGrowth: number;
  caloriesBurned: number;
  calorieGrowth: number;
  activeMinutes: number;
  activeGrowth: number;
  streakDays: number;
  streakGrowth: number;
  weeklyWorkouts: number;
  dailyCalories: number;
  waterIntake: number;
  sleepHours: number;
  activityBreakdown: ActivityBreakdown[];
  weeklyTrends: WeeklyTrend[];
  recentAchievements: Achievement[];
  insights: string[];
}

interface AnalyticsState {
  getAnalytics: (timeRange: 'week' | 'month' | 'year') => Analytics;
}

export const useAnalyticsStore = create<AnalyticsState>(() => ({
  getAnalytics: (timeRange) => {
    // Mock data - in a real app, this would come from your analytics service
    const baseData = {
      week: {
        workoutsCompleted: 4,
        workoutGrowth: 25,
        caloriesBurned: 1200,
        calorieGrowth: 15,
        activeMinutes: 180,
        activeGrowth: 20,
        streakDays: 7,
        streakGrowth: 40,
        weeklyWorkouts: 4,
        dailyCalories: 1800,
        waterIntake: 6,
        sleepHours: 7,
      },
      month: {
        workoutsCompleted: 18,
        workoutGrowth: 12,
        caloriesBurned: 5400,
        calorieGrowth: 8,
        activeMinutes: 720,
        activeGrowth: 15,
        streakDays: 12,
        streakGrowth: 33,
        weeklyWorkouts: 4,
        dailyCalories: 1850,
        waterIntake: 7,
        sleepHours: 7,
      },
      year: {
        workoutsCompleted: 156,
        workoutGrowth: 28,
        caloriesBurned: 46800,
        calorieGrowth: 22,
        activeMinutes: 6240,
        activeGrowth: 35,
        streakDays: 45,
        streakGrowth: 67,
        weeklyWorkouts: 3,
        dailyCalories: 1900,
        waterIntake: 6,
        sleepHours: 7,
      },
    };

    const data = baseData[timeRange];

    return {
      ...data,
      activityBreakdown: [
        {
          name: 'Strength Training',
          percentage: 45,
          time: 324,
          color: '#3B82F6',
        },
        {
          name: 'Cardio',
          percentage: 30,
          time: 216,
          color: '#10B981',
        },
        {
          name: 'Yoga',
          percentage: 15,
          time: 108,
          color: '#8B5CF6',
        },
        {
          name: 'Flexibility',
          percentage: 10,
          time: 72,
          color: '#F59E0B',
        },
      ],
      weeklyTrends: [
        { day: 'Mon', value: 45 },
        { day: 'Tue', value: 52 },
        { day: 'Wed', value: 38 },
        { day: 'Thu', value: 61 },
        { day: 'Fri', value: 55 },
        { day: 'Sat', value: 67 },
        { day: 'Sun', value: 43 },
      ],
      recentAchievements: [
        {
          title: 'Workout Streak Master',
          icon: '🔥',
          date: '2 days ago',
        },
        {
          title: 'Calorie Crusher',
          icon: '💪',
          date: '5 days ago',
        },
        {
          title: 'Early Bird',
          icon: '🌅',
          date: '1 week ago',
        },
      ],
      insights: [
        'Your workout consistency has improved by 25% this month',
        'You burn the most calories during strength training sessions',
        'Your best workout days are Tuesday and Saturday',
        'Consider adding more flexibility work to your routine',
      ],
    };
  },
}));
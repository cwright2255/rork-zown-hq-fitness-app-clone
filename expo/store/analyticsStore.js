import { create } from 'zustand';
import { useWorkoutStore } from './workoutStore';
import { useHealthStore } from './healthStore';
import { useExpStore } from './expStore';

export const useAnalyticsStore = create(() => ({
  getAnalytics: (timeRange) => {
    const { completedWorkouts } = useWorkoutStore.getState();
    const { weight, hydration, sleep } = useHealthStore.getState();
    const { totalExp } = useExpStore.getState();

    const now = Date.now();
    const ranges = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - (ranges[timeRange] || ranges.week);

    const recentWorkouts = (completedWorkouts || []).filter(w => {
      const d = w.completedAt || w.date;
      return d && new Date(d).getTime() > cutoff;
    });

    const workoutsCompleted = recentWorkouts.length;
    const caloriesBurned = recentWorkouts.reduce((s, w) => s + (w.caloriesBurned || w.calories || 0), 0);
    const activeMinutes = recentWorkouts.reduce((s, w) => s + (w.duration || 0), 0);

    // Streak: count consecutive days with workouts from today backwards
    let streakDays = 0;
    const dayMs = 24 * 60 * 60 * 1000;
    for (let d = 0; d < 365; d++) {
      const dayStart = new Date(now - d * dayMs).toISOString().slice(0, 10);
      const hasWorkout = (completedWorkouts || []).some(w => {
        const wd = w.completedAt || w.date;
        return wd && wd.startsWith(dayStart);
      });
      if (hasWorkout) streakDays++;
      else if (d > 0) break;
    }

    return {
      workoutsCompleted,
      workoutGrowth: 0,
      caloriesBurned,
      calorieGrowth: 0,
      activeMinutes,
      activeGrowth: 0,
      streakDays,
      streakGrowth: 0,
      weeklyWorkouts: workoutsCompleted,
      dailyCalories: workoutsCompleted > 0 ? Math.round(caloriesBurned / Math.max(1, Math.ceil((now - cutoff) / dayMs))) : 0,
      waterIntake: hydration?.glasses || 0,
      sleepHours: sleep?.hours || 0,
    };
  },
}));

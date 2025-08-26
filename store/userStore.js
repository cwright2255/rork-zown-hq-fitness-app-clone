import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useExpStore } from './expStore';

// Optimized default fitness metrics - reduced data size
const createDefaultFitnessMetrics = () => ({
  weight: 70,
  height: 175,
  bodyFat: 15,
  muscleMass: 35
});

// Optimized default user preferences
const createDefaultUserPreferences = () => ({
  units: 'metric',
  notifications: {
    workouts: true,
    nutrition: true,
    social: true
  },
  privacy: {
    profileVisible: true,
    shareProgress: true
  },
  running: {
    audioCoaching: true,
    gpsTracking: true,
    safetySharing: false,
    weatherAlerts: true,
    virtualBuddy: true,
    preferredUnit: 'km',
    targetPace: 6.0 // 6 min/km
  }
});

// Optimized default streak data
const createDefaultStreakData = () => ({
  currentStreak: 3,
  longestStreak: 5,
  streakDates: []
});

// Generate level requirements
const generateLevelRequirements = () => {
  const requirements = {};
  for (let level = 1; level <= 100; level++) {
    requirements[level] = level * 1000; // 1000 XP per level
  }
  return requirements;
};

// Simplified EXP system - only essential levels
const createDefaultExpSystem = () => ({
  totalExp: 150,
  level: 2,
  expToNextLevel: 2100,
  expSources: {
    workouts: 100,
    nutrition: 30,
    social: 20
  },
  levelRequirements: generateLevelRequirements()
});

// Default running profile
const createDefaultRunningProfile = () => ({
  totalDistance: 0,
  totalRuns: 0,
  totalTime: 0,
  bestPace: 0,
  longestRun: 0,
  personalBests: {},
  runningLevel: 'beginner'
});

// Default running preferences
const createDefaultRunningPreferences = () => ({
  audioCoaching: true,
  gpsTracking: true,
  safetySharing: false,
  weatherAlerts: true,
  virtualBuddy: true,
  preferredUnit: 'km',
  targetPace: 6.0
});

// Default subscription
const createDefaultSubscription = () => ({
  tier: 'free',
  status: 'active',
  startDate: new Date().toISOString(),
  autoRenew: false
});

// Lazy default user creation
const createDefaultUser = () => ({
  id: 'default-user',
  name: 'Fitness Enthusiast',
  email: 'user@example.com',
  profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500',
  joinDate: new Date().toISOString(),
  fitnessLevel: 'beginner',
  goals: ['strength', 'weight-loss', 'endurance'],
  exp: 150,
  xp: 150,
  expToNextLevel: 2100,
  level: 2,
  streak: 3,
  streakData: createDefaultStreakData(),
  preferences: createDefaultUserPreferences(),
  fitnessMetrics: createDefaultFitnessMetrics(),
  expSystem: createDefaultExpSystem(),
  runningProfile: createDefaultRunningProfile(),
  subscription: createDefaultSubscription()
});

// Create selectors for better performance
const userSelector = (state) => state.user;
const isOnboardedSelector = (state) => state.isOnboarded;
const isLoadingSelector = (state) => state.isLoading;

export const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      isOnboarded: false, // Set to false by default to show startup screen
      isLoading: false, // Changed to false for faster startup
      
      setUser: (user) => set({ 
        user: {
          ...user,
          fitnessMetrics: user.fitnessMetrics || createDefaultFitnessMetrics(),
          expSystem: user.expSystem || createDefaultExpSystem(),
          runningProfile: user.runningProfile || createDefaultRunningProfile(),
          subscription: user.subscription || createDefaultSubscription()
        },
        isLoading: false
      }),
      
      updateUser: (updates) => {
        const { user } = get();
        if (!user) return;
        
        set({
          user: {
            ...user,
            ...updates
          }
        });
      },
      
      updateUserPreferences: (preferences) => {
        const { user } = get();
        if (!user) return;
        
        const updatedPreferences = {
          ...createDefaultUserPreferences(),
          ...user.preferences,
          ...preferences
        };
        
        set({
          user: {
            ...user,
            preferences: updatedPreferences
          }
        });
      },
      
      updateUserGoals: (goals) => {
        const { user } = get();
        if (!user) return;
        
        set({
          user: {
            ...user,
            goals
          }
        });
      },
      
      updateUserFitnessLevel: (level) => {
        const { user } = get();
        if (!user) return;
        
        set({
          user: {
            ...user,
            fitnessLevel: level
          }
        });
      },
      
      addXp: (amount) => {
        const { user } = get();
        if (!user) return;
        
        const newXp = user.exp + amount;
        const newLevel = get().calculateLevel(newXp);
        
        set({
          user: {
            ...user,
            exp: newXp,
            xp: newXp,
            level: newLevel
          }
        });
        
        // Update EXP store asynchronously - optimized
        requestAnimationFrame(() => {
          try {
            useExpStore.getState().addExp(amount);
          } catch (error) {
            console.error('Failed to update EXP store:', error);
          }
        });
      },
      
      calculateLevel: (xp) => {
        // Simple level calculation
        return Math.floor(xp / 1000) + 1;
      },
      
      updateStreak: (workoutCompleted) => {
        const { user } = get();
        if (!user) return;
        
        const today = new Date().toISOString().split('T')[0];
        const streakData = user.streakData || createDefaultStreakData();
        
        let currentStreak = streakData.currentStreak;
        let longestStreak = streakData.longestStreak;
        let streakDates = [...streakData.streakDates];
        
        if (workoutCompleted) {
          if (!streakDates.includes(today)) {
            currentStreak += 1;
            streakDates.push(today);
            
            if (currentStreak > longestStreak) {
              longestStreak = currentStreak;
            }
          }
        } else {
          currentStreak = 0;
        }
        
        // Limit streak dates for performance - keep only last 7 days
        streakDates = streakDates.slice(-7);
        
        set({
          user: {
            ...user,
            streak: currentStreak,
            streakData: {
              currentStreak,
              longestStreak,
              streakDates
            }
          }
        });
      },
      
      getStreakData: () => {
        const { user } = get();
        if (!user) return createDefaultStreakData();
        
        return user.streakData || createDefaultStreakData();
      },
      
      updateFitnessMetrics: (metrics) => {
        const { user } = get();
        if (!user) return;
        
        const updatedMetrics = {
          ...createDefaultFitnessMetrics(),
          ...user.fitnessMetrics,
          ...metrics
        };
        
        set({
          user: {
            ...user,
            fitnessMetrics: updatedMetrics
          }
        });
      },
      
      incrementSteps: (steps) => {
        // Implementation for step tracking
        console.log('Steps incremented:', steps);
      },
      
      logSleep: (duration, quality) => {
        // Implementation for sleep tracking
        console.log('Sleep logged:', duration, quality);
      },
      
      updateRecovery: (score) => {
        // Implementation for recovery tracking
        console.log('Recovery updated:', score);
      },
      
      logCaloriesBurned: (calories) => {
        // Implementation for calorie tracking
        console.log('Calories burned:', calories);
      },
      
      logActiveMinutes: (minutes) => {
        // Implementation for active minutes tracking
        console.log('Active minutes:', minutes);
      },
      
      updateHeartRate: (rate) => {
        // Implementation for heart rate tracking
        console.log('Heart rate updated:', rate);
      },
      
      logWaterIntake: (amount) => {
        // Implementation for water intake tracking
        console.log('Water intake:', amount);
      },
      
      resetDailyMetrics: () => {
        // Implementation for resetting daily metrics
        console.log('Daily metrics reset');
      },
      
      logout: async () => {
        try {
          console.log('[UserStore] Logging out: clearing auth token and persisted user storage');
          
          // Clear auth token
          await AsyncStorage.removeItem('auth_token');
          console.log('[UserStore] Auth token cleared');
          
          // Clear persisted user storage
          await AsyncStorage.removeItem('zown-user-storage');
          console.log('[UserStore] User storage cleared');
          
          // Clear any other app-specific storage
          const keys = await AsyncStorage.getAllKeys();
          const appKeys = keys.filter(key => 
            key.startsWith('zown-') || 
            key.includes('user') || 
            key.includes('auth')
          );
          
          if (appKeys.length > 0) {
            await AsyncStorage.multiRemove(appKeys);
            console.log('[UserStore] Additional app storage cleared:', appKeys);
          }
          
        } catch (error) {
          console.error('[UserStore] Failed to clear storage during logout:', error);
        } finally {
          // Reset user state
          set({ user: null, isOnboarded: false });
          console.log('[UserStore] User state reset to logged out');
        }
      },
      
      startOnboarding: () => set({ isOnboarded: false }),
      completeOnboarding: () => set({ isOnboarded: true }),
      
      // Optimized initialization
      initializeDefaultUser: () => {
        const { user } = get();
        if (!user) {
          // Create user lazily
          const defaultUser = createDefaultUser();
          set({ 
            user: defaultUser,
            isLoading: false
          });
        } else {
          set({ isLoading: false });
        }
      },
      
      // Running-specific actions
      updateUserRunningProfile: (profile) => {
        const { user } = get();
        if (!user) return;
        
        const updatedProfile = {
          ...createDefaultRunningProfile(),
          ...user.runningProfile,
          ...profile
        };
        
        set({
          user: {
            ...user,
            runningProfile: updatedProfile
          }
        });
      },
      
      updateRunningPreferences: (preferences) => {
        const { user } = get();
        if (!user) return;
        
        // Get current running preferences with proper fallback
        const currentRunningPrefs = user.preferences?.running || createDefaultRunningPreferences();
        
        const updatedRunningPreferences = {
          audioCoaching: currentRunningPrefs.audioCoaching ?? true,
          gpsTracking: currentRunningPrefs.gpsTracking ?? true,
          safetySharing: currentRunningPrefs.safetySharing ?? false,
          weatherAlerts: currentRunningPrefs.weatherAlerts ?? true,
          virtualBuddy: currentRunningPrefs.virtualBuddy ?? true,
          preferredUnit: currentRunningPrefs.preferredUnit ?? 'km',
          targetPace: currentRunningPrefs.targetPace ?? 6.0,
          ...preferences
        };
        
        const updatedPreferences = {
          ...user.preferences,
          running: updatedRunningPreferences
        };
        
        set({
          user: {
            ...user,
            preferences: updatedPreferences
          }
        });
      },
      
      initializeRunningProfile: () => {
        const { user } = get();
        if (!user || !user.runningProfile) {
          get().updateUserRunningProfile(createDefaultRunningProfile());
        }
      },
      
      // Subscription-specific actions
      updateSubscription: (subscription) => {
        const { user } = get();
        if (!user) return;
        
        const updatedSubscription = {
          ...user.subscription,
          ...subscription
        };
        
        set({
          user: {
            ...user,
            subscription: updatedSubscription
          }
        });
      },
      
      upgradeSubscription: (tier) => {
        const { user } = get();
        if (!user) return;
        
        const now = new Date();
        const nextBillingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        
        const updatedSubscription = {
          ...user.subscription,
          tier,
          status: 'active',
          nextBillingDate: nextBillingDate.toISOString(),
          autoRenew: true
        };
        
        set({
          user: {
            ...user,
            subscription: updatedSubscription
          }
        });
      },
      
      cancelSubscription: () => {
        const { user } = get();
        if (!user) return;
        
        const updatedSubscription = {
          ...user.subscription,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          autoRenew: false
        };
        
        set({
          user: {
            ...user,
            subscription: updatedSubscription
          }
        });
      },
      
      getSubscriptionTier: () => {
        const { user } = get();
        return user?.subscription?.tier || 'free';
      },
      
      hasFeatureAccess: (feature) => {
        const { user } = get();
        if (!user) return false;
        
        const tier = user.subscription.tier;
        
        // Define feature access by tier
        const featureAccess = {
          free: [
            'basic_workouts',
            'basic_nutrition',
            'community_basic',
            'champion_pass_basic'
          ],
          standard: [
            'basic_workouts',
            'basic_nutrition',
            'community_basic',
            'champion_pass_basic',
            'full_running_programs',
            'advanced_analytics',
            'unlimited_ai_recommendations',
            'champion_pass_full',
            'priority_support'
          ],
          elite: [
            'basic_workouts',
            'basic_nutrition',
            'community_basic',
            'champion_pass_basic',
            'full_running_programs',
            'advanced_analytics',
            'unlimited_ai_recommendations',
            'champion_pass_full',
            'priority_support',
            'vip_challenges',
            'virtual_coaching',
            'family_sharing',
            'champion_pass_vip'
          ]
        };
        
        return featureAccess[tier]?.includes(feature) || false;
      }
    }),
    {
      name: 'zown-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isOnboarded: state.isOnboarded,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          requestAnimationFrame(() => {
            const currentUser = state.user;
            const wasOnboarded = state.isOnboarded;
            if (!currentUser) {
              if (wasOnboarded) {
                useUserStore.setState({ user: createDefaultUser(), isLoading: false });
              } else {
                useUserStore.setState({ user: null, isLoading: false });
              }
            } else {
              useUserStore.setState({ isLoading: false });
            }
          });
        }
      }
    }
  )
);

// Export selectors for better performance
export const useUser = () => useUserStore(userSelector);
export const useIsOnboarded = () => useUserStore(isOnboardedSelector);
export const useIsLoading = () => useUserStore(isLoadingSelector);
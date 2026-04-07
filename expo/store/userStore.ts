import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useExpStore } from './expStore';
import { User, UserSubscription, UserPreferences } from '@/types';

interface FitnessMetrics {
  weight: number;
  height: number;
  bodyFat: number;
  muscleMass: number;
}

interface RunningProfile {
  totalDistance: number;
  totalRuns: number;
  totalTime: number;
  bestPace: number;
  longestRun: number;
  personalBests: Record<string, number>;
  runningLevel: string;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  streakDates: string[];
}

interface UserStoreState {
  user: User | null;
  isOnboarded: boolean;
  isLoading: boolean;
  setUser: (user: Partial<User>) => void;
  updateUser: (updates: Partial<User>) => void;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => void;
  updateUserGoals: (goals: string[]) => void;
  updateUserFitnessLevel: (level: string) => void;
  addXp: (amount: number) => void;
  calculateLevel: (xp: number) => number;
  updateStreak: (workoutCompleted: boolean) => void;
  getStreakData: () => StreakData;
  updateFitnessMetrics: (metrics: Partial<FitnessMetrics>) => void;
  incrementSteps: (steps: number) => void;
  logSleep: (duration: number, quality: number) => void;
  updateRecovery: (score: number) => void;
  logCaloriesBurned: (calories: number) => void;
  logActiveMinutes: (minutes: number) => void;
  updateHeartRate: (rate: number) => void;
  logWaterIntake: (amount: number) => void;
  resetDailyMetrics: () => void;
  logout: () => Promise<void>;
  startOnboarding: () => void;
  completeOnboarding: () => void;
  initializeDefaultUser: () => void;
  updateUserRunningProfile: (profile: Partial<RunningProfile>) => void;
  updateRunningPreferences: (preferences: Record<string, unknown>) => void;
  initializeRunningProfile: () => void;
  updateSubscription: (subscription: Partial<UserSubscription>) => void;
  upgradeSubscription: (tier: string) => void;
  cancelSubscription: () => void;
  getSubscriptionTier: () => string;
  hasFeatureAccess: (feature: string) => boolean;
}



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
const generateLevelRequirements = (): Record<number, number> => {
  const requirements: Record<number, number> = {};
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
const createDefaultSubscription = (): UserSubscription => ({
  tier: 'free' as const,
  status: 'active' as const,
  startDate: new Date().toISOString(),
  autoRenew: false
});

// Lazy default user creation
const createDefaultUser = (): User => ({
  id: 'default-user',
  name: 'Fitness Enthusiast',
  email: 'user@example.com',
  profileImage: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500',
  joinDate: new Date().toISOString(),
  fitnessLevel: 'beginner' as const,
  goals: ['strength', 'weight-loss', 'endurance'],
  exp: 150,
  xp: 150,
  expToNextLevel: 2100,
  level: 2,
  streak: 3,
  streakData: createDefaultStreakData(),
  preferences: createDefaultUserPreferences() as UserPreferences,
  fitnessMetrics: createDefaultFitnessMetrics(),
  expSystem: createDefaultExpSystem(),
  runningProfile: createDefaultRunningProfile(),
  subscription: createDefaultSubscription()
});

// Create selectors for better performance
const userSelector = (state: UserStoreState) => state.user;
const isOnboardedSelector = (state: UserStoreState) => state.isOnboarded;
const isLoadingSelector = (state: UserStoreState) => state.isLoading;

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      isOnboarded: false, // Set to false by default to show startup screen
      isLoading: false, // Changed to false for faster startup
      
      setUser: (user: Partial<User>) => set({ 
        user: {
          ...createDefaultUser(),
          ...user,
          fitnessMetrics: user.fitnessMetrics || createDefaultFitnessMetrics(),
          expSystem: user.expSystem || createDefaultExpSystem(),
          runningProfile: user.runningProfile || createDefaultRunningProfile(),
          subscription: user.subscription || createDefaultSubscription()
        },
        isLoading: false
      }),
      
      updateUser: (updates: Partial<User>) => {
        const { user } = get();
        if (!user) return;
        
        set({
          user: {
            ...user,
            ...updates
          }
        });
      },
      
      updateUserPreferences: (preferences: Partial<UserPreferences>) => {
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
      
      updateUserGoals: (goals: string[]) => {
        const { user } = get();
        if (!user) return;
        
        set({
          user: {
            ...user,
            goals
          }
        });
      },
      
      updateUserFitnessLevel: (level: string) => {
        const { user } = get();
        if (!user) return;
        
        set({
          user: {
            ...user,
            fitnessLevel: level as 'beginner' | 'intermediate' | 'advanced'
          }
        });
      },
      
      addXp: (amount: number) => {
        const { user } = get();
        if (!user) return;
        
        const newXp = user.exp + amount;
        const storeState = get();
        const newLevel = storeState.calculateLevel(newXp);
        
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
            (useExpStore.getState() as { addExp: (amount: number) => void }).addExp(amount);
          } catch (error) {
            console.error('Failed to update EXP store:', error);
          }
        });
      },
      
      calculateLevel: (xp: number) => {
        // Simple level calculation
        return Math.floor(xp / 1000) + 1;
      },
      
      updateStreak: (workoutCompleted: boolean) => {
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
      
      updateFitnessMetrics: (metrics: Partial<FitnessMetrics>) => {
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
      
      incrementSteps: (steps: number) => {
        // Implementation for step tracking
        console.log('Steps incremented:', steps);
      },
      
      logSleep: (duration: number, quality: number) => {
        // Implementation for sleep tracking
        console.log('Sleep logged:', duration, quality);
      },
      
      updateRecovery: (score: number) => {
        // Implementation for recovery tracking
        console.log('Recovery updated:', score);
      },
      
      logCaloriesBurned: (calories: number) => {
        // Implementation for calorie tracking
        console.log('Calories burned:', calories);
      },
      
      logActiveMinutes: (minutes: number) => {
        // Implementation for active minutes tracking
        console.log('Active minutes:', minutes);
      },
      
      updateHeartRate: (rate: number) => {
        // Implementation for heart rate tracking
        console.log('Heart rate updated:', rate);
      },
      
      logWaterIntake: (amount: number) => {
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
      updateUserRunningProfile: (profile: Partial<RunningProfile>) => {
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
      
      updateRunningPreferences: (preferences: Record<string, unknown>) => {
        const { user } = get();
        if (!user) return;
        
        // Get current running preferences with proper fallback
        const defaultPrefs = createDefaultRunningPreferences();
        const currentRunningPrefs = user.preferences?.running || defaultPrefs;
        
        const updatedRunningPreferences = {
          audioCoaching: currentRunningPrefs.audioCoaching ?? defaultPrefs.audioCoaching,
          gpsTracking: currentRunningPrefs.gpsTracking ?? defaultPrefs.gpsTracking,
          safetySharing: currentRunningPrefs.safetySharing ?? defaultPrefs.safetySharing,
          weatherAlerts: currentRunningPrefs.weatherAlerts ?? defaultPrefs.weatherAlerts,
          virtualBuddy: currentRunningPrefs.virtualBuddy ?? defaultPrefs.virtualBuddy,
          preferredUnit: currentRunningPrefs.preferredUnit ?? defaultPrefs.preferredUnit,
          targetPace: currentRunningPrefs.targetPace ?? defaultPrefs.targetPace,
          ...preferences
        };
        
        const updatedPreferences: UserPreferences = {
          ...user.preferences,
          running: updatedRunningPreferences as UserPreferences['running']
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
      updateSubscription: (subscription: Partial<UserSubscription>) => {
        const { user } = get();
        if (!user) return;
        
        const updatedSubscription: UserSubscription = {
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
      
      upgradeSubscription: (tier: string) => {
        const { user } = get();
        if (!user) return;
        
        const now = new Date();
        const nextBillingDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        
        const updatedSubscription: UserSubscription = {
          ...user.subscription,
          tier: tier as 'free' | 'standard' | 'elite',
          status: 'active' as const,
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
        
        const updatedSubscription: UserSubscription = {
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
      
      hasFeatureAccess: (feature: string) => {
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
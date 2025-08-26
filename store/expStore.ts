import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpActivity, ExpBreakdown, ExpSystem } from '@/types';

interface ExpState {
  expSystem: ExpSystem;
  isLoading: boolean;
  
  // Actions
  initializeExpSystem: () => void;
  addExp: (amount: number) => void;
  addExpActivity: (activity: ExpActivity) => void;
  getExpBreakdown: () => ExpBreakdown;
  getExpForLevel: (level: number) => number;
  getExpToNextLevel: () => number;
  getLevel: () => number;
  getRecentActivities: (count?: number) => ExpActivity[];
  calculateLevelFromExp: (exp: number) => number;
}

// Generate level requirements
const generateLevelRequirements = (): { [level: number]: number } => {
  const requirements: { [level: number]: number } = {};
  for (let level = 1; level <= 100; level++) {
    requirements[level] = level * 1000; // 1000 XP per level
  }
  return requirements;
};

// Default EXP system
const defaultExpSystem: ExpSystem = {
  totalExp: 0,
  level: 1,
  expToNextLevel: 2250,
  expSources: {
    workouts: 0,
    nutrition: 0,
    social: 0
  },
  levelRequirements: generateLevelRequirements()
};

// Base EXP values for different activity types
const baseExpValues = {
  // Updated values based on the provided table
  mainMission: 1125,
  sideMission: 375,
  sideMissionHike: 250,
  mealFiveStar: 55,
  mealFourStar: 44,
  mealThreeStar: 33,
  workoutHIIT: 750,
  workoutMIE: 500,
  workoutLISS: 250,
  eventWin: 500, // Updated from 250 to 500
  eventLose: 100,
  dailyChallenge: 150,
  weeklyChallenge: 250,
  // Running activities
  runningSession: 200,
  runningProgram: 500,
  runningChallenge: 300,
  virtualRace: 750,
  personalBest: 1000,
  // Hydration tiers
  hydrationTier1: 11,
  hydrationTier2: 22,
  hydrationTier3: 33,
  hydrationTier4: 44,
  hydrationTier5: 55
};

// Calculate multiplier based on level
const calculateMultiplier = (level: number): number => {
  // 43% increase per level, 7% decline per level
  const baseIncrease = 0.43;
  const baseDecline = 0.07;
  
  // Start with a multiplier of 1 for level 1
  let multiplier = 1.0;
  
  // Apply the increase and decline for each level
  for (let i = 2; i <= level; i++) {
    multiplier *= (1 + baseIncrease - baseDecline);
  }
  
  return multiplier;
};

export const useExpStore = create<ExpState>()(
  persist(
    (set, get) => ({
      expSystem: defaultExpSystem,
      isLoading: false,
      
      initializeExpSystem: () => {
        set({ expSystem: defaultExpSystem });
      },
      
      addExp: (amount) => {
        // Use requestAnimationFrame for better performance
        requestAnimationFrame(() => {
          const { expSystem } = get();
          const newTotalExp = expSystem.totalExp + amount;
          const newLevel = get().calculateLevelFromExp(newTotalExp);
          
          // Calculate EXP needed for the next level
          const expToNextLevel = (newLevel + 1) * 1000 - newTotalExp;
          
          set({
            expSystem: {
              ...expSystem,
              totalExp: newTotalExp,
              level: newLevel,
              expToNextLevel
            }
          });
        });
      },
      
      addExpActivity: (activity) => {
        const { expSystem } = get();
        const { level } = expSystem;
        
        // Calculate the multiplier based on the current level
        const levelMultiplier = calculateMultiplier(level);
        
        // Apply the multiplier to the base EXP
        let expAmount = activity.baseExp * levelMultiplier * activity.multiplier;
        
        // Round to the nearest integer
        expAmount = Math.round(expAmount);
        
        // Create a new activity with the calculated EXP
        const newActivity = {
          ...activity,
          baseExp: expAmount
        };
        
        // Update the EXP sources
        const updatedExpSources = { ...expSystem.expSources };
        
        switch (activity.type) {
          case 'workout':
          case 'running':
            updatedExpSources.workouts += expAmount;
            break;
          case 'meal':
            updatedExpSources.nutrition += expAmount;
            break;
          case 'event':
            updatedExpSources.social += expAmount;
            break;
        }
        
        // Update the EXP system
        set({
          expSystem: {
            ...expSystem,
            expSources: updatedExpSources
          }
        });
        
        // Add the EXP to the total
        get().addExp(expAmount);
      },
      
      getExpBreakdown: () => {
        const { expSystem } = get();
        const safeExpSystem = expSystem || defaultExpSystem;
        return {
          mainMissions: 0,
          sideMissions: 0,
          meals: safeExpSystem.expSources.nutrition,
          workouts: safeExpSystem.expSources.workouts,
          running: 0, // Will be calculated from workout activities
          events: safeExpSystem.expSources.social,
          total: safeExpSystem.totalExp
        };
      },
      
      getExpForLevel: (level) => {
        return level * 1000; // Simple calculation: 1000 XP per level
      },
      
      getExpToNextLevel: () => {
        const { expSystem } = get();
        const safeExpSystem = expSystem || defaultExpSystem;
        return safeExpSystem.expToNextLevel;
      },
      
      getLevel: () => {
        const { expSystem } = get();
        const safeExpSystem = expSystem || defaultExpSystem;
        return safeExpSystem.level;
      },
      
      getRecentActivities: (count = 10) => {
        // Return empty array for now - would be implemented with activity tracking
        return [];
      },
      
      calculateLevelFromExp: (exp) => {
        // Simple level calculation: 1000 XP per level
        return Math.floor(exp / 1000) + 1;
      }
    }),
    {
      name: 'zown-exp-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        expSystem: state.expSystem
      }),
      onRehydrateStorage: () => (state) => {
        // When storage is rehydrated, initialize the EXP system if needed
        if (state && (!state.expSystem || !state.expSystem.levelRequirements)) {
          // Use requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            useExpStore.getState().initializeExpSystem();
          });
        }
      }
    }
  )
);
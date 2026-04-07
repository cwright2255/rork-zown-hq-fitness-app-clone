import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const defaultAchievements = [
  {
    id: 'first-workout',
    name: 'First Steps',
    description: 'Complete your first workout',
    icon: '🏃‍♂️',
    category: 'workout',
    xpReward: 50,
    condition: {
      type: 'workout_count',
      target: 1
    },
    unlockedAt: undefined
  },
  {
    id: 'workout-streak-7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day workout streak',
    icon: '🔥',
    category: 'streak',
    xpReward: 200,
    condition: {
      type: 'streak',
      target: 7
    },
    unlockedAt: undefined
  },
  {
    id: 'workout-streak-30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day workout streak',
    icon: '💪',
    category: 'streak',
    xpReward: 500,
    condition: {
      type: 'streak',
      target: 30
    },
    unlockedAt: undefined
  },
  {
    id: 'calories-1000',
    name: 'Calorie Crusher',
    description: 'Burn 1000 calories in a single workout',
    icon: '🔥',
    category: 'workout',
    xpReward: 150,
    condition: {
      type: 'calories_burned',
      target: 1000
    },
    unlockedAt: undefined
  },
  {
    id: 'workouts-10',
    name: 'Dedicated Athlete',
    description: 'Complete 10 workouts',
    icon: '🏆',
    category: 'workout',
    xpReward: 300,
    condition: {
      type: 'workout_count',
      target: 10
    },
    unlockedAt: undefined
  },
  {
    id: 'workouts-50',
    name: 'Fitness Enthusiast',
    description: 'Complete 50 workouts',
    icon: '🌟',
    category: 'workout',
    xpReward: 750,
    condition: {
      type: 'workout_count',
      target: 50
    },
    unlockedAt: undefined
  },
  {
    id: 'workouts-100',
    name: 'Fitness Legend',
    description: 'Complete 100 workouts',
    icon: '👑',
    category: 'workout',
    xpReward: 1500,
    condition: {
      type: 'workout_count',
      target: 100
    },
    unlockedAt: undefined
  },
  {
    id: 'nutrition-streak-7',
    name: 'Nutrition Ninja',
    description: 'Log nutrition for 7 consecutive days',
    icon: '🥗',
    category: 'nutrition',
    xpReward: 150,
    condition: {
      type: 'nutrition_logged',
      target: 7
    },
    unlockedAt: undefined
  },
  {
    id: 'weight-loss-5',
    name: 'Weight Warrior',
    description: 'Lose 5 pounds',
    icon: '⚖️',
    category: 'progress',
    xpReward: 400,
    condition: {
      type: 'weight_lost',
      target: 5
    },
    unlockedAt: undefined
  },
  {
    id: 'social-butterfly',
    name: 'Social Butterfly',
    description: 'Make 10 social interactions',
    icon: '🦋',
    category: 'social',
    xpReward: 100,
    condition: {
      type: 'social_interactions',
      target: 10
    },
    unlockedAt: undefined
  },
  {
    id: 'level-5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: '⭐',
    category: 'level',
    xpReward: 250,
    condition: {
      type: 'level',
      target: 5
    },
    unlockedAt: undefined
  },
  {
    id: 'level-10',
    name: 'Elite Athlete',
    description: 'Reach level 10',
    icon: '🏅',
    category: 'level',
    xpReward: 500,
    condition: {
      type: 'level',
      target: 10
    },
    unlockedAt: undefined
  },
  {
    id: 'xp-1000',
    name: 'XP Collector',
    description: 'Earn 1000 XP',
    icon: '💎',
    category: 'xp',
    xpReward: 100,
    condition: {
      type: 'xp',
      target: 1000
    },
    unlockedAt: undefined
  },
  {
    id: 'xp-5000',
    name: 'XP Master',
    description: 'Earn 5000 XP',
    icon: '💰',
    category: 'xp',
    xpReward: 300,
    condition: {
      type: 'xp',
      target: 5000
    },
    unlockedAt: undefined
  },
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete 5 morning workouts',
    icon: '🌅',
    category: 'workout',
    xpReward: 200,
    condition: {
      type: 'morning_workouts',
      target: 5
    },
    unlockedAt: undefined
  }
];

export const useAchievementStore = create(
  persist(
    (set, get) => ({
      achievements: defaultAchievements,
      unlockedAchievements: [],

      checkAchievements: (data) => {
        const { achievements, unlockedAchievements } = get();
        const newlyUnlocked = [];

        achievements.forEach(achievement => {
          // Skip if already unlocked
          if (unlockedAchievements.includes(achievement.id)) {
            return;
          }

          const { condition } = achievement;
          let shouldUnlock = false;

          // Check condition based on type
          switch (condition.type) {
            case 'workout_count':
              shouldUnlock = (data.workoutsCompleted || data.totalWorkouts || 0) >= (condition.target || 0);
              break;
            case 'streak':
              shouldUnlock = (data.streak || 0) >= (condition.target || 0);
              break;
            case 'calories_burned':
              shouldUnlock = (data.caloriesBurned || 0) >= (condition.target || 0);
              break;
            case 'weight_lost':
              shouldUnlock = (data.weightLost || 0) >= (condition.target || 0);
              break;
            case 'nutrition_logged':
              shouldUnlock = (data.nutritionLogged || 0) >= (condition.target || 0);
              break;
            case 'social_interactions':
              shouldUnlock = (data.socialInteractions || 0) >= (condition.target || 0);
              break;
            case 'level':
              shouldUnlock = (data.level || 0) >= (condition.target || 0);
              break;
            case 'xp':
              shouldUnlock = (data.xp || 0) >= (condition.target || 0);
              break;
            case 'morning_workouts':
              // This would need additional tracking in the future
              shouldUnlock = false;
              break;
          }

          if (shouldUnlock) {
            const unlockedAchievement = {
              ...achievement,
              unlockedAt: new Date().toISOString()
            };
            newlyUnlocked.push(unlockedAchievement);
          }
        });

        // Update store with newly unlocked achievements
        if (newlyUnlocked.length > 0) {
          set(state => ({
            unlockedAchievements: [
              ...state.unlockedAchievements,
              ...newlyUnlocked.map(a => a.id)
            ],
            achievements: state.achievements.map(achievement => {
              const unlocked = newlyUnlocked.find(u => u.id === achievement.id);
              return unlocked ? unlocked : achievement;
            })
          }));
        }

        return newlyUnlocked;
      },

      unlockAchievement: (achievementId) => {
        const { achievements, unlockedAchievements } = get();
        
        if (unlockedAchievements.includes(achievementId)) {
          return;
        }

        set(state => ({
          unlockedAchievements: [...state.unlockedAchievements, achievementId],
          achievements: state.achievements.map(achievement =>
            achievement.id === achievementId
              ? { ...achievement, unlockedAt: new Date().toISOString() }
              : achievement
          )
        }));
      },
      
      updateAchievementProgress: (achievementId, progress) => {
        const { achievements, unlockedAchievements } = get();
        
        if (unlockedAchievements.includes(achievementId)) {
          return;
        }
        
        const achievement = achievements.find(a => a.id === achievementId);
        if (achievement && achievement.condition.target) {
          if (progress >= achievement.condition.target) {
            set(state => ({
              unlockedAchievements: [...state.unlockedAchievements, achievementId],
              achievements: state.achievements.map(a =>
                a.id === achievementId
                  ? { ...a, unlockedAt: new Date().toISOString() }
                  : a
              )
            }));
          }
        }
      },

      getUnlockedAchievements: () => {
        const { achievements, unlockedAchievements } = get();
        return achievements.filter(achievement => 
          unlockedAchievements.includes(achievement.id)
        );
      },

      getLockedAchievements: () => {
        const { achievements, unlockedAchievements } = get();
        return achievements.filter(achievement => 
          !unlockedAchievements.includes(achievement.id)
        );
      },

      initializeAchievements: () => {
        const { achievements } = get();
        if (achievements.length === 0) {
          set({ achievements: defaultAchievements });
        }
      }
    }),
    {
      name: 'zown-achievement-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        unlockedAchievements: state.unlockedAchievements,
        achievements: state.achievements.map(achievement => ({
          ...achievement,
          unlockedAt: achievement.unlockedAt
        }))
      })
    }
  )
);
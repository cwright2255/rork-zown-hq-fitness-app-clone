import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
}];


// Which achievements are unlocked is decided on the server (functions/src/unlockRules.js, run by functions/src/unlocks.js after every
// workout and XP claim) and written to users/{uid}/data/achievements, which the phone can read and never write. This store holds the
// catalog above (the names, icons and targets are the same for everyone) and shows what the server has unlocked: services/progressSync.js
// hands it each change, and loadAchievements fetches it once. Nothing here decides an unlock or writes one.
export const useAchievementStore = create(
  persist(
    (set, get) => ({
      achievements: defaultAchievements,
      unlockedAchievements: [],

      // `unlocked` is the `unlocked` map of the server's document, { achievementId: time it was unlocked }. What the server says
      // replaces what the phone held, so one person's unlocks are never left on screen for another.
      applyServerUnlocks: (unlocked) => {
        const map = unlocked && typeof unlocked === 'object' && !Array.isArray(unlocked) ? unlocked : {};
        set((state) => ({
          unlockedAchievements: Object.keys(map).filter((id) => map[id]),
          achievements: state.achievements.map((a) => ({ ...a, unlockedAt: map[a.id] || undefined })),
        }));
      },

      // Back to nothing unlocked, when the person signs out.
      clearServerUnlocks: () => get().applyServerUnlocks({}),

      loadAchievements: async (uid) => {
        if (!uid) return;
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'achievements'));
          if (snap.exists()) get().applyServerUnlocks(snap.data().unlocked);
        } catch (e) {
          console.warn('[achievementStore] loadAchievements error:', e?.message);
        }
      },

      getUnlockedAchievements: () => {
        const { achievements, unlockedAchievements } = get();
        return achievements.filter((achievement) =>
        unlockedAchievements.includes(achievement.id)
        );
      },

      getLockedAchievements: () => {
        const { achievements, unlockedAchievements } = get();
        return achievements.filter((achievement) =>
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
        achievements: state.achievements.map((achievement) => ({
          ...achievement,
          unlockedAt: achievement.unlockedAt
        }))
      })
    }
  )
);

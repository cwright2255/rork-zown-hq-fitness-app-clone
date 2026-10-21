import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Default badges
const defaultBadges = [
{
  id: 'badge-1',
  name: 'First Workout',
  description: 'Complete your first workout',
  imageUrl: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=500',
  category: 'workout',
  rarity: 'common',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-2',
  name: 'Nutrition Novice',
  description: 'Log your first meal',
  imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500',
  category: 'nutrition',
  rarity: 'common',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-3',
  name: 'Consistency Champion',
  description: 'Maintain a 7-day workout streak',
  imageUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=500',
  category: 'consistency',
  rarity: 'uncommon',
  isUnlocked: false
},
{
  id: 'badge-4',
  name: 'Strength Master',
  description: 'Complete 10 strength workouts',
  imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500',
  category: 'workout',
  rarity: 'uncommon',
  isUnlocked: false
},
{
  id: 'badge-5',
  name: 'Cardio King',
  description: 'Complete 10 cardio workouts',
  imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
  category: 'workout',
  rarity: 'uncommon',
  isUnlocked: false
},
{
  id: 'badge-6',
  name: 'Flexibility Guru',
  description: 'Complete 10 flexibility workouts',
  imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500',
  category: 'workout',
  rarity: 'uncommon',
  isUnlocked: false
},
{
  id: 'badge-7',
  name: 'Nutrition Expert',
  description: 'Log meals for 30 consecutive days',
  imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500',
  category: 'nutrition',
  rarity: 'rare',
  isUnlocked: false
},
{
  id: 'badge-8',
  name: 'Hydration Hero',
  description: 'Meet your water intake goal for 7 consecutive days',
  imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=500',
  category: 'nutrition',
  rarity: 'uncommon',
  isUnlocked: false
},
{
  id: 'badge-9',
  name: 'Sleep Champion',
  description: 'Get 8+ hours of sleep for 7 consecutive days',
  imageUrl: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=500',
  category: 'wellness',
  rarity: 'rare',
  isUnlocked: false
},
{
  id: 'badge-10',
  name: 'Fitness Legend',
  description: 'Reach level 10',
  imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500',
  category: 'achievement',
  rarity: 'legendary',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-11',
  name: 'First Trail',
  description: 'Complete your first tracked hike',
  imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=500',
  category: 'hiking',
  rarity: 'common',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-12',
  name: 'Strenuous Summit',
  description: 'Complete a hike rated Strenuous or harder on the Shenandoah difficulty scale',
  imageUrl: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=500',
  category: 'hiking',
  rarity: 'rare',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-13',
  name: 'Trail Blazer',
  description: 'Hike 10 total miles',
  imageUrl: 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=500',
  category: 'hiking',
  rarity: 'rare',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-14',
  name: 'Race Day',
  description: 'Finish a virtual race',
  imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
  category: 'running',
  rarity: 'uncommon',
  isUnlocked: false,
  unlockedAt: null
},
{
  id: 'badge-15',
  name: 'Trailblazer',
  description: 'Finish a virtual journey',
  imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
  category: 'running',
  rarity: 'rare',
  isUnlocked: false,
  unlockedAt: null
}];


// Which badges are unlocked is decided on the server (functions/src/unlockRules.js, run by functions/src/unlocks.js after every workout
// and XP claim) and written to users/{uid}/data/badges, which the phone can read and never write. This store holds the catalog above
// (the names, pictures and rarities are the same for everyone) and shows what the server has unlocked: services/progressSync.js hands it
// each change, and loadBadges fetches it once. Nothing here decides an unlock or writes one.
export const useBadgeStore = create(
  persist(
    (set, get) => ({
      badges: [],
      isLoading: false,

      // `unlocked` is the `unlocked` map of the server's document, { badgeId: time it was unlocked }. What the server says replaces
      // what the phone held, so one person's badges are never left on screen for another.
      applyServerUnlocks: (unlocked) => {
        const map = unlocked && typeof unlocked === 'object' && !Array.isArray(unlocked) ? unlocked : {};
        get().initializeDefaultBadges();
        set((state) => ({
          badges: state.badges.map((b) =>
            map[b.id]
              ? { ...b, isUnlocked: true, unlockedAt: map[b.id] }
              : { ...b, isUnlocked: false, unlockedAt: null }
          ),
        }));
      },

      // Back to nothing unlocked, when the person signs out.
      clearServerUnlocks: () => get().applyServerUnlocks({}),

      loadBadges: async (uid) => {
        if (!uid) return;
        get().initializeDefaultBadges();
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'badges'));
          if (snap.exists()) get().applyServerUnlocks(snap.data().unlocked);
        } catch (e) {
          console.warn('[badgeStore] loadBadges error:', e?.message);
        }
      },

      getUnlockedBadges: () => {
        const { badges } = get();
        return badges.filter((badge) => badge.isUnlocked || badge.unlockedAt);
      },

      getBadgesByCategory: (category) => {
        const { badges } = get();
        return badges.filter((badge) => badge.category === category);
      },

      getBadgeById: (id) => {
        const { badges } = get();
        return badges.find((badge) => badge.id === id);
      },

      // Sets up the badge list, and adds any badge a saved list does not have yet
      // (badges added in a later version), keeping what is saved.
      initializeDefaultBadges: () => {
        const badges = get().badges || [];
        const known = new Set(badges.map((badge) => badge.id));
        const missing = defaultBadges.filter((badge) => !known.has(badge.id));

        if (missing.length > 0) {
          set({ badges: [...badges, ...missing] });
        }
      }
    }),
    {
      name: 'zown-badge-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // When storage is rehydrated, set up the badges (and add any new ones)
        if (state) {
          setTimeout(() => {
            useBadgeStore.getState().initializeDefaultBadges();
          }, 50);
        }
      }
    }
  )
);
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
}];


export const useBadgeStore = create(
  persist(
    (set, get) => ({
      badges: [],
      isLoading: false,

      // Only unlock state needs to sync (name/description/imageUrl/rarity
      // is the same fixed catalog for every user) — stores just the set of
      // unlocked badge ids + timestamps, applied on top of the local catalog.
      loadBadges: async (uid) => {
        if (!uid) return;
        const { badges } = get();
        if (badges.length === 0) get().initializeDefaultBadges();
        try {
          const snap = await getDoc(doc(db, 'users', uid, 'data', 'badges'));
          if (snap.exists()) {
            const unlocked = snap.data().unlocked || {};
            set((state) => ({
              badges: state.badges.map((b) =>
                unlocked[b.id]
                  ? { ...b, isUnlocked: true, unlockedAt: unlocked[b.id] }
                  : b
              ),
            }));
          }
        } catch (e) {
          console.warn('[badgeStore] loadBadges error:', e?.message);
        }
      },

      unlockBadge: (id, uid) => {
        const { badges } = get();
        const badgeIndex = badges.findIndex((badge) => badge.id === id);

        if (badgeIndex >= 0 && !badges[badgeIndex].isUnlocked) {
          const unlockedAt = new Date().toISOString();
          const updatedBadges = [...badges];
          updatedBadges[badgeIndex] = {
            ...updatedBadges[badgeIndex],
            isUnlocked: true,
            unlockedAt,
          };

          set({ badges: updatedBadges });

          if (uid) {
            setDoc(doc(db, 'users', uid, 'data', 'badges'), {
              unlocked: { [id]: unlockedAt },
            }, { merge: true }).catch((e) =>
              console.warn('[badgeStore] unlock sync failed:', e?.message)
            );
          }
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

      initializeDefaultBadges: () => {
        const { badges } = get();

        if (badges.length === 0) {
          set({ badges: defaultBadges });
        }
      }
    }),
    {
      name: 'zown-badge-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        // When storage is rehydrated, initialize badges if needed
        if (state && (!state.badges || state.badges.length === 0)) {
          setTimeout(() => {
            useBadgeStore.getState().initializeDefaultBadges();
          }, 50);
        }
      }
    }
  )
);
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default badges
const defaultBadges = [
  {
    id: 'badge-1',
    name: 'First Workout',
    description: 'Complete your first workout',
    imageUrl: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=500',
    category: 'workout',
    rarity: 'common',
    isUnlocked: true,
    unlockedAt: new Date().toISOString()
  },
  {
    id: 'badge-2',
    name: 'Nutrition Novice',
    description: 'Log your first meal',
    imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500',
    category: 'nutrition',
    rarity: 'common',
    isUnlocked: true,
    unlockedAt: new Date().toISOString()
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
    isUnlocked: false
  }
];

export const useBadgeStore = create(
  persist(
    (set, get) => ({
      badges: [],
      isLoading: false,
      
      unlockBadge: (id) => {
        const { badges } = get();
        const badgeIndex = badges.findIndex(badge => badge.id === id);
        
        if (badgeIndex >= 0 && !badges[badgeIndex].isUnlocked && !badges[badgeIndex].unlockedAt) {
          const updatedBadges = [...badges];
          updatedBadges[badgeIndex] = {
            ...updatedBadges[badgeIndex],
            isUnlocked: true,
            unlockedAt: new Date().toISOString()
          };
          
          set({ badges: updatedBadges });
        }
      },
      
      getUnlockedBadges: () => {
        const { badges } = get();
        return badges.filter(badge => badge.isUnlocked || badge.unlockedAt);
      },
      
      getBadgesByCategory: (category) => {
        const { badges } = get();
        return badges.filter(badge => badge.category === category);
      },
      
      getBadgeById: (id) => {
        const { badges } = get();
        return badges.find(badge => badge.id === id);
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
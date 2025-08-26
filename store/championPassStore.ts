import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChampionPassTier, ChampionPassReward, SubscriptionTier } from '@/types';

interface ChampionPassState {
  tiers: ChampionPassTier[];
  currentTier: number;
  isPremium: boolean;
  seasonEndDate: string;
  seasonStartDate: string;
  seasonName: string;
  
  // Actions
  initializeChampionPass: () => void;
  updateCurrentTier: (xp: number, subscriptionTier?: SubscriptionTier) => void;
  unlockTier: (tierId: number) => void;
  claimReward: (tierId: number, rewardId: string) => void;
  upgradeToPremium: () => void;
  getAvailableRewards: () => ChampionPassReward[];
  getNextTierXp: () => number;
  getCurrentTierProgress: (xp: number) => number;
  getTierAccessLevel: (subscriptionTier: SubscriptionTier) => 'basic' | 'full' | 'vip';
}

export const useChampionPassStore = create<ChampionPassState>()(
  persist(
    (set, get) => ({
      tiers: [],
      currentTier: 0,
      isPremium: false,
      seasonEndDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
      seasonStartDate: new Date().toISOString(),
      seasonName: "Season 1: Rise of Champions",
      
      initializeChampionPass: () => {
        // Create default champion pass tiers with subscription-based access
        const defaultTiers: ChampionPassTier[] = [
          {
            id: 0,
            name: "Rookie",
            description: "Your first step to greatness",
            level: 0,
            requiredExp: 0,
            xpRequired: 0,
            benefits: ['Access to basic workouts', 'Community features'],
            rewards: [
              {
                id: "badge-rookie",
                name: "Rookie Badge",
                description: "Your first step to greatness",
                imageUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=100",
                type: "badge",
                isClaimed: false
              }
            ],
            isUnlocked: true,
            isPremium: false
          },
          {
            id: 1,
            name: "Runner",
            description: "Welcome to the running community",
            level: 1,
            requiredExp: 100,
            xpRequired: 100,
            benefits: ['Access to running programs', 'Basic tracking'],
            rewards: [
              {
                id: "badge-runner",
                name: "Runner Badge",
                description: "Welcome to the running community",
                imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100",
                type: "badge",
                isClaimed: false
              },
              {
                id: "running-program-c25k",
                name: "Couch to 5K Program",
                description: "Unlock the popular C25K program",
                imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=100",
                type: "content",
                isClaimed: false
              }
            ],
            isUnlocked: false,
            isPremium: false
          },
          {
            id: 2,
            name: "Athlete",
            description: "Dedicated to excellence",
            level: 2,
            requiredExp: 250,
            xpRequired: 250,
            benefits: ['Advanced running analytics', 'Virtual buddy'],
            rewards: [
              {
                id: "badge-athlete",
                name: "Athlete Badge",
                description: "Dedicated to excellence",
                imageUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=100",
                type: "badge",
                isClaimed: false
              },
              {
                id: "running-buddy",
                name: "Virtual Running Buddy",
                description: "Get a virtual companion for your runs",
                imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100",
                type: "feature",
                isClaimed: false
              }
            ],
            isUnlocked: false,
            isPremium: true // Requires Standard or Elite subscription
          },
          {
            id: 3,
            name: "Champion",
            description: "Among the elite",
            level: 3,
            requiredExp: 500,
            xpRequired: 500,
            benefits: ['Premium running gear discounts', 'Exclusive challenges'],
            rewards: [
              {
                id: "badge-champion",
                name: "Champion Badge",
                description: "Among the elite",
                imageUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=100",
                type: "badge",
                isClaimed: false
              },
              {
                id: "running-gear-discount",
                name: "Running Gear Discount",
                description: "15% off all running gear",
                imageUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=100",
                type: "discount",
                value: "15",
                isClaimed: false
              }
            ],
            isUnlocked: false,
            isPremium: true // Requires Standard or Elite subscription
          },
          {
            id: 4,
            name: "Elite Runner",
            description: "Elite performance achieved",
            level: 4,
            requiredExp: 1000,
            xpRequired: 1000,
            benefits: ['Exclusive virtual races', 'Premium coaching'],
            rewards: [
              {
                id: "badge-elite-runner",
                name: "Elite Runner Badge",
                description: "Elite performance achieved",
                imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=100",
                type: "badge",
                isClaimed: false
              },
              {
                id: "premium-coaching",
                name: "Premium Audio Coaching",
                description: "Advanced AI-powered running coach",
                imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=100",
                type: "feature",
                isClaimed: false
              }
            ],
            isUnlocked: false,
            isPremium: true // Requires Standard or Elite subscription
          },
          {
            id: 5,
            name: "Legend",
            description: "The pinnacle of achievement",
            level: 5,
            requiredExp: 2000,
            xpRequired: 2000,
            benefits: ['Legendary status', 'Exclusive gear', 'VIP support'],
            rewards: [
              {
                id: "badge-legend",
                name: "Legend Badge",
                description: "The pinnacle of achievement",
                imageUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=100",
                type: "badge",
                isClaimed: false
              },
              {
                id: "legendary-running-gear",
                name: "Legendary Running Gear",
                description: "Exclusive premium running equipment",
                imageUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=100",
                type: "running-gear",
                isClaimed: false
              },
              {
                id: "premium-discount-max",
                name: "Maximum Discount",
                description: "25% off your next purchase",
                imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=100",
                type: "discount",
                value: "25",
                isClaimed: false
              }
            ],
            isUnlocked: false,
            isPremium: true // Requires Elite subscription for VIP rewards
          }
        ];
        
        set({ tiers: defaultTiers });
      },
      
      updateCurrentTier: (xp, subscriptionTier = 'free') => {
        const { tiers } = get();
        const accessLevel = get().getTierAccessLevel(subscriptionTier);
        
        // Find the highest tier that the user has enough XP for and subscription access
        let highestUnlockedTier = 0;
        
        for (let i = 0; i < tiers.length; i++) {
          const tier = tiers[i];
          const hasXpRequirement = xp >= tier.requiredExp;
          const hasSubscriptionAccess = !tier.isPremium || accessLevel !== 'basic';
          
          if (hasXpRequirement && hasSubscriptionAccess) {
            highestUnlockedTier = i;
            
            // Update tier unlock status
            if (!tier.isUnlocked) {
              const updatedTiers = [...tiers];
              updatedTiers[i] = { ...updatedTiers[i], isUnlocked: true };
              set({ tiers: updatedTiers });
            }
          }
        }
        
        set({ currentTier: highestUnlockedTier });
      },
      
      unlockTier: (tierId) => {
        const { tiers } = get();
        const tierIndex = tiers.findIndex(tier => tier.id === tierId);
        
        if (tierIndex >= 0) {
          const updatedTiers = [...tiers];
          updatedTiers[tierIndex] = { ...updatedTiers[tierIndex], isUnlocked: true };
          set({ tiers: updatedTiers });
        }
      },
      
      claimReward: (tierId, rewardId) => {
        const { tiers } = get();
        const tierIndex = tiers.findIndex(tier => tier.id === tierId);
        
        if (tierIndex >= 0) {
          const tier = tiers[tierIndex];
          const rewardIndex = tier.rewards.findIndex(reward => reward.id === rewardId);
          
          if (rewardIndex >= 0) {
            const updatedTiers = [...tiers];
            const updatedRewards = [...tier.rewards];
            updatedRewards[rewardIndex] = { ...updatedRewards[rewardIndex], isClaimed: true };
            updatedTiers[tierIndex] = { ...updatedTiers[tierIndex], rewards: updatedRewards };
            
            set({ tiers: updatedTiers });
          }
        }
      },
      
      upgradeToPremium: () => {
        set({ isPremium: true });
      },
      
      getAvailableRewards: () => {
        const { tiers, currentTier } = get();
        
        // Get all rewards from unlocked tiers
        const availableRewards: ChampionPassReward[] = [];
        
        for (let i = 0; i <= currentTier; i++) {
          const tier = tiers[i];
          
          if (tier) {
            tier.rewards.forEach(reward => {
              // Include reward if it's not claimed
              if (!reward.isClaimed) {
                availableRewards.push(reward);
              }
            });
          }
        }
        
        return availableRewards;
      },
      
      getNextTierXp: () => {
        const { tiers, currentTier } = get();
        
        // If at max tier, return current tier XP
        if (currentTier >= tiers.length - 1) {
          return tiers[currentTier]?.requiredExp || 0;
        }
        
        // Otherwise return next tier XP
        return tiers[currentTier + 1]?.requiredExp || 0;
      },
      
      getCurrentTierProgress: (xp) => {
        const { tiers, currentTier } = get();
        
        // If at max tier, return 100%
        if (currentTier >= tiers.length - 1) {
          return 1;
        }
        
        const currentTierXp = tiers[currentTier]?.requiredExp || 0;
        const nextTierXp = tiers[currentTier + 1]?.requiredExp || 0;
        
        // Calculate progress percentage
        if (nextTierXp <= currentTierXp) return 1;
        
        const progress = (xp - currentTierXp) / (nextTierXp - currentTierXp);
        return Math.min(Math.max(progress, 0), 1); // Clamp between 0 and 1
      },
      
      getTierAccessLevel: (subscriptionTier) => {
        switch (subscriptionTier) {
          case 'elite':
            return 'vip';
          case 'standard':
            return 'full';
          default:
            return 'basic';
        }
      }
    }),
    {
      name: 'zown-champion-pass-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
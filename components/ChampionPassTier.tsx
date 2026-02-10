import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Lock, Check, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { ChampionPassTier as ChampionPassTierType } from '@/types';

interface ChampionPassTierProps {
  tier: ChampionPassTierType;
  isPremium: boolean;
  isActive: boolean;
  onPress: () => void;
}

const ChampionPassTier: React.FC<ChampionPassTierProps> = ({
  tier,
  isPremium,
  isActive,
  onPress,
}) => {
  const isLocked = tier.isPremium && !isPremium;
  const hasUnclaimedRewards = tier.isUnlocked && tier.rewards.some((reward: { isClaimed: boolean }) => !reward.isClaimed);
  
  return (
    <TouchableOpacity
      style={[
        styles.container,
        isActive && styles.activeContainer,
        isLocked && styles.lockedContainer,
      ]}
      onPress={onPress}
      disabled={!tier.isUnlocked && !isActive}
    >
      <View style={styles.levelBadge}>
        <Text style={styles.levelText}>{tier.level}</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{tier.name}</Text>
          {tier.isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.description} numberOfLines={1}>
          {tier.description}
        </Text>
        
        <View style={styles.rewardsPreview}>
          {tier.rewards.slice(0, 2).map((reward: { id: string; imageUrl: string; isClaimed: boolean }, index: number) => (
            <View key={reward.id} style={styles.rewardPreview}>
              <Image 
                source={{ uri: reward.imageUrl }} 
                style={[
                  styles.rewardImage,
                  reward.isClaimed && styles.claimedRewardImage
                ]} 
              />
              {reward.isClaimed && (
                <View style={styles.claimedOverlay}>
                  <Check size={12} color={Colors.text.inverse} />
                </View>
              )}
            </View>
          ))}
          
          {tier.rewards.length > 2 && (
            <View style={styles.moreRewards}>
              <Text style={styles.moreRewardsText}>+{tier.rewards.length - 2}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.status}>
        {isLocked ? (
          <Lock size={20} color={Colors.text.tertiary} />
        ) : tier.isUnlocked ? (
          hasUnclaimedRewards ? (
            <View style={styles.unclaimedBadge}>
              <Text style={styles.unclaimedText}>CLAIM</Text>
            </View>
          ) : (
            <View style={styles.completedBadge}>
              <Check size={16} color={Colors.success} />
            </View>
          )
        ) : (
          <ChevronRight size={20} color={Colors.text.tertiary} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeContainer: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  lockedContainer: {
    opacity: 0.7,
  },
  levelBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  levelText: {
    color: Colors.text.inverse,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginRight: 8,
  },
  premiumBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  premiumText: {
    color: Colors.text.inverse,
    fontSize: 10,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  rewardsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardPreview: {
    position: 'relative',
    marginRight: 8,
  },
  rewardImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  claimedRewardImage: {
    opacity: 0.5,
  },
  claimedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreRewards: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreRewardsText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  status: {
    marginLeft: 12,
  },
  unclaimedBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unclaimedText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '700',
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${Colors.success}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChampionPassTier;
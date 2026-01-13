import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Dimensions } from 'react-native';
import { Stack } from 'expo-router';
import { Award, Star, Lock, ChevronRight, Gift, ChevronLeft } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import { useUserStore } from '@/store/userStore';
import { useChampionPassStore } from '@/store/championPassStore';

interface Reward {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  isClaimed: boolean;
}

interface Tier {
  id: number;
  name: string;
  description?: string;
  level: number;
  requiredExp: number;
  rewards: Reward[];
  isUnlocked: boolean;
  isPremium: boolean;
}

interface User {
  exp?: number;
  [key: string]: unknown;
}

interface UserStore {
  user: User | null;
}

interface ChampionPassStore {
  tiers: Tier[];
  currentTier: number;
  isPremium: boolean;
  initializeChampionPass: () => void;
  updateCurrentTier: (xp: number) => void;
  getAvailableRewards: () => Reward[];
  getCurrentTierProgress: (xp: number) => number;
  getNextTierXp: () => number;
  upgradeToPremium: () => void;
  claimReward: (tierId: number, rewardId: string) => void;
}

const { width } = Dimensions.get('window');

export default function ChampionPassScreen() {
  const { user } = useUserStore() as UserStore;
  const { 
    tiers, 
    currentTier, 
    isPremium, 
    initializeChampionPass, 
    updateCurrentTier, 
    getAvailableRewards,
    getCurrentTierProgress,
    getNextTierXp,
    upgradeToPremium,
    claimReward
  } = useChampionPassStore() as ChampionPassStore;
  
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentRewardIndex, setCurrentRewardIndex] = useState(0);
  const tiersPerPage = 7;
  
  // Initialize champion pass if needed
  useEffect(() => {
    if (tiers.length === 0) {
      initializeChampionPass();
    }
    
    // Update current tier based on user XP
    if (user) {
      updateCurrentTier(user.exp || 0);
    }
  }, [initializeChampionPass, updateCurrentTier, user, tiers.length]);
  
  // Auto-scroll available rewards carousel
  useEffect(() => {
    const availableRewards = getAvailableRewards();
    if (availableRewards.length > 1) {
      const interval = setInterval(() => {
        setCurrentRewardIndex((prevIndex) => (prevIndex + 1) % availableRewards.length);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [getAvailableRewards]);
  
  const handleClaimReward = (tierId: number, rewardId: string) => {
    // Claim the reward
    claimReward(tierId, rewardId);
    
    // Show success message
    Alert.alert('Reward Claimed', 'You have successfully claimed your reward!');
  };
  
  const handleUpgradeToPremium = () => {
    // In a real app, this would open a payment flow
    Alert.alert(
      'Upgrade to Premium',
      'Unlock all premium rewards and features for $9.99/month.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Upgrade',
          onPress: () => {
            upgradeToPremium();
            Alert.alert('Success', 'You have successfully upgraded to Premium!');
          },
        },
      ]
    );
  };
  
  // Handle rewards carousel scroll
  const handleRewardsScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.8));
    setCurrentRewardIndex(index);
  }, []);
  
  // Navigate rewards carousel
  const navigateRewards = useCallback((direction: 'prev' | 'next') => {
    const availableRewards = getAvailableRewards();
    if (direction === 'prev') {
      setCurrentRewardIndex((prev) => prev === 0 ? availableRewards.length - 1 : prev - 1);
    } else {
      setCurrentRewardIndex((prev) => (prev + 1) % availableRewards.length);
    }
  }, [getAvailableRewards]);
  
  // Calculate total pages
  const totalPages = Math.ceil(tiers.length / tiersPerPage);
  
  // Get current page tiers
  const currentTiers = tiers.slice(
    (currentPage - 1) * tiersPerPage,
    currentPage * tiersPerPage
  );
  
  // Render tier details view
  const renderTierDetails = () => {
    if (selectedTier === null) return null;
    
    const tier = tiers[selectedTier];
    
    return (
      <View style={styles.tierDetailsContainer}>
        <View style={styles.tierDetailsHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedTier(null)}
          >
            <Text style={styles.backButtonText}>Back to Tiers</Text>
          </TouchableOpacity>
          
          <View style={styles.tierBadge}>
            <Text style={styles.tierBadgeText}>TIER {tier.level}</Text>
          </View>
        </View>
        
        <Text style={styles.tierDetailsTitle}>{tier.name}</Text>
        <Text style={styles.tierDetailsDescription}>{tier.description || `${tier.name} tier description`}</Text>
        
        <View style={styles.tierRequirement}>
          <Star size={16} color={Colors.warning} />
          <Text style={styles.tierRequirementText}>
            Required XP: {tier.requiredExp}
          </Text>
        </View>
        
        <Text style={styles.rewardsTitle}>Rewards</Text>
        
        {tier.rewards.map((reward: Reward) => (
          <View key={reward.id} style={styles.rewardItem}>
            <Image
              source={{ uri: reward.imageUrl }}
              style={styles.rewardImage}
            />
            
            <View style={styles.rewardInfo}>
              <Text style={styles.rewardName}>{reward.name}</Text>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
              <Text style={styles.rewardType}>{reward.type.toUpperCase()}</Text>
            </View>
            
            {tier.isUnlocked ? (
              reward.isClaimed ? (
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedText}>CLAIMED</Text>
                </View>
              ) : (
                <Button
                  title="Claim"
                  onPress={() => handleClaimReward(tier.id, reward.id)}
                  style={styles.claimButton}
                  disabled={tier.isPremium && !isPremium}
                />
              )
            ) : (
              <Lock size={20} color={Colors.text.tertiary} />
            )}
          </View>
        ))}
        
        {tier.isPremium && !isPremium && (
          <View style={styles.premiumLockContainer}>
            <Lock size={24} color={Colors.warning} />
            <Text style={styles.premiumLockText}>
              Premium rewards require Champion Pass Premium
            </Text>
            <Button
              title="Upgrade to Premium"
              onPress={handleUpgradeToPremium}
              style={styles.upgradePremiumButton}
            />
          </View>
        )}
      </View>
    );
  };
  
  // Render champion pass grid
  const renderChampionPassGrid = () => {
    return (
      <>
        <View style={styles.seasonHeader}>
          <View>
            <Text style={styles.seasonTitle}>SEASON 1</Text>
            <Text style={styles.seasonSubtitle}>RISE OF CHAMPIONS</Text>
          </View>
          
          <View style={styles.tierProgress}>
            <Award size={20} color={Colors.warning} style={styles.tierProgressIcon} />
            <Text style={styles.tierProgressText}>
              {currentTier} / {tiers.length}
            </Text>
          </View>
        </View>
        
        <View style={styles.xpProgressContainer}>
          <View style={styles.xpProgressBar}>
            <ProgressBar
              progress={getCurrentTierProgress(user?.exp || 0)}
              height={12}
              progressColor={Colors.warning}
              style={styles.progressBar}
            />
            
            <View style={styles.xpLabels}>
              <Text style={styles.currentXpLabel}>{user?.exp || 0}</Text>
              <Text style={styles.nextXpLabel}>{getNextTierXp()}</Text>
            </View>
          </View>
          
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationText}>
              PAGE {currentPage} / {totalPages}
            </Text>
          </View>
        </View>
        
        <View style={styles.tiersGrid}>
          {/* Tier numbers row */}
          <View style={styles.tierNumbersRow}>
            {currentTiers.map((tier: Tier, index: number) => (
              <View key={`number-${tier.id}`} style={styles.tierNumberCell}>
                <Text style={styles.tierNumberText}>{tier.level}</Text>
              </View>
            ))}
          </View>
          
          {/* Free rewards row */}
          <View style={styles.rewardsRow}>
            {currentTiers.map((tier, index) => {
              const freeRewards = tier.rewards.filter((r: Reward) => !r.isClaimed && !tier.isPremium);
              const isUnlocked = tier.isUnlocked;
              const isActive = tier.level === currentTier + 1;
              
              return (
                <TouchableOpacity
                  key={`free-${tier.id}`}
                  style={[
                    styles.rewardCell,
                    isUnlocked && styles.unlockedRewardCell,
                    isActive && styles.activeRewardCell
                  ]}
                  onPress={() => setSelectedTier(tiers.findIndex(t => t.id === tier.id))}
                >
                  {freeRewards.length > 0 ? (
                    <Image
                      source={{ uri: freeRewards[0].imageUrl }}
                      style={styles.rewardCellImage}
                    />
                  ) : (
                    <View style={styles.emptyRewardCell} />
                  )}
                  
                  {isUnlocked && freeRewards.length > 0 && (
                    <View style={styles.checkmarkBadge}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                  
                  {!isUnlocked && (
                    <View style={styles.lockOverlay}>
                      <Lock size={16} color={Colors.text.inverse} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Premium badge */}
          <View style={styles.premiumBadgeContainer}>
            <View style={styles.premiumBadge}>
              <Star size={16} color={Colors.text.inverse} />
              <Text style={styles.premiumBadgeText}>PREMIUM</Text>
            </View>
          </View>
          
          {/* Premium rewards row */}
          <View style={styles.rewardsRow}>
            {currentTiers.map((tier, index) => {
              const premiumRewards = tier.rewards.filter((r: Reward) => !r.isClaimed && tier.isPremium);
              const isUnlocked = tier.isUnlocked && isPremium;
              
              return (
                <TouchableOpacity
                  key={`premium-${tier.id}`}
                  style={[
                    styles.rewardCell,
                    styles.premiumRewardCell,
                    isUnlocked && styles.unlockedPremiumRewardCell
                  ]}
                  onPress={() => setSelectedTier(tiers.findIndex(t => t.id === tier.id))}
                >
                  {premiumRewards.length > 0 ? (
                    <Image
                      source={{ uri: premiumRewards[0].imageUrl }}
                      style={styles.rewardCellImage}
                    />
                  ) : (
                    <View style={styles.emptyRewardCell} />
                  )}
                  
                  {isUnlocked && premiumRewards.length > 0 && (
                    <View style={styles.checkmarkBadge}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                  
                  {!isUnlocked && (
                    <View style={styles.lockOverlay}>
                      <Lock size={16} color={Colors.text.inverse} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          
          {/* Additional premium rewards rows */}
          <View style={styles.rewardsRow}>
            {currentTiers.map((tier, index) => {
              const additionalRewards = tier.rewards.filter((r: Reward) => !r.isClaimed && tier.isPremium).slice(1, 2);
              const isUnlocked = tier.isUnlocked && isPremium;
              
              return (
                <TouchableOpacity
                  key={`premium2-${tier.id}`}
                  style={[
                    styles.rewardCell,
                    styles.premiumRewardCell,
                    isUnlocked && styles.unlockedPremiumRewardCell
                  ]}
                  onPress={() => setSelectedTier(tiers.findIndex(t => t.id === tier.id))}
                >
                  {additionalRewards.length > 0 ? (
                    <Image
                      source={{ uri: additionalRewards[0].imageUrl }}
                      style={styles.rewardCellImage}
                    />
                  ) : (
                    <View style={styles.emptyRewardCell} />
                  )}
                  
                  {isUnlocked && additionalRewards.length > 0 && (
                    <View style={styles.checkmarkBadge}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                  
                  {!isUnlocked && (
                    <View style={styles.lockOverlay}>
                      <Lock size={16} color={Colors.text.inverse} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === 1 && styles.disabledPaginationButton]}
            onPress={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Text style={styles.paginationButtonText}>Previous</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.paginationButton, currentPage === totalPages && styles.disabledPaginationButton]}
            onPress={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.paginationButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
        
        {!isPremium && (
          <View style={styles.premiumPromoContainer}>
            <Text style={styles.premiumPromoText}>
              Purchase the Champion Pass to claim all the rewards you have earned
            </Text>
            <Button
              title="Upgrade to Premium"
              onPress={handleUpgradeToPremium}
              style={styles.premiumPromoButton}
            />
          </View>
        )}
      </>
    );
  };
  
  const availableRewards = getAvailableRewards();
  
  return (
    <>
      <Stack.Screen options={{ title: 'Champion Pass' }} />
      
      <View style={styles.container}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Card variant="elevated" style={styles.championPassHeader}>
            <View style={styles.championPassInfo}>
              <View>
                <Text style={styles.championPassTitle}>Champion Pass</Text>
                <Text style={styles.championPassSeason}>Season 1: Rise of Champions</Text>
              </View>
              
              {!isPremium && (
                <Button
                  title="Upgrade"
                  onPress={handleUpgradeToPremium}
                  style={styles.upgradeButton}
                />
              )}
            </View>
            
            <View style={styles.tierProgressContainer}>
              <View style={styles.tierProgressLabels}>
                <Text style={styles.tierProgressLabel}>
                  Tier {currentTier}: {tiers[currentTier]?.name || 'Loading...'}
                </Text>
                <Text style={styles.tierProgressLabel}>
                  {user?.exp || 0} / {getNextTierXp()} XP
                </Text>
              </View>
              
              <ProgressBar
                progress={getCurrentTierProgress(user?.exp || 0)}
                height={8}
                progressColor={Colors.primary}
                style={styles.tierProgressBar}
              />
            </View>
          </Card>
          
          {selectedTier !== null ? renderTierDetails() : renderChampionPassGrid()}
          
          {availableRewards.length > 0 && selectedTier === null && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Available Rewards</Text>
                {availableRewards.length > 1 && (
                  <View style={styles.carouselControls}>
                    <TouchableOpacity 
                      style={styles.carouselButton}
                      onPress={() => navigateRewards('prev')}
                    >
                      <ChevronLeft size={16} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.carouselButton}
                      onPress={() => navigateRewards('next')}
                    >
                      <ChevronRight size={16} color={Colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              <View style={styles.rewardsCarouselContainer}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  snapToInterval={width * 0.8 + 16}
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.availableRewardsScroll}
                  onMomentumScrollEnd={handleRewardsScroll}
                >
                  {availableRewards.map((reward: Reward) => (
                    <TouchableOpacity
                      key={reward.id}
                      style={styles.availableRewardItem}
                      onPress={() => {
                        // Find the tier that contains this reward
                        const tierIndex = tiers.findIndex(tier => 
                          tier.rewards.some(r => r.id === reward.id)
                        );
                        
                        if (tierIndex >= 0) {
                          setSelectedTier(tierIndex);
                        }
                      }}
                    >
                      <Image
                        source={{ uri: reward.imageUrl }}
                        style={styles.availableRewardImage}
                      />
                      <Text style={styles.availableRewardName} numberOfLines={1}>
                        {reward.name}
                      </Text>
                      <Text style={styles.availableRewardType} numberOfLines={1}>
                        {reward.type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                
                {/* Carousel Indicators */}
                {availableRewards.length > 1 && (
                  <View style={styles.indicatorsContainer}>
                    {availableRewards.map((_: Reward, index: number) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.indicator, 
                          currentRewardIndex === index && styles.activeIndicator
                        ]}
                        onPress={() => setCurrentRewardIndex(index)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  championPassHeader: {
    marginBottom: 16,
  },
  championPassInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  championPassTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  championPassSeason: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  upgradeButton: {
    paddingHorizontal: 16,
  },
  tierProgressContainer: {
    marginBottom: 8,
  },
  tierProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tierProgressLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  tierProgressBar: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  carouselControls: {
    flexDirection: 'row',
    gap: 8,
  },
  carouselButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rewardsCarouselContainer: {
    marginBottom: 16,
  },
  availableRewardsScroll: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  availableRewardItem: {
    alignItems: 'center',
    width: width * 0.8,
    marginRight: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  availableRewardImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  availableRewardName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  availableRewardType: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inactive,
    marginHorizontal: 4,
  },
  activeIndicator: {
    backgroundColor: Colors.primary,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tierDetailsContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tierDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: Colors.primary,
  },
  tierBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
  tierDetailsTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  tierDetailsDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  tierRequirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  tierRequirementText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  rewardsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 16,
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  rewardImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  rewardType: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  claimButton: {
    paddingHorizontal: 16,
  },
  claimedBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  claimedText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
  premiumLockContainer: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: `${Colors.warning}10`,
    borderRadius: 8,
    marginTop: 16,
  },
  premiumLockText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginVertical: 8,
  },
  upgradePremiumButton: {
    marginTop: 8,
  },
  seasonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 8,
  },
  seasonTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  seasonSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  tierProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierProgressIcon: {
    marginRight: 8,
  },
  tierProgressText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  xpProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  xpProgressBar: {
    flex: 1,
    marginRight: 16,
  },
  progressBar: {
    marginBottom: 4,
  },
  xpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  currentXpLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  nextXpLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  paginationContainer: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  tiersGrid: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  tierNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tierNumberCell: {
    width: 40,
    alignItems: 'center',
  },
  tierNumberText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  rewardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  rewardCell: {
    width: 40,
    height: 40,
    backgroundColor: Colors.background,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unlockedRewardCell: {
    borderWidth: 2,
    borderColor: Colors.success,
  },
  activeRewardCell: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  premiumRewardCell: {
    backgroundColor: `${Colors.warning}20`,
  },
  unlockedPremiumRewardCell: {
    borderWidth: 2,
    borderColor: Colors.warning,
  },
  rewardCellImage: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  emptyRewardCell: {
    width: 32,
    height: 32,
    backgroundColor: Colors.border,
    borderRadius: 4,
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  premiumBadgeContainer: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
    marginLeft: 4,
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  disabledPaginationButton: {
    backgroundColor: Colors.border,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.inverse,
  },
  premiumPromoContainer: {
    backgroundColor: Colors.warning,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  premiumPromoText: {
    fontSize: 14,
    color: Colors.text.inverse,
    textAlign: 'center',
    marginBottom: 12,
  },
  premiumPromoButton: {
    backgroundColor: Colors.text.inverse,
  },
});
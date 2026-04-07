import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, FlatList, Dimensions, useWindowDimensions, Platform } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Calendar, ChevronLeft, ChevronRight, Award, Star, Lock, TrendingUp, Gift } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import { useUserStore } from '@/store/userStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useChampionPassStore } from '@/store/championPassStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useAchievementStore } from '@/store/achievementStore';
import ChampionPassTier from '@/components/ChampionPassTier';
import StreakCalendar from '@/components/StreakCalendar';
import BadgeItem from '@/components/BadgeItem';
import AchievementCard from '@/components/AchievementCard';
import { Achievement, Badge, ProgressEntry } from '@/types';

interface TierReward {
  id: string;
  name: string;
  description: string;
  type: string;
  imageUrl: string;
  isClaimed?: boolean;
}
import { useProgressStore } from '@/store/progressStore';

export default function ProgressTrackerScreen() {
  const params = useLocalSearchParams();
  const initialTab = params.tab as string || 'champion';
  const { width } = useWindowDimensions();
  
  const { user, addXp, calculateLevel } = useUserStore() as {
    user: any;
    addXp: (amount: number) => void;
    calculateLevel: (xp: number) => number;
  };
  const { getWorkoutStreak, completedWorkouts = [], getWorkoutsByDate } = useWorkoutStore() as {
    getWorkoutStreak: () => { current: number; longest: number };
    completedWorkouts: any[];
    getWorkoutsByDate: (date: string) => any[];
  };
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
  } = useChampionPassStore() as {
    tiers: any[];
    currentTier: number;
    isPremium: boolean;
    initializeChampionPass: () => void;
    updateCurrentTier: (xp: number) => void;
    getAvailableRewards: () => any[];
    getCurrentTierProgress: (xp: number) => number;
    getNextTierXp: () => number;
    upgradeToPremium: () => void;
    claimReward: (tierId: number, rewardId: string) => void;
  };
  const { badges, initializeBadges, getUnlockedBadges } = useBadgeStore() as {
    badges: Badge[];
    initializeBadges: () => void;
    getUnlockedBadges: () => Badge[];
  };
  const { 
    achievements, 
    getUnlockedAchievements, 
    getInProgressAchievements, 
    initializeAchievements 
  } = useAchievementStore() as {
    achievements: Achievement[];
    getUnlockedAchievements: () => Achievement[];
    getInProgressAchievements: () => Achievement[];
    initializeAchievements: () => void;
  };
  const { entries: progressEntries } = useProgressStore() as {
    entries: ProgressEntry[];
  };
  
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(getInitialIndex(initialTab));
  const flatListRef = useRef<FlatList>(null);
  
  // Create a stable viewability config object
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;
  
  // Memoize the viewability callback to prevent it from changing on re-renders
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;
  
  function getInitialIndex(tab: string): number {
    switch(tab) {
      case 'champion': return 0;
      case 'streaks': return 1;
      case 'stats': return 2;
      case 'achievements': return 3;
      default: return 0;
    }
  }
  
  function getTabFromIndex(index: number): string {
    switch(index) {
      case 0: return 'champion';
      case 1: return 'streaks';
      case 2: return 'stats';
      case 3: return 'achievements';
      default: return 'champion';
    }
  }
  
  // Calculate XP needed for next level
  const calculateXpForNextLevel = (level: number) => {
    return (level + 1) * (level + 1) * 100;
  };
  
  const xpForNextLevel = user ? calculateXpForNextLevel(user.level) : 100;
  
  // Initialize champion pass, badges, and achievements if needed
  useEffect(() => {
    if (tiers.length === 0) {
      initializeChampionPass();
    }
    
    if (badges.length === 0) {
      initializeBadges();
    }
    
    if (achievements.length === 0) {
      initializeAchievements();
    }
    
    // Update current tier based on user XP
    if (user) {
      updateCurrentTier(user.xp);
    }
  }, [initializeChampionPass, initializeBadges, initializeAchievements, updateCurrentTier, user, tiers.length, badges.length, achievements.length]);
  
  const streakData = user?.streakData || { currentStreak: 0, longestStreak: 0, streakHistory: [] };
  const workoutStreak = getWorkoutStreak();
  
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
  
  const handleViewSection = (index: number) => {
    setActiveIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleRecordBodyScan = () => {
    router.push('/profile/body-scan' as any);
  };
  
  const renderChampionPassTab = () => (
    <ScrollView 
      style={styles.sectionScrollView}
      contentContainerStyle={styles.sectionContent}
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
              {user?.xp || 0} / {getNextTierXp()} XP
            </Text>
          </View>
          
          <ProgressBar
            progress={getCurrentTierProgress(user?.xp || 0)}
            height={8}
            progressColor={Colors.primary}
            style={styles.tierProgressBar}
          />
        </View>
      </Card>
      
      {selectedTier !== null ? (
        <Card variant="elevated" style={styles.tierDetailsCard}>
          <View style={styles.tierDetailsHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedTier(null)}
            >
              <ChevronLeft size={20} color={Colors.text.primary} />
              <Text style={styles.backButtonText}>Back to Tiers</Text>
            </TouchableOpacity>
            
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>TIER {tiers[selectedTier]?.level}</Text>
            </View>
          </View>
          
          <Text style={styles.tierDetailsTitle}>{tiers[selectedTier]?.name}</Text>
          <Text style={styles.tierDetailsDescription}>{tiers[selectedTier]?.description}</Text>
          
          <View style={styles.tierRequirement}>
            <Star size={16} color={Colors.warning} />
            <Text style={styles.tierRequirementText}>
              Required XP: {tiers[selectedTier]?.xpRequired}
            </Text>
          </View>
          
          <Text style={styles.rewardsTitle}>Rewards</Text>
          
          {tiers[selectedTier]?.rewards.map((reward: TierReward) => (
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
              
              {tiers[selectedTier]?.isUnlocked ? (
                reward.isClaimed ? (
                  <View style={styles.claimedBadge}>
                    <Text style={styles.claimedText}>CLAIMED</Text>
                  </View>
                ) : (
                  <Button
                    title="Claim"
                    onPress={() => handleClaimReward(tiers[selectedTier]?.id, reward.id)}
                    style={styles.claimButton}
                    disabled={tiers[selectedTier]?.isPremium && !isPremium}
                  />
                )
              ) : (
                <Lock size={20} color={Colors.text.tertiary} />
              )}
            </View>
          ))}
          
          {tiers[selectedTier]?.isPremium && !isPremium && (
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
        </Card>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Champion Tiers</Text>
          
          {tiers.map((tier, index) => (
            <ChampionPassTier
              key={tier.id}
              tier={tier}
              isPremium={isPremium}
              isActive={index === currentTier}
              onPress={() => setSelectedTier(index)}
            />
          ))}
          
          {getAvailableRewards().length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Available Rewards</Text>
              
              <Card variant="elevated" style={styles.availableRewardsCard}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.availableRewardsScroll}
                >
                  {getAvailableRewards().map(reward => (
                    <TouchableOpacity
                      key={reward.id}
                      style={styles.availableRewardItem}
                      onPress={() => {
                        // Find the tier that contains this reward
                        const tierIndex = tiers.findIndex(tier => 
                          tier.rewards.some((r: TierReward) => r.id === reward.id)
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
              </Card>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
  
  const renderStreaksTab = () => (
    <ScrollView 
      style={styles.sectionScrollView}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      <StreakCalendar compact={false} streakData={streakData} />
      
      <Card variant="elevated" style={styles.streakStatsCard}>
        <View style={styles.streakStatsHeader}>
          <Calendar size={20} color={Colors.text.primary} />
          <Text style={styles.streakStatsTitle}>Workout Consistency</Text>
        </View>
        
        <View style={styles.streakStats}>
          <View style={styles.streakStat}>
            <Text style={styles.streakStatValue}>{workoutStreak.current}</Text>
            <Text style={styles.streakStatLabel}>Current Streak</Text>
          </View>
          
          <View style={styles.streakStatDivider} />
          
          <View style={styles.streakStat}>
            <Text style={styles.streakStatValue}>{workoutStreak.longest}</Text>
            <Text style={styles.streakStatLabel}>Longest Streak</Text>
          </View>
        </View>
        
        <View style={styles.streakTips}>
          <Text style={styles.streakTipsTitle}>Streak Tips:</Text>
          <Text style={styles.streakTip}>• Complete at least one workout every day to maintain your streak</Text>
          <Text style={styles.streakTip}>• Longer streaks earn you more XP and special badges</Text>
          <Text style={styles.streakTip}>• If you miss a day, your streak will reset to zero</Text>
        </View>
        
        <View style={styles.streakRewards}>
          <Text style={styles.streakRewardsTitle}>Streak Rewards:</Text>
          
          <View style={styles.streakRewardItem}>
            <View style={[styles.streakRewardBadge, { backgroundColor: `${Colors.success}20` }]}>
              <Text style={[styles.streakRewardBadgeText, { color: Colors.success }]}>3</Text>
            </View>
            <Text style={styles.streakRewardText}>3-Day Streak: +50 XP</Text>
          </View>
          
          <View style={styles.streakRewardItem}>
            <View style={[styles.streakRewardBadge, { backgroundColor: `${Colors.primary}20` }]}>
              <Text style={[styles.streakRewardBadgeText, { color: Colors.primary }]}>7</Text>
            </View>
            <Text style={styles.streakRewardText}>7-Day Streak: +100 XP & Badge</Text>
          </View>
          
          <View style={styles.streakRewardItem}>
            <View style={[styles.streakRewardBadge, { backgroundColor: `${Colors.warning}20` }]}>
              <Text style={[styles.streakRewardBadgeText, { color: Colors.warning }]}>30</Text>
            </View>
            <Text style={styles.streakRewardText}>30-Day Streak: +500 XP & Epic Badge</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
  
  const renderStatsTab = () => (
    <ScrollView 
      style={styles.sectionScrollView}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      <Card variant="elevated" style={styles.xpStatsCard}>
        <View style={styles.xpStatsHeader}>
          <Award size={20} color={Colors.text.primary} />
          <Text style={styles.xpStatsTitle}>XP & Level Progress</Text>
        </View>
        
        <View style={styles.levelInfo}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{user?.level || 1}</Text>
          </View>
          
          <View style={styles.levelDetails}>
            <Text style={styles.levelTitle}>Level {user?.level || 1}</Text>
            <Text style={styles.levelXp}>{user?.xp || 0} XP</Text>
            
            <View style={styles.levelProgressContainer}>
              <ProgressBar
                progress={(user?.xp || 0) / xpForNextLevel}
                height={8}
                progressColor={Colors.primary}
                style={styles.levelProgressBar}
              />
              
              <Text style={styles.levelProgressText}>
                {xpForNextLevel - (user?.xp || 0)} XP until level {(user?.level || 1) + 1}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.xpBreakdown}>
          <Text style={styles.xpBreakdownTitle}>XP Breakdown:</Text>
          
          <View style={styles.xpBreakdownItem}>
            <Text style={styles.xpBreakdownLabel}>Workouts Completed</Text>
            <Text style={styles.xpBreakdownValue}>+{completedWorkouts.length * 10} XP</Text>
          </View>
          
          <View style={styles.xpBreakdownItem}>
            <Text style={styles.xpBreakdownLabel}>Achievements Unlocked</Text>
            <Text style={styles.xpBreakdownValue}>+{getUnlockedAchievements().length * 50} XP</Text>
          </View>
          
          <View style={styles.xpBreakdownItem}>
            <Text style={styles.xpBreakdownLabel}>Streak Bonuses</Text>
            <Text style={styles.xpBreakdownValue}>+{workoutStreak.longest * 20} XP</Text>
          </View>
        </View>
      </Card>
      
      <Card variant="elevated" style={styles.badgesCard}>
        <View style={styles.badgesHeader}>
          <Award size={20} color={Colors.text.primary} />
          <Text style={styles.badgesTitle}>Recent Badges</Text>
          
          <TouchableOpacity 
            style={styles.viewAllBadges}
            onPress={() => handleViewSection(3)} // Navigate to achievements tab
          >
            <Text style={styles.viewAllBadgesText}>View All</Text>
            <ChevronRight size={16} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.badgesContainer}>
          {getUnlockedBadges().slice(0, 4).map(badge => (
            <BadgeItem 
              key={badge.id} 
              badge={badge} 
              onPress={() => Alert.alert(badge.name, badge.description)}
            />
          ))}
          
          {getUnlockedBadges().length === 0 && (
            <Text style={styles.noBadgesText}>
              You haven't unlocked any badges yet. Complete workouts and maintain streaks to earn badges.
            </Text>
          )}
        </View>
      </Card>
      
      <Card variant="elevated" style={styles.nextMilestonesCard}>
        <View style={styles.nextMilestonesHeader}>
          <TrendingUp size={20} color={Colors.text.primary} />
          <Text style={styles.nextMilestonesTitle}>Next Milestones</Text>
        </View>
        
        <View style={styles.milestoneItem}>
          <View style={styles.milestoneIconContainer}>
            <Gift size={20} color={Colors.primary} />
          </View>
          
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneName}>Next Champion Tier</Text>
            <Text style={styles.milestoneDescription}>
              {currentTier < tiers.length - 1 
                ? `Reach ${getNextTierXp() - (user?.xp || 0)} more XP to unlock Tier ${currentTier + 1}`
                : "You've reached the maximum tier!"}
            </Text>
            
            <ProgressBar
              progress={getCurrentTierProgress(user?.xp || 0)}
              height={6}
              progressColor={Colors.primary}
              style={styles.milestoneProgress}
            />
          </View>
        </View>
        
        <View style={styles.milestoneItem}>
          <View style={styles.milestoneIconContainer}>
            <Calendar size={20} color={Colors.warning} />
          </View>
          
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneName}>Streak Milestone</Text>
            <Text style={styles.milestoneDescription}>
              {workoutStreak.current < 3 
                ? `Complete ${3 - workoutStreak.current} more days to reach a 3-day streak`
                : workoutStreak.current < 7 
                  ? `Complete ${7 - workoutStreak.current} more days to reach a 7-day streak`
                  : workoutStreak.current < 30 
                    ? `Complete ${30 - workoutStreak.current} more days to reach a 30-day streak`
                    : "You've achieved a 30-day streak! Keep it going!"}
            </Text>
            
            <ProgressBar
              progress={
                workoutStreak.current < 3 
                  ? workoutStreak.current / 3
                  : workoutStreak.current < 7 
                    ? workoutStreak.current / 7
                    : workoutStreak.current < 30 
                      ? workoutStreak.current / 30
                      : 1
              }
              height={6}
              progressColor={Colors.warning}
              style={styles.milestoneProgress}
            />
          </View>
        </View>
        
        <View style={styles.milestoneItem}>
          <View style={styles.milestoneIconContainer}>
            <Award size={20} color={Colors.success} />
          </View>
          
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneName}>Level Up</Text>
            <Text style={styles.milestoneDescription}>
              Earn {xpForNextLevel - (user?.xp || 0)} more XP to reach level {(user?.level || 1) + 1}
            </Text>
            
            <ProgressBar
              progress={(user?.xp || 0) / xpForNextLevel}
              height={6}
              progressColor={Colors.success}
              style={styles.milestoneProgress}
            />
          </View>
        </View>
      </Card>

      {/* Body Scan Section */}
      <Card variant="elevated" style={styles.bodyScanCard}>
        <View style={styles.bodyScanHeader}>
          <Text style={styles.bodyScanTitle}>Body Measurements</Text>
        </View>
        
        {progressEntries.length > 0 ? (
          <View style={styles.bodyScanInfo}>
            <Text style={styles.bodyScanText}>
              You have {progressEntries.length} body scan{progressEntries.length !== 1 ? 's' : ''} recorded
            </Text>
            <Button
              title="Record New Scan"
              onPress={handleRecordBodyScan}
              style={styles.bodyScanButton}
            />
          </View>
        ) : (
          <View style={styles.bodyScanEmpty}>
            <Text style={styles.bodyScanEmptyText}>
              No body scans recorded yet. Create your first 3D body scan to track your progress and try on clothes virtually.
            </Text>
            <Button
              title="Create Your First Scan"
              onPress={handleRecordBodyScan}
              style={styles.bodyScanButton}
            />
          </View>
        )}
      </Card>
    </ScrollView>
  );
  
  const renderAchievementsTab = () => {
    const unlockedAchievements = getUnlockedAchievements();
    const inProgressAchievements = getInProgressAchievements();
    const lockedAchievements = achievements.filter(
      a => !a.isUnlocked && a.progress === 0
    );
    
    return (
      <ScrollView 
        style={styles.sectionScrollView}
        contentContainerStyle={styles.sectionContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.achievementStatsContainer}>
          <View style={styles.achievementStatItem}>
            <Text style={styles.achievementStatValue}>{unlockedAchievements.length}</Text>
            <Text style={styles.achievementStatLabel}>Unlocked</Text>
          </View>
          
          <View style={styles.achievementStatDivider} />
          
          <View style={styles.achievementStatItem}>
            <Text style={styles.achievementStatValue}>{inProgressAchievements.length}</Text>
            <Text style={styles.achievementStatLabel}>In Progress</Text>
          </View>
          
          <View style={styles.achievementStatDivider} />
          
          <View style={styles.achievementStatItem}>
            <Text style={styles.achievementStatValue}>{achievements.length}</Text>
            <Text style={styles.achievementStatLabel}>Total</Text>
          </View>
        </View>
        
        {/* Unlocked Achievements */}
        {unlockedAchievements.length > 0 && (
          <>
            <Text style={styles.achievementSectionTitle}>Unlocked Achievements</Text>
            {unlockedAchievements.map(achievement => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </>
        )}
        
        {/* In Progress Achievements */}
        {inProgressAchievements.length > 0 && (
          <>
            <Text style={styles.achievementSectionTitle}>In Progress</Text>
            {inProgressAchievements.map(achievement => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </>
        )}
        
        {/* Locked Achievements */}
        {lockedAchievements.length > 0 && (
          <>
            <Text style={styles.achievementSectionTitle}>Locked</Text>
            {lockedAchievements.map(achievement => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </>
        )}
        
        {/* Empty State */}
        {achievements.length === 0 && (
          <View style={styles.emptyContainer}>
            <Award size={48} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Achievements</Text>
            <Text style={styles.emptyText}>
              Complete workouts and track your nutrition to earn achievements.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };
  
  const renderSectionTitle = (index: number) => {
    const titles = ['Champion Pass', 'Streaks', 'Stats', 'Achievements'];
    const icons = [
      <Award key="award" size={20} color={Colors.primary} />,
      <Calendar key="calendar" size={20} color={Colors.primary} />,
      <TrendingUp key="trending" size={20} color={Colors.primary} />,
      <Award key="award2" size={20} color={Colors.primary} />
    ];
    
    return (
      <View style={styles.sectionTitleContainer}>
        {icons[index]}
        <Text style={styles.carouselSectionTitle}>{titles[index]}</Text>
      </View>
    );
  };
  
  const renderItem = ({ item, index }: { item: string, index: number }) => {
    switch (index) {
      case 0:
        return renderChampionPassTab();
      case 1:
        return renderStreaksTab();
      case 2:
        return renderStatsTab();
      case 3:
        return renderAchievementsTab();
      default:
        return null;
    }
  };
  
  // For web compatibility
  const renderContent = () => {
    if (Platform.OS === 'web') {
      // On web, render the active tab directly without FlatList
      switch (activeIndex) {
        case 0:
          return renderChampionPassTab();
        case 1:
          return renderStreaksTab();
        case 2:
          return renderStatsTab();
        case 3:
          return renderAchievementsTab();
        default:
          return renderChampionPassTab();
      }
    } else {
      // On mobile, use FlatList for swipeable tabs
      return (
        <FlatList
          ref={flatListRef}
          data={['champion', 'streaks', 'stats', 'achievements']}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={activeIndex}
          getItemLayout={(data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          style={styles.carousel}
        />
      );
    }
  };
  
  return (
    <>
      <Stack.Screen options={{ title: 'Progress Tracker' }} />
      
      <View style={styles.container}>
        {/* Section Title */}
        {renderSectionTitle(activeIndex)}
        
        {/* Content - FlatList on mobile, direct rendering on web */}
        {renderContent()}
        
        {/* Pagination Dots */}
        <View style={styles.paginationContainer}>
          {['champion', 'streaks', 'stats', 'achievements'].map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.paginationDot,
                activeIndex === index && styles.paginationDotActive
              ]}
              onPress={() => handleViewSection(index)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  carousel: {
    flex: 1,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  carouselSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.tertiary,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  sectionScrollView: {
    width: Dimensions.get('window').width,
  },
  sectionContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    marginTop: 8,
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
    fontWeight: '700',
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
  tierDetailsCard: {
    marginBottom: 16,
  },
  tierDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 4,
  },
  tierBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  tierDetailsTitle: {
    fontSize: 24,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '700',
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
  availableRewardsCard: {
    marginBottom: 16,
  },
  availableRewardsScroll: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  availableRewardItem: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 100,
  },
  availableRewardImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
  },
  availableRewardName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  availableRewardType: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  streakStatsCard: {
    marginBottom: 16,
  },
  streakStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakStatsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  streakStat: {
    alignItems: 'center',
  },
  streakStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  streakStatLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  streakStatDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
  },
  streakTips: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  streakTipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  streakTip: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  streakRewards: {
    marginBottom: 8,
  },
  streakRewardsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  streakRewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  streakRewardBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streakRewardBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  streakRewardText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  xpStatsCard: {
    marginBottom: 16,
  },
  xpStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  xpStatsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  levelInfo: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  levelBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  levelBadgeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  levelDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  levelXp: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  levelProgressContainer: {
    marginTop: 4,
  },
  levelProgressBar: {
    marginBottom: 8,
  },
  levelProgressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  xpBreakdown: {
    marginBottom: 8,
  },
  xpBreakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  xpBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  xpBreakdownLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  xpBreakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  badgesCard: {
    marginBottom: 16,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  viewAllBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllBadgesText: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  noBadgesText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    padding: 16,
  },
  nextMilestonesCard: {
    marginBottom: 16,
  },
  nextMilestonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextMilestonesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  milestoneItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  milestoneIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  milestoneDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  milestoneProgress: {
    marginBottom: 4,
  },
  // Achievement tab styles
  achievementStatsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  achievementStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  achievementStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  achievementStatLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  achievementStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  achievementSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    marginTop: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // Body Scan Card
  bodyScanCard: {
    marginBottom: 16,
  },
  bodyScanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bodyScanTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  bodyScanInfo: {
    alignItems: 'center',
  },
  bodyScanText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  bodyScanButton: {
    minWidth: 200,
  },
  bodyScanEmpty: {
    alignItems: 'center',
    padding: 16,
  },
  bodyScanEmptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
});
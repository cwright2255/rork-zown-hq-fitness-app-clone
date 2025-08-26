import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { Settings, Award, TrendingUp, LogOut, ChevronRight, Camera, BarChart, Calendar, User, Edit, Activity, Crown } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import LevelProgress from '@/components/LevelProgress';
import AchievementCard from '@/components/AchievementCard';
import BottomNavigation from '@/components/BottomNavigation';
import SubscriptionOverviewCard from '@/components/SubscriptionOverviewCard';
import SubscriptionUpgradeModal from '@/components/SubscriptionUpgradeModal';
import { useUserStore } from '@/store/userStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useProgressStore } from '@/store/progressStore';
import { useExpStore } from '@/store/expStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useChampionPassStore } from '@/store/championPassStore';
import Input from '@/components/Input';
import Button from '@/components/Button';
import BadgeItem from '@/components/BadgeItem';
import ExpBreakdownChart from '@/components/ExpBreakdownChart';
import ExpActivityList from '@/components/ExpActivityList';
import { Badge, SubscriptionTier } from '@/types';
import { getSubscriptionPlan } from '@/constants/subscriptionPlans';
import { authService } from '@/services/authService';

export default function ProfileScreen() {
  const { user, logout, upgradeSubscription } = useUserStore();
  const { achievements, getUnlockedAchievements } = useAchievementStore();
  const { completedWorkouts } = useWorkoutStore();
  const { entries, getLatestEntry, addEntry } = useProgressStore();
  const { expSystem, getExpBreakdown, getRecentActivities, getExpToNextLevel } = useExpStore();
  const { badges, getUnlockedBadges } = useBadgeStore();
  const { currentTier, getCurrentTierProgress } = useChampionPassStore();
  
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'progress', 'badges', 'exp'
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Progress tracking state
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [measurements, setMeasurements] = useState({
    chest: '',
    waist: '',
    hips: '',
    arms: '',
    thighs: '',
  });
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  
  // Get latest entry for initial values
  useEffect(() => {
    const latestEntry = getLatestEntry();
    if (latestEntry) {
      setWeight(latestEntry.weight?.toString() || '');
      setBodyFat(latestEntry.bodyFat?.toString() || '');
      setMeasurements({
        chest: latestEntry.measurements?.chest?.toString() || '',
        waist: latestEntry.measurements?.waist?.toString() || '',
        hips: latestEntry.measurements?.hips?.toString() || '',
        arms: latestEntry.measurements?.arms?.toString() || '',
        thighs: latestEntry.measurements?.thighs?.toString() || '',
      });
    }
  }, [getLatestEntry]);
  
  // Calculate XP needed for next level
  const xpForNextLevel = useMemo(() => getExpToNextLevel(), [getExpToNextLevel]);
  
  // Get recent achievements
  const recentAchievements = useMemo(() => 
    getUnlockedAchievements().slice(0, 2), 
    [getUnlockedAchievements]
  );
  
  // Get recent badges
  const recentBadges = useMemo(() => 
    getUnlockedBadges().slice(0, 4), 
    [getUnlockedBadges]
  );
  
  // Get EXP breakdown
  const expBreakdown = useMemo(() => getExpBreakdown(), [getExpBreakdown]);
  
  // Get recent activities
  const recentActivities = useMemo(() => 
    getRecentActivities(3), 
    [getRecentActivities]
  );
  
  // Stats
  const stats = useMemo(() => [
    {
      label: 'Workouts',
      value: completedWorkouts?.length || 0,
    },
    {
      label: 'Achievements',
      value: getUnlockedAchievements().length,
    },
    {
      label: 'Level',
      value: user?.level || 1,
    },
  ], [completedWorkouts, getUnlockedAchievements, user?.level]);
  
  // Get subscription plan details
  const subscriptionPlan = useMemo(() => {
    if (!user?.subscription) return null;
    return getSubscriptionPlan(user.subscription.tier);
  }, [user?.subscription]);
  
  // Champion Pass progress
  const championPassProgress = useMemo(() => {
    if (!user) return 0;
    return getCurrentTierProgress(user.exp || user.xp || 0);
  }, [user, getCurrentTierProgress]);
  
  const handleTakePhoto = useCallback(async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access camera was denied');
      return;
    }
    
    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      setPhotoUrl(result.assets[0].uri);
    }
  }, []);
  
  const handlePickPhoto = useCallback(async () => {
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access media library was denied');
      return;
    }
    
    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!result.canceled) {
      setPhotoUrl(result.assets[0].uri);
    }
  }, []);
  
  const handleSaveProgress = useCallback(() => {
    // Validate inputs
    if (!weight && !bodyFat && !photoUrl && 
        !Object.values(measurements).some(m => m) && !notes) {
      Alert.alert('Error', 'Please enter at least one measurement or upload a photo');
      return;
    }
    
    // Create progress entry
    const entry = {
      id: Date.now().toString(),
      userId: user?.id || 'current-user',
      date: new Date().toISOString().split('T')[0],
      weight: weight ? parseFloat(weight) : undefined,
      bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
      measurements: {
        chest: measurements.chest ? parseFloat(measurements.chest) : undefined,
        waist: measurements.waist ? parseFloat(measurements.waist) : undefined,
        hips: measurements.hips ? parseFloat(measurements.hips) : undefined,
        arms: measurements.arms ? parseFloat(measurements.arms) : undefined,
        thighs: measurements.thighs ? parseFloat(measurements.thighs) : undefined,
      },
      photos: photoUrl ? [photoUrl] : [],
      notes,
    };
    
    // Add entry to store
    addEntry(entry);
    
    // Show success message and reset form
    Alert.alert('Success', 'Progress saved successfully');
    setShowMeasurementForm(false);
  }, [weight, bodyFat, measurements, photoUrl, notes, user?.id, addEntry]);
  
  const handleUpgrade = useCallback((tier: SubscriptionTier) => {
    upgradeSubscription(tier);
    setShowUpgradeModal(false);
    Alert.alert('Success', `Successfully upgraded to ${tier} tier!`);
  }, [upgradeSubscription]);
  
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  const renderProfileTab = () => (
    <>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileImageContainer}>
          <Image
            source={{ 
              uri: user.profileImage || 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=500'
            }}
            style={styles.profileImage}
          />
          <TouchableOpacity style={styles.cameraButton} onPress={handlePickPhoto}>
            <Camera size={16} color={Colors.text.inverse} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.profileInfo}>
          <View style={styles.profileNameContainer}>
            <Text style={styles.profileName}>{user.name}</Text>
            {subscriptionPlan && (
              <View style={[
                styles.tierBadge,
                { backgroundColor: subscriptionPlan.badge.color }
              ]}>
                <Text style={[
                  styles.tierBadgeText,
                  { color: subscriptionPlan.badge.textColor }
                ]}>
                  {subscriptionPlan.badge.label}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.profileMemberSince}>
            Member since {new Date(user.joinDate || Date.now()).toLocaleDateString()}
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => router.push('/profile/settings')}
        >
          <Settings size={20} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Level Progress with Champion Pass Integration */}
      <Card variant="elevated" style={styles.levelProgressCard}>
        <LevelProgress 
          level={user.level}
          xp={user.xp || user.exp || 0}
          xpForNextLevel={xpForNextLevel}
          nextLevelXp={(user.level || 1) * 1000 + xpForNextLevel}
          style={styles.levelProgressContainer}
        />
        
        <View style={styles.championPassProgress}>
          <View style={styles.championPassHeader}>
            <Award size={16} color={Colors.primary} />
            <Text style={styles.championPassText}>Champion Pass Progress</Text>
          </View>
          <View style={styles.championPassBar}>
            <View 
              style={[
                styles.championPassFill,
                { width: `${championPassProgress * 100}%` }
              ]} 
            />
          </View>
          <Text style={styles.championPassPercentage}>
            {Math.round(championPassProgress * 100)}% Complete
          </Text>
        </View>
      </Card>
      
      {/* Subscription Overview */}
      {user.subscription && (
        <SubscriptionOverviewCard
          subscription={user.subscription}
          onUpgradePress={() => setShowUpgradeModal(true)}
        />
      )}
      
      {/* Stats */}
      <Card variant="elevated" style={styles.statsCard}>
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              
              {index < stats.length - 1 && (
                <View style={styles.statDivider} />
              )}
            </React.Fragment>
          ))}
        </View>
      </Card>
      
      {/* Menu Items */}
      <Card variant="elevated" style={styles.menuCard}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/profile/progress?tab=achievements')}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuItemIcon, { backgroundColor: `${Colors.warning}20` }]}>
              <Award size={20} color={Colors.warning} />
            </View>
            <Text style={styles.menuItemText}>Achievements</Text>
          </View>
          <ChevronRight size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.menuDivider} />
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/champion-pass')}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuItemIcon, { backgroundColor: `${Colors.primary}20` }]}>
              <Crown size={20} color={Colors.primary} />
            </View>
            <Text style={styles.menuItemText}>Champion Pass</Text>
          </View>
          <ChevronRight size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.menuDivider} />
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => setActiveTab('exp')}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuItemIcon, { backgroundColor: `${Colors.success}20` }]}>
              <Activity size={20} color={Colors.success} />
            </View>
            <Text style={styles.menuItemText}>EXP Dashboard</Text>
          </View>
          <ChevronRight size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
        
        <View style={styles.menuDivider} />
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => router.push('/profile/settings')}
        >
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuItemIcon, { backgroundColor: `${Colors.text.secondary}20` }]}>
              <Settings size={20} color={Colors.text.secondary} />
            </View>
            <Text style={styles.menuItemText}>Settings</Text>
          </View>
          <ChevronRight size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
      </Card>
      
      {/* Recent Achievements */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Achievements</Text>
        <TouchableOpacity 
          onPress={() => router.push('/profile/progress?tab=achievements')}
          style={styles.seeAllButton}
        >
          <Text style={styles.seeAllText}>See All</Text>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      
      {recentAchievements.length > 0 ? (
        recentAchievements.map(achievement => (
          <AchievementCard
            key={achievement.id}
            achievement={achievement}
          />
        ))
      ) : (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            You haven't unlocked any achievements yet. Complete workouts and track your nutrition to earn achievements.
          </Text>
        </Card>
      )}
      
      {/* Recent Badges */}
      {recentBadges.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Badges</Text>
            <TouchableOpacity 
              onPress={() => setActiveTab('badges')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <ChevronRight size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          
          <Card variant="elevated" style={styles.badgesCard}>
            <View style={styles.badgesContainer}>
              {recentBadges.map((badge: Badge) => (
                <BadgeItem 
                  key={badge.id} 
                  badge={badge} 
                  size="small"
                  onPress={() => Alert.alert(badge.name, badge.description)}
                />
              ))}
            </View>
          </Card>
        </>
      )}
      
      {/* EXP Summary */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>EXP Summary</Text>
        <TouchableOpacity 
          onPress={() => setActiveTab('exp')}
          style={styles.seeAllButton}
        >
          <Text style={styles.seeAllText}>View Dashboard</Text>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      
      <Card variant="elevated" style={styles.expSummaryCard}>
        <View style={styles.expSummaryHeader}>
          <View style={styles.expSummaryHeaderLeft}>
            <Award size={20} color={Colors.primary} />
            <Text style={styles.expSummaryTitle}>Level {user.level}</Text>
          </View>
          <Text style={styles.expSummaryTotal}>{(user.xp || user.exp || 0).toLocaleString()} XP</Text>
        </View>
        
        <ExpActivityList 
          activities={recentActivities} 
        />
      </Card>
      
      {/* Progress Tracking */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Body Measurements</Text>
        <TouchableOpacity 
          onPress={() => setShowMeasurementForm(!showMeasurementForm)}
          style={styles.seeAllButton}
        >
          <Text style={styles.seeAllText}>
            {showMeasurementForm ? 'Hide' : 'Update'}
          </Text>
          <Edit size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      
      {showMeasurementForm ? (
        <Card variant="elevated" style={styles.measurementsCard}>
          <View style={styles.measurementRow}>
            <Input
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              placeholder="0.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
            
            <Input
              label="Body Fat (%)"
              value={bodyFat}
              onChangeText={setBodyFat}
              placeholder="0.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
          </View>
          
          <Text style={styles.subsectionTitle}>Body Measurements (cm)</Text>
          
          <View style={styles.measurementRow}>
            <Input
              label="Chest"
              value={measurements.chest}
              onChangeText={(value) => setMeasurements({ ...measurements, chest: value })}
              placeholder="0.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
            
            <Input
              label="Waist"
              value={measurements.waist}
              onChangeText={(value) => setMeasurements({ ...measurements, waist: value })}
              placeholder="0.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
          </View>
          
          <View style={styles.measurementRow}>
            <Input
              label="Hips"
              value={measurements.hips}
              onChangeText={(value) => setMeasurements({ ...measurements, hips: value })}
              placeholder="0.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
            
            <Input
              label="Arms"
              value={measurements.arms}
              onChangeText={(value) => setMeasurements({ ...measurements, arms: value })}
              placeholder="0.0"
              keyboardType="decimal-pad"
              containerStyle={styles.halfInput}
            />
          </View>
          
          <Input
            label="Thighs"
            value={measurements.thighs}
            onChangeText={(value) => setMeasurements({ ...measurements, thighs: value })}
            placeholder="0.0"
            keyboardType="decimal-pad"
            containerStyle={styles.halfInput}
          />
          
          <Text style={styles.subsectionTitle}>Progress Photo</Text>
          
          {photoUrl ? (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.photo}
                resizeMode="cover"
              />
              <TouchableOpacity 
                style={styles.changePhotoButton}
                onPress={handlePickPhoto}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Camera size={32} color={Colors.text.tertiary} />
              <Text style={styles.photoPlaceholderText}>
                Add a progress photo
              </Text>
              <View style={styles.photoButtons}>
                {Platform.OS !== 'web' && (
                  <Button
                    title="Take Photo"
                    onPress={handleTakePhoto}
                    variant="outline"
                    style={styles.photoButton}
                  />
                )}
                <Button
                  title="Choose Photo"
                  onPress={handlePickPhoto}
                  variant="outline"
                  style={styles.photoButton}
                />
              </View>
            </View>
          )}
          
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about your progress..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            inputStyle={styles.notesInput}
          />
          
          <Button
            title="Save Progress"
            onPress={handleSaveProgress}
            style={styles.saveButton}
          />
        </Card>
      ) : (
        <Card variant="elevated" style={styles.progressSummaryCard}>
          {getLatestEntry() ? (
            <View style={styles.progressSummary}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Weight</Text>
                <Text style={styles.progressValue}>
                  {getLatestEntry()?.weight ? `${getLatestEntry()?.weight} kg` : 'Not recorded'}
                </Text>
              </View>
              
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Body Fat</Text>
                <Text style={styles.progressValue}>
                  {getLatestEntry()?.bodyFat ? `${getLatestEntry()?.bodyFat}%` : 'Not recorded'}
                </Text>
              </View>
              
              <TouchableOpacity 
                style={styles.viewHistoryButton}
                onPress={() => setActiveTab('progress')}
              >
                <Text style={styles.viewHistoryText}>View History</Text>
                <ChevronRight size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noProgressContainer}>
              <Text style={styles.noProgressText}>
                No measurements recorded yet. Update your progress to track your fitness journey.
              </Text>
              <Button
                title="Record Progress"
                onPress={() => setShowMeasurementForm(true)}
                style={styles.recordButton}
              />
            </View>
          )}
        </Card>
      )}
      
      {/* Logout Button */}
      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert(
            'Logout',
            'Are you sure you want to log out?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                  try {
                    console.log('[Profile] Starting logout process');
                    
                    // Clear auth service token first
                    await authService.logout();
                    
                    // Clear user store and persisted data
                    await logout();
                    
                    console.log('[Profile] Logout completed, navigating to index');
                    
                    // Navigate to index which will handle the redirect to start screen
                    router.replace('/');
                    
                  } catch (e) {
                    console.error('[Profile] Logout error:', e);
                    // Even if there's an error, still navigate to index
                    router.replace('/');
                  }
                },
              },
            ],
          );
        }}
      >
        <LogOut size={20} color={Colors.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </>
  );
  
  const renderProgressTab = () => (
    <>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Progress History</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
      
      {entries.length > 0 ? (
        entries.map((entry, index) => (
          <Card key={entry.id} variant="elevated" style={styles.progressEntryCard}>
            <View style={styles.progressEntryHeader}>
              <Text style={styles.progressEntryDate}>
                {new Date(entry.date).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
              
              {index === 0 && (
                <View style={styles.latestBadge}>
                  <Text style={styles.latestBadgeText}>Latest</Text>
                </View>
              )}
            </View>
            
            <View style={styles.progressEntryContent}>
              <View style={styles.progressEntryMeasurements}>
                {entry.weight && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Weight</Text>
                    <Text style={styles.progressEntryValue}>{entry.weight} kg</Text>
                  </View>
                )}
                
                {entry.bodyFat && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Body Fat</Text>
                    <Text style={styles.progressEntryValue}>{entry.bodyFat}%</Text>
                  </View>
                )}
                
                {entry.measurements?.chest && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Chest</Text>
                    <Text style={styles.progressEntryValue}>{entry.measurements.chest} cm</Text>
                  </View>
                )}
                
                {entry.measurements?.waist && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Waist</Text>
                    <Text style={styles.progressEntryValue}>{entry.measurements.waist} cm</Text>
                  </View>
                )}
                
                {entry.measurements?.hips && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Hips</Text>
                    <Text style={styles.progressEntryValue}>{entry.measurements.hips} cm</Text>
                  </View>
                )}
                
                {entry.measurements?.arms && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Arms</Text>
                    <Text style={styles.progressEntryValue}>{entry.measurements.arms} cm</Text>
                  </View>
                )}
                
                {entry.measurements?.thighs && (
                  <View style={styles.progressEntryItem}>
                    <Text style={styles.progressEntryLabel}>Thighs</Text>
                    <Text style={styles.progressEntryValue}>{entry.measurements.thighs} cm</Text>
                  </View>
                )}
              </View>
              
              {entry.photos && entry.photos.length > 0 && (
                <Image
                  source={{ uri: entry.photos[0] }}
                  style={styles.progressEntryPhoto}
                  resizeMode="cover"
                />
              )}
            </View>
            
            {entry.notes && (
              <View style={styles.progressEntryNotes}>
                <Text style={styles.progressEntryNotesLabel}>Notes:</Text>
                <Text style={styles.progressEntryNotesText}>{entry.notes}</Text>
              </View>
            )}
          </Card>
        ))
      ) : (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No progress entries yet. Start tracking your fitness journey by recording your measurements.
          </Text>
          <Button
            title="Record Progress"
            onPress={() => {
              setActiveTab('profile');
              setShowMeasurementForm(true);
            }}
            style={styles.recordButton}
          />
        </Card>
      )}
    </>
  );
  
  const renderBadgesTab = () => (
    <>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Badges Collection</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
      
      <Card variant="elevated" style={styles.badgesStatsCard}>
        <View style={styles.badgesStats}>
          <View style={styles.badgesStat}>
            <Text style={styles.badgesStatValue}>{getUnlockedBadges().length}</Text>
            <Text style={styles.badgesStatLabel}>Unlocked</Text>
          </View>
          
          <View style={styles.badgesStatDivider} />
          
          <View style={styles.badgesStat}>
            <Text style={styles.badgesStatValue}>{badges.length - getUnlockedBadges().length}</Text>
            <Text style={styles.badgesStatLabel}>Locked</Text>
          </View>
          
          <View style={styles.badgesStatDivider} />
          
          <View style={styles.badgesStat}>
            <Text style={styles.badgesStatValue}>
              {Math.round((getUnlockedBadges().length / badges.length) * 100)}%
            </Text>
            <Text style={styles.badgesStatLabel}>Completed</Text>
          </View>
        </View>
      </Card>
      
      <Text style={styles.badgesCategoryTitle}>Unlocked Badges</Text>
      
      {getUnlockedBadges().length > 0 ? (
        <Card variant="elevated" style={styles.badgesCollectionCard}>
          <View style={styles.badgesGrid}>
            {getUnlockedBadges().map((badge: Badge) => (
              <BadgeItem 
                key={badge.id} 
                badge={badge} 
                onPress={() => Alert.alert(badge.name, badge.description)}
              />
            ))}
          </View>
        </Card>
      ) : (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            You haven't unlocked any badges yet. Complete workouts, maintain streaks, and track your progress to earn badges.
          </Text>
        </Card>
      )}
      
      <Text style={styles.badgesCategoryTitle}>Locked Badges</Text>
      
      {badges.filter((b: Badge) => !b.unlockedAt).length > 0 ? (
        <Card variant="elevated" style={styles.badgesCollectionCard}>
          <View style={styles.badgesGrid}>
            {badges.filter((b: Badge) => !b.unlockedAt).map((badge: Badge) => (
              <BadgeItem 
                key={badge.id} 
                badge={badge} 
                onPress={() => Alert.alert(badge.name, badge.description)}
              />
            ))}
          </View>
        </Card>
      ) : (
        <Card variant="outlined" style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Congratulations! You've unlocked all available badges.
          </Text>
        </Card>
      )}
    </>
  );
  
  const renderExpDashboardTab = () => (
    <>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>EXP Dashboard</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.expHeader}>
        <View style={styles.expHeaderContent}>
          <Award size={28} color={Colors.primary} />
          <View style={styles.expHeaderTextContainer}>
            <Text style={styles.expHeaderTitle}>Level {user.level}</Text>
            <Text style={styles.expHeaderSubtitle}>{(user.xp || user.exp).toLocaleString()} XP Total</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Level Progress</Text>
        <LevelProgress 
          level={user.level} 
          xp={user.xp || user.exp || 0} 
          xpForNextLevel={xpForNextLevel}
          nextLevelXp={(user.level || 1) * 1000 + xpForNextLevel}
          showDetails={true}
          style={styles.compactLevelProgress}
        />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXP Summary</Text>
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{(user.xp || user.exp || 0).toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Total XP</Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{user.level}</Text>
            <Text style={styles.summaryLabel}>Current Level</Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{xpForNextLevel.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>XP to Next Level</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>EXP Breakdown</Text>
        <ExpBreakdownChart breakdown={expBreakdown} />
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activities</Text>
        <ExpActivityList activities={recentActivities} />
      </View>
      
      <TouchableOpacity 
        style={styles.viewFullDashboardButton}
        onPress={() => router.push('/exp-dashboard')}
      >
        <Text style={styles.viewFullDashboardText}>View Full EXP Dashboard</Text>
        <ChevronRight size={16} color={Colors.primary} />
      </TouchableOpacity>
    </>
  );
  
  return (
    <View style={styles.mainContainer}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'profile' && styles.activeTabButton]}
          onPress={() => setActiveTab('profile')}
        >
          <User size={20} color={activeTab === 'profile' ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.tabButtonText, activeTab === 'profile' && styles.activeTabButtonText]}>
            Profile
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'progress' && styles.activeTabButton]}
          onPress={() => setActiveTab('progress')}
        >
          <BarChart size={20} color={activeTab === 'progress' ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.tabButtonText, activeTab === 'progress' && styles.activeTabButtonText]}>
            Progress
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'badges' && styles.activeTabButton]}
          onPress={() => setActiveTab('badges')}
        >
          <Award size={20} color={activeTab === 'badges' ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.tabButtonText, activeTab === 'badges' && styles.activeTabButtonText]}>
            Badges
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'exp' && styles.activeTabButton]}
          onPress={() => setActiveTab('exp')}
        >
          <Activity size={20} color={activeTab === 'exp' ? Colors.primary : Colors.text.secondary} />
          <Text style={[styles.tabButtonText, activeTab === 'exp' && styles.activeTabButtonText]}>
            EXP
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'progress' && renderProgressTab()}
        {activeTab === 'badges' && renderBadgesTab()}
        {activeTab === 'exp' && renderExpDashboardTab()}
      </ScrollView>
      
      {/* Subscription Upgrade Modal */}
      <SubscriptionUpgradeModal
        visible={showUpgradeModal}
        currentTier={user.subscription?.tier || 'free'}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgrade}
      />
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 80, // Extra padding for bottom navigation
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabButtonText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: Colors.primary,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileMemberSince: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  settingsButton: {
    padding: 8,
  },
  levelProgressCard: {
    marginBottom: 16,
  },
  levelProgressContainer: {
    marginBottom: 16,
  },
  championPassProgress: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  championPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  championPassText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  championPassBar: {
    height: 6,
    backgroundColor: `${Colors.primary}20`,
    borderRadius: 3,
    marginBottom: 4,
  },
  championPassFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  championPassPercentage: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
  },
  statsCard: {
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  menuCard: {
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.xlarge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Colors.spacing.md,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 4,
  },
  emptyCard: {
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  recordButton: {
    paddingHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.error,
    marginLeft: 8,
  },
  badgesCard: {
    marginBottom: 24,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: 8,
  },
  measurementsCard: {
    marginBottom: 24,
  },
  measurementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 16,
    marginBottom: 8,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: Colors.radius.medium,
    marginBottom: Colors.spacing.lg,
  },
  changePhotoButton: {
    paddingVertical: Colors.spacing.sm,
    paddingHorizontal: Colors.spacing.lg,
    borderRadius: Colors.radius.medium,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changePhotoText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  photoPlaceholder: {
    height: 200,
    borderRadius: Colors.radius.medium,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Colors.spacing.lg,
  },
  photoPlaceholderText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 8,
    marginBottom: 16,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  photoButton: {
    minWidth: 120,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    width: '100%',
    marginTop: 16,
  },
  progressSummaryCard: {
    marginBottom: 24,
  },
  progressSummary: {
    padding: 8,
  },
  progressItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  viewHistoryText: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 4,
  },
  noProgressContainer: {
    padding: 16,
    alignItems: 'center',
  },
  noProgressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressEntryCard: {
    marginBottom: 16,
  },
  progressEntryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  progressEntryDate: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  latestBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Colors.spacing.sm,
    paddingVertical: Colors.spacing.sm,
    borderRadius: Colors.radius.small,
  },
  latestBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  progressEntryContent: {
    flexDirection: 'row',
  },
  progressEntryMeasurements: {
    flex: 1,
  },
  progressEntryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  progressEntryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  progressEntryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  progressEntryPhoto: {
    width: 100,
    height: 100,
    borderRadius: Colors.radius.medium,
    marginLeft: Colors.spacing.lg,
  },
  progressEntryNotes: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  progressEntryNotesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  progressEntryNotesText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  badgesStatsCard: {
    marginBottom: 16,
  },
  badgesStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgesStat: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
  },
  badgesStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  badgesStatLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  badgesStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  badgesCategoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
    marginTop: 8,
  },
  badgesCollectionCard: {
    marginBottom: 24,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    padding: 8,
  },
  // EXP Dashboard styles
  expHeader: {
    backgroundColor: Colors.card,
    padding: Colors.spacing.lg,
    borderRadius: Colors.radius.medium,
    marginBottom: Colors.spacing.lg,
  },
  expHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expHeaderTextContainer: {
    marginLeft: 12,
  },
  expHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  expHeaderSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: 16,
  },
  compactLevelProgress: {
    height: 'auto',
    maxHeight: 80, // Reduced height
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.md, // Reduced padding
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18, // Reduced font size
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: '100%',
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  viewFullDashboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  viewFullDashboardText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
    marginRight: 4,
  },
  // EXP Summary Card
  expSummaryCard: {
    marginBottom: 24,
  },
  expSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  expSummaryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  expSummaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
});
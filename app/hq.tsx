import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Award, Dumbbell, Coffee, MapPin, ChevronLeft, ChevronRight, Play, Stars } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useWorkoutStore } from '@/store/workoutStore';
import BottomNavigation from '@/components/BottomNavigation';
import MetricCard from '@/components/MetricCard';
import HydrationTracker from '@/components/HydrationTracker';
import { wearableService, type WearableData } from '@/services/wearableService';

interface UserStoreState {
  user: {
    id: string;
    name: string;
    profileImage?: string;
    level?: number;
    exp?: number;
    xp?: number;
    streak?: number;
    streakData?: { currentStreak: number };
  } | null;
  initializeDefaultUser: () => void;
}

interface ExpStoreState {
  expSystem: { totalExp: number } | null;
  getExpToNextLevel: () => number;
  getLevel: () => number;
}

interface Workout {
  id: string;
  name: string;
  description?: string;
  category?: string;
  difficulty?: string;
  duration?: number;
  imageUrl?: string;
}

interface WorkoutStoreState {
  workouts: Workout[];
  initializeDefaultWorkouts: () => void;
}

const { width } = Dimensions.get('window');

export default function HQScreen() {
  const router = useRouter();
  const { user, initializeDefaultUser } = useUserStore() as UserStoreState;
  const { expSystem, getExpToNextLevel, getLevel } = useExpStore() as ExpStoreState;
  const { workouts, initializeDefaultWorkouts } = useWorkoutStore() as WorkoutStoreState;
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState<number>(0);
  const [wearableMetrics, setWearableMetrics] = useState<WearableData | null>(null);
  const [wearableLoading, setWearableLoading] = useState<boolean>(false);
  const [wearableError, setWearableError] = useState<string | null>(null);
  const showWearables = true as const;

  const hasInitializedUser = useRef(false);
  useEffect(() => {
    if (!user && !hasInitializedUser.current) {
      hasInitializedUser.current = true;
      console.log('[HQ] Initializing default user');
      initializeDefaultUser();
    }
  }, [user, initializeDefaultUser]);

  const level = user?.level || getLevel() || 1;
  const xp = user?.exp || user?.xp || expSystem?.totalExp || 0;
  const expToNextLevel = getExpToNextLevel() || 1000;

  const streak = user?.streak || user?.streakData?.currentStreak || 3;

  const hasInitializedWorkouts = useRef(false);
  useEffect(() => {
    if ((!workouts || workouts.length === 0) && !hasInitializedWorkouts.current) {
      hasInitializedWorkouts.current = true;
      console.log('[HQ] Initializing default workouts');
      requestAnimationFrame(() => initializeDefaultWorkouts());
    }
  }, []);

  const recommendedWorkouts = useMemo(() =>
    (workouts && workouts.length > 0) ? workouts.slice(0, 5) : []
  , [workouts]);

  const goToExpDashboard = useCallback(() => {
    router.push('/exp-dashboard');
  }, [router]);

  const handleWorkoutScroll = useCallback((event: any) => {
    const contentOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const cardWidth = width * 0.9 + 16;
    const index = Math.round(contentOffset / cardWidth);
    setCurrentWorkoutIndex(index);
  }, []);

  const navigateWorkout = useCallback((direction: 'prev' | 'next') => {
    const workoutCount = recommendedWorkouts?.length || 0;
    if (workoutCount === 0) return;
    if (direction === 'prev') {
      setCurrentWorkoutIndex((prev) => prev === 0 ? workoutCount - 1 : prev - 1);
    } else {
      setCurrentWorkoutIndex((prev) => (prev + 1) % workoutCount);
    }
  }, [recommendedWorkouts?.length]);

  useEffect(() => {
    let isMounted = true;
    const fetchWearables = async () => {
      try {
        setWearableLoading(true);
        setWearableError(null);
        const perm = await wearableService.requestPermissions();
        console.log('[HQ] Wearable permissions granted?', perm);

        let devices = wearableService.getConnectedDevices();
        console.log('[HQ] Connected devices:', devices.length);

        if (devices.length === 0) {
          const available = await wearableService.getAvailableDevices();
          console.log('[HQ] Available devices:', available.length);
          if (available.length > 0) {
            await wearableService.connectDevice(available[0].id);
            devices = wearableService.getConnectedDevices();
          }
        }

        if (devices.length === 0) {
          console.log('[HQ] No devices connected after attempt');
          if (isMounted) setWearableError('Connect a wearable to see live metrics.');
          return;
        }

        const data = await wearableService.syncData(devices[0].id);
        console.log('[HQ] Wearable data synced:', data);
        if (isMounted) setWearableMetrics(data);
      } catch (e) {
        console.error('[HQ] Wearable fetch error', e);
        if (isMounted) setWearableError('Failed to load wearable metrics.');
      } finally {
        if (isMounted) setWearableLoading(false);
      }
    };

    fetchWearables();
    return () => { isMounted = false; };
  }, []);

  const activityMetrics = useMemo(() => {
    const steps = wearableMetrics?.steps ?? 0;
    const stories = wearableMetrics?.floorsClimbed ?? 0;
    const calories = wearableMetrics?.calories ?? 0;
    const activeMinutes = wearableMetrics?.activeMinutes ?? 0;
    const distance = wearableMetrics?.distance ?? 0;
    return [
      { key: 'steps', title: 'Steps', value: steps, target: 10000, unit: 'steps', icon: 'footprints' as const },
      { key: 'stories', title: 'Stories Climbed', value: stories, target: 20, unit: 'stories', icon: 'stairs' as const },
      { key: 'cal', title: 'Calories', value: calories, target: 2500, unit: 'kcal', icon: 'flame' as const },
      { key: 'act', title: 'Active Minutes', value: activeMinutes, target: 60, unit: 'min', icon: 'activity' as const },
      { key: 'dist', title: 'Distance', value: distance, target: 8, unit: 'km', icon: 'footprints' as const },
    ];
  }, [wearableMetrics?.steps, wearableMetrics?.floorsClimbed, wearableMetrics?.calories, wearableMetrics?.activeMinutes, wearableMetrics?.distance]);

  const vitalsMetrics = useMemo(() => {
    const hr = wearableMetrics?.restingHeartRate ?? wearableMetrics?.heartRate ?? 0;
    const hrv = wearableMetrics?.hrv ?? 0;
    const readiness = wearableMetrics?.readinessScore ?? 0;
    const recovery = wearableMetrics?.recoveryScore ?? 0;
    const stress = wearableMetrics?.stressLevel ?? 0;
    const energy = wearableMetrics?.energyLevel ?? 0;
    const sleepQ = wearableMetrics?.sleepQuality ?? 0;
    return [
      { key: 'hr', title: 'Resting HR', value: hr, target: 120, unit: 'bpm', icon: 'heart' as const },
      { key: 'hrv', title: 'HRV', value: hrv, target: 50, unit: 'ms', icon: 'activity' as const },
      { key: 'ready', title: 'Readiness', value: readiness, target: 100, unit: 'score', icon: 'battery-charging' as const },
      { key: 'rec', title: 'Recovery', value: recovery, target: 100, unit: 'score', icon: 'battery-charging' as const },
      { key: 'stress', title: 'Stress', value: stress, target: 5, unit: '/5', icon: 'flame' as const },
      { key: 'energy', title: 'Energy', value: energy, target: 5, unit: '/5', icon: 'battery-charging' as const },
      { key: 'sleepq', title: 'Sleep Quality', value: sleepQ, target: 5, unit: '/5', icon: 'moon' as const },
    ];
  }, [wearableMetrics?.restingHeartRate, wearableMetrics?.heartRate, wearableMetrics?.hrv, wearableMetrics?.readinessScore, wearableMetrics?.recoveryScore, wearableMetrics?.stressLevel, wearableMetrics?.energyLevel, wearableMetrics?.sleepQuality]);

  const sleepHours = wearableMetrics?.sleepHours ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: 'HQ' }} />

      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="hq-scroll"
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.nameText}>{user?.name || 'Fitness Enthusiast'}</Text>
            </View>

            {user?.profileImage ? (
              <Image
                source={{ uri: user.profileImage }}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileImagePlaceholderText}>
                  {(user?.name || 'FE').charAt(0)}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.levelCard}
            onPress={goToExpDashboard}
            testID="level-card"
          >
            <View style={styles.levelInfo}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelLabel}>Level</Text>
                <Text style={styles.levelValue}>{level}</Text>
              </View>
              <Text style={styles.xpText}>
                {(expToNextLevel || 0).toLocaleString()} XP to level {(level || 1) + 1}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.min(expToNextLevel > 0 ? ((xp || 0) % expToNextLevel) / expToNextLevel * 100 : 0, 100)}%` }
                  ]}
                />
              </View>
            </View>

            <View style={styles.streakContainer}>
              <Text style={styles.streakLabel}>Current Streak</Text>
              <Text style={styles.streakValue}>{streak || 0} days</Text>
              <View style={styles.streakDots}>
                {[...Array(5)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.streakDot,
                      i < (streak || 0) ? styles.streakDotActive : {}
                    ]}
                  />
                ))}
              </View>
            </View>
          </TouchableOpacity>

          {showWearables && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Today’s Progress</Text>
                {wearableLoading && (
                  <ActivityIndicator color={Colors.primary} size="small" />
                )}
              </View>

              {wearableError ? (
                <View style={styles.errorBox} testID="wearable-error">
                  <Text style={styles.errorText}>{wearableError}</Text>
                </View>
              ) : (
                <View style={styles.progressCards} testID="today-progress">
                  <View style={styles.progressCard}>
                    <View style={[styles.progressIconContainer, { backgroundColor: '#10B98120' }]}>
                      <Stars size={24} color="#10B981" />
                    </View>
                    <Text style={styles.progressLabel}>Stories Climbed</Text>
                    <Text style={styles.progressValue}>{(wearableMetrics?.floorsClimbed ?? 0).toLocaleString()}</Text>
                    <Text style={styles.progressTarget}>stories</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(((wearableMetrics?.floorsClimbed ?? 0) / 20) * 100, 100)}%` }]} />
                    </View>
                    <Text style={styles.progressPercentage}>{Math.round(Math.min(((wearableMetrics?.floorsClimbed ?? 0) / 20) * 100, 100))}% of 20</Text>
                  </View>

                  <View style={styles.progressCard}>
                    <View style={[styles.progressIconContainer, { backgroundColor: '#EF444420' }]}>
                      <Dumbbell size={24} color="#EF4444" />
                    </View>
                    <Text style={styles.progressLabel}>Calories</Text>
                    <Text style={styles.progressValue}>{(wearableMetrics?.calories ?? 0).toLocaleString()}</Text>
                    <Text style={styles.progressTarget}>kcal</Text>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressBarFill, { width: `${Math.min(((wearableMetrics?.calories ?? 0) / 2500) * 100, 100)}%` }]} />
                    </View>
                    <Text style={styles.progressPercentage}>{Math.round(Math.min(((wearableMetrics?.calories ?? 0) / 2500) * 100, 100))}% of 2,500</Text>
                  </View>
                </View>
              )}
            </>
          )}

          {showWearables && (
            <View style={styles.metricsSection} testID="activity-metrics">
              <Text style={styles.sectionTitle}>Activity Snapshot</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {activityMetrics.map(m => (
                  <MetricCard key={m.key} title={m.title} value={m.value} target={m.target} unit={m.unit} icon={m.icon} />
                ))}
              </ScrollView>
            </View>
          )}

          {showWearables && (
            <View style={styles.metricsSection} testID="vitals-metrics">
              <Text style={styles.sectionTitle}>Vitals & Readiness</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {vitalsMetrics.map(m => (
                  <MetricCard key={m.key} title={m.title} value={m.value} target={m.target} unit={m.unit} icon={m.icon} />
                ))}
              </ScrollView>
              {sleepHours > 0 && (
                <Text style={styles.helperText} testID="sleep-hours">Last night: {sleepHours} hrs</Text>
              )}
            </View>
          )}

          <View style={styles.metricsSection} testID="hydration-section">
            <Text style={styles.sectionTitle}>Hydration</Text>
            <HydrationTracker />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended Workouts</Text>
            <View style={styles.carouselControls}>
              <TouchableOpacity
                style={styles.carouselButton}
                onPress={() => navigateWorkout('prev')}
                testID="carousel-prev"
              >
                <ChevronLeft size={20} color={Colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.carouselButton}
                onPress={() => navigateWorkout('next')}
                testID="carousel-next"
              >
                <ChevronRight size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.workoutCarouselContainer}>
            {recommendedWorkouts && recommendedWorkouts.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  snapToInterval={width * 0.9 + 16}
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.workoutCarouselContent}
                  onMomentumScrollEnd={handleWorkoutScroll}
                  testID="workout-carousel"
                >
                  {recommendedWorkouts.map((workout: Workout) => (
                    <TouchableOpacity
                      key={workout?.id || Math.random().toString()}
                      style={styles.workoutCard}
                      onPress={() => workout?.id && router.push(`/workout/${workout.id}`)}
                    >
                      <Image
                        source={{ uri: workout?.imageUrl || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500' }}
                        style={styles.workoutImage}
                      />
                      <View style={styles.workoutContent}>
                        <View style={styles.workoutHeader}>
                          <Text style={styles.workoutCategory}>{workout?.category || 'Workout'}</Text>
                          <Text style={styles.workoutDifficulty}>{workout?.difficulty || 'Beginner'}</Text>
                        </View>
                        <Text style={styles.workoutTitle}>{workout?.name || 'Workout'}</Text>
                        <Text style={styles.workoutDescription}>
                          {workout?.description || 'No description available'}
                        </Text>
                        <View style={styles.workoutMeta}>
                          <Text style={styles.workoutDuration}>{workout?.duration || 30} min</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.startButton}
                          onPress={() => workout?.id && router.push(`/workout/${workout.id}`)}
                          testID="start-workout"
                        >
                          <Text style={styles.startButtonText}>Start Workout</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.indicatorsContainer}>
                  {recommendedWorkouts && recommendedWorkouts.map((_: Workout, index: number) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.indicator,
                        currentWorkoutIndex === index && styles.activeIndicator
                      ]}
                      onPress={() => setCurrentWorkoutIndex(index)}
                      testID={`indicator-${index}`}
                    />
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.emptyWorkoutsContainer}>
                <Text style={styles.emptyWorkoutsText}>
                  No recommended workouts available. Check back later!
                </Text>
              </View>
            )}
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/workouts')}
              testID="qa-workouts"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#6366F120' }]}>
                <Dumbbell size={24} color="#6366F1" />
              </View>
              <Text style={styles.quickActionText}>Workouts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/nutrition')}
              testID="qa-nutrition"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#10B98120' }]}>
                <Coffee size={24} color="#10B981" />
              </View>
              <Text style={styles.quickActionText}>Nutrition</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/shop')}
              testID="qa-shop"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#8B5CF620' }]}>
                <MapPin size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.quickActionText}>Shop</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={goToExpDashboard}
              testID="qa-exp"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#F59E0B20' }]}>
                <Award size={24} color="#F59E0B" />
              </View>
              <Text style={styles.quickActionText}>EXP</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/workout/active?mode=run')}
              testID="qa-run"
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#00ff8820' }]}>
                <Play size={24} color="#00ff88" />
              </View>
              <Text style={styles.quickActionText}>Start Run</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <BottomNavigation />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImagePlaceholderText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
  levelCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    padding: Colors.spacing.lg,
    marginBottom: Colors.spacing.xxl,
    ...Colors.shadow.medium,
    minHeight: 80,
    alignItems: 'center',
  },
  levelInfo: {
    flex: 1,
    marginRight: 16,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginRight: 8,
  },
  levelValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  xpText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.inactive,
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  streakContainer: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: '35%',
  },
  streakLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  streakValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  streakDots: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inactive,
    marginHorizontal: 2,
  },
  streakDotActive: {
    backgroundColor: Colors.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  progressCard: {
    width: '48%',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    padding: Colors.spacing.lg,
    ...Colors.shadow.medium,
  },
  progressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  progressTarget: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  progressPercentage: {
    fontSize: 12,
    color: Colors.text.tertiary,
    textAlign: 'right',
  },
  workoutCarouselContainer: {
    marginBottom: Colors.spacing.xxl,
  },
  workoutCarouselContent: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  workoutCard: {
    width: width * 0.9,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    overflow: 'hidden',
    marginRight: 16,
    ...Colors.shadow.medium,
  },
  workoutImage: {
    width: '100%',
    height: 160,
  },
  workoutContent: {
    padding: 16,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutCategory: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  workoutDifficulty: {
    fontSize: 12,
    color: Colors.text.secondary,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  workoutMeta: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  workoutDuration: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginRight: 16,
  },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: Colors.radius.medium,
    paddingVertical: Colors.spacing.md,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.inverse,
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
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickAction: {
    alignItems: 'center',
    width: '22%',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  emptyWorkoutsContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    ...Colors.shadow.medium,
  },
  emptyWorkoutsText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  metricsSection: {
    marginBottom: 16,
  },
  horizontalList: {
    paddingRight: 8,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ef444410',
    borderWidth: 1,
    borderColor: '#ef4444',
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
  },
});
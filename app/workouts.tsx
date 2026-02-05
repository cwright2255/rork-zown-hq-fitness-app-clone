import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { Search, Bell, ChevronRight, Play, MapPin, Clock, Target, Trophy, Users, Zap, Calendar, Settings, Dumbbell, Activity, Award, Music } from 'lucide-react-native';
import Colors from '@/constants/colors';
import BottomNavigation from '@/components/BottomNavigation';
import RunningProgramCard from '@/components/RunningProgramCard';
import WorkoutCard from '@/components/WorkoutCard';
import SpotifyMusicPlayer from '@/components/SpotifyMusicPlayer';
import WorkoutCalendar from '@/components/WorkoutCalendar';
import ProductivityTracker from '@/components/ProductivityTracker';
import EventCreationModal from '@/components/EventCreationModal';
import GoalSettingModal from '@/components/GoalSettingModal';
import ScheduleModal from '@/components/ScheduleModal';
import TimerModal from '@/components/TimerModal';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useCommunityStore } from '@/store/communityStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import Button from '@/components/Button';
import Card from '@/components/Card';
import Badge from '@/components/Badge';

const { width } = Dimensions.get('window');

export default function WorkoutsScreen() {
  const [activeTab, setActiveTab] = useState('workouts');
  const [currentFollowAlongIndex, setCurrentFollowAlongIndex] = useState(0);
  const [currentYoutubeIndex, setCurrentYoutubeIndex] = useState(0);
  const [currentRunningProgramIndex, setCurrentRunningProgramIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isWorkingOut, setIsWorkingOut] = useState(false);
  const [showMusicSection, setShowMusicSection] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [calendarView, setCalendarView] = useState<'calendar' | 'productivity'>('calendar');
  const [runningStats, setRunningStats] = useState({
    distance: 0,
    time: 0,
    pace: 0,
    calories: 0
  });
  
  const followAlongScrollRef = useRef<ScrollView>(null);
  const youtubeScrollRef = useRef<ScrollView>(null);
  const runningProgramScrollRef = useRef<ScrollView>(null);
  
  const { 
    workouts, 
    customWorkouts, 
    completedWorkouts, 
    initializeDefaultWorkouts,
    runningPrograms,
    activeProgram,
    runHistory,
    currentRun,
    runningChallenges,
    virtualRaces,
    runningBuddy,
    initializeRunningPrograms,
    startProgram,
    startRun,
    finishRun,
    joinChallenge,
    registerForRace,
    getRunningStats,
    getPersonalBests
  } = useWorkoutStore();
  
  const { user, updateUserRunningProfile } = useUserStore();
  const { expSystem } = useExpStore();
  const { runningChallenges: communityRunningChallenges, initializeRunningChallenges } = useCommunityStore();
  const { isConnected: isSpotifyConnected, workoutPlaylists } = useSpotifyStore();
  
  // Memoize static data
  const tabs = useMemo(() => [
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'running', label: 'Running', icon: Activity },
    { id: 'programs', label: 'Calendar', icon: Calendar },
    { id: 'challenges', label: 'Challenges', icon: Award },
  ], []);
  
  const mockFollowAlongWorkouts = useMemo(() => [
    {
      id: 'follow-1',
      title: 'Do This Plank Routine Every Morning',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      duration: '10 min',
      isPro: true,
      muscleGroups: ['abs', 'core'],
    },
    {
      id: 'follow-2',
      title: 'Full Body HIIT Workout',
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
      duration: '20 min',
      isPro: false,
      muscleGroups: ['full body'],
    }
  ], []);
  
  const mockYoutubeWorkouts = useMemo(() => [
    {
      id: 'youtube-1',
      title: 'DO THIS Workout For BIGGER BICEPS & TRICEPS',
      image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800',
      duration: '7 min',
      muscleGroups: ['biceps', 'triceps'],
      equipment: ['dumbbells'],
    },
    {
      id: 'youtube-2',
      title: '10 Minute Ab Workout - No Equipment',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
      duration: '10 min',
      muscleGroups: ['abs'],
      equipment: [],
    }
  ], []);
  
  // Mock data for programs tab
  const mockWorkoutPrograms = useMemo(() => [
    {
      id: 'program-1',
      name: 'Strength Builder',
      description: 'Build muscle and strength with progressive overload',
      duration: 12,
      workoutsPerWeek: 4,
      difficulty: 'intermediate' as const,
      progress: 65,
      isPremium: false,
      imageUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&h=300&fit=crop',
    },
    {
      id: 'program-2',
      name: 'Fat Loss Accelerator',
      description: 'High-intensity workouts for rapid fat loss',
      duration: 8,
      workoutsPerWeek: 5,
      difficulty: 'advanced' as const,
      progress: 30,
      isPremium: true,
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    },
    {
      id: 'program-3',
      name: 'Beginner Basics',
      description: 'Perfect introduction to fitness and exercise',
      duration: 6,
      workoutsPerWeek: 3,
      difficulty: 'beginner' as const,
      progress: 0,
      isPremium: false,
      imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=300&fit=crop',
    }
  ], []);
  
  const mockSpecializedPrograms = useMemo(() => [
    {
      id: 'spec-1',
      name: 'Yoga Flow',
      duration: '4 weeks',
      participants: 1250,
      isJoined: false,
      icon: '🧘‍♀️',
      color: '#E8F5E8',
    },
    {
      id: 'spec-2',
      name: 'HIIT Blast',
      duration: '6 weeks',
      participants: 890,
      isJoined: true,
      icon: '🔥',
      color: '#FFE8E8',
    },
    {
      id: 'spec-3',
      name: 'Pilates Core',
      duration: '8 weeks',
      participants: 650,
      isJoined: false,
      icon: '💪',
      color: '#E8F0FF',
    },
    {
      id: 'spec-4',
      name: 'Flexibility',
      duration: '4 weeks',
      participants: 420,
      isJoined: false,
      icon: '🤸‍♀️',
      color: '#FFF0E8',
    }
  ], []);
  
  const mockProgramCategories = useMemo(() => [
    {
      id: 'cat-1',
      name: 'Strength',
      programCount: 12,
      icon: '💪',
      color: '#E8F0FF',
    },
    {
      id: 'cat-2',
      name: 'Cardio',
      programCount: 8,
      icon: '❤️',
      color: '#FFE8E8',
    },
    {
      id: 'cat-3',
      name: 'Flexibility',
      programCount: 6,
      icon: '🤸‍♀️',
      color: '#FFF0E8',
    },
    {
      id: 'cat-4',
      name: 'Wellness',
      programCount: 4,
      icon: '🧘‍♀️',
      color: '#E8F5E8',
    }
  ], []);
  
  // Optimized initialization - run only once
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    requestAnimationFrame(() => {
      if (!workouts || workouts.length === 0) initializeDefaultWorkouts();
      if (!runningPrograms || runningPrograms.length === 0) initializeRunningPrograms();
      if (!communityRunningChallenges || communityRunningChallenges.length === 0) initializeRunningChallenges();
    });
  }, []);
  
  // Memoize workout data
  const followAlongWorkouts = useMemo(() => {
    if (workouts && workouts.length > 0) {
      return workouts.slice(0, 2).map(workout => ({
        id: workout.id,
        title: workout.name,
        image: workout.imageUrl || 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800',
        duration: `${workout.duration} min`,
        isPro: Math.random() > 0.7,
        muscleGroups: workout.muscleGroups || ['full body'],
      }));
    }
    return mockFollowAlongWorkouts;
  }, [workouts, mockFollowAlongWorkouts]);
  
  const youtubeWorkouts = useMemo(() => {
    if (customWorkouts && customWorkouts.length > 0) {
      return customWorkouts.slice(0, 2).map(workout => ({
        id: workout.id,
        title: workout.name,
        image: workout.imageUrl || 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800',
        duration: `${workout.duration} min`,
        muscleGroups: workout.muscleGroups || ['full body'],
        equipment: workout.equipment || ['dumbbells', 'mat'],
      }));
    }
    return mockYoutubeWorkouts;
  }, [customWorkouts, mockYoutubeWorkouts]);
  
  // Get running stats
  const userRunningStats = useMemo(() => {
    return getRunningStats ? getRunningStats() : {
      totalDistance: 0,
      totalRuns: 0,
      averagePace: 0,
      totalTime: 0
    };
  }, [getRunningStats, runHistory]);
  
  const personalBests = useMemo(() => {
    return getPersonalBests ? getPersonalBests() : {};
  }, [getPersonalBests, runHistory]);
  
  // Get user's running progress for programs
  const getUserRunningProgress = useCallback((programId: string) => {
    if (user?.runningProfile?.programProgress?.programId === programId) {
      return {
        currentWeek: user.runningProfile.programProgress.currentWeek,
        completedSessions: user.runningProfile.programProgress.completedSessions,
        totalSessions: user.runningProfile.programProgress.totalSessions,
      };
    }
    return undefined;
  }, [user?.runningProfile?.programProgress]);
  
  // Memoized components
  const renderMuscleGroupIcons = useCallback((muscleGroups: string[]) => {
    return (
      <View style={styles.muscleGroupIcons}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=100' }} 
          style={styles.muscleIcon}
          resizeMode="contain"
        />
      </View>
    );
  }, []);
  
  const renderEquipmentIcons = useCallback((equipment: string[] | undefined) => {
    if (!equipment || equipment.length === 0) return null;
    
    return (
      <View style={styles.equipmentIcon}>
        <Image 
          source={{ uri: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=100' }} 
          style={styles.equipmentIconImage}
          resizeMode="contain"
        />
      </View>
    );
  }, []);

  // Optimized scroll handlers
  const handleFollowAlongScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.85));
    setCurrentFollowAlongIndex(index);
  }, []);

  const handleYoutubeScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.85));
    setCurrentYoutubeIndex(index);
  }, []);

  const handleRunningProgramScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / (width * 0.85));
    setCurrentRunningProgramIndex(index);
  }, []);

  const scrollToFollowAlongIndex = useCallback((index: number) => {
    followAlongScrollRef.current?.scrollTo({
      x: index * (width * 0.85),
      animated: true
    });
    setCurrentFollowAlongIndex(index);
  }, []);

  const scrollToYoutubeIndex = useCallback((index: number) => {
    youtubeScrollRef.current?.scrollTo({
      x: index * (width * 0.85),
      animated: true
    });
    setCurrentYoutubeIndex(index);
  }, []);

  const scrollToRunningProgramIndex = useCallback((index: number) => {
    runningProgramScrollRef.current?.scrollTo({
      x: index * (width * 0.85),
      animated: true
    });
    setCurrentRunningProgramIndex(index);
  }, []);
  
  // Navigation handlers
  const handleWorkoutPress = useCallback((workoutId: string) => {
    router.push(`/workout/${workoutId}`);
  }, []);
  
  const handleRunningProgramPress = useCallback((programId: string) => {
    router.push(`/running/program/${programId}`);
  }, []);
  
  const handleViewAllSavedPress = useCallback(() => {
    console.log('Navigate to saved workouts');
    // router.push('/workout/saved'); // Commented out as this route doesn't exist yet
  }, []);

  const handleStartRun = useCallback(() => {
    if (isRunning) {
      // Finish current run
      finishRun();
      setIsRunning(false);
      setRunningStats({ distance: 0, time: 0, pace: 0, calories: 0 });
    } else {
      // Start new run
      startRun();
      setIsRunning(true);
      router.push('/workout/active?mode=run');
    }
  }, [isRunning, startRun, finishRun]);

  const handleStartWorkout = useCallback(() => {
    if (isWorkingOut) {
      // Finish current workout
      setIsWorkingOut(false);
    } else {
      // Start new workout
      setIsWorkingOut(true);
      // In a real app, this would navigate to a workout tracking screen or start a timer
      router.push('/workout/active?mode=workout');
    }
  }, [isWorkingOut]);

  const handleStartProgram = useCallback((programId: string) => {
    startProgram(programId);
  }, [startProgram]);

  const handleJoinChallenge = useCallback((challengeId: string) => {
    joinChallenge(challengeId);
  }, [joinChallenge]);

  const handleRegisterForRace = useCallback((raceId: string) => {
    registerForRace(raceId);
  }, [registerForRace]);

  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  const formatPace = useCallback((pace: number): string => {
    if (pace === 0) return '0:00/km';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }, []);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading workouts...</Text>
      </View>
    );
  }

  const renderRunningTab = useCallback(() => (
    <>
      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Button
          title={isRunning ? 'Finish Run' : 'Quick Run'}
          onPress={handleStartRun}
          variant="primary"
          style={styles.quickActionButton}
        />
      </View>

      {/* Current Run Stats */}
      {isRunning && (
        <Card style={styles.currentRunCard}>
          <Text style={styles.currentRunTitle}>Current Run</Text>
          <View style={styles.currentRunStats}>
            <View style={styles.currentRunStat}>
              <Text style={styles.currentRunStatValue}>{runningStats.distance.toFixed(2)}</Text>
              <Text style={styles.currentRunStatLabel}>km</Text>
            </View>
            <View style={styles.currentRunStat}>
              <Text style={styles.currentRunStatValue}>{formatTime(runningStats.time)}</Text>
              <Text style={styles.currentRunStatLabel}>time</Text>
            </View>
            <View style={styles.currentRunStat}>
              <Text style={styles.currentRunStatValue}>{formatPace(runningStats.pace)}</Text>
              <Text style={styles.currentRunStatLabel}>pace</Text>
            </View>
            <View style={styles.currentRunStat}>
              <Text style={styles.currentRunStatValue}>{Math.round(runningStats.calories)}</Text>
              <Text style={styles.currentRunStatLabel}>cal</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Spotify Music Player for Running */}
      {isSpotifyConnected && (
        <SpotifyMusicPlayer 
          workoutType="running"
          style={styles.musicPlayerCard}
        />
      )}

      {/* Running Programs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Running Programs</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.carouselContainer}>
        <ScrollView 
          ref={runningProgramScrollRef}
          horizontal 
          pagingEnabled
          snapToInterval={width * 0.85 + 16}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workoutsContainer}
          onMomentumScrollEnd={handleRunningProgramScroll}
          removeClippedSubviews={true}
        >
          {runningPrograms.map(program => (
            <View key={program.id} style={styles.runningProgramCardContainer}>
              <RunningProgramCard
                program={program}
                onPress={() => handleRunningProgramPress(program.id)}
                userProgress={getUserRunningProgress(program.id)}
              />
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.indicatorsContainer}>
          {runningPrograms.map((_, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.indicator, 
                currentRunningProgramIndex === index && styles.activeIndicator
              ]}
              onPress={() => scrollToRunningProgramIndex(index)}
            />
          ))}
        </View>
      </View>

      {/* My Running Stats */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Running Stats</Text>
        <TouchableOpacity>
          <Settings size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.runningStatsGrid}>
        <Card style={styles.runningStatCard}>
          <Text style={styles.runningStatValue}>{userRunningStats.totalDistance.toFixed(1)}</Text>
          <Text style={styles.runningStatLabel}>Total Distance (km)</Text>
        </Card>
        <Card style={styles.runningStatCard}>
          <Text style={styles.runningStatValue}>{userRunningStats.totalRuns}</Text>
          <Text style={styles.runningStatLabel}>Total Runs</Text>
        </Card>
        <Card style={styles.runningStatCard}>
          <Text style={styles.runningStatValue}>{formatPace(userRunningStats.averagePace)}</Text>
          <Text style={styles.runningStatLabel}>Avg Pace</Text>
        </Card>
        <Card style={styles.runningStatCard}>
          <Text style={styles.runningStatValue}>{Math.floor(userRunningStats.totalTime / 60)}h</Text>
          <Text style={styles.runningStatLabel}>Total Time</Text>
        </Card>
      </View>

      {/* Personal Bests */}
      {(personalBests.fastest5K || personalBests.fastest10K || personalBests.longestRun) && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Bests</Text>
          </View>
          
          <View style={styles.personalBestsContainer}>
            {personalBests.fastest5K && (
              <Card style={styles.personalBestCard}>
                <Trophy size={20} color={Colors.warning} />
                <Text style={styles.personalBestLabel}>Fastest 5K</Text>
                <Text style={styles.personalBestValue}>{formatTime(personalBests.fastest5K)}</Text>
              </Card>
            )}
            {personalBests.fastest10K && (
              <Card style={styles.personalBestCard}>
                <Trophy size={20} color={Colors.warning} />
                <Text style={styles.personalBestLabel}>Fastest 10K</Text>
                <Text style={styles.personalBestValue}>{formatTime(personalBests.fastest10K)}</Text>
              </Card>
            )}
            {personalBests.longestRun && (
              <Card style={styles.personalBestCard}>
                <Target size={20} color={Colors.running.distance} />
                <Text style={styles.personalBestLabel}>Longest Run</Text>
                <Text style={styles.personalBestValue}>{personalBests.longestRun.toFixed(1)} km</Text>
              </Card>
            )}
          </View>
        </>
      )}

      {/* Virtual Running Buddy */}
      {runningBuddy && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Running Buddy</Text>
          </View>
          
          <Card style={styles.runningBuddyCard}>
            <Image source={{ uri: runningBuddy.avatar }} style={styles.buddyAvatar} />
            <View style={styles.buddyInfo}>
              <Text style={styles.buddyName}>{runningBuddy.name}</Text>
              <Text style={styles.buddyLevel}>Level {runningBuddy.level}</Text>
              <Text style={styles.buddyStats}>
                {runningBuddy.totalDistance}km • {formatPace(runningBuddy.pace)} pace
              </Text>
            </View>
            <View style={styles.buddyStatus}>
              <View style={[styles.buddyStatusDot, { backgroundColor: runningBuddy.isActive ? Colors.success : Colors.inactive }]} />
              <Text style={styles.buddyStatusText}>{runningBuddy.isActive ? 'Active' : 'Offline'}</Text>
            </View>
          </Card>
        </>
      )}

      {/* Running Challenges */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Running Challenges</Text>
        <TouchableOpacity onPress={() => router.push('/community')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengesContainer} removeClippedSubviews={true}>
        {runningChallenges.slice(0, 3).map(challenge => (
          <Card key={challenge.id} style={styles.challengeCard}>
            <Text style={styles.challengeTitle} numberOfLines={2}>{challenge.name}</Text>
            <Text style={styles.challengeDescription} numberOfLines={3}>{challenge.description}</Text>
            <View style={styles.challengeStats}>
              <Text style={styles.challengeParticipants}>{challenge.participants} participants</Text>
              <Text style={styles.challengeReward}>+{challenge.reward.xp} XP</Text>
            </View>
            <Button 
              title={challenge.isJoined ? 'Joined' : 'Join Challenge'}
              onPress={() => handleJoinChallenge(challenge.id)}
              variant={challenge.isJoined ? 'outline' : 'primary'}
              style={styles.challengeButton}
              disabled={challenge.isJoined}
            />
          </Card>
        ))}
      </ScrollView>

      {/* Virtual Races */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Virtual Races</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengesContainer} removeClippedSubviews={true}>
        {virtualRaces.slice(0, 2).map(race => (
          <Card key={race.id} style={styles.raceCard}>
            <Text style={styles.raceTitle} numberOfLines={2}>{race.name}</Text>
            <Text style={styles.raceDescription} numberOfLines={3}>{race.description}</Text>
            <View style={styles.raceStats}>
              <Text style={styles.raceDistance}>{race.distance}km</Text>
              <Text style={styles.raceParticipants}>{race.participants} registered</Text>
            </View>
            <View style={styles.raceRewards}>
              <Text style={styles.raceRewardText}>Winner: +{race.rewards.winner.xp} XP</Text>
              {race.rewards.winner.prize && (
                <Text style={styles.racePrize}>{race.rewards.winner.prize}</Text>
              )}
            </View>
            <Button 
              title={race.isRegistered ? 'Registered' : 'Register'}
              onPress={() => handleRegisterForRace(race.id)}
              variant={race.isRegistered ? 'outline' : 'primary'}
              style={styles.raceButton}
              disabled={race.isRegistered}
            />
          </Card>
        ))}
      </ScrollView>
    </>
  ), [
    isRunning,
    runningStats,
    runningPrograms,
    currentRunningProgramIndex,
    userRunningStats,
    personalBests,
    runningBuddy,
    runningChallenges,
    virtualRaces,
    isSpotifyConnected,
    formatTime,
    formatPace
  ]);
  
  const renderWorkoutsTab = useCallback(() => (
    <>
      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Button
          title={isWorkingOut ? 'Finish Workout' : 'Quick Workout'}
          onPress={handleStartWorkout}
          variant="primary"
          style={styles.quickActionButton}
        />
      </View>

      {/* Spotify Music Player for Workouts */}
      {showMusicSection && isSpotifyConnected ? (
        <SpotifyMusicPlayer 
          workoutType="cardio"
          style={styles.musicPlayerCard}
        />
      ) : showMusicSection && !isSpotifyConnected ? (
        <Card style={styles.musicPlayerCard}>
          <Text style={styles.noSpotifyConnectionText}>
            Spotify is not connected. Go to Settings to connect your account.
          </Text>
        </Card>
      ) : null}

      {/* Spotify Workout Playlists */}
      {isSpotifyConnected && workoutPlaylists.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Workout Playlists</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlistsContainer} removeClippedSubviews={true}>
            {workoutPlaylists.slice(0, 3).map(playlist => (
              <Card key={playlist.id} style={styles.playlistCard}>
                {playlist.images[0] && (
                  <Image 
                    source={{ uri: playlist.images[0].url }}
                    style={styles.playlistImage}
                  />
                )}
                <Text style={styles.playlistName} numberOfLines={2}>{playlist.name}</Text>
                <Text style={styles.playlistTracks}>{playlist.tracks.total} tracks</Text>
              </Card>
            ))}
          </ScrollView>
        </>
      )}
      
      {/* Featured Workouts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Featured Workouts</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.carouselContainer}>
        <ScrollView 
          horizontal 
          pagingEnabled
          snapToInterval={width * 0.85 + 16}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workoutsContainer}
          removeClippedSubviews={true}
        >
          {workouts.slice(0, 3).map(workout => (
            <View key={workout.id} style={styles.workoutCardContainer}>
              <WorkoutCard
                workout={workout}
                onPress={() => handleWorkoutPress(workout.id)}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      
      {/* Follow Along Workouts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Follow Along Workouts</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      {/* Carousel for Follow Along Workouts */}
      <View style={styles.carouselContainer}>
        <ScrollView 
          ref={followAlongScrollRef}
          horizontal 
          pagingEnabled
          snapToInterval={width * 0.85 + 16}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workoutsContainer}
          onMomentumScrollEnd={handleFollowAlongScroll}
          removeClippedSubviews={true}
        >
          {followAlongWorkouts.map(workout => {
            // Convert to Workout format
            const workoutData = {
              id: workout.id,
              name: workout.title,
              description: `Follow along workout targeting ${workout.muscleGroups.join(', ')}`,
              difficulty: 'intermediate' as const,
              duration: parseInt(workout.duration.replace(' min', '')),
              category: 'Follow Along',
              xpReward: 25,
              imageUrl: workout.image,
              exercises: [],
              equipment: [],
              muscleGroups: workout.muscleGroups,
              calories: 150,
              isCustom: false
            };
            
            return (
              <View key={workout.id} style={styles.workoutCardContainer}>
                <WorkoutCard
                  workout={workoutData}
                  onPress={() => handleWorkoutPress(workout.id)}
                />
              </View>
            );
          })}
        </ScrollView>
        
        {/* Carousel Indicators */}
        <View style={styles.indicatorsContainer}>
          {followAlongWorkouts.map((_, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.indicator, 
                currentFollowAlongIndex === index && styles.activeIndicator
              ]}
              onPress={() => scrollToFollowAlongIndex(index)}
            />
          ))}
        </View>
      </View>
      
      {/* YouTube Workouts */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Youtube Workouts</Text>
        <TouchableOpacity>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      {/* Carousel for YouTube Workouts */}
      <View style={styles.carouselContainer}>
        <ScrollView 
          ref={youtubeScrollRef}
          horizontal 
          pagingEnabled
          snapToInterval={width * 0.85 + 16}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workoutsContainer}
          onMomentumScrollEnd={handleYoutubeScroll}
          removeClippedSubviews={true}
        >
          {youtubeWorkouts.map(workout => {
            // Convert to Workout format
            const workoutData = {
              id: workout.id,
              name: workout.title,
              description: `YouTube workout targeting ${workout.muscleGroups.join(', ')}`,
              difficulty: 'beginner' as const,
              duration: parseInt(workout.duration.replace(' min', '')),
              category: 'YouTube',
              xpReward: 30,
              imageUrl: workout.image,
              exercises: [],
              equipment: workout.equipment || [],
              muscleGroups: workout.muscleGroups,
              calories: 120,
              isCustom: false
            };
            
            return (
              <View key={workout.id} style={styles.workoutCardContainer}>
                <WorkoutCard
                  workout={workoutData}
                  onPress={() => handleWorkoutPress(workout.id)}
                />
              </View>
            );
          })}
        </ScrollView>
        
        {/* Carousel Indicators */}
        <View style={styles.indicatorsContainer}>
          {youtubeWorkouts.map((_, index) => (
            <TouchableOpacity 
              key={index} 
              style={[
                styles.indicator, 
                currentYoutubeIndex === index && styles.activeIndicator
              ]}
              onPress={() => scrollToYoutubeIndex(index)}
            />
          ))}
        </View>
      </View>
      
      {/* View All Saved Workouts Button */}
      <Button 
        title="View All Saved Workouts"
        onPress={handleViewAllSavedPress}
        variant="outline"
        style={styles.viewAllSavedButton}
      />
    </>
  ), [
    followAlongWorkouts,
    youtubeWorkouts,
    currentFollowAlongIndex,
    currentYoutubeIndex,
    isWorkingOut,
    showMusicSection,
    isSpotifyConnected,
    workoutPlaylists,
    workouts
  ]);



  const renderProgramsTab = useCallback(() => {
    return (
      <>
        {/* Calendar/Productivity Toggle */}
        <View style={styles.calendarToggleContainer}>
          <TouchableOpacity
            style={[
              styles.calendarToggleButton,
              calendarView === 'calendar' && styles.calendarToggleButtonActive
            ]}
            onPress={() => setCalendarView('calendar')}
          >
            <Calendar size={20} color={calendarView === 'calendar' ? Colors.text.inverse : Colors.text.secondary} />
            <Text style={[
              styles.calendarToggleText,
              calendarView === 'calendar' && styles.calendarToggleTextActive
            ]}>
              Calendar
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.calendarToggleButton,
              calendarView === 'productivity' && styles.calendarToggleButtonActive
            ]}
            onPress={() => setCalendarView('productivity')}
          >
            <Target size={20} color={calendarView === 'productivity' ? Colors.text.inverse : Colors.text.secondary} />
            <Text style={[
              styles.calendarToggleText,
              calendarView === 'productivity' && styles.calendarToggleTextActive
            ]}>
              Productivity
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar or Productivity View */}
        {calendarView === 'calendar' ? (
          <WorkoutCalendar
            onDateSelect={(date) => setSelectedCalendarDate(date)}
            onEventPress={(event) => console.log('Event pressed:', event)}
            onAddEvent={(date) => {
              setSelectedCalendarDate(date);
              setShowEventModal(true);
            }}
          />
        ) : (
          <ProductivityTracker
            onMetricPress={(metric) => console.log('Metric pressed:', metric)}
            onHabitToggle={(habitId) => console.log('Habit toggled:', habitId)}
            onSetGoal={() => setShowGoalModal(true)}
            onSchedule={() => setShowScheduleModal(true)}
            onTimer={() => setShowTimerModal(true)}
          />
        )}

        {/* Event Creation Modal */}
        {showEventModal && selectedCalendarDate && (
          <EventCreationModal
            visible={showEventModal}
            selectedDate={selectedCalendarDate}
            onClose={() => setShowEventModal(false)}
            onSave={(event) => {
              console.log('Saving event:', event);
              setShowEventModal(false);
            }}
          />
        )}

        {/* Goal Setting Modal */}
        <GoalSettingModal
          visible={showGoalModal}
          onClose={() => setShowGoalModal(false)}
          onSave={(goal) => {
            console.log('Saving goal:', goal);
            setShowGoalModal(false);
          }}
        />

        {/* Schedule Modal */}
        <ScheduleModal
          visible={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSave={(schedule) => {
            console.log('Saving schedule:', schedule);
            setShowScheduleModal(false);
          }}
        />

        {/* Timer Modal */}
        <TimerModal
          visible={showTimerModal}
          onClose={() => setShowTimerModal(false)}
        />
      </>
    );
  }, [
    calendarView,
    showEventModal,
    selectedCalendarDate,
    showGoalModal,
    showScheduleModal,
    showTimerModal
  ]);

  const renderChallengesTab = useCallback(() => (
    <>
      {/* Community Challenges */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Community Challenges</Text>
        <TouchableOpacity onPress={() => router.push('/community')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      
      {communityRunningChallenges.map(challenge => (
        <Card key={challenge.id} style={styles.fullWidthChallengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeTitle}>{challenge.name}</Text>
            <Badge 
              variant="primary" 
              style={styles.challengeCategoryBadge}
            >
              {challenge.category}
            </Badge>
          </View>
          <Text style={styles.challengeDescription}>{challenge.description}</Text>
          <View style={styles.challengeProgress}>
            <Text style={styles.challengeProgressText}>
              Progress: {challenge.progress || 0}/{challenge.target} {challenge.unit}
            </Text>
            <View style={styles.challengeProgressBar}>
              <View 
                style={[
                  styles.challengeProgressFill, 
                  { width: `${((challenge.progress || 0) / challenge.target) * 100}%` }
                ]} 
              />
            </View>
          </View>
          <View style={styles.challengeFooter}>
            <Text style={styles.challengeParticipants}>{challenge.participants} participants</Text>
            <Button 
              title={challenge.isJoined ? 'Joined' : 'Join Challenge'}
              onPress={() => handleJoinChallenge(challenge.id)}
              variant={challenge.isJoined ? 'outline' : 'primary'}
              style={styles.challengeJoinButton}
              disabled={challenge.isJoined}
            />
          </View>
        </Card>
      ))}
    </>
  ), [communityRunningChallenges]);
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.searchButton}>
          <Search size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Workout Hub</Text>
        
        <TouchableOpacity style={styles.musicButton}>
          <Music size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Tab Bar - Updated to match Profile style */}
      <View style={styles.tabBar}>
        {tabs.map(tab => {
          const IconComponent = tab.icon;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
              onPress={() => setActiveTab(tab.id)}
            >
              <IconComponent 
                size={20} 
                color={activeTab === tab.id ? Colors.primary : Colors.text.secondary} 
              />
              <Text style={[styles.tabButtonText, activeTab === tab.id && styles.activeTabButtonText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
      >
        {activeTab === 'workouts' && renderWorkoutsTab()}
        {activeTab === 'running' && renderRunningTab()}
        {activeTab === 'programs' && renderProgramsTab()}
        {activeTab === 'challenges' && renderChallengesTab()}
        
        <View style={{ height: 80 }} />
      </ScrollView>
      
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: Colors.backgroundSecondary,
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.xlarge,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  musicButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.xlarge,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.xlarge,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: Colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
  },
  // Updated Tab Bar styles to match Profile
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: Colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabButtonText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  carouselContainer: {
    marginBottom: 24,
  },
  workoutsContainer: {
    paddingLeft: 20,
    paddingRight: 40,
  },
  workoutCard: {
    width: width * 0.85,
    height: 200,
    borderRadius: Colors.radius.large,
    overflow: 'hidden',
    marginRight: Colors.spacing.lg,
    position: 'relative',
  },
  workoutCardContainer: {
    width: width * 0.85,
    marginRight: Colors.spacing.lg,
  },
  runningProgramCardContainer: {
    width: width * 0.85,
    marginRight: Colors.spacing.lg,
  },
  workoutImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  workoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
  },
  workoutTitle: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    color: Colors.text.inverse,
    fontSize: 20,
    fontWeight: '700',
  },
  proBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  proBadgeText: {
    color: Colors.text.inverse,
    fontSize: 12,
    fontWeight: '700',
  },
  durationBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationText: {
    color: Colors.text.inverse,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  muscleGroupIcons: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
  },
  muscleIcon: {
    width: 30,
    height: 30,
    marginLeft: 4,
    tintColor: Colors.text.inverse,
  },
  equipmentIcon: {
    position: 'absolute',
    bottom: 16,
    right: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipmentIconImage: {
    width: 20,
    height: 20,
    tintColor: Colors.text.inverse,
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
  viewAllSavedButton: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  
  // Running-specific styles
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
    alignItems: 'center',
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: Colors.radius.large,
  },
  musicToggleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  musicPlayerCard: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.running.primary,
  },
  quickActionTextActive: {
    color: Colors.text.inverse,
  },
  currentRunCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
  },
  currentRunTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  currentRunStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  currentRunStat: {
    alignItems: 'center',
  },
  currentRunStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.running.primary,
  },
  currentRunStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  runningStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  runningStatCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    alignItems: 'center',
  },
  runningStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  runningStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  personalBestsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  personalBestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  personalBestLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  personalBestValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  runningBuddyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    gap: 12,
  },
  buddyAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  buddyInfo: {
    flex: 1,
  },
  buddyName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  buddyLevel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  buddyStats: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  buddyStatus: {
    alignItems: 'center',
    gap: 4,
  },
  buddyStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buddyStatusText: {
    fontSize: 10,
    color: Colors.text.secondary,
  },
  challengesContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 16,
  },
  challengeCard: {
    width: 280,
    padding: 16,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  challengeDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  challengeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  challengeParticipants: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  challengeReward: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.running.primary,
  },
  challengeButton: {
    marginTop: 8,
  },
  raceCard: {
    width: 300,
    padding: 16,
  },
  raceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  raceDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  raceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  raceDistance: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.running.distance,
  },
  raceParticipants: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  raceRewards: {
    marginBottom: 12,
  },
  raceRewardText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning,
  },
  racePrize: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  raceButton: {
    marginTop: 8,
  },
  fullWidthChallengeCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeCategoryBadge: {
    height: 24,
    paddingHorizontal: 8,
  },
  challengeProgress: {
    marginVertical: 12,
  },
  challengeProgressText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  challengeProgressBar: {
    height: 6,
    backgroundColor: Colors.inactive,
    borderRadius: 3,
    overflow: 'hidden',
  },
  challengeProgressFill: {
    height: '100%',
    backgroundColor: Colors.running.primary,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeJoinButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  // Spotify playlist styles
  playlistsContainer: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 16,
  },
  playlistCard: {
    width: 160,
    padding: 12,
    alignItems: 'center',
  },
  playlistImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  playlistName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  playlistTracks: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  noSpotifyConnectionText: {
    textAlign: 'center',
    padding: 16,
    color: Colors.text.secondary,
    fontSize: 14,
  },
  
  // Calendar tab styles
  calendarToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
  },
  calendarToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  calendarToggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  calendarToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  calendarToggleTextActive: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
});
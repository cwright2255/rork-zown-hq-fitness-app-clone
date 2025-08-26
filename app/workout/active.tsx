import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  SafeAreaView, 
  Alert, 
  Platform, 
  Dimensions, 
  StatusBar as RNStatusBar,
  Animated,
  PanResponder,
  ScrollView,
  Modal,
  TextInput
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Play, Pause, SkipForward, ChevronLeft, Clock, Award, Heart, Volume2, ChevronUp, ChevronDown, X, Camera, Music, Info, MapPin, Loader2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import Card from '@/components/Card';
import SpotifyMusicPlayer from '@/components/SpotifyMusicPlayer';
import RunningMap from '@/components/RunningMap';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { Workout, Exercise, Coordinate, CompletedWorkout } from '@/types';
import locationService, { LocationServiceState } from '@/services/locationService';
import voiceCommandService from '@/services/voiceCommandService';
import formAnalysisService from '@/services/formAnalysisService';
import smartRestService from '@/services/smartRestService';
import workoutStreamingService from '@/services/workoutStreamingService';

const { width, height } = Dimensions.get('window');

export default function ActiveWorkoutScreen() {
  const params = useLocalSearchParams();
  const workoutId = typeof params.workoutId === 'string' ? params.workoutId : '';
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : '';
  const programId = typeof params.programId === 'string' ? params.programId : '';
  const mode = typeof params.mode === 'string' ? params.mode : (typeof params.type === 'string' ? params.type : 'workout');
  const { workouts, customWorkouts, addCompletedWorkout, currentRun, startRun, finishRun, updateRunStats, initializeDefaultWorkouts, runningPrograms } = useWorkoutStore();
  const { addXp } = useUserStore();
  const { checkAchievements } = useAchievementStore();
  const { isConnected: isSpotifyConnected } = useSpotifyStore();
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [runningSession, setRunningSession] = useState<any>(null);
  const [runningProgram, setRunningProgram] = useState<any>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [timer, setTimer] = useState(5); // Start with 5 seconds for demo
  const [isActive, setIsActive] = useState(false);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [showExitMenu, setShowExitMenu] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [runStats, setRunStats] = useState({
    distance: 0,
    time: 0,
    pace: 0,
    calories: 0,
    coordinates: [] as Coordinate[]
  });
  const [locationState, setLocationState] = useState<LocationServiceState>({
    isTracking: false,
    coordinates: [],
    currentLocation: null,
    distance: 0,
    speed: 0,
    averageSpeed: 0,
  });
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined' | 'loading'>('undetermined');
  const [showLocationPermissionModal, setShowLocationPermissionModal] = useState(false);
  
  // Enhanced workout features state
  const [showVoiceControl, setShowVoiceControl] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [showFormAnalysis, setShowFormAnalysis] = useState(false);
  const [formScore, setFormScore] = useState<number | null>(null);
  const [formFeedback, setFormFeedback] = useState<string[]>([]);
  const [adaptiveRestTime, setAdaptiveRestTime] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [showLiveStreams, setShowLiveStreams] = useState(false);
  const [currentStream, setCurrentStream] = useState<any>(null);
  
  // Next workouts preview state
  const [previewHeight] = useState(new Animated.Value(0));
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const previewMaxHeight = 300;
  

  
  useEffect(() => {
    const loadWorkout = async () => {
      try {
        if (workouts.length === 0) {
          initializeDefaultWorkouts();
          // Wait for initialization
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        if (mode === 'running' && sessionId && programId) {
          // Handle running session
          const foundProgram = runningPrograms.find(p => p.id === programId);
          if (foundProgram) {
            setRunningProgram(foundProgram);
            const foundSession = foundProgram.sessions.find(s => s.id === sessionId);
            setRunningSession(foundSession || null);
          }
          setWorkout(null);
        } else if (workoutId && mode === 'workout') {
          // Find workout in both regular and custom workouts
          const allWorkouts = [...workouts, ...customWorkouts];
          const foundWorkout = allWorkouts.find(w => w.id === workoutId);
          
          if (!foundWorkout && allWorkouts.length > 0) {
            // Fallback to first available workout
            setWorkout(allWorkouts[0]);
          } else {
            setWorkout(foundWorkout || null);
          }
        } else if (mode === 'run') {
          if (!currentRun) {
            startRun();
          }
          setWorkout(null);
        }
      } catch (error) {
        console.error('Error loading workout:', error);
      }
    };
    
    loadWorkout();
  }, [workoutId, sessionId, programId, mode, workouts.length, customWorkouts.length, currentRun, startRun, initializeDefaultWorkouts, runningPrograms]);
  
  // Location service listener
  useEffect(() => {
    const unsubscribe = locationService.addListener((state) => {
      setLocationState(state);
      setRunStats(prev => ({
        ...prev,
        distance: state.distance,
        coordinates: state.coordinates,
      }));
    });
    
    return unsubscribe;
  }, []);
  
  // Check location permissions on mount for running modes
  useEffect(() => {
    const checkLocationPermissions = async () => {
      if (mode === 'run' || mode === 'running') {
        setLocationPermission('loading');
        const status = await locationService.getLocationPermissionStatus();
        setLocationPermission(status);
      }
    };
    
    checkLocationPermissions();
  }, [mode]);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (isActive && workout && !isResting) {
      interval = setInterval(() => {
        setTimer(prevTimer => {
          if (prevTimer <= 0) {
            // Time's up, start rest period or move to next set
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setIsResting(true);
            return 60; // 60 second rest
          }
          return prevTimer - 1;
        });
      }, 1000);
    } else if (isActive && isResting) {
      interval = setInterval(() => {
        setTimer(prevTimer => {
          if (prevTimer <= 0) {
            // Rest is over
            const currentExercise = workout?.exercises[currentExerciseIndex];
            if (currentSet < (currentExercise?.sets || 3)) {
              // Move to next set
              setCurrentSet(currentSet + 1);
              setIsResting(false);
              return 5; // Reset work timer
            } else if (currentExerciseIndex < (workout?.exercises.length || 0) - 1) {
              // Move to next exercise
              setCurrentExerciseIndex(currentExerciseIndex + 1);
              setCurrentSet(1);
              setIsResting(false);
              return 5; // Reset work timer
            } else {
              // Workout complete
              completeWorkout();
              return 0;
            }
          }
          return prevTimer - 1;
        });
      }, 1000);
    } else if (isActive && (mode === 'run' || mode === 'running')) {
      interval = setInterval(() => {
        setTimer(prevTimer => prevTimer + 1);
        setRunStats(prev => {
          const newTime = prev.time + 1;
          const currentDistance = locationState.distance || prev.distance;
          const newPace = newTime > 0 && currentDistance > 0 ? (newTime / 60) / currentDistance : 0;
          const newCalories = prev.calories + 0.1;
          
          const updatedStats = {
            distance: currentDistance,
            time: newTime,
            pace: newPace,
            calories: newCalories,
            coordinates: locationState.coordinates
          };
          updateRunStats(updatedStats);
          return updatedStats;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isResting, currentExerciseIndex, workout, currentSet, mode, updateRunStats]);
  
  const toggleTimer = async () => {
    const newIsActive = !isActive;
    setIsActive(newIsActive);
    
    if (Platform.OS !== 'web' && newIsActive) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Handle location tracking for running modes
    if (mode === 'run' || mode === 'running') {
      if (newIsActive) {
        // Check permissions first
        if (locationPermission === 'denied') {
          setShowLocationPermissionModal(true);
          setIsActive(false);
          return;
        }
        
        // Start location tracking
        const started = await locationService.startTracking();
        if (!started) {
          // Update permission status and show modal
          const newStatus = await locationService.getLocationPermissionStatus();
          setLocationPermission(newStatus);
          setShowLocationPermissionModal(true);
          setIsActive(false);
          return;
        }
        
        // Update permission status to granted if tracking started successfully
        setLocationPermission('granted');
      } else {
        // Pause location tracking (don't stop completely)
        // Location service will continue but we won't update stats
      }
    }
  };
  
  const skipToNext = () => {
    if (!workout) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (isResting) {
      // Skip rest period
      const currentExercise = workout.exercises[currentExerciseIndex];
      if (currentSet < (currentExercise.sets || 3)) {
        setCurrentSet(currentSet + 1);
        setIsResting(false);
        setTimer(5);
      } else if (currentExerciseIndex < workout.exercises.length - 1) {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
        setCurrentSet(1);
        setIsResting(false);
        setTimer(5);
      } else {
        completeWorkout();
      }
    } else {
      // Skip to rest period
      setIsResting(true);
      setTimer(60);
    }
  };
  
  const completeWorkout = () => {
    if (!workout) return;
    
    setIsActive(false);
    setWorkoutComplete(true);
    
    // Log completed workout
    if (addCompletedWorkout) {
      const completedWorkout = {
        id: Date.now().toString(),
        workoutId: workout.id,
        completedAt: new Date().toISOString(),
        date: new Date().toISOString(),
        duration: workout.duration,
        caloriesBurned: workout.calories,
        name: workout.name,
        description: workout.description || '',
        difficulty: workout.difficulty,
        category: workout.category,
        exercises: workout.exercises,
        imageUrl: workout.imageUrl,
        equipment: workout.equipment || [],
        muscleGroups: workout.muscleGroups || [],
        calories: workout.calories,
        xpReward: workout.xpReward || 0,
        isCustom: workout.isCustom || false
      } as CompletedWorkout;
      addCompletedWorkout(completedWorkout);
    }
    
    // Award XP
    if (workout.xpReward) {
      addXp(workout.xpReward);
    }
    
    // Update achievements
    try {
      checkAchievements({ workoutsCompleted: 1 });
    } catch (error) {
      console.error('Failed to update achievements:', error);
    }
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  
  const completeRun = () => {
    setIsActive(false);
    
    // Stop location tracking
    locationService.stopTracking();
    
    if (mode === 'run') {
      finishRun();
    }
    setWorkoutComplete(true);
    
    // Award XP
    const xpReward = mode === 'running' && runningSession ? runningSession.xpReward : 50;
    addXp(xpReward);
    
    // Haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  
  const handleExitPress = () => {
    setShowExitMenu(true);
    if (isActive) {
      setIsActive(false); // Pause the workout when showing exit menu
    }
  };
  
  const handleContinue = () => {
    setShowExitMenu(false);
    // Resume the workout if it was active before
    if (isActive) {
      setIsActive(true);
    }
  };
  
  const handleExitAndDiscard = () => {
    setShowExitMenu(false);
    router.back();
  };
  
  const handleFinishWorkout = () => {
    setShowExitMenu(false);
    if (mode === 'run' || mode === 'running') {
      completeRun();
    } else {
      completeWorkout();
    }
  };
  
  const handleFinish = () => {
    router.replace('/');
  };
  
  const handleRequestLocationPermission = async () => {
    setLocationPermission('loading');
    const hasPermission = await locationService.requestPermissions();
    if (hasPermission) {
      setLocationPermission('granted');
      setShowLocationPermissionModal(false);
      // Try to start tracking again
      setIsActive(true);
    } else {
      setLocationPermission('denied');
    }
  };
  
  const handleLocationPermissionDenied = () => {
    setShowLocationPermissionModal(false);
    router.back();
  };
  
  const toggleFeeling = (feeling: string) => {
    if (selectedFeelings.includes(feeling)) {
      setSelectedFeelings(selectedFeelings.filter(f => f !== feeling));
    } else {
      setSelectedFeelings([...selectedFeelings, feeling]);
    }
  };
  
  if (!workout && mode === 'workout') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading workout...</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  if (!runningSession && mode === 'running') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading running session...</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  
  // Show location permission screen for running modes if permission is denied
  if ((mode === 'run' || mode === 'running') && locationPermission === 'denied') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <MapPin size={64} color={Colors.text.secondary} />
          <Text style={styles.permissionTitle}>Location Permission Required</Text>
          <Text style={styles.permissionText}>
            GPS tracking is required for running workouts. Please enable location services in your device settings to continue.
          </Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const currentExercise = workout?.exercises[currentExerciseIndex];
  const maxTime = isResting ? 60 : 5;
  const progress = (maxTime - timer) / maxTime;
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Default image if none provided
  const defaultExerciseImage = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500';
  
  const formatPace = (pace: number): string => {
    if (pace === 0) return '0:00/km';
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  // Render map component with real GPS tracking
  const renderMap = () => {
    // Use real GPS coordinates or show waiting state
    const coordinates = locationState.coordinates.length > 0 
      ? locationState.coordinates 
      : [];
    
    return (
      <RunningMap
        coordinates={coordinates}
        currentLocation={locationState.currentLocation ? {
          latitude: locationState.currentLocation.coords.latitude,
          longitude: locationState.currentLocation.coords.longitude,
          timestamp: new Date().toISOString(),
        } : undefined}
        distance={locationState.distance}
        pace={runStats.pace}
        style={styles.mapContainer}
      />
    );
  };

  // Get workout type for Spotify recommendations
  const getWorkoutType = (): 'cardio' | 'strength' | 'yoga' | 'running' => {
    if (mode === 'run') return 'running';
    if (!workout) return 'cardio';
    
    const category = workout.category.toLowerCase();
    if (category.includes('cardio') || category.includes('hiit')) return 'cardio';
    if (category.includes('strength') || category.includes('weight')) return 'strength';
    if (category.includes('yoga') || category.includes('flexibility')) return 'yoga';
    
    return 'cardio';
  };
  
  // Get next workouts for preview
  const getNextWorkouts = () => {
    const allWorkouts = [...workouts, ...customWorkouts];
    const currentIndex = allWorkouts.findIndex(w => w.id === workoutId);
    if (currentIndex === -1) return allWorkouts.slice(0, 3);
    
    const nextWorkouts = [];
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentIndex + i) % allWorkouts.length;
      nextWorkouts.push(allWorkouts[nextIndex]);
    }
    return nextWorkouts;
  };
  
  // Pan responder for swipe up gesture
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
    },
    onPanResponderMove: (evt, gestureState) => {
      if (gestureState.dy < 0) { // Swiping up
        const newHeight = Math.min(previewMaxHeight, Math.abs(gestureState.dy));
        previewHeight.setValue(newHeight);
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dy < -50) { // Swipe up threshold
        setIsPreviewVisible(true);
        Animated.spring(previewHeight, {
          toValue: previewMaxHeight,
          useNativeDriver: false,
        }).start();
      } else {
        setIsPreviewVisible(false);
        Animated.spring(previewHeight, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
  });
  
  const closePreview = () => {
    setIsPreviewVisible(false);
    Animated.spring(previewHeight, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };
  
  const renderNextWorkoutsPreview = () => {
    const nextWorkouts = getNextWorkouts();
    
    return (
      <Animated.View style={[styles.nextWorkoutsPreview, { height: previewHeight }]}>
        <View style={styles.previewHeader}>
          <View style={styles.previewHandle} />
          <Text style={styles.previewTitle}>Next Workouts</Text>
          <TouchableOpacity onPress={closePreview} style={styles.closePreviewButton}>
            <Text style={styles.closePreviewText}>×</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.previewContent} showsVerticalScrollIndicator={false}>
          {nextWorkouts.map((nextWorkout, index) => (
            <TouchableOpacity 
              key={`next-workout-${nextWorkout.id}-${index}-${Date.now()}`} 
              style={styles.nextWorkoutCard}
              onPress={() => {
                closePreview();
                router.replace(`/workout/${nextWorkout.id}?mode=workout`);
              }}
            >
              <Image 
                source={{ uri: nextWorkout.imageUrl }} 
                style={styles.nextWorkoutImage} 
              />
              <View style={styles.nextWorkoutInfo}>
                <Text style={styles.nextWorkoutName}>{nextWorkout.name}</Text>
                <Text style={styles.nextWorkoutDetails}>
                  {nextWorkout.duration} min • {nextWorkout.difficulty}
                </Text>
                <Text style={styles.nextWorkoutCategory}>{nextWorkout.category}</Text>
              </View>
              <View style={styles.nextWorkoutMeta}>
                <Text style={styles.nextWorkoutXp}>+{nextWorkout.xpReward} XP</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };
  
  return (
    <>
      <Stack.Screen options={{ 
        headerShown: false,
        presentation: 'fullScreenModal',
        gestureEnabled: false,
        statusBarStyle: 'light',
        statusBarHidden: true
      }} />
      <StatusBar style="light" />
      <View style={styles.container}>
      
      {workoutComplete ? (
        // Workout Complete Screen - Enhanced to match reference
        <SafeAreaView style={styles.completeContainer}>
          <View style={styles.completeHeader}>
            <Text style={styles.completeTitle}>{(mode === 'run' || mode === 'running') ? 'Run Complete!' : 'Workout Complete!'}</Text>
            <Text style={styles.completeSubtitle}>
              Great job! You have completed the {(mode === 'run' || mode === 'running') ? (runningSession?.name || 'run') : workout?.name + ' workout'}.
            </Text>
          </View>
          
          <View style={styles.photoContainer}>
            <TouchableOpacity style={styles.addPhotoButton}>
              <Camera size={32} color="#fff" />
              <Text style={styles.addPhotoText}>Add a Photo</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.workoutStatsContainer}>
            <View style={styles.workoutTimeContainer}>
              <Text style={styles.workoutTimeText}>{formatTime((mode === 'run' || mode === 'running') ? runStats.time : timer)}</Text>
              <View style={styles.completionProgressContainer}>
                <View style={styles.completionProgressBar}>
                  <View style={[styles.completionProgressFill, { width: '100%' }]} />
                </View>
                <Text style={styles.completionPercentText}>100% COMPLETED</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.commentContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Tap to add a comment"
              placeholderTextColor="#888"
              multiline
              value={comment}
              onChangeText={setComment}
            />
          </View>
          
          <View style={styles.feelingsContainer}>
            <Text style={styles.feelingsTitle}>How are you feeling?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.feelingsScrollView}>
              {['AMAZING', 'STRONG', 'FRESH', 'MOTIVATED', 'PUMPED'].map((feeling) => (
                <TouchableOpacity 
                  key={feeling} 
                  style={[
                    styles.feelingButton,
                    selectedFeelings.includes(feeling) && styles.selectedFeelingButton
                  ]}
                  onPress={() => toggleFeeling(feeling)}
                >
                  <Text style={[
                    styles.feelingText,
                    selectedFeelings.includes(feeling) && styles.selectedFeelingText
                  ]}>
                    {feeling}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          
          <View style={styles.publicActivityContainer}>
            <View style={styles.publicActivityTextContainer}>
              <Text style={styles.publicActivityTitle}>Public Activity</Text>
              <Text style={styles.publicActivityDescription}>
                *Public activities appear on other users feeds. You can change this at any time.
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggleContainer, isPublic ? styles.toggleActive : styles.toggleInactive]}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={[styles.toggleCircle, isPublic ? styles.toggleCircleActive : styles.toggleCircleInactive]} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Clock size={24} color={Colors.primary} />
              <Text style={styles.summaryStatValue}>{(mode === 'run' || mode === 'running') ? formatTime(runStats.time) : `${workout?.duration} min`}</Text>
              <Text style={styles.summaryStatLabel}>Duration</Text>
            </View>
            
            <View style={styles.statItem}>
              <Award size={24} color={Colors.primary} />
              <Text style={styles.summaryStatValue}>+{(mode === 'run' || mode === 'running') ? (runningSession?.xpReward || 50) : workout?.xpReward || 0}</Text>
              <Text style={styles.summaryStatLabel}>XP Earned</Text>
            </View>
            
            {(mode === 'run' || mode === 'running') && (
              <>
                <View style={styles.statItem}>
                  <MapPin size={24} color={Colors.primary} />
                  <Text style={styles.summaryStatValue}>{locationState.distance.toFixed(2)} km</Text>
                  <Text style={styles.summaryStatLabel}>Distance</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Heart size={24} color={Colors.primary} />
                  <Text style={styles.summaryStatValue}>{Math.round(runStats.calories)}</Text>
                  <Text style={styles.summaryStatLabel}>Calories</Text>
                </View>
              </>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.finishedButton}
            onPress={handleFinish}
          >
            <Text style={styles.finishedButtonText}>Finished</Text>
          </TouchableOpacity>
        </SafeAreaView>
      ) : (
        // Active Workout Screen - New Design
        <View style={styles.activeWorkoutContainer}>
          <StatusBar style="light" />
          
          {mode === 'workout' && workout && (
            <>
              {/* Exercise Name Header */}
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseTitle}>{currentExercise?.name || 'Exercise'}</Text>
              </View>
              
              {/* Reps and Weight Display - Moved to top */}
              <View style={styles.topStatsRow}>
                <View style={styles.topStatBox}>
                  <Text style={styles.topStatLabel}>Reps</Text>
                  <Text style={styles.topStatValue}>{currentExercise?.reps || 5}</Text>
                </View>
                <View style={styles.topStatBox}>
                  <Text style={styles.topStatLabel}>Kg</Text>
                  <Text style={styles.topStatValue}>{currentExercise?.weight || 5}</Text>
                </View>
              </View>
              
              {/* Set Tracking Bar - Moved under Reps and Kg */}
              <View style={styles.setTrackingContainer}>
                <View style={styles.setTrackingBar}>
                  <View style={styles.setTrackingProgress}>
                    <View 
                      style={[
                        styles.setTrackingFill, 
                        { width: `${(currentSet / (currentExercise?.sets || 6)) * 100}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.setTrackingText}>
                    Set {currentSet} of {currentExercise?.sets || 6}
                  </Text>
                </View>
              </View>
              
              {/* Exercise Image */}
              <View style={styles.exerciseImageContainer}>
                <Image
                  source={{ uri: currentExercise?.imageUrl || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500' }}
                  style={styles.mainExerciseImage}
                  resizeMode="cover"
                />
              </View>
              

              
              {/* Sets Indicator */}
              <View style={styles.setsContainer}>
                <Text style={styles.setsLabel}>Sets</Text>
                <View style={styles.setsRow}>
                  {Array.from({ length: currentExercise?.sets || 6 }, (_, index) => (
                    <TouchableOpacity 
                      key={index + 1}
                      style={[
                        styles.setCircle,
                        index + 1 === currentSet ? styles.activeSet : 
                        index + 1 < currentSet ? styles.completedSet : styles.inactiveSet
                      ]}
                    >
                      <Text style={[
                        styles.setNumber,
                        index + 1 === currentSet ? styles.activeSetText : 
                        index + 1 < currentSet ? styles.completedSetText : styles.inactiveSetText
                      ]}>
                        {index + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Timer and Controls */}
              <View style={styles.timerSection} {...panResponder.panHandlers}>
                <View style={styles.timerRow}>
                  <TouchableOpacity 
                    style={styles.pauseButton}
                    onPress={toggleTimer}
                  >
                    {isActive ? (
                      <Pause size={24} color="#333" />
                    ) : (
                      <Play size={24} color="#333" />
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.timerDisplay}>
                    <Text style={styles.timerLabel}>{isResting ? 'Rest' : 'Work'}</Text>
                    <Text style={styles.timerText}>{formatTime(timer)}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.skipButtonNew}
                    onPress={skipToNext}
                  >
                    <Text style={styles.skipButtonText}>SKIP</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Swipe indicator */}
                <View style={styles.swipeIndicator}>
                  <View style={styles.swipeHandle} />
                  <Text style={styles.swipeText}>Swipe up for next workouts</Text>
                </View>
              </View>
              
              {/* Next Workouts Preview */}
              {renderNextWorkoutsPreview()}
            </>
          )}
          
          {(mode === 'run' || mode === 'running') && (
            <View style={styles.runContainer}>
              {/* Full Screen Map */}
              <View style={styles.fullScreenMapContainer}>
                {renderMap()}
                
                {/* Top Stats Overlay */}
                <View style={styles.topStatsOverlay}>
                  <View style={styles.topStatItem}>
                    <Text style={styles.runningTopStatValue}>{formatTime(runStats.time)}</Text>
                    <Text style={styles.runningTopStatLabel}>TIME</Text>
                  </View>
                  <View style={styles.topStatItem}>
                    <Text style={styles.runningTopStatValue}>{locationState.distance.toFixed(2)}</Text>
                    <Text style={styles.runningTopStatLabel}>KM</Text>
                  </View>
                  <View style={styles.topStatItem}>
                    <Text style={styles.runningTopStatValue}>{formatPace(runStats.pace)}</Text>
                    <Text style={styles.runningTopStatLabel}>PACE</Text>
                  </View>
                </View>
                
                {/* Control Panel Overlay */}
                <View style={styles.controlPanelOverlay}>
                  {/* Exit Button */}
                  <TouchableOpacity style={styles.exitButtonRun} onPress={handleExitPress}>
                    <X size={24} color="#333" />
                  </TouchableOpacity>
                  
                  {/* Start/Pause Button */}
                  <TouchableOpacity 
                    style={[styles.startButton, isActive && styles.pauseButtonActive]}
                    onPress={toggleTimer}
                  >
                    {isActive ? (
                      <View style={styles.pauseIcon}>
                        <View style={styles.pauseBar} />
                        <View style={styles.pauseBar} />
                      </View>
                    ) : (
                      <Text style={styles.startButtonText}>START</Text>
                    )}
                  </TouchableOpacity>
                  
                  {/* Music Button */}
                  <TouchableOpacity style={styles.musicButton}>
                    <Music size={24} color="#333" />
                  </TouchableOpacity>
                </View>
                
                {/* Bottom Stats Overlay */}
                <View style={styles.bottomStatsOverlay}>
                  <View style={styles.bottomStatItem}>
                    <Text style={styles.bottomStatValue}>{Math.round(runStats.calories)}</Text>
                    <Text style={styles.bottomStatLabel}>CALORIES</Text>
                  </View>
                  <View style={styles.bottomStatItem}>
                    <Text style={styles.bottomStatValue}>{(locationState.averageSpeed * 3.6).toFixed(1)}</Text>
                    <Text style={styles.bottomStatLabel}>AVG SPEED</Text>
                  </View>
                  <View style={styles.bottomStatItem}>
                    <Text style={styles.bottomStatValue}>{locationState.coordinates.length}</Text>
                    <Text style={styles.bottomStatLabel}>GPS POINTS</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {/* Exit Menu Modal */}
          <Modal
            visible={showExitMenu}
            transparent={true}
            animationType="fade"
            onRequestClose={handleContinue}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{(mode === 'run' || mode === 'running') ? 'Run in Progress' : 'Workout in Progress'}</Text>
                <Text style={styles.modalText}>What would you like to do?</Text>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.continueButton]}
                  onPress={handleContinue}
                >
                  <Text style={styles.continueButtonText}>{(mode === 'run' || mode === 'running') ? 'Continue Run' : 'Continue Workout'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.finishWorkoutButton]}
                  onPress={handleFinishWorkout}
                >
                  <Text style={styles.finishWorkoutText}>{(mode === 'run' || mode === 'running') ? 'Finish Run' : 'Finish Workout'}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.exitButton]}
                  onPress={handleExitAndDiscard}
                >
                  <Text style={styles.exitButtonText}>Exit and Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
          
          {/* Location Permission Modal */}
          <Modal
            visible={showLocationPermissionModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowLocationPermissionModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <MapPin size={48} color={Colors.primary} style={styles.permissionIcon} />
                <Text style={styles.modalTitle}>Location Permission Required</Text>
                <Text style={styles.modalText}>
                  We need access to your location to track your run with GPS. This allows us to:
                </Text>
                
                <View style={styles.permissionFeatures}>
                  <Text style={styles.permissionFeature}>• Track your running route</Text>
                  <Text style={styles.permissionFeature}>• Calculate distance and pace</Text>
                  <Text style={styles.permissionFeature}>• Show your progress on a map</Text>
                  <Text style={styles.permissionFeature}>• Provide accurate workout data</Text>
                </View>
                
                {locationPermission === 'loading' ? (
                  <View style={styles.loadingContainer}>
                    <Loader2 size={24} color={Colors.primary} />
                    <Text style={styles.loadingText}>Requesting permission...</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.continueButton]}
                      onPress={handleRequestLocationPermission}
                    >
                      <Text style={styles.continueButtonText}>Grant Location Access</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.modalButton, styles.exitButton]}
                      onPress={handleLocationPermissionDenied}
                    >
                      <Text style={styles.exitButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
          
          {/* Next Workouts Preview Overlay */}
          {isPreviewVisible && (
            <TouchableOpacity 
              style={styles.previewOverlay} 
              activeOpacity={1} 
              onPress={closePreview}
            />
          )}
        </View>
      )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.text.inverse,
    fontWeight: '600',
  },
  activeWorkoutContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  exerciseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },

  exerciseImageContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  topStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 60,
    marginBottom: 20,
  },
  topStatBox: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  topStatLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  topStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  mainExerciseImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 60,
    marginBottom: 40,
  },
  statBox: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#333',
    marginTop: -30,
  },
  setsContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  setsLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  setsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  setCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  activeSet: {
    backgroundColor: '#333',
    borderColor: '#333',
  },
  completedSet: {
    backgroundColor: '#e0e0e0',
    borderColor: '#e0e0e0',
  },
  inactiveSet: {
    backgroundColor: 'transparent',
    borderColor: '#e0e0e0',
  },
  setNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  activeSetText: {
    color: '#fff',
  },
  completedSetText: {
    color: '#666',
  },
  inactiveSetText: {
    color: '#999',
  },
  timerSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  timerLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  skipButtonNew: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  runContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  // Full screen running UI styles
  fullScreenMapContainer: {
    flex: 1,
    position: 'relative',
  },
  topStatsOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topStatItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 80,
  },
  runningTopStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  runningTopStatLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  controlPanelOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  bottomStatsOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  bottomStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  bottomStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  bottomStatLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  exitButtonRun: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#00ff88',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pauseButtonActive: {
    backgroundColor: '#ff6b6b',
    shadowColor: '#ff6b6b',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  musicButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  completeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  completeHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  photoContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  addPhotoButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(74, 128, 240, 0.2)',
  },
  addPhotoText: {
    color: Colors.primary,
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  workoutStatsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  workoutTimeContainer: {
    marginBottom: 20,
  },
  workoutTimeText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  completionProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionProgressBar: {
    height: 4,
    width: 100,
    backgroundColor: 'rgba(74, 128, 240, 0.3)',
    borderRadius: 2,
    marginRight: 10,
    overflow: 'hidden',
  },
  completionProgressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  completionPercentText: {
    color: '#666',
    fontSize: 12,
  },
  commentContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  commentInput: {
    backgroundColor: 'rgba(74, 128, 240, 0.1)',
    borderRadius: 16,
    padding: 16,
    color: '#333',
    fontSize: 16,
    minHeight: 100,
  },
  feelingsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  feelingsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  feelingsScrollView: {
    flexDirection: 'row',
  },
  feelingButton: {
    backgroundColor: 'rgba(74, 128, 240, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  selectedFeelingButton: {
    backgroundColor: Colors.primary,
  },
  feelingText: {
    color: '#333',
    fontWeight: '600',
  },
  selectedFeelingText: {
    color: '#fff',
  },
  publicActivityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  publicActivityTextContainer: {
    flex: 1,
  },
  publicActivityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  publicActivityDescription: {
    fontSize: 12,
    color: '#666',
  },
  toggleContainer: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleInactive: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  toggleCircleActive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  toggleCircleInactive: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  finishedButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 30,
    marginHorizontal: 20,
    marginBottom: 40,
    marginTop: 20,
  },
  finishedButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(74, 128, 240, 0.1)',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    marginBottom: 12,
  },
  summaryStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginVertical: 8,
  },
  summaryStatLabel: {
    fontSize: 14,
    color: '#666',
  },

  finishButton: {
    width: '100%',
  },
  // Full workout view styles
  fullWorkoutContainer: {
    flex: 1,
    paddingTop: 8,
  },
  fullWorkoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  fullWorkoutSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'right',
  },
  exerciseList: {
    maxHeight: height * 0.6,
  },
  exerciseListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    backgroundColor: 'rgba(230, 240, 255, 0.3)',
    marginBottom: 8,
    borderRadius: 12,
  },
  currentExerciseItem: {
    backgroundColor: 'rgba(74, 128, 240, 0.2)',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  exerciseListImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
  },
  exerciseListDetails: {
    flex: 1,
  },
  exerciseListName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseListSpecs: {
    fontSize: 14,
    color: '#666',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButton: {
    backgroundColor: Colors.primary,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  finishWorkoutButton: {
    backgroundColor: 'rgba(230, 240, 255, 0.8)',
  },
  finishWorkoutText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  exitButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 50, 50, 0.7)',
  },
  exitButtonText: {
    color: 'rgba(255, 50, 50, 0.9)',
    fontSize: 16,
    fontWeight: '600',
  },
  // Run-specific styles
  runStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  runStatItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(230, 240, 255, 0.8)',
    padding: 16,
    borderRadius: 12,
    width: '30%',
  },
  runStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  runStatLabel: {
    fontSize: 12,
    color: '#666',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  webMapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(230, 240, 255, 0.5)',
    padding: 20,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  noSpotifyConnectionText: {
    textAlign: 'center',
    padding: 16,
    color: '#666',
    fontSize: 14,
  },
  progressIndicator: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(74, 128, 240, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressIndicatorFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  // Next workouts preview styles
  nextWorkoutsPreview: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  previewHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  closePreviewButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreviewText: {
    fontSize: 20,
    color: '#666',
    fontWeight: '300',
  },
  previewContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  nextWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  nextWorkoutImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 16,
  },
  nextWorkoutInfo: {
    flex: 1,
  },
  nextWorkoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  nextWorkoutDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  nextWorkoutCategory: {
    fontSize: 12,
    color: Colors.primary,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  nextWorkoutMeta: {
    alignItems: 'flex-end',
  },
  nextWorkoutXp: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  swipeIndicator: {
    alignItems: 'center',
    paddingTop: 12,
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    marginBottom: 8,
  },
  swipeText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  // Set tracking bar styles
  setTrackingContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  setTrackingBar: {
    alignItems: 'center',
  },
  setTrackingProgress: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  setTrackingFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  setTrackingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  // Running session header styles
  runningHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(230, 240, 255, 0.3)',
    borderRadius: 12,
    marginBottom: 20,
  },
  runningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  runningDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  // Web map fallback styles
  webMapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  webMapSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  webMapStats: {
    alignItems: 'center',
  },
  webMapStat: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Colors.spacing.xl,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginTop: Colors.spacing.lg,
    marginBottom: Colors.spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Colors.spacing.xl,
  },
  permissionIcon: {
    marginBottom: 16,
    alignSelf: 'center',
  },
  permissionFeatures: {
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  permissionFeature: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
  const { addCompletedWorkout, saveWorkouts } = useWorkoutStore();
  const { addExp } = useExpStore();
  const { user } = useUserStore();
  const workoutStartRef = useRef(new Date().toISOString());
  const { isConnected: spotifyConnected, currentTrack, playTrack, pauseTrack, nextTrack, previousTrack, playbackState, connectSpotifyImplicit } = useSpotifyStore();
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useExpStore } from '@/store/expStore';
import { useUserStore } from '@/store/userStore';
import { useSpotifyStore } from '@/store/spotifyStore';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{error?.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/* ── Placeholder exercise data ── */
// TODO: Connect to real workout API / exerciseStore

const INITIAL_EXERCISES = [
  { id: 'e1', name: 'Mountain Climber', seconds: 50, icon: 'body-outline' },
  { id: 'e2', name: 'Sit Up', seconds: 68, icon: 'body-outline' },
  { id: 'e3', name: 'Burpees', seconds: 45, icon: 'body-outline' },
  { id: 'e4', name: 'Jump Squat', seconds: 60, icon: 'body-outline' },
  { id: 'e5', name: 'Plank', seconds: 30, icon: 'body-outline' },
  { id: 'e6', name: 'Lunges', seconds: 50, icon: 'body-outline' },
  { id: 'e7', name: 'Push Ups', seconds: 45, icon: 'body-outline' },
  { id: 'e8', name: 'High Knees', seconds: 60, icon: 'body-outline' },
];

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ── Next-move card ── */

function NextMoveCard({ exercise, onPress }) {
  return (
    <Pressable style={styles.nextCard} onPress={onPress}>
      <View style={styles.nextCardThumb}>
        <Ionicons name={exercise.icon} size={28} color="#999" />
        <View style={styles.nextCardPlay}>
          <Ionicons name="play" size={14} color="#FFF" />
        </View>
      </View>
      <Text style={styles.nextCardName} numberOfLines={1}>
        {exercise.name}
      </Text>
      <Text style={styles.nextCardDuration}>
        {formatTime(exercise.seconds)}
      </Text>
    </Pressable>
  );
}

/* ── Popup menu option ── */

function MenuOption({ icon, label, onPress, danger }) {
  return (
    <Pressable style={styles.menuOption} onPress={onPress}>
      <Ionicons
        name={icon}
        size={20}
        color={danger ? '#FF3B30' : '#000'}
        style={{ marginRight: 12 }}
      />
      <Text
        style={[styles.menuOptionText, danger && { color: '#FF3B30' }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ── Main screen ── */

export default function ActiveWorkoutScreen() {
  const router = useRouter();

  const [exercises] = useState(INITIAL_EXERCISES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSet, setCompletedSet] = useState(new Set());
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeLeft, setTimeLeft] = useState(INITIAL_EXERCISES[0].seconds);
  const [exerciseComplete, setExerciseComplete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const timerRef = useRef(null);
  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;

  /* ── Progress tracking ── */
  const completedCount = completedSet.size;

  /* ── Timer ── */
  useEffect(() => {
    if (isPlaying && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, timeLeft]);

  /* When timer hits 0: mark complete but do NOT auto-advance */
  useEffect(() => {
    if (timeLeft === 0 && isPlaying) {
      setIsPlaying(false);
      setExerciseComplete(true);
      setCompletedSet((prev) => new Set(prev).add(currentExercise.id));
    }
  }, [timeLeft, isPlaying]);

  const togglePlayPause = useCallback(() => {
    if (exerciseComplete) return;
    setIsPlaying((p) => !p);
  }, [exerciseComplete]);

  /* Advance to next exercise */
  const advanceToNext = useCallback(() => {
    if (currentIndex < totalExercises - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(exercises[nextIdx].seconds);
      setExerciseComplete(false);
      setIsPlaying(true);
    }
  }, [currentIndex, totalExercises, exercises]);

  /* Skip back */
  const skipBack = useCallback(() => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setTimeLeft(exercises[prevIdx].seconds);
      setExerciseComplete(false);
      setIsPlaying(true);
    }
  }, [currentIndex, exercises]);

  /* Skip forward (mark complete and advance) */
  const skipForward = useCallback(() => {
    setCompletedSet((prev) => new Set(prev).add(currentExercise.id));
    if (currentIndex < totalExercises - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setTimeLeft(exercises[nextIdx].seconds);
      setExerciseComplete(false);
      setIsPlaying(true);
    } else {
      setExerciseComplete(true);
      setIsPlaying(false);
    }
  }, [currentIndex, totalExercises, exercises, currentExercise]);

  /* Center button handler */
  const handleCenterButton = useCallback(() => {
    if (exerciseComplete) {
      advanceToNext();
    } else {
      setIsPlaying((p) => !p);
    }
  }, [exerciseComplete, advanceToNext]);

  const jumpToExercise = useCallback(
    (idx) => {
      setCurrentIndex(idx);
      setTimeLeft(exercises[idx].seconds);
      setExerciseComplete(false);
      setIsPlaying(true);
    },
    [exercises],
  );

  const progressPercent =
    currentExercise.seconds > 0
      ? ((currentExercise.seconds - timeLeft) / currentExercise.seconds) * 100
      : 0;

  const overallProgressPercent =
    totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0;

  /* ── Upcoming exercises ── */
  const upcomingExercises = exercises.slice(currentIndex + 1);

  /* ── Center button icon ── */
  const centerIcon = useMemo(() => {
    if (exerciseComplete) return 'play-forward';
    if (isPlaying) return 'pause';
    return 'play';
  }, [exerciseComplete, isPlaying]);

  /* ── Exit handlers ── */
  const handleSaveAndExit = () => {
    setShowExitConfirm(false);
    // TODO: persist completion state to store
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/workouts');
    }
  };

  const handleDiscardAndExit = () => {
    setShowExitConfirm(false);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/workouts');
    }
  };

  const isLastExercise = currentIndex === totalExercises - 1;
  const isWorkoutDone = isLastExercise && exerciseComplete;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              setIsPlaying(false);
              setShowExitConfirm(true);
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#000" />
          </Pressable>
          <Pressable onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
          </Pressable>
        </View>

        {/* ── Exercise title ── */}
        <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>

        {/* ── Video / demo area ── */}
        <View style={styles.videoArea}>
          <Ionicons name="body-outline" size={80} color="#666" />

          {/* Fullscreen button */}
          <Pressable style={styles.fullscreenBtn}>
            <Ionicons name="expand-outline" size={20} color="#FFF" />
          </Pressable>

          {/* Playback progress + timer overlay */}
          <View style={styles.playbackControls}>
            <View style={styles.playbackBarBg}>
              <View
                style={[
                  styles.playbackBarFill,
                  { width: progressPercent + '%' },
                ]}
              />
            </View>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
        </View>

        {/* ── Exercise progress bar ── */}
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Exercise Progress</Text>
            <Text style={styles.progressCount}>
              {completedCount}/{totalExercises}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: overallProgressPercent + '%' },
              ]}
            />
          </View>
        </View>

        {/* ── Next moves ── */}
        <View style={styles.nextMovesHeader}>
          <Text style={styles.nextMovesTitle}>Next Moves</Text>
          <Text style={styles.nextMovesCount}>
            {currentIndex + 1}/{totalExercises}
          </Text>
        </View>

        {upcomingExercises.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nextMovesCarousel}
          >
            {upcomingExercises.map((ex, idx) => (
              <NextMoveCard
                key={ex.id}
                exercise={ex}
                onPress={() => jumpToExercise(currentIndex + 1 + idx)}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.allDoneRow}>
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <Text style={styles.allDoneText}>Last exercise!</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Floating control pill ── */}
      <View style={styles.floatingControlsWrapper}>
        <View style={styles.floatingPill}>
          {/* Skip back */}
          <Pressable
            style={styles.skipBtn}
            onPress={skipBack}
            disabled={currentIndex === 0}
          >
            <Ionicons
              name="play-back"
              size={20}
              color={currentIndex === 0 ? 'rgba(255,255,255,0.3)' : '#FFF'}
            />
          </Pressable>

          {/* Center play/pause/advance */}
          <Pressable
            style={[
              styles.centerBtn,
              isWorkoutDone && { backgroundColor: '#22C55E' },
            ]}
            onPress={isWorkoutDone ? () => {
              const totalSeconds = INITIAL_EXERCISES.reduce((s, e) => s + e.seconds, 0);
              const caloriesBurned = Math.round(totalSeconds * 0.15);
              addCompletedWorkout({
                name: 'Workout',
                duration: totalSeconds,
                exercisesCompleted: INITIAL_EXERCISES.length,
                totalExercises: INITIAL_EXERCISES.length,
                caloriesBurned,
                xpEarned: 100,
                completedAt: new Date().toISOString(),
                startedAt: workoutStartRef.current,
              });
              saveWorkouts(user?.uid);
              if (addExp) addExp(100, 'workout');
              router.replace('/workout/complete');
            } : handleCenterButton}
          >
            <Ionicons
              name={isWorkoutDone ? 'checkmark' : centerIcon}
              size={26}
              color={isWorkoutDone ? '#FFF' : '#000'}
            />
          </Pressable>

          {/* Skip forward */}
          <Pressable
            style={styles.skipBtn}
            onPress={skipForward}
            disabled={isWorkoutDone}
          >
            <Ionicons
              name="play-forward"
              size={20}
              color={isWorkoutDone ? 'rgba(255,255,255,0.3)' : '#FFF'}
            />
          </Pressable>
        </View>
      </View>

      {/* ── Three-dot popup menu ── */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuCard}>
            <MenuOption
              icon="musical-notes-outline"
              label="Music"
              onPress={() => {
                setShowMenu(false);
                setShowMusicPlayer(true); setShowMenu(false);
              }}
            />
            <MenuOption
              icon="pause-circle-outline"
              label="Pause Workout"
              onPress={() => {
                setIsPlaying(false);
                setShowMenu(false);
              }}
            />
            <MenuOption
              icon="exit-outline"
              label="Exit Workout"
              danger
              onPress={() => {
                setShowMenu(false);
                setIsPlaying(false);
                setShowExitConfirm(true);
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* ── Exit confirmation modal ── */}
      <Modal
        visible={showExitConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExitConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Exit Workout?</Text>
            <Text style={styles.confirmSubtitle}>
              Would you like to save your progress?
            </Text>

            <Pressable style={styles.confirmSaveBtn} onPress={handleSaveAndExit}>
              <Text style={styles.confirmSaveBtnText}>Save Progress</Text>
            </Pressable>

            <Pressable
              style={styles.confirmDiscardBtn}
              onPress={handleDiscardAndExit}
            >
              <Text style={styles.confirmDiscardBtnText}>Discard Workout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    
      {/* Spotify Mini Player */}
      <Modal visible={showMusicPlayer} transparent animationType="slide" onRequestClose={() => setShowMusicPlayer(false)}>
        <Pressable style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}} onPress={() => setShowMusicPlayer(false)}>
          <Pressable style={{backgroundColor:'#1A1A1A',borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:40}} onPress={() => {}}>
            <View style={{width:40,height:4,borderRadius:2,backgroundColor:'#444',alignSelf:'center',marginBottom:20}} />
            {spotifyConnected ? (
              <>
                <Text style={{fontSize:18,fontWeight:'800',color:'#FFF',textAlign:'center',marginBottom:4}}>
                  {currentTrack?.name || 'No Track Playing'}
                </Text>
                <Text style={{fontSize:13,color:'#999',textAlign:'center',marginBottom:24}}>
                  {currentTrack?.artists?.[0]?.name || 'Unknown Artist'}
                </Text>
                <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:32}}>
                  <Pressable onPress={previousTrack}><Ionicons name="play-skip-back" size={28} color="#FFF" /></Pressable>
                  <Pressable onPress={() => playbackState?.is_playing ? pauseTrack() : playTrack()} style={{width:60,height:60,borderRadius:30,backgroundColor:'#1DB954',justifyContent:'center',alignItems:'center'}}>
                    <Ionicons name={playbackState?.is_playing ? 'pause' : 'play'} size={28} color="#FFF" />
                  </Pressable>
                  <Pressable onPress={nextTrack}><Ionicons name="play-skip-forward" size={28} color="#FFF" /></Pressable>
                </View>
              </>
            ) : (
              <View style={{alignItems:'center'}}>
                <Ionicons name="musical-notes" size={40} color="#1DB954" style={{marginBottom:16}} />
                <Text style={{fontSize:16,fontWeight:'700',color:'#FFF',marginBottom:8}}>Connect Spotify</Text>
                <Text style={{fontSize:13,color:'#999',marginBottom:20,textAlign:'center'}}>Link your Spotify account to control music during workouts</Text>
                <Pressable onPress={() => connectSpotifyImplicit()} style={{backgroundColor:'#1DB954',paddingHorizontal:32,paddingVertical:14,borderRadius:24}}>
                  <Text style={{fontSize:15,fontWeight:'700',color:'#FFF'}}>Connect</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    marginBottom: 8,
  },

  /* Exercise title */
  exerciseTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  /* Video area — CHANGE 1: taller */
  videoArea: {
    marginHorizontal: 16,
    height: 380,
    borderRadius: 16,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullscreenBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackControls: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playbackBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  playbackBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  timerText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    minWidth: 38,
    textAlign: 'right',
  },

  /* CHANGE 3: Progress bar */
  progressSection: {
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  progressCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000',
  },

  /* Next moves */
  nextMovesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  nextMovesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  nextMovesCount: {
    fontSize: 14,
    color: '#666',
  },
  nextMovesCarousel: {
    paddingLeft: 20,
    paddingRight: 6,
  },
  /* CHANGE 2: bigger cards */
  nextCard: {
    width: 170,
    marginRight: 14,
  },
  nextCardThumb: {
    height: 110,
    borderRadius: 12,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  nextCardPlay: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 6,
  },
  nextCardDuration: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  allDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  allDoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22C55E',
  },

  /* CHANGE 4: Floating control pill */
  floatingControlsWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  floatingPill: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -2 },
      },
      android: { elevation: 8 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -2 },
      },
    }),
  },
  skipBtn: {
    padding: 8,
  },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Popup menu */
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 90 : 80,
    paddingRight: 16,
  },
  menuCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 8,
    width: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 8 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },

  /* Exit confirmation */
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 12 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 20,
  },
  confirmSaveBtn: {
    backgroundColor: '#000',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmSaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmDiscardBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDiscardBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
  },
});

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useExpStore } from '@/store/expStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useAchievementStore } from '@/store/achievementStore';
import { useLeaderboardStore } from '@/store/leaderboardStore';
import { useUserStore } from '@/store/userStore';
import { useSpotifyStore } from '@/store/spotifyStore';

// Real workouts don't always carry an explicit hold-time per exercise (strength
// moves are sets x reps, performed at the user's own pace) — this estimates a
// reasonable on-screen timer duration from whatever the workout actually
// specifies, instead of a fixed placeholder list.
function estimateExerciseSeconds(exercise) {
  if (typeof exercise?.duration === 'number' && exercise.duration > 0) {
    return exercise.duration;
  }
  if (exercise?.sets && exercise?.reps) {
    return Math.max(20, Math.round(exercise.sets * exercise.reps * 3));
  }
  return 45;
}

// Maps a workout exercise's display name to one of the three exercise keys
// services/formAnalysisService.js has real angle-based analysis for, so the
// "Check my form" entry point only appears when it can actually say
// something useful — not for exercises it would just show a generic
// "tracking active" message for.
function matchFormCheckExercise(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('squat')) return 'squat';
  if (n.includes('push')) return 'pushup';
  if (n.includes('curl')) return 'bicepCurl';
  return null;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* Ã¢ÂÂÃ¢ÂÂ Next-move card Ã¢ÂÂÃ¢ÂÂ */

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

/* Ã¢ÂÂÃ¢ÂÂ Popup menu option Ã¢ÂÂÃ¢ÂÂ */

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

/* Ã¢ÂÂÃ¢ÂÂ Main screen Ã¢ÂÂÃ¢ÂÂ */

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const workoutId = typeof params.id === 'string' ? params.id : '';

  const { workouts, customWorkouts, addCompletedWorkout } = useWorkoutStore();
  const { addExpActivity, totalExp, level } = useExpStore();
  const { unlockBadge } = useBadgeStore();
  const { checkAchievements } = useAchievementStore();
  const { user } = useUserStore();
  const workoutStartRef = useRef(new Date().toISOString());
  const { isConnected: spotifyConnected, currentTrack, playTrack, pauseTrack, nextTrack, previousTrack, playbackState, connectSpotifyImplicit } = useSpotifyStore();
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);

  const selectedWorkout = useMemo(
    () => [...workouts, ...customWorkouts].find((w) => String(w.id) === workoutId) || null,
    [workouts, customWorkouts, workoutId]
  );

  const [exercises] = useState(() => {
    const source = selectedWorkout?.exercises || [];
    return source.map((ex, i) => ({
      id: ex.id ?? `ex-${i}`,
      name: ex.name,
      seconds: estimateExerciseSeconds(ex),
      icon: 'body-outline',
      sets: ex.sets,
      reps: ex.reps,
    }));
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSet, setCompletedSet] = useState(new Set());
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeLeft, setTimeLeft] = useState(exercises[0]?.seconds ?? 45);
  const [exerciseComplete, setExerciseComplete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const timerRef = useRef(null);
  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;

  /* Ã¢ÂÂÃ¢ÂÂ Progress tracking Ã¢ÂÂÃ¢ÂÂ */
  const completedCount = completedSet.size;

  /* Ã¢ÂÂÃ¢ÂÂ Timer Ã¢ÂÂÃ¢ÂÂ */
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
    currentExercise && currentExercise.seconds > 0
      ? ((currentExercise.seconds - timeLeft) / currentExercise.seconds) * 100
      : 0;

  const overallProgressPercent =
    totalExercises > 0 ? (completedCount / totalExercises) * 100 : 0;

  /* Ã¢ÂÂÃ¢ÂÂ Upcoming exercises Ã¢ÂÂÃ¢ÂÂ */
  const upcomingExercises = exercises.slice(currentIndex + 1);

  /* Ã¢ÂÂÃ¢ÂÂ Center button icon Ã¢ÂÂÃ¢ÂÂ */
  const centerIcon = useMemo(() => {
    if (exerciseComplete) return 'play-forward';
    if (isPlaying) return 'pause';
    return 'play';
  }, [exerciseComplete, isPlaying]);

  /* Ã¢ÂÂÃ¢ÂÂ Exit handlers Ã¢ÂÂÃ¢ÂÂ */
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

  if (totalExercises === 0) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
        <Ionicons name="alert-circle-outline" size={40} color="#999" />
        <Text style={{ color: '#FFF', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {selectedWorkout
            ? "This workout doesn't have any exercises yet."
            : "We couldn't find that workout."}
        </Text>
        <Pressable
          style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, backgroundColor: '#FFF' }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/workouts'))}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ã¢ÂÂÃ¢ÂÂ Header Ã¢ÂÂÃ¢ÂÂ */}
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

        {/* Ã¢ÂÂÃ¢ÂÂ Exercise title Ã¢ÂÂÃ¢ÂÂ */}
        <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>
        {matchFormCheckExercise(currentExercise.name) && (
          <Pressable
            style={styles.formCheckLink}
            onPress={() => router.push(`/workout/form-check?exercise=${matchFormCheckExercise(currentExercise.name)}`)}
          >
            <Ionicons name="camera-outline" size={14} color="#FFF" />
            <Text style={styles.formCheckLinkText}>Check my form</Text>
          </Pressable>
        )}


        {/* Ã¢ÂÂÃ¢ÂÂ Video / demo area Ã¢ÂÂÃ¢ÂÂ */}
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

        {/* Ã¢ÂÂÃ¢ÂÂ Exercise progress bar Ã¢ÂÂÃ¢ÂÂ */}
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

        {/* Ã¢ÂÂÃ¢ÂÂ Next moves Ã¢ÂÂÃ¢ÂÂ */}
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

      {/* Ã¢ÂÂÃ¢ÂÂ Floating control pill Ã¢ÂÂÃ¢ÂÂ */}
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
            onPress={isWorkoutDone ? async () => {
              const elapsedSeconds = Math.max(
                1,
                Math.round((Date.now() - new Date(workoutStartRef.current).getTime()) / 1000)
              );
              const completionRatio = totalExercises > 0 ? completedCount / totalExercises : 1;
              const caloriesBurned = Math.round(
                (selectedWorkout?.calories ?? Math.round(elapsedSeconds * 0.15)) * completionRatio
              );
              const xpEarned = selectedWorkout?.xpReward ?? 100;

              await addCompletedWorkout({
                workoutId: selectedWorkout?.id ?? null,
                name: selectedWorkout?.name || 'Workout',
                category: selectedWorkout?.category,
                difficulty: selectedWorkout?.difficulty,
                exercises: exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps })),
                duration: elapsedSeconds,
                exercisesCompleted: completedCount,
                totalExercises,
                caloriesBurned,
                xpEarned,
                completedAt: new Date().toISOString(),
                startedAt: workoutStartRef.current,
              }, user?.uid);

              // Real trigger for the "First Workout" badge — checks the
              // actual completed-workout count rather than assuming.
              // Previously this badge (and "Nutrition Novice") were simply
              // hardcoded to isUnlocked:true for every user regardless of
              // whether they'd done anything; unlockBadge is never called
              // from anywhere else in the app for it, so simply removing
              // the fabrication would have left it permanently unearnable.
              if ((useWorkoutStore.getState().completedWorkouts || []).length <= 1) {
                unlockBadge?.('badge-1', user?.uid);
              }

              // Real trigger for store/achievementStore.js — a well-designed
              // condition-evaluation engine (checks workout_count, streak,
              // calories_burned, level, xp, etc.) that, like the badge
              // unlock above, was built but never actually called from
              // anywhere in the app. Feeds it genuine stats rather than
              // assuming any of these condition types are met.
              checkAchievements?.({
                workoutsCompleted: (useWorkoutStore.getState().completedWorkouts || []).length,
                streak: user?.streak ?? 0,
                caloriesBurned,
                level,
                xp: totalExp,
              }, user?.uid);

              addExpActivity?.({
                id: Date.now().toString(),
                type: 'workout',
                baseExp: xpEarned,
                multiplier: 1.0,
                date: new Date().toISOString().split('T')[0],
                description: `Completed ${selectedWorkout?.name || 'workout'}`,
                completed: true,
              });

              // Public leaderboard sync (store/leaderboardStore.js) — reads
              // useExpStore.getState() directly rather than the totalExp/
              // level values already destructured above, since those are a
              // snapshot from this render and won't reflect the XP just
              // awarded by addExpActivity a moment ago.
              if (user?.uid) {
                const freshExp = useExpStore.getState();
                useLeaderboardStore.getState()._syncLeaderboardEntry(user.uid, {
                  name: user?.name,
                  avatar: user?.profileImage,
                  xp: freshExp.totalExp,
                  level: freshExp.level,
                  streak: user?.streak,
                });
              }

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

      {/* Ã¢ÂÂÃ¢ÂÂ Three-dot popup menu Ã¢ÂÂÃ¢ÂÂ */}
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

      {/* Ã¢ÂÂÃ¢ÂÂ Exit confirmation modal Ã¢ÂÂÃ¢ÂÂ */}
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

/* Ã¢ÂÂÃ¢ÂÂ Styles Ã¢ÂÂÃ¢ÂÂ */

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

  formCheckLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginHorizontal: 20,
    marginTop: -8,
    marginBottom: 16,
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  formCheckLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  /* Video area Ã¢ÂÂ CHANGE 1: taller */
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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
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
import { searchAscendExercise, extractExerciseMediaUrl } from '@/services/exerciseDbService';
import { getProgram, getProgramWeek } from '@/data/workoutPrograms';
import { isBodyweightExercise } from '@/services/exerciseDbService';
import { getNextPrescription } from '@/services/progressiveOverloadService';
import { getCurrentReadiness } from '@/services/wearableService';

// Real workouts don't always carry an explicit hold-time per exercise (strength
// moves are sets x reps, performed at the user's own pace) — this estimates a
// reasonable on-screen timer duration from whatever the workout actually
// specifies, instead of a fixed placeholder list.
// Real fix: reps isn't always a single number - data/workoutPrograms.js's
// progressive-overload phases store it as a range string like "8-10" (see
// PROGRESSION_PHASES there), and exercise.sets * exercise.reps * 3 on a
// string like that produces NaN, which formatTime below then displays
// as the literal text "NaN:NaN". parseNumericReps handles both a plain
// number and a "X-Y" range (averaged) so this works for every reps shape
// currently used anywhere reachable from this screen.
function parseNumericReps(reps) {
  if (typeof reps === 'number') return reps;
  if (typeof reps === 'string') {
    const nums = reps.match(/\d+/g);
    if (nums && nums.length > 0) {
      const parsed = nums.map(Number);
      return parsed.reduce((sum, n) => sum + n, 0) / parsed.length;
    }
  }
  return null;
}

// Real, new: for "Log Your Sets"'s reps placeholder specifically - a
// single, real starting number ("8"), not the range string itself
// ("8-10") and not parseNumericReps' averaged estimate (which would
// give a slightly-off "9" here). The lower bound, not the upper, since
// this is only ever shown before any real prescription exists for this
// exercise (see where it's used below) - a conservative starting point
// to climb from, consistent with how
// services/progressiveOverloadService.js's own double progression
// always starts at the bottom of a rep range and works up, not the
// reverse.
function parseRepsLowerBound(reps) {
  if (typeof reps === 'number') return reps;
  if (typeof reps === 'string') {
    const match = reps.match(/\d+/);
    if (match) return Number(match[0]);
  }
  return null;
}

function estimateExerciseSeconds(exercise) {
  if (typeof exercise?.duration === 'number' && exercise.duration > 0) {
    return exercise.duration;
  }
  const numericReps = parseNumericReps(exercise?.reps);
  if (exercise?.sets && numericReps) {
    return Math.max(20, Math.round(exercise.sets * numericReps * 3));
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

  // Real, new: this screen now also launches a specific day within a
  // workout program (from app/workout/program/session/[id].jsx's Start
  // Session button), not just a saved workout template. Mirrors how
  // app/running/active.jsx already accepts programId/week/session
  // params for running programs, rather than going through a generic
  // template lookup.
  const programId = typeof params.programId === 'string' ? params.programId : '';
  const programWeekParam = typeof params.week === 'string' ? parseInt(params.week, 10) : null;
  const programDayIndexParam = typeof params.dayIndex === 'string' ? parseInt(params.dayIndex, 10) : null;
  const isProgramSession = !!programId && programWeekParam != null && programDayIndexParam != null;
  const program = isProgramSession ? getProgram(programId) : null;
  const programDay = isProgramSession ? getProgramWeek(programId, programWeekParam)?.days[programDayIndexParam] : null;

  const { workouts, customWorkouts, addCompletedWorkout, logSet, getExerciseHistory } = useWorkoutStore();
  const { addExpActivity, expSystem } = useExpStore();
  const totalExp = expSystem.totalExp;
  const level = expSystem.level;
  const { unlockBadge } = useBadgeStore();
  const { checkAchievements } = useAchievementStore();
  const { user } = useUserStore();
  const workoutStartRef = useRef(new Date().toISOString());
  const { isConnected: spotifyConnected, currentTrack, playTrack, pauseTrack, nextTrack, previousTrack, playbackState, connectSpotifyImplicit } = useSpotifyStore();
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);

  const selectedWorkout = useMemo(
    () => isProgramSession ? null : [...workouts, ...customWorkouts].find((w) => String(w.id) === workoutId) || null,
    [workouts, customWorkouts, workoutId, isProgramSession]
  );

  const [exercises] = useState(() => {
    const source = isProgramSession ? (programDay?.exercises || []) : (selectedWorkout?.exercises || []);
    return source.map((ex, i) => ({
      id: ex.id ?? `ex-${i}`,
      name: ex.name,
      seconds: estimateExerciseSeconds(ex),
      icon: 'body-outline',
      sets: ex.sets,
      reps: ex.reps,
    }));
  });

  // Real, new: so a completed program-day session records a real name
  // ("Full Body Foundations - Day A") instead of falling back to the
  // generic "Workout" - selectedWorkout is null in program-session mode,
  // which previously would have meant exactly that generic fallback.
  const workoutDisplayName = isProgramSession
    ? `${program?.title || 'Program'} - ${programDay?.day || 'Day'}`
    : selectedWorkout?.name || 'Workout';
  // Real, new: resumes from where the user left off if this workout was
  // previously saved-and-exited (see handleSaveAndExit's
  // saveWorkoutProgress call and store/workoutStore.js's inProgress
  // state) - previously currentIndex/completedSet always started fresh
  // regardless, so tapping "Continue Workout" from the detail screen
  // (which correctly showed the saved progress) still dropped the user
  // back at exercise 1 with an empty progress bar. Read once via
  // getState() rather than the reactive hook, since this only needs to
  // run at mount time for these lazy initializers.
  const savedIndices = useWorkoutStore.getState().inProgress?.[workoutId]?.completedIndices || [];
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (savedIndices.length === 0) return 0;
    const firstIncomplete = exercises.findIndex((_, i) => !savedIndices.includes(i));
    return firstIncomplete >= 0 ? firstIncomplete : Math.max(0, exercises.length - 1);
  });
  const [completedSet, setCompletedSet] = useState(() =>
    new Set(savedIndices.map((i) => exercises[i]?.id).filter(Boolean))
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeLeft, setTimeLeft] = useState(() => exercises[currentIndex]?.seconds ?? 45);
  const [exerciseComplete, setExerciseComplete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Real, new: real per-set weight/reps logging, feeding
  // services/progressiveOverloadService.js real data instead of just
  // the workout template's planned targets. Keyed by exercise id (not
  // just "the current exercise") so logged sets and in-progress typing
  // survive navigating back to an earlier exercise via
  // jumpToExercise/previous. loggedSetsByExercise holds sets already
  // logged+persisted this session; setInputs holds the still-being-typed
  // weight/reps for a not-yet-logged set, keyed by `${exerciseId}-${setIndex}`.
  const [loggedSetsByExercise, setLoggedSetsByExercise] = useState({});
  const [setInputs, setSetInputs] = useState({});
  const [loggingSetKey, setLoggingSetKey] = useState(null);

  // Real, new: the actual "adaptive" piece - once real logged history
  // exists for an exercise, fetches it plus today's real wearable
  // readiness and runs it through
  // services/progressiveOverloadService.js's getNextPrescription, so
  // "your target today" reflects both past performance and how
  // recovered the user actually is right now, not just a fixed
  // rep/set target. Keyed by exercise id so switching exercises and
  // back doesn't lose what was already fetched.
  const [prescriptions, setPrescriptions] = useState({});

  const timerRef = useRef(null);
  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;

  /* Demo video lookup, real per-exercise search against AscendAPI,
     only for whichever exercise is on screen right now (not the whole
     upcoming list) to keep API calls to a minimum on a free-tier key.
     Cached by exercise id in a ref so skipping back to an exercise
     already checked this session doesn't refetch it. */
  const [videoUrls, setVideoUrls] = useState({});
  const [videoLoadingId, setVideoLoadingId] = useState(null);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const checkedVideoIdsRef = useRef(new Set());

  useEffect(() => {
    const ex = exercises[currentIndex];
    if (!ex || checkedVideoIdsRef.current.has(ex.id)) return;
    checkedVideoIdsRef.current.add(ex.id);
    let cancelled = false;
    setVideoLoadingId(ex.id);
    (async () => {
      let url = null;
      try {
        const record = await searchAscendExercise(ex.name);
        url = extractExerciseMediaUrl(record);
      } catch (e) {
        console.warn('[ActiveWorkout] exercise video lookup failed:', ex.name, e?.message);
      }
      if (!cancelled) {
        setVideoUrls((prev) => ({ ...prev, [ex.id]: url }));
        setVideoLoadingId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentIndex, exercises]);

  const currentVideoUrl = currentExercise ? videoUrls[currentExercise.id] : null;
  const isCurrentVideoLoading = currentExercise ? videoLoadingId === currentExercise.id : false;

  // Small helper so the two TextInputs in each unlogged set row don't
  // each need their own inline setSetInputs callback.
  const updateSetInput = (exerciseId, setIndex, field, value) => {
    const key = `${exerciseId}-${setIndex}`;
    setSetInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  // Real, new: fetches this exercise's real logged history plus
  // today's real wearable readiness, then computes the actual next
  // prescription - the piece that makes progressive overload adaptive
  // rather than just logged. Only for strength exercises (same
  // sets/reps check as "Log Your Sets" itself), and only once per
  // exercise per this workout session: the prescription is derived
  // from the last PAST session's history, which doesn't change as the
  // user logs sets for THIS session, so there's nothing to re-fetch
  // for until their next visit to this exercise on a different day.
  useEffect(() => {
    if (!currentExercise?.sets || !currentExercise?.reps || !user?.uid) return;
    if (prescriptions[currentExercise.id] !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const [history, readiness] = await Promise.all([
          getExerciseHistory(currentExercise.name, user.uid),
          getCurrentReadiness(),
        ]);
        if (cancelled) return;
        const prescription = getNextPrescription(history, { readiness });
        setPrescriptions((prev) => ({ ...prev, [currentExercise.id]: prescription }));
      } catch (e) {
        console.warn('[ActiveWorkout] prescription fetch failed:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [currentExercise?.id, user?.uid]);

  /* Real form-check matching: form-check.jsx only has pose-detection
     rules built for squat/pushup/bicepCurl (see its EXERCISES const),
     not an arbitrary exercise name, so this maps a generated name to
     one of those three real ids and returns null for anything else.
     The button below only renders when this resolves to a real id,
     rather than linking to a check that would silently run against
     the wrong movement. */
  const formCheckExerciseId = useMemo(() => {
    const normalized = (currentExercise?.name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!normalized) return null;
    if (normalized.includes('squat')) return 'squat';
    if (normalized.includes('pushup')) return 'pushup';
    if (normalized.includes('bicepcurl') || normalized.includes('curl')) return 'bicepCurl';
    return null;
  }, [currentExercise]);

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
  // Real, new: logs one set's real weight/reps/rpe, both to local state
  // (so the UI switches that row from input to completed) and to
  // Firestore via workoutStore's logSet, which is the actual data
  // services/progressiveOverloadService.js runs on. rpe comes from
  // whichever of the three Easy/Moderate/Hard buttons was tapped -
  // tapping one submits the set, there's no separate save step.
  const handleLogSet = async (exercise, setIndex, rpe) => {
    const inputKey = `${exercise.id}-${setIndex}`;
    const input = setInputs[inputKey];
    const isBodyweight = isBodyweightExercise(exercise.name);
    // Real, new: falls back to the real prescription
    // (services/progressiveOverloadService.js's actual output for this
    // exercise) when the user never touched the input - which is now
    // the common case, since the fields visually start pre-filled with
    // this exact value (see the render logic above). ?? specifically
    // (not ||) so a field the user deliberately cleared (an empty
    // string, still a real value) isn't silently overwritten by the
    // prescription - only a genuinely untouched field (undefined) falls
    // back.
    const prescription = prescriptions[exercise.id];
    const weightSource = input?.weight ?? (prescription ? String(prescription.weight) : undefined);
    const repsSource = input?.reps ?? (prescription ? String(prescription.targetReps) : undefined);
    const weight = isBodyweight ? 0 : parseFloat(weightSource);
    const reps = parseInt(repsSource, 10);
    if ((!isBodyweight && (!weight || weight <= 0)) || !reps || reps <= 0) return;

    setLoggingSetKey(inputKey);
    try {
      await logSet(exercise.name, weight, reps, rpe, workoutId, user?.uid);
      setLoggedSetsByExercise((prev) => ({
        ...prev,
        [exercise.id]: [...(prev[exercise.id] || []), { weight, reps, rpe, isBodyweight }],
      }));
    } finally {
      setLoggingSetKey(null);
    }
  };

  const centerIcon = useMemo(() => {
    if (exerciseComplete) return 'play-forward';
    if (isPlaying) return 'pause';
    return 'play';
  }, [exerciseComplete, isPlaying]);

  /* Ã¢ÂÂÃ¢ÂÂ Exit handlers Ã¢ÂÂÃ¢ÂÂ */
  const handleSaveAndExit = async () => {
    setShowExitConfirm(false);

    // Real fix: previously this saved nothing at all, just navigated
    // back. Reuses the exact same addCompletedWorkout call/shape the
    // normal "finish workout" button already uses below (see the
    // isWorkoutDone block) - triggered here instead with whatever
    // progress actually exists at the moment of exit. Only saves if at
    // least one exercise was actually completed - a 0-exercise workout
    // entry isn't a meaningful history record worth cluttering the log
    // with, so an immediate exit behaves the same as Discard.
    if (completedCount > 0) {
      // Real, new: persists which exercise indices are done, keyed by
      // this workout template's id, so app/workout/[id].jsx can show
      // real "X/4 moves" progress and a "Continue Workout" option
      // instead of always resetting to 0/4 - the addCompletedWorkout
      // call below logs a history record for stats/XP, which is a
      // separate concern from this resumable, per-template state.
      const completedIndices = exercises
        .map((e, i) => (completedSet.has(e.id) ? i : null))
        .filter((i) => i !== null);
      if (selectedWorkout?.id) {
        await useWorkoutStore.getState().saveWorkoutProgress(selectedWorkout.id, completedIndices, user?.uid);
      }

      const elapsedSeconds = Math.max(
        1,
        Math.round((Date.now() - new Date(workoutStartRef.current).getTime()) / 1000)
      );
      const completionRatio = totalExercises > 0 ? completedCount / totalExercises : 1;
      const caloriesBurned = Math.round(
        (selectedWorkout?.calories ?? Math.round(elapsedSeconds * 0.15)) * completionRatio
      );
      // Real fix, distinct from the existing full-completion path below:
      // that path never scales xpEarned by completionRatio (only
      // calories are) - but it never mattered there, since
      // completionRatio is always 1 by the time that path is reachable
      // (every exercise must be done to get there). Here,
      // completionRatio can genuinely be less than 1, so xp is scaled
      // too - awarding full xp for a partial workout would be
      // inconsistent with how calories already work here, and
      // exploitable (exit after one exercise, still earn the full
      // reward every time).
      const xpEarned = Math.round((selectedWorkout?.xpReward ?? 100) * completionRatio);

      await addCompletedWorkout({
        workoutId: selectedWorkout?.id ?? null,
        name: workoutDisplayName,
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
        // New field, not present on the normal full-completion path -
        // exercisesCompleted < totalExercises already implies this, but
        // an explicit flag is clearer for any future UI that lists
        // workout history and wants to show "partial" vs "completed".
        partial: true,
        // Real fix: without this, the store's addCompletedWorkout
        // forced completed:true on every Firestore write regardless of
        // what was passed here, so this partial save was
        // indistinguishable from a genuinely finished workout anywhere
        // that field is checked. Explicit false, not left to a default.
        completed: false,
      }, user?.uid);

      if ((useWorkoutStore.getState().completedWorkouts || []).length <= 1) {
        unlockBadge?.('badge-1', user?.uid);
      }

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
        description: `Saved ${completedCount}/${totalExercises} exercises of ${selectedWorkout?.name || 'workout'}`,
        completed: true,
      }, user?.uid);

      if (user?.uid) {
        const freshExp = useExpStore.getState();
        useLeaderboardStore.getState()._syncLeaderboardEntry(user.uid, {
          name: user?.name,
          avatar: user?.profileImage,
          xp: freshExp.expSystem.totalExp,
          level: freshExp.expSystem.level,
          streak: user?.streak,
        });
      }
    }

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
      {/* Header: back + three-dot menu. showMenu/setShowMenu and the
          Modal it opens already existed further down this file with no
          button anywhere that ever called setShowMenu(true), same for
          the exit-confirm flow this back button now opens instead of
          leaving the workout with no confirmation. */}
      <View style={styles.header}>
        <Pressable onPress={() => setShowExitConfirm(true)}>
          <Ionicons name="chevron-back" size={26} color="#000" />
        </Pressable>
        <Pressable onPress={() => setShowMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={22} color="#000" />
        </Pressable>
      </View>

      <Text style={styles.exerciseTitle}>{currentExercise?.name || 'Exercise'}</Text>

      {formCheckExerciseId && (
        <Pressable
          style={styles.formCheckLink}
          onPress={() => router.push(`/workout/form-check?exercise=${formCheckExerciseId}`)}
        >
          <Ionicons name="camera-outline" size={16} color="#FFF" />
          <Text style={styles.formCheckLinkText}>Check my form</Text>
        </Pressable>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Video / demo area */}
        <View style={styles.videoArea}>
          {currentVideoUrl ? (
            <Image
              source={{ uri: currentVideoUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              onError={(e) => console.warn('[ActiveWorkout] exercise image failed to load:', e?.nativeEvent)}
            />
          ) : (
            <Ionicons name="body-outline" size={80} color="#666" />
          )}

          {isCurrentVideoLoading && (
            <ActivityIndicator size="small" color="#FFF" style={styles.videoLoadingSpinner} />
          )}

          {/* Fullscreen button, only enabled once a real demo video is loaded */}
          <Pressable
            style={styles.fullscreenBtn}
            onPress={() => setShowFullscreenVideo(true)}
            disabled={!currentVideoUrl}
          >
            <Ionicons name="expand-outline" size={20} color={currentVideoUrl ? '#FFF' : 'rgba(255,255,255,0.4)'} />
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


        {/* Real, new: real weight/reps/rpe logging, strength exercises
            only - same sets && reps check estimateExerciseSeconds
            already uses to distinguish these from duration-based
            exercises. Feeds services/progressiveOverloadService.js. */}
        {currentExercise?.sets && currentExercise?.reps && (
          <View style={styles.setLogSection}>
            <Text style={styles.setLogTitle}>Log Your Sets</Text>
            {prescriptions[currentExercise.id] && (
              <View style={styles.prescriptionCard}>
                <Text style={styles.prescriptionTarget}>
                  {isBodyweightExercise(currentExercise.name)
                    ? `Today's target: ${prescriptions[currentExercise.id].targetReps} reps`
                    : `Today's target: ${prescriptions[currentExercise.id].weight} lb x ${prescriptions[currentExercise.id].targetReps} reps`}
                </Text>
                <Text style={styles.prescriptionReason}>{prescriptions[currentExercise.id].reason}</Text>
              </View>
            )}
            {(() => {
              const isBodyweight = isBodyweightExercise(currentExercise.name);
              // Real, new: the actual live pre-fill, not just a
              // placeholder hint. Once a real, adaptive prescription
              // exists (services/progressiveOverloadService.js's
              // actual output for this exercise - the same one shown
              // in the banner above), both fields start already filled
              // with it, since the app has already told the user this
              // exact number with confidence; retyping it would just be
              // friction. Still fully editable - if what was actually
              // done differs, typing over it works normally. Only when
              // there's no prescription yet (first-ever session, no
              // history to adapt from, no banner shown either) does
              // this fall back to the original placeholder-only
              // behavior - a hint, not a value, since there's nothing
              // real to prefill from for weight and only a generic
              // range for reps.
              const prescription = prescriptions[currentExercise.id];
              const fallbackReps = parseRepsLowerBound(currentExercise.reps);
              const placeholderReps = prescription?.targetReps ?? fallbackReps;
              return Array.from({ length: currentExercise.sets }).map((_, setIndex) => {
              const logged = loggedSetsByExercise[currentExercise.id]?.[setIndex];
              const inputKey = `${currentExercise.id}-${setIndex}`;
              const input = setInputs[inputKey] || {};
              const isLogging = loggingSetKey === inputKey;

              if (logged) {
                return (
                  <View key={setIndex} style={styles.setRowDone}>
                    <Ionicons name="checkmark-circle" size={18} color="#4CD964" />
                    <Text style={styles.setRowDoneText}>
                      {logged.isBodyweight
                        ? `Set ${setIndex + 1}: ${logged.reps} reps`
                        : `Set ${setIndex + 1}: ${logged.weight} lb x ${logged.reps} reps`}
                    </Text>
                  </View>
                );
              }

              return (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setRowLabel}>Set {setIndex + 1}</Text>
                  {!isBodyweight && (
                    <>
                      <TextInput
                        style={styles.setInput}
                        placeholder="lb"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={input.weight ?? (prescription ? String(prescription.weight) : '')}
                        onChangeText={(v) => updateSetInput(currentExercise.id, setIndex, 'weight', v)}
                      />
                      <Text style={styles.setInputX}>x</Text>
                    </>
                  )}
                  <TextInput
                    style={styles.setInput}
                    placeholder={placeholderReps != null ? String(placeholderReps) : ''}
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={input.reps ?? (prescription ? String(prescription.targetReps) : '')}
                    onChangeText={(v) => updateSetInput(currentExercise.id, setIndex, 'reps', v)}
                  />
                  {isLogging ? (
                    <ActivityIndicator size="small" color="#000" style={{ marginLeft: 8 }} />
                  ) : (
                    <View style={styles.rpeButtons}>
                      <Pressable style={[styles.rpeBtn, styles.rpeBtnEasy]} onPress={() => handleLogSet(currentExercise, setIndex, 'easy')}>
                        <Text style={styles.rpeBtnText}>Easy</Text>
                      </Pressable>
                      <Pressable style={[styles.rpeBtn, styles.rpeBtnModerate]} onPress={() => handleLogSet(currentExercise, setIndex, 'moderate')}>
                        <Text style={styles.rpeBtnText}>OK</Text>
                      </Pressable>
                      <Pressable style={[styles.rpeBtn, styles.rpeBtnHard]} onPress={() => handleLogSet(currentExercise, setIndex, 'hard')}>
                        <Text style={styles.rpeBtnText}>Hard</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
              });
            })()}
          </View>
        )}
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
                name: workoutDisplayName,
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
              }, user?.uid);

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
                  xp: freshExp.expSystem.totalExp,
                  level: freshExp.expSystem.level,
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

      {/* Fullscreen demo video */}
      <Modal
        visible={showFullscreenVideo}
        animationType="fade"
        onRequestClose={() => setShowFullscreenVideo(false)}
      >
        <View style={styles.fullscreenVideoContainer}>
          <Pressable
            style={styles.fullscreenCloseBtn}
            onPress={() => setShowFullscreenVideo(false)}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>
          {currentVideoUrl && (
            <Image
              source={{ uri: currentVideoUrl }}
              style={styles.fullscreenVideo}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Three-dot popup menu */}
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
                  <Pressable onPress={() => {
                    const action = playbackState?.is_playing ? pauseTrack() : playTrack();
                    action.catch((e) => {
                      const noDevice = e?.message?.includes('No active device');
                      Alert.alert(
                        'Playback Failed',
                        noDevice
                          ? 'Open Spotify once on this phone (or another device) so it can receive playback, then try again.'
                          : (e?.message || 'Could not update playback.')
                      );
                    });
                  }} style={{width:60,height:60,borderRadius:30,backgroundColor:'#1DB954',justifyContent:'center',alignItems:'center'}}>
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
  videoLoadingSpinner: {
    position: 'absolute',
  },
  fullscreenVideoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    width: '100%',
    height: '70%',
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

  /* Real, new: set logging */
  setLogSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  setLogTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  prescriptionCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    padding: 12,
    marginBottom: 12,
  },
  prescriptionTarget: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  prescriptionReason: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setRowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    width: 48,
  },
  setInput: {
    width: 56,
    height: 36,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#000',
  },
  setInputX: {
    fontSize: 14,
    color: '#666',
  },
  rpeButtons: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  rpeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  rpeBtnEasy: { backgroundColor: '#34C759' },
  rpeBtnModerate: { backgroundColor: '#8E8E93' },
  rpeBtnHard: { backgroundColor: '#FF3B30' },
  rpeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  setRowDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setRowDoneText: {
    fontSize: 13,
    fontWeight: '600',
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

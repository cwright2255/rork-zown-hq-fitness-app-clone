import React, { useState, useEffect, useCallback, useRef } from 'react';
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

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

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
  const [showMenu, setShowMenu] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const timerRef = useRef(null);
  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;

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

  /* Auto-advance when timer hits 0 */
  useEffect(() => {
    if (timeLeft === 0 && isPlaying) {
      setCompletedSet((prev) => new Set(prev).add(currentExercise.id));
      if (currentIndex < totalExercises - 1) {
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        setTimeLeft(exercises[nextIdx].seconds);
      } else {
        setIsPlaying(false);
      }
    }
  }, [timeLeft, isPlaying]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const jumpToExercise = useCallback(
    (idx) => {
      setCurrentIndex(idx);
      setTimeLeft(exercises[idx].seconds);
      setIsPlaying(true);
    },
    [exercises],
  );

  const progressPercent =
    currentExercise.seconds > 0
      ? ((currentExercise.seconds - timeLeft) / currentExercise.seconds) * 100
      : 0;

  /* ── Upcoming exercises ── */
  const upcomingExercises = exercises.slice(currentIndex + 1);

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

          {/* Playback controls */}
          <View style={styles.playbackControls}>
            <Pressable onPress={togglePlayPause}>
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#FFF"
              />
            </Pressable>
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
                // TODO: open music integration (Spotify / Apple Music)
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
    paddingBottom: 40,
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

  /* Video area */
  videoArea: {
    marginHorizontal: 16,
    height: 300,
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
  nextCard: {
    width: 140,
    marginRight: 12,
  },
  nextCardThumb: {
    height: 90,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginTop: 6,
  },
  nextCardDuration: {
    fontSize: 11,
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

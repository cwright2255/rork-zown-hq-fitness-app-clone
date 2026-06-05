import React, { useState, useMemo, useEffect } from 'react';
  // Derive target muscles from exercises
  const targetMuscles = useMemo(() => {
    const muscleMap = {
      'Jumping Jack': 'Quadriceps',
      'High Knees': 'Hip Flexors',
      'Push Ups': 'Chest',
      'Squats': 'Quadriceps',
      'Plank': 'Abdominals',
      'Burpees': 'Full Body',
      'Lunges': 'Glutes',
      'Mountain Climbers': 'Abdominals',
    };
    const muscles = new Set();
    (INITIAL_EXERCISES || []).forEach(ex => {
      const m = muscleMap[ex.name];
      if (m) muscles.add(m);
    });
    return [...muscles];
  }, []);

  const muscleVizUrl = useMemo(() => {
    return getWorkoutVisualizeUrl({ targetMuscles, gender: 'male', size: 'small' });
  }, [targetMuscles]);

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getWorkoutVisualizeUrl } from '@/services/muscleVisualizerService';

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
  { id: 'e1', name: 'Jumping Jack', duration: '0:50', completed: true },
  { id: 'e2', name: 'High Knees', duration: '1:00', completed: true },
  { id: 'e3', name: 'Push Ups', duration: '0:45', completed: false },
  { id: 'e4', name: 'Squats', duration: '1:00', completed: false },
  { id: 'e5', name: 'Plank', duration: '0:30', completed: false },
];

const TOTAL_MOVES = 28; // Total moves in the full workout

/* ── Exercise row ── */

function ExerciseRow({ exercise }) {
  return (
    
        {/* Muscles Worked */}
        {targetMuscles.length > 0 && (
          <View style={{marginBottom:16}}>
            <Text style={{fontSize:16,fontWeight:'700',color:'#000',paddingHorizontal:20,marginBottom:10}}>Muscles Worked</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingLeft:20,paddingRight:6}}>
              {targetMuscles.map((m, i) => (
                <View key={i} style={{backgroundColor:'#F0F0F0',paddingHorizontal:14,paddingVertical:8,borderRadius:16,marginRight:8}}>
                  <Text style={{fontSize:13,fontWeight:'600',color:'#333'}}>{m}</Text>
                </View>
              ))}
            </ScrollView>
            {muscleVizUrl && (
              <View style={{marginTop:10,marginHorizontal:20,height:120,borderRadius:12,overflow:'hidden',backgroundColor:'#F8F8F8',justifyContent:'center',alignItems:'center'}}>
                <Image source={{uri:muscleVizUrl}} style={{width:'100%',height:'100%'}} resizeMode="contain" onError={() => {}} />
              </View>
            )}
          </View>
        )}

<Pressable style={styles.exerciseRow}>
      <View style={styles.exerciseCheck}>
        {exercise.completed ? (
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color="#D1D5DB" />
        )}
      </View>
      <View style={styles.exerciseThumb}>
        <Ionicons name="body-outline" size={22} color="#999" />
      </View>
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseDuration}>{exercise.duration}</Text>
      </View>
    </Pressable>
  );
}

/* ── Stat pill ── */

function StatPill({ icon, label }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color="#FFF" />
      <Text style={styles.statPillText}>{label}</Text>
    </View>
  );
}

/* ── Main screen ── */

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const [exercises, setExercises] = useState(INITIAL_EXERCISES);
  const [bookmarked, setBookmarked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  /* ── Reactive CTA logic ── */
  // exercises is now stateful (see useState above)
  const completedCount = exercises.filter((e) => e.completed).length;
  const totalExercises = exercises.length;
  const hasStarted = completedCount > 0;
  const isComplete = completedCount === totalExercises;
  const progressPercent = (completedCount / TOTAL_MOVES) * 100;

  const ctaConfig = useMemo(() => {
    if (isComplete) {
      return {
        text: 'Workout Complete',
        icon: 'checkmark-circle',
        bg: '#22C55E',
        disabled: true,
      };
    }
    if (hasStarted) {
      return {
        text: 'Continue Workout',
        icon: 'play-forward',
        bg: '#000',
        disabled: false,
      };
    }
    return {
      text: 'Start Workout',
      icon: 'play',
      bg: '#000',
      disabled: false,
    };
  }, [hasStarted, isComplete]);

  const handleClearProgress = () => {
    setExercises(exercises.map((e) => ({ ...e, completed: false })));
    setShowClearConfirm(false);
    setShowMenu(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/workouts');
    }
  };

  const handleCTA = () => {
    if (ctaConfig.disabled) return;
    // TODO: navigate to active workout screen
    router.push('/workout/active');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <View style={styles.hero}>
          <Ionicons name="barbell-outline" size={60} color="#999" />

          {/* High XP badge */}
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>High XP</Text>
          </View>

          {/* Back button */}
          <Pressable style={styles.backBtn} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#000" />
          </Pressable>

          {/* Top-right actions */}
          <View style={styles.topRightActions}>
            <Pressable
              style={styles.actionBtn}
              onPress={() => setBookmarked(!bookmarked)}
            >
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color="#000"
              />
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={18} color="#000" />
            </Pressable>
          </View>

          {/* Overlay */}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Kettlebell Step-Overs</Text>
            <Text style={styles.heroDesc}>
              High-intensity kettlebell step-over exercise
            </Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <StatPill icon="time-outline" label="30 min" />
              <StatPill icon="barbell-outline" label="1 exercises" />
              <StatPill icon="flash-outline" label="+100 XP" />
            </View>

            {/* Bottom row: difficulty + category */}
            <View style={styles.overlayBottomRow}>
              <View style={styles.difficultyBadge}>
                <Text style={styles.difficultyText}>INTERMEDIATE</Text>
              </View>
              <Text style={styles.categoryLabel}>Hiit</Text>
            </View>
          </View>
        </View>

        {/* ── Progress section ── */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressCount}>
              {completedCount}/{TOTAL_MOVES} moves
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[styles.progressBarFill, { width: progressPercent + '%' }]}
            />
          </View>
        </View>

        {/* ── Description ── */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>
            This exercise is where your healthy habits begin! It starts off with
            a warm up and then takes you through 3 sets of bodyweight exercises
            designed to build your foundation. Perfect for beginners or as a
            recovery day workout.
          </Text>
          <Pressable>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>

        {/* ── Stage header ── */}
        <View style={styles.stageHeader}>
          <View style={styles.stageHeaderLeft}>
            <Text style={styles.stageTitle}>Stage 1: Start Habits</Text>
            <Text style={styles.stageSubtitle}>30 moves, 25 minutes</Text>
          </View>
          <Ionicons name="lock-closed-outline" size={20} color="#999" />
        </View>

        {/* ── Exercise list ── */}
        {exercises.map((exercise) => (
          <ExerciseRow key={exercise.id} exercise={exercise} />
        ))}
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
            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setShowMenu(false);
                setShowClearConfirm(true);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#FF3B30" style={{ marginRight: 12 }} />
              <Text style={[styles.menuOptionText, { color: '#FF3B30' }]}>Clear Progress</Text>
            </Pressable>
            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setShowMenu(false);
                // TODO: share workout
              }}
            >
              <Ionicons name="share-outline" size={20} color="#000" style={{ marginRight: 12 }} />
              <Text style={styles.menuOptionText}>Share Workout</Text>
            </Pressable>
            <Pressable
              style={[styles.menuOption, { borderBottomWidth: 0 }]}
              onPress={() => setShowMenu(false)}
            >
              <Ionicons name="close-outline" size={20} color="#666" style={{ marginRight: 12 }} />
              <Text style={[styles.menuOptionText, { color: '#666' }]}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Clear progress confirmation ── */}
      <Modal
        visible={showClearConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Clear Workout Progress?</Text>
            <Text style={styles.confirmSubtitle}>
              This will reset all completed exercises for this workout.
            </Text>
            <Pressable style={styles.confirmClearBtn} onPress={handleClearProgress}>
              <Text style={styles.confirmClearBtnText}>Clear Progress</Text>
            </Pressable>
            <Pressable
              style={styles.confirmCancelBtn}
              onPress={() => setShowClearConfirm(false)}
            >
              <Text style={styles.confirmCancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Floating CTA button ── */}
      <Pressable
        style={[styles.ctaButton, { backgroundColor: ctaConfig.bg }]}
        onPress={handleCTA}
        disabled={ctaConfig.disabled}
      >
        <Text style={styles.ctaText}>{ctaConfig.text}</Text>
        <Ionicons name={ctaConfig.icon} size={22} color="#FFF" />
      </Pressable>
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

  /* Hero */
  hero: {
    height: 320,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  xpBadge: {
    position: 'absolute',
    top: 100,
    left: 16,
    backgroundColor: '#E8873A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  xpBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 65,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statPillText: {
    fontSize: 12,
    color: '#FFF',
  },
  overlayBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  difficultyBadge: {
    backgroundColor: '#E8873A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  topRightActions: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Progress */
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  progressCount: {
    fontSize: 13,
    color: '#666',
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#000',
  },

  /* Description */
  descriptionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  seeAll: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
    marginTop: 4,
  },

  /* Stage */
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  stageHeaderLeft: {
    flex: 1,
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  stageSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  /* Exercise rows */
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  exerciseCheck: {
    marginRight: 12,
  },
  exerciseThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  exerciseDuration: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  /* Floating CTA */
  ctaButton: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
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
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  /* Three-dot menu */
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menuCard: {
    position: 'absolute',
    top: 100,
    right: 20,
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

  /* Clear progress confirmation */
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
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  confirmSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 20,
  },
  confirmClearBtn: {
    backgroundColor: '#FF3B30',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmClearBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmCancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});

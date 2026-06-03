import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

/* ── Placeholder exercise data ── */
// TODO: Connect to real workout API / exerciseStore

const PLACEHOLDER_EXERCISES = [
  { id: 'e1', name: 'Jumping Jack', duration: '0:50', completed: true },
  { id: 'e2', name: 'High Knees', duration: '1:00', completed: true },
  { id: 'e3', name: 'Push Ups', duration: '0:45', completed: false },
  { id: 'e4', name: 'Squats', duration: '1:00', completed: false },
  { id: 'e5', name: 'Plank', duration: '0:30', completed: false },
];

const COMPLETED_COUNT = PLACEHOLDER_EXERCISES.filter((e) => e.completed).length;
const TOTAL_COUNT = 28; // Total moves in the full workout

/* ── Exercise row ── */

function ExerciseRow({ exercise }) {
  return (
    <Pressable style={styles.exerciseRow}>
      {/* Completion indicator */}
      <View style={styles.exerciseCheck}>
        {exercise.completed ? (
          <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
        ) : (
          <Ionicons name="ellipse-outline" size={24} color="#D1D5DB" />
        )}
      </View>

      {/* Thumbnail */}
      <View style={styles.exerciseThumb}>
        <Ionicons name="body-outline" size={22} color="#999" />
      </View>

      {/* Name + duration */}
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseDuration}>{exercise.duration}</Text>
      </View>
    </Pressable>
  );
}

/* ── Main screen ── */

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(false);

  const progressPercent = (COMPLETED_COUNT / TOTAL_COUNT) * 100;

  const handleBack = () => {
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
        {/* ── Hero image section ── */}
        <View style={styles.hero}>
          <Ionicons name="barbell-outline" size={60} color="#999" />

          {/* Overlay gradient */}
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>Meet the Basics</Text>
            <Text style={styles.heroSubtitle}>50 minutes \u2022 2 Stages</Text>
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
            <Pressable style={styles.actionBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color="#000" />
            </Pressable>
          </View>
        </View>

        {/* ── Progress section ── */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressCount}>
              {COMPLETED_COUNT}/{TOTAL_COUNT} moves
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
        {PLACEHOLDER_EXERCISES.map((exercise) => (
          <ExerciseRow key={exercise.id} exercise={exercise} />
        ))}
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <SafeAreaView edges={['bottom']} style={styles.ctaWrapper}>
        <Pressable
          style={styles.ctaButton}
          onPress={() => {
            // TODO: navigate to active workout screen
            router.push('/workout/active');
          }}
        >
          <Text style={styles.ctaText}>Continue Exercise</Text>
          <Ionicons
            name="play-circle-outline"
            size={22}
            color="#FFF"
            style={{ marginLeft: 8 }}
          />
        </Pressable>
      </SafeAreaView>
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
    height: 260,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFF',
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
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
  },
  topRightActions: {
    position: 'absolute',
    top: 50,
    right: 16,
    flexDirection: 'row',
    gap: 8,
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

  /* CTA */
  ctaWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  ctaButton: {
    backgroundColor: '#000',
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});

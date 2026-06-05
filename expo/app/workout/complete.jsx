import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useExpStore } from '@/store/expStore';

/* ââ Placeholder data ââ */
// TODO: receive real workout results via route params or store

const COMPLETED_EXERCISES = [
  { id: 'e1', name: 'Mountain Climber', duration: '0:50' },
  { id: 'e2', name: 'Sit Up', duration: '1:08' },
  { id: 'e3', name: 'Burpees', duration: '0:45' },
  { id: 'e4', name: 'Jump Squat', duration: '1:00' },
  { id: 'e5', name: 'Plank', duration: '0:30' },
  { id: 'e6', name: 'Lunges', duration: '0:50' },
  { id: 'e7', name: 'Push Ups', duration: '0:45' },
  { id: 'e8', name: 'High Knees', duration: '1:00' },
];

const REWARDS = [
  { id: 'r1', icon: 'trophy', label: '7-Workout Week' },
  { id: 'r2', icon: 'trending-up', label: 'Move Goal 200%' },
  { id: 'r3', icon: 'ribbon', label: 'New Move Record' },
  { id: 'r4', icon: 'flame', label: 'Longest Streak' },
];

const SUMMARY_STATS = [
  { label: 'Duration', value: realDuration },
  { label: 'Exercises Completed', value: realExercises },
  { label: 'Calories Burned', value: '246 kcal' },
  { label: 'Average Heart Rate', value: '--' },
  { label: 'XP Earned', value: '+100 XP' },
];

/* ââ Stat card ââ */

function StatCard({ icon, number, label }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color="#000" />
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ââ Summary row ââ */

function SummaryRow({ label, value, isLast }) {
  return (
    <View style={[styles.summaryRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

/* ââ Exercise completion row ââ */

function ExerciseRow({ exercise }) {
  return (
    <View style={styles.exerciseRow}>
      <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
      <View style={styles.exerciseThumb}>
        <Ionicons name="body-outline" size={20} color="#999" />
      </View>
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseDuration}>{exercise.duration}</Text>
      </View>
    </View>
  );
}

/* ââ Reward badge ââ */

function RewardBadge({ reward }) {
  return (
    <View style={styles.rewardBadge}>
      <View style={styles.rewardCircle}>
        <Ionicons name={reward.icon} size={24} color="#000" />
      </View>
      <Text style={styles.rewardLabel} numberOfLines={2}>
        {reward.label}
      </Text>
    </View>
  );
}

/* ââ Tab button ââ */

function TabButton({ label, active, onPress }) {
  return (
    <Pressable
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ââ Main screen ââ */

export default function WorkoutCompleteScreen() {
  const completedWorkouts = useWorkoutStore(s => s.completedWorkouts) || [];
  const { totalExp } = useExpStore();
  const lastWorkout = completedWorkouts.length > 0 ? completedWorkouts[completedWorkouts.length - 1] : {};

  const realDuration = lastWorkout.duration ? Math.floor(lastWorkout.duration / 60) + ' min' : '0 min';
  const realCalories = lastWorkout.caloriesBurned || 0;
  const realXP = lastWorkout.xpEarned || 100;
  const realExercises = (lastWorkout.exercisesCompleted || 0) + '/' + (lastWorkout.totalExercises || 0);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Summary');

  const handleClose = () => {
    router.replace('/workouts');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ââ Header ââ */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Workout Complete</Text>
          <Pressable
            style={styles.headerBtn}
            onPress={() => {
              // TODO: share workout results
            }}
          >
            <Ionicons name="share-outline" size={22} color="#000" />
          </Pressable>
        </View>

        {/* ââ Celebration ââ */}
        <View style={styles.celebration}>
          <View style={styles.celebrationCircle}>
            <Ionicons name="checkmark" size={50} color="#000" />
          </View>
          <Text style={styles.celebrationTitle}>Great Job!</Text>
          <Text style={styles.celebrationName}>Carlton Wright</Text>
        </View>

        {/* ââ Stats row ââ */}
        <View style={styles.statsRow}>
          <StatCard icon="flash-outline" number="246" label="Total calories" />
          <StatCard icon="star-outline" number="+100" label="XP Earned" />
        </View>

        {/* ââ Tabs ââ */}
        <View style={styles.tabRow}>
          <TabButton
            label="Summary"
            active={activeTab === 'Summary'}
            onPress={() => setActiveTab('Summary')}
          />
          <TabButton
            label="Stats"
            active={activeTab === 'Stats'}
            onPress={() => setActiveTab('Stats')}
          />
          <TabButton
            label="Exercises"
            active={activeTab === 'Exercises'}
            onPress={() => setActiveTab('Exercises')}
          />
        </View>

        {/* ââ Tab content ââ */}
        {activeTab === 'Summary' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Workout Summary</Text>
            {SUMMARY_STATS.map((stat, idx) => (
              <SummaryRow
                key={stat.label}
                label={stat.label}
                value={stat.value}
                isLast={idx === SUMMARY_STATS.length - 1}
              />
            ))}
          </View>
        )}

        {activeTab === 'Stats' && (
          <View style={styles.tabContentCenter}>
            <Ionicons name="bar-chart-outline" size={48} color="#CCC" />
            <Text style={styles.placeholderText}>
              Detailed stats coming soon
            </Text>
          </View>
        )}

        {activeTab === 'Exercises' && (
          <View style={styles.tabContent}>
            {COMPLETED_EXERCISES.map((exercise) => (
              <ExerciseRow key={exercise.id} exercise={exercise} />
            ))}
          </View>
        )}

        {/* ââ Rewards ââ */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>Rewards</Text>
          <Text style={styles.rewardsSubtitle}>
            You've earned 2/10 of all Rewards.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rewardsCarousel}
          >
            {REWARDS.map((reward) => (
              <RewardBadge key={reward.id} reward={reward} />
            ))}
          </ScrollView>
        </View>

        {/* ââ Bottom CTA ââ */}
        <Pressable style={styles.ctaButton} onPress={handleClose}>
          <Text style={styles.ctaText}>Back to Workouts</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/* ââ Styles ââ */

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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    marginBottom: 24,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },

  /* Celebration */
  celebration: {
    alignItems: 'center',
    marginBottom: 24,
  },
  celebrationCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  celebrationName: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    marginBottom: 32,
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999',
  },
  tabTextActive: {
    fontWeight: '700',
    color: '#000',
  },

  /* Tab content */
  tabContent: {
    paddingHorizontal: 20,
  },
  tabContentCenter: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },

  /* Summary rows */
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryRowLabel: {
    fontSize: 15,
    color: '#333',
  },
  summaryRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },

  /* Exercise rows */
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  exerciseThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
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

  /* Rewards */
  rewardsSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  rewardsSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  rewardsCarousel: {
    paddingRight: 6,
  },
  rewardBadge: {
    width: 80,
    alignItems: 'center',
    marginRight: 12,
  },
  rewardCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 6,
  },

  /* CTA */
  ctaButton: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
    backgroundColor: '#000',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});

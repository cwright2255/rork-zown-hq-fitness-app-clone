import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useExpStore } from '@/store/expStore';
import { useUserStore } from '@/store/userStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useRunningStore } from '@/store/runningStore';
import { useCommunityStore } from '@/store/communityStore';

function StatCard({ icon, number, label }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color="#000" />
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/*              Summary row              */

function SummaryRow({ label, value, isLast }) {
  return (
    <View style={[styles.summaryRow, isLast && { borderBottomWidth: 0 }]}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={styles.summaryRowValue}>{value}</Text>
    </View>
  );
}

/*              Exercise completion row              */

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

/*              Reward badge              */

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

/*              Tab button              */

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

/*              Main screen              */

function formatDurationFromSeconds(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function WorkoutCompleteScreen() {
  const params = useLocalSearchParams();
  const isRunCompletion = params.type === 'run';
  const isHikeCompletion = params.type === 'hike';

  const completedWorkouts = useWorkoutStore(s => s.completedWorkouts) || [];
  const runs = useRunningStore(s => s.runs) || [];
  const { totalExp } = useExpStore();
  const { user } = useUserStore();
  const { badges, loadBadges } = useBadgeStore();
  const { loadRuns } = useRunningStore();
  const { createPost } = useCommunityStore();
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      loadBadges(user.uid);
      if (isRunCompletion) loadRuns(user.uid);
    }
  }, [user?.uid]);

  const lastWorkout = completedWorkouts.length > 0 ? completedWorkouts[completedWorkouts.length - 1] : null;
  const lastRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const displayName = user?.displayName || user?.name || 'You';

  // Running redirects here too (app/running/active.jsx), but this screen
  // previously only ever read from workoutStore -- meaning after finishing
  // a run, it would show stale or empty workout data instead of the run
  // that was just completed. Branches on the ?type=run param set by that
  // redirect rather than guessing from whichever store happens to be
  // freshest. Hike completions carry their own data directly in the route
  // params (already fully computed in the monitor screen before
  // navigating here) rather than reading from a store, since there's
  // nothing to look up - the hike that was just completed IS the data.
  const realDuration = isHikeCompletion
    ? formatDurationFromSeconds(parseInt(params.durationSeconds, 10) || 0)
    : isRunCompletion
      ? (lastRun?.duration ? Math.floor(lastRun.duration / 60) + ' min' : '0 min')
      : (lastWorkout?.duration ? Math.floor(lastWorkout.duration / 60) + ' min' : '0 min');
  const realCalories = isRunCompletion ? (lastRun?.calories || 0) : (lastWorkout?.caloriesBurned || 0);
  const realXP = isHikeCompletion
    ? (parseInt(params.xpEarned, 10) || 0)
    : isRunCompletion ? Math.round((lastRun?.distance || 0) * 30) : (lastWorkout?.xpEarned || 0);
  const realExercises = `${lastWorkout?.exercisesCompleted ?? 0}/${lastWorkout?.totalExercises ?? 0}`;

  const summaryStats = isHikeCompletion
    ? [
        { label: 'Distance', value: `${params.distanceKm || '0'} km` },
        { label: 'Elevation Gain', value: `${params.elevationGainM || '0'} m` },
        { label: 'Difficulty', value: params.difficultyTier || 'Easy' },
        { label: 'Calories Burned', value: `${params.calories || '0'} kcal` },
        { label: 'XP Earned', value: `+${realXP} XP` },
      ]
    : isRunCompletion
      ? [
          { label: 'Distance', value: `${(lastRun?.distance || 0).toFixed(2)} km` },
          { label: 'Duration', value: realDuration },
          { label: 'Calories Burned', value: `${realCalories} kcal` },
          { label: 'XP Earned', value: `+${realXP} XP` },
        ]
      : [
          { label: 'Duration', value: realDuration },
          { label: 'Exercises Completed', value: realExercises },
          { label: 'Calories Burned', value: `${realCalories} kcal` },
          { label: 'XP Earned', value: `+${realXP} XP` },
        ];

  const exerciseList = lastWorkout?.exercises || [];
  const unlockedCount = badges.filter((b) => b.isUnlocked).length;

  const handleShareToCommunity = async () => {
    if (!user?.uid || shared) return;
    setSharing(true);
    try {
      const text = isHikeCompletion
        ? `Just completed a ${(params.difficultyTier || 'moderate').toLowerCase()} hike - ${params.distanceKm}km, ${params.elevationGainM}m elevation gain.     `
        : isRunCompletion
          ? `Just finished a ${(lastRun?.distance || 0).toFixed(2)}km run in ${realDuration}.     `
          : `Just completed a workout - ${realExercises} exercises, ${realCalories} kcal burned.     `;
      await createPost({
        uid: user.uid,
        authorName: displayName,
        authorAvatar: user.profileImage,
        text,
        type: isHikeCompletion ? 'hike' : isRunCompletion ? 'run' : 'workout',
      });
      setShared(true);
    } catch (e) {
      console.warn('[complete] share to community failed:', e?.message);
    } finally {
      setSharing(false);
    }
  };

  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Summary');

  const handleClose = () => {
    router.replace(isHikeCompletion || isRunCompletion ? '/running/program' : '/workouts');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/*              Header              */}
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

        {/*              Celebration              */}
        <View style={styles.celebration}>
          <View style={styles.celebrationCircle}>
            <Ionicons name="checkmark" size={50} color="#000" />
          </View>
          <Text style={styles.celebrationTitle}>Great Job!</Text>
          <Text style={styles.celebrationName}>{displayName}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatCard icon="flash-outline" number={String(realCalories)} label="Total calories" />
          <StatCard icon="star-outline" number={`+${realXP}`} label="XP Earned" />
        </View>

        {/* Tabs */}
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

        {/* Tab content */}
        {activeTab === 'Summary' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Workout Summary</Text>
            {summaryStats.map((stat, idx) => (
              <SummaryRow
                key={stat.label}
                label={stat.label}
                value={stat.value}
                isLast={idx === summaryStats.length - 1}
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
            {exerciseList.length === 0 ? (
              <Text style={styles.placeholderText}>No exercise detail recorded for this session.</Text>
            ) : (
              exerciseList.map((exercise, idx) => (
                <ExerciseRow
                  key={idx}
                  exercise={{
                    name: exercise.name,
                    duration: exercise.sets && exercise.reps ? `${exercise.sets} \u00d7 ${exercise.reps}` : '',
                  }}
                />
              ))
            )}
          </View>
        )}

        {/* Rewards */}
        <View style={styles.rewardsSection}>
          <Text style={styles.sectionTitle}>Rewards</Text>
          <Text style={styles.rewardsSubtitle}>
            You've earned {unlockedCount}/{badges.length} of all Rewards.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rewardsCarousel}
          >
            {badges.filter((b) => b.isUnlocked).map((badge) => (
              <RewardBadge key={badge.id} reward={{ icon: 'trophy', label: badge.name }} />
            ))}
          </ScrollView>
        </View>

        {/* Share to Community - real post, via store/communityStore.js */}
        <Pressable
          style={[styles.shareButton, shared && styles.shareButtonShared]}
          onPress={handleShareToCommunity}
          disabled={sharing || shared}
        >
          <Ionicons name={shared ? 'checkmark-circle' : 'share-social-outline'} size={18} color={shared ? '#22C55E' : '#000'} />
          <Text style={[styles.shareButtonText, shared && { color: '#22C55E' }]}>
            {sharing ? 'Sharing...' : shared ? 'Shared to Community' : 'Share to Community'}
          </Text>
        </Pressable>

        {/* Bottom CTA */}
        <Pressable style={styles.ctaButton} onPress={handleClose}>
          <Text style={styles.ctaText}>{isHikeCompletion || isRunCompletion ? 'Back to Running' : 'Back to Workouts'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/*              Styles              */

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

  /* Share to Community */
  shareButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16,
    borderWidth: 1, borderColor: '#000', borderRadius: 14, paddingVertical: 14,
  },
  shareButtonShared: { borderColor: '#22C55E' },
  shareButtonText: { fontSize: 14, fontWeight: '700', color: '#000' },

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

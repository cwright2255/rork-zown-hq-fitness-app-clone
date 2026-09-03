import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import LoadingSkeleton from '../src/components/LoadingSkeleton';
import { useChallengeStore } from '@/store/challengeStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';

const DIFFICULTY_COLOR = {
  beginner: '#22C55E',
  intermediate: '#E97132',
  advanced: '#DC2626',
};

const SEASON_LABEL = { winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Fall' };

function sectionTitle(cadence, challenge) {
  if (cadence === 'daily') return 'Today';
  if (cadence === 'weekly') return 'This Week';
  if (cadence === 'monthly') return 'This Month';
  // seasonal: use the real season name once we have a challenge to read
  // it from (periodKey looks like "season-summer-2026")
  const seasonName = challenge?.periodKey?.split('-')?.[1];
  return `This ${SEASON_LABEL[seasonName] || 'Season'}`;
}

function timeLeftLabel(endDate) {
  if (!endDate) return '';
  const ms = new Date(endDate).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  if (days <= 0) return 'ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function ChallengeCard({ challenge, joined, progress, onJoin, onLeave }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={[styles.difficultyPill, { backgroundColor: DIFFICULTY_COLOR[challenge.difficulty] || '#999' }]}>
          <Text style={styles.difficultyPillText}>{(challenge.difficulty || '').toUpperCase()}</Text>
        </View>
        <Text style={styles.categoryText}>{challenge.category}</Text>
      </View>

      <Text style={styles.cardTitle}>{challenge.title}</Text>
      {!!challenge.description && <Text style={styles.cardDescription}>{challenge.description}</Text>}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={14} color="#999" />
          <Text style={styles.metaText}>{timeLeftLabel(challenge.endDate)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="flag-outline" size={14} color="#999" />
          <Text style={styles.metaText}>
            {challenge.goalTarget} {challenge.goalType === 'streak_days' ? 'day streak' : 'workouts'}
          </Text>
        </View>
      </View>

      {joined && progress && (
        <View style={styles.progressSection}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress.percent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress.current}/{progress.target} {progress.completed ? '· Complete!' : ''}
          </Text>
        </View>
      )}

      {!!challenge.basedOn && (
        <Text style={styles.basedOnText}>Based on: {challenge.basedOn}</Text>
      )}

      <Pressable
        style={[styles.joinBtn, joined && styles.leaveBtn]}
        onPress={() => (joined ? onLeave(challenge.id) : onJoin(challenge.id))}
      >
        <Text style={[styles.joinBtnText, joined && styles.leaveBtnText]}>
          {joined ? 'Leave Challenge' : 'Join Challenge'}
        </Text>
      </Pressable>
    </View>
  );
}

function ChallengeSection({ cadence, challenge, joined, progress, isFilling, onJoin, onLeave }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{sectionTitle(cadence, challenge)}</Text>
      {challenge ? (
        <ChallengeCard
          challenge={challenge}
          joined={joined}
          progress={progress}
          onJoin={onJoin}
          onLeave={onLeave}
        />
      ) : isFilling ? (
        <LoadingSkeleton width="100%" height={140} borderRadius={16} />
      ) : (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>No {cadence} challenge yet</Text>
        </View>
      )}
    </View>
  );
}

export default function ChallengesScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useUserStore();
  const {
    challenges, joinedChallengeIds, isLoading, isGenerating, error,
    loadChallenges, getCurrentByCadence, generateNewChallenges, joinChallenge, leaveChallenge, getProgress,
  } = useChallengeStore();
  const { completedWorkouts, loadWorkouts } = useWorkoutStore();

  useEffect(() => {
    (async () => {
      await loadChallenges(user?.uid);
      if (user?.uid) loadWorkouts(user.uid);
    })();
  }, [user?.uid]);

  // Auto-fill whatever cadences are missing their current challenge —
  // once loadChallenges has actually returned (isLoading false), not on
  // every render, and only once challenges have been checked at least
  // once (challenges.length tracked implicitly via isLoading having
  // completed) so this doesn't fire before the first load resolves.
  useEffect(() => {
    if (isLoading || isGenerating || !user?.uid) return;
    const current = getCurrentByCadence();
    const missingAny = Object.values(current).some((c) => c === null);
    if (missingAny) {
      generateNewChallenges(user.uid).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, challenges]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChallenges(user?.uid);
    setRefreshing(false);
  };

  const currentByCadence = getCurrentByCadence();
  const hasAnyChallenge = Object.values(currentByCadence).some(Boolean);
  const showingInitialLoad = isLoading && challenges.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      >
        <View style={styles.headerRow}>
          <Text style={styles.header}>Challenges</Text>
          {isGenerating && (
            <View style={styles.generatingBadge}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.generatingBadgeText}>Updating</Text>
            </View>
          )}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {showingInitialLoad ? (
          <View style={styles.loadingContainer}>
            <LoadingSkeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 20 }} />
            <LoadingSkeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 20 }} />
            <LoadingSkeleton width="100%" height={140} borderRadius={16} style={{ marginBottom: 20 }} />
            <LoadingSkeleton width="100%" height={140} borderRadius={16} />
          </View>
        ) : (
          ['daily', 'weekly', 'monthly', 'seasonal'].map((cadence) => {
            const challenge = currentByCadence[cadence];
            const joined = challenge ? joinedChallengeIds.has(challenge.id) : false;
            const progress = joined ? getProgress(challenge, completedWorkouts) : null;
            return (
              <ChallengeSection
                key={cadence}
                cadence={cadence}
                challenge={challenge}
                joined={joined}
                progress={progress}
                isFilling={!challenge && isGenerating}
                onJoin={(id) => joinChallenge(id, user?.uid)}
                onLeave={(id) => leaveChallenge(id, user?.uid)}
              />
            );
          })
        )}

        {!showingInitialLoad && !hasAnyChallenge && !isGenerating && (
          <Text style={styles.hintText}>
            Pull down to refresh, or reopen the app in a moment — new challenges are generated automatically from real community activity and fitness guidelines.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    fontFamily: 'Inter',
  },
  generatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generatingBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 16,
  },
  loadingContainer: {
    marginTop: 10,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  emptySection: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 13,
    color: '#999',
  },
  hintText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  difficultyPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  difficultyPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#999',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#000',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  basedOnText: {
    fontSize: 11,
    color: '#AAA',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  joinBtn: {
    backgroundColor: '#000',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  leaveBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  leaveBtnText: {
    color: '#DC2626',
  },
});

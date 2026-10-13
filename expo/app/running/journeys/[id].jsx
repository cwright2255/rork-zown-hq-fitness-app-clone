// app/running/journeys/[id].jsx
//
// A virtual journey: a real route (lib/virtualJourneys.js) that every run and walk you
// record after joining counts toward. Shows the route, how far along you are, the four
// milestones, and starts a run or a walk. What you have joined and covered is kept by
// store/virtualChallengeStore.js; finishing pays XP and a badge (services/journeyRewards.js).
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useVirtualChallengeStore } from '@/store/virtualChallengeStore';
import { journeyById, journeyProgress, milestonesFor, journeyLength, journeyXp } from '@/lib/virtualJourneys';
import { formatDistance } from '@/lib/distanceUnits';

const dayOf = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function JourneyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useUserStore();
  const uid = user && user.uid;
  const units = useSettingsStore((s) => s.units); // Settings > Distance Units
  const journey = journeyById(id);
  const record = useVirtualChallengeStore((s) => (uid && journey ? (s.byUser[uid] || {})[journey.id] : undefined));
  const join = useVirtualChallengeStore((s) => s.joinChallenge);

  useEffect(() => {
    useVirtualChallengeStore.getState().loadChallenges(uid); // does nothing without a person
  }, [uid]);

  if (!journey) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back" testID="journey-back">
            <Ionicons name="chevron-back" size={22} color="#000" />
          </Pressable>
          <Text style={styles.headerTitle}>Virtual Races</Text>
        </View>
        <Text style={styles.empty} testID="journey-unknown">That journey does not exist.</Text>
      </SafeAreaView>
    );
  }

  const progress = journeyProgress(journey, record);
  const milestones = milestonesFor(journey);
  const xp = journeyXp(journey.distanceKm);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back" testID="journey-back">
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{journey.title}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={progress.completed ? 'checkmark' : 'map-outline'} size={26} color="#FFF" />
          </View>
          <Text style={styles.heroTitle} testID="journey-length">{journeyLength(journey.distanceKm, units)}</Text>
          <Text style={styles.heroRegion}>{journey.region}</Text>
          <Text style={styles.heroBlurb}>{journey.blurb}</Text>
        </View>

        {progress.joined && (
          <View style={styles.progress} testID="journey-progress">
            <Text style={styles.progressLabel}>{progress.completed ? 'Completed' : 'Your progress'}</Text>
            <Text style={styles.progressValue} testID="journey-covered">
              {`${formatDistance(progress.coveredKm, units, 1)} of ${journeyLength(journey.distanceKm, units)}`}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress.fraction * 100)}%` }]} testID="journey-fill" />
            </View>
            <Text style={styles.progressText} testID="journey-state">
              {progress.completed
                ? `Finished${record.completedAt ? ` on ${dayOf(record.completedAt)}` : ''}. XP and the Trailblazer badge are yours.`
                : `${formatDistance(progress.leftKm, units, 1)} to go. Next: ${progress.next.name}.`}
            </Text>
          </View>
        )}

        {!uid ? (
          <Text style={styles.empty} testID="journey-signin">Sign in to join this journey.</Text>
        ) : (
          <View style={styles.actions}>
            {!progress.joined && (
              <Pressable style={styles.primary} onPress={() => join(journey.id, uid)} testID="journey-join">
                <Text style={styles.primaryText}>Join journey</Text>
              </Pressable>
            )}
            {progress.joined && !progress.completed && (
              <View style={styles.startRow}>
                <Pressable
                  style={[styles.start, styles.startRun]}
                  onPress={() => router.push('/running/active')}
                  testID="journey-start-run"
                >
                  <Ionicons name="play" size={18} color="#FFF" />
                  <Text style={styles.startRunText}>Start a run</Text>
                </Pressable>
                <Pressable
                  style={[styles.start, styles.startWalk]}
                  onPress={() => router.push({ pathname: '/running/active', params: { activity: 'walk' } })}
                  testID="journey-start-walk"
                >
                  <Ionicons name="walk-outline" size={20} color="#000" />
                  <Text style={styles.startWalkText}>Start a walk</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.fineprint}>
              {progress.joined
                ? 'Every run and walk you record in Zown adds to this journey.'
                : `Every run and walk you record after you join adds to this journey. Finish it to earn ${xp} XP and the Trailblazer badge.`}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Milestones</Text>
        <View style={styles.milestones} testID="journey-milestones">
          {milestones.map((milestone, i) => {
            const reached = i < progress.reached;
            return (
              <View key={milestone.percent} style={styles.milestone} testID={`journey-milestone-${milestone.percent}`}>
                <Ionicons
                  name={reached ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={reached ? '#22C55E' : '#BBB'}
                  testID={`journey-milestone-${milestone.percent}-${reached ? 'reached' : 'ahead'}`}
                />
                <Text style={[styles.milestoneName, reached && styles.milestoneNameDone]}>{milestone.name}</Text>
                <Text style={styles.milestoneAt}>{formatDistance(milestone.atKm, units, 1)}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.privacy} testID="journey-privacy">
          Your journey progress is private to you. It is kept on your phone and copied to your account, so it carries over to a new phone.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#000' },
  content: { paddingBottom: 100 },

  hero: { alignItems: 'center', marginHorizontal: 20, marginTop: 8, marginBottom: 20, backgroundColor: '#F5F5F5', borderRadius: 20, padding: 20 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#000' },
  heroRegion: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 2 },
  heroBlurb: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 10, lineHeight: 19 },

  progress: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E5E5E5', padding: 16 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#999' },
  progressValue: { fontSize: 22, fontWeight: '800', color: '#000', marginTop: 2 },
  track: { height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', marginTop: 12, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#22C55E' },
  progressText: { fontSize: 13, color: '#666', marginTop: 10, lineHeight: 19 },

  actions: { marginHorizontal: 20, marginBottom: 24, alignItems: 'center' },
  primary: { alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  startRow: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  start: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 26 },
  startRun: { backgroundColor: '#000' },
  startWalk: { backgroundColor: '#F5F5F5' },
  startRunText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  startWalkText: { fontSize: 15, fontWeight: '700', color: '#000' },
  fineprint: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 10, lineHeight: 17 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginBottom: 8 },
  milestones: { paddingHorizontal: 20, gap: 14 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  milestoneName: { flex: 1, fontSize: 15, color: '#666' },
  milestoneNameDone: { color: '#000', fontWeight: '600' },
  milestoneAt: { fontSize: 14, fontWeight: '600', color: '#000' },

  empty: { fontSize: 14, color: '#999', textAlign: 'center', marginHorizontal: 20, marginVertical: 24 },
  privacy: { fontSize: 11, color: '#999', lineHeight: 16, marginHorizontal: 20, marginTop: 24 },
});

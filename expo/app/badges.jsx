import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';



/* ââ Data ââ */

const ACTIVE_CHALLENGES = [
  { id: 'a1', title: '7-Day Workout Streak', desc: 'Complete a workout every day for 7 days', type: 'Workout', xp: 500, current: 3, total: 7, unit: 'workouts', cta: 'Go to Workouts', route: '/workouts' },
  { id: 'a2', title: 'HIIT Master', desc: 'Complete 5 HIIT workouts this month', type: 'Workout', xp: 300, current: 2, total: 5, unit: 'workouts', cta: 'Start HIIT', route: '/workouts' },
  { id: 'a3', title: 'Strength Builder', desc: 'Log 10 strength training sessions', type: 'Workout', xp: 400, current: 6, total: 10, unit: 'sessions', cta: 'Go to Workouts', route: '/workouts' },
  { id: 'a4', title: 'Couch to 5K', desc: 'Complete all 12 weeks of the C25K program', type: 'Running', xp: 1000, current: 4, total: 12, unit: 'weeks', cta: 'Continue Program', route: '/running/program' },
  { id: 'a5', title: 'Distance Runner', desc: 'Run a total of 50km this month', type: 'Running', xp: 600, current: 18.5, total: 50, unit: 'km', cta: 'Start Run', route: '/running/program' },
  { id: 'a6', title: 'Speed Demon', desc: 'Achieve a pace under 5:00/km for a full 5K', type: 'Running', xp: 800, current: 0, total: 1, unit: 'runs', cta: 'Start Run', route: '/running/program' },
];

const COMPLETED_CHALLENGES = [
  { id: 'c1', title: 'First Workout', desc: 'Complete your first workout', type: 'Workout', xp: 100, date: 'May 15, 2026' },
  { id: 'c2', title: 'First Mile', desc: 'Run your first mile without stopping', type: 'Running', xp: 150, date: 'May 20, 2026' },
  { id: 'c3', title: 'Early Bird', desc: 'Complete a workout before 7 AM', type: 'Workout', xp: 200, date: 'May 28, 2026' },
];

const LEADERBOARD = [
  { rank: 1, name: 'Alex R.', xp: '12,450' },
  { rank: 2, name: 'Carlton W.', xp: '8,200' },
  { rank: 3, name: 'Sarah M.', xp: '7,800' },
];

/* ââ Filter pill ââ */

function FilterPill({ label, active, onPress }) {
  return (
    <Pressable style={[styles.filterPill, active && styles.filterPillActive]} onPress={onPress}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ââ Active challenge card ââ */

function ActiveCard({ item }) {
  const pct = Math.round((item.current / item.total) * 100);
  return (
    <View style={styles.activeCard}>
      <View style={styles.cardTopRow}>
        <View style={[styles.typeBadge, item.type === 'Running' && { backgroundColor: '#333' }]}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
        <View style={styles.xpRow}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.xpText}>+{item.xp} XP</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDesc}>{item.desc}</Text>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: pct + '%' }]} />
      </View>
      <View style={styles.progressTextRow}>
        <Text style={styles.progressLeft}>
          {item.current}/{item.total} {item.unit}
        </Text>
        <Text style={styles.progressRight}>{pct}%</Text>
      </View>
      <View style={styles.ctaRow}>
        <Pressable style={styles.ctaBtn} onPress={() => router.push(item.route)}>
          <Text style={styles.ctaBtnText}>{item.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ââ Completed challenge card ââ */

function CompletedCard({ item }) {
  return (
    <View style={styles.completedCard}>
      <View style={styles.cardTopRow}>
        <View style={[styles.typeBadge, item.type === 'Running' && { backgroundColor: '#333' }]}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
        <View style={styles.xpRow}>
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text style={[styles.xpText, { color: '#22C55E' }]}>+{item.xp} XP Earned</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDesc}>{item.desc}</Text>
      <View style={[styles.progressBarBg, { marginTop: 12 }]}>
        <View style={[styles.progressBarFill, { width: '100%', backgroundColor: '#22C55E' }]} />
      </View>
      <View style={styles.completedRow}>
        <View style={styles.completedBadge}>
          <Text style={styles.completedBadgeText}>Completed</Text>
        </View>
        <Text style={styles.completedDate}>{item.date}</Text>
      </View>
    </View>
  );
}

/* ââ Main screen ââ */

export default function ChallengesScreen() {
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredActive = useMemo(
    () => activeFilter === 'All' ? ACTIVE_CHALLENGES : ACTIVE_CHALLENGES.filter((c) => c.type === activeFilter),
    [activeFilter],
  );
  const filteredCompleted = useMemo(
    () => activeFilter === 'All' ? COMPLETED_CHALLENGES : COMPLETED_CHALLENGES.filter((c) => c.type === activeFilter),
    [activeFilter],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('@/assets/branding/zown-logo-512.png')} style={styles.logo} resizeMode="contain" />
        </View>

        {/* Title */}
        <Text style={styles.pageTitle}>Challenges</Text>
        <Text style={styles.pageSubtitle}>Complete challenges to earn XP and unlock achievements</Text>

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {['All', 'Workout', 'Running'].map((f) => (
            <FilterPill key={f} label={f} active={activeFilter === f} onPress={() => setActiveFilter(f)} />
          ))}
        </View>

        {/* Active challenges */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Challenges</Text>
          <Text style={styles.sectionCount}>{filteredActive.length} active</Text>
        </View>
        {filteredActive.map((item) => (
          <ActiveCard key={item.id} item={item} />
        ))}

        {/* Completed */}
        <View style={[styles.sectionHeaderRow, { marginTop: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.sectionTitle}>Completed</Text>
            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
          </View>
        </View>
        {filteredCompleted.map((item) => (
          <CompletedCard key={item.id} item={item} />
        ))}

        {/* Leaderboard */}
        <View style={styles.leaderSection}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          <Text style={styles.leaderSubtitle}>See how you rank against other athletes</Text>
          <View style={styles.leaderCard}>
            {LEADERBOARD.map((p) => (
              <View key={p.rank} style={styles.leaderRow}>
                <Text style={styles.leaderRank}>#{p.rank}</Text>
                <View style={styles.leaderAvatar} />
                <Text style={styles.leaderName}>{p.name}</Text>
                <Text style={styles.leaderXp}>{p.xp} XP</Text>
              </View>
            ))}
            <Pressable>
              <Text style={styles.viewLeaderboard}>View Full Leaderboard</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ââ Styles ââ */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  logoRow: { alignItems: 'center', marginTop: 8, marginBottom: 12 },
  logo: { width: 120, height: 36 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#000', paddingHorizontal: 20 },
  pageSubtitle: { fontSize: 13, color: '#666', paddingHorizontal: 20, marginBottom: 20, marginTop: 4 },

  /* Filter */
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 20 },
  filterPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterPillActive: { backgroundColor: '#000' },
  filterPillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  filterPillTextActive: { color: '#FFF' },

  /* Section header */
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  sectionCount: { fontSize: 13, color: '#999' },

  /* Active card */
  activeCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16,
    marginBottom: 12, marginHorizontal: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeBadge: { backgroundColor: '#000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  xpText: { fontSize: 14, fontWeight: '700', color: '#000' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginTop: 10 },
  cardDesc: { fontSize: 13, color: '#666', marginTop: 4 },
  progressBarBg: { marginTop: 12, height: 6, borderRadius: 3, backgroundColor: '#E5E5E5', overflow: 'hidden' },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: '#000' },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLeft: { fontSize: 12, color: '#999' },
  progressRight: { fontSize: 12, fontWeight: '600', color: '#000' },
  ctaRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  ctaBtn: { backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  ctaBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },

  /* Completed card */
  completedCard: {
    backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16,
    marginBottom: 12, marginHorizontal: 20,
  },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  completedBadge: { backgroundColor: '#22C55E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  completedBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  completedDate: { fontSize: 11, color: '#999' },

  /* Leaderboard */
  leaderSection: { paddingHorizontal: 20, marginTop: 20 },
  leaderSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  leaderCard: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 16, marginTop: 10 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  leaderRank: { fontSize: 16, fontWeight: '800', color: '#000', width: 30 },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E0E0' },
  leaderName: { fontSize: 14, fontWeight: '600', color: '#000', flex: 1, marginLeft: 10 },
  leaderXp: { fontSize: 14, fontWeight: '700', color: '#000' },
  viewLeaderboard: { fontSize: 13, fontWeight: '600', color: '#000', textAlign: 'center', marginTop: 10 },
});

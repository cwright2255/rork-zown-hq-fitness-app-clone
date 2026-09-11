import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { useExpStore } from '@/store/expStore';
import { tokens } from '../../theme/tokens';



export default function ExpDashboardScreen() {
  const store = useExpStore();
  const {
    expSystem,
    getLevel,
    getExpToNextLevel,
    getRecentActivities,
    initializeExpSystem,
  } = store;

  useEffect(() => {
    if (initializeExpSystem && (!expSystem || !expSystem.levelRequirements)) {
      initializeExpSystem();
    }
  }, []);

  const level = (getLevel && getLevel()) || expSystem?.level || 1;
  const toNext = (getExpToNextLevel && getExpToNextLevel()) || { current: 0, needed: 100, progress: 0 };
  const activities = (getRecentActivities && getRecentActivities(8)) || [];

  const progressPct = Math.min(
    100,
    toNext.progress != null
      ? Math.round((toNext.progress || 0) * 100)
      : Math.round(((toNext.current || 0) / Math.max(1, toNext.needed || 1)) * 100)
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="XP" />
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 180 }}>
        <View style={styles.levelCard}>
          <Text style={styles.levelLabel}>LEVEL</Text>
          <Text style={styles.levelNumber}>{level}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {toNext.current || 0} / {toNext.needed || 0} XP to Level {level + 1}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{expSystem?.totalExp || 0}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activities.length}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Recent Activity</Text>
        {activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>No activity yet. Start earning XP!</Text>
          </View>
        ) : (
          activities.map((a, i) => (
            <View key={a.id || i} style={styles.activityRow}>
              <View style={styles.activityIcon}>
                <TrendingUp size={16} color="#000000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityName}>{a.description || a.name || 'Activity'}</Text>
                {a.date ? <Text style={styles.activityDate}>{new Date(a.date).toLocaleDateString()}</Text> : null}
              </View>
              <Text style={styles.activityXp}>+{a.amount || a.exp || 0}</Text>
            </View>
          ))
        )}
      </ScrollView>
      <BottomNavigation />
    </View>
  );
}

// Real fix: same dark_navy misused-token bug as the other files already
// fixed this pass. Progress fill (bg_primary) now black, matching the
// same "black for active/highlight" convention used throughout this
// pass. Note: the known 0/0 XP display bug (toNext.current/needed) is
// untouched - a separate, already-flagged functional issue, out of
// scope for this visual-only pass.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  levelCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, alignItems: 'center',
  },
  levelLabel: { color: '#999999', fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  levelNumber: { color: '#000000', fontSize: 72, fontWeight: '700', letterSpacing: -1 },
  progressTrack: {
    width: '100%', height: 6, backgroundColor: '#F5F5F5',
    borderRadius: 3, marginTop: 12, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#000000', borderRadius: 3 },
  progressText: { color: '#999999', fontSize: 12, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, alignItems: 'center',
  },
  statValue: { color: '#000000', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#999999', fontSize: 12, marginTop: 4 },
  sectionLabel: {
    fontSize: 20, fontWeight: '700', color: '#000000', marginTop: tokens.spacing.lg, marginBottom: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, alignItems: 'center',
  },
  empty: { color: '#666666', fontSize: 14 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md,
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: 14, marginBottom: tokens.spacing.sm,
  },
  activityIcon: {
    width: 32, height: 32, borderRadius: tokens.radius.lg,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  activityName: { color: '#000000', fontSize: 14, fontWeight: '500' },
  activityDate: { color: '#999999', fontSize: 12, marginTop: 2 },
  activityXp: { color: '#22C55E', fontSize: 14, fontWeight: '700' },
});

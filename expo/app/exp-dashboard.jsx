import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import BottomNavigation from '@/components/BottomNavigation';
import { useExpStore } from '@/store/expStore';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 180 }}>
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
                <TrendingUp size={16} color={tokens.colors.background.default} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  levelCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 24, alignItems: 'center',
  },
  levelLabel: { color: '#999', fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  levelNumber: { color: tokens.colors.background.default, fontSize: 72, fontWeight: '700', letterSpacing: -1 },
  progressTrack: {
    width: '100%', height: 6, backgroundColor: '#2A2A2A',
    borderRadius: 3, marginTop: 12, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: tokens.colors.background.default, borderRadius: 3 },
  progressText: { color: '#999', fontSize: 12, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16, alignItems: 'center',
  },
  statValue: { color: tokens.colors.background.default, fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#999', fontSize: 12, marginTop: 4 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginTop: 24, marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 24, alignItems: 'center',
  },
  empty: { color: '#999', fontSize: 14 },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 14, marginBottom: 8,
  },
  activityIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  activityName: { color: tokens.colors.background.default, fontSize: 14, fontWeight: '500' },
  activityDate: { color: '#999', fontSize: 12, marginTop: 2 },
  activityXp: { color: '#22C55E', fontSize: 14, fontWeight: '700' },
});

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRunningStore } from '@/store/runningStore';
import { lightColors } from '../../../theme/tokens';

export default function RunningLogScreen() {
  const { runs } = useRunningStore();
  const [filter, setFilter] = useState('All'); // All, Week, Month, Year

  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    const now = new Date();
    return runs.filter(run => {
      if (!run.startTime) return false;
      const runDate = new Date(run.startTime);
      const diffTime = Math.abs(now - runDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (filter === 'Week') return diffDays <= 7;
      if (filter === 'Month') return diffDays <= 30;
      if (filter === 'Year') return diffDays <= 365;
      return true;
    });
  }, [runs, filter]);

  const stats = useMemo(() => {
    const totalRuns = filteredRuns.length;
    const totalDistance = filteredRuns.reduce((s, r) => s + (r.distance || 0), 0);
    const totalDuration = filteredRuns.reduce((s, r) => s + (r.duration || 0), 0);
    const avgPace = totalRuns > 0 ? filteredRuns.reduce((s, r) => s + (r.pace || 0), 0) / totalRuns : 0;
    
    // Formatting helper
    const formatDuration = (secs) => {
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      if (h > 0) {
        return h + 'h ' + m + 'm';
      }
      return m + 'm ' + s + 's';
    };

    const formatPace = (p) => {
      if (!p) return '0:00 /km';
      const min = Math.floor(p);
      const sec = Math.round((p - min) * 60);
      return min + ':' + (sec < 10 ? '0' : '') + sec + ' /km';
    };

    return {
      totalRuns,
      totalDistance: totalDistance.toFixed(2) + ' km',
      totalTime: formatDuration(totalDuration),
      avgPace: formatPace(avgPace),
    };
  }, [filteredRuns]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Running Log</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.totalRuns}</Text>
              <Text style={styles.statLbl}>Runs</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.totalDistance}</Text>
              <Text style={styles.statLbl}>Distance</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.totalTime}</Text>
              <Text style={styles.statLbl}>Total Time</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.avgPace}</Text>
              <Text style={styles.statLbl}>Avg Pace</Text>
            </View>
          </View>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterBar}>
          {['All', 'Week', 'Month', 'Year'].map((p) => (
            <Pressable
              key={p}
              style={[styles.filterPill, filter === p && styles.filterPillActive]}
              onPress={() => setFilter(p)}
            >
              <Text style={[styles.filterText, filter === p && styles.filterTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* List of Runs */}
        <Text style={styles.sectionTitle}>Recent Runs</Text>
        {filteredRuns.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>No Runs Recorded</Text>
            <Text style={styles.emptySubtitle}>Pushed runs will appear here once you hit the road!</Text>
          </View>
        ) : (
          filteredRuns.map((run) => {
            const dateStr = run.startTime ? new Date(run.startTime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }) : 'Unknown Date';
            const timeStr = run.startTime ? new Date(run.startTime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }) : '';

            const formatDuration = (secs) => {
              const m = Math.floor(secs / 60);
              const s = Math.floor(secs % 60);
              return m + ':' + (s < 10 ? '0' : '') + s;
            };

            const formatPace = (p) => {
              if (!p) return '0:00';
              const min = Math.floor(p);
              const sec = Math.round((p - min) * 60);
              return min + ':' + (sec < 10 ? '0' : '') + sec;
            };

            return (
              <View key={run.id || Math.random().toString()} style={styles.runCard}>
                <View style={styles.runHeader}>
                  <View>
                    <Text style={styles.runTitle}>{run.route || 'Free Run'}</Text>
                    <Text style={styles.runDate}>{dateStr} â¢ {timeStr}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                </View>

                <View style={styles.runStatsGrid}>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatVal}>{run.distance ? run.distance.toFixed(2) : '0.00'} km</Text>
                    <Text style={styles.runStatLbl}>Distance</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatVal}>{formatDuration(run.duration || 0)}</Text>
                    <Text style={styles.runStatLbl}>Time</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatVal}>{formatPace(run.pace || 0)} /km</Text>
                    <Text style={styles.runStatLbl}>Pace</Text>
                  </View>
                </View>

                {/* Map thumbnail placeholder */}
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={24} color="#666" style={{ marginRight: 8 }} />
                  <Text style={styles.mapText}>GPS Route Captured</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  headerRightPlaceholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  /* Stats */
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 20, fontWeight: '800', color: '#000' },
  statLbl: { fontSize: 11, color: '#999', marginTop: 2, textTransform: 'uppercase' },
  statsDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },

  /* Filters */
  filterBar: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  filterPillActive: { backgroundColor: '#000' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#FFF' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 13, color: '#999', textAlign: 'center', paddingHorizontal: 40 },

  /* Run Cards */
  runCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  runHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  runTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  runDate: { fontSize: 12, color: '#999', marginTop: 2 },
  runStatsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  runStat: { flex: 1 },
  runStatVal: { fontSize: 15, fontWeight: '800', color: '#000' },
  runStatLbl: { fontSize: 10, color: '#999', marginTop: 2 },
  mapPlaceholder: {
    height: 64,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  mapText: { fontSize: 12, fontWeight: '600', color: '#666' },
});

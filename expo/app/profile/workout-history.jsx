import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useUserStore } from '@/store/userStore';

export default function WorkoutHistoryScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { completedWorkouts, loadWorkouts, getWorkoutStreak } = useWorkoutStore();
  const { user } = useUserStore();

  const [filter, setFilter] = useState('All');

  const filteredWorkouts = useMemo(() => {
    const list = [...(completedWorkouts || [])].reverse();
    if (filter === 'All') return list;
    const now = new Date();
    return list.filter((w) => {
      const dateStr = w.completedAt || w.timestamp;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (filter === 'Week') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (filter === 'Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (filter === 'Year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [completedWorkouts, filter]);

  const formatDuration = (totalSeconds) => {
    const m = Math.floor((totalSeconds || 0) / 60);
    const s = Math.floor((totalSeconds || 0) % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  const rawStreak = getWorkoutStreak ? getWorkoutStreak() : { current: 0, longest: 0 };
  const totalWorkouts = (completedWorkouts || []).length;
  const totalCalories = (completedWorkouts || []).reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  const totalDurationSecs = (completedWorkouts || []).reduce((sum, w) => sum + (w.duration || 0), 0);
  const stats = {
    totalWorkouts,
    totalCalories: totalCalories.toLocaleString(),
    totalTime: (() => {
      const h = Math.floor(totalDurationSecs / 3600);
      const m = Math.floor((totalDurationSecs % 3600) / 60);
      return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
    })(),
    streak: rawStreak.current,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.uid && loadWorkouts) {
        await loadWorkouts(user.uid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Workout History</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <View style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.totalWorkouts}</Text>
              <Text style={styles.statLbl}>Workouts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.totalCalories}</Text>
              <Text style={styles.statLbl}>Calories</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.totalTime}</Text>
              <Text style={styles.statLbl}>Total Time</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.streak}</Text>
              <Text style={styles.statLbl}>Day Streak</Text>
            </View>
          </View>
        </View>

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

        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        {filteredWorkouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>No Workouts Recorded</Text>
            <Text style={styles.emptySubtitle}>Completed workouts will appear here once you finish one!</Text>
          </View>
        ) : (
          filteredWorkouts.map((workout) => {
            const dateStr = workout.completedAt ? new Date(workout.completedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }) : 'Unknown Date';
            const timeStr = workout.completedAt ? new Date(workout.completedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            }) : '';

            return (
              <View key={workout.id || Math.random().toString()} style={styles.runCard}>
                <View style={styles.runHeader}>
                  <View>
                    <Text style={styles.runTitle}>{workout.name || 'Workout'}</Text>
                    <Text style={styles.runDate}>{dateStr} • {timeStr}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#999" />
                </View>

                <View style={styles.runStatsGrid}>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatVal}>{formatDuration(workout.duration || 0)}</Text>
                    <Text style={styles.runStatLbl}>Duration</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatVal}>{workout.caloriesBurned || 0}</Text>
                    <Text style={styles.runStatLbl}>Calories</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatVal}>{workout.category || '—'}</Text>
                    <Text style={styles.runStatLbl}>Category</Text>
                  </View>
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

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 13, color: '#999', textAlign: 'center', paddingHorizontal: 40 },

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
  runStatsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  runStat: { flex: 1 },
  runStatVal: { fontSize: 15, fontWeight: '800', color: '#000' },
  runStatLbl: { fontSize: 10, color: '#999', marginTop: 2 },
});

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';
import { computeCalorieMetrics } from '@/lib/calorieMetrics';

export default function CalorieHistoryScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('All');
  const { completedWorkouts, loadWorkouts } = useWorkoutStore();
  const { runs, loadRuns } = useRunningStore();
  const { user } = useUserStore();

  const metrics = useMemo(
    () => computeCalorieMetrics(completedWorkouts, runs, user?.dailyCalorieGoal),
    [completedWorkouts, runs, user?.dailyCalorieGoal]
  );

  const filteredEntries = useMemo(() => {
    const list = [...metrics.entries].reverse(); // newest first
    if (filter === 'All') return list;
    const now = new Date();
    return list.filter((e) => {
      const d = new Date(e.dateStr);
      if (filter === 'Week') return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (filter === 'Month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (filter === 'Year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [metrics.entries, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.uid) {
        await Promise.all([loadWorkouts?.(user.uid), loadRuns?.(user.uid)]);
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
        <Text style={styles.headerTitle}>Calorie History</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
        <View style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.todayCalories}</Text>
              <Text style={styles.statLbl}>Today</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.streak}</Text>
              <Text style={styles.statLbl}>Day Streak</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{Math.round(metrics.sevenDayAverage)}</Text>
              <Text style={styles.statLbl}>7-Day Avg</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{metrics.lifetimeCalories.toLocaleString()}</Text>
              <Text style={styles.statLbl}>Lifetime</Text>
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

        <Text style={styles.sectionTitle}>Sessions</Text>
        {filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flame-outline" size={48} color="#CCC" />
            <Text style={styles.emptyTitle}>No Calories Logged</Text>
            <Text style={styles.emptySubtitle}>Completed workouts and runs will appear here.</Text>
          </View>
        ) : (
          filteredEntries.map((e, i) => {
            const dateStr = new Date(e.dateStr).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            const timeStr = new Date(e.dateStr).toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit',
            });
            const rate = e.durationSecs > 0 ? (e.calories / (e.durationSecs / 60)).toFixed(1) : '—';
            return (
              <View key={i} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View>
                    <Text style={styles.entryTitle}>{e.category}</Text>
                    <Text style={styles.entryDate}>{dateStr} • {timeStr}</Text>
                  </View>
                  <Text style={styles.entryCalories}>{e.calories} cal</Text>
                </View>
                <Text style={styles.entryRate}>{rate} cal/min</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  headerRightPlaceholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  statsCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#F0F0F0',
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
  filterPill: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F5F5F5', alignItems: 'center' },
  filterPillActive: { backgroundColor: '#000' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#FFF' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 13, color: '#999', textAlign: 'center', paddingHorizontal: 40 },

  entryCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  entryDate: { fontSize: 12, color: '#999', marginTop: 2 },
  entryCalories: { fontSize: 18, fontWeight: '800', color: '#F97316' },
  entryRate: { fontSize: 11, color: '#999', marginTop: 6 },
});

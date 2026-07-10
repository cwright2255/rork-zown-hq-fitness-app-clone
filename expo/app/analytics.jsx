import React, { useState, useMemo } from 'react';
  const { completedWorkouts } = useWorkoutStore();
  const { totalExp } = useExpStore();
  const { hydration, sleep, steps: storeSteps } = useHealthStore();
  const { runs } = useRunningStore();

  const filterByPeriod = (items, period, dateKey) => {
    const key = dateKey || 'completedAt';
    const now = new Date();
    return (items || []).filter(item => {
      const d = item[key];
      if (!d) return false;
      const date = new Date(d);
      if (period === 'Day') return date.toDateString() === now.toDateString();
      if (period === 'Week') return date >= new Date(now.getTime() - 7*24*60*60*1000);
      if (period === 'Month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const filteredWorkouts = filterByPeriod(completedWorkouts || [], period);
  const filteredRuns = filterByPeriod(runs || [], period, 'endTime');
  const liveOverview = {
    workouts: filteredWorkouts.length,
    calories: (filteredWorkouts.reduce((s,w) => s+(w.caloriesBurned||w.calories||0),0) + filteredRuns.reduce((s,r) => s+(r.calories||0),0)).toLocaleString(),
    xp: (totalExp || 0).toLocaleString(),
  };

import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useExpStore } from '@/store/expStore';
import { useHealthStore } from '@/store/healthStore';
import { useRunningStore } from '@/store/runningStore';

/* ââ Data by time filter ââ */

const OVERVIEW = {
  Day:   { workouts: 1,  calories: '320',   xp: '100' },
  Week:  { workouts: 5,  calories: '1,850', xp: '650' },
  Month: { workouts: 18, calories: '7,200', xp: '2,400' },
};

const BAR_DATA = {
  Day:   [{ l: '6a', h: 20 },{ l: '8a', h: 60 },{ l: '10a', h: 30 },{ l: '12p', h: 10 },{ l: '2p', h: 0 },{ l: '4p', h: 40 },{ l: '6p', h: 80 }],
  Week:  [{ l: 'Mon', h: 40 },{ l: 'Tue', h: 65 },{ l: 'Wed', h: 90 },{ l: 'Thu', h: 30 },{ l: 'Fri', h: 75 },{ l: 'Sat', h: 50 },{ l: 'Sun', h: 20 }],
  Month: [{ l: 'W1', h: 55 },{ l: 'W2', h: 70 },{ l: 'W3', h: 85 },{ l: 'W4', h: 60 }],
};

const RUNNING_STATS = {
  Day:   { dist: '4.2 km',  pace: "5'42\"/km", longest: '4.2 km', time: '32 min' },
  Week:  { dist: '23.5 km', pace: "5'42\"/km", longest: '8.2 km', time: '2h 15m' },
  Month: { dist: '89.3 km', pace: "5'42\"/km", longest: '8.2 km', time: '9h 45m' },
};

const WORKOUT_STATS = {
  Day:   { sessions: '1',  avgDur: '35 min', cal: '320 kcal',   day: 'Wednesday' },
  Week:  { sessions: '5',  avgDur: '35 min', cal: '1,850 kcal', day: 'Wednesday' },
  Month: { sessions: '18', avgDur: '35 min', cal: '7,200 kcal', day: 'Wednesday' },
};

const BREAKDOWN = [
  { label: 'HIIT',     pct: 35, color: '#000' },
  { label: 'Strength', pct: 25, color: '#333' },
  { label: 'Cardio',   pct: 20, color: '#666' },
  { label: 'Yoga',     pct: 10, color: '#999' },
  { label: 'Other',    pct: 10, color: '#CCC' },
];

const RECORDS = [
  { title: 'Fastest 5K',             value: '24:32',    date: 'May 28' },
  { title: 'Longest Run',            value: '8.2 km',   date: 'Jun 1' },
  { title: 'Most Calories (Single)', value: '520 kcal', date: 'May 25' },
  { title: 'Longest Streak',         value: '7 days',   date: 'Current' },
  { title: 'Highest XP Day',         value: '350 XP',   date: 'Jun 2' },
];

const RECENT = [
  { id: 'r1', title: 'Morning 5K',    sub: 'Running \u2022 28 min \u2022 4.8 km',  xp: '+150 XP', icon: 'fitness' },
  { id: 'r2', title: 'HIIT Blast',    sub: 'Workout \u2022 30 min \u2022 320 kcal', xp: '+100 XP', icon: 'barbell' },
  { id: 'r3', title: 'Evening Jog',   sub: 'Running \u2022 22 min \u2022 3.5 km',  xp: '+80 XP',  icon: 'fitness' },
  { id: 'r4', title: 'Strength Core', sub: 'Workout \u2022 45 min \u2022 280 kcal', xp: '+120 XP', icon: 'barbell' },
  { id: 'r5', title: 'Hill Sprints',  sub: 'Running \u2022 20 min \u2022 2.8 km',  xp: '+100 XP', icon: 'fitness' },
];

/* ââ Pill component ââ */
function Pill({ label, active, onPress, small }) {
  return (
    <Pressable
      style={[small ? styles.smallPill : styles.pill, active && (small ? styles.smallPillActive : styles.pillActive)]}
      onPress={onPress}
    >
      <Text style={[small ? styles.smallPillText : styles.pillText, active && (small ? styles.smallPillTextActive : styles.pillTextActive)]}>
        {label}
      </Text>
    </Pressable>
  );
}
/* ââ Main screen ââ */

export default function AnalysisScreen() {
  const [timeFilter, setTimeFilter] = useState('Week');
  const [activityFilter, setActivityFilter] = useState('All');

  const ov = OVERVIEW[timeFilter];
  const bars = BAR_DATA[timeFilter];
  const maxBar = Math.max(...bars.map((b) => b.h), 1);
  const rs = RUNNING_STATS[timeFilter];
  const ws = WORKOUT_STATS[timeFilter];

  const showRunning = activityFilter === 'All' || activityFilter === 'Running';
  const showWorkouts = activityFilter === 'All' || activityFilter === 'Workouts';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Logo */}
        <View style={styles.logoRow}>
          <Image source={require('@/assets/branding/zown-logo-512.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.pageTitle}>Analysis</Text>

        {/* Time filter */}
        <View style={styles.filterRow}>
          {['Day', 'Week', 'Month'].map((f) => (
            <Pill key={f} label={f} active={timeFilter === f} onPress={() => setTimeFilter(f)} />
          ))}
        </View>

        {/* Activity filter */}
        <View style={styles.filterRow2}>
          {['All', 'Workouts', 'Running'].map((f) => (
            <Pill key={f} label={f} active={activityFilter === f} onPress={() => setActivityFilter(f)} small />
          ))}
        </View>

        {/* Overview stats */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewCard}>
            <Ionicons name="barbell-outline" size={20} color="#000" />
            <Text style={styles.overviewNum}>{ov.workouts}</Text>
            <Text style={styles.overviewLabel}>Workouts</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="flame-outline" size={20} color="#000" />
            <Text style={styles.overviewNum}>{ov.calories}</Text>
            <Text style={styles.overviewLabel}>Calories</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="star-outline" size={20} color="#000" />
            <Text style={styles.overviewNum}>{ov.xp}</Text>
            <Text style={styles.overviewLabel}>XP Earned</Text>
          </View>
        </View>

        {/* Bar chart */}
        <Text style={styles.sectionTitle}>Activity</Text>
        <View style={styles.card}>
          <View style={styles.chartArea}>
            {bars.map((b, i) => (
              <View key={b.l} style={styles.barCol}>
                <View style={[styles.bar, { height: Math.max(4, (b.h / maxBar) * 140) }]} />
                <Text style={styles.barLabel}>{b.l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Workout breakdown */}
        {showWorkouts && (
          <>
            <Text style={styles.sectionTitle}>Workout Breakdown</Text>
            <View style={styles.card}>
              <View style={styles.breakdownBar}>
                {BREAKDOWN.map((s) => (
                  <View key={s.label} style={{ width: s.pct + '%', backgroundColor: s.color, height: 12 }} />
                ))}
              </View>
              <View style={styles.legendWrap}>
                {BREAKDOWN.map((s) => (
                  <View key={s.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                    <Text style={styles.legendText}>{s.label}</Text>
                    <Text style={styles.legendCount}>{s.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Running stats */}
        {showRunning && (
          <>
            <Text style={styles.sectionTitle}>Running Stats</Text>
            <View style={styles.card}>
              <View style={styles.statsGrid}>
                <View style={styles.statCell}><Text style={styles.statLabel}>Total Distance</Text><Text style={styles.statVal}>{rs.dist}</Text></View>
                <View style={styles.statCell}><Text style={styles.statLabel}>Avg Pace</Text><Text style={styles.statVal}>{rs.pace}</Text></View>
                <View style={styles.statCell}><Text style={styles.statLabel}>Longest Run</Text><Text style={styles.statVal}>{rs.longest}</Text></View>
                <View style={styles.statCell}><Text style={styles.statLabel}>Total Time</Text><Text style={styles.statVal}>{rs.time}</Text></View>
              </View>
            </View>
          </>
        )}

        {/* Workout stats */}
        {showWorkouts && (
          <>
            <Text style={styles.sectionTitle}>Workout Stats</Text>
            <View style={styles.card}>
              <View style={styles.statsGrid}>
                <View style={styles.statCell}><Text style={styles.statLabel}>Total Sessions</Text><Text style={styles.statVal}>{ws.sessions}</Text></View>
                <View style={styles.statCell}><Text style={styles.statLabel}>Avg Duration</Text><Text style={styles.statVal}>{ws.avgDur}</Text></View>
                <View style={styles.statCell}><Text style={styles.statLabel}>Calories Burned</Text><Text style={styles.statVal}>{ws.cal}</Text></View>
                <View style={styles.statCell}><Text style={styles.statLabel}>Most Active Day</Text><Text style={styles.statVal}>{ws.day}</Text></View>
              </View>
            </View>
          </>
        )}

        {/* Personal records */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Personal Records</Text>
          <Ionicons name="trophy" size={18} color="#FFD700" />
        </View>
        <View style={styles.card}>
          {RECORDS.map((r, i) => (
            <View key={r.title} style={[styles.recordRow, i === RECORDS.length - 1 && { borderBottomWidth: 0 }]}>
              <Ionicons name="trophy-outline" size={20} color="#FFD700" style={{ width: 30 }} />
              <Text style={styles.recordTitle}>{r.title}</Text>
              <Text style={styles.recordValue}>{r.value}</Text>
              <Text style={styles.recordDate}>{r.date}</Text>
            </View>
          ))}
        </View>

        {/* Recent activity */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable><Text style={styles.viewAll}>View All</Text></Pressable>
        </View>
        {RECENT.map((a) => (
          <View key={a.id} style={styles.recentRow}>
            <View style={styles.recentIcon}><Ionicons name={a.icon} size={18} color="#000" /></View>
            <View style={styles.recentInfo}>
              <Text style={styles.recentTitle}>{a.title}</Text>
              <Text style={styles.recentSub}>{a.sub}</Text>
            </View>
            <Text style={styles.recentXp}>{a.xp}</Text>
          </View>
        ))}
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

  /* Filters */
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 12, marginTop: 8 },
  filterRow2: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 20 },
  pill: { backgroundColor: '#F0F0F0', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  pillActive: { backgroundColor: '#000' },
  pillText: { fontSize: 13, fontWeight: '700', color: '#333' },
  pillTextActive: { color: '#FFF' },
  smallPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  smallPillActive: { backgroundColor: '#333' },
  smallPillText: { fontSize: 12, fontWeight: '600', color: '#666' },
  smallPillTextActive: { color: '#FFF' },

  /* Overview */
  overviewRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 },
  overviewCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 14, alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  overviewNum: { fontSize: 24, fontWeight: '800', color: '#000', marginTop: 4 },
  overviewLabel: { fontSize: 10, color: '#999', marginTop: 2 },

  /* Section */
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginTop: 20, marginBottom: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 4 },
  viewAll: { fontSize: 13, fontWeight: '600', color: '#666' },

  /* Card */
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginTop: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },

  /* Chart */
  chartArea: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 160 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 28, borderRadius: 14, backgroundColor: '#000' },
  barLabel: { fontSize: 11, color: '#999', marginTop: 6 },

  /* Breakdown */
  breakdownBar: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden', marginBottom: 12 },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#333' },
  legendCount: { fontSize: 12, fontWeight: '600', color: '#000' },

  /* Stats grid */
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', paddingVertical: 8 },
  statLabel: { fontSize: 12, color: '#999' },
  statVal: { fontSize: 20, fontWeight: '700', color: '#000', marginTop: 2 },

  /* Records */
  recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  recordTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#000' },
  recordValue: { fontSize: 14, fontWeight: '700', color: '#000', marginRight: 8 },
  recordDate: { fontSize: 11, color: '#999', width: 50, textAlign: 'right' },

  /* Recent */
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingHorizontal: 20 },
  recentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  recentInfo: { flex: 1, marginLeft: 12 },
  recentTitle: { fontSize: 14, fontWeight: '600', color: '#000' },
  recentSub: { fontSize: 12, color: '#999', marginTop: 2 },
  recentXp: { fontSize: 13, fontWeight: '700', color: '#000' },
});

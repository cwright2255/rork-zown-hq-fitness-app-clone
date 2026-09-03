import EmptyState from '@/src/components/EmptyState';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView,
  RefreshControl, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useUserStore } from '@/store/userStore';

/* -- Real calendar boundaries, same logic already proven correct in
   store/challengeStore.js / functions/src/index.js's generateChallenges
   -- kept in sync with that same Mon-Sun week / calendar month
   definition rather than inventing a second convention here. -- */
function getDayRange(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}
function getWeekRange(now) {
  const dayNum = (now.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayNum);
  const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  return { start: monday, end: sunday };
}
function getMonthRange(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
function getRangeForFilter(filter, now = new Date()) {
  if (filter === 'Day') return getDayRange(now);
  if (filter === 'Month') return getMonthRange(now);
  return getWeekRange(now);
}

function parseDate(value) {
  if (!value) return null;
  // Handles a real ISO string (the normal case -- completedAt/endTime/
  // startTime are always set this way), and defensively also a raw
  // Firestore Timestamp object (has .toDate()) in case a fallback field
  // is ever the only one present, rather than silently producing an
  // Invalid Date that would just vanish from every computation below.
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function workoutDate(w) {
  return parseDate(w.completedAt || w.date || w.timestamp);
}
function runDate(r) {
  return parseDate(r.endTime || r.startTime);
}

function inRange(date, range) {
  return !!date && date >= range.start && date <= range.end;
}

function fmtNum(n) {
  return Math.round(n).toLocaleString();
}
function fmtKm(n) {
  return `${(Math.round(n * 10) / 10).toFixed(1)} km`;
}
function fmtPace(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return '--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, '0')}"/km`;
}
function fmtDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0 min';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}
function fmtShortDate(date) {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Real per-workout duration is stored in seconds for real completed
// sessions (app/workout/active.jsx) but in minutes for saved templates
// (app/workout/quick.jsx) -- see store/challengeStore.js's identical
// note. A workout's real completion record always carries duration in
// seconds (it's written by active.jsx's real completion flow, not
// copied from a template), so that's the only case this screen needs
// to handle, but this guard keeps a implausibly-small value (a
// duration under 10, which could only be minutes mistaken for seconds)
// from turning into a near-zero bar on the chart.
function workoutDurationSeconds(w) {
  const d = w.duration || 0;
  return d < 10 && d > 0 ? d * 60 : d;
}

/* -- Pill component -- */
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

/* -- Main screen -- */

export default function AnalysisScreen() {
  const [timeFilter, setTimeFilter] = useState('Week');
  const [activityFilter, setActivityFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useUserStore();
  const { completedWorkouts, loadWorkouts, getWorkoutStreak } = useWorkoutStore();
  const { runs, loadRuns } = useRunningStore();

  useEffect(() => {
    if (user?.uid) {
      loadWorkouts(user.uid);
      loadRuns(user.uid);
    }
  }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      user?.uid ? loadWorkouts(user.uid) : Promise.resolve(),
      user?.uid ? loadRuns(user.uid) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const showRunning = activityFilter === 'All' || activityFilter === 'Running';
  const showWorkouts = activityFilter === 'All' || activityFilter === 'Workouts';

  const range = useMemo(() => getRangeForFilter(timeFilter), [timeFilter]);

  const workoutsInRange = useMemo(
    () => (completedWorkouts || []).filter((w) => inRange(workoutDate(w), range)),
    [completedWorkouts, range]
  );
  const runsInRange = useMemo(
    () => (runs || []).filter((r) => inRange(runDate(r), range)),
    [runs, range]
  );

  /* -- Overview: real counts, real calories, real XP (workout-sourced
     only -- see workoutDurationSeconds comment above and the module
     header note on why runs can't honestly contribute a per-period XP
     figure here). -- */
  const overview = useMemo(() => {
    const workoutCals = workoutsInRange.reduce((s, w) => s + (w.caloriesBurned || 0), 0);
    const runCals = runsInRange.reduce((s, r) => s + (r.calories || 0), 0);
    const xp = workoutsInRange.reduce((s, w) => s + (w.xpEarned || 0), 0);
    return {
      activities: workoutsInRange.length + runsInRange.length,
      calories: workoutCals + runCals,
      xp,
    };
  }, [workoutsInRange, runsInRange]);

  /* -- Activity bar chart: real calories per bucket, bucketed by hour
     for Day, day-of-week for Week, week-of-month for Month. With real,
     likely-sparse data most buckets will genuinely be empty -- that's
     correct, not a bug. -- */
  const bars = useMemo(() => {
    const combined = [
      ...workoutsInRange.map((w) => ({ date: workoutDate(w), cal: w.caloriesBurned || 0 })),
      ...runsInRange.map((r) => ({ date: runDate(r), cal: r.calories || 0 })),
    ].filter((x) => x.date);

    if (timeFilter === 'Day') {
      const buckets = [6, 8, 10, 12, 14, 16, 18, 20].map((h) => ({
        l: h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`, h: 0, hourStart: h,
      }));
      combined.forEach(({ date, cal }) => {
        const hour = date.getHours();
        const bucket = [...buckets].reverse().find((b) => hour >= b.hourStart);
        if (bucket) bucket.h += cal;
      });
      return buckets.map((b) => ({ l: b.l, h: b.h }));
    }

    if (timeFilter === 'Month') {
      const buckets = [1, 2, 3, 4, 5].map((w) => ({ l: `W${w}`, h: 0 }));
      combined.forEach(({ date, cal }) => {
        const weekOfMonth = Math.floor((date.getDate() - 1) / 7);
        if (buckets[weekOfMonth]) buckets[weekOfMonth].h += cal;
      });
      return buckets.filter((b, i) => i < 4 || b.h > 0); // drop a mostly-unused 5th week bucket
    }

    // Week: real Mon-Sun buckets
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets = labels.map((l) => ({ l, h: 0 }));
    combined.forEach(({ date, cal }) => {
      const dayNum = (date.getDay() + 6) % 7;
      buckets[dayNum].h += cal;
    });
    return buckets;
  }, [workoutsInRange, runsInRange, timeFilter]);
  const maxBar = Math.max(...bars.map((b) => b.h), 1);
  const hasAnyBarData = bars.some((b) => b.h > 0);

  /* -- Workout breakdown: real categories from real completed workouts
     in range -- whatever categories actually appear, in whatever real
     proportions, not a fixed 5-category list. -- */
  const breakdown = useMemo(() => {
    if (workoutsInRange.length === 0) return [];
    const counts = {};
    workoutsInRange.forEach((w) => {
      const cat = w.category || 'Other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    const palette = ['#000', '#333', '#666', '#999', '#CCC', '#444', '#777'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], i) => ({
        label,
        pct: Math.round((count / workoutsInRange.length) * 100),
        color: palette[i % palette.length],
      }));
  }, [workoutsInRange]);

  /* -- Running stats, period-filtered from real runs. -- */
  const runningStats = useMemo(() => {
    if (runsInRange.length === 0) return null;
    const totalDistance = runsInRange.reduce((s, r) => s + (r.distance || 0), 0);
    const totalDuration = runsInRange.reduce((s, r) => s + (r.duration || 0), 0);
    const longest = runsInRange.reduce((best, r) => (!best || r.distance > best.distance ? r : best), null);
    const withPace = runsInRange.filter((r) => r.pace > 0);
    const avgPace = withPace.length
      ? withPace.reduce((s, r) => s + r.pace, 0) / withPace.length
      : 0;
    return {
      dist: fmtKm(totalDistance),
      pace: fmtPace(avgPace),
      longest: fmtKm(longest?.distance || 0),
      time: fmtDuration(totalDuration),
    };
  }, [runsInRange]);

  /* -- Workout stats, period-filtered from real completed workouts. -- */
  const workoutStats = useMemo(() => {
    if (workoutsInRange.length === 0) return null;
    const totalDurationSec = workoutsInRange.reduce((s, w) => s + workoutDurationSeconds(w), 0);
    const totalCal = workoutsInRange.reduce((s, w) => s + (w.caloriesBurned || 0), 0);
    const dayCounts = {};
    workoutsInRange.forEach((w) => {
      const d = workoutDate(w);
      if (!d) return;
      dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
    });
    const mostActiveDayNum = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      sessions: String(workoutsInRange.length),
      avgDur: fmtDuration(totalDurationSec / workoutsInRange.length),
      cal: `${fmtNum(totalCal)} kcal`,
      day: mostActiveDayNum !== undefined ? DAY_NAMES[Number(mostActiveDayNum)] : '--',
    };
  }, [workoutsInRange]);

  /* -- Personal records: always all-time, never filtered by the current
     period selector -- a "personal record" that resets every week isn't
     a personal record. Every entry is null (and hidden) rather than
     fabricated when no qualifying activity exists yet, same convention
     store/runningStore.js's own getPersonalRecords already uses. -- */
  const records = useMemo(() => {
    const list = [];

    const runsWithData = runs || [];
    const fiveKRuns = runsWithData.filter((r) => r.distance >= 4.5);
    if (fiveKRuns.length > 0) {
      const best = fiveKRuns.reduce((b, r) => (r.duration < b.duration ? r : b));
      list.push({ title: 'Fastest 5K', value: fmtDuration(best.duration), date: fmtShortDate(runDate(best)) });
    }
    const longestRun = runsWithData.reduce((b, r) => (!b || r.distance > b.distance ? r : b), null);
    if (longestRun) {
      list.push({ title: 'Longest Run', value: fmtKm(longestRun.distance), date: fmtShortDate(runDate(longestRun)) });
    }

    const calorieCandidates = [
      ...(completedWorkouts || []).map((w) => ({ cal: w.caloriesBurned || 0, date: workoutDate(w) })),
      ...runsWithData.map((r) => ({ cal: r.calories || 0, date: runDate(r) })),
    ].filter((c) => c.cal > 0);
    if (calorieCandidates.length > 0) {
      const best = calorieCandidates.reduce((b, c) => (c.cal > b.cal ? c : b));
      list.push({ title: 'Most Calories (Single)', value: `${fmtNum(best.cal)} kcal`, date: fmtShortDate(best.date) });
    }

    const streak = getWorkoutStreak();
    if (streak.longest > 0) {
      list.push({
        title: 'Longest Streak',
        value: `${streak.longest} day${streak.longest === 1 ? '' : 's'}`,
        date: streak.current === streak.longest && streak.current > 0 ? 'Current' : '',
      });
    }

    const xpByDay = {};
    (completedWorkouts || []).forEach((w) => {
      const d = workoutDate(w);
      if (!d || !w.xpEarned) return;
      const key = d.toDateString();
      xpByDay[key] = (xpByDay[key] || 0) + w.xpEarned;
    });
    const bestXpDay = Object.entries(xpByDay).sort((a, b) => b[1] - a[1])[0];
    if (bestXpDay) {
      list.push({ title: 'Highest XP Day', value: `${fmtNum(bestXpDay[1])} XP`, date: fmtShortDate(new Date(bestXpDay[0])) });
    }

    return list;
  }, [completedWorkouts, runs, getWorkoutStreak]);

  /* -- Recent activity: real completed workouts + real runs merged and
     sorted by real date, always most-recent-first regardless of the
     current Day/Week/Month filter -- a "recent activity" feed scoped to
     "today" would be nearly always empty. XP is only shown for
     workouts, since only workouts carry a real, traceable xpEarned
     value (see module header note). -- */
  const recentActivity = useMemo(() => {
    const items = [
      ...(showWorkouts ? (completedWorkouts || []).map((w) => ({
        id: `w-${w.workoutId || w.id || w.completedAt}`,
        title: w.name || 'Workout',
        sub: `Workout \u2022 ${fmtDuration(workoutDurationSeconds(w))}${w.caloriesBurned ? ` \u2022 ${fmtNum(w.caloriesBurned)} kcal` : ''}`,
        xp: w.xpEarned ? `+${fmtNum(w.xpEarned)} XP` : null,
        icon: 'barbell',
        date: workoutDate(w),
      })) : []),
      ...(showRunning ? (runs || []).map((r) => ({
        id: `r-${r.id}`,
        title: 'Run',
        sub: `Running \u2022 ${fmtDuration(r.duration)}${r.distance ? ` \u2022 ${fmtKm(r.distance)}` : ''}`,
        xp: null,
        icon: 'fitness',
        date: runDate(r),
      })) : []),
    ]
      .filter((a) => a.date)
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
    return items;
  }, [completedWorkouts, runs, showWorkouts, showRunning]);

  const hasAnyDataInRange = workoutsInRange.length > 0 || runsInRange.length > 0;
  const hasAnyDataAtAll = (completedWorkouts && completedWorkouts.length > 0) || (runs && runs.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }>
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

        {!hasAnyDataAtAll ? (
          <EmptyState
            icon="TrendingUp"
            title="No activity yet"
            subtitle="Complete a workout or log a run to see real stats here"
            buttonText="Go to Workouts"
            onPress={() => {}}
          />
        ) : (
          <>
            {/* Overview stats */}
            <View style={styles.overviewRow}>
              <View style={styles.overviewCard}>
                <Ionicons name="barbell-outline" size={20} color="#000" />
                <Text style={styles.overviewNum}>{overview.activities}</Text>
                <Text style={styles.overviewLabel}>Activities</Text>
              </View>
              <View style={styles.overviewCard}>
                <Ionicons name="flame-outline" size={20} color="#000" />
                <Text style={styles.overviewNum}>{fmtNum(overview.calories)}</Text>
                <Text style={styles.overviewLabel}>Calories</Text>
              </View>
              <View style={styles.overviewCard}>
                <Ionicons name="star-outline" size={20} color="#000" />
                <Text style={styles.overviewNum}>{fmtNum(overview.xp)}</Text>
                <Text style={styles.overviewLabel}>XP Earned</Text>
              </View>
            </View>

            {/* Bar chart */}
            <Text style={styles.sectionTitle}>Activity</Text>
            <View style={styles.card}>
              {hasAnyBarData ? (
                <View style={styles.chartArea}>
                  {bars.map((b) => (
                    <View key={b.l} style={styles.barCol}>
                      <View style={[styles.bar, { height: Math.max(4, (b.h / maxBar) * 140) }]} />
                      <Text style={styles.barLabel}>{b.l}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyCardText}>No activity in this {timeFilter.toLowerCase()} yet</Text>
              )}
            </View>

            {/* Workout breakdown */}
            {showWorkouts && (
              <>
                <Text style={styles.sectionTitle}>Workout Breakdown</Text>
                <View style={styles.card}>
                  {breakdown.length > 0 ? (
                    <>
                      <View style={styles.breakdownBar}>
                        {breakdown.map((s) => (
                          <View key={s.label} style={{ width: s.pct + '%', backgroundColor: s.color, height: 12 }} />
                        ))}
                      </View>
                      <View style={styles.legendWrap}>
                        {breakdown.map((s) => (
                          <View key={s.label} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                            <Text style={styles.legendText}>{s.label}</Text>
                            <Text style={styles.legendCount}>{s.pct}%</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.emptyCardText}>No workouts in this {timeFilter.toLowerCase()} yet</Text>
                  )}
                </View>
              </>
            )}

            {/* Running stats */}
            {showRunning && (
              <>
                <Text style={styles.sectionTitle}>Running Stats</Text>
                <View style={styles.card}>
                  {runningStats ? (
                    <View style={styles.statsGrid}>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Total Distance</Text><Text style={styles.statVal}>{runningStats.dist}</Text></View>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Avg Pace</Text><Text style={styles.statVal}>{runningStats.pace}</Text></View>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Longest Run</Text><Text style={styles.statVal}>{runningStats.longest}</Text></View>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Total Time</Text><Text style={styles.statVal}>{runningStats.time}</Text></View>
                    </View>
                  ) : (
                    <Text style={styles.emptyCardText}>No runs in this {timeFilter.toLowerCase()} yet</Text>
                  )}
                </View>
              </>
            )}

            {/* Workout stats */}
            {showWorkouts && (
              <>
                <Text style={styles.sectionTitle}>Workout Stats</Text>
                <View style={styles.card}>
                  {workoutStats ? (
                    <View style={styles.statsGrid}>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Total Sessions</Text><Text style={styles.statVal}>{workoutStats.sessions}</Text></View>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Avg Duration</Text><Text style={styles.statVal}>{workoutStats.avgDur}</Text></View>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Calories Burned</Text><Text style={styles.statVal}>{workoutStats.cal}</Text></View>
                      <View style={styles.statCell}><Text style={styles.statLabel}>Most Active Day</Text><Text style={styles.statVal}>{workoutStats.day}</Text></View>
                    </View>
                  ) : (
                    <Text style={styles.emptyCardText}>No workouts in this {timeFilter.toLowerCase()} yet</Text>
                  )}
                </View>
              </>
            )}

            {/* Personal records */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Personal Records</Text>
              <Ionicons name="trophy" size={18} color="#FFD700" />
            </View>
            <View style={styles.card}>
              {records.length > 0 ? (
                records.map((r, i) => (
                  <View key={r.title} style={[styles.recordRow, i === records.length - 1 && { borderBottomWidth: 0 }]}>
                    <Ionicons name="trophy-outline" size={20} color="#FFD700" style={{ width: 30 }} />
                    <Text style={styles.recordTitle}>{r.title}</Text>
                    <Text style={styles.recordValue}>{r.value}</Text>
                    <Text style={styles.recordDate}>{r.date}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyCardText}>Complete a workout or run to set your first records</Text>
              )}
            </View>

            {/* Recent activity */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>
            {recentActivity.length > 0 ? (
              recentActivity.map((a) => (
                <View key={a.id} style={styles.recentRow}>
                  <View style={styles.recentIcon}><Ionicons name={a.icon} size={18} color="#000" /></View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentTitle}>{a.title}</Text>
                    <Text style={styles.recentSub}>{a.sub}</Text>
                  </View>
                  {!!a.xp && <Text style={styles.recentXp}>{a.xp}</Text>}
                </View>
              ))
            ) : (
              <Text style={[styles.emptyCardText, { marginHorizontal: 20 }]}>Nothing here yet</Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -- Styles -- */

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

  /* Card */
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginHorizontal: 20, marginTop: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  emptyCardText: { fontSize: 13, color: '#999', textAlign: 'center', paddingVertical: 12 },

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
  recordDate: { fontSize: 11, color: '#999', width: 60, textAlign: 'right' },

  /* Recent */
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingHorizontal: 20 },
  recentIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  recentInfo: { flex: 1, marginLeft: 12 },
  recentTitle: { fontSize: 14, fontWeight: '600', color: '#000' },
  recentSub: { fontSize: 12, color: '#999', marginTop: 2 },
  recentXp: { fontSize: 13, fontWeight: '700', color: '#000' },
});

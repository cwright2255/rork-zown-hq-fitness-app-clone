// components/SwipeableCaloriesContent.jsx
//
// Swipeable Overview/Breakdown/Trends/Lifetime pages for the Home
// screen's Calories widget, driven entirely by lib/calorieMetrics.js's
// real computed numbers - no fabricated fields. "View Full Log" routes
// to the dedicated app/profile/calorie-history.jsx screen.
//
// Height is measured dynamically per page (onLayout), not a fixed guess -
// each of the 4 pages has genuinely different natural content height, so
// any single fixed number is always wrong for at least 3 of them. The
// container resizes to match whichever page is currently visible.
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { router } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Real usable width: screenWidth - H_PAD*2 (44, H_PAD=22 in app/hq.jsx) -
// insightPanel's padding*2 (32, padding:16 in app/hq.jsx).
const PAGE_WIDTH = SCREEN_WIDTH - 76;
const DEFAULT_HEIGHT = 200; // fallback only until the first onLayout measurement lands

export default function SwipeableCaloriesContent({ metrics, onSetGoal }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageHeights, setPageHeights] = useState({});

  const onScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / PAGE_WIDTH);
    if (idx !== pageIndex) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setPageIndex(idx);
    }
  };

  const handlePageLayout = (index) => (e) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setPageHeights((prev) => (prev[index] === h ? prev : { ...prev, [index]: h }));
  };

  const currentHeight = pageHeights[pageIndex] ?? DEFAULT_HEIGHT;

  const goalPct = metrics.dailyCalorieGoal
    ? Math.min(metrics.todayCalories / metrics.dailyCalorieGoal, 1)
    : null;

  return (
    <View style={{ width: PAGE_WIDTH }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ width: PAGE_WIDTH, height: currentHeight, overflow: 'hidden' }}
      >
        {/* Page 1: Overview */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(0)}>
          <Text style={styles.pageTitle}>Overview</Text>
          <Text style={styles.bigNumber}>{metrics.todayCalories}</Text>
          <Text style={styles.bigNumberLabel}>Calories burned today</Text>
          {metrics.stepsCalorieEstimate > 0 ? (
            <Text style={styles.estimateNote}>Includes ~{metrics.stepsCalorieEstimate} cal estimated from today's steps</Text>
          ) : null}
          {metrics.dailyCalorieGoal ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Goal</Text>
              <Text style={styles.rowValue}>{metrics.dailyCalorieGoal} cal ({Math.round(goalPct * 100)}%)</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.goalPromptBtn} onPress={onSetGoal}>
              <Text style={styles.goalPromptText}>Set a daily calorie goal</Text>
            </TouchableOpacity>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Streak</Text>
            <Text style={styles.rowValue}>{metrics.streak} {metrics.streak === 1 ? 'day' : 'days'}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Total sessions</Text>
            <Text style={styles.rowValue}>{metrics.totalSessions}</Text>
          </View>
        </View>

        {/* Page 2: Breakdown */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(1)}>
          <Text style={styles.pageTitle}>Breakdown</Text>
          {metrics.categoryBreakdown.length === 0 ? (
            <Text style={styles.emptyText}>No sessions logged yet.</Text>
          ) : metrics.categoryBreakdown.map((c) => (
            <View key={c.category} style={styles.row}>
              <Text style={styles.rowLabel}>{c.category}</Text>
              <Text style={styles.rowValue}>{c.calories.toLocaleString()} cal</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Avg burn rate</Text>
            <Text style={styles.rowValue}>
              {metrics.averageBurnRate != null ? metrics.averageBurnRate.toFixed(1) + ' cal/min' : '—'}
            </Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Peak burn rate</Text>
            <Text style={styles.rowValue}>
              {metrics.peakBurnRate != null ? metrics.peakBurnRate.toFixed(1) + ' cal/min' : '—'}
            </Text>
          </View>
        </View>

        {/* Page 3: Trends */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(2)}>
          <Text style={styles.pageTitle}>Trends</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>7-day average</Text>
            <Text style={styles.rowValue}>{Math.round(metrics.sevenDayAverage)} cal/day</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Weekly total</Text>
            <Text style={styles.rowValue}>{metrics.weeklyTotal.toLocaleString()} cal</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>vs. last week</Text>
            <Text style={[styles.rowValue, { color: metrics.velocity >= 0 ? '#22C55E' : '#F97316' }]}>
              {(metrics.velocity > 0 ? '+' : '') + metrics.velocity.toLocaleString()} cal
            </Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Typical {new Date().toLocaleDateString('en-US', { weekday: 'long' })}</Text>
            <Text style={styles.rowValue}>
              {metrics.historicalDailyAverage != null ? Math.round(metrics.historicalDailyAverage) + ' cal' : 'No history yet'}
            </Text>
          </View>
        </View>

        {/* Page 4: Lifetime */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(3)}>
          <Text style={styles.pageTitle}>Lifetime</Text>
          <Text style={styles.bigNumber}>{metrics.lifetimeCalories.toLocaleString()}</Text>
          <Text style={styles.bigNumberLabel}>Total calories burned</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Best day</Text>
            <Text style={styles.rowValue}>{metrics.burnCeiling.toLocaleString()} cal</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Avg per session</Text>
            <Text style={styles.rowValue}>
              {metrics.caloriesPerSession != null ? Math.round(metrics.caloriesPerSession) + ' cal' : '—'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.dots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, pageIndex === i && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity
        style={styles.panelBtn}
        onPress={() => router.push('/profile/calorie-history')}
      >
        <Text style={styles.panelBtnText}>View Full Log</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 14, fontWeight: '700', color: '#999', textTransform: 'uppercase', marginBottom: 12 },
  bigNumber: { fontSize: 40, fontWeight: '800', color: '#000' },
  bigNumberLabel: { fontSize: 13, color: '#666', marginBottom: 16 },
  estimateNote: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: -12, marginBottom: 12 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  rowLabel: { fontSize: 14, color: '#666' },
  rowValue: { fontSize: 14, fontWeight: '700', color: '#000' },
  emptyText: { fontSize: 13, color: '#999' },
  goalPromptBtn: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 12,
  },
  goalPromptText: { fontSize: 13, fontWeight: '600', color: '#666' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12, marginBottom: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E0E0E0' },
  dotActive: { backgroundColor: '#000', width: 16 },
  panelBtn: { backgroundColor: '#000', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  panelBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

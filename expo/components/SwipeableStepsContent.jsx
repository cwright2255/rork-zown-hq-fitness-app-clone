// components/SwipeableStepsContent.jsx
//
// Swipeable Overview/Breakdown/Trends/Lifetime pages for the Home
// screen's Steps widget, mirroring components/SwipeableCaloriesContent.jsx
// exactly - same swipe mechanics, same dynamic per-page height
// measurement, same honest-empty-state conventions. Driven entirely by
// lib/stepsMetrics.js's real computed numbers - no fabricated fields.
// "Breakdown" here is real activity pattern by day of week rather than
// by category (steps have no natural category), see stepsMetrics.js
// for why.
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { router } from 'expo-router';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_WIDTH = SCREEN_WIDTH - 76;
const DEFAULT_HEIGHT = 200; // fallback only until the first onLayout measurement lands

export default function SwipeableStepsContent({ metrics, onSetGoal }) {
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

  const goalPct = metrics.stepsGoal
    ? Math.min(metrics.todaySteps / metrics.stepsGoal, 1)
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
          <Text style={styles.bigNumber}>{metrics.todaySteps.toLocaleString()}</Text>
          <Text style={styles.bigNumberLabel}>Steps today</Text>
          {metrics.stepsGoal ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Goal</Text>
              <Text style={styles.rowValue}>{metrics.stepsGoal.toLocaleString()} steps ({Math.round(goalPct * 100)}%)</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.goalPromptBtn} onPress={onSetGoal}>
              <Text style={styles.goalPromptText}>Set a daily step goal</Text>
            </TouchableOpacity>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Streak</Text>
            <Text style={styles.rowValue}>{metrics.streak} {metrics.streak === 1 ? 'day' : 'days'}</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Days tracked</Text>
            <Text style={styles.rowValue}>{metrics.totalDaysTracked}</Text>
          </View>
        </View>

        {/* Page 2: Breakdown */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(1)}>
          <Text style={styles.pageTitle}>Breakdown</Text>
          {metrics.totalDaysTracked === 0 ? (
            <Text style={styles.emptyText}>No days tracked yet.</Text>
          ) : metrics.weekdayBreakdown.map((d) => (
            <View key={d.day} style={styles.row}>
              <Text style={styles.rowLabel}>{d.day}</Text>
              <Text style={styles.rowValue}>
                {d.averageSteps != null ? d.averageSteps.toLocaleString() + ' avg' : '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Page 3: Trends */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(2)}>
          <Text style={styles.pageTitle}>Trends</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>7-day average</Text>
            <Text style={styles.rowValue}>{Math.round(metrics.sevenDayAverage).toLocaleString()} steps/day</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Weekly total</Text>
            <Text style={styles.rowValue}>{metrics.weeklyTotal.toLocaleString()} steps</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>vs. last week</Text>
            <Text style={[styles.rowValue, { color: metrics.velocity >= 0 ? '#22C55E' : '#F97316' }]}>
              {(metrics.velocity > 0 ? '+' : '') + metrics.velocity.toLocaleString()} steps
            </Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Typical {new Date().toLocaleDateString('en-US', { weekday: 'long' })}</Text>
            <Text style={styles.rowValue}>
              {metrics.historicalDailyAverage != null ? Math.round(metrics.historicalDailyAverage).toLocaleString() + ' steps' : 'No history yet'}
            </Text>
          </View>
        </View>

        {/* Page 4: Lifetime */}
        <View style={{ width: PAGE_WIDTH, paddingRight: 4 }} onLayout={handlePageLayout(3)}>
          <Text style={styles.pageTitle}>Lifetime</Text>
          <Text style={styles.bigNumber}>{metrics.lifetimeSteps.toLocaleString()}</Text>
          <Text style={styles.bigNumberLabel}>Total steps tracked</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Best day</Text>
            <Text style={styles.rowValue}>{metrics.bestDay.toLocaleString()} steps</Text>
          </View>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>Avg per tracked day</Text>
            <Text style={styles.rowValue}>
              {metrics.averagePerTrackedDay != null ? Math.round(metrics.averagePerTrackedDay).toLocaleString() + ' steps' : '—'}
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
        onPress={() => router.push('/health')}
      >
        <Text style={styles.panelBtnText}>View Health</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: { fontSize: 14, fontWeight: '700', color: '#999', textTransform: 'uppercase', marginBottom: 12 },
  bigNumber: { fontSize: 40, fontWeight: '800', color: '#000' },
  bigNumberLabel: { fontSize: 13, color: '#666', marginBottom: 16 },
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

// components/HealthTrends.jsx
//
// The Health page's Trends section: sleep, HRV, resting heart rate and weight over the last 7 or 28 days, one card each, with one
// switch above all four. It only draws what it is given (the daily record in healthStore.readingsHistory and the weight log), never a
// reading it was not given. The sums are in lib/dailyReadings.js; the drawing is in components/TrendChart.jsx.
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import TrendChart from './TrendChart';
import { localDateKey } from '../lib/localDate';
import { readingByDay, weightByDay, trendSeries } from '../lib/dailyReadings';

export const TREND_RANGES = [
  { days: 7, label: '7 days' },
  { days: 28, label: '28 days' },
];

const CARD_PADDING = 16;
const DEFAULT_WIDTH = 300;

export default function HealthTrends({ history, weightLogs, pounds = true, hrvLabel = 'HRV', today }) {
  const [days, setDays] = useState(7);
  const [outer, setOuter] = useState(0);
  const day = today ?? localDateKey(new Date());
  const chartWidth = outer > 0 ? Math.max(160, outer - CARD_PADDING * 2) : DEFAULT_WIDTH;

  const cards = [
    { key: 'sleep', title: 'Sleep', values: readingByDay(history, 'sleepHours'), unit: 'h', decimals: 1, emptyNoun: 'readings' },
    { key: 'hrv', title: hrvLabel, values: readingByDay(history, 'hrv'), unit: 'ms', decimals: 0, emptyNoun: 'readings' },
    { key: 'restingHeartRate', title: 'Resting heart rate', values: readingByDay(history, 'restingHeartRate'), unit: 'bpm', decimals: 0, emptyNoun: 'readings' },
    { key: 'weight', title: 'Weight', values: weightByDay(weightLogs, { pounds }), unit: pounds ? 'lb' : 'kg', decimals: 1, emptyNoun: 'weigh-ins' },
  ];

  return (
    <View testID="health-trends" style={styles.wrap} onLayout={(e) => setOuter(Math.round(e.nativeEvent.layout.width))}>
      <View style={styles.switch}>
        {TREND_RANGES.map((range) => {
          const selected = range.days === days;
          return (
            <Pressable
              key={range.days}
              testID={`trends-range-${range.days}`}
              onPress={() => setDays(range.days)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Show the last ${range.label}`}
              accessibilityState={{ selected }}
              style={[styles.segment, selected ? styles.segmentOn : null]}
            >
              <Text style={[styles.segmentText, selected ? styles.segmentTextOn : null]}>{range.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {cards.map((card) => (
        <TrendChart
          key={card.key}
          testID={`trend-${card.key}`}
          title={card.title}
          series={trendSeries(card.values, day, days)}
          unit={card.unit}
          decimals={card.decimals}
          emptyNoun={card.emptyNoun}
          width={chartWidth}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 12 },
  switch: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 12, padding: 3, marginBottom: 12 },
  segment: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: '#000000' },
  segmentText: { fontSize: 14, fontWeight: '700', color: '#444444' },
  segmentTextOn: { color: '#FFFFFF' },
});

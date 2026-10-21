// components/TrendChart.jsx
//
// One reading over the last 7 or 28 days as a card: its name, the average over the period (the big number), how many of the days have
// a reading, how it compares with the period before when there are enough readings to say, and a plain black line with a dot for each
// day that has a reading. Days without a reading are gaps in the line, never made-up values.
// Tapping the chart picks the day nearest the finger and reads it out; tapping that day again clears it.
// The line is drawn in SVG; the dots are plain views, as in PaceLineChart. All the numbers come from lib/dailyReadings.js.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { trendGeometry, nearestDot, shortDay, formatValue, formatChange } from '../lib/dailyReadings';

const INK = '#000000';
const DOT = 12; // 8px of ink inside a 2px white ring, so dots on neighbouring days stay apart
const DOT_PICKED = 18;

/** The words a screen reader reads for the chart: what it is, the average, and every day that has a reading. */
export function trendSummary({ title, series, unit, decimals, emptyNoun }) {
  const days = series?.days ?? 0;
  if (!series || !series.count) return `${title}. No ${emptyNoun} in the last ${days} days.`;
  const list = series.points
    .filter((p) => p.value !== null)
    .map((p) => `${shortDay(p.day)} ${formatValue(p.value, { decimals, unit })}`)
    .join(', ');
  const average = formatValue(series.average, { decimals, unit });
  return `${title}, last ${days} days. Average ${average}, ${series.count} of ${days} days. ${list}.`;
}

export default function TrendChart({ testID, title, series, unit = '', decimals = 0, emptyNoun = 'readings', width = 300, height = 84 }) {
  const [pickedDay, setPickedDay] = useState(null);
  const geometry = useMemo(() => trendGeometry(series?.points, width, height), [series, width, height]);
  const days = series?.days ?? 0;
  const format = { decimals, unit };
  const picked = geometry ? geometry.dots.find((d) => d.day === pickedDay) ?? null : null;

  const onPickDay = (event) => {
    const x = event?.nativeEvent?.locationX;
    const dot = typeof x === 'number' ? nearestDot(geometry?.dots, x) : null;
    if (dot) setPickedDay(dot.day === pickedDay ? null : dot.day);
  };

  const change = formatChange(series?.change, format); // '' when there is nothing to compare
  const readout = !series?.count ? ''
    : picked ? `${shortDay(picked.day)}: ${formatValue(picked.value, format)}`
      : `Latest, ${shortDay(series.latest.day)}: ${formatValue(series.latest.value, format)}`;

  return (
    <View testID={testID} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {series?.count ? (
        <>
          <View style={styles.heroRow}>
            <Text testID={`${testID}-average`} style={styles.hero}>{formatValue(series.average, format)}</Text>
            <Text style={styles.heroLabel}>{days}-day average</Text>
          </View>
          <Text testID={`${testID}-coverage`} style={styles.caption}>
            {`${series.count} of ${days} days${change ? `  \u00B7  ${change} vs the ${days} days before` : ''}`}
          </Text>
          <Text testID={`${testID}-readout`} style={styles.readout}>{readout}</Text>
          <Pressable
            testID={`${testID}-chart`}
            onPress={onPickDay}
            accessibilityRole="button"
            accessibilityLabel={trendSummary({ title, series, unit, decimals, emptyNoun })}
            accessibilityHint="Tap to read the reading for a day"
            style={{ width, height }}
          >
            <View testID={`${testID}-drawing`} pointerEvents="none" style={{ width, height }}>
              <Svg width={width} height={height} style={styles.svg}>
                {geometry.paths.map((d) => (
                  <Path key={d} d={d} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </Svg>
              {geometry.dots.map((dot) => {
                const isPicked = dot.index === picked?.index;
                const size = isPicked ? DOT_PICKED : DOT;
                return (
                  <View
                    key={dot.day}
                    testID={`${testID}-dot-${dot.index}`}
                    style={[
                      styles.dot,
                      { width: size, height: size, borderRadius: size / 2, left: dot.x - size / 2, top: dot.y - size / 2 },
                      isPicked ? styles.dotPicked : null,
                    ]}
                  />
                );
              })}
            </View>
          </Pressable>
          <View style={styles.axis}>
            <Text style={styles.axisText}>{shortDay(series.points[0].day)}</Text>
            <Text style={styles.axisText}>Today</Text>
          </View>
        </>
      ) : (
        <>
          <Text testID={`${testID}-average`} style={styles.hero}>{'\u2014'}</Text>
          <Text testID={`${testID}-empty`} style={styles.caption}>{`No ${emptyNoun} in the last ${days} days`}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0' },
  title: { fontSize: 14, fontWeight: '700', color: '#000000', marginBottom: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  hero: { fontSize: 26, fontWeight: '800', color: '#000000' },
  heroLabel: { fontSize: 12, color: '#666666' },
  caption: { fontSize: 12, color: '#666666', marginTop: 2 },
  readout: { fontSize: 12, fontWeight: '600', color: '#000000', marginTop: 10, marginBottom: 4 },
  svg: { position: 'absolute', left: 0, top: 0 },
  dot: { position: 'absolute', backgroundColor: INK, borderWidth: 2, borderColor: '#FFFFFF' },
  dotPicked: { backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: INK },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  axisText: { fontSize: 11, color: '#8A8A8A' },
});

// components/FastingBarChart.jsx
//
// Bars for the Fasting widget's week, month and year charts, in Zown's black
// and white: a black bar for a day (or month) that made its goal, a grey one
// for fasting that fell short, nothing for a day without a fast. The bars are
// plain views, so each one can be found and measured. The numbers come from
// chartSeries() in lib/fastingStats.js.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const INK = '#000000';
const SHORT = '#B5B5B5';
const GUTTER = 30; // room for the hour labels on the left
const LABEL_ROOM = 20; // room for the day labels underneath

/** Where every bar goes for a chart `width` x `height` (the plot, without labels). */
export function barLayout(bars, max, width, height) {
  const plotW = Math.max(0, width - GUTTER);
  const slot = bars.length ? plotW / bars.length : 0;
  const barW = Math.max(3, Math.min(28, slot * 0.62));
  return bars.map((b, i) => {
    const h = b.value > 0 ? Math.max(3, Math.min(height, (b.value / max) * height)) : 0;
    return { x: GUTTER + i * slot + (slot - barW) / 2, w: barW, h, center: GUTTER + i * slot + slot / 2, slot };
  });
}

export default function FastingBarChart({ bars = [], max = 8, ticks, width = 300, height = 120 }) {
  if (!bars.length) return null;
  const layout = barLayout(bars, max, width, height);
  const marks = ticks || [0, max / 2, max];

  return (
    <View style={{ width, height: height + LABEL_ROOM }} testID="fast-bar-chart">
      {marks.map((t) => (
        <React.Fragment key={`tick-${t}`}>
          <View style={[styles.grid, { left: GUTTER, width: width - GUTTER, top: height - (t / max) * height }]} />
          <Text
            testID={`fast-bar-tick-${t}`}
            style={[styles.tick, { top: height - (t / max) * height - 7 }]}
          >
            {`${t}h`}
          </Text>
        </React.Fragment>
      ))}

      {bars.map((b, i) => {
        const p = layout[i];
        return (
          <React.Fragment key={b.key}>
            {p.h > 0 ? (
              <View
                testID={`fast-bar-${i}`}
                style={[styles.bar, { left: p.x, width: p.w, height: p.h, top: height - p.h }, b.met ? styles.barMet : styles.barShort]}
              />
            ) : null}
            {b.showLabel ? (
              <Text
                testID={`fast-bar-label-${i}`}
                style={[styles.label, { left: p.center - 20, top: height + 5 }]}
              >
                {b.label}
              </Text>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { position: 'absolute', height: StyleSheet.hairlineWidth, backgroundColor: '#E2E2E2' },
  tick: { position: 'absolute', left: 0, width: GUTTER - 4, textAlign: 'right', fontSize: 10, color: '#8A8A8A' },
  bar: { position: 'absolute', borderRadius: 3 },
  barMet: { backgroundColor: INK },
  barShort: { backgroundColor: SHORT },
  label: { position: 'absolute', width: 40, textAlign: 'center', fontSize: 10, color: '#8A8A8A' },
});

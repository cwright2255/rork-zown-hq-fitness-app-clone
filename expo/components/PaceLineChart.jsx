// components/PaceLineChart.jsx
//
// The pace of each kilometre as a smooth black line on a white card, higher
// meaning faster, with a dot for every kilometre and a small label over the
// fastest one. The line and the soft fill under it are drawn in SVG; the dots
// and labels are plain views so they can be told apart and tapped later.
// All the numbers come from paceChart() in lib/runDetail.js.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { paceChart } from '../lib/runDetail';
import { formatPace } from '../lib/runStats';

const INK = '#000000';
const BUBBLE_W = 52;
const LABEL_W = 36;
const LABEL_ROOM = 22;

export default function PaceLineChart({ rows = [], width = 300, height = 120 }) {
  const chart = useMemo(() => paceChart(rows, width, height), [rows, width, height]);
  if (!chart) return null;
  const { points, line, area } = chart;
  const fastest = points.find((p) => p.isFastest);

  return (
    <View style={{ width, height: height + LABEL_ROOM }} testID="pace-chart">
      <Svg width={width} height={height} style={styles.svg}>
        {area ? <Path d={area} fill="rgba(0,0,0,0.06)" /> : null}
        {points.length > 1 ? (
          <Path d={line} fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </Svg>

      {points.map((p) => {
        const size = p.isFastest ? 14 : 10;
        return (
          <View
            key={`dot-${p.index}`}
            testID={`pace-point-${p.index}`}
            style={[
              styles.dot,
              { width: size, height: size, borderRadius: size / 2, left: p.x - size / 2, top: p.y - size / 2 },
              p.isFastest ? styles.dotFastest : null,
              p.partial ? styles.dotPartial : null,
            ]}
          />
        );
      })}

      {fastest && (
        <View
          testID="pace-chart-best"
          style={[styles.bubble, { left: Math.min(Math.max(fastest.x - BUBBLE_W / 2, 0), width - BUBBLE_W), top: fastest.y - 36 }]}
        >
          <Text style={styles.bubbleText}>{formatPace(fastest.pace)}</Text>
        </View>
      )}

      {points.map((p) => (p.showLabel ? (
        <Text
          key={`label-${p.index}`}
          testID={`pace-label-${p.index}`}
          style={[styles.label, { left: Math.min(Math.max(p.x - LABEL_W / 2, 0), width - LABEL_W), top: height + 4 }]}
        >
          {p.label}
        </Text>
      ) : null))}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: 0, top: 0 },
  dot: { position: 'absolute', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: INK },
  dotFastest: { backgroundColor: INK },
  dotPartial: { borderColor: '#9A9A9A' },
  bubble: {
    position: 'absolute', width: BUBBLE_W, paddingVertical: 4, borderRadius: 8,
    backgroundColor: INK, alignItems: 'center',
  },
  bubbleText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  label: { position: 'absolute', width: LABEL_W, textAlign: 'center', fontSize: 11, color: '#8A8A8A' },
});

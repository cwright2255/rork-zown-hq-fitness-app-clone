// components/FastingScatterChart.jsx
//
// The "does fasting go with this?" chart: one dot for each week (weight) or day
// (calories), longer fasts further right, with a straight line through the dots
// showing which way they lean. A dotted line marks zero when the dots cross it
// (weight going up or down). The dots are plain views so they can be found and
// measured; the lines are SVG. The dots and the line come from lib/fastingStats.js.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';

const INK = '#000000';
const LEFT = 44; // y labels
const BOTTOM = 18; // x labels
const TOP = 8;
const RIGHT = 8;
const DOT = 10;

const pad = (lo, hi, minSpan) => {
  const span = Math.max(hi - lo, minSpan);
  const extra = span * 0.12;
  const mid = (lo + hi) / 2;
  return [mid - span / 2 - extra, mid + span / 2 + extra];
};

/** Where the dots, the fit line and the zero line go. Null with no dots. */
export function scatterLayout(points, fit, width, height) {
  if (!Array.isArray(points) || !points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs), 2);
  const yLow = Math.min(...ys);
  const yHigh = Math.max(...ys);
  const [y0, y1] = pad(yLow, yHigh, Math.max(Math.abs(yHigh), Math.abs(yLow)) * 0.5 || 1);
  const plotW = Math.max(1, width - LEFT - RIGHT);
  const plotH = Math.max(1, height - TOP - BOTTOM);
  const px = (x) => LEFT + ((x - x0) / (x1 - x0)) * plotW;
  const py = (y) => TOP + (1 - (y - y0) / (y1 - y0)) * plotH;
  const line = fit && fit.slope !== null && fit.slope !== undefined
    ? { x1: px(x0), y1: py(fit.intercept + fit.slope * x0), x2: px(x1), y2: py(fit.intercept + fit.slope * x1) }
    : null;
  return {
    dots: points.map((p, i) => ({ i, x: px(p.x), y: py(p.y) })),
    line,
    zeroY: y0 < 0 && y1 > 0 ? py(0) : null,
    xRange: [x0, x1],
    yRange: [y0, y1],
    plot: { left: LEFT, top: TOP, width: plotW, height: plotH },
  };
}

export default function FastingScatterChart({
  points = [], fit = null, width = 300, height = 150, formatX = (v) => `${Math.round(v * 10) / 10}h`, formatY = (v) => String(Math.round(v * 10) / 10),
}) {
  const layout = scatterLayout(points, fit, width, height);
  if (!layout) return null;
  const { plot } = layout;

  return (
    <View style={{ width, height }} testID="fast-scatter-chart">
      <Svg width={width} height={height} style={styles.svg}>
        <Line x1={plot.left} y1={plot.top + plot.height} x2={plot.left + plot.width} y2={plot.top + plot.height} stroke="#E2E2E2" strokeWidth={1} />
        <Line x1={plot.left} y1={plot.top} x2={plot.left} y2={plot.top + plot.height} stroke="#E2E2E2" strokeWidth={1} />
        {layout.zeroY !== null ? (
          <Line x1={plot.left} y1={layout.zeroY} x2={plot.left + plot.width} y2={layout.zeroY} stroke="#B5B5B5" strokeWidth={1} strokeDasharray="3,4" />
        ) : null}
        {layout.line ? (
          <Line {...layout.line} stroke={INK} strokeOpacity={0.55} strokeWidth={2} strokeLinecap="round" />
        ) : null}
      </Svg>

      {layout.dots.map((d) => (
        <View
          key={`dot-${d.i}`}
          testID={`fast-dot-${d.i}`}
          style={[styles.dot, { left: d.x - DOT / 2, top: d.y - DOT / 2 }]}
        />
      ))}

      <Text testID="fast-scatter-y-top" style={[styles.yLabel, { top: plot.top - 6 }]}>{formatY(layout.yRange[1])}</Text>
      <Text testID="fast-scatter-y-bottom" style={[styles.yLabel, { top: plot.top + plot.height - 6 }]}>{formatY(layout.yRange[0])}</Text>
      <Text testID="fast-scatter-x-left" style={[styles.xLabel, { left: plot.left - 4, top: height - BOTTOM + 4 }]}>{formatX(layout.xRange[0])}</Text>
      <Text testID="fast-scatter-x-right" style={[styles.xLabel, { left: plot.left + plot.width - 28, top: height - BOTTOM + 4, textAlign: 'right' }]}>{formatX(layout.xRange[1])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute', left: 0, top: 0 },
  dot: {
    position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2,
    backgroundColor: INK, borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  yLabel: { position: 'absolute', left: 0, width: LEFT - 6, textAlign: 'right', fontSize: 10, color: '#8A8A8A' },
  xLabel: { position: 'absolute', width: 32, fontSize: 10, color: '#8A8A8A' },
});

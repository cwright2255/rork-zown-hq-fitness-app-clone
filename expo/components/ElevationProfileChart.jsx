// components/ElevationProfileChart.jsx
//
// Real elevation-vs-distance chart, built from a trail's actual GPX
// elevation profile (lib/parseGpx.js). This is the precise complement to
// the tilted "2.5D" map view on the trail detail screen: the tilted map
// gives a visual sense of terrain relief, this shows the exact climb 
// where it's steep, where it's flat, the real high and low points along
// the route. Plain react-native-svg (already installed, already used
// elsewhere in the app), no new charting dependency.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Polyline as SvgPolyline, Line, Text as SvgText } from 'react-native-svg';
import { colors, typography, spacing } from '@/constants/theme';

const CHART_HEIGHT = 100;
const PADDING_X = 8;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 18;

export default function ElevationProfileChart({ profile, width = 320 }) {
  if (!profile || profile.length < 2) return null;

  const chartWidth = width - PADDING_X * 2;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const elevations = profile.map((p) => p.elevationM);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const eleRange = Math.max(maxEle - minEle, 1); // avoid divide-by-zero on a perfectly flat trail

  const maxDist = profile[profile.length - 1].distanceKm || 1;

  const points = profile.map((p) => {
    const x = PADDING_X + (p.distanceKm / maxDist) * chartWidth;
    const y = PADDING_TOP + plotHeight - ((p.elevationM - minEle) / eleRange) * plotHeight;
    return { x, y };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const fillPoints = [
    `${points[0].x},${PADDING_TOP + plotHeight}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${PADDING_TOP + plotHeight}`,
  ].join(' ');

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Elevation</Text>
        <Text style={styles.headerRange}>{Math.round(minEle)}{Math.round(maxEle)} m</Text>
      </View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Line
          x1={PADDING_X} y1={PADDING_TOP + plotHeight}
          x2={width - PADDING_X} y2={PADDING_TOP + plotHeight}
          stroke={colors.border} strokeWidth={1}
        />
        <Polygon points={fillPoints} fill={colors.green} fillOpacity={0.15} />
        <SvgPolyline points={linePoints} fill="none" stroke={colors.green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <SvgText x={PADDING_X} y={CHART_HEIGHT - 4} fontSize={10} fill={colors.textSecondary}>0 km</SvgText>
        <SvgText x={width - PADDING_X} y={CHART_HEIGHT - 4} fontSize={10} fill={colors.textSecondary} textAnchor="end">
          {maxDist.toFixed(1)} km
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  headerLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  headerRange: { ...typography.caption, color: colors.textSecondary },
});

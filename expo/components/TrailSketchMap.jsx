// components/TrailSketchMap.jsx
//
// A trail on a plain dark picture, with no map tiles behind it, so it still
// shows with no signal. Zown's black and white look, same as the run maps
// (constants/runMap.js): the trail dashed, the path walked solid white with a
// soft glow, a ring where the trail starts, a dot where it ends, and a dot with
// a halo where the hiker is.
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { sketchFrame } from '../lib/trailSketch';
import { thin } from '../lib/offlineTrails';
import { MAP_BG, ROUTE_COLOR, ROUTE_GLOW, MARKER_HALO } from '../constants/runMap';

const WIDTH = 300;
const HEIGHT = 200;
// A long hike has thousands of readings; the picture does not need them all.
const MAX_DRAWN = 600;
const PLANNED_COLOR = 'rgba(255, 255, 255, 0.5)';

const NONE = [];

export default function TrailSketchMap({ planned = NONE, walked = NONE, current = null, style, testID = 'trail-sketch' }) {
  const plannedDrawn = useMemo(() => thin(planned, MAX_DRAWN), [planned]);
  const walkedDrawn = useMemo(() => thin(walked, MAX_DRAWN), [walked]);
  const frame = useMemo(
    () => sketchFrame([...plannedDrawn, ...walkedDrawn, ...(current ? [current] : [])], { width: WIDTH, height: HEIGHT, margin: 22 }),
    [plannedDrawn, walkedDrawn, current],
  );

  if (!frame) return <View style={[styles.container, style]} testID={testID} />;

  const plannedLine = plannedDrawn.length >= 2 ? frame.line(plannedDrawn) : '';
  const walkedLine = walkedDrawn.length >= 2 ? frame.line(walkedDrawn) : '';
  const start = plannedDrawn.length >= 2 ? frame.project(plannedDrawn[0]) : null;
  const end = plannedDrawn.length >= 2 ? frame.project(plannedDrawn[plannedDrawn.length - 1]) : null;
  const here = current ? frame.project(current) : null;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet">
        {plannedLine !== '' && (
          <Polyline points={plannedLine} fill="none" stroke={PLANNED_COLOR} strokeWidth={3} strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {walkedLine !== '' && (
          <Polyline points={walkedLine} fill="none" stroke={ROUTE_GLOW} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {walkedLine !== '' && (
          <Polyline points={walkedLine} fill="none" stroke={ROUTE_COLOR} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {start && <Circle cx={start.x} cy={start.y} r={11} fill={MARKER_HALO} />}
        {start && <Circle cx={start.x} cy={start.y} r={6} fill="none" stroke={ROUTE_COLOR} strokeWidth={3} />}
        {end && <Circle cx={end.x} cy={end.y} r={12} fill={MARKER_HALO} />}
        {end && <Circle cx={end.x} cy={end.y} r={7} fill={ROUTE_COLOR} />}
        {here && <Circle cx={here.x} cy={here.y} r={14} fill={MARKER_HALO} />}
        {here && <Circle cx={here.x} cy={here.y} r={6} fill={ROUTE_COLOR} />}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: MAP_BG, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

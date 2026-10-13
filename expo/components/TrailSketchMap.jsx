// components/TrailSketchMap.jsx
//
// A trail on a plain dark picture, with no map tiles behind it, so it still
// shows with no signal. Zown's black and white look, same as the run maps
// (constants/runMap.js): the trail dashed, the path walked solid white with a
// soft glow, a ring where the trail starts, a dot where it ends, and a dot with
// a halo where the hiker is. Other paths nearby (the ones to choose from) are
// drawn as faint lines under the rest.
//
// The picture fills the box it is given, whatever its shape, so a taller box
// shows a bigger picture rather than the same small one with bands round it.
import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { sketchFrame } from '../lib/trailSketch';
import { thin } from '../lib/offlineTrails';
import { distanceM } from '../lib/gpsFilter';
import { MAP_BG, ROUTE_COLOR, ROUTE_GLOW, MARKER_HALO } from '../constants/runMap';

// The size of the picture until the box has been measured (and in tests).
const WIDTH = 300;
const HEIGHT = 200;
// A long hike has thousands of readings; the picture does not need them all.
const MAX_DRAWN = 600;
const MAX_OTHER_DRAWN = 300;
const PLANNED_COLOR = 'rgba(255, 255, 255, 0.5)';
const OTHER_COLOR = 'rgba(255, 255, 255, 0.3)';
// Another path only makes the picture wider when some of it is this close (metres) to the hiker;
// a path farther off still runs into the picture from the edge.
const OTHERS_FRAME_M = 600;

const NONE = [];

export default function TrailSketchMap({
  planned = NONE, walked = NONE, others = NONE, current = null, style, testID = 'trail-sketch',
}) {
  const [size, setSize] = useState({ width: WIDTH, height: HEIGHT });
  const onLayout = useCallback((event) => {
    const layout = event && event.nativeEvent && event.nativeEvent.layout;
    if (!layout) return;
    const width = Math.round(layout.width);
    const height = Math.round(layout.height);
    if (!(width > 0 && height > 0)) return;
    setSize({ width, height });
  }, []);

  const plannedDrawn = useMemo(() => thin(planned, MAX_DRAWN), [planned]);
  const walkedDrawn = useMemo(() => thin(walked, MAX_DRAWN), [walked]);
  const othersDrawn = useMemo(
    () => (Array.isArray(others) ? others : NONE).map((line) => thin(line, MAX_OTHER_DRAWN)).filter((line) => line.length >= 2),
    [others],
  );
  const othersNear = useMemo(
    () => othersDrawn.flatMap((line) => (current ? line.filter((p) => distanceM(current, p) <= OTHERS_FRAME_M) : line)),
    [othersDrawn, current],
  );
  const frame = useMemo(
    () => sketchFrame(
      [...plannedDrawn, ...walkedDrawn, ...othersNear, ...(current ? [current] : [])],
      { width: size.width, height: size.height, margin: 22 },
    ),
    [plannedDrawn, walkedDrawn, othersNear, current, size],
  );

  if (!frame) return <View style={[styles.container, style]} testID={testID} onLayout={onLayout} />;

  const plannedLine = plannedDrawn.length >= 2 ? frame.line(plannedDrawn) : '';
  const walkedLine = walkedDrawn.length >= 2 ? frame.line(walkedDrawn) : '';
  const start = plannedDrawn.length >= 2 ? frame.project(plannedDrawn[0]) : null;
  const end = plannedDrawn.length >= 2 ? frame.project(plannedDrawn[plannedDrawn.length - 1]) : null;
  const here = current ? frame.project(current) : null;

  return (
    <View style={[styles.container, style]} testID={testID} onLayout={onLayout}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="xMidYMid meet">
        {othersDrawn.map((line, i) => (
          <Polyline
            key={`other-${i}`}
            points={frame.line(line)}
            fill="none"
            stroke={OTHER_COLOR}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
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

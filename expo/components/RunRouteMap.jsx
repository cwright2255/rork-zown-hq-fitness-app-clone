// components/RunRouteMap.jsx
//
// A finished run's route on a dark map, fitted to the whole route, with a
// marker at the start and one at the finish. It sits still (the screen around
// it scrolls). Where native maps are not available (web, or a build without
// react-native-maps) it draws the route as a flat sketch instead, and with no
// route at all it says so.
import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline as SvgPolyline, Circle } from 'react-native-svg';
import { routeRegion, routeSketch } from '../lib/runDetail';
import { MAP_BG, ROUTE_COLOR, ROUTE_GLOW, ROUTE_WIDTH, ROUTE_GLOW_WIDTH, MARKER_HALO } from '../constants/runMap';
import { StartMarker, FinishMarker } from './RunMapMarkers';

let MapView = null;
let Polyline = null;
let Marker = null;
let PROVIDER_DEFAULT = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line global-require
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView;
    Polyline = Maps.Polyline;
    Marker = Maps.Marker;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (e) {
    MapView = null;
  }
}

// Same look as the live map (components/RunningMap.jsx): constants/runMap.js.
const EDGE_PADDING = { top: 90, right: 50, bottom: 60, left: 50 };

/** True when a real map can be drawn here (not on web, and only in a build that has react-native-maps). */
export const hasNativeMap = () => !!MapView;

// `sketch` draws the flat route drawing even where a real map is available (a
// feed full of maps would be heavy); `edgePadding` sets the room around the
// route on a real map (the default leaves space for the run screen's header),
// and `emptyText` is what it says when there is no route (hikes say "hike").
export default function RunRouteMap({
  points = [], style, edgePadding = EDGE_PADDING, sketch = false, emptyText = 'No route was recorded for this run',
}) {
  const mapRef = useRef(null);
  const region = useMemo(() => routeRegion(points), [points]);
  const hasRoute = points.length >= 2;
  const start = hasRoute ? points[0] : null;
  const finish = hasRoute ? points[points.length - 1] : null;

  // Once the map is ready, fit it exactly to the route (initialRegion is the
  // first guess, this makes it tight on any screen size).
  const fit = useCallback(() => {
    const map = mapRef.current;
    if (map && typeof map.fitToCoordinates === 'function' && hasRoute) {
      map.fitToCoordinates(points, { edgePadding, animated: false });
    }
  }, [points, hasRoute, edgePadding]);

  if (!hasRoute) {
    return (
      <View style={[styles.container, styles.center, style]} testID="run-route-empty">
        <Ionicons name="map-outline" size={36} color="rgba(255,255,255,0.35)" />
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  if (MapView && !sketch) {
    return (
      <View style={[styles.container, style]} testID="run-route-map">
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={PROVIDER_DEFAULT}
          mapType="mutedStandard"
          userInterfaceStyle="dark"
          initialRegion={region}
          onMapReady={fit}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsPointsOfInterest={false}
          showsBuildings={false}
        >
          <Polyline coordinates={points} strokeColor={ROUTE_GLOW} strokeWidth={ROUTE_GLOW_WIDTH} lineCap="round" lineJoin="round" zIndex={1} />
          <Polyline coordinates={points} strokeColor={ROUTE_COLOR} strokeWidth={ROUTE_WIDTH} lineCap="round" lineJoin="round" zIndex={2} />
          {Marker && (
            <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} zIndex={3} tracksViewChanges={false}>
              <StartMarker testID="run-route-start" />
            </Marker>
          )}
          {Marker && (
            <Marker coordinate={finish} anchor={{ x: 0.5, y: 0.5 }} zIndex={4} tracksViewChanges={false}>
              <FinishMarker testID="run-route-finish" />
            </Marker>
          )}
        </MapView>
      </View>
    );
  }

  // No native map: a flat drawing of the route.
  const drawing = routeSketch(points, 300, 200, 24);
  return (
    <View style={[styles.container, styles.center, style]} testID="run-route-sketch">
      {drawing && (
        <Svg width="100%" height="100%" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid meet">
          <SvgPolyline points={drawing.points} fill="none" stroke={ROUTE_GLOW} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          <SvgPolyline points={drawing.points} fill="none" stroke={ROUTE_COLOR} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={drawing.start.x} cy={drawing.start.y} r={11} fill={MARKER_HALO} />
          <Circle cx={drawing.start.x} cy={drawing.start.y} r={6} fill="none" stroke={ROUTE_COLOR} strokeWidth={3} />
          <Circle cx={drawing.end.x} cy={drawing.end.y} r={12} fill={MARKER_HALO} />
          <Circle cx={drawing.end.x} cy={drawing.end.y} r={7} fill={ROUTE_COLOR} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: MAP_BG, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 10, fontSize: 13, color: 'rgba(255,255,255,0.55)' },
});

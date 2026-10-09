// components/RunMapMarkers.jsx
//
// The two markers on a run's route: a ring at the start (open in the middle, so
// the live map's own position dot can still be seen inside it) and a solid
// white dot with a flag at the finish. Both have a soft halo. Black and white
// only, like the rest of Zown.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAP_BG, ROUTE_COLOR, MARKER_HALO } from '../constants/runMap';

export function StartMarker({ testID }) {
  return (
    <View style={styles.startHalo} testID={testID}>
      <View style={styles.startRing} />
    </View>
  );
}

export function FinishMarker({ testID }) {
  return (
    <View style={styles.finishHalo} testID={testID}>
      <View style={styles.finishDot}>
        <Ionicons name="flag" size={11} color={MAP_BG} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  startHalo: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: MARKER_HALO,
    alignItems: 'center', justifyContent: 'center',
  },
  startRing: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: ROUTE_COLOR,
  },
  finishHalo: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: MARKER_HALO,
    alignItems: 'center', justifyContent: 'center',
  },
  finishDot: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: ROUTE_COLOR,
    alignItems: 'center', justifyContent: 'center',
  },
});

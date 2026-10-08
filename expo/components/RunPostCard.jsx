// components/RunPostCard.jsx
//
// A shared run on the community feed: its title, the route, and the distance,
// time and pace. The route is drawn as a light sketch by default (a feed with
// a real map on every card would be heavy) and "View on map" opens the real
// map for that one card. The first and last 200 m of a shared route are
// hidden when it is posted (lib/runShare.js), and the card says so.
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RunRouteMap, { hasNativeMap } from './RunRouteMap';
import { describeSharedRun, SHARE_HIDE_ENDS_M } from '../lib/runShare';

const GREEN = '#22C55E';
// The route sits in a short, wide frame, so it needs far less room around it than on the run screen.
const CARD_EDGE_PADDING = { top: 30, right: 30, bottom: 30, left: 30 };

function Stat({ value, unit, label, testID }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} testID={testID}>
        {value}
        {unit ? <Text style={styles.statUnit}>{` ${unit}`}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function RunPostCard({ run, style }) {
  const info = useMemo(() => describeSharedRun(run), [run]);
  const [mapOpen, setMapOpen] = useState(false);
  if (!info) return null;
  const canOpenMap = info.hasRoute && hasNativeMap();

  return (
    <View style={[styles.card, style]} testID="run-post-card">
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name={info.activity === 'walk' ? 'walk-outline' : 'fitness-outline'} size={16} color={GREEN} />
        </View>
        <Text style={styles.title} testID="run-post-title" numberOfLines={1}>{info.title}</Text>
      </View>

      {info.hasRoute && (
        <View>
          <RunRouteMap
            points={info.points}
            sketch={!mapOpen}
            edgePadding={CARD_EDGE_PADDING}
            style={mapOpen ? styles.mapOpen : styles.mapClosed}
          />
          <View style={styles.mapFooter}>
            <Text style={styles.privacy} testID="run-post-privacy">{`First and last ${SHARE_HIDE_ENDS_M} m hidden`}</Text>
            {canOpenMap && (
              <Pressable
                onPress={() => setMapOpen((open) => !open)}
                hitSlop={8}
                accessibilityRole="button"
                testID="run-post-map-toggle"
              >
                <Text style={styles.toggle}>{mapOpen ? 'Hide map' : 'View on map'}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <View style={styles.stats}>
        <Stat value={info.distanceText} unit="km" label="Distance" testID="run-post-distance" />
        <Stat value={info.timeText} label="Time" testID="run-post-time" />
        <Stat value={info.paceText} unit="/km" label="Pace" testID="run-post-pace" />
      </View>

      {info.climb > 0 && (
        <View style={styles.climbRow}>
          <Ionicons name="trending-up" size={14} color={GREEN} />
          <Text style={styles.climbText} testID="run-post-climb">{`${info.climb} m climb`}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0D1117', borderRadius: 16, padding: 14, marginTop: 10, overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  icon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  mapClosed: { height: 150, borderRadius: 12 },
  mapOpen: { height: 240, borderRadius: 12 },
  mapFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  privacy: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  toggle: { fontSize: 12, fontWeight: '700', color: GREEN },
  stats: {
    flexDirection: 'row', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  statUnit: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 3, textTransform: 'uppercase' },
  climbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  climbText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
});

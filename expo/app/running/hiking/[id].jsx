// app/running/hiking/[id].jsx
//
// Trail preview page — the hero photo, real trail info, and the
// directions action that opens Apple Maps (iOS) or Google Maps (Android)
// pre-loaded with the real trailhead/parking coordinates, ready to drive
// or walk to. See lib/openDirections.js for the actual native hand-off.
//
// Also attempts to show the trail's actual route (not just the trailhead
// point) via services/hikingService.js's fetchTrailRoute() — this chains
// together the least-certain parts of the TrailAPI integration (see the
// audit), so it's built to fail silently: if the route can't be fetched
// or parsed, this section just doesn't render, rather than showing an
// error for what was always an optional enhancement over the core
// directions feature above.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Linking, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useHikingStore } from '@/store/hikingStore';
import { useUserStore } from '@/store/userStore';
import { getPhotoUrl, fetchTrailRoute } from '@/services/hikingService';
import { promptDirections } from '@/lib/openDirections';
import ElevationProfileChart from '@/components/ElevationProfileChart';
import TrailWeather from '@/components/TrailWeather';
import MuscleHeatmapCard from '@/components/MuscleHeatmapCard';
import { getTargetMuscles } from '@/lib/muscleFatigue';

// Same defensive-load pattern already used in components/RunningMap.jsx —
// react-native-maps isn't web-compatible, and loading it via a bare
// top-level import would break the web build for everyone, not just
// hiking. Matches the existing convention rather than introducing a new one.
let MapView, Polyline, Marker, PROVIDER_DEFAULT;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView;
    Polyline = Maps.Polyline;
    Marker = Maps.Marker;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (e) {
    console.warn('[hiking/[id]] react-native-maps failed to load:', e);
  }
}

export default function TrailPreviewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const trailId = typeof params.id === 'string' ? params.id : '';
  const { getTrailById, savedTrailIds, toggleSaveTrail, userLocation } = useHikingStore();
  const { user } = useUserStore();
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - spacing.base * 2;

  const trail = getTrailById(trailId);
  const saved = savedTrailIds.includes(trailId);
  const photoUrl = trail?.photoUrl || (trail?.photoName ? getPhotoUrl(trail.photoName, 900) : null);

  const [route, setRoute] = useState(null); // { coordinates, distanceKm, elevationGainM } | null

  useEffect(() => {
    if (!trail || trail.source !== 'trailapi' || !MapView) return;
    // The stored id is prefixed ("trailapi-721") to keep it unambiguous
    // from a Places id in the same store — strip it back off to get the
    // real TrailAPI id that getTrailMaps()/getTrailGpx() actually expect.
    const rawId = trail.id.replace(/^trailapi-/, '');
    let cancelled = false;
    fetchTrailRoute(rawId).then((result) => {
      if (!cancelled) setRoute(result);
    });
    return () => { cancelled = true; };
  }, [trail?.id]);

  if (!trail) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Trail" showBack />
        <View style={styles.centerBlock}>
          <Text style={styles.centerText}>Trail not found — go back and pick one from the list.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDirections = () => {
    promptDirections({
      latitude: trail.latitude,
      longitude: trail.longitude,
      label: trail.name,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.heroWrap}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, styles.heroFallback]}>
              <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.heroHeader}>
            <ScreenHeader showBack transparent />
            <Pressable
              style={styles.saveBtn}
              onPress={() => toggleSaveTrail(trail.id, user?.uid)}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#FFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{trail.name}</Text>
          <Text style={styles.address}>{trail.address}</Text>

          <View style={styles.metaRow}>
            {trail.rating != null && (
              <View style={styles.metaChip}>
                <Ionicons name="star" size={14} color="#F5A623" />
                <Text style={styles.metaChipText}>
                  {trail.rating.toFixed(1)}{trail.ratingCount > 0 ? ` (${trail.ratingCount} reviews)` : ''}
                </Text>
              </View>
            )}
            {trail.lengthMiles != null && (
              <View style={styles.metaChip}>
                <Ionicons name="resize-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{trail.lengthMiles.toFixed(1)} mi trail</Text>
              </View>
            )}
            {trail.distanceKm != null && (
              <View style={styles.metaChip}>
                <Ionicons name="navigate-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{trail.distanceKm.toFixed(1)} km from you</Text>
              </View>
            )}
            {trail.isOpen != null && (
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{trail.isOpen ? 'Open now' : 'Closed now'}</Text>
              </View>
            )}
          </View>

          <TrailWeather latitude={trail.latitude} longitude={trail.longitude} />

          <View style={{ marginTop: spacing.md }}>
            <MuscleHeatmapCard mode="target" targetMuscles={getTargetMuscles('hiking')} title="Muscles You'll Work" />
          </View>

          {trail.directions && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.sectionLabel}>Directions</Text>
              <Text style={styles.directionsText}>{trail.directions}</Text>
            </View>
          )}

          {trail.googleMapsUri && (
            <Pressable onPress={() => Linking.openURL(trail.googleMapsUri)} style={{ marginTop: spacing.sm }}>
              <Text style={styles.viewOnMapsLink}>View on Google Maps</Text>
            </Pressable>
          )}

          {route && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.sectionLabel}>Trail Route</Text>
              <View style={styles.routeMapWrap}>
                <MapView
                  style={styles.routeMap}
                  provider={PROVIDER_DEFAULT}
                  mapType="terrain"
                  // A tilted camera + terrain-style tiles is what gives this
                  // a real "2.5D" perspective — the tilt plus the map's own
                  // topographic relief shading, not a rendered 3D mesh built
                  // from the GPX elevation data itself (that would need a
                  // full 3D engine, a much bigger undertaking than a
                  // camera angle). Must set the FULL camera object here, not
                  // just pitch — a real, confirmed Android crash
                  // (NoSuchKeyException: pitch) happens if pitch is set
                  // without heading/zoom/altitude alongside it.
                  initialCamera={{
                    center: {
                      latitude: route.coordinates[Math.floor(route.coordinates.length / 2)].latitude,
                      longitude: route.coordinates[Math.floor(route.coordinates.length / 2)].longitude,
                    },
                    pitch: 55,
                    heading: 0,
                    zoom: 14,
                    altitude: 800,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Polyline coordinates={route.coordinates} strokeColor={colors.green} strokeWidth={4} />
                  <Marker coordinate={route.coordinates[0]} pinColor="green" />
                  <Marker coordinate={route.coordinates[route.coordinates.length - 1]} pinColor="red" />
                </MapView>
              </View>
              <View style={styles.routeStatsRow}>
                <Text style={styles.routeStatText}>{route.distanceKm.toFixed(1)} km route</Text>
                {route.elevationGainM != null && (
                  <Text style={styles.routeStatText}>{route.elevationGainM} m elevation gain</Text>
                )}
              </View>
              {/* The precise complement to the tilted map above — exact
                  elevation at any point along the route, not just a visual
                  impression of relief. Built from the same real per-point
                  GPX data. */}
              <ElevationProfileChart profile={route.elevationProfile} width={chartWidth} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={styles.monitorBtn}
          onPress={() => router.push({ pathname: '/running/hiking/monitor', params: { id: trail.id } })}
        >
          <Ionicons name="partly-sunny-outline" size={16} color={colors.text} />
          <Text style={styles.monitorBtnText}>Monitor weather during hike</Text>
        </Pressable>
        <PrimaryButton title="Get Directions" onPress={handleDirections} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  heroWrap: { position: 'relative' },
  hero: { width: '100%', height: 260 },
  heroFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  heroHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.base,
  },
  saveBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: spacing.base },
  title: { ...typography.h2, color: colors.text },
  address: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.card, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12,
  },
  metaChipText: { ...typography.caption, color: colors.text },
  viewOnMapsLink: { ...typography.bodySmall, color: colors.green, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
    color: colors.textSecondary, marginBottom: 6,
  },
  directionsText: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  routeMapWrap: { borderRadius: radius.lg, overflow: 'hidden', height: 220 },
  routeMap: { flex: 1 },
  routeStatsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  routeStatText: { ...typography.caption, color: colors.textSecondary },
  bottomBar: {
    position: 'absolute', left: spacing.base, right: spacing.base, bottom: spacing.lg,
  },
  monitorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  monitorBtnText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
});

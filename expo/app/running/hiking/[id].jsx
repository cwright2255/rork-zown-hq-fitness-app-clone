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

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Linking, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import TrailSketchMap from '@/components/TrailSketchMap';
import { useHikingStore } from '@/store/hikingStore';
import { useOfflineTrailStore } from '@/store/offlineTrailStore';
import { useUserStore } from '@/store/userStore';
import { getPhotoUrl, getTrailMaps, fetchRouteForMap } from '@/services/hikingService';
import { cachedRoute, downloadTrailForOffline } from '@/lib/offlineTrails';
import { promptDirections } from '@/lib/openDirections';
import ElevationProfileChart from '@/components/ElevationProfileChart';
import TrailWeather from '@/components/TrailWeather';
import MuscleHeatmapCard from '@/components/MuscleHeatmapCard';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { getTargetMuscles, getTargetMuscleIntensities } from '@/lib/muscleFatigue';

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

const NO_MAPS = [];
// A weak signal can leave a request hanging for a long time. After this long the
// page shows the path kept on the phone instead (and swaps in the fresh one if it
// still arrives).
const SAVED_ROUTE_WAIT_MS = 4000;

export default function TrailPreviewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const trailId = typeof params.id === 'string' ? params.id : '';
  const { getTrailById, savedTrailIds, toggleSaveTrail, userLocation } = useHikingStore();
  const { trails: offlineTrails, keepTrail, removeTrail } = useOfflineTrailStore();
  const { user } = useUserStore();
  const { scans, loadScans } = useBodyCompositionStore();

  useEffect(() => {
    if (user?.uid) loadScans(user.uid);
  }, [user?.uid]);

  // Real fix, not a fallback shortcut: [-1] on an empty array is
  // undefined, not an error, so this correctly resolves to "no scan
  // yet" (MuscleMeshHighlight's own real empty state) rather than
  // crashing when scans hasn't loaded yet or the user has none.
  const latestScan = scans && scans.length ? scans[scans.length - 1] : null;
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = windowWidth - spacing.base * 2;

  // The copy kept on the phone (see store/offlineTrailStore.js) covers a trail
  // that is not in the last search: no signal, or the app was restarted.
  const record = offlineTrails[trailId] || null;
  const trail = getTrailById(trailId) || (record ? record.trail : null);
  const saved = savedTrailIds.includes(trailId);
  const photoUrl = trail?.photoUrl || (trail?.photoName ? getPhotoUrl(trail.photoName, 900) : null);

  const [fetchedMaps, setFetchedMaps] = useState(null); // [{ id, name }] from the trail service, once it has answered
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [fetched, setFetched] = useState(null); // { mapId, route } as the trail service sent it
  const [waitedFor, setWaitedFor] = useState(null); // the path whose request has finished, or been waited for long enough

  // Real, possibly-multiple named paths for this trail: the service's list when
  // it has answered, else the list kept on the phone.
  const availableMaps = fetchedMaps && fetchedMaps.length > 0 ? fetchedMaps : ((record && record.maps) || NO_MAPS);

  // Path data only exists for TrailAPI-sourced results, and needs the native map.
  useEffect(() => {
    if (!trail || trail.source !== 'trailapi' || !MapView) return undefined;
    const rawId = trail.id.replace(/^trailapi-/, '');
    let cancelled = false;
    setLoadingMaps(true);
    getTrailMaps(rawId).then((maps) => {
      if (cancelled) return;
      setFetchedMaps(maps || []);
      setLoadingMaps(false);
    }).catch((e) => {
      console.warn('[TrailDetail] getTrailMaps failed:', e?.message);
      if (!cancelled) setLoadingMaps(false);
    });
    return () => { cancelled = true; };
  }, [trail?.id]);

  useEffect(() => {
    if (selectedMapId !== null || availableMaps.length === 0) return;
    const first = availableMaps[0];
    if (first && first.id !== undefined && first.id !== null) setSelectedMapId(first.id);
  }, [availableMaps, selectedMapId]);

  useEffect(() => {
    if (!selectedMapId) return undefined;
    const mapId = selectedMapId;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setWaitedFor(mapId); }, SAVED_ROUTE_WAIT_MS);
    fetchRouteForMap(mapId).then((result) => {
      if (cancelled) return;
      setFetched({ mapId, route: result });
      setWaitedFor(mapId);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedMapId]);

  // The line on screen: the fresh one, or, once the wait is over, the one kept on
  // the phone. Only ever the chosen path's own line.
  const fetchedRoute = fetched && selectedMapId && String(fetched.mapId) === String(selectedMapId) ? fetched.route : null;
  const waited = !!selectedMapId && waitedFor !== null && String(waitedFor) === String(selectedMapId);
  const route = fetchedRoute || (waited ? cachedRoute(record, selectedMapId) : null); // { coordinates, distanceKm, elevationGainM } | null
  const routeFromCache = !fetchedRoute && !!route;
  const knownRoutes = () => (route && selectedMapId ? { [String(selectedMapId)]: route } : undefined);

  // A saved trail keeps whatever is found for it, so it works with no signal.
  useEffect(() => {
    if (!saved || !trail) return;
    keepTrail({
      trail,
      pinned: true,
      maps: fetchedMaps || NO_MAPS,
      routes: fetchedRoute && selectedMapId ? { [String(selectedMapId)]: fetchedRoute } : undefined,
    });
  }, [saved, trail?.id, fetchedMaps, fetchedRoute]);

  // Set the moment the bookmark is pressed, so a download that is still running
  // can tell the trail was un-saved meanwhile.
  const savedRef = useRef(saved);
  useEffect(() => { savedRef.current = saved; }, [saved]);

  const handleToggleSave = () => {
    const nowSaved = !saved;
    savedRef.current = nowSaved;
    toggleSaveTrail(trail.id, user?.uid);
    if (!nowSaved) {
      removeTrail(trail.id);
      return;
    }
    keepTrail({ trail, maps: availableMaps, routes: knownRoutes(), pinned: true });
    // The other paths of the trail as well, one at a time.
    downloadTrailForOffline({
      trail,
      known: { maps: availableMaps, routes: knownRoutes() },
      fetchMaps: getTrailMaps,
      fetchRoute: fetchRouteForMap,
    }).then((found) => {
      if (savedRef.current) keepTrail({ trail, ...found, pinned: true });
    }).catch((e) => console.warn('[TrailDetail] could not keep the trail for offline use:', e?.message));
  };

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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
              onPress={handleToggleSave}
              testID="trail-save-button"
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved trails' : 'Save trail'}
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
            <MuscleHeatmapCard
              mode="target"
              targetMuscles={getTargetMuscles('hiking')}
              muscleIntensities={getTargetMuscleIntensities('hiking')}
              title="Muscles You'll Work"
              scan={latestScan}
              onRetryScan={() => user?.uid && loadScans(user.uid)}
            />
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

          {availableMaps.length > 1 && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.sectionLabel}>Choose a Path</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {availableMaps.map((m) => (
                  <Pressable
                    key={m.id}
                    style={[styles.metaChip, selectedMapId === m.id && styles.pathChipActive]}
                    onPress={() => setSelectedMapId(m.id)}
                  >
                    <Text style={[styles.metaChipText, selectedMapId === m.id && styles.pathChipTextActive]}>
                      {m.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {route && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.sectionLabel}>Trail Route</Text>
              <View style={styles.routeMapWrap}>
                {routeFromCache || !MapView ? (
                  <TrailSketchMap planned={route.coordinates} style={styles.routeMap} testID="trail-route-sketch" />
                ) : (
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
                )}
              </View>
              {routeFromCache && (
                <Text style={styles.savedNote} testID="trail-route-saved-note">
                  Saved on this phone, so it works without a signal.
                </Text>
              )}
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
        <PrimaryButton
          title="Start Hike"
          onPress={() => {
            const selectedMap = availableMaps.find((m) => m.id === selectedMapId);
            // Kept on the phone from here on, so the hike screen has the trail and its line with no signal.
            keepTrail({ trail, maps: availableMaps, routes: knownRoutes(), pinned: saved });
            router.push({
              pathname: '/running/hiking/monitor',
              params: {
                id: trail.id,
                ...(selectedMap ? { pathName: selectedMap.name, mapId: String(selectedMap.id) } : {}),
              },
            });
          }}
        />
        <Pressable style={styles.monitorBtn} onPress={handleDirections}>
          <Ionicons name="navigate-outline" size={16} color={colors.text} />
          <Text style={styles.monitorBtnText}>Get Directions</Text>
        </Pressable>
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
  pathChipActive: { backgroundColor: colors.text },
  pathChipTextActive: { color: colors.bg, fontWeight: '700' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase',
    color: colors.textSecondary, marginBottom: 6,
  },
  directionsText: { ...typography.bodySmall, color: colors.text, lineHeight: 20 },
  routeMapWrap: { borderRadius: radius.lg, overflow: 'hidden', height: 220 },
  routeMap: { flex: 1 },
  savedNote: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
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

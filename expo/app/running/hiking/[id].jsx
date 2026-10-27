// app/running/hiking/[id].jsx
//
// Trail preview page — the hero photo, real trail info, and the
// directions action that opens Apple Maps (iOS) or Google Maps (Android)
// pre-loaded with the real trailhead/parking coordinates, ready to drive
// or walk to. See lib/openDirections.js for the actual native hand-off.
//
// The page's main job after the facts about the trail is its paths: "Choose a Path"
// and a map that frames the chosen one, with the others in grey under it (tap one
// to choose it). Paths come from two places, shown together:
//   - the trail service (TrailAPI) via services/hikingService.js's getTrailMaps()
//     and fetchRouteForMap(), for trails it has a drawn line for. Built to fail
//     silently: if its paths cannot be fetched or parsed, they just don't show.
//   - OpenStreetMap (fetchOsmPaths), the named paths around the trail's point, for
//     every trail. Each comes with its line, so choosing one needs no second request.
// When there is no path at all the page says why (looking, none marked, could not
// load) instead of showing nothing.

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { useSettingsStore } from '@/store/settingsStore';
import { formatDistance, milesToKm } from '@/lib/distanceUnits';
import { getTrailMaps, fetchRouteForMap, fetchOsmPaths } from '@/services/hikingService';
import { useTrailPhoto } from '@/hooks/useTrailPhoto';
import { cachedRoute, downloadTrailForOffline, MAX_PATHS_PER_TRAIL } from '@/lib/offlineTrails';
import { isOsmPathId, trailPoint } from '@/lib/osmTrails';
import { routeRegion } from '@/lib/runDetail';
import { trailGpxFile } from '@/lib/gpxExport';
import { shareGpx, gpxShareErrorText } from '@/services/gpxShare';
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
const NO_ROUTES = {};

// A weak signal can leave a request hanging for a long time. After this long the
// page shows the path kept on the phone instead (and swaps in the fresh one if it
// still arrives).
const SAVED_ROUTE_WAIT_MS = 4000;

export default function TrailPreviewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const units = useSettingsStore((s) => s.units); // Settings > Distance Units: miles or km
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
  const photoUrl = useTrailPhoto(trail, 900);
  // The trail's point on the map as numbers (a trail service may send them as text); null when it has none.
  const point = trailPoint(trail);
  const hasPoint = point !== null;

  const [fetchedMaps, setFetchedMaps] = useState(null); // [{ id, name }] from the trail service, once it has answered
  const [chosenMapId, setChosenMapId] = useState(null); // the path the person tapped; until then the first one is on
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [fetched, setFetched] = useState(null); // { mapId, route } as the trail service sent it
  const [seenRoutes, setSeenRoutes] = useState(NO_ROUTES); // the lines the trail service has sent so far, by path id
  const [waitedFor, setWaitedFor] = useState(null); // the path whose request has finished, or been waited for long enough
  // The named paths around the trail from OpenStreetMap, each with its line:
  // { status: 'loading' | 'done' | 'error', maps: [{ id, name, distanceKm }], routes: { [id]: route } }
  const [osm, setOsm] = useState(() => ({ status: hasPoint ? 'loading' : 'done', maps: NO_MAPS, routes: NO_ROUTES }));
  const [osmWaited, setOsmWaited] = useState(false); // OpenStreetMap has been waited for long enough to show the saved line
  const [osmTry, setOsmTry] = useState(0); // bumped by "Try again"
  const [exporting, setExporting] = useState(false); // the route is being written out as a GPX file
  const [exportError, setExportError] = useState('');

  // Every path of this trail: those of the trail service (its list when it has
  // answered, else the list kept on the phone), then the named paths from
  // OpenStreetMap (fresh when they have arrived, else the ones kept).
  const keptMaps = (record && record.maps) || NO_MAPS;
  const availableMaps = useMemo(() => {
    const fromService = fetchedMaps && fetchedMaps.length > 0 ? fetchedMaps : keptMaps.filter((m) => !isOsmPathId(String(m.id)));
    const fromOsm = osm.status === 'done' ? osm.maps : keptMaps.filter((m) => isOsmPathId(String(m.id)));
    return fromOsm.length === 0 ? fromService : [...fromService, ...fromOsm];
  }, [fetchedMaps, keptMaps, osm]);

  // The path on screen: the one tapped, else the first. Worked out from the list, so a
  // list that changes underneath (the fresh one arriving) can never leave a path that is gone.
  const selectedMapId = useMemo(() => {
    if (chosenMapId !== null && availableMaps.some((m) => String(m.id) === String(chosenMapId))) return chosenMapId;
    const first = availableMaps[0];
    return first && first.id !== undefined && first.id !== null ? first.id : null;
  }, [availableMaps, chosenMapId]);
  const selectedKey = selectedMapId === null ? null : String(selectedMapId);
  const selectedIsOsm = selectedKey !== null && isOsmPathId(selectedKey);

  // Path data from the trail service only exists for TrailAPI-sourced results, and needs the native map.
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

  // Named paths from OpenStreetMap, for any trail with a point on the map: the
  // trail service has a line for only some trails, this is what makes the rest show lines.
  useEffect(() => {
    if (!hasPoint) return undefined;
    let cancelled = false;
    setOsm((o) => (o.status === 'loading' ? o : { ...o, status: 'loading' }));
    setOsmWaited(false);
    const timer = setTimeout(() => { if (!cancelled) setOsmWaited(true); }, SAVED_ROUTE_WAIT_MS);
    fetchOsmPaths(point).then((found) => {
      if (cancelled) return;
      setOsm({ status: 'done', maps: found.maps, routes: found.routes });
    }).catch((e) => {
      console.warn('[TrailDetail] fetchOsmPaths failed:', e?.message);
      if (!cancelled) setOsm({ status: 'error', maps: NO_MAPS, routes: NO_ROUTES });
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trail?.id, osmTry]);

  useEffect(() => {
    if (!selectedMapId || selectedIsOsm) return undefined; // a path from OpenStreetMap came with its line
    const mapId = selectedMapId;
    let cancelled = false;
    const timer = setTimeout(() => { if (!cancelled) setWaitedFor(mapId); }, SAVED_ROUTE_WAIT_MS);
    fetchRouteForMap(mapId).then((result) => {
      if (cancelled) return;
      setFetched({ mapId, route: result });
      if (result) setSeenRoutes((seen) => ({ ...seen, [String(mapId)]: result }));
      setWaitedFor(mapId);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedMapId]);

  // The line on screen: the fresh one, or, once the wait is over, the one kept on
  // the phone. Only ever the chosen path's own line.
  const fetchedRoute = !selectedIsOsm && fetched && selectedKey !== null && String(fetched.mapId) === selectedKey ? fetched.route : null;
  const waited = !selectedIsOsm && selectedKey !== null && waitedFor !== null && String(waitedFor) === selectedKey;
  const osmSettled = osm.status !== 'loading' || osmWaited;
  const freshOsmRoute = selectedIsOsm ? (osm.routes[selectedKey] || null) : null;
  const route = selectedIsOsm
    ? (freshOsmRoute || (osmSettled ? cachedRoute(record, selectedKey) : null))
    : (fetchedRoute || (waited ? cachedRoute(record, selectedMapId) : null)); // { coordinates, distanceKm, elevationGainM } | null
  const routeFromCache = !!route && !fetchedRoute && !freshOsmRoute;
  const knownRoutes = () => (route && selectedKey !== null ? { [selectedKey]: route } : undefined);

  // The lines of the other paths, grey on the map under the chosen one, so the
  // choice can be seen. Only lines that have arrived are drawn.
  const knownLines = useMemo(() => ({ ...seenRoutes, ...osm.routes }), [seenRoutes, osm.routes]);
  const otherLines = route
    ? availableMaps
      .filter((m) => String(m.id) !== selectedKey && knownLines[String(m.id)])
      .map((m) => ({ id: m.id, name: m.name, coordinates: knownLines[String(m.id)].coordinates }))
    : [];
  // How long a path is, once its line is known (just fetched, or kept on the phone).
  const lengthOf = (m) => {
    const key = String(m.id);
    const line = knownLines[key] || (record && record.routes ? record.routes[key] : null);
    return line && typeof line.distanceKm === 'number' ? line.distanceKm : null;
  };

  // What to keep on the phone for the trail: the chosen path's line and, from
  // OpenStreetMap, a few of the others. The chosen one goes last: the phone keeps
  // only a few per trail, and the first to arrive are the first to go.
  //   freshOnly: only lines that were just fetched (a line already kept needs no second copy).
  const routesToKeep = (freshOnly) => {
    const chosen = freshOnly ? (selectedIsOsm ? freshOsmRoute : fetchedRoute) : route;
    const out = {};
    Object.keys(osm.routes)
      .filter((k) => k !== selectedKey)
      .slice(0, MAX_PATHS_PER_TRAIL - 1)
      .forEach((k) => { out[k] = osm.routes[k]; });
    if (chosen && selectedKey !== null) out[selectedKey] = chosen;
    return Object.keys(out).length > 0 ? out : undefined;
  };
  // The paths kept with the lines: when there are more than the phone keeps, the ones with a line come first.
  const mapsToKeep = (routes) => {
    if (availableMaps.length <= MAX_PATHS_PER_TRAIL) return availableMaps;
    const has = routes || NO_ROUTES;
    return [...availableMaps.filter((m) => has[String(m.id)]), ...availableMaps.filter((m) => !has[String(m.id)])];
  };

  // A saved trail keeps whatever is found for it, so it works with no signal.
  useEffect(() => {
    if (!saved || !trail) return;
    const routes = routesToKeep(true);
    keepTrail({ trail, pinned: true, maps: mapsToKeep(routes), routes });
  }, [saved, trail?.id, fetchedMaps, fetchedRoute, osm]);

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
    const routes = routesToKeep(false);
    keepTrail({ trail, maps: mapsToKeep(routes), routes, pinned: true });
    // The other paths of the trail as well, one at a time.
    downloadTrailForOffline({
      trail,
      known: { maps: availableMaps, routes },
      fetchMaps: getTrailMaps,
      fetchRoute: fetchRouteForMap,
    }).then((found) => {
      if (savedRef.current) keepTrail({ trail, ...found, pinned: true });
    }).catch((e) => console.warn('[TrailDetail] could not keep the trail for offline use:', e?.message));
  };

  // The route of the chosen path as a GPX file, through the phone's share sheet.
  const handleExportGpx = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    const selectedMap = availableMaps.find((m) => m.id === selectedMapId);
    const result = await shareGpx(trailGpxFile({ trail, pathName: selectedMap ? selectedMap.name : '', route }));
    setExporting(false);
    if (!result.ok) setExportError(gpxShareErrorText(result.reason));
  };

  if (!trail) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
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

  // Why there is no line to show yet, in words. Empty once there is a line.
  let pathsNote = '';
  if (!route) {
    if (availableMaps.length === 0) {
      if (osm.status === 'loading' || loadingMaps) pathsNote = 'Looking for trail paths…';
      else if (osm.status === 'error') pathsNote = "Couldn't load the trail paths. Check your signal and try again.";
      else pathsNote = 'No marked paths found near this trailhead.';
    } else if (!selectedIsOsm && fetched && String(fetched.mapId) === selectedKey && !fetched.route) {
      pathsNote = "This path's line isn't available right now.";
    } else if (selectedIsOsm && osm.status !== 'loading') {
      // OpenStreetMap has answered or could not be reached, and no line was kept on the phone for this path: nothing is on its way.
      pathsNote = "This path isn't saved on this phone. Connect to the internet to load it.";
    } else {
      pathsNote = 'Loading the path…';
    }
  }
  const showsOsmData = !!route && availableMaps.some((m) => isOsmPathId(String(m.id)));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
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
                <Text style={styles.metaChipText}>{formatDistance(milesToKm(trail.lengthMiles), units, 1)} trail</Text>
              </View>
            )}
            {trail.distanceKm != null && (
              <View style={styles.metaChip}>
                <Ionicons name="navigate-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{formatDistance(trail.distanceKm, units, 1)} from you</Text>
              </View>
            )}
            {trail.isOpen != null && (
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaChipText}>{trail.isOpen ? 'Open now' : 'Closed now'}</Text>
              </View>
            )}
          </View>

          {/* The paths come right after the facts about the trail: they are what the
              page is for, and used to sit far down below the weather and muscle cards. */}
          {availableMaps.length > 1 && (
            <View style={{ marginTop: spacing.lg }} testID="trail-path-picker">
              <Text style={styles.sectionLabel}>Choose a Path</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {availableMaps.map((m) => {
                  const active = selectedKey === String(m.id);
                  const km = lengthOf(m);
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.metaChip, active && styles.pathChipActive]}
                      onPress={() => setChosenMapId(m.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      testID={`trail-path-${m.id}`}
                    >
                      <Text style={[styles.metaChipText, active && styles.pathChipTextActive]}>
                        {m.name}
                      </Text>
                      {km !== null && (
                        <Text style={[styles.pathChipMeta, active && styles.pathChipTextActive]}>
                          {formatDistance(km, units, 1)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {!route && !!pathsNote && (
            <View style={{ marginTop: spacing.lg }} testID="trail-paths-status">
              {availableMaps.length <= 1 && <Text style={styles.sectionLabel}>Trail Paths</Text>}
              <Text style={styles.pathsNote} testID="trail-paths-note">{pathsNote}</Text>
              {availableMaps.length === 0 && osm.status === 'error' && (
                <Pressable
                  style={styles.exportBtn}
                  onPress={() => setOsmTry((n) => n + 1)}
                  accessibilityRole="button"
                  testID="trail-paths-retry"
                >
                  <Ionicons name="refresh-outline" size={16} color={colors.text} />
                  <Text style={styles.exportBtnText}>Try again</Text>
                </Pressable>
              )}
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
                    // A new map for each path, framed on that path: the whole line is in view,
                    // and the map is not left pointing at the path that was chosen before.
                    key={selectedKey}
                    style={styles.routeMap}
                    provider={PROVIDER_DEFAULT}
                    mapType="terrain"
                    initialRegion={routeRegion(route.coordinates, { padding: 1.5 }) || undefined}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                  >
                    {otherLines.map((line) => (
                      <Polyline
                        key={line.id}
                        coordinates={line.coordinates}
                        strokeColor={colors.textSecondary}
                        strokeWidth={3}
                        tappable
                        onPress={() => setChosenMapId(line.id)}
                      />
                    ))}
                    <Polyline coordinates={route.coordinates} strokeColor={colors.green} strokeWidth={5} />
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
                <Text style={styles.routeStatText}>{formatDistance(route.distanceKm, units, 1)} route</Text>
                {route.elevationGainM != null && (
                  <Text style={styles.routeStatText}>{route.elevationGainM} m elevation gain</Text>
                )}
              </View>
              {/* The precise complement to the map above — exact elevation at any
                  point along the route, not just a visual impression of relief.
                  Built from the same real per-point GPX data (a path from
                  OpenStreetMap has no heights, so it has no chart). */}
              <ElevationProfileChart profile={route.elevationProfile} width={chartWidth} units={units} />
              <Pressable
                style={styles.exportBtn}
                onPress={handleExportGpx}
                disabled={exporting}
                accessibilityRole="button"
                testID="trail-export-gpx"
              >
                <Ionicons name="download-outline" size={16} color={colors.text} />
                <Text style={styles.exportBtnText}>{exporting ? 'Preparing...' : 'Export route as GPX'}</Text>
              </Pressable>
              {!!exportError && <Text style={styles.exportError} testID="trail-export-error">{exportError}</Text>}
              {showsOsmData && (
                <Text style={styles.osmCredit} testID="trail-osm-credit">Path data © OpenStreetMap contributors</Text>
              )}
            </View>
          )}

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
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <PrimaryButton
          title="Start Hike"
          onPress={() => {
            const selectedMap = availableMaps.find((m) => m.id === selectedMapId);
            // Kept on the phone from here on, so the hike screen has the trail and its line with no signal.
            const routes = knownRoutes();
            keepTrail({ trail, maps: mapsToKeep(routes), routes, pinned: saved });
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
  pathChipMeta: { ...typography.caption, color: colors.textSecondary },
  pathsNote: { ...typography.bodySmall, color: colors.textSecondary },
  osmCredit: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
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
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, marginTop: spacing.md,
  },
  exportBtnText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  exportError: { ...typography.caption, color: '#B91C1C', marginTop: spacing.xs, textAlign: 'center' },
  bottomBar: {
    position: 'absolute', left: spacing.base, right: spacing.base, bottom: spacing.lg,
  },
  monitorBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.sm, marginBottom: spacing.sm,
  },
  monitorBtnText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
});

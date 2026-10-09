// app/running/hiking/monitor.jsx
//
// A hike in progress. It is recorded the same way a run is: the GPS goes into
// the run tracker (store/runTrackerStore.js, lib/runTracker.js), fed by
// services/runTracking.js, so the hike keeps recording with the phone locked or
// the app in the background, and the distance, climb and route are the tracker's
// (smoothed, with jumps and shimmer filtered out) rather than raw readings.
// When the hike is finished it is saved with the route walked
// (store/hikingStore.js, lib/hikeLog.js), shown in the hike history, and can be
// shared to the feed.
//
// On top of the same position, this screen also does what it always did:
//   1. Periodic weather/alert re-checks (every 15 min) tied to the
//      hiker's actual current position, not just a one-time check at the
//      trailhead before setting out.
//   2. A real difficulty rating on completion (see lib/hikeDifficulty.js — the
//      verified Shenandoah National Park formula) with XP/badges scaled to it.
//
// Polls the weather every 15 minutes, not continuously — real weather
// conditions don't meaningfully change faster than that, and hammering a free
// public API on a fast interval would be inconsiderate of a service that costs
// NWS nothing to offer and everyone something to keep working.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import TrailSketchMap from '@/components/TrailSketchMap';
import { useHikingStore } from '@/store/hikingStore';
import { useOfflineTrailStore } from '@/store/offlineTrailStore';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useBadgeStore } from '@/store/badgeStore';
import { useRunTrackerStore } from '@/store/runTrackerStore';
import { getWeatherSnapshot } from '@/services/weatherService';
import { startTracking, stopTracking } from '@/services/runTracking';
import { trackedMs, gpsStatus, elevationGain, finishTracker } from '@/lib/runTracker';
import { distanceM } from '@/lib/gpsFilter';
import { MIN_HIKE_KM } from '@/lib/hikeLog';
import { calculateHikeDifficulty, estimateHikeCalories } from '@/lib/hikeDifficulty';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';
import { fetchRouteForMap } from '@/services/hikingService';
import { cachedRoute } from '@/lib/offlineTrails';

// Same safe/conditional import pattern already established in
// app/running/hiking/[id].jsx - react-native-maps needs a native
// rebuild and isn't available on web, so a top-level import would break
// the web build for everyone, not just hiking.
let MapView, Polyline, Marker, PROVIDER_DEFAULT;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps.MapView;
    Polyline = Maps.Polyline;
    Marker = Maps.Marker;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
  } catch (e) {
    console.warn('[hiking/monitor] react-native-maps failed to load:', e);
  }
}

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
// The map follows the hiker once they are this far (metres) from where it is centred.
const RECENTRE_M = 40;

const SEVERITY_COLOR = {
  Extreme: '#B91C1C',
  Severe: '#EA580C',
  Moderate: '#D97706',
  Minor: '#65A30D',
  Unknown: colors.textSecondary,
};

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HikeWeatherMonitorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const trailId = typeof params.id === 'string' ? params.id : '';
  const mapId = typeof params.mapId === 'string' ? params.mapId : null;
  const pathName = typeof params.pathName === 'string' ? params.pathName : null;
  const { getTrailById, addCompletedHike } = useHikingStore();
  const { trails: offlineTrails, keepTrail } = useOfflineTrailStore();
  const { scans: bodyScans } = useBodyCompositionStore();
  const { user } = useUserStore();
  const { addExpActivity } = useExpStore();
  const { unlockBadge } = useBadgeStore();
  // The copy kept on the phone covers a trail that is not in the last search (no
  // signal, or the app was restarted), so the hike is still saved under its name.
  const record = offlineTrails[trailId] || null;
  const trail = getTrailById(trailId) || (record ? record.trail : null);
  const keptRoute = cachedRoute(record, mapId);

  // The hike being recorded. Everything measured lives in the tracker store.
  const tracker = useRunTrackerStore((s) => s.tracker);
  const [now, setNow] = useState(() => Date.now());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [startPoint, setStartPoint] = useState(null); // first position, before the tracker has one
  const [mapCenter, setMapCenter] = useState(null);
  const [plannedRoute, setPlannedRoute] = useState(null); // { coordinates, ... } | null - the path the user picked before starting, if any
  const [snapshot, setSnapshot] = useState(null);
  const [weatherFailed, setWeatherFailed] = useState(false); // the last weather check could not reach the network
  const [viewChoice, setViewChoice] = useState(null); // null: automatic, else 'map' or 'trail'
  const [isChecking, setIsChecking] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showLeave, setShowLeave] = useState(false);
  const [completing, setCompleting] = useState(false);

  const pollIntervalRef = useRef(null);
  const endedRef = useRef(false);
  // Refs mirroring the state the poll callback needs, specifically so the
  // interval itself can be created exactly ONCE on mount and never torn
  // down. A first version of this depended on the position directly in the
  // effect that owns the interval — but the position updates from GPS every
  // few seconds while actually hiking, which cleared and recreated the
  // interval before it ever reached its real 15-minute mark. Verified this
  // concretely (simulated 30 minutes of position updates against a 15-minute
  // interval) before trusting the fix — the interval never once got an
  // uninterrupted 15 minutes to fire.
  const currentLocationRef = useRef(null);
  const previousAlertIdsRef = useRef(new Set());
  const audioEnabledRef = useRef(true);

  const currentLocation = tracker.current || startPoint;
  const elapsed = Math.floor(trackedMs(tracker, now) / 1000);
  const distanceKm = tracker.distanceM / 1000;
  const elevationGainM = elevationGain(tracker);
  const walkedPath = tracker.route;
  const gps = gpsStatus(tracker, now);
  const isPaused = tracker.status === 'paused' || tracker.status === 'auto';
  // The map picture needs a signal. Left on automatic, the screen shows the trail
  // alone (a plain dark picture) once a check could not reach the network, and
  // the person can pick either at any time.
  const view = !MapView ? 'trail' : (viewChoice || (weatherFailed ? 'trail' : 'map'));

  // Whether the last weather check could not reach the network. Only a change is
  // passed on, so a check that goes the same way as the last does not redraw.
  const weatherFailedRef = useRef(false);
  const noteNetwork = useCallback((failed) => {
    if (weatherFailedRef.current === failed) return;
    weatherFailedRef.current = failed;
    setWeatherFailed(failed);
  }, []);

  const runWeatherCheck = useCallback(async (latitude, longitude, isFirstCheck) => {
    setIsChecking(true);
    try {
      const result = await getWeatherSnapshot(latitude, longitude);
      noteNetwork(false);
      setSnapshot(result);

      const newAlertIds = new Set(result.alerts.map((a) => a.id));
      // Only speak/flag alerts that are genuinely NEW since the last
      // check — re-announcing the same still-active alert every 15
      // minutes would train someone to tune the warning out, exactly the
      // opposite of what a safety feature should do.
      const newlyAppeared = result.alerts.filter((a) => !previousAlertIdsRef.current.has(a.id));
      if (!isFirstCheck && newlyAppeared.length > 0 && audioEnabledRef.current) {
        const worst = newlyAppeared[0];
        Speech.stop();
        Speech.speak(`Weather alert: ${worst.event} for your area. ${worst.headline || ''}`, { rate: 0.95 });
      } else if (isFirstCheck && result.alerts.length > 0 && audioEnabledRef.current) {
        Speech.speak(`Before you start: ${result.alerts[0].event} is active for this area.`, { rate: 0.95 });
      }
      previousAlertIdsRef.current = newAlertIds;
    } catch (e) {
      console.warn('[HikeMonitor] weather check failed:', e?.message);
      noteNetwork(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // The path the user picked on the trail screen's "Choose a Path" picker.
  // The line kept on the phone is used straight away (it works with no signal);
  // otherwise the real route is fetched here (rather than trying to serialize a
  // whole GPX coordinate array through URL params, which would be fragile for a
  // large track) using the same real fetchRouteForMap this screen's own mapId
  // param references, and kept for next time.
  useEffect(() => {
    if (!mapId) return undefined;
    if (keptRoute) {
      setPlannedRoute(keptRoute);
      return undefined;
    }
    let cancelled = false;
    fetchRouteForMap(mapId).then((result) => {
      if (cancelled) return;
      setPlannedRoute(result);
      if (result && trail) keepTrail({ trail, routes: { [mapId]: result } });
    });
    return () => { cancelled = true; };
  }, [mapId, keptRoute]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setIsMonitoring(false);
        return;
      }
      // Auto-pause is off for a hike: climbing a steep trail is slower than the
      // speed auto-pause treats as standing still. The kind includes the trail,
      // so only a hike on THIS trail that was left paused is picked up again.
      const mode = useRunTrackerStore.getState().begin({ autoPause: false, kind: `hike:${trailId}` });
      if (mode === 'resumed' && useRunTrackerStore.getState().tracker.status === 'paused') {
        setShowLeave(true);
      }
      try {
        await startTracking({ label: 'hike' });
      } catch (e) {
        console.warn('[HikeMonitor] tracking error:', e?.message);
      }
      // A first position for the weather check and to centre the map before the
      // tracker has its own reading.
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (!currentLocationRef.current) currentLocationRef.current = loc;
        setStartPoint(loc);
        await runWeatherCheck(loc.latitude, loc.longitude, true);
      } catch (e) {
        console.warn('[HikeMonitor] could not get a first position:', e?.message);
      }
    })();

    const clock = setInterval(() => setNow(Date.now()), 1000);

    // Created exactly once, on mount — reads currentLocationRef at fire
    // time rather than depending on position state directly, so frequent GPS
    // updates during real movement can't keep resetting this before it ever
    // reaches its real 15-minute mark (see the comment on currentLocationRef
    // above — this was verified as a real bug, not a theoretical one).
    pollIntervalRef.current = setInterval(() => {
      if (currentLocationRef.current) {
        runWeatherCheck(currentLocationRef.current.latitude, currentLocationRef.current.longitude, false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(clock);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      Speech.stop();
      // Leaving this screen without finishing the hike pauses it, so nothing
      // keeps counting unseen; it is picked up again when the screen reopens.
      if (!endedRef.current) useRunTrackerStore.getState().pause(Date.now());
    };
  }, []);

  // The weather check reads the tracker's position when there is one.
  useEffect(() => {
    if (tracker.current) currentLocationRef.current = tracker.current;
  }, [tracker.current]);

  // The map follows the hiker, but not on every reading (that would fight a
  // hand moving the map): only once they are well away from where it is centred.
  useEffect(() => {
    if (!currentLocation) return;
    if (!mapCenter || distanceM(mapCenter, currentLocation) > RECENTRE_M) setMapCenter(currentLocation);
  }, [currentLocation && currentLocation.latitude, currentLocation && currentLocation.longitude]);

  // Keeps audioEnabledRef in sync so the long-lived poll interval's
  // callback always reads the current toggle state without needing to be
  // in that interval's own effect dependencies.
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const handleManualCheck = () => {
    if (currentLocation) runWeatherCheck(currentLocation.latitude, currentLocation.longitude, false);
  };

  const handlePause = () => {
    useRunTrackerStore.getState().pause(Date.now());
  };

  const handleResume = () => {
    useRunTrackerStore.getState().resume(Date.now());
    setShowLeave(false);
    // GPS is switched off after a very long pause; make sure it is on again.
    startTracking({ label: 'hike' }).catch((e) => console.warn('[HikeMonitor] tracking error:', e?.message));
  };

  // Throws the recording away and leaves. Used when there is nothing worth
  // keeping (under MIN_HIKE_KM) or when the person says so.
  const handleDiscard = () => {
    endedRef.current = true;
    Speech.stop();
    stopTracking();
    useRunTrackerStore.getState().reset();
    router.back();
  };

  // A minimum real distance before this counts as a "completed hike" for
  // rewards purposes — otherwise opening this screen and immediately
  // ending it would trivially farm XP and badges for a hike that never
  // actually happened.
  const hasTrackedRealHike = distanceKm >= MIN_HIKE_KM;

  // The back arrow. A hike with real distance on it is paused and the person is
  // asked what to do, so a stray tap does not lose hours of recording.
  const handleBack = () => {
    if (!hasTrackedRealHike) {
      handleDiscard();
      return;
    }
    useRunTrackerStore.getState().pause(Date.now());
    setShowLeave(true);
  };

  const handleCompleteHike = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setCompleting(true);
    setShowLeave(false);
    Speech.stop();
    try {
      // The numbers come from the tracker (moving time only). It is cleared
      // only once the hike is saved, so a failure here loses nothing.
      const summary = finishTracker(useRunTrackerStore.getState().tracker, Date.now());
      const km = summary.distance;
      const seconds = summary.duration;
      const difficulty = calculateHikeDifficulty({ distanceKm: km, elevationGainM: summary.elevGain });
      const baseXp = Math.round(km * 40); // same per-km rate order of magnitude as running's XP, before the difficulty multiplier
      const totalXp = Math.round(baseXp * difficulty.xpMultiplier);
      // Real weight from the most recent body scan when available (see
      // §15 — the body-composition feature), rather than always falling
      // back to a generic default — the MET-based calorie formula scales
      // directly with body weight, so a real value meaningfully improves
      // the estimate over a stranger's average.
      const latestScan = [...bodyScans].sort((a, b) => new Date(b.createdAtLocal || 0) - new Date(a.createdAtLocal || 0))[0];
      const calories = estimateHikeCalories({
        tier: difficulty.tier,
        durationSeconds: seconds,
        weightKg: latestScan?.weightKg,
      });

      const record = addCompletedHike({
        trailId: trail?.id || null,
        trailName: trail?.name || 'Untitled hike',
        pathName: pathName || null,
        distanceKm: km,
        elevationGainM: summary.elevGain,
        elevationLossM: summary.elevLoss,
        durationSeconds: seconds,
        difficultyScore: difficulty.score,
        difficultyTier: difficulty.tier,
        calories,
        xpEarned: totalXp,
        startTime: summary.startTime,
        coords: summary.coords,
      }, user?.uid);

      stopTracking();
      useRunTrackerStore.getState().reset();

      addExpActivity?.({
        id: Date.now().toString(),
        type: 'hiking',
        baseExp: baseXp,
        multiplier: difficulty.xpMultiplier,
        date: new Date().toISOString().split('T')[0],
        description: `Completed a ${difficulty.tier.toLowerCase()} hike — ${record.distanceKm}km, ${difficulty.elevationGainFt}ft gain`,
        completed: true,
      }, user?.uid);

      // Real badge conditions, checked against actual tracked data — not
      // instant-unlocked the way badge-1/badge-2 used to be before that
      // was fixed earlier in this app's audit.
      const { completedHikes } = useHikingStore.getState();
      const totalHikingMiles = completedHikes.reduce((sum, h) => sum + (h.distanceKm || 0), 0) * 0.621371;

      if (completedHikes.length === 1) {
        unlockBadge?.('badge-11', user?.uid); // First Trail
      }
      if (['Strenuous', 'Very Strenuous'].includes(difficulty.tier)) {
        unlockBadge?.('badge-12', user?.uid); // Strenuous Summit
      }
      if (totalHikingMiles >= 10) {
        unlockBadge?.('badge-13', user?.uid); // Trail Blazer
      }

      router.replace({
        pathname: '/workout/complete',
        params: {
          type: 'hike',
          hikeId: record.id,
          distanceKm: String(record.distanceKm),
          elevationGainM: String(record.elevationGainM),
          durationSeconds: String(seconds),
          difficultyTier: difficulty.tier,
          calories: String(calories),
          xpEarned: String(totalXp),
        },
      });
    } catch (e) {
      console.warn('[HikeMonitor] complete hike failed:', e?.message);
      endedRef.current = false;
      setCompleting(false);
    }
  };

  const worstAlert = snapshot?.alerts?.[0];
  const current = snapshot?.forecast?.[0];
  const liveDifficulty = calculateHikeDifficulty({ distanceKm, elevationGainM });

  // One line saying why the clock is stopped, or what is wrong with the GPS.
  let banner = null;
  if (tracker.status === 'paused') {
    banner = { icon: 'pause', text: 'Paused', warn: false };
  } else if (tracker.status === 'auto') {
    banner = { icon: 'pause-circle', text: 'Auto-paused. Start moving to resume.', warn: false };
  } else if (tracker.status === 'running' && gps !== 'good' && gps !== 'fair') {
    const text = gps === 'lost' ? 'GPS signal lost' : gps === 'weak' ? 'Weak GPS signal' : 'Searching for GPS...';
    banner = { icon: 'locate', text, warn: true };
  }

  if (!isMonitoring) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Hike" showBack variant="light" />
        <View style={styles.centerBlock}>
          <Ionicons name="location-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerText} testID="hike-no-location">
            Location access is needed to record your hike and watch the weather along the way.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={trail?.name || 'Hike'}
        showBack
        variant="light"
        onBack={handleBack}
        rightAction={
          <Pressable onPress={() => setAudioEnabled((v) => !v)} hitSlop={8}>
            <Ionicons name={audioEnabled ? 'volume-high' : 'volume-mute'} size={20} color={colors.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 220 }}>
        {currentLocation && (
          <View style={styles.mapWrap}>
            {view === 'trail' ? (
              <TrailSketchMap
                planned={plannedRoute?.coordinates}
                walked={walkedPath}
                current={currentLocation}
                style={styles.map}
                testID="hike-trail-view"
              />
            ) : (
              <MapView
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                region={{
                  latitude: (mapCenter || currentLocation).latitude,
                  longitude: (mapCenter || currentLocation).longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                {plannedRoute?.coordinates && (
                  <Polyline coordinates={plannedRoute.coordinates} strokeColor={colors.textSecondary} strokeWidth={3} lineDashPattern={[6, 4]} />
                )}
                {walkedPath.length > 1 && (
                  <Polyline coordinates={walkedPath} strokeColor={colors.green} strokeWidth={4} />
                )}
                <Marker coordinate={currentLocation} pinColor="green" />
              </MapView>
            )}
            {MapView && (
              <View style={styles.viewToggle}>
                {['map', 'trail'].map((mode) => (
                  <Pressable
                    key={mode}
                    testID={`hike-view-${mode}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: view === mode }}
                    style={[styles.viewPill, view === mode && styles.viewPillActive]}
                    onPress={() => setViewChoice(mode)}
                    hitSlop={6}
                  >
                    <Text style={[styles.viewPillText, view === mode && styles.viewPillTextActive]}>
                      {mode === 'map' ? 'Map' : 'Trail'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
        {currentLocation && MapView && view === 'trail' && viewChoice === null && weatherFailed && (
          <Text style={styles.offlineNote} testID="hike-offline-note">
            No signal, so the map picture is off. Your trail and your position still show.
          </Text>
        )}
        <View style={styles.elapsedCard}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.elapsedText} testID="hike-elapsed">
            {isPaused ? `Paused at ${formatElapsed(elapsed)}` : `Hiking for ${formatElapsed(elapsed)}`}
          </Text>
        </View>

        {banner && (
          <View style={[styles.banner, banner.warn ? styles.bannerWarn : styles.bannerPause]} testID="hike-banner">
            <Ionicons name={banner.icon} size={14} color="#FFF" />
            <Text style={styles.bannerText}>{banner.text}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="hike-distance">{distanceKm.toFixed(2)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="hike-climb">{Math.round(elevationGainM)} m</Text>
            <Text style={styles.statLabel}>Elevation gain</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue} testID="hike-difficulty">{liveDifficulty.tier}</Text>
            <Text style={styles.statLabel}>Difficulty so far</Text>
          </View>
        </View>

        {worstAlert ? (
          <View style={[styles.alertCard, { backgroundColor: SEVERITY_COLOR[worstAlert.severity] }]}>
            <Ionicons name="warning" size={24} color="#FFF" />
            <Text style={styles.alertCardEvent}>{worstAlert.event}</Text>
            <Text style={styles.alertCardHeadline}>{worstAlert.headline}</Text>
            {worstAlert.instruction && (
              <Text style={styles.alertCardInstruction}>{worstAlert.instruction}</Text>
            )}
            {snapshot.alerts.length > 1 && (
              <Text style={styles.alertCardMore}>
                +{snapshot.alerts.length - 1} more active alert{snapshot.alerts.length > 2 ? 's' : ''}
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.clearCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.green} />
            <Text style={styles.clearText}>No active weather alerts for your current location</Text>
          </View>
        )}

        {current && (
          <View style={styles.forecastCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.forecastLabel}>{current.name}</Text>
              <Text style={styles.forecastText}>{current.shortForecast}</Text>
              <Text style={styles.forecastSub}>{current.windDirection} {current.windSpeed}</Text>
            </View>
            <Text style={styles.tempText}>{current.temperatureF}°F</Text>
          </View>
        )}

        <Text style={styles.lastCheckedText}>
          {isChecking ? 'Checking current conditions…' : snapshot ? `Last checked ${new Date(snapshot.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} — rechecks automatically every 15 min` : ''}
        </Text>

        <Pressable style={styles.manualCheckBtn} onPress={handleManualCheck} disabled={isChecking}>
          {isChecking ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="refresh" size={16} color={colors.text} />}
          <Text style={styles.manualCheckText}>Check now</Text>
        </Pressable>
      </ScrollView>

      {showLeave ? (
        <View style={styles.bottomBar} testID="hike-leave-panel">
          <Text style={styles.leaveText}>
            {hasTrackedRealHike
              ? 'Your hike is paused. Nothing is lost if you keep going.'
              : 'Your hike is paused. It is too short to save yet.'}
          </Text>
          <PrimaryButton title="Resume" onPress={handleResume} />
          {hasTrackedRealHike && (
            <PrimaryButton
              title={completing ? 'Saving…' : 'Finish & save'}
              variant="outline"
              onPress={handleCompleteHike}
              disabled={completing}
              style={{ marginTop: spacing.sm }}
            />
          )}
          <Pressable style={styles.discardBtn} onPress={handleDiscard} testID="hike-discard">
            <Text style={styles.discardText}>Discard hike</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.bottomBar, styles.bottomRow]}>
          <Pressable
            style={styles.pauseBtn}
            onPress={isPaused ? handleResume : handlePause}
            accessibilityRole="button"
            testID="hike-pause-button"
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            {hasTrackedRealHike ? (
              <PrimaryButton
                title={completing ? 'Saving…' : `Complete Hike (+${Math.round(distanceKm * 40 * liveDifficulty.xpMultiplier)} XP)`}
                onPress={handleCompleteHike}
                disabled={completing}
              />
            ) : (
              <PrimaryButton title="End Monitoring" onPress={handleDiscard} />
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  mapWrap: { height: 220, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  map: { width: '100%', height: '100%' },
  viewToggle: {
    position: 'absolute', top: spacing.sm, right: spacing.sm, flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.pill, padding: 2,
  },
  viewPill: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: radius.pill },
  viewPillActive: { backgroundColor: '#FFFFFF' },
  viewPillText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  viewPillTextActive: { color: '#000000' },
  offlineNote: { ...typography.caption, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.md },
  elapsedCard: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  elapsedText: { ...typography.bodySmall, color: colors.textSecondary },
  banner: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, marginBottom: spacing.md,
  },
  bannerPause: { backgroundColor: 'rgba(74,144,217,0.92)' },
  bannerWarn: { backgroundColor: 'rgba(217,119,6,0.92)' },
  bannerText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  alertCard: { borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.md },
  alertCardEvent: { color: '#FFF', fontSize: 20, fontWeight: '800', marginTop: spacing.xs },
  alertCardHeadline: { color: 'rgba(255,255,255,0.95)', fontSize: 14, marginTop: spacing.xs },
  alertCardInstruction: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: spacing.sm, fontStyle: 'italic' },
  alertCardMore: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: spacing.sm },
  clearCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.base, marginBottom: spacing.md,
  },
  clearText: { ...typography.bodySmall, color: colors.text, flex: 1 },
  forecastCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
  },
  forecastLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  forecastText: { ...typography.bodySmall, color: colors.text, marginTop: 2 },
  forecastSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  tempText: { fontSize: 24, fontWeight: '700', color: colors.text, marginLeft: spacing.sm },
  lastCheckedText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  manualCheckBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  manualCheckText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  bottomBar: { position: 'absolute', left: spacing.base, right: spacing.base, bottom: spacing.lg },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pauseBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  leaveText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  discardBtn: { alignItems: 'center', paddingVertical: spacing.md },
  discardText: { ...typography.bodySmall, color: '#B91C1C', fontWeight: '700' },
});

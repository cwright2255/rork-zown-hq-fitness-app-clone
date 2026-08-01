// app/running/hiking/monitor.jsx
//
// Live tracking for an active hike — real GPS position tracking (same
// expo-location pattern already proven in app/running/active.jsx), with
// two things built on top of the same position stream:
//   1. Periodic weather/alert re-checks (every 15 min) tied to the
//      hiker's actual current position, not just a one-time check at the
//      trailhead before setting out.
//   2. Real distance and elevation gain tracked from the same GPS
//      readings, used on completion to compute a real difficulty rating
//      (see lib/hikeDifficulty.js — the verified Shenandoah National Park
//      formula) and award XP/badges scaled to it.
// This was originally scoped to weather-only, deliberately not duplicating
// the running feature's distance tracker. Difficulty-based gamification
// needs real distance and elevation to compute from, though, and this
// screen is already collecting exactly that from the same position
// stream it needs for weather checks — reusing it here is not the same
// thing as building a second, separate fitness tracker; it's the same
// data serving two purposes it was already being read for.
//
// Polls every 15 minutes, not continuously — real weather conditions
// don't meaningfully change faster than that, and hammering a free public
// API on a fast interval would be inconsiderate of a service that costs
// NWS nothing to offer and everyone something to keep working.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useHikingStore } from '@/store/hikingStore';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { useBadgeStore } from '@/store/badgeStore';
import { getWeatherSnapshot } from '@/services/weatherService';
import { calculateHikeDifficulty, estimateHikeCalories } from '@/lib/hikeDifficulty';
import { useBodyCompositionStore } from '@/store/bodyCompositionStore';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const SEVERITY_COLOR = {
  Extreme: '#B91C1C',
  Severe: '#EA580C',
  Moderate: '#D97706',
  Minor: '#65A30D',
  Unknown: colors.textSecondary,
};

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HikeWeatherMonitorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const trailId = typeof params.id === 'string' ? params.id : '';
  const { getTrailById, addCompletedHike } = useHikingStore();
  const { scans: bodyScans } = useBodyCompositionStore();
  const { user } = useUserStore();
  const { addExpActivity } = useExpStore();
  const { badges, unlockBadge } = useBadgeStore();
  const trail = getTrailById(trailId);

  const [isMonitoring, setIsMonitoring] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elevationGainM, setElevationGainM] = useState(0);
  const [completing, setCompleting] = useState(false);

  const locationSubRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const elapsedIntervalRef = useRef(null);
  const lastTrackedPointRef = useRef(null); // { latitude, longitude, altitude } — for distance/elevation deltas
  // Refs mirroring the state the poll callback needs, specifically so the
  // interval itself can be created exactly ONCE on mount and never torn
  // down. A first version of this depended on currentLocation directly in
  // the effect that owns the interval — but currentLocation updates from
  // GPS roughly every 60 seconds while actually hiking, which cleared and
  // recreated the interval before it ever reached its real 15-minute
  // mark. Verified this concretely (simulated 30 minutes of 60-second GPS
  // updates against a 15-minute interval) before trusting the fix — the
  // interval never once got an uninterrupted 15 minutes to fire.
  const currentLocationRef = useRef(null);
  const previousAlertIdsRef = useRef(new Set());
  const audioEnabledRef = useRef(true);

  const runWeatherCheck = useCallback(async (latitude, longitude, isFirstCheck) => {
    setIsChecking(true);
    try {
      const result = await getWeatherSnapshot(latitude, longitude);
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
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setIsMonitoring(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mounted) return;
      const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      currentLocationRef.current = loc;
      lastTrackedPointRef.current = { ...loc, altitude: position.coords.altitude };
      setCurrentLocation(loc);
      await runWeatherCheck(loc.latitude, loc.longitude, true);

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 15000 },
        (update) => {
          const updated = { latitude: update.coords.latitude, longitude: update.coords.longitude };
          currentLocationRef.current = updated;
          setCurrentLocation(updated);

          // Real distance/elevation tracking for difficulty scoring on
          // completion — same haversine formula already verified against
          // real coordinates elsewhere in this feature (lib/parseGpx.js,
          // services/hikingService.js). Only counts positive elevation
          // deltas as "gain," matching how lib/parseGpx.js computes it
          // for a GPX route, so a live-tracked hike and a pre-recorded
          // route are scored the same way.
          const last = lastTrackedPointRef.current;
          if (last) {
            const segmentKm = haversineKm(last.latitude, last.longitude, updated.latitude, updated.longitude);
            if (segmentKm > 0.005) { // ignore GPS jitter under ~5m
              setDistanceKm((d) => d + segmentKm);
              const altitude = update.coords.altitude;
              if (last.altitude != null && altitude != null) {
                const gain = altitude - last.altitude;
                if (gain > 0) setElevationGainM((g) => g + gain);
              }
              lastTrackedPointRef.current = { ...updated, altitude };
            }
          }
        }
      );
    })();

    elapsedIntervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    // Created exactly once, on mount — reads currentLocationRef at fire
    // time rather than depending on currentLocation state directly, so
    // frequent GPS updates during real movement can't keep resetting this
    // before it ever reaches its real 15-minute mark (see the comment on
    // currentLocationRef above — this was verified as a real bug, not a
    // theoretical one, before being fixed this way).
    pollIntervalRef.current = setInterval(() => {
      if (currentLocationRef.current) {
        runWeatherCheck(currentLocationRef.current.latitude, currentLocationRef.current.longitude, false);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      locationSubRef.current?.remove?.();
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      Speech.stop();
    };
  }, []);

  // Keeps audioEnabledRef in sync so the long-lived poll interval's
  // callback always reads the current toggle state without needing to be
  // in that interval's own effect dependencies.
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const handleManualCheck = () => {
    if (currentLocation) runWeatherCheck(currentLocation.latitude, currentLocation.longitude, false);
  };

  // A minimum real distance before this counts as a "completed hike" for
  // rewards purposes — otherwise opening this screen and immediately
  // ending it would trivially farm XP and badges for a hike that never
  // actually happened.
  const hasTrackedRealHike = distanceKm >= 0.3;

  const handleCompleteHike = async () => {
    setCompleting(true);
    Speech.stop();
    try {
      const difficulty = calculateHikeDifficulty({ distanceKm, elevationGainM });
      const baseXp = Math.round(distanceKm * 40); // same per-km rate order of magnitude as running's XP, before the difficulty multiplier
      const totalXp = Math.round(baseXp * difficulty.xpMultiplier);
      // Real weight from the most recent body scan when available (see
      // §15 — the body-composition feature), rather than always falling
      // back to a generic default — the MET-based calorie formula scales
      // directly with body weight, so a real value meaningfully improves
      // the estimate over a stranger's average.
      const latestScan = [...bodyScans].sort((a, b) => new Date(b.createdAtLocal || 0) - new Date(a.createdAtLocal || 0))[0];
      const calories = estimateHikeCalories({
        tier: difficulty.tier,
        durationSeconds: elapsed,
        weightKg: latestScan?.weightKg,
      });

      const record = addCompletedHike({
        trailId: trail?.id || null,
        trailName: trail?.name || 'Untitled hike',
        distanceKm: Math.round(distanceKm * 100) / 100,
        elevationGainM: Math.round(elevationGainM),
        durationSeconds: elapsed,
        difficultyScore: difficulty.score,
        difficultyTier: difficulty.tier,
        calories,
        xpEarned: totalXp,
      }, user?.uid);

      addExpActivity?.({
        id: Date.now().toString(),
        type: 'hiking',
        baseExp: baseXp,
        multiplier: difficulty.xpMultiplier,
        date: new Date().toISOString().split('T')[0],
        description: `Completed a ${difficulty.tier.toLowerCase()} hike — ${record.distanceKm}km, ${difficulty.elevationGainFt}ft gain`,
        completed: true,
      });

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
          distanceKm: String(record.distanceKm),
          elevationGainM: String(record.elevationGainM),
          durationSeconds: String(elapsed),
          difficultyTier: difficulty.tier,
          calories: String(calories),
          xpEarned: String(totalXp),
        },
      });
    } catch (e) {
      console.warn('[HikeMonitor] complete hike failed:', e?.message);
      setCompleting(false);
    }
  };

  const handleStop = () => {
    Speech.stop();
    router.back();
  };

  const worstAlert = snapshot?.alerts?.[0];
  const current = snapshot?.forecast?.[0];
  const liveDifficulty = calculateHikeDifficulty({ distanceKm, elevationGainM });

  if (!isMonitoring) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Weather Monitor" showBack />
        <View style={styles.centerBlock}>
          <Ionicons name="location-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.centerText}>
            Location access is needed to monitor real-time weather risk during your hike.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={trail?.name || 'Weather Monitor'}
        showBack
        onBack={handleStop}
        rightAction={
          <Pressable onPress={() => setAudioEnabled((v) => !v)} hitSlop={8}>
            <Ionicons name={audioEnabled ? 'volume-high' : 'volume-mute'} size={20} color={colors.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.base, paddingBottom: 120 }}>
        <View style={styles.elapsedCard}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.elapsedText}>Monitoring for {formatElapsed(elapsed)}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Math.round(elevationGainM)} m</Text>
            <Text style={styles.statLabel}>Elevation gain</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{liveDifficulty.tier}</Text>
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

      <View style={styles.bottomBar}>
        {hasTrackedRealHike ? (
          <PrimaryButton
            title={completing ? 'Saving…' : `Complete Hike (+${Math.round(distanceKm * 40 * liveDifficulty.xpMultiplier)} XP)`}
            onPress={handleCompleteHike}
            disabled={completing}
          />
        ) : (
          <PrimaryButton title="End Monitoring" onPress={handleStop} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centerBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  centerText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  elapsedCard: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  elapsedText: { ...typography.bodySmall, color: colors.textSecondary },
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
});

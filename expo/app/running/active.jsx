import React, { useState, useEffect, useCallback, useRef } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import RunningMap from '@/components/RunningMap';
import { useRunningStore } from '@/store/runningStore';
import { useVirtualChallengeStore } from '@/store/virtualChallengeStore';
import { useExpStore } from '@/store/expStore';
import { useUserStore } from '@/store/userStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { radarService } from '@/services/radarService';
import { getSessionIntervals, getProgramWeek } from '@/data/runningPrograms';

/* Ã¢ÂÂÃ¢ÂÂ Helpers Ã¢ÂÂÃ¢ÂÂ */

function formatTimer(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function formatPace(distKm, secs) {
  if (distKm < 0.01) return "--'--\"";
  const paceSecsPerKm = secs / distKm;
  const pm = Math.floor(paceSecsPerKm / 60);
  const ps = Math.floor(paceSecsPerKm % 60);
  return pm + "'" + String(ps).padStart(2, '0') + '"';
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* Ã¢ÂÂÃ¢ÂÂ Menu option Ã¢ÂÂÃ¢ÂÂ */

function MenuOption({ icon, label, onPress, danger }) {
  return (
    <Pressable style={styles.menuOption} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? '#FF3B30' : '#FFF'} style={{ marginRight: 12 }} />
      <Text style={[styles.menuOptionText, danger && { color: '#FF3B30' }]}>{label}</Text>
    </Pressable>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Main screen Ã¢ÂÂÃ¢ÂÂ */

export default function ActiveRunScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const programId = typeof params.programId === 'string' ? params.programId : null;
  const weekNumber = params.week ? parseInt(params.week, 10) : null;
  const sessionIndex = params.sessionIndex ? parseInt(params.sessionIndex, 10) : 0;

  const { startRun, endRun, updateActiveRun, completeProgramSession } = useRunningStore();
  const { addExpActivity } = useExpStore();
  const { user } = useUserStore();
  const { isConnected: spotifyConnected, currentTrack, playTrack, pauseTrack, nextTrack, playbackState } = useSpotifyStore();
  const runStartRef = useRef(new Date().toISOString());
  const [locationName, setLocationName] = useState('');

  // Program (interval) mode — real Couch to 5K / interval structure from
  // data/runningPrograms.js, driven the same way body-scan capture drives
  // its voice-guided rotation steps: a countdown per phase, a spoken cue
  // on each transition, toggled by the same audioEnabled switch this
  // screen already had (previously wired to nothing — the toggle existed
  // in the UI but there were no voice cues anywhere for it to control).
  const programIntervals = programId && weekNumber
    ? getSessionIntervals(programId, weekNumber, sessionIndex)
    : null;
  const programWeek = programId && weekNumber ? getProgramWeek(programId, weekNumber) : null;
  const isProgramRun = !!programIntervals;
  const [intervalIndex, setIntervalIndex] = useState(0);
  const [intervalSecondsLeft, setIntervalSecondsLeft] = useState(programIntervals?.[0]?.seconds ?? 0);

  // Reverse geocode current position for display
  const updateLocationName = useCallback(async (lat, lng) => {
    try {
      const result = await radarService.reverseGeocode(lat, lng);
      if (result?.addresses?.[0]) {
        const addr = result.addresses[0];
        setLocationName(addr.placeLabel || addr.city || addr.neighborhood || '');
      }
    } catch (e) {
      // Silently fail - location name is optional UI enhancement
    }
  }, []);


  /* Ã¢ÂÂÃ¢ÂÂ Core state Ã¢ÂÂÃ¢ÂÂ */
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [calories, setCalories] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);

  /* Ã¢ÂÂÃ¢ÂÂ GPS state Ã¢ÂÂÃ¢ÂÂ */
  const [coordinates, setCoordinates] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);

  const timerRef = useRef(null);
  const locationSubRef = useRef(null);

  /* Ã¢ÂÂÃ¢ÂÂ Request location permission on mount Ã¢ÂÂÃ¢ÂÂ */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Location permission is required for GPS tracking. You can enable it in Settings.',
        );
      } else {
        // Permission granted, start tracking immediately
        setIsRunning(true);
      }
    })();
    return () => {
      // Clean up location subscription on unmount
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, []);

  /* Ã¢ÂÂÃ¢ÂÂ GPS tracking Ã¢ÂÂÃ¢ÂÂ */
  useEffect(() => {
    if (isRunning && locationPermission === 'granted') {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
    return () => stopLocationTracking();
  }, [isRunning, locationPermission]);

  const startLocationTracking = async () => {
    if (locationSubRef.current) return; // already tracking
    try {
      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          const { latitude, longitude } = loc.coords;
          const newCoord = { latitude, longitude };

          setCurrentLocation(newCoord);
          setCoordinates((prev) => {
            const updated = [...prev, newCoord];
            // Calculate distance from last point
            if (prev.length > 0) {
              const lastCoord = prev[prev.length - 1];
              const segmentKm = haversineKm(lastCoord, newCoord);
              // Filter out GPS noise: ignore jumps > 100m in 2 seconds
              if (segmentKm < 0.1) {
                setDistance((d) => d + segmentKm);
                setCalories((c) => c + segmentKm * 70);
              }
            }
            return updated;
          });
        },
      );
    } catch (err) {
      console.warn('Location tracking error:', err);
    }
  };

  const stopLocationTracking = () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
  };

  /* Ã¢ÂÂÃ¢ÂÂ Elapsed time timer Ã¢ÂÂÃ¢ÂÂ */
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
        if (isProgramRun) {
          setIntervalSecondsLeft((s) => Math.max(0, s - 1));
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isProgramRun]);

  // Handles advancing to the next interval and speaking its cue. Kept as
  // its own effect (rather than inline in the setInterval callback above)
  // specifically so it always sees the current intervalIndex/programIntervals
  // -- a long-lived setInterval callback closes over whatever those values
  // were when the interval was created, which would go stale the moment
  // intervalIndex changes.
  useEffect(() => {
    if (!isProgramRun || !isRunning) return;
    if (intervalSecondsLeft > 0) return;

    const nextIndex = intervalIndex + 1;
    if (nextIndex >= programIntervals.length) {
      // Program session complete -- end the run the same way a manual end
      // does, crediting the real session to the program's progress.
      handleEndRun();
      return;
    }
    const next = programIntervals[nextIndex];
    setIntervalIndex(nextIndex);
    setIntervalSecondsLeft(next.seconds);
    if (audioEnabled) {
      Speech.stop();
      Speech.speak(next.cue === 'Run' ? "Run now" : "Walk now -- recover your breath", { rate: 1.0 });
    }
  }, [intervalSecondsLeft, isProgramRun, isRunning, handleEndRun]);

  /* Ã¢ÂÂÃ¢ÂÂ Controls Ã¢ÂÂÃ¢ÂÂ */
  const handlePause = useCallback(() => {
    setIsRunning(false);
    setShowPauseOptions(true);
  }, []);

  const handleResume = useCallback(() => {
    setShowPauseOptions(false);
    setIsRunning(true);
  }, []);

  const handleEndRun = useCallback(() => {
    setIsRunning(false);
    setShowPauseOptions(false);
    setShowMenu(false);
    try {
      // This was the core bug in this screen: distance/elapsed/calories/
      // coordinates were all tracked in local component state only.
      // updateActiveRun() — the function that writes those values into the
      // store's activeRun — was never called anywhere, so endRun() was
      // spreading the store's still-zeroed startRun() defaults into the
      // saved record. The on-screen numbers during the run were correct;
      // none of them were ever actually being saved. Fixed by writing the
      // real tracked values in before ending.
      const rawPaceSecPerKm = distance > 0.01 ? elapsed / distance : 0;
      updateActiveRun({
        distance,
        duration: elapsed,
        pace: rawPaceSecPerKm,
        calories: Math.round(calories),
        coords: coordinates,
      });
      const completed = endRun(user?.uid);
      useVirtualChallengeStore.getState().creditDistance(distance, user?.uid);
      if (isProgramRun && programWeek) {
        completeProgramSession(programId, programWeek.sessionsPerWeek, user?.uid);
      }
      addExpActivity?.({
        id: Date.now().toString(),
        type: 'running',
        baseExp: Math.round(distance * 30),
        multiplier: 1.0,
        date: new Date().toISOString().split('T')[0],
        description: isProgramRun
          ? `Completed ${programId} week ${weekNumber}, session ${sessionIndex + 1}`
          : `Completed a ${distance.toFixed(2)}km run`,
        completed: true,
      });
    } catch (e) {
      console.warn('Failed to save run:', e?.message);
    }
    router.replace('/workout/complete?type=run');
  }, [router, distance, elapsed, calories, coordinates, updateActiveRun, endRun, addExpActivity, user, isProgramRun, programWeek, programId, weekNumber, sessionIndex, completeProgramSession]);

  const pace = formatPace(distance, elapsed);
  const goalPercent = Math.min(100, Math.round((distance / 5) * 100));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Ã¢ÂÂÃ¢ÂÂ Map area with RunningMap component Ã¢ÂÂÃ¢ÂÂ */}
      <View style={styles.mapArea}>
        <RunningMap
          coordinates={coordinates}
          currentLocation={currentLocation}
          distance={distance}
          pace={pace}
          style={styles.mapInner}
        />

        {/* Header overlay */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={handlePause}>
            <Ionicons name="chevron-back" size={20} color="#FFF" />
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#FFF" />
          </Pressable>
        </View>
      </View>

      {isProgramRun && intervalIndex < programIntervals.length && (
        <View style={[styles.intervalBanner, programIntervals[intervalIndex].type === 'run' ? styles.intervalBannerRun : styles.intervalBannerWalk]}>
          <Text style={styles.intervalBannerLabel}>{programIntervals[intervalIndex].cue.toUpperCase()}</Text>
          <Text style={styles.intervalBannerTime}>{formatTimer(intervalSecondsLeft)}</Text>
          <Text style={styles.intervalBannerNext}>
            {intervalIndex + 1 < programIntervals.length
              ? `Next: ${programIntervals[intervalIndex + 1].cue}`
              : 'Final interval'}
          </Text>
        </View>
      )}

      {/* Ã¢ÂÂÃ¢ÂÂ Stats panel Ã¢ÂÂÃ¢ÂÂ */}
      <View style={styles.statsPanel}>
        {/* Distance goal row */}
        <View style={styles.goalRow}>
          <View style={styles.goalCircle} />
          <Text style={styles.goalText}>Distance Goal</Text>
          <Text style={styles.goalPercent}>{goalPercent}%</Text>
        </View>

        {/* Main stats 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: '#4A90D9' }]}>
              {formatTimer(elapsed)}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>
              {distance.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Kilometers</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: '#FFD700' }]}>
              {pace}
            </Text>
            <Text style={styles.statLabel}>Pace</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>
              {Math.floor(calories)}
            </Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        </View>

        {/* Controls row */}
        <View style={styles.controlsRow}>
          <Pressable style={styles.smallBtn}>
            <Ionicons name="lock-closed-outline" size={20} color="#FFF" />
          </Pressable>
          <Pressable
            style={styles.mainBtn}
            onPress={isRunning ? handlePause : handleResume}
          >
            <Ionicons name={isRunning ? 'pause' : 'play'} size={32} color="#000" />
          </Pressable>
          <Pressable
            style={styles.smallBtn}
            onPress={() => setAudioEnabled(!audioEnabled)}
          >
            <Ionicons name={audioEnabled ? 'volume-high' : 'volume-mute'} size={20} color="#FFF" />
          </Pressable>
        </View>

        {/* Pause options */}
        {showPauseOptions && (
          <View style={styles.pauseOptions}>
            <Pressable style={styles.resumeBtn} onPress={handleResume}>
              <Text style={styles.resumeBtnText}>Resume</Text>
            </Pressable>
            <Pressable style={styles.endRunBtn} onPress={handleEndRun}>
              <Text style={styles.endRunBtnText}>End Run</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Ã¢ÂÂÃ¢ÂÂ Three-dot popup menu Ã¢ÂÂÃ¢ÂÂ */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <MenuOption icon="musical-notes-outline" label="Music" onPress={() => setShowMenu(false)} />
            <MenuOption icon="pause-circle-outline" label="Pause Run" onPress={() => { setShowMenu(false); handlePause(); }} />
            <MenuOption icon="exit-outline" label="End Run" danger onPress={handleEndRun} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Styles Ã¢ÂÂÃ¢ÂÂ */

const styles = StyleSheet.create({
  intervalBanner: {
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
  },
  intervalBannerRun: { backgroundColor: '#22C55E' },
  intervalBannerWalk: { backgroundColor: '#4A90D9' },
  intervalBannerLabel: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  intervalBannerTime: { color: '#FFF', fontSize: 34, fontWeight: '800', marginTop: 2 },
  intervalBannerNext: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  container: { flex: 1, backgroundColor: '#0D1117' },

  /* Map */
  mapArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  mapInner: {
    flex: 1,
  },
  header: {
    position: 'absolute', top: 50, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between', zIndex: 10,
  },
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Stats panel */
  statsPanel: {
    backgroundColor: '#0D1117',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 24, paddingTop: 20,
    zIndex: 5,
  },
  goalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16,
  },
  goalCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2.5, borderColor: '#4A90D9',
  },
  goalText: { fontSize: 14, color: '#FFF', fontWeight: '500' },
  goalPercent: { fontSize: 14, color: '#4A90D9', fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '50%', marginBottom: 16 },
  statValue: { fontSize: 42, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 14, color: '#888', marginTop: 2 },

  /* Controls */
  controlsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 24, marginTop: 8, paddingBottom: 16,
  },
  mainBtn: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  smallBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#333',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Pause options */
  pauseOptions: { gap: 12, paddingBottom: 24 },
  resumeBtn: {
    backgroundColor: '#4A90D9', height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  resumeBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  endRunBtn: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FF3B30',
    height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  endRunBtnText: { fontSize: 16, fontWeight: '700', color: '#FF3B30' },

  /* Menu */
  menuBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 90 : 80, paddingRight: 16,
  },
  menuCard: {
    backgroundColor: '#222', borderRadius: 12, padding: 8, width: 200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
      default: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  menuOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuOptionText: { fontSize: 15, fontWeight: '500', color: '#FFF' },
});

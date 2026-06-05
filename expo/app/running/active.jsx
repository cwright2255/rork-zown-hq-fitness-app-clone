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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import RunningMap from '@/components/RunningMap';
import { useRunningStore } from '@/store/runningStore';
import { useExpStore } from '@/store/expStore';
import { useUserStore } from '@/store/userStore';
import { useSpotifyStore } from '@/store/spotifyStore';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{error?.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

/* ââ Helpers ââ */

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

/* ââ Menu option ââ */

function MenuOption({ icon, label, onPress, danger }) {
  return (
    <Pressable style={styles.menuOption} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? '#FF3B30' : '#FFF'} style={{ marginRight: 12 }} />
      <Text style={[styles.menuOptionText, danger && { color: '#FF3B30' }]}>{label}</Text>
    </Pressable>
  );
}

/* ââ Main screen ââ */

export default function ActiveRunScreen() {
  const router = useRouter();

  const { startRun, endRun } = useRunningStore();
  const { addExp } = useExpStore();
  const { user } = useUserStore();
  const { isConnected: spotifyConnected, currentTrack, playTrack, pauseTrack, nextTrack, playbackState } = useSpotifyStore();
  const runStartRef = useRef(new Date().toISOString());

  /* ââ Core state ââ */
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [calories, setCalories] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);

  /* ââ GPS state ââ */
  const [coordinates, setCoordinates] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);

  const timerRef = useRef(null);
  const locationSubRef = useRef(null);

  /* ââ Request location permission on mount ââ */
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

  /* ââ GPS tracking ââ */
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

  /* ââ Elapsed time timer ââ */
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  /* ââ Controls ââ */
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
      const calories = Math.round(distance * 60);
      endRun(user?.uid);
      if (addExp) addExp(Math.round(distance * 30), 'run');
    } catch (e) {
      console.warn('Failed to save run:', e?.message);
    }
    router.replace('/workout/complete');
  }, [router, distance, endRun, addExp, user]);

  const pace = formatPace(distance, elapsed);
  const goalPercent = Math.min(100, Math.round((distance / 5) * 100));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ââ Map area with RunningMap component ââ */}
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

      {/* ââ Stats panel ââ */}
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

      {/* ââ Three-dot popup menu ââ */}
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

/* ââ Styles ââ */

const styles = StyleSheet.create({
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

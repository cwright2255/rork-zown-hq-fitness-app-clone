import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

// TODO: Replace map placeholder with react-native-maps MapView for real GPS tracking
// TODO: Integrate expo-location for live position updates

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

/* ── Menu option ── */

function MenuOption({ icon, label, onPress, danger }) {
  return (
    <Pressable style={styles.menuOption} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? '#FF3B30' : '#FFF'} style={{ marginRight: 12 }} />
      <Text style={[styles.menuOptionText, danger && { color: '#FF3B30' }]}>{label}</Text>
    </Pressable>
  );
}

/* ── Main screen ── */

export default function ActiveRunScreen() {
  const router = useRouter();

  const [isRunning, setIsRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [calories, setCalories] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);

  const timerRef = useRef(null);

  /* ── Timer + simulation ── */
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
        setDistance((d) => d + 0.003);
        setCalories((c) => c + 0.2);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const handlePause = useCallback(() => {
    setIsRunning(false);
    setShowPauseOptions(true);
  }, []);

  const handleResume = useCallback(() => {
    setShowPauseOptions(false);
    setIsRunning(true);
  }, []);

  const handleEndRun = useCallback(() => {
    setShowPauseOptions(false);
    setShowMenu(false);
    router.replace('/workout/complete');
  }, [router]);

  const pace = formatPace(distance, elapsed);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Map area ── */}
      <View style={styles.mapArea}>
        {/* Simulated grid lines */}
        <View style={[styles.gridH, { top: '25%' }]} />
        <View style={[styles.gridH, { top: '50%' }]} />
        <View style={[styles.gridH, { top: '75%' }]} />
        <View style={[styles.gridV, { left: '30%' }]} />
        <View style={[styles.gridV, { left: '60%' }]} />

        {/* Simulated route */}
        <View style={styles.routeLineH} />
        <View style={styles.routeLineV} />

        {/* User location dot */}
        <View style={styles.userDot} />

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

      {/* ── Stats panel ── */}
      <View style={styles.statsPanel}>
        {/* Distance goal row */}
        <View style={styles.goalRow}>
          <View style={styles.goalCircle} />
          <Text style={styles.goalText}>Distance Goal</Text>
          <Text style={styles.goalPercent}>
            {Math.min(100, Math.round((distance / 5) * 100))}%
          </Text>
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
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={32}
              color="#000"
            />
          </Pressable>

          <Pressable
            style={styles.smallBtn}
            onPress={() => setAudioEnabled(!audioEnabled)}
          >
            <Ionicons
              name={audioEnabled ? 'volume-high' : 'volume-mute'}
              size={20}
              color="#FFF"
            />
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

      {/* ── Three-dot popup menu ── */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <MenuOption
              icon="musical-notes-outline"
              label="Music"
              onPress={() => { setShowMenu(false); }}
            />
            <MenuOption
              icon="pause-circle-outline"
              label="Pause Run"
              onPress={() => { setShowMenu(false); handlePause(); }}
            />
            <MenuOption
              icon="exit-outline"
              label="End Run"
              danger
              onPress={handleEndRun}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1117' },

  /* Map */
  mapArea: {
    flex: 1,
    backgroundColor: '#1A2332',
    position: 'relative',
    overflow: 'hidden',
  },
  gridH: {
    position: 'absolute', left: 0, right: 0,
    height: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  gridV: {
    position: 'absolute', top: 0, bottom: 0,
    width: 1, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  routeLineH: {
    position: 'absolute', top: '50%', left: '20%', width: '35%',
    height: 3, backgroundColor: '#00BFFF', borderRadius: 2,
  },
  routeLineV: {
    position: 'absolute', top: '35%', left: '55%',
    width: 3, height: '15%', backgroundColor: '#00BFFF', borderRadius: 2,
  },
  userDot: {
    position: 'absolute', top: '35%', left: '53%',
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#4A90D9', borderWidth: 3, borderColor: '#FFF',
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

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
  },
  statCell: { width: '50%', marginBottom: 16 },
  statValue: {
    fontSize: 42, fontWeight: '800', color: '#FFF',
  },
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
  pauseOptions: {
    gap: 12, paddingBottom: 24,
  },
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

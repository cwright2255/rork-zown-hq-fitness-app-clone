import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

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
import { radarService } from '@/services/radarService';
import { getSessionIntervals, getProgramWeek } from '@/data/runningPrograms';
import { useRunTrackerStore } from '@/store/runTrackerStore';
import { startTracking, stopTracking } from '@/services/runTracking';
import {
  trackedMs, gpsStatus, intervalAt, elevationGain, sessionCounts, plannedSeconds, PROGRAM_CREDIT_FRACTION,
} from '@/lib/runTracker';
import { ACTIVITIES, caloriesFor, xpFor } from '@/lib/runStats';

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
  // 'walk' when started from "Free walk"; program sessions and free runs are runs.
  const activity = !programId && params.activity === 'walk' ? 'walk' : 'run';
  const activityLabel = ACTIVITIES[activity].label;

  const { endRun, completeProgramSession } = useRunningStore();
  const { addExpActivity } = useExpStore();
  const { user } = useUserStore();
  const endedRef = useRef(false);
  const [locationName, setLocationName] = useState('');

  // Program (interval) mode -- real Couch to 5K / interval structure from
  // data/runningPrograms.js, driven the same way body-scan capture drives
  // its voice-guided rotation steps: a countdown per phase, a spoken cue
  // on each transition, toggled by the same audioEnabled switch this
  // screen already had (previously wired to nothing -- the toggle existed
  // in the UI but there were no voice cues anywhere for it to control).
  // The countdown now follows the run's moving time (the tracker), so it
  // stays right when the screen is off and stops while the run is paused.
  const programIntervals = useMemo(
    () => (programId && weekNumber ? getSessionIntervals(programId, weekNumber, sessionIndex) : null),
    [programId, weekNumber, sessionIndex],
  );
  const programWeek = programId && weekNumber ? getProgramWeek(programId, weekNumber) : null;
  const isProgramRun = !!programIntervals;

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

  /* -- The run being recorded --
     Everything measured (distance, moving time, splits, climb, route) lives in
     the tracker store, fed by GPS from services/runTracking.js. That keeps
     recording when the phone is locked and the app is in the background. */
  const tracker = useRunTrackerStore((s) => s.tracker);
  const [now, setNow] = useState(() => Date.now());
  const [audioEnabled, setAudioEnabled] = useState(params.audioCues !== 'false');
  const [showMenu, setShowMenu] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [locationPermission, setLocationPermission] = useState(null);

  const isRunning = tracker.status === 'running';
  const elapsed = Math.floor(trackedMs(tracker, now) / 1000);
  const distance = tracker.distanceM / 1000;
  const calories = caloriesFor(activity, distance);
  const coordinates = tracker.route;
  const currentLocation = tracker.current;
  const gps = gpsStatus(tracker, now);
  const climb = Math.round(elevationGain(tracker));

  /* -- Request location permission on mount, then start recording -- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setLocationPermission(status);
      if (status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Location permission is required for GPS tracking. You can enable it in Settings.',
        );
        return;
      }
      // Auto-pause is off for program sessions, whose timed intervals shouldn't
      // stop for a red light; the menu can turn it on.
      // Only a run of the same kind that was left paused is picked up again.
      const kind = isProgramRun ? `${programId}:${weekNumber}:${sessionIndex}` : activity;
      const mode = useRunTrackerStore.getState().begin({ autoPause: !isProgramRun, kind });
      if (mode === 'resumed' && useRunTrackerStore.getState().tracker.status === 'paused') {
        setShowPauseOptions(true);
      }
      try {
        await startTracking();
      } catch (err) {
        console.warn('Location tracking error:', err);
      }
    })();
    return () => {
      cancelled = true;
      // Leaving this screen without ending the run pauses it, so nothing keeps
      // counting unseen; the run is picked up again the next time it opens.
      if (!endedRef.current) useRunTrackerStore.getState().pause(Date.now());
    };
  }, []);

  /* -- Redraw the clock every second -- */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* -- Controls -- */
  const handlePause = useCallback(() => {
    useRunTrackerStore.getState().pause(Date.now());
    setShowPauseOptions(true);
  }, []);

  const handleResume = useCallback(() => {
    useRunTrackerStore.getState().resume(Date.now());
    setShowPauseOptions(false);
    setConfirmEnd(false);
    // GPS is switched off after a very long pause; make sure it is on again.
    startTracking().catch((err) => console.warn('Location tracking error:', err));
  }, []);

  const handleToggleAutoPause = useCallback(() => {
    const store = useRunTrackerStore.getState();
    store.setAutoPause(!store.tracker.autoPause, Date.now());
    setShowMenu(false);
  }, []);

  const handleEndRun = useCallback(() => {
    // A double tap on End, or the program timer firing as you tap, must not
    // save the same run twice.
    if (endedRef.current) return;
    endedRef.current = true;
    setShowPauseOptions(false);
    setConfirmEnd(false);
    setShowMenu(false);
    stopTracking();
    let savedRunId = 'none';
    let countsForProgram = false;
    try {
      // The numbers come from the tracker, which has been counting moving time
      // only. endRun returns null for a run under 10 seconds, and then nothing
      // is saved or credited.
      const summary = useRunTrackerStore.getState().finish(Date.now());
      const completed = endRun(user?.uid, {
        startTime: summary.startTime,
        distance: summary.distance,
        duration: summary.duration,
        calories: caloriesFor(activity, summary.distance),
        activity,
        coords: summary.coords,
        splits: summary.splits,
        elevGain: summary.elevGain,
        elevLoss: summary.elevLoss,
      });
      if (completed) {
        savedRunId = completed.id;
        useVirtualChallengeStore.getState().creditDistance(summary.distance, user?.uid);
        // A session ended well short of its plan is saved as a run, but is not
        // ticked off in the program.
        countsForProgram = !!(isProgramRun && programWeek && sessionCounts(programIntervals, summary.duration));
        if (countsForProgram) {
          completeProgramSession(programId, programWeek.sessionsPerWeek, user?.uid);
        }
        addExpActivity?.({
          id: Date.now().toString(),
          type: 'running',
          baseExp: xpFor(activity, summary.distance),
          multiplier: 1.0,
          date: new Date().toISOString().split('T')[0],
          description: countsForProgram
            ? `Completed ${programId} week ${weekNumber}, session ${sessionIndex + 1}`
            : `Completed a ${summary.distance.toFixed(2)}km ${activity}`,
          completed: true,
        }, user?.uid);
      }
    } catch (e) {
      console.warn('Failed to save run:', e?.message);
    }
    router.replace(`/workout/complete?type=run&runId=${savedRunId}`);
  }, [router, endRun, addExpActivity, user, isProgramRun, programWeek, programIntervals, programId, weekNumber, sessionIndex, completeProgramSession, activity]);

  // End Run from the menu or the pause panel. Ending a program session before
  // it has counted would quietly lose the credit, so stop the clock and ask.
  const plannedSecs = plannedSeconds(programIntervals);
  const sessionPercent = plannedSecs > 0 ? Math.min(100, Math.round((elapsed / plannedSecs) * 100)) : 0;
  const handleEndPress = useCallback(() => {
    setShowMenu(false);
    const store = useRunTrackerStore.getState();
    const doneSeconds = Math.floor(trackedMs(store.tracker, Date.now()) / 1000);
    if (isProgramRun && !sessionCounts(programIntervals, doneSeconds)) {
      store.pause(Date.now());
      setShowPauseOptions(false);
      setConfirmEnd(true);
      return;
    }
    handleEndRun();
  }, [isProgramRun, programIntervals, handleEndRun]);

  // Where the program is, from moving time. Speaks a cue when the phase changes
  // and ends the session when the last phase is done.
  const intervalInfo = useMemo(() => intervalAt(programIntervals, elapsed), [programIntervals, elapsed]);
  const intervalIndex = intervalInfo ? intervalInfo.index : 0;
  const intervalSecondsLeft = intervalInfo ? intervalInfo.secondsLeft : 0;
  const cuedIndexRef = useRef(0);
  const intervalDone = !!intervalInfo && intervalInfo.done;
  useEffect(() => {
    if (!isProgramRun || tracker.status === 'idle') return;
    if (intervalDone) {
      handleEndRun();
      return;
    }
    if (intervalIndex !== cuedIndexRef.current) {
      cuedIndexRef.current = intervalIndex;
      if (audioEnabled) {
        Speech.stop();
        Speech.speak(programIntervals[intervalIndex].cue === 'Run' ? "Run now" : "Walk now -- recover your breath", { rate: 1.0 });
      }
    }
  }, [intervalIndex, intervalDone, isProgramRun, tracker.status, handleEndRun]);

  // One banner over the map: why the clock is stopped, or a GPS problem.
  let banner = null;
  if (tracker.status === 'paused') {
    banner = { icon: 'pause', text: 'Paused', warn: false };
  } else if (tracker.status === 'auto') {
    banner = { icon: 'pause-circle', text: 'Auto-paused. Start moving to resume.', warn: false };
  } else if (tracker.status === 'running' && gps !== 'good' && gps !== 'fair') {
    const text = gps === 'lost' ? 'GPS signal lost' : gps === 'weak' ? 'Weak GPS signal' : 'Searching for GPS...';
    banner = { icon: 'locate', text, warn: true };
  }

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

        {banner && (
          <View style={styles.bannerWrap} pointerEvents="none">
            <View style={[styles.banner, banner.warn ? styles.bannerWarn : styles.bannerPause]} testID="run-banner">
              <Ionicons name={banner.icon} size={14} color="#FFF" />
              <Text style={styles.bannerText}>{banner.text}</Text>
            </View>
          </View>
        )}

        {/* Header overlay */}
        <View style={styles.header}>
          <Pressable style={styles.headerBtn} onPress={handlePause}>
            <Ionicons name="chevron-back" size={20} color="#FFF" />
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => setShowMenu(true)} testID="run-menu-button">
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
          {climb > 0 && <Text style={styles.climbText} testID="run-climb">{climb} m climb</Text>}
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
            testID="run-main-button"
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
        {showPauseOptions && !confirmEnd && (
          <View style={styles.pauseOptions}>
            <Pressable style={styles.resumeBtn} onPress={handleResume}>
              <Text style={styles.resumeBtnText}>Resume</Text>
            </Pressable>
            <Pressable style={styles.endRunBtn} onPress={handleEndPress}>
              <Text style={styles.endRunBtnText}>{`End ${activityLabel}`}</Text>
            </Pressable>
          </View>
        )}

        {/* Ending a program session early */}
        {confirmEnd && (
          <View style={styles.pauseOptions} testID="run-confirm-end">
            <Text style={styles.confirmText}>
              {`You're ${sessionPercent}% through this session. It counts toward your program at ${Math.round(PROGRAM_CREDIT_FRACTION * 100)}%. If you end now your run is still saved, but the session is not ticked off.`}
            </Text>
            <Pressable style={styles.resumeBtn} onPress={handleResume} testID="run-keep-going">
              <Text style={styles.resumeBtnText}>Keep going</Text>
            </Pressable>
            <Pressable style={styles.endRunBtn} onPress={handleEndRun} testID="run-end-anyway">
              <Text style={styles.endRunBtnText}>End anyway</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Ã¢ÂÂÃ¢ÂÂ Three-dot popup menu Ã¢ÂÂÃ¢ÂÂ */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={styles.menuCard}>
            <MenuOption icon="musical-notes-outline" label="Music" onPress={() => setShowMenu(false)} />
            <MenuOption icon="pause-circle-outline" label={`Pause ${activityLabel}`} onPress={() => { setShowMenu(false); handlePause(); }} />
            <MenuOption
              icon={tracker.autoPause ? 'flash' : 'flash-off-outline'}
              label={tracker.autoPause ? 'Auto-pause: On' : 'Auto-pause: Off'}
              onPress={handleToggleAutoPause}
            />
            <MenuOption icon="exit-outline" label={`End ${activityLabel}`} danger onPress={handleEndPress} />
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
  climbText: { marginLeft: 'auto', fontSize: 13, color: '#888', fontWeight: '600' },

  /* Banner over the map */
  bannerWrap: {
    position: 'absolute', top: 100, left: 16, right: 16, alignItems: 'center', zIndex: 9,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
  },
  bannerPause: { backgroundColor: 'rgba(74,144,217,0.92)' },
  bannerWarn: { backgroundColor: 'rgba(217,119,6,0.92)' },
  bannerText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

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
  confirmText: { fontSize: 14, lineHeight: 20, color: '#CCC', textAlign: 'center', paddingHorizontal: 8 },

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

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
  BackHandler,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import RunningMap from '@/components/RunningMap';
import RunGoalSheet from '@/components/RunGoalSheet';
import RunMusicSheet from '@/components/RunMusicSheet';
import { useRunningStore } from '@/store/runningStore';
import { useVirtualChallengeStore } from '@/store/virtualChallengeStore';
import { useExpStore } from '@/store/expStore';
import { useUserStore } from '@/store/userStore';
import { useSettingsStore } from '@/store/settingsStore';
import { radarService } from '@/services/radarService';
import { getSessionIntervals, getProgramWeek } from '@/data/runningPrograms';
import { useRunTrackerStore } from '@/store/runTrackerStore';
import { startTracking, stopTracking } from '@/services/runTracking';
import {
  trackedMs, gpsStatus, intervalAt, elevationGain, sessionCounts, plannedSeconds, PROGRAM_CREDIT_FRACTION,
} from '@/lib/runTracker';
import { ACTIVITIES, caloriesFor, xpFor } from '@/lib/runStats';
import { distanceUnitLabel, formatDistance, formatDistanceValue, paceIn } from '@/lib/distanceUnits';
import { goalLabel, goalProgress } from '@/lib/runGoal';
import { currentRace } from '@/lib/virtualRaces';
import { raceResultMessage, speakableRaceTime } from '@/lib/raceMessages';
import { finishRace } from '@/services/raceBoard';
import { localDateKey } from '@/lib/localDate';

/** How long the lock is held to open it again, so a pocket or a sweaty thumb does not. */
const UNLOCK_HOLD_MS = 700;
/** The menu fades out in about this long; a sheet opened from it waits, since a second sheet cannot open while the first is closing. */
const MENU_CLOSE_MS = 350;

/* Ã¢ÂÂÃ¢ÂÂ Helpers Ã¢ÂÂÃ¢ÂÂ */

function formatTimer(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// The pace so far as m'ss" per km, or per mile when `units` is 'imperial'.
function formatPace(distKm, secs, units) {
  if (distKm < 0.01) return "--'--\"";
  const paceSecs = paceIn(secs / distKm, units);
  const pm = Math.floor(paceSecs / 60);
  const ps = Math.floor(paceSecs % 60);
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
  // A virtual race, started from the race screen (app/running/races/[kind].jsx): a run with the
  // race's distance as its goal and a time posted to the board when that distance is crossed.
  // Only a run can be a race, never a walk or a program session.
  const raceKind = !programId && activity === 'run' ? params.raceKind : null;
  const race = useMemo(() => currentRace(raceKind), [raceKind]); // null unless it names a race

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
  const units = useSettingsStore((s) => s.units); // Settings > Distance Units: miles or km
  const [now, setNow] = useState(() => Date.now());
  const [audioEnabled, setAudioEnabled] = useState(params.audioCues !== 'false');
  const [showMenu, setShowMenu] = useState(false);
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [locationPermission, setLocationPermission] = useState(null);
  const [locked, setLocked] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const storedGoalKm = useRunTrackerStore((s) => s.goalKm); // the distance goal, in km
  const goalKm = race ? race.distanceKm : storedGoalKm; // a race is always its own distance

  const isRunning = tracker.status === 'running';
  const elapsed = Math.floor(trackedMs(tracker, now) / 1000);
  const distance = tracker.distanceM / 1000;
  const calories = caloriesFor(activity, distance);
  const coordinates = tracker.route;
  const currentLocation = tracker.current;
  const gps = gpsStatus(tracker, now);
  const climb = Math.round(elevationGain(tracker));
  const { percent: goalPercent, reached: goalReached } = goalProgress(distance, goalKm);

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
      // A race is its own kind of run, so a free run left paused is never taken for it (or the other way round).
      let kind = activity;
      if (race) kind = `race:${race.id}`;
      else if (isProgramRun) kind = `${programId}:${weekNumber}:${sessionIndex}`;
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

  /* -- Lock: the screen ignores touches until the lock is held, so a run in a pocket
     or an armband is not paused or ended by accident. Recording carries on. -- */
  const handleLock = useCallback(() => {
    setShowMenu(false);
    setLocked(true);
  }, []);
  const handleUnlock = useCallback(() => setLocked(false), []);
  useEffect(() => {
    if (!locked) return undefined;
    // The Android back button does nothing while locked.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [locked]);

  /* -- Distance goal: picked from the sheet, kept in km by the tracker store, and
     announced once when it is reached (a goal that is already behind the run is not). -- */
  const announcedGoal = useRef(null);
  const handleChooseGoal = useCallback((km) => {
    const { setGoalKm, tracker: current } = useRunTrackerStore.getState();
    setGoalKm(km);
    const next = useRunTrackerStore.getState().goalKm;
    announcedGoal.current = goalProgress(current.distanceM / 1000, next).reached ? next : null;
    setShowGoal(false);
  }, []);
  useEffect(() => {
    if (race) return; // a race announces its finish instead (below)
    if (!goalReached) {
      announcedGoal.current = null;
      return;
    }
    if (announcedGoal.current === goalKm) return;
    announcedGoal.current = goalKm;
    if (audioEnabled) {
      Speech.stop();
      Speech.speak('Distance goal reached', { rate: 1.0 });
    }
  }, [goalReached, goalKm]);

  /* -- Race: when the race distance is crossed, the time is taken from the run's
     kilometre splits and posted (services/raceBoard.js). The run carries on until it is ended. -- */
  const [raceResult, setRaceResult] = useState(null);
  const raceFinished = useRef(false);
  const audioRef = useRef(audioEnabled);
  audioRef.current = audioEnabled;
  const raceReached = !!race && tracker.splits.length >= race.distanceKm;
  useEffect(() => {
    if (!raceReached || raceFinished.current) return;
    raceFinished.current = true;
    const { splits, route } = useRunTrackerStore.getState().tracker;
    finishRace({ race, user, splits, coords: route, now: Date.now() })
      .then((result) => {
        setRaceResult(result);
        if (result.status === 'finished' && audioRef.current) {
          Speech.stop();
          Speech.speak(`Race finished. Your time is ${speakableRaceTime(result.timeSec)}`, { rate: 1.0 });
        }
      })
      .catch((e) => console.warn('Failed to post race:', e?.message));
  }, [raceReached]);
  const raceMessage = race ? raceResultMessage(raceResult, race) : '';

  /* -- Music: opens from the menu once the menu has closed -- */
  const musicTimer = useRef(null);
  const handleOpenMusic = useCallback(() => {
    setShowMenu(false);
    clearTimeout(musicTimer.current);
    musicTimer.current = setTimeout(() => setShowMusic(true), MENU_CLOSE_MS);
  }, []);
  useEffect(() => () => clearTimeout(musicTimer.current), []);

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
    let finishedJourneys = ''; // ids of the journeys this run took over the line
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
        const credited = useVirtualChallengeStore.getState().creditDistance(summary.distance, user?.uid);
        finishedJourneys = ((credited && credited.completed) || []).join(',');
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
          date: localDateKey(),
          description: countsForProgram
            ? `Completed ${programId} week ${weekNumber}, session ${sessionIndex + 1}`
            : `Completed a ${formatDistanceValue(summary.distance, units, 2)}${distanceUnitLabel(units)} ${activity}`,
          completed: true,
        }, user?.uid);
      }
    } catch (e) {
      console.warn('Failed to save run:', e?.message);
    }
    router.replace(`/workout/complete?type=run&runId=${savedRunId}${finishedJourneys ? `&journeys=${finishedJourneys}` : ''}`);
  }, [router, endRun, addExpActivity, user, isProgramRun, programWeek, programIntervals, programId, weekNumber, sessionIndex, completeProgramSession, activity, units]);

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

  const pace = formatPace(distance, elapsed, units);

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
          <Text style={[styles.intervalBannerLabel, programIntervals[intervalIndex].type === 'run' && styles.onLight]}>{programIntervals[intervalIndex].cue.toUpperCase()}</Text>
          <Text style={[styles.intervalBannerTime, programIntervals[intervalIndex].type === 'run' && styles.onLight]}>{formatTimer(intervalSecondsLeft)}</Text>
          <Text style={[styles.intervalBannerNext, programIntervals[intervalIndex].type === 'run' && styles.onLightSoft]}>
            {intervalIndex + 1 < programIntervals.length
              ? `Next: ${programIntervals[intervalIndex + 1].cue}`
              : 'Final interval'}
          </Text>
        </View>
      )}

      {/* Ã¢ÂÂÃ¢ÂÂ Stats panel Ã¢ÂÂÃ¢ÂÂ */}
      <View style={styles.statsPanel}>
        {/* Distance goal row: tap to pick a goal */}
        <View style={styles.goalBlock}>
          <Pressable
            style={styles.goalRow}
            onPress={race ? undefined : () => setShowGoal(true)}
            accessibilityRole="button"
            accessibilityLabel={race
              ? `${race.name}. ${raceReached ? 'Distance done' : `${formatDistance(Math.max(0, race.distanceKm - distance), units, 2)} to go`}.`
              : (goalKm ? `Distance goal ${goalLabel(goalKm, units)}. Tap to change.` : 'Distance goal not set. Tap to set one.')}
            testID="run-goal-row"
          >
            <View style={[styles.goalCircle, goalReached && styles.goalCircleDone]}>
              {goalReached && <Ionicons name="checkmark" size={14} color="#000" />}
            </View>
            <Text style={styles.goalText}>{race ? race.name : 'Distance Goal'}</Text>
            {goalKm ? (
              <>
                <Text style={styles.goalValue} testID="run-goal-value">
                  {race
                    ? (raceReached ? 'Distance done' : `${formatDistance(Math.max(0, race.distanceKm - distance), units, 2)} to go`)
                    : goalLabel(goalKm, units)}
                </Text>
                <Text style={styles.goalPercent} testID="run-goal-percent">{goalPercent}%</Text>
              </>
            ) : (
              <Text style={styles.goalValue} testID="run-goal-value">Not set</Text>
            )}
            {climb > 0 && <Text style={styles.climbText} testID="run-climb">{climb} m climb</Text>}
          </Pressable>
          {goalKm ? (
            <View style={styles.goalTrack}>
              <View style={[styles.goalFill, { width: `${goalPercent}%` }]} testID="run-goal-fill" />
            </View>
          ) : null}
          {raceMessage !== '' && (
            <Text style={styles.raceMessage} testID="run-race-result">{raceMessage}</Text>
          )}
        </View>

        {/* Main stats 2x2 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>
              {formatTimer(elapsed)}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>
              {formatDistanceValue(distance, units, 2)}
            </Text>
            <Text style={styles.statLabel}>{distanceUnitLabel(units) === 'mi' ? 'Miles' : 'Kilometers'}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>
              {pace}
            </Text>
            <Text style={styles.statLabel}>Pace</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>
              {Math.floor(calories)}
            </Text>
            <Text style={styles.statLabel}>Calories</Text>
          </View>
        </View>

        {/* Controls row */}
        <View style={styles.controlsRow}>
          <Pressable
            style={styles.smallBtn}
            onPress={handleLock}
            accessibilityLabel="Lock screen"
            testID="run-lock-button"
          >
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
            accessibilityLabel={audioEnabled ? 'Turn voice cues off' : 'Turn voice cues on'}
            testID="run-sound-button"
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
            <MenuOption icon="musical-notes-outline" label="Music" onPress={handleOpenMusic} />
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

      <RunGoalSheet
        visible={showGoal}
        units={units}
        goalKm={goalKm}
        onChoose={handleChooseGoal}
        onClose={() => setShowGoal(false)}
      />
      <RunMusicSheet visible={showMusic} onClose={() => setShowMusic(false)} />

      {/* Screen lock: covers everything and ignores touches until it is held */}
      {locked && (
        <Pressable
          style={styles.lockOverlay}
          onLongPress={handleUnlock}
          delayLongPress={UNLOCK_HOLD_MS}
          accessibilityRole="button"
          accessibilityLabel="Screen locked. Press and hold to unlock."
          testID="run-lock-overlay"
        >
          <View style={styles.lockHint} pointerEvents="none">
            <Ionicons name="lock-closed" size={14} color="#FFF" />
            <Text style={styles.lockHintText} testID="run-lock-hint">Locked. Hold to unlock.</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

/* Ã¢ÂÂÃ¢ÂÂ Styles Ã¢ÂÂÃ¢ÂÂ */

// Zown's black and white, the same as the run maps, saved runs and the feed
// (constants/runMap.js): white and grey on the dark panel. Colour is kept only where
// it means something: amber for a GPS problem and red for ending the run.
const styles = StyleSheet.create({
  intervalBanner: {
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
  },
  intervalBannerRun: { backgroundColor: '#FFFFFF' },
  intervalBannerWalk: { backgroundColor: '#2A2F38' },
  onLight: { color: '#0D1117' },
  onLightSoft: { color: 'rgba(13,17,23,0.65)' },
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
  goalBlock: { marginBottom: 16 },
  goalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  goalCircle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  goalCircleDone: { backgroundColor: '#FFFFFF' },
  goalText: { fontSize: 14, color: '#FFF', fontWeight: '500' },
  raceMessage: { fontSize: 13, color: '#FFF', fontWeight: '600', marginTop: 8 },
  goalValue: { fontSize: 14, color: '#888', fontWeight: '500' },
  goalPercent: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },
  goalTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 10, overflow: 'hidden' },
  goalFill: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
  climbText: { marginLeft: 'auto', fontSize: 13, color: '#888', fontWeight: '600' },

  /* Screen lock */
  lockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
  },
  lockHint: {
    position: 'absolute', top: 54, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: 'rgba(13,17,23,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  lockHintText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  /* Banner over the map */
  bannerWrap: {
    position: 'absolute', top: 100, left: 16, right: 16, alignItems: 'center', zIndex: 9,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16,
  },
  bannerPause: { backgroundColor: 'rgba(13,17,23,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
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
    backgroundColor: '#FFFFFF', height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  resumeBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
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

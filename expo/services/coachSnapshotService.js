// services/coachSnapshotService.js
//
// Reads the app's stores (weight logs, body scans, goals, nutrition,
// calendar, and the day's recovery, water, steps, fasting and calories
// burned) at the moment a coach message is sent and turns them into the
// system message built by lib/userProfileData.js. Read fresh each time so
// the coach never works from numbers that were changed after the screen
// opened. Any problem reading a store just leaves that part out.
import { useWeightLogStore } from '../store/weightLogStore';
import { useBodyCompositionStore } from '../store/bodyCompositionStore';
import { useGoalsStore } from '../store/goalsStore';
import { useNutritionStore } from '../store/nutritionStore';
import { useScheduleStore } from '../store/scheduleStore';
import { useHealthStore } from '../store/healthStore';
import { useWorkoutStore } from '../store/workoutStore';
import { useRunningStore } from '../store/runningStore';
import { useHikingStore } from '../store/hikingStore';
import { getActiveFast, getFastHistory } from './fastingService';
import { upcomingOccurrences } from '../lib/calendarEvents';
import { formatEventWhen } from '../lib/coachActions';
import { buildProfile, buildSnapshotMessage, dayTotals } from '../lib/userProfileData';
import { buildSignalLines } from '../lib/coachSignals';
import { computeCalorieMetrics, estimateCaloriesFromSteps } from '../lib/calorieMetrics';
import { eatGoal, burnGoal } from '../lib/calorieGoals';
import { localDateKey } from '../lib/localDate';

const safe = (fn, fallback) => {
  try { return fn(); } catch (e) { console.warn('[coachSnapshot] skipped:', e?.message); return fallback; }
};

export function loadSnapshotSources(uid) {
  return Promise.all([
    useWeightLogStore.getState().loadLogs(uid),
    useBodyCompositionStore.getState().loadScans(uid),
    useGoalsStore.getState().loadGoals(uid),
  ]);
}

// The fast that is running and the recent finished ones live in Firestore, not in a store, so they are read once when
// the Coach opens and kept here for the messages that follow. `active` is null when no fast is running and
// undefined when it could not be read; `history` is undefined when it could not be read.
let fastingCache = null; // { uid, active, history }
const FASTING_READ_MS = 5000;

/**
 * Reads the person's fasting from Firestore for the Coach. Never rejects and never takes longer than a few seconds,
 * so it cannot hold up or break anything else the Coach screen loads; whatever could not be read is simply left out.
 */
export function loadHabitSources(uid) {
  if (!uid) return Promise.resolve();
  let timer;
  const read = Promise.all([
    getActiveFast(uid).catch(() => undefined),
    getFastHistory(uid, 60).catch(() => undefined),
  ]).then(([active, history]) => { fastingCache = { uid, active, history }; });
  const patience = new Promise((resolve) => { timer = setTimeout(resolve, FASTING_READ_MS); });
  return Promise.race([read, patience]).catch(() => undefined).then(() => clearTimeout(timer));
}

export function getProfileFromStores(user) {
  const weightLogs = safe(() => useWeightLogStore.getState().logs, []);
  const scans = safe(() => useBodyCompositionStore.getState().scans, []);
  return buildProfile({ user, weightLogs, scans });
}

export function buildSnapshotFromStores(user, now = new Date()) {
  const weightLogs = safe(() => useWeightLogStore.getState().logs, []);
  const scans = safe(() => useBodyCompositionStore.getState().scans, []);
  const goals = safe(() => useGoalsStore.getState().goals, []);
  const profile = buildProfile({ user, weightLogs, scans });
  const nutrition = safe(() => {
    const state = useNutritionStore.getState();
    // The food diary keys each day by the person's own date. The targets are passed on only once a real one exists:
    // the store starts every account at a placeholder of 2000 calories, which is not anyone's goal.
    return {
      dailyGoals: eatGoal(state) ? state.dailyGoals : null,
      today: dayTotals(state.meals, [localDateKey(now)]),
    };
  }, null);
  const signals = safe(() => buildSignals(user, now), []);
  const upcoming = safe(
    () => upcomingOccurrences(useScheduleStore.getState().events, now, 6).map((e) => ({ title: e.title, when: formatEventWhen(e.start) })),
    []
  );
  return buildSnapshotMessage({ profile, weightLogs, goals, nutrition, upcoming, signals, now });
}

// The day's readings the Coach is told about (lib/coachSignals.js). Each piece is read on its own, so one store
// failing leaves out only that line.
function buildSignals(user, now) {
  const health = safe(() => useHealthStore.getState(), null);
  const nutrition = safe(() => useNutritionStore.getState(), null);
  const todaySteps = safe(() => health && health.getTodaySteps(), null);
  const burnTarget = burnGoal(user);

  // Calories burned the way the home Calories card works them out, so the two never disagree.
  const burnedToday = safe(() => {
    const stepsEstimate = estimateCaloriesFromSteps(todaySteps, user && user.weightKg);
    const metrics = computeCalorieMetrics(
      useWorkoutStore.getState().completedWorkouts,
      useRunningStore.getState().runs,
      burnTarget,
      stepsEstimate,
      useHikingStore.getState().completedHikes,
    );
    return metrics.todayCalories;
  }, null);

  const fasting = fastingCache && user && fastingCache.uid === user.uid ? fastingCache : null;
  return buildSignalLines({
    now,
    recovery: health && health.rookRecovery,
    hydration: health && health.hydration,
    todaySteps,
    fastActive: fasting && fasting.active,
    fastHistory: fasting && fasting.history,
    meals: nutrition ? nutrition.meals : [],
    eatTarget: nutrition ? eatGoal(nutrition) : null,
    burnedToday,
    burnTarget,
  });
}

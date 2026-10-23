// services/sessionService.js
//
// Builds today's session (lib/sessionPicker.js) from what the app holds: the muscle recovery worked out the way the Health screen and the AI plan
// do it, the sets of the last two weeks, the bodyweight rungs the person is on, their goal, level and injuries, and the target weight and reps
// the workout screen will show for each pick (the same load rules, asked the same way). The Today's Session screen uses it.
//
// Asking for a session never throws: one that cannot be built is null, and the screen says so. Nothing here waits long: the stores are brought
// up to date, and each pick's lift history is fetched, for at most `patience` milliseconds; a history that does not arrive just leaves that pick
// without a weight (the card in the workout still works it out when the exercise is opened).
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { calculateMuscleRecovery } from '@/lib/muscleRecovery';
import { recoveryInputs } from '@/lib/homeWidgetData';
import { getGoalIds } from '@/lib/userProfileData';
import { goalForLoad, countLowReadinessDays } from '@/lib/loadRules';
import { pickSession, weeklyVolume, currentRungs, attachTargets } from '@/lib/sessionPicker';
import { getNextPrescription } from '@/services/progressiveOverloadService';
import { getCurrentReadiness } from '@/services/wearableService';
import { isBodyweightExercise } from '@/services/exerciseDbService';
import { unitFromSetting, historyIn, targetIn } from '@/lib/weightUnits';

/** How long the stores and the lift histories are waited for before the session goes ahead with what it has. */
export const SESSION_PATIENCE_MS = 4000;

// The health store is taken when it is first needed and not at the top of the file: it opens the phone's storage the moment it loads. A store that
// cannot be had is the same as one with nothing in it: recovery then ignores sleep and the low-readiness days count as none.
const healthStore = () => {
  try {
    return require('@/store/healthStore').useHealthStore.getState();
  } catch {
    return {};
  }
};

// The weight unit the person chose in Settings, taken when it is needed for the same reason. Saved weights are pounds; this is the unit the
// targets are worked out and shown in. A store that cannot be had counts as pounds.
const currentUnit = () => {
  try {
    return unitFromSetting(require('@/store/settingsStore').useSettingsStore.getState().weightUnits);
  } catch {
    return 'lb';
  }
};

// A load that fails adds nothing; it never holds up or breaks the others.
const settle = (work) => Promise.resolve().then(work).catch(() => undefined);

// `promise`'s answer, or undefined if it fails or takes longer than `ms`.
function within(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(undefined); },
    );
  });
}

/** Brings the stores the session reads up to date, waiting at most `patience` milliseconds. Never rejects. */
export async function refreshSessionSources(uid, { patience = SESSION_PATIENCE_MS } = {}) {
  if (!uid) return;
  const health = healthStore();
  const refreshes = Promise.all([
    settle(() => useWorkoutStore.getState().loadWorkouts(uid)),
    settle(() => useRunningStore.getState().loadRuns(uid)),
    settle(() => useHikingStore.getState().loadCompletedHikes(uid)),
    settle(() => health.loadAllHealth(uid)),
    settle(() => health.loadRookRecovery()),
  ]);
  await within(refreshes, patience);
}

/** What the picker needs from the stores and the profile, at this moment (nothing is loaded here). */
export function readSessionInputs({ user, now = new Date() } = {}) {
  const workouts = useWorkoutStore.getState().completedWorkouts || [];
  const runs = useRunningStore.getState().runs || [];
  const hikes = useHikingStore.getState().completedHikes || [];
  const health = healthStore();
  const injuries = user && user.fitnessMetrics && Array.isArray(user.fitnessMetrics.injuries) ? user.fitnessMetrics.injuries : [];
  return {
    recovery: calculateMuscleRecovery({
      completedWorkouts: workouts, runs, completedHikes: hikes, recovery: recoveryInputs(health.rookRecovery, health.sleep), now,
    }),
    volume: weeklyVolume({ workouts, now }),
    ladderRungs: currentRungs(workouts),
    goal: goalForLoad(getGoalIds(user)),
    level: user ? user.fitnessLevel : undefined,
    injuries,
  };
}

/**
 * The target the workout screen would show for each exercise: { exerciseId: prescription | null }, from each lift's logged sets (a lift with
 * none, or one whose history does not arrive in time, is null). The same options the workout screen passes, so the two agree.
 * Weights come out in `unit` ('kg' or 'lb', by default the person's Settings > Weight Units): the saved sets are pounds and are turned into
 * that unit first, so a target in kilograms steps in kilogram plates.
 * `cache` keeps the histories already fetched ({ exerciseName: promise }), so changing the time or the equipment does not fetch them again.
 */
export async function loadPrescriptions(exercises, { uid, user, cache = new Map(), patience = SESSION_PATIENCE_MS, unit = currentUnit() } = {}) {
  const out = {};
  const list = (Array.isArray(exercises) ? exercises : []).filter((x) => x && !x.timed);
  if (!uid || list.length === 0) return out;
  const store = useWorkoutStore.getState();
  const readiness = await within(getCurrentReadiness(), patience);
  const lowReadinessDays = countLowReadinessDays(healthStore().readingsHistory);
  await Promise.all(list.map(async (x) => {
    if (!cache.has(x.name)) cache.set(x.name, Promise.resolve().then(() => store.getExerciseHistory(x.name, uid)));
    const history = await within(cache.get(x.name), patience);
    if (!Array.isArray(history)) { cache.delete(x.name); out[x.id] = null; return; }
    out[x.id] = targetIn(getNextPrescription(historyIn(history, unit), {
      readiness,
      exerciseName: x.name,
      bodyweight: isBodyweightExercise(x.name),
      goal: goalForLoad(getGoalIds(user)),
      level: user ? user.fitnessLevel : undefined,
      unit,
      lowReadinessDays,
    }), unit);
  }));
  return out;
}

/**
 * Today's session for `minutes` and `equipment` ('gym', 'dumbbells' or 'bodyweight'), with targets from the load rules in `unit` (by default
 * the person's Settings > Weight Units). Resolves to the session (lib/sessionPicker.js pickSession; its `status` says when there is nothing to
 * pick), or null when it could not be built. Call refreshSessionSources first so the stores are current.
 */
export async function buildTodaySession({ uid, user, minutes, equipment, now = new Date(), cache, patience, unit = currentUnit() } = {}) {
  try {
    const session = pickSession({ ...readSessionInputs({ user, now }), minutes, equipment });
    if (session.status !== 'ok') return session;
    const prescriptions = await loadPrescriptions(session.exercises, { uid, user, cache, patience, unit });
    return attachTargets(session, prescriptions, { unit });
  } catch {
    return null;
  }
}

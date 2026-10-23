// services/trainingStateService.js
//
// Reads the app's stores and gives back the training state (lib/trainingState.js) as it is right now: the muscle recovery worked out the
// way the Health screen does it, the lift records, the week's workout count, readiness and the training load. The AI plan call and the Coach
// both use it, so they are told the same things.
//
// Asking for it never throws: a state that cannot be had is null, and the caller carries on without it, exactly as it did before this
// existed. It also never waits long: the stores it needs are brought up to date, but only for `patience` milliseconds.
import { useWorkoutStore } from '@/store/workoutStore';
import { useRunningStore } from '@/store/runningStore';
import { useHikingStore } from '@/store/hikingStore';
import { summarizeLiftPRs } from '@/services/coachService';
import { PRIMARY_LIFT_MUSCLES } from '@/lib/crossDomainInsights';
import { calculateMuscleRecovery } from '@/lib/muscleRecovery';
import { aggregateDailyLoad, calculateTrainingLoad } from '@/lib/trainingLoad';
import { computeReadiness } from '@/lib/readiness';
import { recoveryInputs } from '@/lib/homeWidgetData';
import { hrvTitle } from '@/lib/healthDisplay';
import { localDateKey } from '@/lib/localDate';
import { buildTrainingState, isEmptyTrainingState } from '@/lib/trainingState';

/** How long the plan call waits for the stores before it goes ahead with what it has. */
export const TRAINING_STATE_PATIENCE_MS = 4000;

// The health store is taken when it is first needed and not at the top of the file: it opens the phone's storage the moment it loads,
// and the Coach screen (which only reads the state, inside a try) should not fail to open because of that. A store that cannot be
// had is the same as one with nothing in it: the muscle recovery then ignores sleep and the readiness is left out.
const healthStore = () => {
  try {
    return require('@/store/healthStore').useHealthStore.getState();
  } catch {
    return {};
  }
};

// A load that fails adds nothing; it never holds up or breaks the others.
const settle = (work) => Promise.resolve().then(work).catch(() => undefined);

/**
 * Brings the stores the state reads up to date, then the heaviest lifts' histories, giving up after `patience` milliseconds.
 * Resolves to the lift records found (an empty list when there was no time or no history). Never rejects.
 */
export async function loadTrainingSources(uid, { patience = TRAINING_STATE_PATIENCE_MS } = {}) {
  const found = { liftPRs: [] };
  let timer;
  const read = (async () => {
    const health = healthStore();
    const names = Object.keys(PRIMARY_LIFT_MUSCLES);
    // The refreshes and the lift histories do not wait for one another.
    const refreshes = Promise.all([
      settle(() => useWorkoutStore.getState().loadWorkouts(uid)),
      settle(() => useRunningStore.getState().loadRuns(uid)),
      settle(() => useHikingStore.getState().loadCompletedHikes(uid)),
      settle(() => health.loadAllHealth(uid)),
      settle(() => health.loadRookRecovery()),
    ]);
    const lifts = Promise.all(names.map((name) => settle(() => useWorkoutStore.getState().getExerciseHistory(name, uid))));
    const [histories] = await Promise.all([lifts, refreshes]);
    const byLift = {};
    names.forEach((name, i) => { byLift[name] = histories[i]; });
    found.liftPRs = summarizeLiftPRs(byLift);
  })().catch(() => undefined);
  const patient = new Promise((resolve) => { timer = setTimeout(resolve, patience); });
  await Promise.race([read, patient]);
  clearTimeout(timer);
  return found.liftPRs;
}

/**
 * The training state from what the stores hold at this moment (nothing is loaded here). `liftPRs` is summarizeLiftPRs' answer and
 * `injuries` the injuries the person reported (the state keeps only whether there are any, for the Coach; the plan function reads them
 * from the profile it is sent).
 * Muscle recovery is worked out by lib/muscleRecovery.js with the rule the Health screen uses for how rested the person is
 * (recoveryInputs), so the two never disagree.
 */
export function readTrainingState({ liftPRs = [], now = new Date(), injuries } = {}) {
  const workouts = useWorkoutStore.getState().completedWorkouts || [];
  const runs = useRunningStore.getState().runs || [];
  const hikes = useHikingStore.getState().completedHikes || [];
  const health = healthStore();

  const trainingLoad = calculateTrainingLoad(aggregateDailyLoad({ completedWorkouts: workouts, runs, completedHikes: hikes }));
  const recovery = calculateMuscleRecovery({
    completedWorkouts: workouts, runs, completedHikes: hikes, recovery: recoveryInputs(health.rookRecovery, health.sleep), now,
  });
  const readiness = computeReadiness({
    history: health.readingsHistory, today: localDateKey(now), trainingLoad, hrvLabel: hrvTitle(health.rookRecovery),
  });
  return buildTrainingState({ now, workouts, runs, hikes, recovery, liftPRs, readiness, trainingLoad, injuries });
}

/**
 * The training state for the AI plan call: the stores brought up to date, then read. Resolves to the state, or null when it could not
 * be had or tells the AI nothing (a brand-new account), in which case the plan call goes out as it always did.
 */
export async function getTrainingState(uid, { now = new Date(), patience } = {}) {
  try {
    if (!uid) return null;
    const liftPRs = await loadTrainingSources(uid, { patience });
    const state = readTrainingState({ liftPRs, now });
    return isEmptyTrainingState(state) ? null : state;
  } catch {
    return null;
  }
}

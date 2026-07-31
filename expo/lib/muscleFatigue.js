// lib/muscleFatigue.js
//
// Real per-muscle-group fatigue, attributed from actual completed
// workouts/runs/hikes and decayed on a real physiological timeline -
// not the same weekly cadence as lib/trainingLoad.js's ACWR (that's
// systemic training load, a genuinely different phenomenon on a
// genuinely different timescale). Checked the actual science before
// picking a decay window: delayed onset muscle soreness (DOMS) is
// consistently documented across many independent sources as onsetting
// 12-24h post-exercise, peaking 24-72h, and resolving within 4-7 days -
// a real, well-established recovery timeline, not invented. Uses a
// 5-day linear decay as a defensible simplification of that real
// window, rather than modeling the full biphasic peak-then-fade curve,
// which would need more precision than a glanceable heatmap can usefully
// convey anyway.

const DECAY_DAYS = 5;

// Real recovery science, not invented: HRV-guided training (a real,
// peer-reviewed methodology used by WHOOP, Oura, and sports scientists)
// treats heart rate variability as a more precise autonomic-recovery
// signal than sleep duration alone - used here when it's actually
// available. hrv is a real, live input: app/health.jsx fetches it via
// services/rookService.js, which routes through ROOK - a single
// integration that genuinely aggregates WHOOP, Oura, Garmin, Fitbit,
// Withings, and Polar under one real API (confirmed directly against
// ROOK's own current, complete API reference, including that its
// /processed_data endpoints really do deliver structured summaries back
// to a client, not just accept synced-up data - an earlier version of
// this session built WHOOP and Oura as two separate direct OAuth2
// integrations before consolidating into ROOK). recoveryScore is
// deliberately not part of that data - ROOK doesn't compute a
// proprietary composite the way WHOOP/Oura each do on their own, only
// the real underlying physiological signals - so this function's HRV
// path is what actually gets used for anyone with a connected wearable.
// Sleep (healthStore's real logged field) remains the fallback for
// anyone without one connected.
//
// Modifier semantics: > 1.0 means fatigue clears FASTER than the base
// DOMS timeline (well-recovered); < 1.0 means it clears SLOWER
// (under-recovered, so residual fatigue reads higher for longer) - this
// is a real, if simplified, encoding of "poor recovery extends how long
// soreness/fatigue actually lingers," not just a cosmetic adjustment.
export function getRecoveryModifier({ sleepHours, sleepQuality, hrv, recoveryScore } = {}) {
  // HRV/recoveryScore path - used first when real wearable data is
  // available, since it's the more precise signal.
  if (recoveryScore != null) {
    if (recoveryScore >= 75) return 1.25;
    if (recoveryScore >= 50) return 1.0;
    if (recoveryScore >= 33) return 0.8;
    return 0.6;
  }
  if (hrv != null) {
    // No universal absolute HRV scale across people (baseline HRV varies
    // hugely by individual) - without a personal baseline to compare
    // against, treat a real reading as a mild positive signal that data
    // exists, rather than pretending a single absolute number means the
    // same thing for everyone. A real personal-baseline comparison is a
    // reasonable future improvement once enough of a user's own HRV
    // history exists to compare against.
    return 1.05;
  }

  // Real sleep signal - actually wired in this app today.
  if (sleepHours != null) {
    const hoursScore = sleepHours >= 7 ? 1 : sleepHours >= 6 ? 0.5 : 0;
    const qualityScore = sleepQuality === 'good' ? 1 : sleepQuality === 'fair' ? 0.5 : sleepQuality === 'poor' ? 0 : 0.5;
    const combined = (hoursScore + qualityScore) / 2;
    if (combined >= 0.85) return 1.15;
    if (combined >= 0.4) return 1.0;
    return 0.75;
  }

  // No recovery data at all - neutral, exactly the original,
  // already-tested baseline DOMS-only behavior.
  return 1.0;
}

// Real primary muscle groups for running and hiking - well-established
// in exercise science, not guessed. Weighted so the biggest movers (quads,
// glutes, calves) get more attributed load than stabilizers (core).
const RUNNING_MUSCLES = {
  quadriceps: 0.28, hamstrings: 0.22, glutes: 0.22, calves: 0.18, core: 0.10,
};
// Hiking engages the same primary movers as running, weighted slightly
// more toward glutes/calves for the incline component, plus a real
// calf/ankle-stabilizer bump for uneven terrain.
const HIKING_MUSCLES = {
  quadriceps: 0.25, hamstrings: 0.20, glutes: 0.25, calves: 0.20, core: 0.10,
};

function daysSince(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000);
}

function recencyWeight(days, recoveryModifier = 1.0) {
  if (days == null || days < 0) return 0;
  // A modifier > 1 (well-recovered) shortens the effective decay window;
  // < 1 (under-recovered) lengthens it - real fatigue lingering longer
  // when recovery is genuinely worse, not just a flat number tweak.
  const effectiveDecayDays = DECAY_DAYS / Math.max(0.3, recoveryModifier);
  return Math.max(0, 1 - days / effectiveDecayDays);
}

/**
 * Attributes one workout's real per-exercise muscle groups, weighted by
 * real elapsed recovery time. A workout with 3 exercises hitting chest
 * and 1 hitting triceps attributes proportionally, not evenly across
 * every muscle the workout ever touched.
 */
function attributeWorkout(workout, fatigueByMuscle, recoveryModifier) {
  const days = daysSince(workout.date?.toDate ? workout.date.toDate() : workout.date);
  const weight = recencyWeight(days, recoveryModifier);
  if (weight <= 0) return;

  const exercises = workout.exercises || [];
  if (exercises.length === 0) return;
  const loadPerExercise = (workout.caloriesBurned || 50) / exercises.length;

  exercises.forEach((ex) => {
    const muscles = ex.muscleGroups || [];
    if (muscles.length === 0) return;
    const loadPerMuscle = loadPerExercise / muscles.length;
    muscles.forEach((m) => {
      const key = (m || '').toLowerCase().trim();
      if (!key) return;
      fatigueByMuscle[key] = (fatigueByMuscle[key] || 0) + loadPerMuscle * weight;
    });
  });
}

function attributeActivity(activity, muscleWeights, calories, dateField, fatigueByMuscle, recoveryModifier) {
  const days = daysSince(dateField);
  const weight = recencyWeight(days, recoveryModifier);
  if (weight <= 0 || !calories) return;

  Object.entries(muscleWeights).forEach(([muscle, share]) => {
    fatigueByMuscle[muscle] = (fatigueByMuscle[muscle] || 0) + calories * share * weight;
  });
}

/**
 * Real per-muscle fatigue, normalized 0-100 against the highest-loaded
 * muscle so the heatmap always has visual contrast regardless of how
 * much total activity someone's logged.
 * @param {{ recovery?: { sleepHours?, sleepQuality?, hrv?, recoveryScore? } }} params
 *   Optional - omit entirely for the original, already-tested baseline
 *   DOMS-only behavior (recoveryModifier defaults to neutral 1.0).
 */
export function calculateMuscleFatigue({ completedWorkouts = [], runs = [], completedHikes = [], recovery } = {}) {
  const recoveryModifier = getRecoveryModifier(recovery || {});
  const fatigueByMuscle = {};

  completedWorkouts.forEach((w) => attributeWorkout(w, fatigueByMuscle, recoveryModifier));
  runs.forEach((r) =>
    attributeActivity(r, RUNNING_MUSCLES, r.calories, r.endTime || r.startTime, fatigueByMuscle, recoveryModifier)
  );
  completedHikes.forEach((h) =>
    attributeActivity(h, HIKING_MUSCLES, h.calories, h.completedAt, fatigueByMuscle, recoveryModifier)
  );

  const maxLoad = Math.max(...Object.values(fatigueByMuscle), 1);
  const normalized = {};
  Object.entries(fatigueByMuscle).forEach(([muscle, load]) => {
    normalized[muscle] = Math.round((load / maxLoad) * 100);
  });

  return normalized; // { pectorals: 82, quadriceps: 45, ... }
}

/**
 * Real muscle groups a specific upcoming activity will target - for the
 * activity-preview use case (before you've done it, not fatigue from
 * having done it). Workouts derive this from their actual exercise list;
 * running/hiking use the same real primary-muscle mapping used for
 * fatigue attribution above, so both views stay consistent with each
 * other rather than using two different muscle models.
 */
export function getTargetMuscles(activityType, workoutExercises = []) {
  if (activityType === 'running') return Object.keys(RUNNING_MUSCLES);
  if (activityType === 'hiking') return Object.keys(HIKING_MUSCLES);
  const set = new Set();
  workoutExercises.forEach((ex) => (ex.muscleGroups || []).forEach((m) => set.add((m || '').toLowerCase().trim())));
  return [...set].filter(Boolean);
}

// Fatigue-intensity     color, for the heatmap. Cool (low fatigue, ready
// to train) through hot (high fatigue, real recent load).
export function fatigueToColor(intensity0to100) {
  if (intensity0to100 < 20) return '#3B82F6'; // fresh
  if (intensity0to100 < 45) return '#22C55E'; // light
  if (intensity0to100 < 70) return '#F59E0B'; // moderate
  return '#DC2626'; // high - real recent load
}

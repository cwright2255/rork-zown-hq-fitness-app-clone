// lib/trainingLoad.js
//
// Real cross-domain training load, using the Acute:Chronic Workload Ratio
// (ACWR) - a real, widely-used sports-science method for gauging training
// readiness and injury risk, not an invented "readiness score." This is
// the one thing genuinely nobody else can build well: Strava only sees
// runs/rides, AllTrails only sees hikes - Zown has real completed
// workouts, runs, AND hikes in one place, which is what ACWR actually
// needs to be meaningful (it's about TOTAL load, not one activity type).
//
// Honest about the science, not just the code: ACWR is real and widely
// adopted (rolling-average model here, the simpler and more transparent
// of the two common approaches), but recent research has real, published
// debate about how predictive it actually is - a 2025 Bayesian analysis
// found a randomized version of the ratio was about as associated with
// injury as the real one. This is presented as a training-load
// awareness tool, not a medical or injury-prediction claim.
//
// Load unit: calories burned, the one real metric already tracked
// consistently across all three domains (workoutStore.caloriesBurned,
// runningStore.calories, and - as of this session - hikingStore's
// MET-based hike calorie estimate). Distance or duration alone would
// under-count a Strenuous hike relative to an easy run of the same
// length, which calories (via the real difficulty-to-MET mapping) does
// not.

const SWEET_SPOT_MIN = 0.8;
const SWEET_SPOT_MAX = 1.3;
const HIGH_RISK_THRESHOLD = 1.5;

function toDateKey(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Normalizes completed workouts/runs/hikes (each with their own date
 * field name and shape) into one real per-day calorie total.
 */
export function aggregateDailyLoad({ completedWorkouts = [], runs = [], completedHikes = [] }) {
  const byDate = {};

  const addLoad = (dateInput, calories) => {
    const key = toDateKey(dateInput);
    if (!key || !calories) return;
    byDate[key] = (byDate[key] || 0) + calories;
  };

  completedWorkouts.forEach((w) => {
    // Firestore Timestamp objects need .toDate(); a plain ISO string
    // (e.g. from local-only fallback saves) does not.
    const dateValue = w.date?.toDate ? w.date.toDate() : w.date;
    addLoad(dateValue, w.caloriesBurned);
  });
  runs.forEach((r) => addLoad(r.endTime || r.startTime, r.calories));
  completedHikes.forEach((h) => addLoad(h.completedAt, h.calories));

  return byDate;
}

/**
 * Real ACWR, computed from actual daily load history - not estimated,
 * not simulated. Rolling-average model: acute = sum of the last 7 days,
 * chronic = average weekly load over the last 28 days.
 */
export function calculateTrainingLoad(dailyLoadByDate) {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  let acuteSum = 0;
  let chronicSum = 0;
  let daysWithDataInChronicWindow = 0;

  for (let i = 0; i < 28; i++) {
    const key = toDateKey(new Date(now.getTime() - i * dayMs));
    const load = dailyLoadByDate[key] || 0;
    if (dailyLoadByDate[key] != null) daysWithDataInChronicWindow++;
    chronicSum += load;
    if (i < 7) acuteSum += load;
  }

  const chronicWeeklyAvg = chronicSum / 4;
  // Insufficient history to make chronic load meaningful - a ratio from
  // one or two days of data would be misleading, not just imprecise.
  const hasEnoughHistory = daysWithDataInChronicWindow >= 5;

  if (!hasEnoughHistory || chronicWeeklyAvg === 0) {
    return {
      acuteLoad: Math.round(acuteSum),
      chronicWeeklyAvg: Math.round(chronicWeeklyAvg),
      ratio: null,
      zone: 'insufficient_data',
      zoneLabel: 'Not enough history yet',
    };
  }

  const ratio = acuteSum / chronicWeeklyAvg;
  let zone, zoneLabel;
  if (ratio < SWEET_SPOT_MIN) {
    zone = 'detraining';
    zoneLabel = 'Below usual training - easing off, or a rest stretch';
  } else if (ratio <= SWEET_SPOT_MAX) {
    zone = 'sweet_spot';
    zoneLabel = 'In your typical training range';
  } else if (ratio <= HIGH_RISK_THRESHOLD) {
    zone = 'elevated';
    zoneLabel = 'Higher than usual - a real load increase this week';
  } else {
    zone = 'high';
    zoneLabel = 'Well above your recent average - a real training spike';
  }

  return {
    acuteLoad: Math.round(acuteSum),
    chronicWeeklyAvg: Math.round(chronicWeeklyAvg),
    ratio: Math.round(ratio * 100) / 100,
    zone,
    zoneLabel,
  };
}

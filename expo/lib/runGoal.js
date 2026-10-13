// lib/runGoal.js
//
// The distance goal on the run screen: the choices offered in the person's units
// (Settings > Distance Units), how far along the run is, and the words for it.
// A goal is kept in kilometres, like every other distance, so changing the unit
// in Settings changes only how it reads.

import { KM_PER_MILE, distanceUnitLabel, formatDistance, usesMiles } from './distanceUnits';

/** Round distances people train for, in the unit they are shown in. */
const PRESETS = {
  imperial: [1, 2, 3, 5, 10, 13.1],
  metric: [1, 3, 5, 10, 15, 21.1],
};

/** A goal as a kilometre figure we can trust: a number above zero, or null for no goal. */
export function cleanGoalKm(value) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The goals on offer: [{ value, label, km }] with the value in the shown unit
 * ("3.1" miles), the label to print ("3.1 mi") and the same distance in km.
 */
export function goalOptions(units) {
  const miles = usesMiles(units);
  const unit = distanceUnitLabel(units);
  return PRESETS[miles ? 'imperial' : 'metric'].map((value) => ({
    value,
    label: `${value} ${unit}`,
    km: miles ? value * KM_PER_MILE : value,
  }));
}

/** Whether a goal in km is the same distance as an option on offer. */
export function isSameGoal(goalKm, option) {
  const goal = cleanGoalKm(goalKm);
  return goal !== null && !!option && Math.abs(goal - option.km) < 1e-6;
}

/**
 * How far along the run is: { percent, reached }. `percent` counts whole percents
 * and only reaches 100 when the goal is reached, so it never says 100 a few
 * metres early. No goal gives 0 and not reached.
 */
export function goalProgress(distanceKm, goalKm) {
  const goal = cleanGoalKm(goalKm);
  const done = Number(distanceKm);
  if (goal === null || !Number.isFinite(done) || done <= 0) return { percent: 0, reached: false };
  if (done >= goal) return { percent: 100, reached: true };
  return { percent: Math.min(99, Math.floor((done / goal) * 100)), reached: false };
}

/** The goal as shown: "5 km", "3.1 mi", "13.1 mi" (no ".0" on a whole number). */
export function goalLabel(goalKm, units) {
  const goal = cleanGoalKm(goalKm);
  if (goal === null) return '';
  return formatDistance(goal, units, 1).replace('.0 ', ' ');
}

// lib/weightUnits.js
//
// Kilograms or pounds for the weights on a barbell, following the person's Settings > Weight Units.
//
// What is stored never changes unit: every logged set (Firestore loggedSets, the workout history, the one-rep-max and record maths, the
// strength standards) holds POUNDS, which is what the workout screen has always logged. The unit the person chose is applied only where
// a weight is shown or typed: a weight read from the history is turned into their unit before it is shown or used to work out a target,
// and a weight they type is turned back into pounds before it is saved. So changing the setting later never changes any saved weight.
//
// The factor is the one the rest of the app uses for body weight (lib/macroWeightData.js KG_TO_LB), so a kilogram figure here and on the
// Progress screen agree. Converted weights are kept to two decimals: a weight typed in kilograms goes to pounds and comes back to the same
// two decimals, which is what keeps "102.5 kg" from drifting to "102.49 kg" after a trip through the history.
import { KG_TO_LB } from './macroWeightData';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const twoDecimals = (v) => Math.round(v * 100) / 100;

/** The unit for a Settings > Weight Units value ('metric' or 'imperial'). Anything but 'metric' is pounds, as the rest of the app reads it. */
export const unitFromSetting = (weightUnits) => (weightUnits === 'metric' ? 'kg' : 'lb');

/** Text for a unit. */
export const unitLabel = (unit) => (unit === 'kg' ? 'kg' : 'lb');

/** A stored weight (pounds) in `unit`. Not a number gives null. */
export function fromPounds(pounds, unit) {
  if (!finite(pounds)) return null;
  return unit === 'kg' ? twoDecimals(pounds / KG_TO_LB) : pounds;
}

/** A weight in `unit` as pounds, ready to be stored. Not a number gives null. */
export function toPounds(value, unit) {
  if (!finite(value)) return null;
  return unit === 'kg' ? twoDecimals(value * KG_TO_LB) : value;
}

/** A weight for the screen: the number to one decimal with a trailing .0 dropped ("102.5", "100"), no unit. Not a number gives "". */
export function weightNumber(value) {
  if (!finite(value)) return '';
  return String(Math.round(value * 10) / 10);
}

/** A stored weight (pounds) as screen text in `unit`: "102.5 kg", "225 lb". Not a number gives "". */
export function weightText(pounds, unit) {
  const value = fromPounds(pounds, unit);
  return value === null ? '' : `${weightNumber(value)} ${unitLabel(unit)}`;
}

/**
 * A lift's logged sets (getExerciseHistory's answer: [{ weight, reps, rpe, date }]) with every weight in `unit`, for the load rules to work
 * from. Everything else on a set is kept as it was; a set whose weight is not a number keeps it as it was. Not a list gives [].
 */
export function historyIn(history, unit) {
  if (!Array.isArray(history)) return [];
  if (unit !== 'kg') return history;
  return history.map((set) => (set && finite(set.weight) ? { ...set, weight: fromPounds(set.weight, unit) } : set));
}

/**
 * A prescription (lib/loadRules.js prescribeNext's answer) with its weight made loadable in `unit`. Pounds are left as they are. In
 * kilograms the weight is rounded to the nearest half kilogram: a history that was logged in pounds and is now read in kilograms gives
 * figures like 25.18 kg, which nobody can load, while the plates, 2 kg dumbbell steps and half-kilogram discs people really use all
 * come out as they were. The share of the one-rep max is worked out again from the rounded weight. A prescription without a weight
 * (a bodyweight move, a hold) is returned as it was; so is something that is not a prescription.
 */
export function targetIn(prescription, unit) {
  if (!prescription || typeof prescription !== 'object' || unit !== 'kg') return prescription;
  if (!finite(prescription.weight) || prescription.weight <= 0) return prescription;
  const weight = Math.round(prescription.weight * 2) / 2;
  const oneRepMax = prescription.estimatedOneRepMax;
  return {
    ...prescription,
    weight,
    shareOfOneRepMax: finite(oneRepMax) && oneRepMax > 0 ? Math.round((weight / oneRepMax) * 100) : prescription.shareOfOneRepMax,
  };
}

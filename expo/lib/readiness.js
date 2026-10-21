// lib/readiness.js
//
// Today's readiness: one number from 0 to 100 worked out from four things, with the working shown.
//
//   HRV                    today's reading against the person's own average of the 28 days before (weight 35)
//   Resting heart rate     the same, but lower is better (weight 25)
//   Sleep                  last night's hours: 100 at 8 h, 25 points less for every hour under (weight 25)
//   Training load          this week's load against the usual week (lib/trainingLoad.js): 100 up to 1.3, down to 0 at 2 (weight 15)
//
// Each part is given a score from 0 to 100, rounded; readiness is the average of the scores of the parts that have a reading, each
// counted by its weight, rounded. A part with no reading is left out and the others share its weight. HRV and resting heart rate score
// 75 when they are the same as usual. Nothing is shown until at least two of HRV, resting heart rate and sleep have a reading (and HRV
// and resting heart rate need about two weeks of earlier readings to compare with), so a score is never made from too little.
// Pure functions: the Health screen passes in healthStore.readingsHistory and the training load it already works out.
import { shiftDateKey } from './localDate';
import { readingByDay, trendSeries, formatValue } from './dailyReadings';

/** How many days before today the usual is averaged over, and how many readings in them are needed before it counts. */
export const BASELINE_DAYS = 28;
export const MIN_BASELINE_READINGS = 10;
/** Sleep scores 100 at this many hours and loses SLEEP_POINTS_PER_HOUR for each hour under. */
export const SLEEP_TARGET_HOURS = 8;
export const SLEEP_POINTS_PER_HOUR = 25;
/** The score of an HRV or resting heart rate that is the same as usual, and the points gained or lost for a change of 100% (so 250 is 2.5 points for each 1%). */
export const USUAL_SCORE = 75;
export const HRV_POINTS_PER_100_PERCENT = 250;
export const RESTING_HR_POINTS_PER_100_PERCENT = 500;
/** Training load: full marks up to this ratio, 50 at the second, 0 at the third (straight lines between). */
export const LOAD_FULL_UNTIL = 1.3;
export const LOAD_HALF_AT = 1.5;
export const LOAD_ZERO_AT = 2;
/** At least this many of HRV, resting heart rate and sleep must have a reading for readiness to be shown. */
export const MIN_BODY_PARTS = 2;

export const READINESS_WEIGHTS = { hrv: 35, restingHeartRate: 25, sleep: 25, load: 15 };

/** Words for the bands: 75 and over, 50 to 74, under 50. */
export const READINESS_BANDS = [
  { min: 75, label: 'High' },
  { min: 50, label: 'Moderate' },
  { min: 0, label: 'Low' },
];

export const READINESS_FORMULA = [
  'Readiness is the average of the scores above, each counted by the weight beside it. A part with no reading is left out and the others share its weight.',
  'HRV and resting heart rate are scored against your own average of the last 4 weeks: 75 means the same as usual.',
  'Sleep scores 100 at 8 hours and loses 25 points for every hour under. Training load scores 100 up to 1.3 and falls to 0 at 2.',
  'A guide made from your own readings, not medical advice.',
].join(' ');

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const whole = (n) => Math.round(n);

export function readinessLabel(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return READINESS_BANDS.find((band) => score >= band.min)?.label ?? READINESS_BANDS[READINESS_BANDS.length - 1].label;
}

/** HRV: higher than usual scores more. `usual` is the person's average. */
export function hrvScore(value, usual) {
  return whole(clamp(USUAL_SCORE + ((value - usual) / usual) * HRV_POINTS_PER_100_PERCENT, 0, 100));
}

/** Resting heart rate: lower than usual scores more. */
export function restingHeartRateScore(value, usual) {
  return whole(clamp(USUAL_SCORE + ((usual - value) / usual) * RESTING_HR_POINTS_PER_100_PERCENT, 0, 100));
}

export function sleepScore(hours) {
  return whole(clamp(100 - (SLEEP_TARGET_HOURS - hours) * SLEEP_POINTS_PER_HOUR, 0, 100));
}

/** Training load: `ratio` is this week's load over the usual week. More than usual is worse; less than usual costs nothing. */
export function loadScore(ratio) {
  if (ratio <= LOAD_FULL_UNTIL) return 100;
  if (ratio <= LOAD_HALF_AT) return whole(100 - ((ratio - LOAD_FULL_UNTIL) / (LOAD_HALF_AT - LOAD_FULL_UNTIL)) * 50);
  return whole(clamp(50 - ((ratio - LOAD_HALF_AT) / (LOAD_ZERO_AT - LOAD_HALF_AT)) * 50, 0, 50));
}

const signedPercent = (change) => {
  const percent = whole(change * 100);
  return `${percent > 0 ? '+' : ''}${percent}%`;
};

/**
 * Readiness for `today` (a day key) from the daily record `history` (healthStore.readingsHistory) and `trainingLoad`
 * (calculateTrainingLoad's answer, or null).
 *
 * @returns {{
 *   hidden: boolean,   true when there is nothing to build on yet: show no card at all
 *   ready: boolean,    true when there is a score
 *   score: number | null, label: string | null,
 *   used: number,      how many of the four parts the score is made from
 *   parts: { key: string, title: string, weight: number, state: 'used' | 'waiting' | 'building', detail: string, score: number | null }[],
 *   formula: string
 * }}
 */
export function computeReadiness({ history, today, trainingLoad = null, hrvLabel = 'HRV' } = {}) {
  const byField = {
    hrv: readingByDay(history, 'hrv'),
    restingHeartRate: readingByDay(history, 'restingHeartRate'),
    sleepHours: readingByDay(history, 'sleepHours'),
  };
  const usualOf = (field) => {
    const { average, count } = trendSeries(byField[field], shiftDateKey(today, -1), BASELINE_DAYS);
    return { average, count };
  };

  // A reading compared with the person's own usual.
  const compared = (key, title, field, unit, scoreOf) => {
    const usual = usualOf(field);
    const value = byField[field][today];
    const base = { key, title, weight: READINESS_WEIGHTS[key], score: null };
    if (usual.count < MIN_BASELINE_READINGS) {
      return { ...base, state: 'building', detail: `Needs about two weeks of readings to compare with (${usual.count} of ${MIN_BASELINE_READINGS} so far)` };
    }
    if (value === undefined) return { ...base, state: 'waiting', detail: 'Waiting for today\'s reading' };
    const score = scoreOf(value, usual.average);
    const detail = `${formatValue(value, { unit })} today, ${formatValue(usual.average, { unit })} usual (${signedPercent((value - usual.average) / usual.average)})`;
    return { ...base, state: 'used', detail, score };
  };

  const sleepPart = () => {
    const base = { key: 'sleep', title: 'Sleep', weight: READINESS_WEIGHTS.sleep, score: null };
    const hours = byField.sleepHours[today];
    if (hours === undefined) return { ...base, state: 'waiting', detail: 'Waiting for last night\'s sleep' };
    return {
      ...base, state: 'used', score: sleepScore(hours),
      detail: `${formatValue(hours, { decimals: 1, unit: 'h' })} last night (${SLEEP_TARGET_HOURS} h scores 100)`,
    };
  };

  const loadPart = () => {
    const base = { key: 'load', title: 'Training load', weight: READINESS_WEIGHTS.load, score: null };
    const ratio = trainingLoad?.ratio;
    if (!trainingLoad || trainingLoad.zone === 'insufficient_data' || typeof ratio !== 'number' || !Number.isFinite(ratio)) {
      return { ...base, state: 'building', detail: 'Needs about a week of workouts, runs or hikes' };
    }
    return { ...base, state: 'used', score: loadScore(ratio), detail: `${ratio.toFixed(2)} this week against your usual week` };
  };

  const parts = [
    compared('hrv', hrvLabel, 'hrv', 'ms', hrvScore),
    compared('restingHeartRate', 'Resting heart rate', 'restingHeartRate', 'bpm', restingHeartRateScore),
    sleepPart(),
    loadPart(),
  ];

  const used = parts.filter((p) => p.state === 'used');
  const bodyUsed = used.filter((p) => p.key !== 'load').length;
  const anyReading = Object.values(byField).some((days) => Object.keys(days).length > 0);
  const ready = bodyUsed >= MIN_BODY_PARTS;
  const weightSum = used.reduce((sum, p) => sum + p.weight, 0);
  const score = ready ? whole(used.reduce((sum, p) => sum + p.weight * p.score, 0) / weightSum) : null;
  return {
    hidden: !anyReading,
    ready,
    score,
    label: readinessLabel(score),
    used: used.length,
    parts,
    formula: READINESS_FORMULA,
  };
}

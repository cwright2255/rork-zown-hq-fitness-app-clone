// lib/macroWeightData.js
//
// What the Macros and Weight cards on Home say, as plain functions: no React, no Firebase, no stores, so each rule is unit tested.
// The cards (components/MacrosWidget.jsx, components/WeightWidget.jsx) only draw what these return.
//
//   Macros   today's protein, carbs and fat against the daily goals, added up from the food diary the way the Nutrition screen adds
//            them (lib/nutritionHistory.js foodTotals), so the grams on Home are the grams there.
//   Weight   the latest logged weight, how far it has moved since the first one, how far it is from the target, and the body fat of
//            the latest body scan. The first two are the Progress screen's own numbers.
import { foodTotals } from './nutritionHistory';

const DASH = '\u2014';
const DOWN = '\u2193';
const UP = '\u2191';

/** Pounds in a kilogram, the figure the Progress screen and the fasting card use. */
export const KG_TO_LB = 2.20462;

const positive = (v) => {
  const n = Number(v);
  return v != null && v !== '' && Number.isFinite(n) && n > 0 ? n : null;
};
const tenth = (n) => Math.round(n * 10) / 10;

// The colours the Nutrition screen gives the three macros.
const MACROS = [
  { key: 'protein', label: 'Protein', color: '#3B82F6' },
  { key: 'carbs', label: 'Carbs', color: '#F97316' },
  { key: 'fat', label: 'Fat', color: '#A855F7' },
];

/**
 * Today's macros, ready to draw: { state, rows, caption, sentence }.
 *   meals    the food diary (nutritionStore.meals): { date, foods: [...] } per meal slot per day
 *   goals    the daily goals (nutritionStore.dailyGoals): { protein, carbs, fat, ... } in grams
 *   dateKey  the day, "YYYY-MM-DD" in the phone's own time zone (lib/localDate.js localDateKey)
 * `rows` has one entry for each of protein, carbs and fat: { key, label, color, grams, goal, pct, over, text }. `grams` is rounded the
 * way the Nutrition screen rounds it. `goal` is null when no usable goal is set, and then `pct` is null (no bar) and `text` is just
 * the grams. `pct` is how much of the goal is eaten, held between 0 and 100; `over` is true past the goal. `state` is 'empty' when
 * nothing is logged for the day and 'logged' otherwise.
 */
export function macrosSummary({ meals, goals, dateKey } = {}) {
  const foods = (Array.isArray(meals) ? meals : [])
    .filter((m) => m && m.date === dateKey)
    .flatMap((m) => (Array.isArray(m.foods) ? m.foods : []));
  const totals = foodTotals(foods);
  const rows = MACROS.map(({ key, label, color }) => {
    const grams = Math.round(totals[key]);
    const goal = positive(goals && goals[key]);
    const goalG = goal === null ? null : Math.round(goal);
    return {
      key,
      label,
      color,
      grams,
      goal: goalG,
      pct: goal === null ? null : Math.min(100, Math.max(0, Math.round((totals[key] / goal) * 100))),
      over: goal !== null && totals[key] > goal,
      text: goalG === null ? `${grams}g` : `${grams}/${goalG}g`,
    };
  });
  const state = totals.foodCount > 0 ? 'logged' : 'empty';
  const body = rows
    .map((r) => (r.goal === null ? `${r.label.toLowerCase()} ${r.grams} grams` : `${r.label.toLowerCase()} ${r.grams} of ${r.goal} grams`))
    .join(', ');
  return {
    state,
    rows,
    caption: state === 'empty' ? 'Nothing logged yet' : 'Today',
    sentence: state === 'empty' ? 'Macros today: nothing logged yet' : `Macros today: ${body}`,
  };
}

/**
 * The weight and body scan figures, ready to draw: { state, value, change, bodyFat, caption, sentence }.
 *   logs     the weight log (weightLogStore.logs), oldest to newest: { weightKg }
 *   scans    the body scans (bodyCompositionStore.scans), oldest to newest: { bodyFatPercent }
 *   pounds   true to show pounds, false for kilograms (Settings > Weight Units)
 *   targetKg the target weight in kilograms, or null when there is none
 * `value` is the latest weight ("172 lbs", "78.4 kg") or a dash when nothing is logged. `change` is how far it has moved since the
 * first log, worked out the way the Progress screen does (each weight rounded first), or null with fewer than two logs:
 * { text, direction: 'down' | 'up' | 'same' }. `bodyFat` is the latest scan's body fat and how it moved since the scan before, or null
 * when the latest scan has none: { text, change }. `state` is 'empty' when nothing is logged (a scan can still be there) and 'logged'.
 */
export function weightSummary({ logs, scans, pounds = true, targetKg = null } = {}) {
  const unit = pounds ? 'lbs' : 'kg';
  const show = (kg) => (pounds ? Math.round(kg * KG_TO_LB) : tenth(kg));
  const amount = (n) => (pounds ? Math.round(n) : tenth(n));

  const weights = (Array.isArray(logs) ? logs : []).map((l) => positive(l && l.weightKg)).filter((w) => w !== null);
  const state = weights.length > 0 ? 'logged' : 'empty';

  let value = DASH;
  let change = null;
  let caption = 'Log your weight';
  let sentence = 'Weight: nothing logged yet';
  if (state === 'logged') {
    const latest = show(weights[weights.length - 1]);
    value = `${latest} ${unit}`;
    sentence = `Weight: ${value}`;
    if (weights.length > 1) {
      const delta = show(weights[0]) - latest; // positive when the weight has come down, as on the Progress screen
      const size = amount(Math.abs(delta));
      const direction = size === 0 ? 'same' : delta > 0 ? 'down' : 'up';
      change = {
        text: direction === 'same' ? 'No change from start' : `${direction === 'down' ? DOWN : UP} ${size} ${unit} from start`,
        direction,
      };
      sentence += direction === 'same' ? ', no change from the start' : `, ${direction} ${size} ${unit} from the start`;
    }
    const target = positive(targetKg);
    if (target === null) {
      caption = 'View progress';
    } else {
      const gap = amount(Math.abs(latest - show(target)));
      caption = gap === 0 ? 'At target' : `${gap} ${unit} to target`;
      sentence += gap === 0 ? ', at the target' : `, ${gap} ${unit} from the target`;
    }
  }

  let bodyFat = null;
  const scanList = Array.isArray(scans) ? scans : [];
  const lastScan = scanList[scanList.length - 1];
  const latestFat = positive(lastScan && lastScan.bodyFatPercent);
  if (latestFat !== null) {
    const earlier = scanList.slice(0, -1).map((s) => positive(s && s.bodyFatPercent)).filter((f) => f !== null);
    const before = earlier.length > 0 ? earlier[earlier.length - 1] : null;
    const diff = before === null ? 0 : tenth(latestFat - before);
    bodyFat = {
      text: `${tenth(latestFat)}%`,
      change: diff === 0 ? '' : `${diff < 0 ? DOWN : UP}${Math.abs(diff)}`,
    };
    sentence += `, body fat ${tenth(latestFat)} percent${diff === 0 ? '' : `, ${diff < 0 ? 'down' : 'up'} ${Math.abs(diff)} since the scan before`}`;
  }

  return { state, value, change, bodyFat, caption, sentence };
}

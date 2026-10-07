// lib/userProfileData.js
//
// One place that gathers what the app knows about a person (profile, latest
// weight from logs/scans, goals, injuries, training schedule, food rules) so
// the AI coach, the workout generator and the nutrition targets all read the
// SAME facts instead of each guessing on their own. Pure functions only, so
// they are easy to test.
import { getDietProfile } from './dietProfile';

export const GOAL_LABELS = {
  lose_weight: 'Lose Weight',
  build_muscle: 'Build Muscle',
  improve_endurance: 'Improve Endurance',
  stay_active: 'Stay Active',
  train_for_race: 'Train for a Race',
  eat_healthier: 'Eat Healthier',
  reduce_stress: 'Reduce Stress',
};

export const INJURY_LABELS = {
  knee: 'Knee', shoulder: 'Shoulder', lower_back: 'Lower Back', hip: 'Hip',
  ankle: 'Ankle', wrist: 'Wrist', elbow: 'Elbow', neck: 'Neck',
};

// Profile goal ids -> the ids the Quick Workout generator understands.
const QUICK_GOAL_MAP = {
  lose_weight: 'weight_loss',
  build_muscle: 'build_muscle',
  improve_endurance: 'improve_endurance',
  train_for_race: 'improve_endurance',
  stay_active: 'general_fitness',
  eat_healthier: 'general_fitness',
  reduce_stress: 'improve_flexibility',
};

const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const humanize = (id) => String(id || '').replace(/_/g, ' ');

/** Goal ids the person picked in onboarding / Edit Profile (user.goals was never filled in). */
export function getGoalIds(user) {
  const picked = asList(user?.fitnessMetrics?.targetGoals);
  return picked.length ? picked : asList(user?.goals);
}

/** Goal ids converted to Quick Workout ids, no repeats. */
export function toQuickWorkoutGoals(user) {
  const out = [];
  getGoalIds(user).forEach((id) => {
    const mapped = QUICK_GOAL_MAP[id] || (Object.values(QUICK_GOAL_MAP).includes(id) ? id : null);
    if (mapped && !out.includes(mapped)) out.push(mapped);
  });
  return out;
}

/** Goal ids as readable labels for prompts. */
export function getGoalLabels(user) {
  return getGoalIds(user).map((id) => GOAL_LABELS[id] || humanize(id));
}

const timeOf = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Newest known weight in kg: the most recent weight log or body scan, else the
 * number saved on the profile.
 */
export function latestWeight({ weightLogs = [], scans = [], user = null } = {}) {
  const candidates = [];
  (weightLogs || []).forEach((l) => {
    const kg = num(l?.weightKg);
    const t = timeOf(l?.createdAtLocal);
    if (kg && t !== null) candidates.push({ kg, t, source: 'weight log' });
  });
  (scans || []).forEach((s) => {
    const kg = num(s?.weightKg);
    const t = timeOf(s?.createdAtLocal);
    if (kg && t !== null) candidates.push({ kg, t, source: 'body scan' });
  });
  if (candidates.length) {
    candidates.sort((a, b) => b.t - a.t);
    return { kg: candidates[0].kg, source: candidates[0].source };
  }
  const saved = num(user?.weightKg) || num(user?.fitnessMetrics?.weight);
  return saved ? { kg: saved, source: 'profile' } : { kg: null, source: null };
}

/** Change in weight (kg) between the oldest and newest log in the last `days` days. */
export function weightTrend(weightLogs, { now = new Date(), days = 30 } = {}) {
  const cutoff = now.getTime() - days * 86400000;
  const pts = (weightLogs || [])
    .map((l) => ({ kg: num(l?.weightKg), t: timeOf(l?.createdAtLocal) }))
    .filter((p) => p.kg && p.t !== null && p.t >= cutoff && p.t <= now.getTime() + 86400000)
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const first = pts[0];
  const last = pts[pts.length - 1];
  return {
    changeKg: Math.round((last.kg - first.kg) * 10) / 10,
    days: Math.max(1, Math.round((last.t - first.t) / 86400000)),
    entries: pts.length,
  };
}

/** Newest body-fat % from a scan, or null. */
export function latestBodyFat(scans) {
  const withFat = (scans || [])
    .map((s) => ({ pct: num(s?.bodyFatPercent), t: timeOf(s?.createdAtLocal) }))
    .filter((s) => s.pct && s.t !== null)
    .sort((a, b) => b.t - a.t);
  return withFat.length ? withFat[0].pct : null;
}

/** Everything about the person in one plain object. Missing values are null / []. */
export function buildProfile({ user, weightLogs = [], scans = [] } = {}) {
  const w = latestWeight({ weightLogs, scans, user });
  const prefs = user?.preferences || {};
  const metrics = user?.fitnessMetrics || {};
  const days = Number(prefs.workoutDaysPerWeek);
  const diet = getDietProfile(user);
  return {
    weightKg: w.kg,
    weightSource: w.source,
    targetWeightKg: num(user?.targetWeightKg),
    heightCm: num(user?.heightCm) || num(metrics.height),
    age: num(user?.age),
    gender: typeof user?.gender === 'string' && user.gender ? user.gender : null,
    activityLevel: typeof metrics.activityLevel === 'string' ? metrics.activityLevel : null,
    fitnessLevel: user?.fitnessLevel || null,
    goalIds: getGoalIds(user),
    injuries: asList(metrics.injuries),
    daysPerWeek: Number.isFinite(days) && days > 0 && days <= 7 ? days : null,
    sessionLength: typeof prefs.preferredDuration === 'string' ? prefs.preferredDuration : null,
    timeOfDay: typeof prefs.preferredTimeOfDay === 'string' ? prefs.preferredTimeOfDay : null,
    bodyFatPercent: latestBodyFat(scans),
    diet,
  };
}

/** Flat string for the nutrition function, e.g. "keto; allergies: peanuts; avoids: pork". */
export function nutritionPreferenceText(diet) {
  const d = diet || { dietId: 'no_preference', allergies: [], avoid: [] };
  const parts = [];
  if (d.dietId && d.dietId !== 'no_preference') parts.push(humanize(d.dietId));
  if (d.allergies?.length) parts.push(`allergies (strict): ${d.allergies.map(humanize).join(', ')}`);
  if (d.avoid?.length) parts.push(`avoids: ${d.avoid.map(humanize).join(', ')}`);
  return parts.length ? parts.join('; ') : 'no_preference';
}

/** What the nutrition Cloud Function expects. Only real values are sent. */
export function profileForNutrition(profile) {
  const p = profile || {};
  const out = {};
  if (p.weightKg) out.weightKg = p.weightKg;
  if (p.targetWeightKg) out.targetWeightKg = p.targetWeightKg;
  if (p.heightCm) out.heightCm = p.heightCm;
  if (p.age) out.age = p.age;
  if (p.gender) out.gender = p.gender;
  if (p.activityLevel) out.activityLevel = humanize(p.activityLevel);
  out.nutritionPreference = nutritionPreferenceText(p.diet);
  return out;
}

/** What the workout Cloud Function can use. Only real values are sent. */
export function profileForWorkouts(profile) {
  const p = profile || {};
  const out = {};
  if (p.injuries?.length) out.injuries = p.injuries.map((id) => INJURY_LABELS[id] || humanize(id));
  if (p.weightKg) out.weightKg = p.weightKg;
  if (p.targetWeightKg) out.targetWeightKg = p.targetWeightKg;
  if (p.age) out.age = p.age;
  if (p.gender) out.gender = p.gender;
  if (p.activityLevel) out.activityLevel = humanize(p.activityLevel);
  if (p.daysPerWeek) out.daysPerWeek = p.daysPerWeek;
  if (p.sessionLength) out.sessionLength = p.sessionLength;
  if (p.timeOfDay) out.timeOfDay = p.timeOfDay;
  if (p.bodyFatPercent) out.bodyFatPercent = p.bodyFatPercent;
  return out;
}

/** Calories and macros eaten on one local date key (YYYY-MM-DD) or the UTC key the nutrition store uses. */
export function dayTotals(meals, dateKeys) {
  const keys = Array.isArray(dateKeys) ? dateKeys : [dateKeys];
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, foods: 0 };
  (meals || []).forEach((m) => {
    if (!keys.includes(m?.date)) return;
    (m.foods || []).forEach((f) => {
      totals.calories += Number(f?.calories) || 0;
      totals.protein += Number(f?.protein) || 0;
      totals.carbs += Number(f?.carbs) || 0;
      totals.fat += Number(f?.fat) || 0;
      totals.foods += 1;
    });
  });
  ['calories', 'protein', 'carbs', 'fat'].forEach((k) => { totals[k] = Math.round(totals[k]); });
  return totals;
}

const kgToLb = (kg) => Math.round(kg * 2.20462);

/**
 * The system message that gives the coach the person's whole picture.
 * Returns null when there is nothing to say.
 */
export function buildSnapshotMessage({
  profile, weightLogs = [], goals = [], nutrition = null, upcoming = [], now = new Date(),
} = {}) {
  const p = profile || {};
  const lines = [];

  const body = [];
  if (p.weightKg) body.push(`weight ${kgToLb(p.weightKg)} lb (${p.weightKg} kg, from ${p.weightSource})`);
  if (p.targetWeightKg) body.push(`target weight ${kgToLb(p.targetWeightKg)} lb`);
  if (p.heightCm) body.push(`height ${p.heightCm} cm`);
  if (p.age) body.push(`age ${p.age}`);
  if (p.gender) body.push(`gender ${p.gender}`);
  if (p.bodyFatPercent) body.push(`latest scan body fat ${p.bodyFatPercent}%`);
  if (body.length) lines.push(`Body: ${body.join(', ')}.`);

  const trend = weightTrend(weightLogs, { now });
  if (trend) {
    const lb = Math.round(Math.abs(trend.changeKg) * 2.20462 * 10) / 10;
    const dir = lb === 0 ? 'unchanged' : `${trend.changeKg > 0 ? 'up' : 'down'} ${lb} lb`;
    lines.push(`Weight trend over ${trend.days} days (${trend.entries} logs): ${dir}.`);
  }

  const habits = [];
  if (p.activityLevel) habits.push(`activity level ${humanize(p.activityLevel)}`);
  if (p.daysPerWeek) habits.push(`wants to train ${p.daysPerWeek} days a week`);
  if (p.sessionLength) habits.push(`sessions about ${p.sessionLength}`);
  if (p.timeOfDay) habits.push(`prefers ${String(p.timeOfDay).toLowerCase()} workouts`);
  if (habits.length) lines.push(`Training habits: ${habits.join(', ')}.`);

  const open = (goals || []).filter((g) => g && !g.completed && g.title);
  if (open.length) {
    const txt = open.slice(0, 6).map((g) => {
      const prog = Number.isFinite(g.target) ? ` (${g.current ?? 0}/${g.target}${g.unit ? ` ${g.unit}` : ''}${g.deadline ? `, by ${g.deadline}` : ''})` : '';
      return `${g.title}${prog}`;
    }).join('; ');
    lines.push(`Active goals in the app: ${txt}.`);
  }

  if (nutrition) {
    const g = nutrition.dailyGoals || {};
    if (g.calories) {
      lines.push(`Daily nutrition targets: ${g.calories} kcal, ${g.protein || '?'}g protein, ${g.carbs || '?'}g carbs, ${g.fat || '?'}g fat.`);
    }
    const t = nutrition.today;
    if (t && t.foods > 0) {
      lines.push(`Eaten so far today: ${t.calories} kcal, ${t.protein}g protein, ${t.carbs}g carbs, ${t.fat}g fat.`);
    }
  }

  if (upcoming && upcoming.length) {
    lines.push(`Already on their calendar: ${upcoming.slice(0, 6).map((e) => `${e.title} (${e.when})`).join('; ')}. Do not double-book these times.`);
  }

  if (!lines.length) return null;
  const header = 'More about this user, from their real app data. Use it to personalise plans (pick exercises that fit their injuries, set calories and protein from their weight and goal, fit sessions to their schedule). Only cite numbers listed here.';
  return { role: 'system', content: [header, ...lines].join(' ') };
}

// lib/homeWidgetData.js
//
// What the newer Home widgets say, as plain functions: no React, no Firebase, no phone features, so each rule is unit tested.
// The widgets (components/StreakWidget.jsx, NextUpWidget.jsx, BattlePassWidget.jsx, TrainingLoadWidget.jsx, MusclesWidget.jsx) only
// draw what these return.
import { dateLabel, upcomingOccurrences } from './calendarEvents';
import { formatTime } from './scheduleUtils';
import { localDateKey, shiftDateKey } from './localDate';
import { missionsDone } from './battlePassMissions';
import { LEVEL_CAP, levelFromXp, xpRequiredForLevel } from './xpRules';

/** The line under the streak number: "days in a row", or a nudge when there is no streak to count. */
export function streakCaption(current) {
  const n = Number(current);
  if (!Number.isFinite(n) || n < 1) return 'Train today to start one';
  return n === 1 ? 'day in a row' : 'days in a row';
}

/** The streak as a sentence, for a screen reader. */
export function streakSentence(current) {
  const n = Number(current);
  if (!Number.isFinite(n) || n < 1) return 'no streak yet';
  return n === 1 ? '1 day in a row' : `${n} days in a row`;
}

/**
 * The next thing on the calendar, ready to draw: { key, title, kind, date ("YYYY-MM-DD"), when }, or null when nothing is coming
 * up. `when` is the day ("Today", "Tomorrow", or "Wed, Oct 21"), a middle dot and the time: Today, 6:30 PM. It is the same "coming
 * up" the Calendar screen lists: one that started in the last hour still counts, and one that is ticked off does not.
 */
export function nextUpSummary(events, now = new Date()) {
  const [next] = upcomingOccurrences(events, now, 1);
  if (!next) return null;
  const today = localDateKey(now);
  const day = next.date === today ? 'Today' : next.date === shiftDateKey(today, 1) ? 'Tomorrow' : dateLabel(next.date);
  return { key: next.key, title: next.title, kind: next.kind, date: next.date, when: `${day} \u00B7 ${formatTime(next.start)}` };
}

/**
 * Where the person is in the Battle Pass, ready to draw. `level` and `totalExp` are the XP store's own; `dailyMissions` is
 * buildMissions(...).daily (lib/battlePassMissions.js). The bar is the same one the Battle Pass screen draws: the XP earned since
 * this level began, out of what the next level asks. Returns { level, value, pct, atCap, missionsDone, missionsTotal, caption, sentence }.
 */
export function battlePassSummary({ level, totalExp, dailyMissions } = {}) {
  const xp = Number.isFinite(Number(totalExp)) ? Number(totalExp) : 0;
  const lv = Number.isFinite(Number(level)) && Number(level) >= 1 ? Math.min(LEVEL_CAP, Math.floor(Number(level))) : levelFromXp(xp);
  const atCap = lv >= LEVEL_CAP;
  const floor = xpRequiredForLevel(lv);
  const span = Math.max(1, xpRequiredForLevel(lv + 1) - floor);
  const into = Math.max(0, xp - floor);
  const pct = atCap ? 100 : Math.min(100, (into / span) * 100);
  const { done, total } = missionsDone(dailyMissions);
  const caption = total === 0 ? 'Open the Battle Pass' : done >= total ? 'All missions done' : `${done}/${total} missions today`;
  const levelPart = atCap
    ? `level ${lv}, the highest level`
    : `level ${lv}, ${Math.floor(into)} of ${Math.round(span)} XP toward level ${lv + 1}`;
  const missionPart = total === 0 ? '' : `, ${done} of ${total} daily missions done`;
  return { level: lv, value: `Lv ${lv}`, pct, atCap, missionsDone: done, missionsTotal: total, caption, sentence: `Battle Pass: ${levelPart}${missionPart}` };
}

// The Training Load card on the Health screen says these zones in a sentence each; a Home card has room for a few words.
const LOAD_ZONES = ['detraining', 'sweet_spot', 'elevated', 'high', 'insufficient_data'];
const LOAD_CAPTION = {
  detraining: 'Below usual',
  sweet_spot: 'In your range',
  elevated: 'Above usual',
  high: 'Well above usual',
  insufficient_data: 'Needs more history',
};

/**
 * The training load (calculateTrainingLoad's answer, lib/trainingLoad.js) as one number and a few words:
 * { zone, value ("1.05", or a dash when there is not enough history), caption, markerPct (0 to 100 along a 0 to 2 scale, or null), sentence }.
 * Anything that is not a reading with a number in it says there is not enough history, rather than showing a number that is not there.
 */
export function trainingLoadSummary(load) {
  const ratio = load && Number.isFinite(load.ratio) ? load.ratio : null;
  const zone = ratio !== null && LOAD_ZONES.includes(load.zone) ? load.zone : 'insufficient_data';
  const has = zone !== 'insufficient_data';
  const value = has ? ratio.toFixed(2) : '\u2014';
  return {
    zone,
    value,
    caption: LOAD_CAPTION[zone],
    markerPct: has ? Math.min(100, Math.max(0, (ratio / 2) * 100)) : null,
    sentence: has ? `Training load ${value}, ${LOAD_CAPTION[zone].toLowerCase()}` : 'Training load: not enough history yet',
  };
}

/**
 * What muscle fatigue (lib/muscleFatigue.js) is told about how rested the person is, from what the health store holds: the wearable's
 * recovery when it has a heart-rate-variability or sleep reading, otherwise the sleep the person logged, otherwise nothing (undefined).
 * It is the rule the Health screen uses, so the card on Home ranks the muscles the way the Health screen's heatmap does.
 */
export function recoveryInputs(rookRecovery, sleep) {
  if (rookRecovery && (rookRecovery.hrv != null || rookRecovery.sleepHours != null)) {
    const eff = rookRecovery.sleepEfficiency;
    return {
      hrv: rookRecovery.hrv,
      sleepHours: rookRecovery.sleepHours,
      sleepQuality: eff != null ? (eff >= 85 ? 'good' : eff >= 60 ? 'fair' : 'poor') : undefined,
    };
  }
  if (sleep && sleep.hours) return { sleepHours: sleep.hours, sleepQuality: sleep.quality };
  return undefined;
}

/** A muscle's name for a card: "upper_back" is "Upper back". */
export function muscleLabel(key) {
  const text = String(key == null ? '' : key).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

/**
 * The most worked muscles, most first, from calculateMuscleFatigue's answer ({ muscle: 0 to 100 }): [{ muscle, label, intensity }].
 * A muscle with nothing on it is left out. Equal ones come in alphabetical order, so the card does not reshuffle between draws.
 */
export function topMuscles(fatigue, count = 3) {
  if (!fatigue || typeof fatigue !== 'object') return [];
  return Object.entries(fatigue)
    .filter(([name, v]) => name && Number.isFinite(v) && v > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, count)
    .map(([name, v]) => ({ muscle: name, label: muscleLabel(name), intensity: v }));
}

/** The most worked muscles as a sentence, for a screen reader. */
export function musclesSentence(top) {
  const list = Array.isArray(top) ? top : [];
  return list.length ? `Muscles, last 5 days: most worked are ${list.map((m) => m.label).join(', ')}` : 'Muscles: no recent load in the last 5 days';
}

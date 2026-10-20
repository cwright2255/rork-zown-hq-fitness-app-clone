// lib/battlePassMissions.js
//
// The Battle Pass missions and how far the person is through them. The Battle Pass screen (app/battlepass.jsx) and the Battle Pass
// card on Home (components/BattlePassWidget.jsx) both read them from here, so the two can never disagree about what is done.
// Pure functions: no React, no stores, no Firebase.
import { sessionsOf, countOnDay, countSince } from './activity';
import { localDateKey } from './localDate';

export const DAILY_STEPS_TARGET = 5000;

/** Local midnight on the Monday that starts the week a date is in. */
export function getMonday(date) {
  const d = new Date(date);
  const dayNum = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNum);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The missions: { daily: [...], weekly: [...] }, each { title, xp, current, target, unit? }.
 * A workout, a run or a hike each count as a workout for the two workout missions; the 10 km mission is runs only.
 * `mealsToday` is the food diary's meals for today; one with no foods in it is not counted as logged. `steps` is the health store's
 * count and `stepsDate` the day it was counted ("YYYY-MM-DD"): a count from another day is not today's, so it is not counted.
 */
export function buildMissions({ completedWorkouts, runs, completedHikes, steps, stepsDate, mealsToday, now = new Date() } = {}) {
  const todayKey = localDateKey(now);
  const monday = getMonday(now);
  const isThisWeek = (d) => d && new Date(d) >= monday;

  const sessions = sessionsOf({ workouts: completedWorkouts, runs, hikes: completedHikes });
  const todayWorkouts = countOnDay(sessions, todayKey);
  const todayMealsLogged = (mealsToday || []).filter((m) => m.foods?.length > 0).length;
  const weekRunKm = (runs || []).filter((r) => isThisWeek(r.startTime)).reduce((sum, r) => sum + (r.distance || 0), 0);
  const weekWorkouts = countSince(sessions, monday.getTime());
  const stepsToday = stepsDate === todayKey && Number.isFinite(Number(steps)) ? Number(steps) : 0;

  return {
    daily: [
      { title: 'Complete 1 workout', xp: 50, current: todayWorkouts, target: 1 },
      { title: 'Log 3 meals', xp: 30, current: todayMealsLogged, target: 3 },
      { title: 'Walk 5,000 steps', xp: 40, current: stepsToday, target: DAILY_STEPS_TARGET },
    ],
    weekly: [
      { title: 'Run 10km this week', xp: 200, current: Math.round(weekRunKm * 10) / 10, target: 10, unit: 'km' },
      { title: 'Complete 5 workouts', xp: 300, current: weekWorkouts, target: 5 },
    ],
  };
}

/** How many of a list of missions are done (their progress has reached the target): { done, total }. */
export function missionsDone(missions) {
  const list = Array.isArray(missions) ? missions : [];
  return { done: list.filter((m) => m && Number(m.current) >= Number(m.target)).length, total: list.length };
}

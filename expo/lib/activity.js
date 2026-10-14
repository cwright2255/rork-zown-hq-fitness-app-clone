// lib/activity.js
//
// A person trains in three ways, and the app keeps three lists: completed workouts (store/workoutStore.js), runs
// and walks (store/runningStore.js) and hikes (store/hikingStore.js). Anything that asks "did they train today?",
// "how many sessions fall in this challenge?" or "how many days in a row?" has to look at all three, or a person
// who only runs sees a streak of 0 and a challenge that never moves. This file turns the three lists into one list
// of sessions that those questions can be answered from.
//
// A session is { kind: 'workout' | 'run' | 'hike', ms, dayKey }:
//   ms      when it finished, in milliseconds (what a challenge window is compared against)
//   dayKey  the person's own calendar day for it, "YYYY-MM-DD" (lib/localDate.js), so a 9 PM run is today's
// A record with no usable time cannot be placed on a day and is left out. Pure functions, no stores.
import { dayKeyOf, localDateKey, parseDateKey, shiftDateKey } from './localDate';

// Where each kind of record keeps the time it finished.
const WORKOUT_TIME = (w) => w.completedAt || w.date || w.timestamp;
const RUN_TIME = (r) => r.endTime || r.startTime;
const HIKE_TIME = (h) => h.completedAt || h.startTime;

function toMs(value) {
  if (value == null || value === '' || typeof value === 'boolean') return NaN;
  if (typeof value.toDate === 'function') return value.toDate().getTime(); // Firestore Timestamp
  return new Date(value).getTime();
}

/**
 * All the sessions in the three lists, in the order given (workouts, then runs, then hikes). Any list may be
 * missing, and any record in it may be null or malformed.
 */
export function sessionsOf({ workouts, runs, hikes } = {}) {
  const out = [];
  const add = (kind, list, timeOf) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const raw = timeOf(item);
      const dayKey = dayKeyOf(raw);
      const ms = toMs(raw);
      if (!dayKey || !Number.isFinite(ms)) continue;
      out.push({ kind, ms, dayKey });
    }
  };
  add('workout', workouts, WORKOUT_TIME);
  add('run', runs, RUN_TIME);
  add('hike', hikes, HIKE_TIME);
  return out;
}

/** The sessions that finished between two moments, both ends included (milliseconds). */
export function sessionsBetween(sessions, startMs, endMs) {
  return (Array.isArray(sessions) ? sessions : []).filter((s) => s.ms >= startMs && s.ms <= endMs);
}

/** How many sessions fall on one calendar day ("YYYY-MM-DD"). */
export function countOnDay(sessions, dayKey) {
  return (Array.isArray(sessions) ? sessions : []).filter((s) => s.dayKey === dayKey).length;
}

/** How many sessions finished at or after a moment (milliseconds). */
export function countSince(sessions, sinceMs) {
  return (Array.isArray(sessions) ? sessions : []).filter((s) => s.ms >= sinceMs).length;
}

/** How many different calendar days the sessions fall on. */
export function distinctDays(sessions) {
  return new Set((Array.isArray(sessions) ? sessions : []).map((s) => s.dayKey)).size;
}

/** The calendar days that have at least one session, oldest first ("YYYY-MM-DD"). */
export function activeDays(sessions) {
  return Array.from(new Set((Array.isArray(sessions) ? sessions : []).map((s) => s.dayKey))).sort();
}

/**
 * Days in a row with at least one session. `current` is the run ending today, or ending yesterday when nothing
 * has been done yet today (the day is not over, so the streak is still alive); `longest` is the best run ever.
 * Same rules as workoutStore.getWorkoutStreak, but over every kind of session.
 */
export function activityStreak(sessions, todayKey = localDateKey()) {
  const days = Array.from(new Set((Array.isArray(sessions) ? sessions : []).map((s) => s.dayKey)))
    .filter((k) => parseDateKey(k))
    .sort();
  if (days.length === 0) return { current: 0, longest: 0 };
  const have = new Set(days);

  let current = 0;
  const yesterday = shiftDateKey(todayKey, -1);
  let cursor = have.has(todayKey) ? todayKey : have.has(yesterday) ? yesterday : null;
  while (cursor && have.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous = null;
  for (const day of days) {
    run = previous !== null && shiftDateKey(previous, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }
  return { current, longest };
}

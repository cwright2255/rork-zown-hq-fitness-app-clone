// lib/scheduleUtils.js
//
// Pure helpers the Calendar screen uses to turn the saved schedule events
// (store/scheduleStore.js, each with an ISO `start`) into what it draws.
// Kept free of React Native so they can be unit tested.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const KIND_LABELS = {
  workout: 'Workout',
  run: 'Running',
  nutrition: 'Nutrition',
  other: 'Event',
};

const toDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function sortEvents(events) {
  return [...(events || [])]
    .filter((e) => e && toDate(e.start))
    .sort((a, b) => toDate(a.start) - toDate(b.start));
}

export function eventsForDay(events, year, month, day) {
  return sortEvents(events).filter((e) => {
    const d = toDate(e.start);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
}

/** Set of day-of-month numbers in the given month that have any event. */
export function daysWithEvents(events, year, month) {
  const days = new Set();
  (events || []).forEach((e) => {
    const d = e && toDate(e.start);
    if (d && d.getFullYear() === year && d.getMonth() === month) days.add(d.getDate());
  });
  return days;
}

/** The next `limit` events starting now or later (earlier today still counts as today until it ends an hour later). */
export function upcomingEvents(events, now = new Date(), limit = 5) {
  const cutoff = now.getTime() - 60 * 60 * 1000;
  return sortEvents(events)
    .filter((e) => toDate(e.start).getTime() >= cutoff)
    .slice(0, limit);
}

export function formatTime(iso) {
  const d = toDate(iso);
  if (!d) return '';
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatShortDate(iso) {
  const d = toDate(iso);
  return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : '';
}

let idCounter = 0;
const defaultId = () => {
  idCounter += 1;
  return `evt-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
};

/**
 * Turns validated coach events (lib/coachActions.js normalizeActions) into
 * the records store/scheduleStore.js keeps. An event that names a workout
 * built in the same plan is linked to it, so tapping it on the calendar can
 * open that workout.
 * @param {Array} events
 * @param {Record<string,string>} workoutIdsByName  lower-cased workout name -> workout id
 */
export function buildEventRecords(events, workoutIdsByName = {}, makeId = defaultId) {
  return (events || []).map((e) => {
    const workoutId = e.workoutName ? workoutIdsByName[e.workoutName.toLowerCase()] : undefined;
    return {
      id: makeId(),
      title: e.title,
      kind: e.kind,
      start: e.start,
      notes: e.notes || '',
      workoutId: workoutId || null,
      notificationId: null,
      source: 'coach',
    };
  });
}

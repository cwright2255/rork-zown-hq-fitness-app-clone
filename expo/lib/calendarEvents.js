// lib/calendarEvents.js
//
// The calendar's events, as plain functions: no React, no Firebase, no phone features, so every rule here is unit tested.
// store/scheduleStore.js keeps the events; app/calendar.jsx draws them; services/calendarReminders.js turns them into
// reminders.
//
// An event is one record, saved once, that can repeat:
//   { id, title, kind: 'workout'|'run'|'nutrition'|'other', start (ISO, the first time it happens), notes,
//     workoutId|null (a workout from My Workouts), repeat: null | { every: 'day'|'week', days?: [0-6], until: 'YYYY-MM-DD'|null },
//     remindMinutes: null | 0 | 10 | 30 | 60 | 1440 (how long before it to remind; null for no reminder),
//     doneDates: ['YYYY-MM-DD'] (days it was ticked off), skipDates: ['YYYY-MM-DD'] (days of a repeat that were removed),
//     source: 'user'|'coach'|'invite', inviteId|null, host: { uid, name }|null (who invited the person), updatedAt }
// An OCCURRENCE is one day of an event: a single event has one, a repeat has one for every day it lands on. Repeats are
// worked out when asked for (occurrencesBetween), never saved one by one, so a daily workout is one record.
//
// Times are the person's own clock: a repeat keeps the same hour and minute on every day, also across the clocks changing.
import { dayKeyOf, localDateKey, parseDateKey, shiftDateKey } from './localDate';
import { newEventId } from './scheduleUtils';
import { weekDays } from './mealPlan';

export const EVENT_KINDS = ['workout', 'run', 'nutrition', 'other'];
export const KIND_CHOICES = [
  { id: 'workout', label: 'Workout' },
  { id: 'run', label: 'Run' },
  { id: 'nutrition', label: 'Meal' },
  { id: 'other', label: 'Other' },
];
const KIND_NAMES = Object.fromEntries(KIND_CHOICES.map((k) => [k.id, k.label]));

export const REMINDER_CHOICES = [
  { minutes: null, label: 'No reminder' },
  { minutes: 0, label: 'At the time' },
  { minutes: 10, label: '10 min before' },
  { minutes: 30, label: '30 min before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];
const REMINDER_MINUTES = REMINDER_CHOICES.map((r) => r.minutes).filter((m) => m !== null);

/** How long a repeat can run, for the "until" choices on the form: no end, or this many weeks from the first day. */
export const REPEAT_END_CHOICES = [
  { weeks: null, label: 'No end' },
  { weeks: 4, label: '4 weeks' },
  { weeks: 8, label: '8 weeks' },
  { weeks: 12, label: '12 weeks' },
];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const MAX_EVENTS = 300;
export const MAX_TITLE = 80;
export const MAX_NOTES = 500;
/** Past days kept: an event older than this (a repeat that ended this long ago) is dropped when the calendar is saved. */
export const KEEP_DAYS = 60;
/** Reminders kept scheduled at once. iOS holds 64 pending notifications for the whole app; the calendar uses at most this many. */
export const MAX_REMINDERS = 30;
const REMINDER_HORIZON_DAYS = 60;
const MAX_DATE_KEYS = 400;
const MAX_SPAN_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCES = ['user', 'coach', 'invite'];

const failure = (error) => ({ ok: false, error });
const isKey = (k) => typeof k === 'string' && parseDateKey(k) !== null;
const startKeyOf = (event) => localDateKey(new Date(event.start));
const weekdayOfKey = (key) => parseDateKey(key).getDay();

function cleanKeys(list, cutoffKey) {
  if (!Array.isArray(list)) return [];
  const keys = [...new Set(list.filter(isKey))].sort();
  return keys.filter((k) => !cutoffKey || k >= cutoffKey).slice(-MAX_DATE_KEYS);
}

/** A repeat as it is kept, or null when it is not one. A weekly repeat with no days lands on the weekday of the first day. */
export function normalizeRepeat(raw, startKey) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.every !== 'day' && raw.every !== 'week') return null;
  let until = isKey(raw.until) ? raw.until : null;
  if (until && startKey && until < startKey) until = startKey;
  if (raw.every === 'day') return { every: 'day', until };
  let days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
  if (days.length === 0 && startKey) days = [weekdayOfKey(startKey)];
  return { every: 'week', days, until };
}

/** One event as the calendar keeps it, or null when it is not a usable one. Accepts the records saved by older versions of the app. */
export function sanitizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE) : '';
  if (!id || !title) return null;
  const startDate = new Date(raw.start);
  if (Number.isNaN(startDate.getTime())) return null;
  const start = startDate.toISOString();
  const startKey = localDateKey(startDate);

  // Records from before reminders could be chosen had a notification id when a reminder had been set, and that was at the time.
  let remindMinutes = null;
  if (REMINDER_MINUTES.includes(raw.remindMinutes)) remindMinutes = raw.remindMinutes;
  else if (raw.remindMinutes === undefined && raw.notificationId) remindMinutes = 0;

  const host = raw.host && typeof raw.host === 'object' && typeof raw.host.uid === 'string' && raw.host.uid
    ? { uid: raw.host.uid, name: String(raw.host.name || '').slice(0, 60) }
    : null;

  return {
    id,
    title,
    kind: EVENT_KINDS.includes(raw.kind) ? raw.kind : 'other',
    start,
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, MAX_NOTES) : '',
    workoutId: typeof raw.workoutId === 'string' && raw.workoutId ? raw.workoutId : null,
    repeat: normalizeRepeat(raw.repeat, startKey),
    remindMinutes,
    doneDates: cleanKeys(raw.doneDates),
    skipDates: cleanKeys(raw.skipDates),
    source: SOURCES.includes(raw.source) ? raw.source : 'user',
    inviteId: typeof raw.inviteId === 'string' && raw.inviteId ? raw.inviteId : null,
    host,
    updatedAt: typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : start,
  };
}

/** The usable events of a list, each once (the first with an id wins). */
export function sanitizeEvents(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  list.forEach((raw) => {
    const event = sanitizeEvent(raw);
    if (!event || seen.has(event.id)) return;
    seen.add(event.id);
    out.push(event);
  });
  return out;
}

/** Drops what is long past (a single event, or a repeat that ended, more than KEEP_DAYS ago) and keeps at most MAX_EVENTS. */
export function pruneEvents(events, now = Date.now()) {
  const cutoffKey = localDateKey(new Date(now - KEEP_DAYS * DAY_MS));
  const kept = sanitizeEvents(events)
    .filter((e) => (e.repeat ? !e.repeat.until || e.repeat.until >= cutoffKey : startKeyOf(e) >= cutoffKey))
    .map((e) => ({ ...e, doneDates: cleanKeys(e.doneDates, cutoffKey), skipDates: cleanKeys(e.skipDates, cutoffKey) }));
  if (kept.length <= MAX_EVENTS) return kept;
  // Over the limit, the repeats and the latest events stay and the oldest single events go.
  const rank = (e) => (e.repeat ? Number.MAX_SAFE_INTEGER : Date.parse(e.start));
  return [...kept].sort((a, b) => rank(b) - rank(a)).slice(0, MAX_EVENTS);
}

/** Two copies of the calendar as one: every event of either, and for an event in both the one changed last (this phone's, if equal). */
export function mergeEvents(local, remote) {
  const mine = sanitizeEvents(local);
  const theirs = sanitizeEvents(remote);
  const remoteById = new Map(theirs.map((e) => [e.id, e]));
  const localIds = new Set(mine.map((e) => e.id));
  const merged = mine.map((e) => {
    const other = remoteById.get(e.id);
    return other && other.updatedAt > e.updatedAt ? other : e;
  });
  theirs.forEach((t) => {
    if (!localIds.has(t.id)) merged.push(t);
  });
  return pruneEvents(merged);
}

/**
 * Checks what the add/edit form holds and makes the event from it.
 * @param {object} form  { title, kind, date: 'YYYY-MM-DD', time: 'HH:mm', notes, workoutId, repeat, remindMinutes, source }
 * @param {object} options  { now, id, previous }  previous is the event being edited: its ticked-off and removed days and its
 *                          invitation carry over, and so does its id
 * @returns {{ ok: true, event: object } | { ok: false, error: string }}
 */
export function buildEvent(form, { now = new Date(), id, previous } = {}) {
  const f = form || {};
  const title = typeof f.title === 'string' ? f.title.trim() : '';
  if (!title) return failure('Give it a title.');
  if (title.length > MAX_TITLE) return failure(`Keep the title under ${MAX_TITLE} characters.`);

  const day = parseDateKey(f.date);
  if (!day) return failure('Pick a real day.');
  const time = /^(\d{1,2}):(\d{2})$/.exec(typeof f.time === 'string' ? f.time : '');
  if (!time || Number(time[1]) > 23 || Number(time[2]) > 59) return failure('Pick a time.');
  const startDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(time[1]), Number(time[2]));
  const startKey = localDateKey(startDate);

  const notes = typeof f.notes === 'string' ? f.notes.trim() : '';
  if (notes.length > MAX_NOTES) return failure(`Keep the notes under ${MAX_NOTES} characters.`);

  let remindMinutes = null;
  if (f.remindMinutes !== null && f.remindMinutes !== undefined) {
    if (!REMINDER_MINUTES.includes(f.remindMinutes)) return failure('Pick one of the reminder times.');
    remindMinutes = f.remindMinutes;
  }

  let repeat = null;
  if (f.repeat) {
    repeat = normalizeRepeat(f.repeat, startKey);
    if (!repeat) return failure('Pick how often it repeats.');
    if (isKey(f.repeat.until) && f.repeat.until < startKey) return failure('The repeat ends before the first day.');
  }

  const kind = EVENT_KINDS.includes(f.kind) ? f.kind : 'other';
  // Ticked-off and removed days belong to the days the event was on; moving its first day starts them over.
  const sameStart = !!previous && startKeyOf(previous) === startKey;
  const event = {
    id: id || (previous && previous.id) || newEventId(),
    title,
    kind,
    start: startDate.toISOString(),
    notes,
    workoutId: kind === 'workout' && typeof f.workoutId === 'string' && f.workoutId ? f.workoutId : null,
    repeat,
    remindMinutes,
    doneDates: sameStart ? cleanKeys(previous.doneDates) : [],
    skipDates: sameStart ? cleanKeys(previous.skipDates) : [],
    source: previous ? previous.source : SOURCES.includes(f.source) ? f.source : 'user',
    inviteId: previous ? previous.inviteId || null : null,
    host: previous ? previous.host || null : null,
    updatedAt: now.toISOString(),
  };
  return { ok: true, event };
}

/** What the form starts with for an event being edited. A repeat keeps its first day, so the day is only changed on a single event. */
export function formFromEvent(event) {
  const d = new Date(event.start);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    title: event.title,
    kind: event.kind,
    date: localDateKey(d),
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    notes: event.notes || '',
    workoutId: event.workoutId || null,
    repeat: event.repeat ? { ...event.repeat } : null,
    remindMinutes: event.remindMinutes === undefined ? null : event.remindMinutes,
  };
}

// ---- days and occurrences ---------------------------------------------------------------------------------------------

/** Whether the event lands on this day (a single event on its day; a repeat on every day it covers, except removed ones). */
export function occursOn(event, key) {
  if (!isKey(key)) return false;
  const startKey = startKeyOf(event);
  if (key < startKey) return false;
  if (Array.isArray(event.skipDates) && event.skipDates.includes(key)) return false;
  const r = event.repeat;
  if (!r) return key === startKey;
  if (r.until && key > r.until) return false;
  if (r.every === 'day') return true;
  return (r.days || []).includes(weekdayOfKey(key));
}

/** The moment the event starts on a given day: the same hour and minute as the first one. */
export function occurrenceStart(event, key) {
  if (key === startKeyOf(event)) return event.start;
  const s = new Date(event.start);
  const d = parseDateKey(key);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.getHours(), s.getMinutes()).toISOString();
}

/**
 * Every occurrence from one day to another, both included, in time order.
 * Each is the event's fields plus { key, eventId, date, start (this day's), recurring, done (ticked off) }.
 */
export function occurrencesBetween(events, fromKey, toKey) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to || toKey < fromKey) return [];
  const out = [];
  sanitizeEvents(events).forEach((event) => {
    const startKey = startKeyOf(event);
    const first = startKey > fromKey ? startKey : fromKey;
    const lastWanted = event.repeat && event.repeat.until && event.repeat.until < toKey ? event.repeat.until : toKey;
    if (lastWanted < first) return;
    let d = parseDateKey(first);
    const end = parseDateKey(lastWanted);
    for (let i = 0; d <= end && i <= MAX_SPAN_DAYS; i += 1) {
      const key = localDateKey(d);
      if (occursOn(event, key)) {
        out.push({
          ...event,
          key: `${event.id}@${key}`,
          eventId: event.id,
          date: key,
          start: occurrenceStart(event, key),
          recurring: !!event.repeat,
          done: event.doneDates.includes(key),
        });
      }
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  });
  return out.sort((a, b) => (a.start === b.start ? a.title.localeCompare(b.title) : a.start < b.start ? -1 : 1));
}

export const occurrencesOn = (events, key) => occurrencesBetween(events, key, key);

/** The next occurrences from now on (one that started in the last hour still counts), leaving out the ones already ticked off. */
export function upcomingOccurrences(events, now = new Date(), limit = 5, horizonDays = 60) {
  const today = localDateKey(now);
  const cutoff = now.getTime() - 60 * 60 * 1000;
  return occurrencesBetween(events, today, shiftDateKey(today, horizonDays))
    .filter((o) => !o.done && Date.parse(o.start) >= cutoff)
    .slice(0, limit);
}

/**
 * The reminders to have scheduled: for each occurrence in the next two months with a reminder set that is not ticked off and
 * whose reminder time is still ahead, when to fire it, soonest first, at most `limit`.
 */
export function reminderPlan(events, now = new Date(), { limit = MAX_REMINDERS } = {}) {
  const today = localDateKey(now);
  const plan = [];
  occurrencesBetween(events, today, shiftDateKey(today, REMINDER_HORIZON_DAYS)).forEach((o) => {
    if (o.remindMinutes === null || o.done) return;
    const fireAt = new Date(Date.parse(o.start) - o.remindMinutes * 60 * 1000);
    if (fireAt.getTime() <= now.getTime()) return;
    plan.push({ key: o.key, eventId: o.eventId, title: o.title, kind: o.kind, minutes: o.remindMinutes, start: o.start, fireAt });
  });
  return plan.sort((a, b) => a.fireAt - b.fireAt).slice(0, limit);
}

// ---- ticking off, removing, tracking ---------------------------------------------------------------------------------

/** The event with a day ticked off (or un-ticked). */
export function withDone(event, key, done, now = new Date()) {
  const rest = event.doneDates.filter((k) => k !== key);
  return { ...event, doneDates: done ? [...rest, key].sort() : rest, updatedAt: now.toISOString() };
}

/** The event with one day of it removed; null when that was all of it (a single event). */
export function withoutOccurrence(event, key, now = new Date()) {
  if (!event.repeat) return null;
  if (!occursOn(event, key)) return event;
  return {
    ...event,
    skipDates: [...new Set([...event.skipDates, key])].sort(),
    doneDates: event.doneDates.filter((k) => k !== key),
    updatedAt: now.toISOString(),
  };
}

/**
 * Where an occurrence stands. Workouts and runs are tracked: done when ticked off, or when a workout, run or hike was logged
 * that day (lib/activity.js, the same days as the streak), and missed when the day has passed and neither happened.
 * Anything else is just done or not.
 * @param {Set<string>|string[]} activeDays  days with a logged workout, run or hike
 */
export function occurrenceStatus(occurrence, activeDays, todayKey) {
  const tracked = occurrence.kind === 'workout' || occurrence.kind === 'run';
  if (!tracked) return { tracked: false, done: !!occurrence.done, missed: false };
  const days = activeDays instanceof Set ? activeDays : new Set(activeDays || []);
  const done = !!occurrence.done || days.has(occurrence.date);
  return { tracked: true, done, missed: !done && occurrence.date < todayKey };
}

/**
 * How the week of workouts and runs is going: of the ones planned Monday to Sunday, how many are done, missed, or still to come.
 * @returns {{ planned, done, missed, remaining, percent, meals }}  meals is the meals on the calendar that week
 */
export function weekSummary(events, anyDayOfWeek, activeDays, todayKey) {
  const days = weekDays(anyDayOfWeek);
  if (days.length === 0) return { planned: 0, done: 0, missed: 0, remaining: 0, percent: 0, meals: 0 };
  const occurrences = occurrencesBetween(events, days[0], days[6]);
  let planned = 0;
  let done = 0;
  let missed = 0;
  let meals = 0;
  occurrences.forEach((o) => {
    if (o.kind === 'nutrition') meals += 1;
    const status = occurrenceStatus(o, activeDays, todayKey);
    if (!status.tracked) return;
    planned += 1;
    if (status.done) done += 1;
    else if (status.missed) missed += 1;
  });
  return { planned, done, missed, remaining: planned - done - missed, percent: planned ? Math.round((done / planned) * 100) : 0, meals };
}

/** Goals that have a deadline, for the calendar: { id, title, date, current, target, unit, percent, overdue }, soonest first. Done goals are left out. */
export function goalMarkers(goals, todayKey = localDateKey()) {
  return (Array.isArray(goals) ? goals : [])
    .map((g) => {
      if (!g || g.completed) return null;
      const date = dayKeyOf(g.deadline);
      if (!date) return null;
      const current = Number.isFinite(Number(g.current)) ? Number(g.current) : 0;
      const target = Number.isFinite(Number(g.target)) ? Number(g.target) : 0;
      const percent = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
      return { id: g.id, title: String(g.title || 'Goal'), date, current, target, unit: g.unit || '', percent, overdue: date < todayKey };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * What to put under each day of a month grid: for each day of the month with anything on it, which kinds of thing.
 * @returns {Map<number, { workout: boolean, meal: boolean, goal: boolean, other: boolean }>} keyed by day of the month
 */
export function dayMarks({ events, mealDates, goals }, year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const fromKey = `${year}-${pad(month + 1)}-01`;
  const toKey = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;
  const marks = new Map();
  const mark = (key, what) => {
    const day = Number(key.slice(8, 10));
    const m = marks.get(day) || { workout: false, meal: false, goal: false, other: false };
    m[what] = true;
    marks.set(day, m);
  };
  occurrencesBetween(events, fromKey, toKey).forEach((o) => {
    mark(o.date, o.kind === 'workout' || o.kind === 'run' ? 'workout' : o.kind === 'nutrition' ? 'meal' : 'other');
  });
  (mealDates || []).forEach((key) => { if (key >= fromKey && key <= toKey) mark(key, 'meal'); });
  (goals || []).forEach((g) => { if (g.date >= fromKey && g.date <= toKey) mark(g.date, 'goal'); });
  return marks;
}

// ---- words ---------------------------------------------------------------------------------------------------------------

export const kindLabel = (kind) => KIND_NAMES[kind] || 'Event';

/** "Every day", "Every week on Mon, Wed", each with " until Dec 1" when it ends; '' for no repeat. */
export function describeRepeat(repeat) {
  if (!repeat) return '';
  const base = repeat.every === 'day'
    ? 'Every day'
    : `Every week on ${(repeat.days || []).map((d) => WEEKDAY_SHORT[d]).join(', ')}`;
  if (!repeat.until) return base;
  const d = parseDateKey(repeat.until);
  return `${base} until ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function describeReminder(minutes) {
  const choice = REMINDER_CHOICES.find((r) => r.minutes === minutes);
  return choice ? choice.label : '';
}

const clockFromParts = (h, m) => `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
const clockOf = (iso) => {
  const d = new Date(iso);
  return clockFromParts(d.getHours(), d.getMinutes());
};

/** "7:05 AM" for a time like "07:05" (what the form holds); '' when it is not a time. */
export function clockLabel(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof time === 'string' ? time : '');
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  return clockFromParts(Number(m[1]), Number(m[2]));
}

/** The time `minutes` later (or earlier, if negative) on the same clock, wrapping round midnight: "23:30" + 60 = "00:30". */
export function shiftTime(time, minutes) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof time === 'string' ? time : '');
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return time;
  const total = (((Number(m[1]) * 60 + Number(m[2]) + Math.round(Number(minutes) || 0)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "Oct 21" for a day ("YYYY-MM-DD"); '' when it is not one. */
export function monthDay(key) {
  const d = parseDateKey(key);
  return d ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : '';
}

/** "Wed, Oct 21" for a day; '' when it is not one. */
export function dateLabel(key) {
  const d = parseDateKey(key);
  return d ? `${WEEKDAY_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : '';
}

/** The words of a reminder: { title, body }. At the time it says it is time; before, it says when the event starts. */
export function reminderContent({ title, kind, minutes, start }) {
  if (!minutes) {
    const headings = { workout: 'Workout time', run: 'Run time', nutrition: 'Meal time' };
    return { title: headings[kind] || 'Reminder', body: title };
  }
  const lead = minutes === 1440 ? 'Tomorrow' : minutes === 60 ? 'In 1 hour' : `In ${minutes} min`;
  const when = minutes === 1440 ? ` at ${clockOf(start)}` : '';
  return { title: `${lead}${when}`, body: minutes === 1440 ? title : `${title} at ${clockOf(start)}` };
}

/** The last day of a repeat that runs `weeks` weeks from the first day (null for no end). */
export function repeatEndKey(startKey, weeks) {
  return weeks ? shiftDateKey(startKey, weeks * 7 - 1) : null;
}

/** Which of the "ends after" choices (REPEAT_END_CHOICES, in weeks) a repeat's last day is, or undefined when it is none of them (or the repeat has no end: null). */
export function endsWeeksOf(repeat, startKey) {
  if (!repeat) return undefined;
  if (!repeat.until) return null;
  const match = REPEAT_END_CHOICES.find((c) => c.weeks && repeatEndKey(startKey, c.weeks) === repeat.until);
  return match ? match.weeks : undefined;
}

/**
 * The form with its day moved. A repeat that ends after a number of weeks, or that is on just the weekday of the old day, follows
 * the move; one that was set some other way is kept, except that it can not end before its first day.
 */
export function moveFormDate(form, date) {
  const target = parseDateKey(date);
  if (!target) return form;
  const old = parseDateKey(form.date);
  const r = form.repeat;
  if (!r) return { ...form, date };
  const weeks = endsWeeksOf(r, form.date);
  let until = r.until;
  if (weeks) until = repeatEndKey(date, weeks);
  else if (until && until < date) until = date;
  let days = r.days;
  if (r.every === 'week' && old && Array.isArray(days) && days.length === 1 && days[0] === old.getDay()) days = [target.getDay()];
  return { ...form, date, repeat: r.every === 'week' ? { ...r, days, until } : { ...r, until } };
}

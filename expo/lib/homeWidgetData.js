// lib/homeWidgetData.js
//
// What the newer Home widgets say, as plain functions: no React, no Firebase, no phone features, so each rule is unit tested.
// The widgets (components/StreakWidget.jsx, NextUpWidget.jsx) only draw what these return.
import { dateLabel, upcomingOccurrences } from './calendarEvents';
import { formatTime } from './scheduleUtils';
import { localDateKey, shiftDateKey } from './localDate';

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

// Which day, week, month and season a challenge belongs to, and the id its document has.
//
// This file is used by the app (store/challengeStore.js) and by the Cloud Function that creates the challenges
// (functions/src/challengePeriods.js, a copy). A deployed function cannot import from the app, so the two files have to be the same
// file; __tests__/challengePeriodsParity.test.js fails if they ever differ. Use nothing from outside this file.
//
// Periods are cut at midnight in New York, the same cut the AI daily limits use (aiDayKey in entitlements.js), not at midnight UTC.
// At 8 PM Eastern it is already tomorrow in UTC, which used to start a new "day" for the daily challenge in the evening.
//
// - A week runs Monday to Sunday, a month is a calendar month, and a season is a meteorological one (Northern Hemisphere:
//   Winter is Dec-Feb, Spring Mar-May, Summer Jun-Aug, Fall Sep-Nov).
// - start is the first instant of the period and end its last millisecond, both in Eastern time, so a period that holds a clock
//   change is an hour longer or shorter than the hours on the clock say.
// - challengeDocId gives one fixed document id for a cadence and period, so creating the same challenge twice (two people opening
//   Challenges at the same moment on a new day) writes one document, not two.
// - Where the runtime has no time zone data, New York time falls back to UTC, as aiDayKey does.

export const CADENCES = ['daily', 'weekly', 'monthly', 'seasonal'];

export const CHALLENGE_TIME_ZONE = 'America/New_York';

const DAY_MS = 24 * 60 * 60 * 1000;

let formatter = null;

// The year, month (1-12), day, hour, minute and second on the clock in New York at the given instant.
function clockAt(ms) {
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: CHALLENGE_TIME_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  }
  const clock = {};
  formatter.formatToParts(new Date(ms)).forEach((part) => {
    if (part.type !== 'literal') clock[part.type] = Number(part.value);
  });
  clock.hour %= 24;
  return clock;
}

// How far the clock in New York is ahead of UTC at the given instant, in milliseconds (negative: -5 hours in winter, -4 in summer).
function offsetAt(ms) {
  try {
    const whole = Math.floor(ms / 1000) * 1000;
    const c = clockAt(whole);
    return Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second) - whole;
  } catch {
    return 0;
  }
}

/** The calendar date it is in New York at the given instant: { year, month (1-12), day }. */
export function easternDate(now = new Date()) {
  const ms = now.getTime();
  try {
    const c = clockAt(ms);
    return { year: c.year, month: c.month, day: c.day };
  } catch {
    const d = new Date(ms);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
}

/** The instant midnight starts the given date in New York. Month is 1-12; a day or month past its end rolls into the next one. */
export function easternMidnight(year, month, day) {
  const wall = Date.UTC(year, month - 1, day);
  // The offset is looked up twice: the first guess can sit on the other side of a clock change from the answer.
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
}

const two = (n) => String(n).padStart(2, '0');
const dateKey = (ms) => {
  const d = new Date(ms);
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`;
};
const lastMs = (nextStart) => new Date(nextStart.getTime() - 1);

export function getDayBounds(now = new Date()) {
  const { year, month, day } = easternDate(now);
  return {
    periodKey: `day-${dateKey(Date.UTC(year, month - 1, day))}`,
    start: easternMidnight(year, month, day),
    end: lastMs(easternMidnight(year, month, day + 1)),
  };
}

export function getWeekBounds(now = new Date()) {
  const { year, month, day } = easternDate(now);
  const dayNum = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const monday = new Date(Date.UTC(year, month - 1, day - dayNum));
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  return {
    periodKey: `week-${dateKey(monday.getTime())}`,
    start: easternMidnight(y, m, d),
    end: lastMs(easternMidnight(y, m, d + 7)),
  };
}

export function getMonthBounds(now = new Date()) {
  const { year, month } = easternDate(now);
  return {
    periodKey: `month-${String(year).padStart(4, '0')}-${two(month)}`,
    start: easternMidnight(year, month, 1),
    end: lastMs(easternMidnight(year, month + 1, 1)),
  };
}

export function getSeasonBounds(now = new Date()) {
  const { year, month } = easternDate(now); // month 1-12
  let seasonName;
  let startYear = year;
  let startMonth;
  if (month === 12) {
    seasonName = 'winter'; startMonth = 12;
  } else if (month <= 2) {
    seasonName = 'winter'; startYear = year - 1; startMonth = 12;
  } else if (month <= 5) {
    seasonName = 'spring'; startMonth = 3;
  } else if (month <= 8) {
    seasonName = 'summer'; startMonth = 6;
  } else {
    seasonName = 'fall'; startMonth = 9;
  }
  return {
    periodKey: `season-${seasonName}-${startYear}`,
    start: easternMidnight(startYear, startMonth, 1),
    end: lastMs(easternMidnight(startYear, startMonth + 3, 1)),
    seasonName,
  };
}

/** The period the given cadence is in at the given instant: { periodKey, start, end }, or null for a cadence that is not known. */
export function getPeriod(cadence, now = new Date()) {
  if (cadence === 'daily') return getDayBounds(now);
  if (cadence === 'weekly') return getWeekBounds(now);
  if (cadence === 'monthly') return getMonthBounds(now);
  if (cadence === 'seasonal') return getSeasonBounds(now);
  return null;
}

export function getCurrentPeriodKey(cadence, now = new Date()) {
  const period = getPeriod(cadence, now);
  return period ? period.periodKey : null;
}

/** The fixed document id of the challenge for a cadence and period, for example daily_day-2026-11-02. */
export function challengeDocId(cadence, periodKey) {
  return `${cadence}_${periodKey}`;
}

/** Whole days from the given instant to the end of the period (at least 1), for telling the AI how long a season has left. */
export function daysLeft(period, now = new Date()) {
  return Math.max(1, Math.round((period.end.getTime() - now.getTime()) / DAY_MS));
}

// lib/ageGate.js
//
// The date of birth asked for in onboarding (app/onboarding.jsx, step 2) and the minimum age to use the app.
//
// - MIN_AGE is 13. (Whether the app needs a higher one where a person lives is a question for a lawyer; this is the one number to change.)
// - The date is typed as year-month-day. 1995-04-12, 1995/4/12 and 1995.04.12 all mean the same day; anything else is refused with a reason.
// - A birthday that has not come round yet this year does not count as a year: someone turning 13 tomorrow is 12 today.
// - "Today" is the calendar day on the phone (local time), because a birthday is a day on the person's own calendar, not an instant.
// - Nothing in here throws, and nothing guesses: an empty or unreadable date is "blank" or "format", never a made-up default.

export const MIN_AGE = 13;
export const MAX_AGE = 120;

const DATE_PATTERN = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;

const pad = (n) => String(n).padStart(2, '0');

/** Whole years between a birth date (year, month 1-12, day) and the calendar day of `today`. */
export function ageOn(year, month, day, today = new Date()) {
  let years = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) years -= 1;
  return years;
}

/**
 * Checks what was typed into the date of birth box.
 * @param {string} text
 * @param {Date} [today]
 * @returns {{ ok: true, iso: string, age: number }
 *         | { ok: false, reason: 'blank'|'format'|'impossible'|'future'|'too_old'|'under_age', age?: number }}
 *   iso is the date as YYYY-MM-DD. For 'under_age' the age is given too (0 to 12).
 */
export function checkDateOfBirth(text, today = new Date()) {
  const typed = typeof text === 'string' ? text.trim() : '';
  if (!typed) return { ok: false, reason: 'blank' };

  const match = DATE_PATTERN.exec(typed);
  if (!match) return { ok: false, reason: 'format' };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // A real calendar day: 31 February is not one, and neither is month 13. Built in UTC so the check is not moved by a time zone.
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (month < 1 || month > 12 || day < 1
    || asDate.getUTCFullYear() !== year || asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day) {
    return { ok: false, reason: 'impossible' };
  }

  const age = ageOn(year, month, day, today);
  if (age < 0) return { ok: false, reason: 'future' };
  if (age > MAX_AGE) return { ok: false, reason: 'too_old' };
  if (age < MIN_AGE) return { ok: false, reason: 'under_age', age };

  return { ok: true, iso: `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`, age };
}

/** The sentence shown under the box for a refused date. under_age has its own screen, so it is not here. */
export function dateOfBirthMessage(reason) {
  switch (reason) {
    case 'blank': return 'Enter your date of birth to continue.';
    case 'format': return 'Enter your date of birth as YYYY-MM-DD, for example 1995-04-12.';
    case 'impossible': return 'That date does not exist. Check the month and the day.';
    case 'future': return 'That date has not happened yet. Check the year.';
    case 'too_old': return 'That year does not look right. Check it and try again.';
    default: return 'Enter your date of birth as YYYY-MM-DD, for example 1995-04-12.';
  }
}

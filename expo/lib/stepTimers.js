// lib/stepTimers.js
//
// Finds the waiting times in a recipe step ("simmer for 10 minutes", "bake 20-25
// min", "rest for an hour and a half") so cooking mode can offer a timer for
// them, and writes a time as a clock or a short label.
//
// A range ("20-25 minutes") gives its lower end: the timer is for checking the
// food, not for taking it out. At most 3 timers come from one step.

import { parseQuantity } from './groceryList';

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45,
};
const WORDS = 'forty-five|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty';
const GLYPHS = '\\u00BC\\u00BD\\u00BE\\u2153\\u2154\\u215B';
const DASHES = '\\u2013\\u2014-';
const NUM = `(?:\\d+\\s*[${GLYPHS}]|[${GLYPHS}]|\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d*\\.\\d+|\\d+|${WORDS})`;
const UNIT = '(hours?|hrs?|minutes?|mins?|seconds?|secs?)';
const SMALL_UNIT = '(minutes?|mins?|seconds?|secs?)';
// 1: "an hour" and the like; 2: the amount, 3: its unit; 4, 5: a second part ("1 hour 30 minutes").
const TIME = `(?:^|[^\\w.])(?:(half an hour|an hour|a minute)|(${NUM})(?:\\s*(?:[${DASHES}]|\\bto\\b)\\s*${NUM})?\\s*${UNIT}(?:\\s*(?:and\\s+|,\\s*)?(${NUM})\\s*${SMALL_UNIT})?)(?![A-Za-z])`;

export const MAX_TIMERS_PER_STEP = 3;
const MAX_SECONDS = 24 * 3600;

const PHRASES = { 'half an hour': 1800, 'an hour': 3600, 'a minute': 60 };

// A written amount as a number; 0 for one that can not be read ("1/0").
function amount(text) {
  const word = WORD_NUMBERS[text.toLowerCase()];
  return word !== undefined ? word : parseQuantity(text) || 0;
}

function perUnit(unit) {
  const c = unit.charAt(0).toLowerCase();
  return c === 'h' ? 3600 : c === 'm' ? 60 : 1;
}

/** "1 hr 30 min", "10 min", "45 sec" */
export function durationLabel(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h && `${h} hr`, m && `${m} min`, s && `${s} sec`].filter(Boolean).join(' ');
}

/** Time left as a clock: 9:05, or 1:30:00 from an hour up. Counts up to the next whole second. */
export function formatClock(seconds) {
  const t = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(t % 60)}` : `${m}:${pad(t % 60)}`;
}

/** The timers a step suggests: [{ seconds, label }], in the order they are written. */
export function findStepTimers(text) {
  if (typeof text !== 'string') return [];
  const found = [];
  const re = new RegExp(TIME, 'gi');
  let m;
  while ((m = re.exec(text)) !== null && found.length < MAX_TIMERS_PER_STEP) {
    let seconds;
    if (m[1]) seconds = PHRASES[m[1].toLowerCase()];
    else {
      const second = m[4] ? amount(m[4]) * perUnit(m[5]) : 0;
      seconds = Math.round(amount(m[2]) * perUnit(m[3]) + second);
    }
    if (seconds > 0 && seconds <= MAX_SECONDS && !found.some((f) => f.seconds === seconds)) {
      found.push({ seconds, label: durationLabel(seconds) });
    }
  }
  return found;
}

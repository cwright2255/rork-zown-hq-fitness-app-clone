// lib/xpRules.js
//
// The rules for XP: the level curve, the level multiplier, and what a CLAIM for XP is worth. Pure functions, no React, no Firebase.
//
// XP used to be worked out on the phone and written to the public leaderboard by the phone, so anyone could write any number
// there. Now the phone only files a claim ("I finished a 5.2 km run today") under the person's own account, and the Cloud Function
// in functions/src/xpLedger.js checks it with the rules below and adds it to a record only the server can write
// (users/{uid}/stats/xp, the ledger). The function also writes the XP, level, streak and distance on the leaderboard. The phone
// still shows XP the moment it is earned, and then follows the ledger.
//
// functions/src/xpRules.js is a COPY of this file, byte for byte (a deployed function cannot import from the app). Change this
// file, copy it over, and __tests__/xpRulesParity.test.js fails when the two differ.
//
// What the server can and cannot know: it cannot see someone move. What it can do is refuse a claim that is impossible (a run
// faster than a person can run, a day over the daily limit, the same food twice in a day, a day that is not today or recent) and
// work out the XP itself rather than trust the number in the claim. A person sending their own requests can still claim activity
// that is plausible, up to the limits below; they cannot write a score.

// ---- the level curve ---------------------------------------------------------------------------------------------------------

export const BASE_LEVEL_XP = 1000;
export const GROWTH_RATE = 1.03;
export const LEVEL_CAP = 100;
/** The most one award can be multiplied by, however high the level. */
export const MAX_MULTIPLIER = 5;
/** The most XP a record can hold. The same limit the leaderboard rules used to enforce. */
export const MAX_TOTAL_XP = 5000000;

/** The total XP needed to reach a level (level 1 needs none). */
export function xpRequiredForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(BASE_LEVEL_XP * (Math.pow(GROWTH_RATE, level - 1) - 1) / (GROWTH_RATE - 1));
}

/** The level a total falls in (1 to LEVEL_CAP). */
export function levelFromXp(total) {
  let level = 1;
  for (let n = 2; n <= LEVEL_CAP; n++) {
    if (total >= xpRequiredForLevel(n)) level = n;
    else break;
  }
  return level;
}

/** What most awards are multiplied by at a level: 3.6% more for each level, up to MAX_MULTIPLIER. */
export function levelMultiplier(level) {
  const baseIncrease = 0.043;
  const baseDecline = 0.007;
  let multiplier = 1.0;
  for (let i = 2; i <= level; i++) {
    multiplier *= 1 + baseIncrease - baseDecline;
  }
  return Math.min(multiplier, MAX_MULTIPLIER);
}

// ---- days ------------------------------------------------------------------------------------------------------------------
// A claim says which day it is for ("YYYY-MM-DD", the person's own calendar day). These work on the key alone, in UTC, so they
// give the same answer on the phone and on the server.

const DAY_MS = 86400000;
const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');

/** Whole days since 1970-01-01 for a "YYYY-MM-DD" key, or null when it is not a real calendar day. */
export function dayNumber(key) {
  const m = DAY_KEY.exec(typeof key === 'string' ? key : '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return Math.round(ms / DAY_MS);
}

/** The "YYYY-MM-DD" key for a day number. */
export function dayKeyOf(number) {
  const d = new Date(number * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The UTC calendar day of a moment (milliseconds), as a key. */
export function utcDayKey(ms) {
  return dayKeyOf(Math.floor(ms / DAY_MS));
}

/** 'w20261005': the Monday that starts the week a day falls in. */
export function weekKeyOf(key) {
  const n = dayNumber(key);
  if (n === null) return null;
  // 1970-01-01 was a Thursday, three days after a Monday.
  const monday = n - ((n + 3) % 7);
  return `w${dayKeyOf(monday).replace(/-/g, '')}`;
}

/** 'm202610': the month a day falls in. */
export function monthKeyOf(key) {
  return dayNumber(key) === null ? null : `m${key.slice(0, 4)}${key.slice(5, 7)}`;
}

/**
 * Days in a row ending at the latest active day, as long as that day is today or yesterday (a day either side is allowed,
 * because the server's "today" is UTC and the person's is not). `activeDays` are keys; `today` is a key.
 */
export function streakFrom(activeDays, today) {
  const todayNumber = dayNumber(today);
  const days = new Set((Array.isArray(activeDays) ? activeDays : []).map(dayNumber).filter((n) => n !== null));
  if (todayNumber === null || days.size === 0) return 0;
  const last = Math.max(...days);
  if (todayNumber - last > 1) return 0;
  let count = 0;
  for (let n = last; days.has(n); n--) count += 1;
  return count;
}

// ---- what a claim can be ---------------------------------------------------------------------------------------------------

/** How far back a claim's day can be (a workout saved on a phone that was offline), and how far ahead (time zones). */
export const MAX_BACKDATE_DAYS = 35;
export const MAX_FUTURE_DAYS = 1;
/** Days of per-day counts kept in the ledger (a little more than the backdate window, so a day is never forgotten while it can still be claimed). */
export const KEEP_DAYS = 40;
export const KEEP_IDS = 60;
export const MAX_ACTIVE_DAYS = 400;

/** The most XP one day can earn: a base amount times the level multiplier, so a new account has a lower limit than a veteran. */
export const DAILY_BASE_CAP = 4000;
export const dailyCap = (level) => Math.round(DAILY_BASE_CAP * levelMultiplier(level));

// What each kind of claim is worth. `perDay` is how many can be paid on one day. `scaled` kinds are multiplied by the level
// multiplier (the same as the phone has always done); water and steps are not. `source` is the line of the XP breakdown that
// counts it. `active` kinds are workouts, runs and hikes: they keep the streak.
export const KINDS = {
  workout: { perDay: 10, scaled: true, source: 'workouts', active: true },
  run: { perDay: 10, scaled: true, source: 'workouts', active: true },
  hike: { perDay: 5, scaled: true, source: null, active: true },
  meal: { perDay: 30, scaled: true, source: 'nutrition' },
  plan: { perDay: 2, scaled: true, source: null },
  advice: { perDay: 2, scaled: true, source: null },
  formcheck: { perDay: 5, scaled: true, source: null },
  journey: { perDay: 2, scaled: true, source: 'workouts' },
  race: { perDay: 2, scaled: true, source: 'workouts' },
  hydration: { perDay: 5, scaled: false, source: null },
  steps: { perDay: 130, scaled: false, source: null },
};
/** Every kind the rules accept, including the one-off import of XP from before the ledger. */
export const CLAIM_KINDS = [...Object.keys(KINDS), 'import'];

export const MAX_WORKOUT_BASE = 3000;
export const MEAL_BASES = [33, 44, 55];
export const PLAN_BASE = 1125;
export const ADVICE_BASE = 375;
export const FORMCHECK_BASE_PER_REP = 40;
export const FORMCHECK_MAX_REPS = 60;
export const JOURNEY_BASES = [500, 1000, 2000];
export const RACE_BASE = 750;
export const HYDRATION_TIER_XP = [0, 11, 22, 33, 44, 55];
export const STEPS_XP_PER_STEP = 0.1;
export const MAX_STEPS_PER_DAY = 60000;
export const ACTIVITY_XP_PER_KM = { run: 30, walk: 18 };
export const HIKE_XP_PER_KM = 40;
export const HIKE_MULTIPLIERS = [1, 1.4, 1.8, 2.2, 2.6];
export const MAX_RUN_KM = 250;
export const MAX_HIKE_KM = 100;
export const MIN_RUN_SECONDS = 10;
/** Faster than this (seconds per km) is not on foot. 2:30 /km is quicker than the 5K world record. */
export const MIN_ON_FOOT_PACE = 150;
export const MAX_FOOD_KEY = 80;

const round2 = (v) => Math.round(v * 100) / 100;
const number = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/** The ledger as it is before anything has been claimed. */
export function emptyLedger() {
  return {
    total: 0,
    level: 1,
    sources: { workouts: 0, nutrition: 0, social: 0 },
    days: {},
    activeDays: [],
    distance: { weeks: {}, months: {} },
    streak: 0,
    imported: false,
    ids: [],
  };
}

/** A ledger read from storage, with anything missing filled in. */
export function normalizeLedger(ledger) {
  const base = emptyLedger();
  if (!ledger || typeof ledger !== 'object') return base;
  const total = Number.isFinite(ledger.total) && ledger.total > 0 ? Math.min(ledger.total, MAX_TOTAL_XP) : 0;
  const objectOr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return {
    total,
    level: levelFromXp(total),
    sources: { ...base.sources, ...objectOr(ledger.sources) },
    days: objectOr(ledger.days),
    activeDays: Array.isArray(ledger.activeDays) ? ledger.activeDays.filter((k) => dayNumber(k) !== null) : [],
    distance: {
      weeks: objectOr(ledger.distance && ledger.distance.weeks),
      months: objectOr(ledger.distance && ledger.distance.months),
    },
    streak: Number.isFinite(ledger.streak) && ledger.streak > 0 ? ledger.streak : 0,
    imported: ledger.imported === true,
    ids: Array.isArray(ledger.ids) ? ledger.ids.filter((id) => typeof id === 'string') : [],
  };
}

const newestKeys = (map, count) => Object.keys(map).sort().slice(-count);

/** What goes on the public leaderboard entry: XP, level, streak, and the distance for the latest two weeks and months. */
export function leaderboardFields(ledger) {
  const l = normalizeLedger(ledger);
  const distance = {};
  newestKeys(l.distance.weeks, 2).forEach((k) => { distance[k] = l.distance.weeks[k]; });
  newestKeys(l.distance.months, 2).forEach((k) => { distance[k] = l.distance.months[k]; });
  return { xp: l.total, level: l.level, streak: l.streak, distance };
}

/** The part of a ledger that shows on the leaderboard has changed. */
export function boardChanged(before, after) {
  return JSON.stringify(leaderboardFields(before)) !== JSON.stringify(leaderboardFields(after));
}

// What a claim of one kind is worth before the level multiplier: { base, multiplier } or { reason }.
function priceClaim(kind, claim) {
  const base = number(claim.baseExp);
  switch (kind) {
    case 'workout':
      return Number.isInteger(base) && base >= 1 && base <= MAX_WORKOUT_BASE ? { base, multiplier: 1 } : { reason: 'invalid' };
    case 'run': {
      const km = number(claim.distanceKm);
      const seconds = number(claim.durationSec);
      const rate = ACTIVITY_XP_PER_KM[claim.activity];
      if (!(rate > 0) || !(km > 0) || km > MAX_RUN_KM || !(seconds >= MIN_RUN_SECONDS)) return { reason: 'invalid' };
      if (seconds / km < MIN_ON_FOOT_PACE) return { reason: 'too-fast' };
      const xp = Math.round(km * rate);
      return xp >= 1 ? { base: xp, multiplier: 1, km } : { reason: 'invalid' };
    }
    case 'hike': {
      const km = number(claim.distanceKm);
      const seconds = number(claim.durationSec);
      const multiplier = number(claim.multiplier);
      if (!(km > 0) || km > MAX_HIKE_KM || !(seconds > 0) || !HIKE_MULTIPLIERS.includes(multiplier)) return { reason: 'invalid' };
      if (seconds / km < MIN_ON_FOOT_PACE) return { reason: 'too-fast' };
      const xp = Math.round(km * HIKE_XP_PER_KM);
      return xp >= 1 ? { base: xp, multiplier } : { reason: 'invalid' };
    }
    case 'meal':
      return MEAL_BASES.includes(base) ? { base, multiplier: 1 } : { reason: 'invalid' };
    case 'plan':
      return base === PLAN_BASE ? { base, multiplier: 1 } : { reason: 'invalid' };
    case 'advice':
      return base === ADVICE_BASE ? { base, multiplier: 1 } : { reason: 'invalid' };
    case 'formcheck':
      return Number.isInteger(base) && base >= FORMCHECK_BASE_PER_REP && base <= FORMCHECK_BASE_PER_REP * FORMCHECK_MAX_REPS
        && base % FORMCHECK_BASE_PER_REP === 0
        ? { base, multiplier: 1 }
        : { reason: 'invalid' };
    case 'journey':
      return JOURNEY_BASES.includes(base) ? { base, multiplier: 1 } : { reason: 'invalid' };
    case 'race':
      return base === RACE_BASE ? { base, multiplier: 1 } : { reason: 'invalid' };
    default:
      return { reason: 'invalid' };
  }
}

function withProcessed(ledger, id, today) {
  const ids = [...ledger.ids.filter((x) => x !== id), id].slice(-KEEP_IDS);
  const todayNumber = dayNumber(today);
  const days = {};
  Object.keys(ledger.days).forEach((k) => {
    const n = dayNumber(k);
    if (n !== null && todayNumber - n <= KEEP_DAYS) days[k] = ledger.days[k];
  });
  const next = { ...ledger, ids, days };
  next.level = levelFromXp(next.total);
  next.streak = streakFrom(next.activeDays, today);
  return next;
}

function importClaim(ledger, claim, id, today, ageDays) {
  if (ledger.imported) return { ledger: withProcessed(ledger, id, today), outcome: { status: 'rejected', reason: 'already-imported', amount: 0 } };
  const claimed = number(claim.total);
  if (!(claimed >= 0)) return { ledger: withProcessed(ledger, id, today), outcome: { status: 'rejected', reason: 'invalid', amount: 0 } };
  const age = Math.max(0, Math.floor(number(ageDays) || 0)) + 1;
  // Nobody can have more than the daily limit, every day since the account was made.
  const amount = round2(Math.min(claimed, MAX_TOTAL_XP, dailyCap(LEVEL_CAP) * age));

  const todayNumber = dayNumber(today);
  const earliest = todayNumber - Math.min(MAX_ACTIVE_DAYS, age);
  const claimedDays = (Array.isArray(claim.activeDays) ? claim.activeDays : [])
    .filter((k) => { const n = dayNumber(k); return n !== null && n >= earliest && n <= todayNumber + MAX_FUTURE_DAYS; });
  const activeDays = Array.from(new Set([...ledger.activeDays, ...claimedDays])).sort().slice(-MAX_ACTIVE_DAYS);

  const next = withProcessed({
    ...ledger,
    total: Math.min(MAX_TOTAL_XP, round2(ledger.total + amount)),
    activeDays,
    imported: true,
  }, id, today);
  return { ledger: next, outcome: { status: 'awarded', amount, reason: null } };
}

/**
 * Applies one claim to a ledger. Returns { ledger, outcome }: the new ledger, and { status: 'awarded' | 'rejected', amount, reason }.
 * A rejected claim still comes back with its id recorded, so the phone can stop waiting for it. Nothing here throws on a bad claim.
 *
 * @param {object} args
 *   ledger   the ledger now (or null for a person with none yet)
 *   id       the claim's id (the name of its document)
 *   claim    { kind, day, ...what the kind needs } as filed by the phone
 *   now      the time, in milliseconds
 *   ageDays  how many days old the account is (only used by the one-off import)
 */
export function applyClaim({ ledger, id, claim, now = Date.now(), ageDays = 0 }) {
  const before = normalizeLedger(ledger);
  const today = utcDayKey(now);
  const todayNumber = dayNumber(today);
  const reject = (reason) => ({ ledger: withProcessed(before, id, today), outcome: { status: 'rejected', reason, amount: 0 } });

  if (!claim || typeof claim !== 'object' || typeof id !== 'string' || !id) return reject('invalid');
  const kind = claim.kind;
  if (kind === 'import') return importClaim(before, claim, id, today, ageDays);
  const rules = KINDS[kind];
  if (!rules) return reject('invalid');

  const day = claim.day;
  const dayN = dayNumber(day);
  if (dayN === null || dayN < todayNumber - MAX_BACKDATE_DAYS || dayN > todayNumber + MAX_FUTURE_DAYS) return reject('bad-day');

  const entry = before.days[day] && typeof before.days[day] === 'object' ? before.days[day] : {};
  const counts = entry.n && typeof entry.n === 'object' ? entry.n : {};
  if ((counts[kind] || 0) >= rules.perDay) return reject('too-many');
  const spent = Number.isFinite(entry.xp) ? entry.xp : 0;
  const room = dailyCap(before.level) - spent;
  if (room <= 0) return reject('daily-cap');

  let amount = 0;
  let foods = Array.isArray(entry.foods) ? entry.foods : [];
  let water = Number.isFinite(entry.water) ? entry.water : 0;
  let steps = Number.isFinite(entry.steps) ? entry.steps : 0;
  let distanceKm = 0;

  if (kind === 'meal') {
    const key = typeof claim.foodKey === 'string' ? claim.foodKey.trim().toLowerCase() : '';
    if (!key || key.length > MAX_FOOD_KEY) return reject('invalid');
    if (foods.includes(key)) return reject('repeat');
    const price = priceClaim(kind, claim);
    if (price.reason) return reject(price.reason);
    foods = [...foods, key];
    amount = Math.round(price.base * levelMultiplier(before.level) * price.multiplier);
  } else if (kind === 'hydration') {
    const tier = number(claim.tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > 5) return reject('invalid');
    if (tier <= water) return reject('nothing-new');
    for (let t = water + 1; t <= tier; t++) amount += HYDRATION_TIER_XP[t];
    water = tier;
  } else if (kind === 'steps') {
    const count = number(claim.steps);
    if (!Number.isInteger(count) || count < 1 || count > MAX_STEPS_PER_DAY) return reject('invalid');
    if (count <= steps) return reject('nothing-new');
    amount = round2((count - steps) * STEPS_XP_PER_STEP);
    steps = count;
  } else {
    const price = priceClaim(kind, claim);
    if (price.reason) return reject(price.reason);
    amount = Math.round(price.base * levelMultiplier(before.level) * price.multiplier);
    if (kind === 'run') distanceKm = price.km;
  }

  amount = round2(Math.min(amount, room));
  if (!(amount > 0)) return reject('nothing-new');

  const sources = { ...before.sources };
  if (rules.source) sources[rules.source] = round2((Number(sources[rules.source]) || 0) + amount);

  const distance = { weeks: { ...before.distance.weeks }, months: { ...before.distance.months } };
  if (distanceKm > 0) {
    const w = weekKeyOf(day);
    const m = monthKeyOf(day);
    distance.weeks[w] = round2((Number(distance.weeks[w]) || 0) + distanceKm);
    distance.months[m] = round2((Number(distance.months[m]) || 0) + distanceKm);
    // Only the latest two weeks and months are kept.
    Object.keys(distance.weeks).sort().slice(0, -2).forEach((k) => { delete distance.weeks[k]; });
    Object.keys(distance.months).sort().slice(0, -2).forEach((k) => { delete distance.months[k]; });
  }

  const activeDays = rules.active
    ? Array.from(new Set([...before.activeDays, day])).sort().slice(-MAX_ACTIVE_DAYS)
    : before.activeDays;

  const next = withProcessed({
    ...before,
    total: Math.min(MAX_TOTAL_XP, round2(before.total + amount)),
    sources,
    distance,
    activeDays,
    days: {
      ...before.days,
      [day]: { xp: round2(spent + amount), n: { ...counts, [kind]: (counts[kind] || 0) + 1 }, foods, water, steps },
    },
  }, id, today);
  return { ledger: next, outcome: { status: 'awarded', amount, reason: null } };
}

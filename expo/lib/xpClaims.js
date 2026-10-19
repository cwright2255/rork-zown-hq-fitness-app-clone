// lib/xpClaims.js
//
// What the app files for XP. When something earns XP (a workout, a run, a meal logged...) the app does not add to a score: it files
// a CLAIM, a small document saying what was done, and the server works out the XP and keeps the total (functions/src/xpLedger.js,
// with the rules in lib/xpRules.js). This file turns the activity objects the app has always made (store/expStore.js addExpActivity)
// into claims, and makes the ids and bodies. Pure functions, no React, no Firebase.
//
// A claim that the server would refuse for what it says alone (a base that is not allowed, a pace nobody could run, a day that
// is out of range) is never made: there is nothing to wait for, and the rules would turn it away. What depends on the person's
// record so far (the same food twice, the daily limit) is decided with the ledger, in expStore.
import { MAX_FOOD_KEY, MAX_ACTIVE_DAYS, applyClaim, dayNumber } from './xpRules';
import { localDateKey } from './localDate';

/** The refusals that come from the claim alone, whatever has been claimed before. */
const FROM_THE_CLAIM_ALONE = ['invalid', 'too-fast', 'bad-day'];

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;
const safeId = (text) => String(text).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);

// What the app's activity types are, as claim kinds. 'running' also covers journeys and races (told apart by their ids).
const KIND_OF_TYPE = {
  workout: 'workout',
  running: 'run',
  hiking: 'hike',
  meal: 'meal',
  mainMission: 'plan',
  sideMission: 'advice',
};

/** The claim kind for an activity, or null when it is not something that earns XP on the server. */
export function kindOfActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;
  if (typeof activity.kind === 'string') return activity.kind;
  if (activity.type === 'running') {
    const id = String(activity.id || '');
    if (id.startsWith('journey-')) return 'journey';
    if (id.startsWith('race-')) return 'race';
  }
  return KIND_OF_TYPE[activity.type] || null;
}

// Whether the server would refuse it for what it says alone.
function holdsUp(body, now) {
  const { outcome } = applyClaim({ ledger: null, id: 'check', claim: body, now });
  return !(outcome.status === 'rejected' && FROM_THE_CLAIM_ALONE.includes(outcome.reason));
}

/**
 * The claim for an activity: { id, body }, or null when there is nothing to claim.
 * An activity is { id, type, kind?, baseExp, multiplier, date, ...}; a run adds activity ('run' or 'walk'), distanceKm and
 * durationSec; a hike adds distanceKm and durationSec; a meal adds foodKey.
 * The id is what makes a claim happen once: a journey or a race has an id of its own, so it can be claimed only once ever.
 */
export function claimFromActivity(activity, now = Date.now()) {
  const kind = kindOfActivity(activity);
  if (!kind) return null;
  const day = typeof activity.date === 'string' && dayNumber(activity.date) !== null ? activity.date : localDateKey(new Date(now));
  const base = Math.round(Number(activity.baseExp));

  let body;
  switch (kind) {
    case 'workout':
    case 'plan':
    case 'advice':
    case 'formcheck':
    case 'journey':
    case 'race':
      if (!(base > 0)) return null;
      body = { kind, day, baseExp: base };
      break;
    case 'meal': {
      const foodKey = typeof activity.foodKey === 'string' ? activity.foodKey.trim().toLowerCase().slice(0, MAX_FOOD_KEY) : '';
      if (!foodKey || !(base > 0)) return null;
      body = { kind, day, baseExp: base, foodKey };
      break;
    }
    case 'run': {
      const distanceKm = Number(activity.distanceKm);
      const durationSec = Number(activity.durationSec);
      if (!(distanceKm > 0) || !(durationSec > 0) || !finite(distanceKm) || !finite(durationSec)) return null;
      body = {
        kind, day,
        activity: activity.activity === 'walk' ? 'walk' : 'run',
        distanceKm: Math.round(distanceKm * 1000) / 1000,
        durationSec: Math.round(durationSec),
      };
      break;
    }
    case 'hike': {
      const distanceKm = Number(activity.distanceKm);
      const durationSec = Number(activity.durationSec);
      const multiplier = Number(activity.multiplier);
      if (!(distanceKm > 0) || !(durationSec > 0) || !finite(distanceKm) || !finite(durationSec) || !finite(multiplier)) return null;
      body = {
        kind, day,
        distanceKm: Math.round(distanceKm * 1000) / 1000,
        durationSec: Math.round(durationSec),
        multiplier,
      };
      break;
    }
    default:
      return null;
  }

  if (!holdsUp(body, now)) return null;
  const own = String(activity.id == null || activity.id === '' ? now : activity.id);
  const id = safeId(own.startsWith(`${kind}-`) ? own : `${kind}-${own}`);
  return { id, body };
}

/** The claim for reaching a tier of the day's water target. */
export function hydrationClaim(day, tier) {
  return { id: `hydration-${day}-${tier}`, body: { kind: 'hydration', day, tier } };
}

/** The claim for the steps counted so far today (the server pays only the steps it has not paid for). */
export function stepsClaim(day, steps) {
  return { id: `steps-${day}-${steps}`, body: { kind: 'steps', day, steps } };
}

/**
 * The one-off claim that brings in the XP this phone had from before the server kept the record. `activeDays` are the days with a
 * workout, a run or a hike, so the streak carries over. There is one per account: the id is always the same.
 */
export function importClaim({ day, total, activeDays }) {
  const days = (Array.isArray(activeDays) ? activeDays : []).filter((k) => dayNumber(k) !== null);
  return {
    id: 'import-v1',
    body: {
      kind: 'import',
      day,
      total: round2(Math.max(0, Number(total) || 0)),
      activeDays: Array.from(new Set(days)).sort().slice(-MAX_ACTIVE_DAYS),
    },
  };
}

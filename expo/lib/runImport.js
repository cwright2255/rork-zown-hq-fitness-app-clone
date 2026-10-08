// lib/runImport.js
//
// Turns workouts from Apple Health into saved Zown runs, and decides which of
// them are new. No React, no native modules, so it is easy to test; the part
// that talks to Apple Health is services/appleHealthService.js.
//
// A "workout" here is the plain shape that service hands over:
//   { source, nativeId, activity: 'run' | 'walk', startMs, endMs,
//     durationSec, distanceM, energyKcal,
//     locations: [{ latitude, longitude, altitude, horizontalAccuracy, verticalAccuracy, timeMs }] }
// The saved run follows the conventions in lib/runStats.js (km, seconds of
// moving time, seconds per km, splits per full km) plus `source`.

import { distanceM, updateElevation, MAX_SPEED_MS, ALT_MAX_ACCURACY_M } from './gpsFilter';
import {
  MAX_SAVED_RUNS, caloriesFor, cleanSplits, compactTrack, newestRuns, runPaceSecPerKm, activityOf,
} from './runStats';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const SOURCES = {
  'apple-health': { label: 'Apple Health', idPrefix: 'hk' },
};

/** How far back an import looks. */
export const IMPORT_RANGES = [
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: '1y', label: '1 year', days: 365 },
];
export const DEFAULT_RANGE = '90d';
/** Most workouts read in one import (the history keeps only the newest 100 runs anyway). */
export const MAX_IMPORT_WORKOUTS = 100;
/** Shorter than this, or under MIN_IMPORT_KM, is a stray tap rather than an outing. */
export const MIN_IMPORT_SECONDS = 60;
export const MIN_IMPORT_KM = 0.1;
/** Route points with a worse horizontal accuracy than this (metres) are ignored. */
export const MAX_IMPORT_ACCURACY_M = 65;
/** A gap this long between route points, while barely moving, was a pause. */
export const PAUSE_GAP_S = 30;
export const PAUSE_SPEED_MS = 0.7;
/** Route distance and workout distance must agree this closely for splits to be trusted. */
export const DISTANCE_TOLERANCE = 0.15;
/** Same for the route's moving time against the workout's duration. */
export const TIME_TOLERANCE = 0.25;
/** Two outings overlapping by at least this share of the shorter one are the same outing. */
export const OVERLAP_FRACTION = 0.5;

/** When an import starts looking, in ms since 1970, for a range id (unknown ids use the default). */
export function rangeStartMs(rangeId, now = Date.now()) {
  const range = IMPORT_RANGES.find((r) => r.id === rangeId) || IMPORT_RANGES.find((r) => r.id === DEFAULT_RANGE);
  return now - range.days * 24 * 60 * 60 * 1000;
}

/** The id an imported run is saved under, so importing again never doubles it up. */
export function importedRunId(source, nativeId) {
  const prefix = (SOURCES[source] || { idPrefix: String(source || 'import') }).idPrefix;
  return `${prefix}-${nativeId}`;
}

/** "Apple Health" for an imported run, '' for one recorded in Zown. */
export function sourceLabel(run) {
  return run && run.source && SOURCES[run.source] ? SOURCES[run.source].label : '';
}

// ---- Reading what Apple Health (HealthKit) hands over ----------------------

/** HealthKit's workout activity type numbers for the two things we import. */
export const HK_RUNNING = 37;
export const HK_WALKING = 52;

const METRES = {
  m: 1, meter: 1, meters: 1, metre: 1, metres: 1,
  km: 1000, kilometer: 1000, kilometers: 1000,
  mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, yd: 0.9144,
};
const SECONDS = { s: 1, sec: 1, second: 1, seconds: 1, min: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hour: 3600, hours: 3600 };
const KCAL = { kcal: 1, cal: 1, kj: 1 / 4.184, j: 1 / 4184 };

function convert(q, table) {
  if (!q || typeof q.quantity !== 'number' || !Number.isFinite(q.quantity)) return 0;
  const key = String(q.unit || '').trim().toLowerCase();
  const factor = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
  return factor === null ? 0 : q.quantity * factor;
}

/** {unit, quantity} to metres (0 when the unit is not one we know, rather than a guess). */
export const quantityToMeters = (q) => convert(q, METRES);
/** {unit, quantity} to seconds. */
export const quantityToSeconds = (q) => convert(q, SECONDS);
/** {unit, quantity} to kilocalories. */
export const quantityToKcal = (q) => convert(q, KCAL);

/** Route locations from a workout's routes ([{ locations: [...] }]) as flat points with times in ms. */
export function fromHealthKitRoutes(routes) {
  const out = [];
  (Array.isArray(routes) ? routes : []).forEach((route) => {
    (route && Array.isArray(route.locations) ? route.locations : []).forEach((l) => {
      if (!l) return;
      out.push({
        latitude: l.latitude,
        longitude: l.longitude,
        altitude: l.altitude,
        horizontalAccuracy: l.horizontalAccuracy,
        verticalAccuracy: l.verticalAccuracy,
        timeMs: new Date(l.date).getTime(),
      });
    });
  });
  return out;
}

/** One HealthKit workout (and its route points) in the plain shape buildImportedRun expects. */
export function fromHealthKitWorkout(w, locations = []) {
  if (!w) return null;
  return {
    source: 'apple-health',
    nativeId: w.uuid,
    activity: w.workoutActivityType === HK_WALKING ? 'walk' : 'run',
    startMs: new Date(w.startDate).getTime(),
    endMs: new Date(w.endDate).getTime(),
    durationSec: quantityToSeconds(w.duration),
    distanceM: quantityToMeters(w.totalDistance),
    energyKcal: quantityToKcal(w.totalEnergyBurned),
    locations,
  };
}

const validPoint = (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180 && Number.isFinite(p.timeMs);

/**
 * Distance, moving time, per-km splits and climb from a recorded route.
 * `reportedKm` / `durationSec` are what the workout itself says; the route is
 * stretched to match them (within a sensible tolerance) so the splits add up
 * to the headline numbers. Splits are left out when the route does not agree
 * with the workout (a route that only covers part of it, say).
 * Returns { points, routeKm, movingSec, splits, elevGain, elevLoss, hasAltitude }.
 */
export function analyzeRoute(locations, { reportedKm = 0, durationSec = 0 } = {}) {
  const sorted = (Array.isArray(locations) ? locations : [])
    .filter(validPoint)
    .filter((p) => !(typeof p.horizontalAccuracy === 'number' && (p.horizontalAccuracy < 0 || p.horizontalAccuracy > MAX_IMPORT_ACCURACY_M)))
    .slice()
    .sort((a, b) => a.timeMs - b.timeMs);

  const points = [];
  const cumDist = [];
  const cumTime = [];
  let dist = 0;
  let time = 0;
  let prev = null;
  let el = null;
  let hasAltitude = false;

  for (const p of sorted) {
    if (prev) {
      const dt = (p.timeMs - prev.timeMs) / 1000;
      if (!(dt > 0)) continue;
      const d = distanceM(prev, p);
      const speed = d / dt;
      if (speed > MAX_SPEED_MS) continue; // a GPS jump, not a step
      dist += d;
      // Standing still for a while (a pause) is not moving time.
      if (!(dt > PAUSE_GAP_S && speed < PAUSE_SPEED_MS)) time += dt;
    }
    points.push(p);
    cumDist.push(dist);
    cumTime.push(time);
    prev = p;

    const altOk = Number.isFinite(p.altitude)
      && !(typeof p.verticalAccuracy === 'number' && (p.verticalAccuracy < 0 || p.verticalAccuracy > ALT_MAX_ACCURACY_M));
    if (altOk) {
      hasAltitude = true;
      el = updateElevation(el, p.altitude, p.timeMs, true);
    }
  }

  const routeKm = dist / 1000;
  const out = {
    points, routeKm, movingSec: time, splits: [],
    elevGain: el ? el.gain : 0, elevLoss: el ? el.loss : 0, hasAltitude,
  };
  if (points.length < 2 || routeKm <= 0 || time <= 0) return out;

  const targetKm = reportedKm > 0 ? reportedKm : routeKm;
  const kd = targetKm / routeKm;
  const kt = durationSec > 0 ? durationSec / time : 1;
  if (Math.abs(kd - 1) > DISTANCE_TOLERANCE || Math.abs(kt - 1) > TIME_TOLERANCE) return out;

  // Walk the route again and note the time at each whole kilometre.
  let next = 1000;
  let lastAt = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d0 = cumDist[i - 1] * kd;
    const d1 = cumDist[i] * kd;
    const t0 = cumTime[i - 1] * kt;
    const t1 = cumTime[i] * kt;
    while (d1 > d0 && d1 >= next) {
      const at = t0 + ((next - d0) / (d1 - d0)) * (t1 - t0);
      out.splits.push(at - lastAt);
      lastAt = at;
      next += 1000;
    }
  }
  out.splits = cleanSplits(out.splits);
  return out;
}

/**
 * The saved run for one workout, or null when it isn't worth keeping (under a
 * minute, or under 100 m). Never contains undefined (Firestore refuses it).
 */
export function buildImportedRun(workout, { uid } = {}) {
  if (!workout || typeof workout !== 'object') return null;
  const source = workout.source in SOURCES ? workout.source : 'apple-health';
  const startMs = num(workout.startMs);
  const endMs = num(workout.endMs);
  if (!(startMs > 0) || !(endMs > startMs)) return null;
  if (workout.nativeId === undefined || workout.nativeId === null || workout.nativeId === '') return null;

  const activity = workout.activity === 'walk' ? 'walk' : 'run';
  const durationSec = Math.round(num(workout.durationSec) > 0 ? workout.durationSec : (endMs - startMs) / 1000);
  const reportedKm = num(workout.distanceM) > 0 ? workout.distanceM / 1000 : 0;
  const route = analyzeRoute(workout.locations, { reportedKm, durationSec });
  const distance = Math.round((reportedKm > 0 ? reportedKm : route.routeKm) * 1000) / 1000;
  if (durationSec < MIN_IMPORT_SECONDS || distance < MIN_IMPORT_KM) return null;

  const run = {
    id: importedRunId(source, workout.nativeId),
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    distance,
    duration: durationSec,
    pace: runPaceSecPerKm({ distance, duration: durationSec }),
    calories: num(workout.energyKcal) > 0 ? Math.round(workout.energyKcal) : caloriesFor(activity, distance),
    track: compactTrack(route.points),
    source,
  };
  if (route.splits.length) run.splits = route.splits;
  if (route.hasAltitude) {
    run.elevGain = Math.max(0, Math.round(route.elevGain));
    run.elevLoss = Math.max(0, Math.round(route.elevLoss));
  }
  if (activity === 'walk') run.activity = 'walk';
  if (typeof uid === 'string' && uid) run.uid = uid;
  return run;
}

const spanOf = (run) => {
  const start = Date.parse((run && run.startTime) || '');
  const end = Date.parse((run && run.endTime) || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
};

/** True when two saved runs cover (mostly) the same stretch of time. */
export function sameOuting(a, b) {
  const x = spanOf(a);
  const y = spanOf(b);
  if (!x || !y) return false;
  const overlap = Math.min(x.end, y.end) - Math.max(x.start, y.start);
  const shorter = Math.min(x.end - x.start, y.end - y.start);
  return overlap > 0 && overlap / shorter >= OVERLAP_FRACTION;
}

const richness = (run) => (
  (Array.isArray(run.track) && run.track.length >= 4 ? 4 : 0)
  + (Array.isArray(run.splits) && run.splits.length ? 2 : 0)
  + (typeof run.elevGain === 'number' ? 1 : 0)
);

/**
 * Which of the imported runs to add. A run is left out when it is already
 * there (same id, so importing twice is harmless), or when it overlaps a run
 * that is already saved (recorded in Zown and by a watch at the same time) or
 * another imported run (two apps saving the same outing); of two imported
 * duplicates the one with the route and splits wins.
 * Returns { add (newest first), alreadyThere, overlapping }.
 */
export function planImport(imported, existing) {
  const have = new Set((Array.isArray(existing) ? existing : []).filter(Boolean).map((r) => String(r.id)));
  const saved = (Array.isArray(existing) ? existing : []).filter(Boolean);
  const candidates = (Array.isArray(imported) ? imported : []).filter(Boolean)
    .slice()
    .sort((a, b) => richness(b) - richness(a) || num(b.distance) - num(a.distance));

  const add = [];
  let alreadyThere = 0;
  let overlapping = 0;
  for (const run of candidates) {
    if (have.has(String(run.id))) { alreadyThere += 1; continue; }
    if (saved.some((r) => sameOuting(run, r)) || add.some((r) => sameOuting(run, r))) { overlapping += 1; continue; }
    add.push(run);
  }
  return { add: newestRuns(add, Infinity), alreadyThere, overlapping };
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** The words the import screen shows afterwards. */
export function describeImport({ added = [], alreadyThere = 0, overlapping = 0, dropped = 0, found = 0 } = {}) {
  const runs = added.filter((r) => activityOf(r) === 'run').length;
  const walks = added.length - runs;
  let headline;
  if (added.length > 0) {
    const parts = [];
    if (runs) parts.push(plural(runs, 'run', 'runs'));
    if (walks) parts.push(plural(walks, 'walk', 'walks'));
    headline = `Imported ${parts.join(' and ')}`;
  } else if (found === 0) {
    headline = 'No runs or walks found';
  } else {
    headline = 'Nothing new to import';
  }
  const lines = [];
  if (alreadyThere > 0) lines.push(`${alreadyThere} already in Zown`);
  if (overlapping > 0) {
    lines.push(`${overlapping} overlapped an outing that was already saved, so ${overlapping === 1 ? 'it was' : 'they were'} skipped`);
  }
  if (dropped > 0) {
    lines.push(`${dropped} older ${dropped === 1 ? 'one' : 'ones'} did not fit in your history of ${MAX_SAVED_RUNS} runs`);
  }
  return { headline, lines };
}

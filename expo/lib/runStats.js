// lib/runStats.js
//
// Pure helpers for saved runs: building the record that gets saved, keeping
// the run history in the right order, pace, personal records, and a compact
// route that fits in Firestore. No React, no Firebase, so it is easy to test.
//
// Conventions used everywhere:
//   distance  kilometres
//   duration  seconds spent moving (paused time is not counted)
//   pace      seconds per kilometre (5:30 /km is 330)
//   history   newest run first

export const MAX_SAVED_RUNS = 100;
export const MIN_SAVED_RUN_SECONDS = 10;
export const MAX_ROUTE_POINTS = 200;
// All runs live in one Firestore document (limit 1 MiB). Stay well under it.
export const MAX_RUNS_JSON_CHARS = 700000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** When a run finished, in ms since 1970 (0 if the run has no usable time). */
export function runTime(run) {
  const t = Date.parse((run && (run.endTime || run.startTime)) || '');
  return Number.isFinite(t) ? t : 0;
}

/** Pace of one run in seconds per km, or 0 if it can't be worked out. */
export function runPaceSecPerKm(run) {
  if (!run) return 0;
  const distance = num(run.distance);
  const duration = num(run.duration);
  if (distance >= 0.01 && duration > 0) return duration / distance;
  const stored = num(run.pace);
  return stored > 0 ? stored : 0;
}

/** "5:30" for 330 seconds per km; "--" when there is no usable pace. */
export function formatPace(secPerKm) {
  const s = num(secPerKm);
  if (s <= 0 || s > 3600) return '--';
  let minutes = Math.floor(s / 60);
  let seconds = Math.round(s % 60);
  if (seconds === 60) { minutes += 1; seconds = 0; }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** "5:30 /km", or "--" when there is no usable pace. */
export function paceLabel(secPerKm) {
  const p = formatPace(secPerKm);
  return p === '--' ? p : `${p} /km`;
}

/**
 * Newest first, one entry per id, at most `max` kept. Keeps the NEWEST runs
 * (the old code kept the oldest 100 and dropped the run you just finished).
 */
export function newestRuns(runs, max = MAX_SAVED_RUNS) {
  const list = (Array.isArray(runs) ? runs : [])
    .map((run, index) => ({ run, index }))
    .filter((e) => e.run && typeof e.run === 'object')
    .sort((a, b) => runTime(b.run) - runTime(a.run) || a.index - b.index);
  const seen = new Set();
  const out = [];
  for (const { run } of list) {
    if (run.id !== undefined && run.id !== null) {
      const key = String(run.id);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(run);
    if (out.length >= max) break;
  }
  return out;
}

/** Route points of a run as [{ latitude, longitude }], from either saved shape. */
export function routePoints(run) {
  if (!run) return [];
  const track = run.track;
  if (Array.isArray(track) && track.length >= 4) {
    const out = [];
    for (let i = 0; i + 1 < track.length; i += 2) {
      if (Number.isFinite(track[i]) && Number.isFinite(track[i + 1])) {
        out.push({ latitude: track[i], longitude: track[i + 1] });
      }
    }
    return out;
  }
  if (Array.isArray(run.coords)) {
    return run.coords
      .filter((c) => c && Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
      .map((c) => ({ latitude: c.latitude, longitude: c.longitude }));
  }
  return [];
}

/**
 * Shrinks a route to a flat number list [lat, lng, lat, lng, ...] with 5
 * decimals (about a metre), at most `maxPoints` points, always keeping the
 * first and last. Firestore does not allow arrays inside arrays, so the flat
 * list is also the safe shape to save.
 */
export function compactTrack(points, maxPoints = MAX_ROUTE_POINTS) {
  const pts = Array.isArray(points) ? points.filter((p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
  if (pts.length < 2) return [];
  const keep = Math.max(2, maxPoints);
  const picked = [];
  if (pts.length <= keep) {
    picked.push(...pts);
  } else {
    for (let i = 0; i < keep; i += 1) picked.push(pts[Math.round((i * (pts.length - 1)) / (keep - 1))]);
  }
  const round = (v) => Math.round(v * 1e5) / 1e5;
  const out = [];
  picked.forEach((p) => { out.push(round(p.latitude), round(p.longitude)); });
  return out;
}

/** True when a run is long enough to be worth saving (not an accidental tap). */
export function shouldSaveRun(run) {
  return num(run && run.duration) >= MIN_SAVED_RUN_SECONDS;
}

/**
 * The record that gets saved for a finished run. `base` is the store's
 * activeRun (may be null) and `data` is what the run screen tracked; data wins.
 * Never contains undefined (Firestore refuses it).
 */
export function buildSavedRun(base, data, { uid, now = Date.now() } = {}) {
  const merged = { ...(base || {}), ...(data || {}) };
  const distance = Math.max(0, num(merged.distance));
  const duration = Math.max(0, Math.round(num(merged.duration)));
  const run = {
    id: String(now),
    startTime: typeof merged.startTime === 'string' && merged.startTime
      ? merged.startTime
      : new Date(now - duration * 1000).toISOString(),
    endTime: new Date(now).toISOString(),
    distance,
    duration,
    pace: runPaceSecPerKm({ distance, duration }),
    calories: Math.max(0, Math.round(num(merged.calories))),
    track: compactTrack(routePoints(merged)),
  };
  if (typeof uid === 'string' && uid) run.uid = uid;
  return run;
}

/**
 * The history trimmed so it fits in the one Firestore document: newest 100,
 * and if that is still too big, routes come off the oldest runs first, then
 * the oldest runs themselves.
 */
export function fitRunsToSize(runs, maxChars = MAX_RUNS_JSON_CHARS) {
  let list = newestRuns(runs);
  const size = (l) => JSON.stringify(l).length;
  for (let i = list.length - 1; i >= 0 && size(list) > maxChars; i -= 1) {
    if (Array.isArray(list[i].track) && list[i].track.length > 0) list[i] = { ...list[i], track: [] };
  }
  while (list.length > 1 && size(list) > maxChars) list = list.slice(0, -1);
  return list;
}

/** Records computed from real runs. Anything with no qualifying run is null. */
export function personalRecords(runs) {
  const list = newestRuns(runs, Infinity);
  if (list.length === 0) return { longestRun: null, fastestPace: null, best5k: null, totalDistance: 0 };
  const longestRun = list.reduce((best, r) => (!best || num(r.distance) > num(best.distance) ? r : best), null);
  // A fastest pace needs at least 1 km, so a 40 metre jog can't set the record.
  const paced = list.filter((r) => num(r.distance) >= 1 && runPaceSecPerKm(r) > 0);
  const fastest = paced.length
    ? paced.reduce((best, r) => (runPaceSecPerKm(r) < runPaceSecPerKm(best) ? r : best))
    : null;
  const fastestPace = fastest ? { ...fastest, pace: runPaceSecPerKm(fastest) } : null;
  // "5K" means any run of at least 4.5 km, as before.
  const fiveK = list.filter((r) => num(r.distance) >= 4.5);
  const best5k = fiveK.length
    ? fiveK.reduce((best, r) => (num(r.duration) < num(best.duration) ? r : best))
    : null;
  const totalDistance = list.reduce((s, r) => s + num(r.distance), 0);
  return { longestRun, fastestPace, best5k, totalDistance };
}

/** Totals for the log header. avgPace is seconds per km across all moving runs. */
export function summarizeRuns(runs) {
  const list = Array.isArray(runs) ? runs.filter(Boolean) : [];
  const totalDistance = list.reduce((s, r) => s + num(r.distance), 0);
  const totalDuration = list.reduce((s, r) => s + num(r.duration), 0);
  const totalCalories = list.reduce((s, r) => s + num(r.calories), 0);
  const moving = list.filter((r) => num(r.distance) >= 0.01 && num(r.duration) > 0);
  const movingDistance = moving.reduce((s, r) => s + num(r.distance), 0);
  const movingDuration = moving.reduce((s, r) => s + num(r.duration), 0);
  const avgPace = movingDistance > 0 ? movingDuration / movingDistance : 0;
  return { totalRuns: list.length, totalDistance, totalDuration, totalCalories, avgPace };
}

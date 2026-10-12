// lib/hikeRecovery.js
//
// A hike that was being recorded when the app was closed under it (swiped away,
// stopped by the phone to free memory, restarted for an update). The tracker is
// saved to the phone while a hike is on (store/runTrackerStore.js); this file
// decides what to keep and what a saved hike turns into when the app opens again.
//
//   durableTracker   what is worth keeping of a hike in progress
//   restoreTracker   the tracker to carry on with, or null if the saved copy is no use
//   canResumeSession whether a tracker can be picked up again, however long ago it was left
//   recoveryMessage  the line that asks what to do with an unfinished hike
//
// The one rule that matters: the time the app was closed is never counted. A
// hike last heard from a moment ago is still being recorded (the phone woke the
// app again for the next GPS reading), so it carries on. Anything older comes
// back paused where it stopped, and carries on from there when the person says so.

import { createTracker, trackedMs } from './runTracker';

// A hike last heard from this recently (ms) was still being recorded: keep it going.
export const STILL_RECORDING_MS = 2 * 60 * 1000;
// An unfinished hike is kept this long (ms) before it is let go.
export const KEEP_UNFINISHED_MS = 7 * 24 * 60 * 60 * 1000;

const HIKE_PREFIX = 'hike:';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const atLeast = (v, min) => (finite(v) && v >= min ? v : null);

/** Hikes are recorded under the kind "hike:<trail id>". */
export function isHikeKind(kind) {
  return typeof kind === 'string' && kind.startsWith(HIKE_PREFIX);
}

/** The trail a hike was on. */
export function hikeTrailId(kind) {
  return isHikeKind(kind) ? kind.slice(HIKE_PREFIX.length) : '';
}

/** True when `tracker` is a recording of `kind` (any recording, if no kind is given), however long ago it was left. */
export function canResumeSession(tracker, kind) {
  if (!tracker || tracker.status === 'idle') return false;
  return kind === undefined || kind === null || tracker.kind === String(kind);
}

/**
 * The part of a hike in progress that is kept on the phone, or null when there
 * is nothing to keep (no recording, or not a hike). Smoothing and jump-checking
 * state is left out: it starts again from the next reading.
 */
export function durableTracker(tracker) {
  if (!tracker || tracker.status === 'idle' || !isHikeKind(tracker.kind)) return null;
  return {
    status: tracker.status,
    autoPause: tracker.autoPause,
    kind: tracker.kind,
    startedAt: tracker.startedAt,
    lastT: tracker.lastT,
    lastFixT: tracker.lastFixT,
    pausedAt: tracker.pausedAt,
    movingMs: tracker.movingMs,
    distanceM: tracker.distanceM,
    splits: tracker.splits,
    splitMs: tracker.splitMs,
    route: tracker.route,
    current: tracker.current,
    // Only the totals: the height is smoothed again from the next reading.
    elev: tracker.elev ? { gain: tracker.elev.gain, loss: tracker.elev.loss } : null,
  };
}

const point = (p) => (p && finite(p.latitude) && finite(p.longitude)
  ? { latitude: p.latitude, longitude: p.longitude }
  : null);

/**
 * The tracker to carry on with for a saved hike, or null if the saved copy is
 * missing, damaged, not a hike, or older than KEEP_UNFINISHED_MS.
 */
export function restoreTracker(saved, now = Date.now()) {
  if (!saved || !isHikeKind(saved.kind)) return null;
  if (saved.status !== 'running' && saved.status !== 'paused' && saved.status !== 'auto') return null;
  const startedAt = atLeast(saved.startedAt, 1);
  const lastT = atLeast(saved.lastT, 1);
  const movingMs = atLeast(saved.movingMs, 0);
  const distanceM = atLeast(saved.distanceM, 0);
  if (startedAt === null || lastT === null || movingMs === null || distanceM === null) return null;

  const lastFixT = atLeast(saved.lastFixT, 0) || 0;
  const age = now - Math.max(lastT, lastFixT); // negative if the phone's clock was set back: counts as just now
  if (age > KEEP_UNFINISHED_MS) return null;

  const recording = saved.status === 'running' && age <= STILL_RECORDING_MS;
  const pausedAt = atLeast(saved.pausedAt, 1);
  const gain = saved.elev ? atLeast(saved.elev.gain, 0) : null;
  const loss = saved.elev ? atLeast(saved.elev.loss, 0) : null;

  return {
    ...createTracker({ autoPause: saved.autoPause === true, kind: saved.kind }),
    status: recording ? 'running' : 'paused',
    startedAt,
    lastT,
    lastFixT,
    // Stopped where it was last heard from; the dead time is not hiking time.
    pausedAt: recording ? 0 : (saved.status === 'paused' && pausedAt !== null ? pausedAt : lastT),
    movingMs,
    distanceM,
    splits: (Array.isArray(saved.splits) ? saved.splits : []).filter((s) => finite(s) && s > 0),
    splitMs: atLeast(saved.splitMs, 0) || 0,
    route: (Array.isArray(saved.route) ? saved.route : []).map(point).filter(Boolean),
    current: point(saved.current),
    elev: gain !== null && loss !== null ? { gain, loss } : null,
  };
}

/** "2h 10m", or "45m" under an hour. */
export function durationLabel(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** The question asked on opening the app with an unfinished hike. */
export function recoveryMessage(tracker, now = Date.now()) {
  const km = tracker.distanceM / 1000;
  const seconds = Math.round(trackedMs(tracker, now) / 1000);
  return `You have an unfinished hike: ${km.toFixed(1)} km in ${durationLabel(seconds)}. Open it to carry on or to save it.`;
}

/** The map and path chosen for a hike, kept so it can be picked up with them: { mapId?, pathName? } or null. */
export function cleanContext(context) {
  if (!context) return null;
  const clean = {};
  if (typeof context.mapId === 'string' && context.mapId) clean.mapId = context.mapId;
  if (typeof context.pathName === 'string' && context.pathName) clean.pathName = context.pathName;
  return clean.mapId || clean.pathName ? clean : null;
}

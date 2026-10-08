// lib/runTracker.js
//
// The brain of run recording: a plain-data state machine fed with GPS
// readings. No React, no expo, no timers, so it can be tested with simulated
// GPS and keeps working the same whether the app is open or in the background.
//
//   createTracker / startTracker   begin a run
//   applyFix / applyFixes          feed GPS readings (expo-location shape)
//   pauseTracker / resumeTracker   manual pause and resume
//   setAutoPause                   turn auto-pause on or off
//   trackedMs                      moving time right now, for the clock
//   finishTracker                  the numbers to save when the run ends
//
// Time only moves forward from GPS timestamps and the `now` passed in, so a
// batch of readings delivered late by the phone still adds up correctly.
//
// Units here: distanceM metres, movingMs milliseconds. The saved run uses
// kilometres and seconds (see lib/runStats.js).

import {
  distanceM, normalizeFix, kalmanStep, windowSpeed, updateElevation, gpsQuality,
  MAX_ACCURACY_M, MAX_SPEED_MS, JUMP_SLACK_M,
} from './gpsFilter';

// A reading older than the run start by more than this is a cached position.
export const STALE_FIX_MS = 3000;
// This many jumps in a row means the phone really did move: start over there.
export const JUMPS_BEFORE_RESET = 4;
// How far back (ms) readings are kept to judge whether you are moving.
export const WINDOW_MS = 10000;
// Slower than this (m/s) counts as standing still ...
export const SLOW_MS = 0.6;
// ... and once standing still it takes this speed (m/s) to count as moving again.
export const SLOW_EXIT_MS = 1.0;
// ... unless the phone's own speed reading says you are going at least this.
export const DOPPLER_MOVING_MS = 1.0;
// A phone that has reported real speed and now keeps saying less than this
// (m/s) over the last DOPPLER_WINDOW_MS is standing still.
export const DOPPLER_STILL_MS = 0.5;
export const DOPPLER_WINDOW_MS = 3000;
// Standing still this long (ms) triggers auto-pause.
export const PAUSE_AFTER_MS = 5000;
// While auto-paused: movement from the stop point that starts the "moving" clock ...
export const MOVE_START_M = 3;
// ... and the movement that resumes the run (or the GPS accuracy, if larger).
export const RESUME_DIST_M = 8;
// Most time (ms) given back when auto-pause ends, for the seconds spent getting going.
export const MAX_RESUME_BACKFILL_MS = 6000;
// After you resume by hand, auto-pause stays off this long (ms).
export const RESUME_HOLD_MS = 20000;
// Distance only counts in steps of at least this many metres (kills GPS shimmer).
export const MIN_STEP_M = 10;
// No reading for this long (ms) means the GPS signal is lost.
export const GPS_LOST_MS = 15000;
// A run left alone this long (ms) is not picked up again when you come back.
export const ADOPT_WITHIN_MS = 2 * 60 * 60 * 1000;
// Paused this long (ms): the phone can stop using GPS until you resume.
export const PAUSED_GPS_TIMEOUT_MS = 20 * 60 * 1000;

export function createTracker({ autoPause = true, kind = '' } = {}) {
  return {
    status: 'idle', // idle | running | paused (by you) | auto (auto-paused)
    autoPause: !!autoPause,
    kind: String(kind || ''), // what is being recorded (a run, a walk, a program session)
    startedAt: 0,
    lastT: 0, // time (ms) the clock has been counted up to
    lastFixT: 0, // timestamp of the last reading seen
    pausedAt: 0,
    movingMs: 0,
    distanceM: 0,
    splits: [], // seconds for each full kilometre
    gps: 'searching', // searching | good | fair | weak
    acc: null,
    kf: null,
    lastRaw: null,
    rejects: 0,
    anchor: null, // last position that was counted
    pauseAnchor: null,
    route: [], // [{ latitude, longitude }] for the map
    current: null,
    win: [],
    dopplerSeen: false, // has this phone ever reported a real speed?
    still: false, // standing still as of the last reading
    slowSince: 0,
    moveSince: 0,
    holdUntil: 0,
    splitMs: 0, // moving time (ms) at the last full kilometre
    elev: null, // smoothed height and climb/descent totals, see updateElevation
  };
}

export function startTracker(state, now = Date.now()) {
  const fresh = createTracker({ autoPause: state ? state.autoPause : true, kind: state ? state.kind : '' });
  return { ...fresh, status: 'running', startedAt: now, lastT: now };
}

/** Counts the clock up to time `t`; time only adds while running. */
function advance(s, t) {
  if (!(t > s.lastT)) return s;
  return { ...s, movingMs: s.status === 'running' ? s.movingMs + (t - s.lastT) : s.movingMs, lastT: t };
}

/** Adds `d` metres, working out the time of each kilometre crossed. */
function addDistance(s, d, prevMs) {
  const before = s.distanceM;
  const after = before + d;
  let splits = s.splits;
  let lastSplitMs = s.splitMs;
  while (Math.floor(after / 1000) > splits.length) {
    const km = splits.length + 1;
    const frac = (km * 1000 - before) / d;
    const at = prevMs + frac * (s.movingMs - prevMs);
    splits = [...splits, Math.max(1, Math.round((at - lastSplitMs) / 1000))];
    lastSplitMs = at;
  }
  return { ...s, distanceM: after, splits, splitMs: lastSplitMs };
}

/**
 * True when you are standing still. Judged from how far the smoothed position
 * moved over the last few seconds; if this phone reports real speed, its own
 * speed reading can also say "still", and it can always say "moving".
 */
function isStandingStill(win, fix, dopplerSeen, was) {
  if (fix.speed !== null && fix.speed >= DOPPLER_MOVING_MS) return false;
  const speed = windowSpeed(win);
  if (speed !== null && (speed < SLOW_MS || (was && speed < SLOW_EXIT_MS))) return true;
  if (dopplerSeen && (speed === null || speed < 2)) {
    const seen = win.filter((w) => fix.t - w.t <= DOPPLER_WINDOW_MS && w.v !== null);
    if (seen.length >= 3 && seen.every((w) => w.v < DOPPLER_STILL_MS)) return true;
  }
  return false;
}

/** Feed one GPS reading (expo-location shape: { coords, timestamp }). */
export function applyFix(state, loc) {
  if (!state || state.status === 'idle') return state;
  const fix = normalizeFix(loc);
  if (!fix) return state;
  if (fix.t < state.startedAt - STALE_FIX_MS) return state; // cached position from before the run
  if (fix.t <= state.lastFixT) return state; // duplicate or out of order

  const prevMs = state.movingMs;
  let s = advance({ ...state, lastFixT: fix.t, acc: fix.acc, gps: gpsQuality(fix.acc) }, fix.t);

  // A vague reading is not used for position, but the clock still ran.
  if (fix.acc > MAX_ACCURACY_M) return s;

  // A reading that would mean running faster than anyone can is a jump.
  if (s.lastRaw) {
    const dt = (fix.t - s.lastRaw.t) / 1000;
    const allowed = MAX_SPEED_MS * dt + Math.max(fix.acc, s.lastRaw.acc) + JUMP_SLACK_M;
    if (distanceM(s.lastRaw, fix) > allowed) {
      const rejects = s.rejects + 1;
      if (rejects < JUMPS_BEFORE_RESET) return { ...s, rejects };
      // It keeps saying the same new place: believe it, but don't count the gap.
      s = { ...s, kf: null, lastRaw: null, anchor: null, win: [], slowSince: 0 };
    }
  }

  const kf = kalmanStep(s.kf, fix.lat, fix.lng, fix.acc, fix.t);
  const pos = { latitude: kf.lat, longitude: kf.lng };
  const win = s.win.filter((w) => fix.t - w.t <= WINDOW_MS);
  win.push({ t: fix.t, lat: kf.lat, lng: kf.lng, v: fix.speed });
  const dopplerSeen = s.dopplerSeen || (fix.speed !== null && fix.speed >= DOPPLER_MOVING_MS);
  s = {
    ...s, kf, win, dopplerSeen, rejects: 0, current: pos,
    lastRaw: { lat: fix.lat, lng: fix.lng, t: fix.t, acc: fix.acc },
  };

  const slow = isStandingStill(win, fix, dopplerSeen, s.still);
  s = { ...s, still: slow };

  if (s.status === 'paused') {
    // Paused by hand: keep the map and signal current, count nothing.
    s = { ...s, anchor: null };
  } else if (s.status === 'auto') {
    if (slow || !s.pauseAnchor) {
      // Still standing: the stop point follows where you actually are.
      s = { ...s, pauseAnchor: pos, moveSince: 0 };
    } else {
      const moved = distanceM(s.pauseAnchor, pos);
      const moveSince = moved >= MOVE_START_M ? (s.moveSince || fix.t) : 0;
      if (moved >= Math.max(RESUME_DIST_M, fix.acc)) {
        // You are off again: give back the moments spent getting going.
        const back = moveSince ? Math.min(fix.t - moveSince, MAX_RESUME_BACKFILL_MS) : 0;
        s = { ...s, status: 'running', pauseAnchor: null, moveSince: 0, slowSince: 0, movingMs: s.movingMs + back };
      } else {
        s = { ...s, moveSince };
      }
    }
  }

  if (s.status === 'running') {
    if (!s.anchor) {
      s = { ...s, anchor: pos, route: [...s.route, pos] };
    } else if (slow) {
      const slowSince = s.slowSince || fix.t;
      if (s.autoPause && fix.t >= s.holdUntil && fix.t - slowSince >= PAUSE_AFTER_MS) {
        // Take back the time spent standing before the pause kicked in.
        s = {
          ...s, status: 'auto', pauseAnchor: pos, slowSince: 0, moveSince: 0,
          movingMs: Math.max(0, s.movingMs - (fix.t - slowSince)),
        };
      } else {
        s = { ...s, slowSince };
      }
    } else {
      s = { ...s, slowSince: 0 };
      const step = distanceM(s.anchor, pos);
      if (step >= Math.max(MIN_STEP_M, fix.acc * 0.5)) {
        s = addDistance(s, step, prevMs);
        s = { ...s, anchor: pos, route: [...s.route, pos] };
      }
    }
  }

  // Height: always smoothed, but climb and descent only count while moving.
  if (fix.alt !== null) {
    s = { ...s, elev: updateElevation(s.elev, fix.alt, fix.t, s.status === 'running' && !slow) };
  }
  return s;
}

/** Feed several readings in order (the phone sometimes delivers a batch). */
export function applyFixes(state, locations) {
  let s = state;
  if (Array.isArray(locations)) {
    for (const loc of locations) s = applyFix(s, loc);
  }
  return s;
}

/** Pause by hand. Time stops and nothing is counted until resume. */
export function pauseTracker(state, now = Date.now()) {
  if (!state || (state.status !== 'running' && state.status !== 'auto')) return state;
  const s = advance(state, now);
  return { ...s, status: 'paused', pausedAt: now, anchor: null, pauseAnchor: null, win: [], slowSince: 0, moveSince: 0 };
}

/** Resume from a manual pause or an auto-pause. */
export function resumeTracker(state, now = Date.now()) {
  if (!state || (state.status !== 'paused' && state.status !== 'auto')) return state;
  const s = advance(state, now);
  return {
    ...s, status: 'running', pausedAt: 0, pauseAnchor: null, win: s.status === 'paused' ? [] : s.win,
    slowSince: 0, moveSince: 0, holdUntil: now + RESUME_HOLD_MS,
  };
}

/** Turn auto-pause on or off. Turning it off while auto-paused resumes the run. */
export function setAutoPause(state, enabled, now = Date.now()) {
  if (!state) return state;
  const s = { ...state, autoPause: !!enabled };
  return !enabled && s.status === 'auto' ? resumeTracker(s, now) : s;
}

/** Moving time in ms as of `now`, for the clock on screen. */
export function trackedMs(state, now = Date.now()) {
  if (!state || state.status === 'idle') return 0;
  return state.movingMs + (state.status === 'running' ? Math.max(0, now - state.lastT) : 0);
}

/** Metres climbed so far. */
export function elevationGain(state) {
  return state && state.elev ? state.elev.gain : 0;
}

/** 'searching' | 'good' | 'fair' | 'weak' | 'lost' for the GPS chip. */
export function gpsStatus(state, now = Date.now()) {
  if (!state || state.status === 'idle' || !state.lastFixT) return 'searching';
  if (now - state.lastFixT > GPS_LOST_MS) return 'lost';
  return state.gps;
}

/**
 * True when a run left earlier is recent enough to carry on with. When `kind`
 * is given the earlier run must be the same kind of outing, so a paused run is
 * never picked up as a walk or as a program session.
 */
export function shouldAdoptSession(state, now = Date.now(), kind) {
  if (!state || state.status === 'idle' || !(now - state.lastT < ADOPT_WITHIN_MS)) return false;
  return kind === undefined || kind === null || state.kind === String(kind);
}

/** True when GPS has been idle through a long pause and can be switched off. */
export function pauseTimedOut(state, now = Date.now()) {
  return !!state && state.status === 'paused' && state.pausedAt > 0 && now - state.pausedAt >= PAUSED_GPS_TIMEOUT_MS;
}

/** The numbers to save when the run ends (distance in km, duration in seconds). */
export function finishTracker(state, now = Date.now()) {
  const s = advance(state, now);
  return {
    startTime: new Date(s.startedAt || now).toISOString(),
    distance: s.distanceM / 1000,
    duration: Math.round(s.movingMs / 1000),
    splits: s.splits.slice(),
    elevGain: Math.round(s.elev ? s.elev.gain : 0),
    elevLoss: Math.round(s.elev ? s.elev.loss : 0),
    coords: s.route.slice(),
  };
}

/**
 * Where a run/walk program is after `seconds` of moving time.
 * Returns { index, secondsLeft, done } for intervals like [{ seconds, ... }].
 */
export function intervalAt(intervals, seconds) {
  if (!Array.isArray(intervals) || intervals.length === 0) return null;
  const s = Math.max(0, seconds);
  let start = 0;
  for (let i = 0; i < intervals.length; i += 1) {
    const end = start + (intervals[i].seconds || 0);
    if (s < end) return { index: i, secondsLeft: Math.ceil(end - s), done: false };
    start = end;
  }
  return { index: intervals.length - 1, secondsLeft: 0, done: true };
}

/** A program session counts toward the program once this share of its planned time is done. */
export const PROGRAM_CREDIT_FRACTION = 0.8;

/** Planned length of a run/walk session in seconds (0 if there is no plan). */
export function plannedSeconds(intervals) {
  if (!Array.isArray(intervals)) return 0;
  return intervals.reduce((sum, iv) => sum + (Number(iv && iv.seconds) > 0 ? Number(iv.seconds) : 0), 0);
}

/**
 * Whether `seconds` of moving time is enough to count the session toward its
 * program. Ending a session early still saves the run, it just does not tick
 * the session off.
 */
export function sessionCounts(intervals, seconds) {
  const planned = plannedSeconds(intervals);
  if (planned <= 0) return false;
  return seconds >= Math.round(planned * PROGRAM_CREDIT_FRACTION);
}

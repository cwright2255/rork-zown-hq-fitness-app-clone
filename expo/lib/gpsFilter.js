// lib/gpsFilter.js
//
// Pure helpers for cleaning up GPS while a run is recorded. No React, no
// expo modules, so they are easy to test with simulated GPS noise.
//
//   normalizeFix     one expo-location reading -> a flat, checked object
//   distanceM        metres between two points
//   kalmanStep       smooths position, trusting accurate readings more
//   windowSpeed      how fast you are really moving over the last few seconds
//   updateElevation  smoothed climb and descent that ignores GPS height noise

export const EARTH_RADIUS_M = 6371008.8;

// A reading worse than this (metres) is not used for position at all.
export const MAX_ACCURACY_M = 35;
// Nobody runs faster than this (m/s, about 43 km/h); faster means a GPS jump.
export const MAX_SPEED_MS = 12;
// Extra room (metres) before a step is called a jump.
export const JUMP_SLACK_M = 4;
// How far (m/s) a runner may unpredictably speed up or turn; drives smoothing.
export const PROCESS_NOISE_MS = 3;
// After this many seconds without a reading the smoother starts afresh.
export const MAX_SMOOTHING_GAP_S = 60;
// Never trust a reading to be better than this when smoothing.
export const MIN_ACCURACY_M = 3;

// Height readings are ignored when the phone says they are worse than this.
export const ALT_MAX_ACCURACY_M = 25;
// Height smoothing: roughly the last 30 seconds.
export const ALT_SMOOTH_SECONDS = 30;
// A climb or drop only counts after it is at least this many metres.
export const ALT_STEP_M = 8;

const toRad = (deg) => (deg * Math.PI) / 180;
const ll = (p) => ({
  lat: p.lat !== undefined ? p.lat : p.latitude,
  lng: p.lng !== undefined ? p.lng : p.longitude,
});

/** Metres between two points ({lat,lng} or {latitude,longitude}). */
export function distanceM(a, b) {
  const p = ll(a);
  const q = ll(b);
  const dLat = toRad(q.lat - p.lat);
  const dLng = toRad(q.lng - p.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** 'good' | 'fair' | 'weak' from a horizontal accuracy in metres. */
export function gpsQuality(acc) {
  if (!(acc >= 0)) return 'weak';
  if (acc <= 12) return 'good';
  if (acc <= 25) return 'fair';
  return 'weak';
}

/**
 * One expo-location reading ({ coords, timestamp }) as
 * { lat, lng, t, acc, speed, alt, altAcc }, or null if it cannot be used.
 * Unknown values are null. iOS reports -1 for "invalid", which is rejected.
 */
export function normalizeFix(loc) {
  const c = loc && loc.coords;
  if (!c) return null;
  const { latitude: lat, longitude: lng } = c;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  if (!Number.isFinite(loc.timestamp)) return null;
  if (Number.isFinite(c.accuracy) && c.accuracy < 0) return null;
  const acc = Number.isFinite(c.accuracy) ? Math.max(c.accuracy, MIN_ACCURACY_M) : 15;
  const speed = Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null;
  const altAcc = Number.isFinite(c.altitudeAccuracy) && c.altitudeAccuracy > 0 ? c.altitudeAccuracy : null;
  let alt = Number.isFinite(c.altitude) ? c.altitude : null;
  if (Number.isFinite(c.altitudeAccuracy) && c.altitudeAccuracy < 0) alt = null; // iOS: invalid
  if (altAcc !== null && altAcc > ALT_MAX_ACCURACY_M) alt = null;
  if (alt === 0 && altAcc === null) alt = null; // Android reports 0 when it has no height
  return { lat, lng, t: loc.timestamp, acc, speed, alt, altAcc };
}

/**
 * One step of a position smoother. `kf` is the previous result (or null).
 * Accurate readings pull the position hard, vague ones barely move it, and the
 * longer since the last reading the more it trusts the new one.
 */
export function kalmanStep(kf, lat, lng, acc, t, processNoise = PROCESS_NOISE_MS) {
  const a = Math.max(acc, MIN_ACCURACY_M);
  const dt = kf ? Math.max(0, (t - kf.t) / 1000) : 0;
  // First reading, or so long since the last that it tells us nothing: start afresh.
  if (!kf || dt > MAX_SMOOTHING_GAP_S) return { lat, lng, variance: a * a, t };
  const variance = kf.variance + dt * processNoise * processNoise;
  const k = variance / (variance + a * a);
  return {
    lat: kf.lat + k * (lat - kf.lat),
    lng: kf.lng + k * (lng - kf.lng),
    variance: (1 - k) * variance,
    t,
  };
}

/**
 * Speed (m/s) over the readings in `win` ([{t, lat, lng}], oldest first), or
 * null when they cover less than `minSpanMs` (not enough to say).
 */
export function windowSpeed(win, minSpanMs = 4000) {
  if (!Array.isArray(win) || win.length < 3) return null;
  const first = win[0];
  const last = win[win.length - 1];
  const dt = last.t - first.t;
  if (dt < minSpanMs) return null;
  return distanceM(first, last) / (dt / 1000);
}

/**
 * Smoothed height with climb and descent totals. `el` is the previous result
 * (or null), `alt` the new height in metres (or null for none), `counting` is
 * false while you are paused or standing still so nothing is added then.
 *
 * Climb and descent are counted turn to turn: a climb is added once the height
 * has dropped ALT_STEP_M from its top (or while you are still climbing), so
 * small wobbles never add up but a real hill counts in full.
 * Returns { smooth, t, gain, loss, ... } (gain and loss in metres).
 */
export function updateElevation(el, alt, t, counting = true) {
  if (alt === null || !Number.isFinite(alt)) return el;
  if (!el) return restart({ gain: 0, loss: 0 }, alt, t);
  const dt = Math.max(0, (t - el.t) / 1000);
  const smooth = el.smooth + (1 - Math.exp(-dt / ALT_SMOOTH_SECONDS)) * (alt - el.smooth);
  if (!counting) {
    // Not moving: bank what was pending and start over from here.
    return restart({ gain: el.gain, loss: el.loss }, smooth, t);
  }
  let { dir, base, ext, lo, hi, cg, cl } = el;
  if (dir === 0) {
    lo = Math.min(lo, smooth);
    hi = Math.max(hi, smooth);
    if (smooth - lo >= ALT_STEP_M) { dir = 1; base = lo; ext = smooth; }
    else if (hi - smooth >= ALT_STEP_M) { dir = -1; base = hi; ext = smooth; }
  } else if (dir === 1) {
    if (smooth > ext) ext = smooth;
    else if (ext - smooth >= ALT_STEP_M) { cg += ext - base; dir = -1; base = ext; ext = smooth; }
  } else if (smooth < ext) {
    ext = smooth;
  } else if (smooth - ext >= ALT_STEP_M) {
    cl += base - ext; dir = 1; base = ext; ext = smooth;
  }
  const gain = cg + (dir === 1 ? ext - base : 0);
  const loss = cl + (dir === -1 ? base - ext : 0);
  return { smooth, t, dir, base, ext, lo, hi, cg, cl, gain, loss };
}

// A fresh turn-to-turn tracker at height `h`, keeping totals already banked.
function restart(totals, h, t) {
  return {
    smooth: h, t, dir: 0, base: h, ext: h, lo: h, hi: h,
    cg: totals.gain, cl: totals.loss, gain: totals.gain, loss: totals.loss,
  };
}

// lib/offRoute.js
//
// Notices when a hiker has strayed from the trail they chose, so the hike screen
// can warn them. Plain data in and out (no React, no timers, no expo), so it can
// be tested with a made-up trail and made-up positions.
//
//   distanceToRouteM   how far a position is from the nearest part of the trail
//   createOffRoute     the starting state
//   stepOffRoute       feed it one position; it says whether to warn
//   describeOffRoute   the words for a warning
//
// The rules, chosen so a warning means something:
//   - Nothing is said until the hiker has actually been on the trail once. The
//     walk from the car park to the trailhead is not "off the trail".
//   - Being more than OFF_ROUTE_M away is not enough on its own: it has to last
//     OFF_ROUTE_AFTER_MS, so a step aside or a jumpy GPS reading does not warn.
//   - A poor GPS reading widens the limits a little (up to MAX_ACCURACY_SLACK_M),
//     because the phone then does not know where it is to within a few metres.
//   - Coming back needs the hiker to be well inside the limit (BACK_ON_ROUTE_M),
//     so someone walking along the edge of the limit does not flip back and forth.
//   - Still off after REMIND_EVERY_MS: remind once more, and so on.

import { EARTH_RADIUS_M } from './gpsFilter';

/** Farther than this (metres) from the trail line counts as off it. */
export const OFF_ROUTE_M = 60;
/** Closer than this (metres) counts as back on it. Smaller than OFF_ROUTE_M on purpose. */
export const BACK_ON_ROUTE_M = 35;
/** The hiker has to stay off the trail this long (ms) before the first warning. */
export const OFF_ROUTE_AFTER_MS = 20000;
/** While still off the trail, warn again this often (ms). */
export const REMIND_EVERY_MS = 3 * 60 * 1000;
/** Most metres of extra room given to the limits for a vague GPS reading. */
export const MAX_ACCURACY_SLACK_M = 25;
/** No reading for this long (ms): the "how long have they been off" count starts over. */
export const MAX_READING_GAP_MS = 45000;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const valid = (p) => !!p && isNum(p.latitude) && isNum(p.longitude);
const M_PER_DEG = (EARTH_RADIUS_M * Math.PI) / 180;

/**
 * Metres from `point` to the nearest part of the trail line (the lines between
 * its points, not only the points themselves). Infinity when there is no usable
 * point or trail. A trail of one point is the distance to that point.
 */
export function distanceToRouteM(point, route) {
  if (!valid(point) || !Array.isArray(route)) return Infinity;
  const pts = route.filter(valid);
  if (pts.length === 0) return Infinity;
  // A flat picture around the point: x east, y north, in metres. Plenty accurate
  // for the few hundred metres that matter here.
  const kx = Math.cos((point.latitude * Math.PI) / 180) * M_PER_DEG;
  const flat = (p) => {
    let dLng = p.longitude - point.longitude;
    if (dLng > 180) dLng -= 360;
    else if (dLng < -180) dLng += 360;
    return { x: dLng * kx, y: (p.latitude - point.latitude) * M_PER_DEG };
  };
  let best = Infinity;
  let prev = flat(pts[0]);
  best = Math.hypot(prev.x, prev.y);
  for (let i = 1; i < pts.length; i += 1) {
    const cur = flat(pts[i]);
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const len2 = dx * dx + dy * dy;
    // Where along this piece the point is closest (0 at its start, 1 at its end).
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(prev.x * dx + prev.y * dy) / len2));
    const d = Math.hypot(prev.x + t * dx, prev.y + t * dy);
    if (d < best) best = d;
    prev = cur;
  }
  return best;
}

export function createOffRoute() {
  return {
    joined: false, // has the hiker been on the trail yet?
    off: false, // is the hiker off the trail (a warning has been given)?
    offSince: 0, // time (ms) they were first seen too far away, while not yet warned
    alertedAt: 0, // time (ms) of the last warning
    lastT: 0, // time (ms) of the last reading seen
  };
}

/**
 * Feed one position.
 * @param state  from createOffRoute / the last call
 * @param input  { position: {latitude, longitude}, route: [{latitude, longitude}],
 *                 t: time of the reading in ms, accuracy: metres (optional) }
 * @returns {{ state, event, distanceM }}
 *   event is 'off' (first warning), 'remind' (still off), 'back' (returned), or null.
 *   distanceM is the whole metres from the trail (null when it could not be worked out).
 */
export function stepOffRoute(state, { position, route, t, accuracy } = {}) {
  const s = state || createOffRoute();
  const line = Array.isArray(route) ? route.filter(valid) : [];
  if (!valid(position) || line.length < 2 || !isNum(t)) return { state: s, event: null, distanceM: null };

  const d = distanceToRouteM(position, line);
  const slack = isNum(accuracy) && accuracy > 0 ? Math.min(accuracy, MAX_ACCURACY_SLACK_M) : 0;
  const offLimit = OFF_ROUTE_M + slack;
  const backLimit = BACK_ON_ROUTE_M + slack;
  const distanceM = Math.round(d);
  const next = { ...s, lastT: t };

  if (!s.joined) {
    return { state: d <= backLimit ? { ...next, joined: true } : next, event: null, distanceM };
  }

  if (!s.off) {
    if (d <= offLimit) return { state: { ...next, offSince: 0 }, event: null, distanceM };
    const gap = t - s.lastT > MAX_READING_GAP_MS;
    const since = s.offSince > 0 && !gap ? s.offSince : t;
    if (t - since >= OFF_ROUTE_AFTER_MS) {
      return { state: { ...next, off: true, offSince: 0, alertedAt: t }, event: 'off', distanceM };
    }
    return { state: { ...next, offSince: since }, event: null, distanceM };
  }

  if (d <= backLimit) {
    return { state: { ...next, off: false, offSince: 0, alertedAt: 0 }, event: 'back', distanceM };
  }
  if (t - s.alertedAt >= REMIND_EVERY_MS) {
    return { state: { ...next, alertedAt: t }, event: 'remind', distanceM };
  }
  return { state: next, event: null, distanceM };
}

const FEET_PER_METRE = 3.280839895;
const FEET_SHOWN_AS_MILES = 525; // about a tenth of a mile

/**
 * A distance in a form fit to say or show: to the nearest 10 m under 100 m, the
 * nearest 50 m under a kilometre, otherwise kilometres to one decimal.
 * For imperial `units` (the Settings distance unit) it is feet instead (the
 * nearest 10 ft under 100 ft, then the nearest 50 ft) and, from about a tenth of a
 * mile, miles to one decimal.
 * @returns {{ value: number, unit: 'm' | 'km' | 'ft' | 'mi' }}
 */
export function roundedDistance(metres, units) {
  const m = Math.max(0, isNum(metres) ? metres : 0);
  if (units === 'imperial') {
    const ft = m * FEET_PER_METRE;
    if (ft >= FEET_SHOWN_AS_MILES) return { value: Math.round((m / 1609.344) * 10) / 10, unit: 'mi' };
    if (ft < 100) return { value: Math.round(ft / 10) * 10, unit: 'ft' };
    return { value: Math.round(ft / 50) * 50, unit: 'ft' };
  }
  if (m < 100) return { value: Math.round(m / 10) * 10, unit: 'm' };
  if (m < 1000) return { value: Math.round(m / 50) * 50, unit: 'm' };
  return { value: Math.round(m / 100) / 10, unit: 'km' };
}

/** "80 m" or "1.2 km" ("260 ft" or "0.4 mi" for imperial `units`). */
export function distanceLabel(metres, units) {
  const { value, unit } = roundedDistance(metres, units);
  return `${value} ${unit}`;
}

const WORDS = { m: 'meters', km: 'kilometers', ft: 'feet', mi: 'miles' };

/** "80 meters" or "1.2 kilometers" ("260 feet" or "0.4 miles" for imperial `units`), for speaking. */
export function distanceWords(metres, units) {
  const { value, unit } = roundedDistance(metres, units);
  return `${value} ${unit === 'mi' && value === 1 ? 'mile' : WORDS[unit]}`;
}

/**
 * The words for a warning: { title, body, speech }, or null for an event that
 * has none.
 */
export function describeOffRoute(event, metres, units) {
  if (event === 'off' || event === 'remind') {
    return {
      title: 'Off the trail',
      body: `About ${distanceLabel(metres, units)} from the trail you chose.`,
      speech: `You may be off the trail. You are about ${distanceWords(metres, units)} from the route.`,
    };
  }
  if (event === 'back') {
    return { title: 'Back on the trail', body: 'You are back on the trail you chose.', speech: 'Back on the trail.' };
  }
  return null;
}

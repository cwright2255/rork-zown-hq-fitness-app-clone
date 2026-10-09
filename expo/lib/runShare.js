// lib/runShare.js
//
// Turns a saved run into the post that goes on the community feed, and turns
// a post's run back into what the feed card shows. Pure functions, no React,
// no Firebase, so they are easy to test.
//
// The post carries the numbers and a short route, not a picture: the card
// draws the route itself, so nothing needs uploading and the feed stays light.
//
// Privacy: the community feed is readable by every signed-in user, and the
// start of a run is very often someone's front door. So the first and last
// SHARE_HIDE_ENDS_M metres of a shared route are cut off, and a route too
// short to show anything after that is left out altogether (the stats are
// still shared).

import { distanceM } from './gpsFilter';
import {
  ACTIVITIES, activityOf, compactTrack, formatPace, routePoints, runPaceSecPerKm,
} from './runStats';
import { formatClock, runTitle } from './runDetail';

/** How much of each end of the route is hidden, in metres (straight line from the start / finish). */
export const SHARE_HIDE_ENDS_M = 200;
/** A route with less than this left after hiding the ends is not shared (metres along the route). */
export const SHARE_MIN_SHOWN_M = 300;
/** Most points kept in a shared route (the saved run keeps up to 200). */
export const SHARE_MAX_POINTS = 100;
/** Bumped if the shape of `post.run` ever changes. */
export const RUN_POST_VERSION = 1;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const validPoint = (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

/** Length of a route in metres. */
export function routeLengthM(points) {
  const pts = Array.isArray(points) ? points.filter(validPoint) : [];
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += distanceM(pts[i - 1], pts[i]);
  return total;
}

/**
 * The route without its first and last `hideM` metres: points are dropped from
 * the start until one is at least `hideM` away from where the run began, and
 * from the end the same way. Returns [] when what is left is too short to be
 * worth showing (or is not a real route).
 */
export function hideRouteEnds(points, hideM = SHARE_HIDE_ENDS_M, minShownM = SHARE_MIN_SHOWN_M) {
  const pts = Array.isArray(points) ? points.filter(validPoint) : [];
  if (pts.length < 2) return [];
  if (!(hideM > 0)) return routeLengthM(pts) >= minShownM ? pts : [];

  const first = pts[0];
  const last = pts[pts.length - 1];
  let from = 0;
  while (from < pts.length && distanceM(first, pts[from]) < hideM) from += 1;
  let to = pts.length - 1;
  while (to >= 0 && distanceM(last, pts[to]) < hideM) to -= 1;
  if (to - from < 1) return [];

  const kept = pts.slice(from, to + 1);
  return routeLengthM(kept) >= minShownM ? kept : [];
}

/** The line that goes with a shared run when nobody has written anything. */
export function runCaption(post) {
  const label = ACTIVITIES[post && post.activity === 'walk' ? 'walk' : 'run'].label;
  const title = (post && post.title) || label;
  return `${title}: ${num(post && post.distance).toFixed(2)} km in ${formatClock(post && post.duration)} \uD83D\uDCAA`;
}

/**
 * What to post for a saved run: { run, text } where `run` is the compact record
 * stored on the post and `text` is the caption. Returns null when there is
 * nothing worth sharing (no distance or no time). Never contains undefined
 * (Firestore refuses it).
 */
export function buildRunPost(run) {
  if (!run || typeof run !== 'object') return null;
  const distance = Math.round(Math.max(0, num(run.distance)) * 100) / 100;
  const duration = Math.max(0, Math.round(num(run.duration)));
  if (!(distance >= 0.01) || !(duration > 0)) return null;

  const shared = {
    v: RUN_POST_VERSION,
    activity: activityOf(run),
    title: runTitle(run),
    distance,
    duration,
    pace: Math.round(runPaceSecPerKm({ distance, duration })),
    route: compactTrack(hideRouteEnds(routePoints(run)), SHARE_MAX_POINTS),
  };
  if (typeof run.startTime === 'string' && run.startTime) shared.startTime = run.startTime;
  const calories = Math.round(num(run.calories));
  if (calories > 0) shared.calories = calories;
  const climb = Math.round(num(run.elevGain));
  if (climb > 0) shared.elevGain = climb;

  return { run: shared, text: runCaption(shared) };
}

/**
 * Everything the feed card shows, from the `run` stored on a post. Posts are
 * written by other people's phones, so nothing is trusted: anything that is
 * not usable gives null (the card then shows nothing).
 */
export function describeSharedRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const distance = num(raw.distance);
  const duration = num(raw.duration);
  if (!(distance > 0) || !(duration > 0)) return null;

  // Hikes share the same card (lib/hikeShare.js); anything else unknown is a run.
  const activity = raw.activity === 'walk' ? 'walk' : raw.activity === 'hike' ? 'hike' : 'run';
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim().slice(0, 40)
    : (activity === 'hike' ? 'Hike' : ACTIVITIES[activity].label);

  const flat = Array.isArray(raw.route) ? raw.route.slice(0, SHARE_MAX_POINTS * 2) : [];
  const points = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const p = { latitude: flat[i], longitude: flat[i + 1] };
    if (validPoint(p)) points.push(p);
  }

  const pace = num(raw.pace) > 0 ? num(raw.pace) : duration / distance;
  const tier = activity === 'hike' && typeof raw.tier === 'string' ? raw.tier.trim().slice(0, 20) : '';
  return {
    activity,
    title,
    distanceText: distance.toFixed(2),
    timeText: formatClock(duration),
    paceText: formatPace(pace),
    climb: num(raw.elevGain) > 0 ? Math.round(raw.elevGain) : 0,
    ...(tier ? { tier } : {}),
    points,
    hasRoute: points.length >= 2,
  };
}

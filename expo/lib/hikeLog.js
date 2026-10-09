// lib/hikeLog.js
//
// Pure helpers for saved hikes: building the record that gets saved (with the
// route walked), keeping the hike list in order and small enough for its one
// Firestore document, and working out what the history and detail screens show.
// No React, no Firebase, so it is easy to test.
//
// Units match lib/runStats.js, with the names the hike record has always used:
//   distanceKm      kilometres
//   durationSeconds seconds spent moving (paused time is not counted)
//   elevationGainM  metres climbed, elevationLossM metres descended
//   track           the route as a flat [lat, lng, lat, lng, ...] list
// The list is kept OLDEST FIRST (a new hike goes on the end), as it always has
// been; the history screen sorts it newest first for display.

import { compactTrack, formatPace, routePoints } from './runStats';
import { formatClock, runDateLabel } from './runDetail';

/** Under this distance (km) a tracked outing is not saved or rewarded as a hike. */
export const MIN_HIKE_KM = 0.3;
export const MAX_SAVED_HIKES = 200;
// All hikes live in one Firestore document (limit 1 MiB). Stay well under it.
export const MAX_HIKES_JSON_CHARS = 700000;

const PLACEHOLDER_NAME = 'Untitled hike';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round2 = (v) => Math.round(v * 100) / 100;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** When a hike finished, in ms since 1970 (0 if it has no usable time). */
export function hikeTime(hike) {
  const t = Date.parse((hike && (hike.completedAt || hike.startTime)) || '');
  return Number.isFinite(t) ? t : 0;
}

/** A copy of the list, newest first (for display). */
export function sortHikesNewest(hikes) {
  return (Array.isArray(hikes) ? hikes : [])
    .map((hike, index) => ({ hike, index }))
    .filter((e) => e.hike && typeof e.hike === 'object')
    .sort((a, b) => hikeTime(b.hike) - hikeTime(a.hike) || b.index - a.index)
    .map((e) => e.hike);
}

/** Oldest first, one entry per id, at most `max` kept (the newest ones). */
export function keepNewestHikes(hikes, max = MAX_SAVED_HIKES) {
  const list = (Array.isArray(hikes) ? hikes : [])
    .map((hike, index) => ({ hike, index }))
    .filter((e) => e.hike && typeof e.hike === 'object');
  const seen = new Set();
  const unique = [];
  // Walk newest first so a repeated id keeps the newer copy.
  [...list]
    .sort((a, b) => hikeTime(b.hike) - hikeTime(a.hike) || b.index - a.index)
    .forEach((e) => {
      if (e.hike.id !== undefined && e.hike.id !== null) {
        const key = String(e.hike.id);
        if (seen.has(key)) return;
        seen.add(key);
      }
      unique.push(e);
    });
  return unique
    .slice(0, max)
    .sort((a, b) => hikeTime(a.hike) - hikeTime(b.hike) || a.index - b.index)
    .map((e) => e.hike);
}

/**
 * The hikes from the server together with ones that only exist on this phone
 * (finished with no signal), as one oldest-first list. For a hike in both, the
 * server's copy is used, except that a share remembered only here is kept.
 */
export function mergeHikes(serverHikes, localHikes) {
  const local = new Map();
  (Array.isArray(localHikes) ? localHikes : []).forEach((h) => {
    if (h && h.id !== undefined && h.id !== null) local.set(String(h.id), h);
  });
  const merged = (Array.isArray(serverHikes) ? serverHikes : []).filter(Boolean).map((h) => {
    const mine = h.id !== undefined && h.id !== null ? local.get(String(h.id)) : null;
    return mine && mine.sharedPostId && !h.sharedPostId ? { ...h, sharedPostId: mine.sharedPostId } : h;
  });
  const onServer = new Set(merged.filter((h) => h.id !== undefined && h.id !== null).map((h) => String(h.id)));
  (Array.isArray(localHikes) ? localHikes : []).forEach((h) => {
    if (h && !onServer.has(String(h.id))) merged.push(h);
  });
  return keepNewestHikes(merged);
}

/**
 * The record that gets saved for a finished hike. `data` is what the hike
 * screen worked out; `coords` is the route as [{ latitude, longitude }].
 * Never contains undefined (Firestore refuses it).
 */
export function buildSavedHike(data, { now = Date.now(), uid } = {}) {
  const d = data && typeof data === 'object' ? data : {};
  const durationSeconds = Math.max(0, Math.round(num(d.durationSeconds)));
  const record = {
    id: `hike-${now}`,
    completedAt: new Date(now).toISOString(),
    startTime: text(d.startTime) || new Date(now - durationSeconds * 1000).toISOString(),
    trailId: text(d.trailId) || null,
    trailName: text(d.trailName) || PLACEHOLDER_NAME,
    pathName: text(d.pathName) || null,
    distanceKm: round2(Math.max(0, num(d.distanceKm))),
    elevationGainM: Math.max(0, Math.round(num(d.elevationGainM))),
    elevationLossM: Math.max(0, Math.round(num(d.elevationLossM))),
    durationSeconds,
    difficultyScore: num(d.difficultyScore),
    difficultyTier: text(d.difficultyTier) || 'Easy',
    calories: Math.max(0, Math.round(num(d.calories))),
    xpEarned: Math.max(0, Math.round(num(d.xpEarned))),
    track: compactTrack(routePoints({ track: d.track, coords: d.coords })),
  };
  if (typeof uid === 'string' && uid) record.uid = uid;
  return record;
}

/**
 * The hikes trimmed so they fit in the one Firestore document: if they are too
 * big, routes come off the oldest hikes first, then the oldest hikes themselves.
 */
export function fitHikesToSize(hikes, maxChars = MAX_HIKES_JSON_CHARS) {
  let list = keepNewestHikes(hikes);
  const size = (l) => JSON.stringify(l).length;
  for (let i = 0; i < list.length && size(list) > maxChars; i += 1) {
    if (Array.isArray(list[i].track) && list[i].track.length > 0) list[i] = { ...list[i], track: [] };
  }
  while (list.length > 1 && size(list) > maxChars) list = list.slice(1);
  return list;
}

/** The route of a hike as [{ latitude, longitude }] (empty for hikes saved before routes were kept). */
export function hikeRoute(hike) {
  return routePoints(hike);
}

/** The trail's name, or "Morning Hike" and so on when the hike was not on a listed trail. */
export function hikeTitle(hike) {
  const name = text(hike && hike.trailName);
  if (name && name !== PLACEHOLDER_NAME) return name;
  const t = new Date((hike && (hike.startTime || hike.completedAt)) || '');
  if (Number.isNaN(t.getTime())) return 'Free Hike';
  const h = t.getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} Hike`;
}

/** Everything the history list and the detail screen show for one hike. Null when it is not a hike. */
export function describeHike(hike) {
  if (!hike || typeof hike !== 'object') return null;
  const distance = Math.max(0, num(hike.distanceKm));
  const duration = Math.max(0, num(hike.durationSeconds));
  const points = hikeRoute(hike);
  return {
    id: hike.id === undefined || hike.id === null ? '' : String(hike.id),
    title: hikeTitle(hike),
    pathName: text(hike.pathName),
    when: runDateLabel({ startTime: hike.startTime || hike.completedAt }),
    distanceText: distance.toFixed(2),
    timeText: formatClock(duration),
    paceText: distance >= 0.01 && duration > 0 ? formatPace(duration / distance) : '--',
    calories: Math.max(0, Math.round(num(hike.calories))),
    climb: Math.max(0, Math.round(num(hike.elevationGainM))),
    descent: Math.max(0, Math.round(num(hike.elevationLossM))),
    tier: text(hike.difficultyTier),
    score: num(hike.difficultyScore),
    xp: Math.max(0, Math.round(num(hike.xpEarned))),
    points,
    hasRoute: points.length >= 2,
    shared: !!hike.sharedPostId,
  };
}

/** Totals for the top of the history screen. */
export function summarizeHikes(hikes) {
  const list = Array.isArray(hikes) ? hikes.filter(Boolean) : [];
  return {
    count: list.length,
    distanceKm: list.reduce((s, h) => s + num(h.distanceKm), 0),
    durationSeconds: list.reduce((s, h) => s + num(h.durationSeconds), 0),
    climbM: list.reduce((s, h) => s + num(h.elevationGainM), 0),
  };
}

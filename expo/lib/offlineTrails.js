// lib/offlineTrails.js
//
// Trails kept on the phone so they still work with no signal: the trail's own
// details, the names of its paths, and the line of each path. The line is the
// part that matters on the hill: without it the hike screen has nothing to
// follow once the signal is gone.
//
// A record looks like:
//   { version, id, savedAt, pinned, trail, maps: [{ id, name }],
//     routes: { [mapId]: { coordinates, distanceKm, elevationGainM, elevationProfile } } }
//
// Everything here is plain functions (no storage, no network) so it is easy to
// test; store/offlineTrailStore.js keeps the records and the screens fetch.

import { distanceM } from './gpsFilter';

export const OFFLINE_VERSION = 1;
// How many trails are kept, and how many paths of each.
export const MAX_OFFLINE_TRAILS = 30;
export const MAX_PATHS_PER_TRAIL = 4;
// A path is thinned to this many points: plenty to draw a trail, small enough
// that a lot of trails fit on the phone.
export const MAX_ROUTE_POINTS = 1000;
export const MAX_PROFILE_POINTS = 150;
// All the records together never take more than this many characters when
// saved, so the phone's storage stays small (Android reads a stored value in
// one piece, and fails on a very large one).
export const MAX_OFFLINE_CHARS = 1500000;

// What a trail screen uses of a trail. Left out on purpose: how far it was from
// the person who found it, and whether it was open, which are no longer true.
const TRAIL_FIELDS = [
  'id', 'name', 'address', 'latitude', 'longitude', 'rating', 'ratingCount',
  'googleMapsUri', 'directions', 'lengthMiles', 'photoUrl', 'photoName', 'source',
];

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const round = (n, places) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
const validPoint = (p) => !!p && isNum(p.latitude) && isNum(p.longitude);

/** At most `max` items, evenly spread, always keeping the first and the last. */
export function thin(list, max) {
  if (!Array.isArray(list)) return [];
  if (list.length <= max) return list.slice();
  if (max < 2) return list.slice(0, Math.max(0, max));
  const step = (list.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i += 1) out.push(list[Math.round(i * step)]);
  return out;
}

/** Length of a line of points, in km. */
export function pathLengthKm(points) {
  let metres = 0;
  for (let i = 1; i < points.length; i += 1) metres += distanceM(points[i - 1], points[i]);
  return round(metres / 1000, 2);
}

/** A route as it is kept on the phone, or null when there is no usable line. */
export function slimRoute(route) {
  if (!route || !Array.isArray(route.coordinates)) return null;
  const points = route.coordinates.filter(validPoint)
    .map((p) => ({ latitude: round(p.latitude, 6), longitude: round(p.longitude, 6) }));
  if (points.length < 2) return null;
  const coordinates = thin(points, MAX_ROUTE_POINTS);
  const profile = Array.isArray(route.elevationProfile)
    ? route.elevationProfile.filter((p) => p && isNum(p.distanceKm) && isNum(p.elevationM))
      .map((p) => ({ distanceKm: p.distanceKm, elevationM: p.elevationM }))
    : [];
  return {
    coordinates,
    distanceKm: isNum(route.distanceKm) ? route.distanceKm : pathLengthKm(points),
    elevationGainM: isNum(route.elevationGainM) ? route.elevationGainM : null,
    elevationProfile: profile.length > 0 ? thin(profile, MAX_PROFILE_POINTS) : null,
  };
}

/** The parts of a trail that are kept, or null when it cannot be told apart. */
export function slimTrail(trail) {
  if (!trail || typeof trail.id !== 'string' || !trail.id) return null;
  const out = {};
  TRAIL_FIELDS.forEach((key) => {
    if (trail[key] !== undefined) out[key] = trail[key];
  });
  return out;
}

function slimMaps(maps) {
  if (!Array.isArray(maps)) return [];
  const seen = new Set();
  const out = [];
  maps.forEach((m) => {
    if (!m || m.id === undefined || m.id === null || seen.has(String(m.id))) return;
    seen.add(String(m.id));
    out.push({ id: m.id, name: typeof m.name === 'string' && m.name ? m.name : 'Trail Map' });
  });
  return out.slice(0, MAX_PATHS_PER_TRAIL);
}

const sameContent = (a, b) => JSON.stringify({ ...a, savedAt: 0 }) === JSON.stringify({ ...b, savedAt: 0 });

/**
 * Adds what was found (`trail`, `maps`, `routes`) to what is already kept for
 * this trail. Returns the same record when nothing new was added, so a caller
 * can skip saving, and null when there is no trail to keep.
 *   pinned: the person saved this trail (bookmark), so it is the last to go.
 */
export function mergeOfflineTrail(previous, { trail, maps, routes, pinned } = {}, now = Date.now()) {
  const slim = slimTrail(trail);
  if (!slim) return null;
  const prev = previous && previous.id === slim.id ? previous : null;

  const mergedMaps = slimMaps([...(prev ? prev.maps : []), ...(Array.isArray(maps) ? maps : [])]);
  const mergedRoutes = { ...(prev ? prev.routes : {}) };
  const arrived = [];
  Object.keys(routes || {}).forEach((mapId) => {
    const slimmed = slimRoute(routes[mapId]);
    if (!slimmed) return;
    mergedRoutes[String(mapId)] = slimmed;
    arrived.push(String(mapId));
  });
  // Only a few paths are kept for a trail; the ones that just arrived stay.
  const keys = Object.keys(mergedRoutes);
  const surplus = keys.length - MAX_PATHS_PER_TRAIL;
  if (surplus > 0) {
    const dropOrder = [...keys.filter((k) => !arrived.includes(k)), ...keys.filter((k) => arrived.includes(k))];
    dropOrder.slice(0, surplus).forEach((k) => { delete mergedRoutes[k]; });
  }

  const next = {
    version: OFFLINE_VERSION,
    id: slim.id,
    savedAt: now,
    pinned: !!((prev && prev.pinned) || pinned),
    trail: { ...(prev ? prev.trail : {}), ...slim },
    maps: mergedMaps,
    routes: mergedRoutes,
  };
  return prev && sameContent(prev, next) ? prev : next;
}

const sizeOf = (record) => JSON.stringify(record).length;

/**
 * Drops the records that do not fit (too many trails, or too many characters
 * together): trails that were only started go first, oldest first, then saved
 * ones. `keepId` (the one just written) is never dropped.
 */
export function limitOfflineTrails(byId, { keepId, maxTrails = MAX_OFFLINE_TRAILS, maxChars = MAX_OFFLINE_CHARS } = {}) {
  const out = {};
  const sizes = {};
  Object.keys(byId || {}).forEach((id) => {
    if (!byId[id]) return;
    out[id] = byId[id];
    sizes[id] = sizeOf(byId[id]);
  });
  let chars = Object.keys(sizes).reduce((sum, id) => sum + sizes[id], 0);
  const next = () => Object.values(out)
    .filter((r) => r.id !== keepId)
    .sort((a, b) => (a.pinned === b.pinned ? (a.savedAt || 0) - (b.savedAt || 0) : (a.pinned ? 1 : -1)))[0];
  while (Object.keys(out).length > maxTrails || chars > maxChars) {
    const victim = next();
    if (!victim) break;
    chars -= sizes[victim.id];
    delete out[victim.id];
  }
  return out;
}

/** The kept line for a path, or null. A path that is not kept never gets another's line. */
export function cachedRoute(record, mapId) {
  if (!record || !record.routes || mapId === undefined || mapId === null) return null;
  const route = record.routes[String(mapId)];
  return route && Array.isArray(route.coordinates) && route.coordinates.length >= 2 ? route : null;
}

/**
 * Downloads what is not kept yet for a trail: the list of its paths, then the
 * line of each path (one at a time, so the trail service is not hit all at
 * once). Anything that fails is left out; the result only has what arrived.
 *   known: { maps, routes } already in hand, which are not asked for again.
 */
export async function downloadTrailForOffline({ trail, known = {}, fetchMaps, fetchRoute }) {
  let maps = slimMaps(known.maps);
  const routes = {};
  if (maps.length === 0 && trail && trail.source === 'trailapi' && typeof fetchMaps === 'function') {
    try {
      maps = slimMaps(await fetchMaps(String(trail.id).replace(/^trailapi-/, '')));
    } catch (e) {
      maps = [];
    }
  }
  const have = known.routes || {};
  for (let i = 0; i < maps.length; i += 1) {
    const key = String(maps[i].id);
    if (!have[key] && typeof fetchRoute === 'function') {
      try {
        const route = await fetchRoute(maps[i].id);
        if (route) routes[key] = route;
      } catch (e) {
        // This path is simply not kept.
      }
    }
  }
  return { maps, routes };
}

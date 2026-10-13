// lib/osmTrails.js
//
// Trail paths from OpenStreetMap, for the trail page's "Choose a Path". The trail
// service (TrailAPI) only has a drawn line for some trails; OpenStreetMap has the
// named paths of most parks, so this is what makes a trail show lines at all.
//
// Pure functions (no network): the question to ask OpenStreetMap's Overpass
// service, and how to turn its answer into paths. services/hikingService.js does
// the asking.
//
// OpenStreetMap stores a trail as many short pieces ("ways") that share end
// points, so the pieces with the same name are joined end to end into one line.
// Where a named trail is in two separate parts, each part is a path of its own.

import { distanceM } from './gpsFilter';
import { thin } from './offlineTrails';

/** A path from here starts with this, so it is never taken for a TrailAPI map id. */
export const OSM_PATH_PREFIX = 'osm-way-';
/** How far from the trail's point to look for paths, in metres. */
export const OSM_RADIUS_M = 2000;
/** The most paths offered for one trail. */
export const MAX_OSM_PATHS = 8;
/** Pieces shorter than this in total are side links and parking-lot paths, not trails. */
export const MIN_PATH_KM = 0.25;
// A line is thinned to this many points: plenty to draw a trail, light to keep.
const MAX_POINTS = 800;
// Pieces of a trail whose ends are this close (a road crossing between them) are one trail.
export const JOIN_TOLERANCE_M = 15;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

const toCoordinate = (value) => (
  (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null
);

/**
 * Where a trail is on the map, as { latitude, longitude }, or null when it has no usable
 * point. Numbers and numeric strings both count. Paths are looked for here, so the trail
 * page and the hike screen ask about the same spot and share one answer.
 */
export function trailPoint(trail) {
  if (!trail) return null;
  const latitude = toCoordinate(trail.latitude);
  const longitude = toCoordinate(trail.longitude);
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

export const osmPathId = (wayId) => `${OSM_PATH_PREFIX}${wayId}`;
export const isOsmPathId = (id) => typeof id === 'string' && id.startsWith(OSM_PATH_PREFIX);

/**
 * The question for Overpass: every named footpath, track or bridleway within
 * `radiusM` of the point, with its shape. Private and no-walking ways, and the
 * sidewalks and crossings beside roads, are left out.
 */
export function buildOverpassQuery(latitude, longitude, radiusM = OSM_RADIUS_M) {
  const lat = Number(latitude).toFixed(6);
  const lon = Number(longitude).toFixed(6);
  const radius = Math.max(1, Math.round(radiusM));
  return (
    '[out:json][timeout:25];'
    + `way(around:${radius},${lat},${lon})`
    + '["highway"~"^(path|footway|track|bridleway)$"]'
    + '["name"]'
    + '["access"!~"^(private|no)$"]'
    + '["foot"!~"^(no|private)$"]'
    + '["footway"!~"^(sidewalk|crossing|access_aisle)$"];'
    + 'out tags geom 800;'
  );
}

/** The way's points as { latitude, longitude }, or null when it has fewer than two usable ones. */
function wayPoints(element) {
  if (!element || !Array.isArray(element.geometry)) return null;
  const points = element.geometry
    .filter((g) => g && isNum(g.lat) && isNum(g.lon))
    .map((g) => ({ latitude: g.lat, longitude: g.lon }));
  return points.length >= 2 ? points : null;
}

/** Length of a line of points, in km. */
function lineKm(points) {
  let metres = 0;
  for (let i = 1; i < points.length; i += 1) metres += distanceM(points[i - 1], points[i]);
  return metres / 1000;
}

/**
 * Joins pieces that meet at an end point into lines, as many lines as there are
 * separate parts. Each piece is { id, points }; returns [{ ids, points }].
 * OpenStreetMap pieces of one trail share a point, but a trail is often cut by a
 * road crossing, so ends within `toleranceM` of each other are joined too.
 */
export function chainPieces(pieces, { toleranceM = JOIN_TOLERANCE_M } = {}) {
  const near = (a, b) => distanceM(a, b) <= toleranceM;
  // The same point twice (a shared node) is kept once; two points a few metres apart are both kept.
  const same = (a, b) => distanceM(a, b) < 0.5;
  const left = [...pieces].sort((a, b) => a.id - b.id);
  const lines = [];
  while (left.length > 0) {
    const first = left.shift();
    let points = first.points.slice();
    const ids = [first.id];
    let grew = true;
    while (grew) {
      grew = false;
      const head = points[0];
      const tail = points[points.length - 1];
      for (let i = 0; i < left.length; i += 1) {
        const piece = left[i].points;
        const from = piece[0];
        const to = piece[piece.length - 1];
        const back = piece.slice().reverse();
        if (near(tail, from)) points = points.concat(piece.slice(same(tail, from) ? 1 : 0));
        else if (near(tail, to)) points = points.concat(back.slice(same(tail, to) ? 1 : 0));
        else if (near(head, to)) points = piece.slice(0, same(head, to) ? -1 : piece.length).concat(points);
        else if (near(head, from)) points = back.slice(0, same(head, from) ? -1 : back.length).concat(points);
        else continue;
        ids.push(left[i].id);
        left.splice(i, 1);
        grew = true;
        break;
      }
    }
    lines.push({ ids, points });
  }
  return lines;
}

/**
 * Overpass's answer as paths, nearest to `origin` first:
 *   [{ id, name, route: { coordinates, distanceKm, elevationGainM, elevationProfile }, nearestM }]
 * OpenStreetMap has no heights, so the route has none. Anything unreadable gives [].
 */
export function parseOverpassPaths(data, { origin, minKm = MIN_PATH_KM, max = MAX_OSM_PATHS } = {}) {
  const elements = data && Array.isArray(data.elements) ? data.elements : [];
  const byName = new Map();
  elements.forEach((el) => {
    if (!el || el.type !== 'way' || !isNum(el.id)) return;
    const name = el.tags && typeof el.tags.name === 'string' ? el.tags.name.trim() : '';
    const points = wayPoints(el);
    if (!name || !points) return;
    const key = name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name, pieces: [] });
    byName.get(key).pieces.push({ id: el.id, points });
  });

  const found = [];
  byName.forEach(({ name, pieces }) => {
    chainPieces(pieces).forEach((line) => {
      const km = lineKm(line.points);
      if (km < minKm) return;
      const nearestM = origin && isNum(origin.latitude) && isNum(origin.longitude)
        ? line.points.reduce((least, p) => Math.min(least, distanceM(origin, p)), Infinity)
        : 0;
      found.push({ name, ids: line.ids, points: line.points, km, nearestM });
    });
  });

  found.sort((a, b) => (a.nearestM - b.nearestM) || (b.km - a.km) || (Math.min(...a.ids) - Math.min(...b.ids)));

  // Two separate parts of one trail get "2", "3"... after the name so they can be told apart.
  const seen = {};
  return found.slice(0, max).map((line) => {
    const key = line.name.toLowerCase();
    seen[key] = (seen[key] || 0) + 1;
    return {
      id: osmPathId(Math.min(...line.ids)),
      name: seen[key] > 1 ? `${line.name} ${seen[key]}` : line.name,
      route: {
        coordinates: thin(line.points, MAX_POINTS),
        distanceKm: Math.round(line.km * 100) / 100,
        elevationGainM: null,
        elevationProfile: null,
      },
      nearestM: Math.round(line.nearestM),
    };
  });
}

/** What the trail page keeps of the parsed paths: the list for the picker and the lines by id. */
export function splitPaths(paths) {
  const list = Array.isArray(paths) ? paths : [];
  const routes = {};
  list.forEach((p) => { routes[p.id] = p.route; });
  return {
    maps: list.map((p) => ({ id: p.id, name: p.name, distanceKm: p.route.distanceKm })),
    routes,
  };
}

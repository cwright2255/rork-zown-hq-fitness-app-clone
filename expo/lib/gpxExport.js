// lib/gpxExport.js
//
// Writes a route as a GPX file, the format hiking apps and GPS watches read, so
// a hike you recorded (or a trail you looked up) can be opened somewhere else.
// Pure: it makes the text and the file name; services/gpxShare.js hands the file
// to the phone's share sheet. (Reading GPX is lib/parseGpx.js.)
//
// The route goes in as one track with one segment: every app that reads GPX
// reads tracks. Points carry only latitude and longitude (a saved hike keeps no
// per-point time or height), which GPX allows.

import { hikeRoute, hikeTitle, describeHike } from './hikeLog';
import { localDateKey } from './localDate';

const CREATOR = 'Zown HQ';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const validPoint = (p) => !!p && isNum(p.latitude) && isNum(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

/** Text made safe to put between XML tags or inside a quoted value. */
export function xmlEscape(value) {
  return String(value === undefined || value === null ? '' : value)
    // Characters XML does not allow at all.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Up to 6 decimals (about 10 cm), without trailing zeros or exponent notation.
const coord = (n) => String(Number(n.toFixed(6)));

const isoOrNull = (value) => {
  const t = Date.parse(typeof value === 'string' ? value : '');
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/**
 * @param {{ name?: string, description?: string, time?: string, points: Array<{latitude:number, longitude:number}> }} route
 * @returns {string} GPX 1.1 text, or '' when there are fewer than two usable points
 */
export function buildGpx(route) {
  const { name, description, time, points } = route && typeof route === 'object' ? route : {};
  const pts = (Array.isArray(points) ? points : []).filter(validPoint);
  if (pts.length < 2) return '';
  const title = xmlEscape(name || 'Route');
  const desc = description ? `\n    <desc>${xmlEscape(description)}</desc>` : '';
  const when = isoOrNull(time);
  const stamp = when ? `\n    <time>${when}</time>` : '';
  // Written as an open and a close tag (not <trkpt .../>) so lib/parseGpx.js reads it back too.
  const body = pts.map((p) => `      <trkpt lat="${coord(p.latitude)}" lon="${coord(p.longitude)}"></trkpt>`).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<gpx version="1.1" creator="${CREATOR}" xmlns="http://www.topografix.com/GPX/1/1" `
      + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
      + 'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    `  <metadata>\n    <name>${title}</name>${desc}${stamp}\n  </metadata>`,
    '  <trk>',
    `    <name>${title}</name>${desc}`,
    '    <trkseg>',
    body,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/**
 * A file name that is safe on any phone: letters, numbers and dashes, with the
 * day when there is one. "Wharton State Forest" on 2026-10-09 is
 * "Wharton-State-Forest-2026-10-09.gpx".
 */
export function gpxFileName(title, when) {
  const slug = String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  const base = slug || 'hike';
  const t = Date.parse(typeof when === 'string' ? when : '');
  return Number.isFinite(t) ? `${base}-${localDateKey(new Date(t))}.gpx` : `${base}.gpx`;
}

/**
 * The GPX file for a recorded hike: { filename, title, xml }, or null when the
 * hike has no route to write (it was saved before routes were kept, or was too
 * short to draw).
 */
export function hikeGpxFile(hike) {
  const info = describeHike(hike);
  if (!info) return null;
  const when = hike.startTime || hike.completedAt;
  const name = info.pathName ? `${hikeTitle(hike)} (${info.pathName})` : hikeTitle(hike);
  const facts = [`${info.distanceText} km`, info.timeText];
  if (info.climb > 0) facts.push(`${info.climb} m climb`);
  const xml = buildGpx({ name, description: `Recorded with Zown HQ. ${facts.join(', ')}.`, time: when, points: hikeRoute(hike) });
  if (!xml) return null;
  return { filename: gpxFileName(hikeTitle(hike), when), title: name, xml };
}

/**
 * The GPX file for a trail's route as the trail service gave it:
 * { filename, title, xml }, or null when the route has fewer than two points.
 */
export function trailGpxFile(input) {
  const { trail, pathName, route } = input && typeof input === 'object' ? input : {};
  const points = route ? route.coordinates : [];
  const trailName = trail && typeof trail.name === 'string' ? trail.name.trim() : '';
  const path = typeof pathName === 'string' ? pathName.trim() : '';
  const name = [trailName || 'Trail', path].filter(Boolean).join(' - ');
  const km = route && isNum(route.distanceKm) ? route.distanceKm : null;
  const xml = buildGpx({
    name,
    description: km !== null ? `Trail route, ${km.toFixed(1)} km. From Zown HQ.` : 'Trail route. From Zown HQ.',
    points,
  });
  if (!xml) return null;
  return { filename: gpxFileName(name), title: name, xml };
}

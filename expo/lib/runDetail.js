// lib/runDetail.js
//
// Everything the run detail screen (app/running/run/[id].jsx) works out from a
// saved run: its title, the kilometre splits table and pace bars, and how to
// fit its route on a map. Pure functions, no React, so they are easy to test.
//
// Units match lib/runStats.js: distance km, duration seconds of moving time,
// pace seconds per km, splits seconds for each full kilometre.

import { ACTIVITIES, activityOf, cleanSplits, formatPace, routePoints } from './runStats';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The smallest share of the tallest bar, so the slowest kilometre still shows. */
export const MIN_BAR = 0.35;
/** A leftover bit of a kilometre shorter than this (km) is not shown as its own split. */
export const MIN_PARTIAL_KM = 0.05;

/** "Morning Run", "Evening Walk" and so on, from when the run started. */
export function runTitle(run) {
  const label = ACTIVITIES[activityOf(run)].label;
  const t = new Date((run && run.startTime) || '');
  if (Number.isNaN(t.getTime())) return `Free ${label}`;
  const h = t.getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ${label}`;
}

/** "Thu, Oct 8 • 7:30 AM", or "" when the run has no usable start time. */
export function runDateLabel(run) {
  const t = new Date((run && run.startTime) || '');
  if (Number.isNaN(t.getTime())) return '';
  const h = t.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = String(t.getMinutes()).padStart(2, '0');
  return `${WEEKDAYS[t.getDay()]}, ${MONTHS[t.getMonth()]} ${t.getDate()} • ${hour12}:${minutes} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "52:30" under an hour, "1:05:30" from an hour up. */
export function formatClock(seconds) {
  const total = Math.max(0, Math.round(num(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/** "+0:12" / "-0:05" / "0:00": how far a pace is from the average, in seconds. */
export function formatDelta(seconds) {
  const s = Math.round(num(seconds));
  if (s === 0) return '0:00';
  return `${s > 0 ? '+' : '-'}${formatPace(Math.abs(s))}`;
}

function barFor(pace, fast, slow) {
  if (!(pace > 0)) return MIN_BAR;
  if (!(slow > fast)) return 0.7;
  const f = MIN_BAR + (1 - MIN_BAR) * ((slow - pace) / (slow - fast));
  return Math.min(1, Math.max(0.15, f));
}

/**
 * The splits of a run for the pace bars and the table.
 * Returns { rows, avgPace, fastest, slowest } where each row is
 * { index, label, partial, seconds, pace, delta, bar, isFastest, isSlowest }.
 * `bar` is 0..1 and taller means faster. Runs without kilometre splits (older
 * runs, or anything under 1 km) give no rows.
 */
export function splitSummary(run) {
  const empty = { rows: [], avgPace: 0, fastest: null, slowest: null };
  const splits = cleanSplits(run && run.splits);
  if (splits.length === 0) return empty;

  const fast = Math.min(...splits);
  const slow = Math.max(...splits);
  const avgPace = splits.reduce((a, b) => a + b, 0) / splits.length;
  // With one split, or every split the same, nothing is "fastest" or "slowest".
  const varied = slow > fast;
  const fastestIndex = varied ? splits.indexOf(fast) : -1;
  const slowestIndex = varied ? splits.indexOf(slow) : -1;

  const rows = splits.map((seconds, i) => ({
    index: i,
    label: String(i + 1),
    partial: false,
    seconds,
    pace: seconds,
    delta: seconds - avgPace,
    bar: barFor(seconds, fast, slow),
    isFastest: i === fastestIndex,
    isSlowest: i === slowestIndex,
  }));

  // What is left after the last full kilometre, shown as a shorter final split.
  const doneKm = splits.length;
  const restKm = num(run.distance) - doneKm;
  const restSeconds = num(run.duration) - splits.reduce((a, b) => a + b, 0);
  if (restKm >= MIN_PARTIAL_KM && restKm < 1 && restSeconds > 0) {
    const pace = restSeconds / restKm;
    rows.push({
      index: doneKm,
      label: restKm.toFixed(2),
      partial: true,
      seconds: Math.round(restSeconds),
      pace,
      delta: pace - avgPace,
      bar: barFor(pace, fast, slow),
      isFastest: false,
      isSlowest: false,
    });
  }

  return {
    rows,
    avgPace,
    fastest: varied ? fastestIndex : null,
    slowest: varied ? slowestIndex : null,
  };
}

/**
 * A map region that fits the whole route with some room around it, or null
 * when there is no route. Widths are never smaller than about 450 m so a
 * short loop doesn't zoom in to nothing.
 */
export function routeRegion(points, { padding = 1.6, minDelta = 0.004 } = {}) {
  const pts = Array.isArray(points) ? points.filter((p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
  if (pts.length === 0) return null;
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(minDelta, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(minDelta, (maxLng - minLng) * padding),
  };
}

/**
 * A flat drawing of the route for places without a map: points in a
 * width x height box (equal scale in both directions, so the shape isn't
 * stretched), as an SVG "x,y x,y ..." string plus the first and last point.
 */
export function routeSketch(points, width = 300, height = 200, margin = 16) {
  const pts = Array.isArray(points) ? points.filter((p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) : [];
  if (pts.length < 2) return null;
  const midLat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = pts.map((p) => p.longitude * kx);
  const ys = pts.map((p) => -p.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? (width - 2 * margin) / spanX : Infinity,
    spanY > 0 ? (height - 2 * margin) / spanY : Infinity,
  );
  const k = Number.isFinite(scale) ? scale : 1;
  const offX = (width - spanX * k) / 2;
  const offY = (height - spanY * k) / 2;
  const mapped = pts.map((_, i) => ({
    x: Math.round((offX + (xs[i] - minX) * k) * 10) / 10,
    y: Math.round((offY + (ys[i] - minY) * k) * 10) / 10,
  }));
  return {
    points: mapped.map((p) => `${p.x},${p.y}`).join(' '),
    start: mapped[0],
    end: mapped[mapped.length - 1],
  };
}

/** Everything the detail screen shows, from one saved run. */
export function describeRun(run) {
  const distance = Math.max(0, num(run && run.distance));
  const duration = Math.max(0, num(run && run.duration));
  const points = routePoints(run);
  return {
    title: runTitle(run),
    when: runDateLabel(run),
    activity: activityOf(run),
    distanceText: distance.toFixed(2),
    timeText: formatClock(duration),
    calories: Math.max(0, Math.round(num(run && run.calories))),
    climb: num(run && run.elevGain) > 0 ? Math.round(run.elevGain) : 0,
    descent: num(run && run.elevLoss) > 0 ? Math.round(run.elevLoss) : 0,
    points,
    hasRoute: points.length >= 2,
    splits: splitSummary(run),
  };
}

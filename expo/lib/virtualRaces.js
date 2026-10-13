// lib/virtualRaces.js
//
// Virtual races: a Local 5K every week and a Worldwide 10K every month. You run
// the distance wherever you like, from the race screen, and your time goes on
// that race's board. Nothing here talks to Firebase or the phone; the rules are
// plain functions so they can be tested exactly.
//
//   currentRace          the race that is on now (its id changes each week / month)
//   raceTimeSec          your official time, from the kilometre splits of the run
//   isPlausibleTime      whether a time could be a person running (not a car)
//   areaOf / areasNear   a coarse square of the map instead of a position, for the local board
//   rankByTime, boardRows   the board, fastest first
//   formatRaceTime, ...  the words on the screens
//
// Distances are kilometres, times are whole seconds, as everywhere in Zown.

import { distanceM } from './gpsFilter';
import { KM_PER_MILE, formatDistance, paceIn, paceUnitLabel, usesMiles } from './distanceUnits';

export const RACES = {
  local: { kind: 'local', name: 'Local 5K', distanceKm: 5, cadence: 'weekly' },
  world: { kind: 'world', name: 'Worldwide 10K', distanceKm: 10, cadence: 'monthly' },
};
export const RACE_KINDS = Object.keys(RACES);

export function isRaceKind(kind) {
  return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(RACES, kind);
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * The race that is on at `now`: { id, kind, name, distanceKm, cadence, startsAt, endsAt }
 * (times in ms). The Local 5K runs Monday to Sunday on the phone's own calendar, so
 * "this week" matches the week of the people running near you. The Worldwide 10K runs
 * a calendar month in UTC, the same moment for everyone. Returns null for an unknown kind.
 */
export function currentRace(kind, now = new Date()) {
  if (!isRaceKind(kind)) return null;
  const at = new Date(now);
  if (kind === 'local') {
    const sinceMonday = (at.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const start = new Date(at.getFullYear(), at.getMonth(), at.getDate() - sinceMonday);
    const end = new Date(at.getFullYear(), at.getMonth(), at.getDate() - sinceMonday + 7);
    return {
      ...RACES.local,
      id: `local-5k-week-${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      startsAt: start.getTime(),
      endsAt: end.getTime(),
    };
  }
  const year = at.getUTCFullYear();
  const month = at.getUTCMonth();
  return {
    ...RACES.world,
    id: `world-10k-month-${year}-${pad(month + 1)}`,
    startsAt: Date.UTC(year, month, 1),
    endsAt: Date.UTC(year, month + 1, 1),
  };
}

/** True while `ms` falls inside the race's window. */
export function isRaceOpen(race, ms = Date.now()) {
  return !!race && ms >= race.startsAt && ms < race.endsAt;
}

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** "3 days left", "5 hours left", "Less than an hour left" or "Ended". */
export function timeLeftLabel(endsAt, now = Date.now()) {
  const left = endsAt - now;
  if (!(left > 0)) return 'Ended';
  if (left >= DAY) {
    const days = Math.floor(left / DAY);
    return `${days} ${days === 1 ? 'day' : 'days'} left`;
  }
  if (left >= HOUR) {
    const hours = Math.floor(left / HOUR);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`;
  }
  return 'Less than an hour left';
}

/** The document id for one person's result in one race. */
export function raceEntryId(raceId, uid) {
  return `${raceId}_${uid}`;
}

/**
 * Your official time in whole seconds: the moving time of the first `distanceKm`
 * kilometres of the run, added up from its kilometre splits (the tracker
 * records the time of each full kilometre as it is crossed, so a pause never
 * counts and what you do after the line does not matter). Null until that many
 * kilometres are done, or when the splits cannot be trusted.
 */
export function raceTimeSec(splits, distanceKm) {
  if (!Array.isArray(splits) || !Number.isInteger(distanceKm) || distanceKm < 1 || splits.length < distanceKm) return null;
  let total = 0;
  for (let i = 0; i < distanceKm; i += 1) {
    const seconds = Number(splits[i]);
    if (!(seconds > 0)) return null;
    total += seconds;
  }
  return Math.round(total);
}

/** Faster than this (seconds per km) is faster than the world record pace, so it is not a run. */
export const MIN_SEC_PER_KM = 140;
/** Slower than this (seconds per km) is a stroll; the board is for runs. */
export const MAX_SEC_PER_KM = 1800;

/** Whether `timeSec` over `distanceKm` could be a person running. */
export function isPlausibleTime(timeSec, distanceKm) {
  return Number.isInteger(timeSec) && distanceKm > 0
    && timeSec >= distanceKm * MIN_SEC_PER_KM && timeSec <= distanceKm * MAX_SEC_PER_KM;
}

/* ── Where, for the local board ── */

// The map is cut into squares this many to a degree (about 11 km north to south).
// A result carries only its square, never a position; the local board is every square
// whose middle is within LOCAL_RADIUS_KM of the person looking.
const CELLS_PER_DEGREE = 10;
const LAT_CELLS = 180 * CELLS_PER_DEGREE;
const LON_CELLS = 360 * CELLS_PER_DEGREE;
const KM_PER_DEGREE = 111.32;
/** "Local" is about 25 miles. */
export const LOCAL_RADIUS_MILES = 25;
export const LOCAL_RADIUS_KM = LOCAL_RADIUS_MILES * KM_PER_MILE;
/** The most squares one board asks for (far north the squares are narrow). */
export const MAX_AREAS = 150;

// A position as { latitude, longitude } numbers on the globe, or null.
function pointOf(point) {
  const latitude = point && point.latitude;
  const longitude = point && point.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  if (!(Math.abs(latitude) <= 90) || !(Math.abs(longitude) <= 180)) return null;
  return { latitude, longitude };
}

function cellId(row, col) {
  return `${row}x${col}`;
}

/** The map square a point is in, e.g. "1307x2252", or null when the point is not a position. */
export function areaOf(point) {
  const p = pointOf(point);
  if (!p) return null;
  const row = Math.min(LAT_CELLS - 1, Math.floor((p.latitude + 90) * CELLS_PER_DEGREE));
  const col = Math.floor((p.longitude + 180) * CELLS_PER_DEGREE) % LON_CELLS;
  return cellId(row, col);
}

/**
 * The map squares that count as local to a point: those whose middle is within
 * `radiusKm`, nearest first, always including the point's own square.
 */
export function areasNear(point, radiusKm = LOCAL_RADIUS_KM) {
  const p = pointOf(point);
  if (!p) return [];
  const radiusM = radiusKm * 1000;
  const latSpan = radiusKm / KM_PER_DEGREE;
  const firstRow = Math.max(0, Math.floor((p.latitude - latSpan + 90) * CELLS_PER_DEGREE));
  const lastRow = Math.min(LAT_CELLS - 1, Math.floor((p.latitude + latSpan + 90) * CELLS_PER_DEGREE));
  const found = new Map(); // square -> how far its middle is from the point, in metres
  for (let row = firstRow; row <= lastRow; row += 1) {
    const middleLat = (row + 0.5) / CELLS_PER_DEGREE - 90;
    // Squares get narrower toward the poles, so more of them fit in the same distance.
    const lonSpan = radiusKm / (KM_PER_DEGREE * Math.cos((middleLat * Math.PI) / 180));
    const firstCol = Math.floor((p.longitude - lonSpan + 180) * CELLS_PER_DEGREE);
    const lastCol = Math.min(firstCol + LON_CELLS - 1, Math.floor((p.longitude + lonSpan + 180) * CELLS_PER_DEGREE));
    for (let col = firstCol; col <= lastCol; col += 1) {
      const wrapped = ((col % LON_CELLS) + LON_CELLS) % LON_CELLS;
      const middle = { latitude: middleLat, longitude: (wrapped + 0.5) / CELLS_PER_DEGREE - 180 };
      const away = distanceM(p, middle);
      if (away <= radiusM) found.set(cellId(row, wrapped), away);
    }
  }
  found.set(areaOf(p), 0); // your own square is always local, and comes first
  return [...found].sort((a, b) => a[1] - b[1]).map(([id]) => id).slice(0, MAX_AREAS);
}

/* ── The board ── */

/** Longest picture address the board accepts (firestore.rules). */
export const AVATAR_MAX = 600;
const cleanName = (name) => String(name || '').trim().slice(0, 40) || 'Zown User';

/**
 * What goes on the board for one finished race: the name and picture people already
 * show on the leaderboards, the time, and (local race only) the map square the run
 * started in. Never a position.
 */
export function buildRaceEntry({ race, user, timeSec, finishedAt, areaId }) {
  const picture = user.profileImage;
  // A picture too long for the board (firestore.rules) is left off, not allowed to stop the time being posted.
  const avatar = typeof picture === 'string' && picture.startsWith('http') && picture.length <= AVATAR_MAX ? picture : null;
  return {
    raceId: race.id,
    uid: user.uid,
    kind: race.kind,
    distanceKm: race.distanceKm,
    name: cleanName(user.name),
    avatar,
    timeSec,
    finishedAt,
    areaId: race.kind === 'local' ? (areaId || null) : null,
  };
}

/** Fastest first; the same time goes to whoever finished first, then by id so the order never jumps. */
export function rankByTime(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && Number.isFinite(entry.timeSec) && entry.timeSec > 0)
    .sort((a, b) => a.timeSec - b.timeSec
      || String(a.finishedAt || '').localeCompare(String(b.finishedAt || ''))
      || String(a.uid || a.id || '').localeCompare(String(b.uid || b.id || '')))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/**
 * The rows to print: the board ranked, each marked `you` when it is yours. Your own
 * result is always shown, even when it did not make the part of the board that was
 * loaded; then it has no rank (null), since the rank would be a guess.
 */
export function boardRows(entries, mine, myUid) {
  const ranked = rankByTime(entries).map((entry) => ({ ...entry, you: !!myUid && entry.uid === myUid }));
  const shown = ranked.some((entry) => entry.you);
  const own = mine && Number.isFinite(mine.timeSec) && myUid && mine.uid === myUid;
  return own && !shown ? [...ranked, { ...mine, rank: null, you: true }] : ranked;
}

/* ── The words ── */

/** "24:31", or "1:02:05" past the hour. */
export function formatRaceTime(timeSec) {
  if (!Number.isFinite(timeSec) || timeSec < 0) return '--';
  const total = Math.round(timeSec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** The average pace of a race result, "8:03/mi" or "5:00/km". */
export function formatRacePace(timeSec, distanceKm, units) {
  if (!(timeSec > 0) || !(distanceKm > 0)) return '--';
  const perUnit = Math.round(paceIn(timeSec / distanceKm, units));
  return `${Math.floor(perUnit / 60)}:${pad(perUnit % 60)}${paceUnitLabel(units)}`;
}

/** "5K" in kilometres, "5K · 3.1 mi" when the person reads miles. */
export function raceDistanceText(race, units) {
  const name = `${race.distanceKm}K`;
  return usesMiles(units) ? `${name} · ${formatDistance(race.distanceKm, units, 1)}` : name;
}

/** "Weekly" / "Monthly" with how long is left, e.g. "Weekly · 3 days left". */
export function raceSchedule(race, now = Date.now()) {
  const cadence = race.cadence === 'weekly' ? 'Weekly' : 'Monthly';
  return `${cadence} · ${timeLeftLabel(race.endsAt, now)}`;
}

/** What a race is, for its screen. */
export function raceBlurb(kind, units) {
  if (kind === 'local') {
    const radius = usesMiles(units) ? `${LOCAL_RADIUS_MILES} miles` : `${Math.round(LOCAL_RADIUS_KM)} km`;
    return `Run 5K wherever you like this week. Your time is ranked against runners within about ${radius} of where you start.`;
  }
  return 'Run 10K wherever you like this month. Your time is ranked against everyone in Zown.';
}

// services/hikingService.js
//
// Two real data sources, tried in order:
//
// 1. TrailAPI (RapidAPI, built on Singletracks' trail database) — tried
//    first because its data is genuinely more hiking-specific than
//    Google's: a real trail length in miles, a dedicated activity type
//    (hiking vs. mountain biking vs. skiing), real driving directions text,
//    and GPX route downloads for a specific trail. Confidence level, to be
//    upfront about it:
//      - Base URL, header names (x-rapidapi-host, x-rapidapi-key), and two
//        endpoints — GET /trails/map/{id}/gpx/ and GET /trails/{id}/maps/
//        — are CONFIRMED directly: both verified against real curl
//        examples copied from RapidAPI's own docs for this API (checked
//        the constructed URLs are byte-identical to the real examples,
//        not just similar-looking).
//      - The lat/lon/radius nearby-search query pattern and the /trails/{id}
//        trail-detail endpoint — confirmed from a real third-party
//        project's working fetch() call plus a real example response
//        TrailAPI's own team posted in a support thread. Concrete, but
//        several years old.
//      - What's still genuinely unconfirmed: the *response shape* of
//        GET /trails/{id}/maps/. A curl example only shows what gets sent,
//        not what comes back — the endpoint path is now verified, but
//        getTrailMaps() below is still guessing at how to parse the
//        response (tries a couple of plausible shapes, fails soft rather
//        than assuming one is right). This is the one piece left to
//        actually smoke-test.
//      - A newer "MCP server" listing for the same API was checked
//        specifically for anything more current than the above — it
//        turned out to be a single-commit README with no verifiable
//        parameters, so it confirmed the tool *categories* (nearby search,
//        trail detail, GPX, maps list) without adding field-level detail.
//    Freemium: ~500 requests/day before billing, per a real developer's
//    account of using it. Needs a RapidAPI account + subscription to the
//    TrailAPI product, set as EXPO_PUBLIC_TRAILAPI_KEY.
//
// 2. Google Places API (New) — the fallback. This one WAS verified with a
//    real live search against a real location before any code was written
//    (see the audit) and is kept rather than discarded, specifically so a
//    TrailAPI outage, empty result set, or an unverified field mismatch
//    doesn't take the whole feature down. Needs its own key, see below.
//
// 3. OpenStreetMap (Overpass API) — not a search source, a source of trail PATHS:
//    fetchOsmPaths() below returns the named footpaths around a trail's point with
//    their shape, whichever of the two sources above found the trail. The trail
//    service has a drawn line for only some trails; OpenStreetMap covers most parks.
//
// Neither Trek4Free nor AllTrails were used directly — neither exposes a
// public API for third-party apps (confirmed by checking, not assumed).

import { parseGpxToRoute } from '@/lib/parseGpx';
import { buildOverpassQuery, isOsmPathId, parseOverpassPaths, splitPaths, OSM_RADIUS_M } from '@/lib/osmTrails';

// OpenStreetMap's Overpass service: the named paths of a park, with their shape,
// for the trail page's "Choose a Path". Free, no key. The second address is a
// public mirror, asked when the first is busy (it says so with a 429 or 504).
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
// A weak signal can leave a request hanging; after this long the next address is tried.
const OVERPASS_TIMEOUT_MS = 20000;
// The paths around a point do not change from one visit to the next, so an answer
// is reused for a while (opening the same trail again, coming back from the hike
// screen): quicker for the person, and kinder to a free public service.
const OSM_CACHE_MS = 15 * 60 * 1000;
const osmCache = new Map(); // "lat,lon,radius" -> { at, found }

const TRAILAPI_BASE = 'https://trailapi-trailapi.p.rapidapi.com';
const TRAILAPI_HOST = 'trailapi-trailapi.p.rapidapi.com';
const PLACES_API_BASE = 'https://places.googleapis.com/v1';

// Real fix, found from a screen-recording review: TrailAPI (the
// separate, non-Google data source merged in below) was observed
// returning the literal STRING "null" for at least one field
// (thumbnail) rather than actual JSON null when a value is genuinely
// absent - a plain `|| null`/`?? null` only catches real JS falsy
// values, so that string sails through as truthy. For a photo URL that
// crashed React Native's image loader outright; for rating/length,
// downstream .toFixed(1) calls on a non-numeric string would throw.
// Applied consistently across every TrailAPI field below rather than
// only the one that already crashed, since the same API quirk could
// affect any of them.
function sanitizeApiString(value) {
  if (!value || value === 'null' || value === 'undefined') return null;
  return value;
}
function sanitizeApiNumber(value) {
  if (value == null || value === 'null' || value === 'undefined') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// Trail-relevant Places types. `hiking_area` is the direct match; `park`
// and `state_park`/`national_park` are included too since many real trail
// systems (state forests, county parks) are typed as parks rather than
// hiking_area specifically — confirmed by real search results returning
// Wharton State Forest as `state_park` even though it has real trails.
const TRAIL_TYPES = ['hiking_area', 'park', 'state_park', 'national_park'];

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.photos',
  'places.regularOpeningHours',
  'places.types',
  'places.googleMapsUri',
].join(',');

function getTrailApiKey() {
  return process.env.EXPO_PUBLIC_TRAILAPI_KEY || null;
}

function getPlacesApiKey() {
  const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set. Enable "Places API (New)" in Google Cloud Console and set the key as an EAS secret.'
    );
  }
  return key;
}

/**
 * Real hiking trails / trail-bearing parks within radiusMeters of a real
 * GPS position. Tries TrailAPI first, falls back to Google Places if
 * TrailAPI isn't configured, errors, or returns nothing usable.
 */
export async function searchNearbyTrails({ latitude, longitude, radiusMeters = 24000 }) {
  const trailApiKey = getTrailApiKey();
  if (trailApiKey) {
    try {
      const trails = await searchTrailApi({ latitude, longitude, radiusMeters, apiKey: trailApiKey });
      if (trails.length > 0) return trails;
    } catch (e) {
      console.warn('[hikingService] TrailAPI failed, falling back to Places:', e?.message);
    }
  }
  return searchPlacesApi({ latitude, longitude, radiusMeters });
}

async function searchTrailApi({ latitude, longitude, radiusMeters, apiKey }) {
  const radiusMiles = Math.round(radiusMeters / 1609.34);
  const url = `${TRAILAPI_BASE}/?lat=${latitude}&lon=${longitude}&radius=${radiusMiles}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': TRAILAPI_HOST,
    },
  });

  if (!res.ok) {
    throw new Error(`TrailAPI request failed: ${res.status}`);
  }

  const data = await res.json();
  const places = data.places || [];

  const trails = [];
  places.forEach((place) => {
    // A single physical location can have multiple activity types (e.g. a
    // resort with both hiking and mountain biking) — only surface the
    // hiking-relevant ones here, this is the hiking section, not a general
    // outdoor-recreation directory.
    const hikingActivities = (place.activities || []).filter((a) =>
      /hik|trail|walk/i.test(a.activity_type_name || '')
    );
    const activity = hikingActivities[0] || place.activities?.[0];
    if (!place.lat || !place.lon) return;

    trails.push({
      id: `trailapi-${place.unique_id}`,
      name: sanitizeApiString(activity?.name) || place.name || 'Unnamed Trail',
      address: [place.city, place.state].filter(Boolean).join(', ') || place.country || '',
      latitude: place.lat,
      longitude: place.lon,
      rating: sanitizeApiNumber(activity?.rating),
      ratingCount: 0, // TrailAPI's example response doesn't include a review count
      isOpen: null, // no opening-hours concept for a trail in this data source
      types: ['hiking_area'],
      googleMapsUri: null,
      directions: place.directions || null,
      lengthMiles: sanitizeApiNumber(activity?.length),
      photoUrl: sanitizeApiString(activity?.thumbnail), // direct URL, no two-step fetch needed unlike Places
      photoName: null,
      distanceKm: haversineKm(latitude, longitude, place.lat, place.lon),
      source: 'trailapi',
    });
  });

  return trails;
}

async function searchPlacesApi({ latitude, longitude, radiusMeters }) {
  const apiKey = getPlacesApiKey();

  const res = await fetch(`${PLACES_API_BASE}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: TRAIL_TYPES,
      maxResultCount: 20,
      rankPreference: 'DISTANCE',
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Places searchNearby failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const places = data.places || [];

  return places.map((p) => normalizePlacesTrail(p, latitude, longitude));
}

function normalizePlacesTrail(place, userLat, userLng) {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  return {
    id: place.id,
    name: place.displayName?.text || 'Unnamed Trail',
    address: place.formattedAddress || '',
    latitude: lat,
    longitude: lng,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? 0,
    isOpen: place.regularOpeningHours?.openNow ?? null,
    types: place.types || [],
    googleMapsUri: place.googleMapsUri || null,
    directions: null,
    lengthMiles: null, // Places doesn't have a structured trail-length field
    photoUrl: null, // resolved lazily via getPhotoUrl() below, unlike TrailAPI's direct thumbnail
    photoName: place.photos?.[0]?.name || null,
    distanceKm: lat && lng ? haversineKm(userLat, userLng, lat, lng) : null,
    source: 'places',
  };
}

/**
 * Resolves a Google Places photo resource name to an actual image URL.
 * Only relevant for source:'places' trails — TrailAPI results already have
 * a direct photoUrl and don't need this.
 */
export function getPhotoUrl(photoName, maxWidthPx = 500) {
  if (!photoName) return null;
  const apiKey = getPlacesApiKey();
  return `${PLACES_API_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}

/**
 * Real trail route data (GPX format — lat/lon/elevation points along the
 * actual path, not just the trailhead location). CONFIRMED endpoint —
 * GET /trails/map/{id}/gpx/ — verified directly against a real curl
 * example from RapidAPI's own docs for this API, not inferred.
 *
 * Requires a real map id, which currently has no confirmed way to obtain
 * for an arbitrary trail (see getTrailMaps() below) — this function is
 * correct and ready to use once a real id is available (e.g. from a
 * response you've inspected directly, or once getTrailMaps() is verified).
 */
export async function getTrailGpx(mapId) {
  const apiKey = getTrailApiKey();
  if (!apiKey) throw new Error('EXPO_PUBLIC_TRAILAPI_KEY is not set.');
  if (!mapId) throw new Error('getTrailGpx requires a real map id.');

  const res = await fetch(`${TRAILAPI_BASE}/trails/map/${encodeURIComponent(mapId)}/gpx/`, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': TRAILAPI_HOST,
    },
  });

  if (!res.ok) {
    throw new Error(`TrailAPI GPX request failed: ${res.status}`);
  }

  // GPX is XML, not JSON — returned as text for the caller to parse or
  // hand off to a GPX-rendering library / share sheet as-is.
  return res.text();
}

/**
 * The endpoint itself is now CONFIRMED — GET /trails/{id}/maps/ — verified
 * directly against a real curl example (checked the constructed URL is
 * byte-identical to it, same as getTrailGpx() below). What's still
 * genuinely unconfirmed is the response *shape*: a curl request only shows
 * what gets sent, not what comes back, so the parsing below is still a
 * reasonable guess, not verified fact — tries a couple of plausible
 * response shapes rather than assuming one, but if you run this for real
 * and it comes back empty or wrong, the JSON parsing here (not the URL)
 * is where to look first.
 */
export async function getTrailMaps(trailId) {
  const apiKey = getTrailApiKey();
  if (!apiKey) throw new Error('EXPO_PUBLIC_TRAILAPI_KEY is not set.');

  const res = await fetch(`${TRAILAPI_BASE}/trails/${encodeURIComponent(trailId)}/maps/`, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': TRAILAPI_HOST,
    },
  });

  if (!res.ok) {
    throw new Error(`TrailAPI maps list request failed: ${res.status}`);
  }

  const data = await res.json();
  // Tries the two most likely shapes (a bare array, or {data: [...]} /
  // {maps: [...]} wrappers matching the shapes seen elsewhere in this
  // API) rather than assuming one is correct.
  const list = Array.isArray(data) ? data : (data.maps || data.data || []);
  // Real diagnostic, not decoration: a live test showed the path picker
  // never appearing at all, meaning this returned 0 or 1 maps for that
  // trail - logging the actual raw shape here (not guessing a fourth
  // time) tells us definitively whether that's because this trail
  // genuinely has no multi-path data, or because the response shape
  // guess above doesn't match what the API actually returns.
  console.log('[hikingService] getTrailMaps raw response:', JSON.stringify(data).slice(0, 500));
  console.log('[hikingService] getTrailMaps parsed list length:', list.length);
  return list.map((m) => ({ id: m.id ?? m.unique_id ?? m.map_id, name: m.name || 'Trail Map' }));
}

/**
 * Orchestrates the full real-route chain: list a trail's maps, download
 * the first one's GPX, parse it into coordinates. Built defensively on
 * purpose — every step in this chain has a different confidence level
 * (see the header comment), so any single failure returns null rather
 * than throwing, and the caller (the trail detail screen) treats null as
 * "no route available" and simply doesn't show that section, rather than
 * showing an error for something that was always an optional enhancement.
 */
export async function fetchTrailRoute(trailId) {
  if (!trailId || !getTrailApiKey()) return null;
  try {
    const maps = await getTrailMaps(trailId);
    const firstMap = maps?.[0];
    if (!firstMap?.id) return null;

    return await fetchRouteForMap(firstMap.id);
  } catch (e) {
    console.warn('[hikingService] fetchTrailRoute failed (non-fatal, route section will just be hidden):', e?.message);
    return null;
  }
}

/**
 * Real route data for ONE specific map id - the piece fetchTrailRoute
 * above now delegates to, extracted so the trail detail screen can also
 * fetch a route for whichever specific path the user picks from
 * getTrailMaps()'s real list, not just automatically the first one.
 * Same defensive contract: returns null on any failure rather than
 * throwing, since a route is always an optional enhancement.
 */
export async function fetchRouteForMap(mapId) {
  if (!mapId) return null;
  // A path from OpenStreetMap comes with its line (fetchOsmPaths), and is not a TrailAPI map to download.
  if (isOsmPathId(String(mapId))) return null;
  try {
    const gpxXml = await getTrailGpx(mapId);
    return parseGpxToRoute(gpxXml);
  } catch (e) {
    console.warn('[hikingService] fetchRouteForMap failed:', e?.message);
    return null;
  }
}

async function askOverpass(url, query) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller ? controller.signal : undefined,
    });
    if (!res.ok) throw new Error(`Overpass request failed: ${res.status}`);
    const data = await res.json();
    // A busy server can answer 200 with a remark and nothing else; that is a failure, not "no paths here".
    const empty = !data || !Array.isArray(data.elements) || data.elements.length === 0;
    if (empty && data && typeof data.remark === 'string' && /error|timed out|out of memory/i.test(data.remark)) {
      throw new Error(`Overpass could not answer: ${data.remark}`);
    }
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The named paths of the park around a trail's point, from OpenStreetMap:
 * { maps: [{ id, name, distanceKm }], routes: { [id]: { coordinates, distanceKm, ... } } }.
 * Every path comes with its line, so choosing one needs no second request.
 * `maps` is empty when OpenStreetMap has no named paths there. Throws when no
 * address answers (no signal), so the page can say "could not load" rather than
 * "none found".
 */
export async function fetchOsmPaths({ latitude, longitude, radiusM = OSM_RADIUS_M }) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { maps: [], routes: {} };
  // About 10 m: two visits to one trail ask about the same point even if the last digit differs.
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)},${Math.round(radiusM)}`;
  const cached = osmCache.get(cacheKey);
  if (cached && Date.now() - cached.at < OSM_CACHE_MS) return cached.found;
  const query = buildOverpassQuery(latitude, longitude, radiusM);
  let lastError = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const data = await askOverpass(url, query);
      const found = splitPaths(parseOverpassPaths(data, { origin: { latitude, longitude } }));
      osmCache.set(cacheKey, { at: Date.now(), found });
      return found;
    } catch (e) {
      lastError = e;
      console.warn('[hikingService] Overpass request failed:', url, e?.message);
    }
  }
  throw lastError || new Error('Overpass could not be reached.');
}

/** Forgets the paths reused from earlier answers (the next call asks again). */
export function clearOsmPathCache() {
  osmCache.clear();
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

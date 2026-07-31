// lib/parseGpx.js
//
// Turns raw GPX XML (from services/hikingService.js's getTrailGpx()) into
// a plain coordinate array a react-native-maps <Polyline> can render
// directly, plus real stats computed from the actual points (distance,
// elevation gain) rather than trusting whatever summary fields a GPX file
// may or may not include.
//
// Uses a regex extraction rather than a full XML parser. GPX's <trkpt>
// structure is simple and standardized enough that this is reliable
// without pulling in a new dependency (React Native doesn't ship a
// dependable DOMParser across environments) - this is the same practical
// tradeoff, not a shortcut taken without considering the real option.

const TRKPT_REGEX = /<trkpt\s+lat="(-?\d+\.?\d*)"\s+lon="(-?\d+\.?\d*)"[^>]*>([\s\S]*?)<\/trkpt>/g;
const ELE_REGEX = /<ele>(-?\d+\.?\d*)<\/ele>/;

/**
 * @param {string} gpxXml
 * @returns {{
 *   coordinates: Array<{latitude:number, longitude:number}>,
 *   distanceKm: number,
 *   elevationGainM: number|null,
 *   elevationProfile: Array<{distanceKm:number, elevationM:number}> | null
 * } | null}
 *   Returns null if no track points were found - the caller should treat
 *   that as "no route available" and hide the route UI, not as an error.
 *   elevationProfile is null (not an empty array) when the GPX has no
 *   elevation data at all, so callers can distinguish "no chart to draw"
 *   from "chart with zero climb."
 */
export function parseGpxToRoute(gpxXml) {
  if (!gpxXml || typeof gpxXml !== 'string') return null;

  const points = [];
  let match;
  TRKPT_REGEX.lastIndex = 0;
  while ((match = TRKPT_REGEX.exec(gpxXml)) !== null) {
    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) continue;

    const eleMatch = ELE_REGEX.exec(match[3]);
    const elevation = eleMatch ? parseFloat(eleMatch[1]) : null;

    points.push({ latitude, longitude, elevation });
  }

  if (points.length === 0) return null;

  let distanceKm = 0;
  let elevationGainM = 0;
  let hasElevation = points[0].elevation != null;
  const elevationProfile = hasElevation ? [{ distanceKm: 0, elevationM: points[0].elevation }] : null;

  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude, points[i].longitude
    );
    if (hasElevation && points[i].elevation != null && points[i - 1].elevation != null) {
      const gain = points[i].elevation - points[i - 1].elevation;
      if (gain > 0) elevationGainM += gain;
      elevationProfile.push({ distanceKm: Math.round(distanceKm * 1000) / 1000, elevationM: points[i].elevation });
    } else {
      hasElevation = false;
    }
  }

  return {
    coordinates: points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    distanceKm: Math.round(distanceKm * 100) / 100,
    elevationGainM: hasElevation ? Math.round(elevationGainM) : null,
    elevationProfile: hasElevation ? elevationProfile : null,
  };
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

// services/weatherService.js
//
// Real weather data via api.weather.gov - the National Weather Service's
// public API. Chosen specifically for the alerts endpoint: this is the
// actual, authoritative source real severe weather warnings come from in
// the US (tornado warnings, flash flood warnings, extreme heat advisories,
// etc.) - the exact "unforeseen risk" signal this feature exists to catch,
// not a generic weather app's own severity heuristic.
//
// Real, meaningful advantages for this specific use case:
//   - No API key, no account, no billing. A User-Agent header identifying
//     the app is the only requirement - confirmed directly from NWS's own
//     current documentation, not assumed.
//   - point={lat},{lon} alerts filtering is real and documented (checked
//     specifically, since a state-wide alert isn't precise enough to tell
//     someone at a specific trailhead whether they're actually at risk).
//
// Real limitation, stated plainly: NWS is a US government service and
// only covers the US. Every function here fails soft (returns null) for
// coordinates outside NWS's coverage rather than throwing - consistent
// with this feature's existing US/Canada-centered scope (see
// hikingService.js's TrailAPI integration).

const NWS_BASE = 'https://api.weather.gov';
// Identifies the app per NWS's authentication requirement - not a secret,
// doesn't need an env var. Update the contact if this ships for real.
const USER_AGENT = '(zownhq.app, contact@zownhq.app)';

async function nwsFetch(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
  });
  if (!res.ok) {
    if (res.status === 404) return null; // coordinate outside NWS coverage (not US)
    throw new Error(`NWS request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Resolves a lat/lon to its NWS forecast grid, needed before fetching an
 * actual forecast. Cache the result per the location if calling this
 * often - NWS's own docs note the office/grid mapping rarely changes.
 */
async function getGridPoint(latitude, longitude) {
  // NWS doesn't accept more than 4 decimal places of precision - rounds
  // rather than letting a more-precise GPS coordinate cause a request
  // error.
  const lat = Math.round(latitude * 10000) / 10000;
  const lon = Math.round(longitude * 10000) / 10000;
  const data = await nwsFetch(`${NWS_BASE}/points/${lat},${lon}`);
  return data?.properties || null;
}

/**
 * Real current/near-term forecast for a location - temperature, short
 * forecast text, wind, precipitation chance, for the next several 12-hour
 * periods. Returns null for non-US coordinates or any request failure,
 * never throws to the caller.
 */
export async function getForecast(latitude, longitude) {
  try {
    const gridPoint = await getGridPoint(latitude, longitude);
    if (!gridPoint?.forecast) return null;

    const forecastData = await nwsFetch(gridPoint.forecast);
    const periods = forecastData?.properties?.periods || [];
    return periods.slice(0, 4).map((p) => ({
      name: p.name, // e.g. "Today", "Tonight", "Tuesday"
      temperatureF: p.temperature,
      shortForecast: p.shortForecast, // e.g. "Slight Chance Showers"
      windSpeed: p.windSpeed, // e.g. "10 to 15 mph"
      windDirection: p.windDirection,
      precipitationChance: p.probabilityOfPrecipitation?.value ?? null,
      isDaytime: p.isDaytime,
    }));
  } catch (e) {
    console.warn('[weatherService] getForecast failed:', e?.message);
    return null;
  }
}

// NWS severity levels, ranked so the UI can sort/highlight by how serious
// an alert actually is rather than just listing them in API order.
const SEVERITY_RANK = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1, Unknown: 0 };

/**
 * Real, currently-active severe weather alerts for the exact coordinate
 * given - not state-wide, the specific point. This is the core "avoid
 * unforeseen risk" data: tornado/severe thunderstorm/flash flood warnings,
 * extreme heat/cold advisories, etc., as actually issued by NWS, not a
 * generic bad-weather guess.
 */
export async function getActiveAlerts(latitude, longitude) {
  try {
    const lat = Math.round(latitude * 10000) / 10000;
    const lon = Math.round(longitude * 10000) / 10000;
    const data = await nwsFetch(`${NWS_BASE}/alerts/active?point=${lat},${lon}`);
    const features = data?.features || [];

    return features
      .map((f) => ({
        id: f.id,
        event: f.properties.event, // e.g. "Flash Flood Warning"
        headline: f.properties.headline,
        severity: f.properties.severity, // Extreme | Severe | Moderate | Minor | Unknown
        certainty: f.properties.certainty,
        urgency: f.properties.urgency,
        description: f.properties.description,
        instruction: f.properties.instruction, // real, official safety guidance text
        areaDesc: f.properties.areaDesc,
        effective: f.properties.effective,
        expires: f.properties.expires,
      }))
      .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0));
  } catch (e) {
    console.warn('[weatherService] getActiveAlerts failed:', e?.message);
    return [];
  }
}

/**
 * Combines both calls for a single "here's the real risk picture right
 * now" check - used both for the pre-hike preview and for periodic
 * polling during an active hike.
 */
export async function getWeatherSnapshot(latitude, longitude) {
  const [forecast, alerts] = await Promise.all([
    getForecast(latitude, longitude),
    getActiveAlerts(latitude, longitude),
  ]);
  return { forecast, alerts, checkedAt: new Date().toISOString() };
}

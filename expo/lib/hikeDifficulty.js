// lib/hikeDifficulty.js
//
// Real trail difficulty rating — the Shenandoah National Park formula,
// the same one used by NPS's own site and widely adopted across hiking
// guides (Rocky Mountain NP, TrailsNH, and others independently cite the
// same formula and tier thresholds). Verified against two real, published
// worked examples before trusting it: a 10mi/2200ft hike computing to
// 209.8 (NPS's own example) and an 11mi/4077ft hike computing to 299.5
// (a second, independent source) — both matched exactly, not
// approximately.
//
// Difficulty = √(elevation gain in feet × 2 × distance in miles)

const TIERS = [
  { max: 50, label: 'Easy', xpMultiplier: 1.0, met: 3.8 },
  { max: 100, label: 'Moderate', xpMultiplier: 1.4, met: 6.0 },
  { max: 150, label: 'Challenging', xpMultiplier: 1.8, met: 7.0 },
  { max: 200, label: 'Strenuous', xpMultiplier: 2.2, met: 8.0 },
  { max: Infinity, label: 'Very Strenuous', xpMultiplier: 2.6, met: 9.0 },
];

// MET (Metabolic Equivalent of Task) values by terrain/grade, from the
// Compendium of Physical Activities (Ainsworth et al.) — the standard
// academic reference sports scientists use for this, not an invented
// scale. Mapped from the same difficulty tier already computed above
// (steeper/harder hikes → higher MET), rather than maintaining a second,
// disconnected difficulty classification just for calories.
const DEFAULT_WEIGHT_KG = 70; // used only if no real body-scan weight is available

/**
 * Real calorie estimate for a completed hike, using the standard MET
 * formula: Calories = (MET x 3.5 x weight_kg) / 200 x duration_minutes.
 * @param {{ tier: string, durationSeconds: number, weightKg?: number }} params
 */
export function estimateHikeCalories({ tier, durationSeconds, weightKg }) {
  const tierConfig = TIERS.find((t) => t.label === tier) || TIERS[1];
  const weight = weightKg || DEFAULT_WEIGHT_KG;
  const durationMinutes = durationSeconds / 60;
  const calories = ((tierConfig.met * 3.5 * weight) / 200) * durationMinutes;
  return Math.round(calories);
}

const METERS_TO_FEET = 3.28084;
const KM_TO_MILES = 0.621371;

/**
 * @param {{ distanceKm: number, elevationGainM: number }} params - both in
 *   the metric units this app already uses everywhere else (matching
 *   lib/parseGpx.js's output and the live-tracked GPS distance).
 */
export function calculateHikeDifficulty({ distanceKm, elevationGainM }) {
  const distanceMiles = distanceKm * KM_TO_MILES;
  const elevationGainFt = (elevationGainM || 0) * METERS_TO_FEET;

  // A flat or near-flat short walk shouldn't compute to a real Shenandoah
  // score at all — the formula was designed for actual trail hikes, not a
  // 200m stroll, and would otherwise report a technically-accurate but
  // meaningless "Easy: 3.2" for something that isn't really a rated hike.
  if (distanceMiles < 0.25) {
    return { score: 0, tier: 'Easy', xpMultiplier: 1.0, distanceMiles, elevationGainFt };
  }

  const score = Math.sqrt(elevationGainFt * 2 * distanceMiles);
  const tier = TIERS.find((t) => score < t.max) || TIERS[TIERS.length - 1];

  return {
    score: Math.round(score * 10) / 10,
    tier: tier.label,
    xpMultiplier: tier.xpMultiplier,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    elevationGainFt: Math.round(elevationGainFt),
  };
}

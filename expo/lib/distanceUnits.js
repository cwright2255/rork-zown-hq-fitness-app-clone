// lib/distanceUnits.js
//
// Distances and paces are saved in kilometres everywhere in Zown. What a person
// sees follows Settings > Distance Units ('imperial' shows miles, 'metric' shows
// kilometres). These helpers only change what is shown: nothing saved is converted.
//
// `units` is the Settings value. Anything but 'imperial', including nothing passed,
// stays in kilometres, so a caller that has no setting keeps the old behaviour.

export const KM_PER_MILE = 1.609344;

/** Whether the Settings value means miles. */
export function usesMiles(units) {
  return units === 'imperial';
}

/** 'mi' or 'km'. */
export function distanceUnitLabel(units) {
  return usesMiles(units) ? 'mi' : 'km';
}

/** '/mi' or '/km', for a pace. */
export function paceUnitLabel(units) {
  return usesMiles(units) ? '/mi' : '/km';
}

const finite = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Miles to the kilometres the app saves (a trail's length arrives in miles). */
export function milesToKm(miles) {
  return finite(miles) * KM_PER_MILE;
}

/** A distance saved in km, as a number in the shown unit. */
export function distanceIn(km, units) {
  const v = finite(km);
  return usesMiles(units) ? v / KM_PER_MILE : v;
}

/** The number alone, e.g. "3.1" (for a screen that prints the unit beside it). */
export function formatDistanceValue(km, units, digits = 1) {
  return distanceIn(km, units).toFixed(digits);
}

/** Number and unit, e.g. "3.1 mi" or "5.0 km". */
export function formatDistance(km, units, digits = 1) {
  return `${formatDistanceValue(km, units, digits)} ${distanceUnitLabel(units)}`;
}

/** Same, without the space the unit takes in a sentence: "5.2km" for a share caption. */
export function formatDistanceTight(km, units, digits = 2) {
  return `${formatDistanceValue(km, units, digits)}${distanceUnitLabel(units)}`;
}

/**
 * A pace saved as seconds per km, as seconds per shown unit. A pace that is not a
 * number comes back 0, which the pace formatters already show as "--".
 */
export function paceIn(secPerKm, units) {
  const v = finite(secPerKm);
  return usesMiles(units) ? v * KM_PER_MILE : v;
}

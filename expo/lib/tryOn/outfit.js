// lib/tryOn/outfit.js
//
// What is worn at once. One garment of each slot ('top', 'bottom') can be worn together, such as a hoodie over sweatpants or shorts. An outfit is
// { top: key | null, bottom: key | null }. The bottom is fitted first and never changed by what goes over it; the top is then fitted and kept outside the
// bottom (fitGarment in lib/tryOn/tryOnSession.js takes the garments under it as `under`).
import { GARMENTS } from './garments';

export const SLOTS = ['bottom', 'top']; // underneath first: the order the garments are fitted and drawn in

export const EMPTY_OUTFIT = Object.freeze({ top: null, bottom: null });

/** The slot ('top' | 'bottom') of a garment of this group, or null when there is no such garment. */
export function slotOf(group, key) {
  const g = GARMENTS.find((x) => x.group === group && x.key === key);
  return g ? g.slot : null;
}

/**
 * The outfit after the person taps a garment: tapping one that is worn takes it off; tapping one that is not worn puts it on in its slot
 * (replacing whatever was worn there). Garments of another group, or unknown ones, change nothing.
 */
export function tapGarment(outfit, group, key) {
  const slot = slotOf(group, key);
  if (!slot) return outfit;
  return { ...outfit, [slot]: outfit[slot] === key ? null : key };
}

/** The garment keys worn, underneath first: [bottom, top] without the empty slots. */
export function wornKeys(outfit) {
  return SLOTS.map((slot) => outfit[slot]).filter(Boolean);
}

/** True when this garment is worn in the outfit. */
export function isWorn(outfit, key) {
  return outfit.top === key || outfit.bottom === key;
}

/** The garment keys that are worn over this one: a top is over a bottom, nothing is over a top. */
export function wornOver(outfit, key) {
  return outfit.top && outfit.bottom === key ? [outfit.top] : [];
}

/** The garment keys worn under this one: a bottom is under a top. */
export function wornUnder(outfit, key) {
  return outfit.bottom && outfit.top === key ? [outfit.bottom] : [];
}

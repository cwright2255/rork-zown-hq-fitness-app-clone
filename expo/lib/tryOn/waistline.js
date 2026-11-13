// lib/tryOn/waistline.js
//
// Puts the waistband of shorts and pants where a waistband goes: just under the navel. The drape packs were simulated with the band at a nearly fixed
// fraction of body height (about 60 %), which on most bodies is above the navel (shorts: 2-3 cm above it, sweatpants: 6-9 cm above it). A fixed fraction
// of height is not where a person's waist is, so the band is placed against the body's own navel instead.
//
// The garment is squashed up-and-down about its hem: the band moves down to its place, the hem stays where the simulation put it (a rigid move would
// push the cuffs of sweatpants through the floor on short bodies), and everything in between moves in proportion. The sideways and front-to-back
// shape of the garment is not touched; the push that keeps the garment off the skin runs after this and settles it on the body where the band now is.
//
// Frame: the body model's own (x sideways, y front-to-back, z up), the frame the blend gives the garment in.

// The navel on the body model's mesh (13,718 vertices): the deepest point of the dip in the belly. It is the same point on every body, so it follows
// the body's shape. Found on the mean body, where it is the strongest dip on the front of the belly, and checked on 128 bodies.
export const NAVEL_VERTEX = 4104;

// How far under the navel the top of the band goes, in metres: the reference fit for shorts has the band a little under the navel.
export const WAIST_BELOW_NAVEL = 0.03;

// The most the band is ever moved down, in metres. The usual move is 5-12 cm; this stops one odd body from squashing the garment out of shape.
export const MAX_LOWERING = 0.2;

// The least height the garment must have (top to hem) for it to be squashed, and the least move worth making (1 mm), in metres.
const MIN_SPAN = 0.05;
const MIN_MOVE = 0.001;

/** The height of the navel on a body (Float32Array, 3 per vertex), or null when the body has no such vertex. */
export function navelHeight(body) {
  if (!body || body.length < 3 * (NAVEL_VERTEX + 1)) return null;
  const z = body[3 * NAVEL_VERTEX + 2];
  return Number.isFinite(z) ? z : null;
}

/**
 * Moves the band of a garment (points: Float32Array, 3 per point, changed in place) down so its top is `below` metres under the body's navel, keeping the
 * hem where it is. A band that is already at or under that height (to within a millimetre) is left alone. Returns how far the top moved, in metres (0 when nothing moved).
 */
export function lowerWaistband(points, body, below = WAIST_BELOW_NAVEL) {
  const navel = navelHeight(body);
  if (navel === null || !points || points.length < 6) return 0;
  let top = -Infinity;
  let hem = Infinity;
  for (let i = 2; i < points.length; i += 3) {
    const z = points[i];
    if (!Number.isFinite(z)) return 0;
    if (z > top) top = z;
    if (z < hem) hem = z;
  }
  const span = top - hem;
  if (!(span >= MIN_SPAN)) return 0;
  const move = Math.min(top - (navel - below), MAX_LOWERING);
  if (!(move > MIN_MOVE)) return 0;
  for (let i = 2; i < points.length; i += 3) points[i] -= move * (points[i] - hem) / span;
  return move;
}

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
// Pants with long legs (the sweatpants) are tilted instead: only the part above the seat moves, so the legs and the crotch stay where the simulation put them
// (squashing the whole garment about the cuffs pulled the crotch about 3.5 cm further down), and the band goes down in front, under the belly, while the back
// stays where the simulation put it. The back rise of a pair of pants is longer than the front one, so a band that is lower in front than behind is how pants
// sit on a belly. On the 217 simulated fits of the body bank the front then lands 2-3 cm under the navel, the back is about 6 cm higher, and the garment needs
// half the push off the skin that a band lowered all the way round needs (2 mm on average, against 4 mm).
//
// Frame: the body model's own (x sideways, y front-to-back, z up), the frame the blend gives the garment in.

import { bodyExtent } from './legLength';

// The navel on the body model's mesh (13,718 vertices): the deepest point of the dip in the belly. It is the same point on every body, so it follows
// the body's shape. Found on the mean body, where it is the strongest dip on the front of the belly, and checked on 128 bodies.
export const NAVEL_VERTEX = 4104;

// How far under the navel the top of the band goes, in metres: the reference fit for shorts has the band a little under the navel.
export const WAIST_BELOW_NAVEL = 0.03;

// Where the seat of a pair of pants is, as a fraction of the body's height above the soles: a little under the crotch, which is at about 0.455 of it.
export const SEAT_FRACTION = 0.45;

// How the tilt goes from the back to the front, as fractions of the garment's depth (0 at the back, 1 at the front): the back part up to TILT_FROM is not
// lowered at all, the front part from TILT_TO on is lowered the whole way, and in between it eases from one to the other.
export const TILT_FROM = 0.15;
export const TILT_TO = 0.95;

// The most the band is ever moved down, in metres. The usual move is 5-12 cm; this stops one odd body from squashing the garment out of shape.
export const MAX_LOWERING = 0.2;

// The least height the garment must have (top to hem) for it to be squashed, and the least move worth making (1 mm), in metres.
const MIN_SPAN = 0.05;
const MIN_MOVE = 0.001;

// The tilt needs a garment at least this deep (front to back) above the seat, in metres; the points that count as the front of the band are those that
// get at least FRONT_WEIGHT of the move; and no more than MAX_SQUASH of the height above the seat is taken out at the front.
const MIN_DEPTH = 0.05;
const FRONT_WEIGHT = 0.95;
const MAX_SQUASH = 0.8;

/** The height of the navel on a body (Float32Array, 3 per vertex), or null when the body has no such vertex. */
export function navelHeight(body) {
  if (!body || body.length < 3 * (NAVEL_VERTEX + 1)) return null;
  const z = body[3 * NAVEL_VERTEX + 2];
  return Number.isFinite(z) ? z : null;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Moves the band of a garment (points: Float32Array, 3 per point, changed in place) down so its top is `below` metres under the body's navel, keeping the
 * hem where it is. A band that is already at or under that height (to within a millimetre) is left alone. Returns how far the top moved, in metres (0 when nothing moved).
 * With tilt, the points at or under the seat (SEAT_FRACTION of the body's height) stay where they are, and above the seat the band goes down the whole way at
 * the front (the smaller y), not at all at the back, and part of the way in between (TILT_FROM, TILT_TO); the move returned is the one at the front.
 */
export function lowerWaistband(points, body, below = WAIST_BELOW_NAVEL, tilt = false) {
  const navel = navelHeight(body);
  if (navel === null || !points || points.length < 6) return 0;
  let top = -Infinity;
  let hem = Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const z = points[i + 2];
    if (!Number.isFinite(z) || !Number.isFinite(points[i + 1])) return 0;
    if (z > top) top = z;
    if (z < hem) hem = z;
  }
  let base = hem;
  if (tilt) {
    const ext = bodyExtent(body);
    if (!ext) return 0;
    base = Math.max(hem, ext.floor + SEAT_FRACTION * ext.height);
  }
  if (!(top - base >= MIN_SPAN)) return 0;
  // how much of the move each point gets: 1 for all of them, or by how far to the front it is
  let weight = () => 1;
  if (tilt) {
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < points.length; i += 3) {
      if (points[i + 2] > base) {
        if (points[i + 1] < yMin) yMin = points[i + 1];
        if (points[i + 1] > yMax) yMax = points[i + 1];
      }
    }
    const depth = yMax - yMin;
    if (depth > MIN_DEPTH) weight = (i) => smoothstep(TILT_FROM, TILT_TO, (yMax - points[i + 1]) / depth);
  }
  // the top of the band at the front: that is the part that has to clear the belly
  let frontTop = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    if (points[i + 2] > frontTop && weight(i) >= FRONT_WEIGHT) frontTop = points[i + 2];
  }
  if (!(frontTop > base)) frontTop = top;
  const span = frontTop - base;
  if (!(span >= MIN_SPAN)) return 0;
  let move = Math.min(frontTop - (navel - below), MAX_LOWERING);
  if (tilt) move = Math.min(move, MAX_SQUASH * span); // so a point higher up is never brought down past one under it
  if (!(move > MIN_MOVE)) return 0;
  for (let i = 0; i < points.length; i += 3) {
    if (points[i + 2] > base) points[i + 2] -= (move * weight(i) * (points[i + 2] - base)) / span;
  }
  return move;
}

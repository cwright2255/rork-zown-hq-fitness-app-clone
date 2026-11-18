// lib/tryOn/relax.js
//
// A little more room in a pair of pants. The drape packs are simulated on a body with the fabric hanging off it as it would in a snug size, and the legs came out
// close to the skin. This moves every point of the garment out from the skin, along the skin's direction there, by `amount`, so the pants hang a little looser and
// the folds the simulation made stay where they are.
//
// It does not move everything the same: the waistband and the hem keep their size (the top 8 cm of the garment, measured from the band's own top edge, which is lower
// in front than at the back on the sweatpants, eases in from nothing; the hem is given half), the
// crotch and the seam up the middle are left alone (the push is nothing at 2 cm from the body's middle and full from 9 cm out, so the two legs do not come into each
// other), and a point that is already more than 3 cm off the skin (loose already; nothing beyond 6 cm) is moved less or not at all. Every one of these changes
// smoothly with position, so no crease is made.
//
// The push that keeps the garment off the skin runs after this, as always; so does anything worn over it. Frame: the body model's own (x sideways, y front-to-back,
// z up), the frame the blend gives the garment in.
import { nearestOnSurface } from './pushOut';

export const BAND_RAMP = 0.08; // metres below the top of the garment over which the ease comes in
export const HEM_RAMP = 0.05; // metres above the hem over which the ease goes down to HEM_KEEP of its size
export const HEM_KEEP = 0.5; // the part of the ease the very hem keeps
export const MID_FROM = 0.02; // no ease at this distance from the garment's middle (the crotch, the front and back of the seat) ...
export const MID_TO = 0.09; // ... and all of it from this far out
export const NEAR = 0.03; // all of the ease for a point within this distance of the skin ...
export const FAR = 0.06; // ... none of it beyond this (the search for the skin stops there too)
const RINGS = 3; // rings of the 2 cm grid that cover FAR
const BINS = 24; // the band's top edge is found at this many places from the back of the garment to its front
const MIN_MOVE = 1e-5; // metres

const smooth = (t) => {
  const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return x * x * (3 - 2 * x);
};

/**
 * Moves points (Float32Array, 3 per point) in place out from the skin by up to `amount` metres, as above. `index` is from buildBodyIndex. Returns how many points moved.
 */
export function relaxFit(points, index, amount) {
  if (!points || points.length < 9 || !(amount > 0)) return 0;
  const n = points.length / 3;
  let zBottom = Infinity;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = points[3 * i];
    const y = points[3 * i + 1];
    const z = points[3 * i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 0;
    if (z < zBottom) zBottom = z;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  // the top edge of the garment at each depth: the highest point in each slice from the back to the front
  const top = new Float64Array(BINS).fill(-Infinity);
  const slice = (y) => Math.min(BINS - 1, Math.max(0, Math.floor(((y - yMin) / (yMax - yMin || 1)) * BINS)));
  for (let i = 0; i < n; i++) { const b = slice(points[3 * i + 1]); if (points[3 * i + 2] > top[b]) top[b] = points[3 * i + 2]; }
  for (let b = 0; b < BINS; b++) {
    if (top[b] > -Infinity) continue;
    let lo = b - 1; let hi = b + 1;
    while (lo >= 0 && top[lo] === -Infinity) lo--;
    while (hi < BINS && top[hi] === -Infinity) hi++;
    top[b] = lo >= 0 && hi < BINS ? 0.5 * (top[lo] + top[hi]) : lo >= 0 ? top[lo] : top[hi];
  }
  const topAt = (y) => {
    const t = Math.min(BINS - 1, Math.max(0, ((y - yMin) / (yMax - yMin || 1)) * BINS - 0.5));
    const b = Math.floor(t);
    const f = t - b;
    return top[b] * (1 - f) + top[Math.min(BINS - 1, b + 1)] * f;
  };
  const centre = 0.5 * (xMin + xMax);
  const { vn, faces } = index;
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const px = points[3 * i];
    const py = points[3 * i + 1];
    const pz = points[3 * i + 2];
    const wBand = smooth((topAt(py) - pz) / BAND_RAMP);
    if (wBand <= 0) continue;
    const wMid = smooth((Math.abs(px - centre) - MID_FROM) / (MID_TO - MID_FROM));
    if (wMid <= 0) continue;
    const res = nearestOnSurface(index, px, py, pz, RINGS);
    if (!res || res.side < 0 || res.d >= FAR) continue; // not near the skin, or inside it (the push off the skin deals with that)
    const wSkin = 1 - smooth((res.d - NEAR) / (FAR - NEAR));
    const wHem = 1 - (1 - HEM_KEEP) * (1 - smooth((pz - zBottom) / HEM_RAMP));
    const s = amount * wBand * wMid * wSkin * wHem;
    if (s < MIN_MOVE) continue;
    const a = faces[3 * res.f];
    const b = faces[3 * res.f + 1];
    const c = faces[3 * res.f + 2];
    let nx = res.u * vn[3 * a] + res.v * vn[3 * b] + res.w * vn[3 * c];
    let ny = res.u * vn[3 * a + 1] + res.v * vn[3 * b + 1] + res.w * vn[3 * c + 1];
    let nz = res.u * vn[3 * a + 2] + res.v * vn[3 * b + 2] + res.w * vn[3 * c + 2];
    const l = Math.hypot(nx, ny, nz);
    if (l < 0.3) continue; // opposite faces of a thin part cancel out: no direction to trust
    nx /= l; ny /= l; nz /= l;
    points[3 * i] = px + s * nx;
    points[3 * i + 1] = py + s * ny;
    points[3 * i + 2] = pz + s * nz;
    moved++;
  }
  return moved;
}

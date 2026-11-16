// lib/tryOn/legLength.js
//
// Brings the hem of full-length pants to the wearer's ankle bone. The sweatpants pattern has one leg length for every size and every height (26.5 in
// from the crotch line, 27.5 in under the body's crotch), and the simulation reproduced it faithfully: the hem landed within a centimetre of where the
// pattern puts it. The pattern is right for a short man and 10 cm short for a 1.8 m one, so on most bodies the cuffs stopped half-way up the shin.
// A person's pants are hemmed to their own legs; this does the same on the model: the part of the leg below the knee is stretched (or squashed)
// up-and-down until the hem is at the ankle bone, just under the middle of it. Above the knee the garment is not touched, and neither is its width
// or depth; the push that keeps the garment off the skin runs afterwards.
//
// Heights are fractions of the body's own height (floor to top of the head), the standard proportions of the lower leg: the lateral malleolus
// (the bump of the ankle bone) is 0.039 of height above the floor and the knee joint 0.285. The body model's ankle is smooth, so there is no
// vertex to take it from; the proportion is the measurement.
//
// Frame: the body model's own (x sideways, y front-to-back, z up), the frame the blend gives the garment in.

// Height of the middle of the lateral malleolus, as a fraction of body height.
export const MALLEOLUS_FRACTION = 0.039;

// Where the hem goes, as a fraction of body height: a little under the middle of the ankle bone (0.8 cm under it on a 1.8 m body).
export const HEM_FRACTION = 0.035;

// Height of the knee joint, as a fraction of body height: the stretch starts there, so thighs and knees keep the shape the simulation gave them.
export const KNEE_FRACTION = 0.285;

// The most the hem is ever moved, in metres, up or down. The usual move is 0-14 cm; this stops one odd body from stretching the garment out of shape.
export const MAX_CHANGE = 0.2;

// The least move worth making, in metres (1 mm).
const MIN_MOVE = 0.001;

/** The floor and the height of a body (Float32Array, 3 per vertex): { floor, height }, or null for an empty or broken body. */
export function bodyExtent(body) {
  if (!body || body.length < 6) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 2; i < body.length; i += 3) {
    const z = body[i];
    if (!Number.isFinite(z)) return null;
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  return hi - lo > 0.5 ? { floor: lo, height: hi - lo } : null;
}

/**
 * Moves the hem of a garment (points: Float32Array, 3 per point, changed in place) to HEM_FRACTION of the body's height above the floor, by stretching
 * the part of the garment below the knee up-and-down. Returns how far the hem moved down, in metres: positive when the legs were lengthened, negative when
 * they were shortened, 0 when nothing moved.
 */
export function hemToAnkle(points, body, fraction = HEM_FRACTION) {
  const ext = bodyExtent(body);
  if (!ext || !points || points.length < 6) return 0;
  let hem = Infinity;
  for (let i = 2; i < points.length; i += 3) {
    const z = points[i];
    if (!Number.isFinite(z)) return 0;
    if (z < hem) hem = z;
  }
  const knee = ext.floor + KNEE_FRACTION * ext.height;
  const span = knee - hem; // the part of the garment that is stretched
  if (!(span > 0.05)) return 0;
  const move = Math.max(-MAX_CHANGE, Math.min(MAX_CHANGE, hem - (ext.floor + fraction * ext.height)));
  // The stretch factor, 1 + move / span, stays above zero: a hem under the target is further from the knee than the target is, so span > -move.
  if (!(Math.abs(move) > MIN_MOVE)) return 0;
  for (let i = 2; i < points.length; i += 3) {
    const z = points[i];
    if (z < knee) points[i] = z - (move * (knee - z)) / span;
  }
  return move;
}

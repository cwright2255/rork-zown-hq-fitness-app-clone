// lib/tryOn/tryOnSession.js
//
// One try-on, start to finish: the body the person already has on the phone (its vertices), the sizing (which size to try first), the garment's
// drape pack for that size, the blend, and the push that keeps the garment off the skin. Nothing about the body goes anywhere; the only downloads are
// the sizing file and the pack, which are the same for everyone. The clock and the file store are passed in, so it runs the same in tests.
import { parsePack, blendGarment, shapeNumbers, bodyDistance } from './pack';
import { buildBodyIndex, boundsOf, pushOut, GAP } from './pushOut';
import { decodeSizing, chooseSize, sizeFit, verdictOf, measuresNeeded, featureVector, measureBody } from './sizing';
import { bytesToText } from './packStore';
import { hasWaistband } from './garments';
import { lowerWaistband } from './waistline';

// The body model's mesh. A body that is not this one (the simple stand-in shown when the detailed mesh is not available) cannot be fitted.
export const BODY_VERTEX_COUNT = 13718;

export class TryOnError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TryOnError';
    this.code = code; // 'no-detailed-body' | 'no-sizing' | 'no-pack'
  }
}

/** The vertices and triangles of a three.js body geometry as plain arrays, or throws TryOnError('no-detailed-body'). */
export function readBodyGeometry(geometry) {
  const attribute = geometry && geometry.attributes && geometry.attributes.position;
  if (!attribute || !geometry.index || attribute.count !== BODY_VERTEX_COUNT || attribute.itemSize !== 3) {
    throw new TryOnError('no-detailed-body', 'The try-on needs the detailed 3D body, and this one is the simple stand-in.');
  }
  let positions = attribute.array;
  if (attribute.isInterleavedBufferAttribute || !(positions instanceof Float32Array) || positions.length !== BODY_VERTEX_COUNT * 3) {
    positions = new Float32Array(BODY_VERTEX_COUNT * 3);
    for (let i = 0; i < BODY_VERTEX_COUNT; i++) { positions[3 * i] = attribute.getX(i); positions[3 * i + 1] = attribute.getY(i); positions[3 * i + 2] = attribute.getZ(i); }
  }
  return { positions, faces: geometry.index.array };
}

/** The sizing for a body group ('men' | 'women'), read from the store. */
export async function loadSizing(store, group) {
  try {
    const buffer = await store.getFile(group + '/sizing.json');
    return decodeSizing(JSON.parse(bytesToText(buffer)));
  } catch (e) {
    if (e && e.name === 'PackStoreError') throw e;
    throw new TryOnError('no-sizing', 'The sizing for ' + group + ' could not be read: ' + (e && e.message ? e.message : 'unknown'));
  }
}

/** What to show for each size of a garment on this body: recommended size, and for every size its chance of fitting. No pack is downloaded. */
export function recommend(sizing, garmentKey, bodyPositions) {
  return chooseSize(sizing, garmentKey, bodyPositions);
}

/**
 * Fits one garment in one size on a body.
 * deps: { store, now(): ms, onStep(text) }
 * args: { sizing, garmentKey, group, size (the chosen size), bodyPositions (Float32Array), bodyFaces, choice (from recommend, optional) }
 * Returns { size, positions (Float32Array garment vertices), faces (Uint16Array/Uint32Array), fit (for this size), outsidePack (body shape beyond what the pack was built on),
 *           lowered (metres the waistband was moved down to sit under the navel; 0 for garments without a waistband), pushed (points moved off the skin),
 *           timings: { pack, blend, push, total } }.
 */
export async function fitGarment(deps, args) {
  const { store, now = () => Date.now(), onStep = () => {} } = deps;
  const { sizing, garmentKey, group, size, bodyPositions, bodyFaces } = args;
  const garment = sizing.garments[garmentKey];
  if (!garment || !garment.sizes[size]) throw new TryOnError('no-pack', 'There is no ' + garmentKey + ' in size ' + size + '.');
  const t0 = now();

  onStep('Getting the ' + size + ' garment...');
  let downloaded = false;
  const buffer = await store.getFile(group + '/' + garmentKey + '_' + size + '.zdp', () => { downloaded = true; });
  const t1 = now();
  const pack = parsePack(buffer);
  if (!pack.A.faces) throw new TryOnError('no-pack', 'This pack has no triangles to draw.');

  onStep('Fitting it to your body...');
  const positions = blendGarment(pack, bodyPositions);
  // Shorts and pants: the band goes just under this body's navel, not where the simulation happened to put it.
  const lowered = hasWaistband(group, garmentKey) ? lowerWaistband(positions, bodyPositions) : 0;
  const outsidePack = bodyDistance(pack, shapeNumbers(pack, bodyPositions));
  const t2 = now();

  onStep('Keeping it off the skin...');
  const index = buildBodyIndex(bodyPositions, bodyFaces, { bounds: boundsOf(positions) });
  const pushed = pushOut(positions, index, GAP);
  const t3 = now();

  const measures = measureBody(sizing, bodyPositions, measuresNeeded(garment));
  const features = featureVector(garment, measures);
  const fit = sizeFit(sizing, garment, size, features);
  const anyInside = Object.keys(garment.sizes).some((s) => sizeFit(sizing, garment, s, features).inside);
  return {
    size,
    positions,
    faces: pack.A.faces,
    fit: { ...fit, verdict: verdictOf(fit, anyInside) },
    measures,
    outsidePack: outsidePack.outside,
    lowered,
    pushed,
    downloaded,
    timings: { pack: t1 - t0, blend: t2 - t1, push: t3 - t2, total: t3 - t0 },
  };
}

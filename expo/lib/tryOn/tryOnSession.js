// lib/tryOn/tryOnSession.js
//
// One try-on, start to finish: the body the person already has on the phone (its vertices), the sizing (which size to try first), the garment's
// drape pack for that size, the blend, and the push that keeps the garment off the skin. Nothing about the body goes anywhere; the only downloads are
// the sizing file and the pack, which are the same for everyone. The clock and the file store are passed in, so it runs the same in tests.
import { parsePack, blendGarment, shapeNumbers, bodyDistance } from './pack';
import { buildBodyIndex, boundsOf, pushOut, GAP } from './pushOut';
import { decodeSizing, chooseSize, sizeFit, verdictOf, measuresNeeded, featureVector, measureBody } from './sizing';
import { bytesToText } from './packStore';
import { hasAnkleHem, waistbandKind, goesAroundEars, relaxAmount } from './garments';
import { hemToAnkle } from './legLength';
import { lowerWaistband } from './waistline';
import { dressBody, liftOverLayers } from './layers';
import { relaxFit } from './relax';

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
 * args: { sizing, garmentKey, group, size (the chosen size), bodyPositions (Float32Array), bodyFaces, choice (from recommend, optional),
 *         under (optional: the garments already worn under this one, each { positions, faces } as returned by this function; a top is kept off them, and they are not changed) }
 * Returns { size, positions (Float32Array garment vertices), faces (Uint16Array/Uint32Array), fit (for this size), outsidePack (body shape beyond what the pack was built on),
 *           lowered (metres the waistband was moved down to sit under the navel; 0 for garments without a waistband),
 *           hemmed (metres the hem was moved down to the ankle bone, negative when moved up; 0 for garments that are not full length), relaxed (points moved out from the skin to give the
 *           garment more room, 0 for garments that are worn as simulated), pushed (points moved off the skin
 *           or off the garments worn under it), lifted (points of this garment raised over a band or fold of the garment under it that stands further out than the skin), layered (how many points of the body had a garment over them, 0 with nothing worn under),
 *           timings: { pack, blend, push, total } }.
 */
export async function fitGarment(deps, args) {
  const { store, now = () => Date.now(), onStep = () => {} } = deps;
  const { sizing, garmentKey, group, size, bodyPositions, bodyFaces } = args;
  const under = (args.under || []).filter((layer) => layer && layer.positions && layer.faces);
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
  // Shorts and pants: the band goes just under this body's navel, not where the simulation happened to put it (and a belly hangs over it, not inside it).
  const waistband = waistbandKind(group, garmentKey);
  const lowered = waistband ? lowerWaistband(positions, bodyPositions, undefined, waistband === 'tilt') : 0;
  // Full-length pants: the hem goes to this body's ankle bone (the pattern has one leg length for every height).
  const hemmed = hasAnkleHem(group, garmentKey) ? hemToAnkle(positions, bodyPositions) : 0;
  const outsidePack = bodyDistance(pack, shapeNumbers(pack, bodyPositions));
  const t2 = now();

  // Over another garment: the skin that has that garment over it is taken to be at the garment's surface, so this one is kept off the garment as it is kept off the skin.
  // The garment underneath is not changed.
  onStep(under.length ? 'Fitting it over what you have on...' : 'Keeping it off the skin...');
  const dressed = under.length ? dressBody(bodyPositions, bodyFaces, under) : null;
  const index = buildBodyIndex(dressed ? dressed.positions : bodyPositions, bodyFaces, { bounds: boundsOf(positions) });
  // Pants hang a little looser than the snug fit that was simulated (lib/tryOn/relax.js); the push off the skin then runs as always.
  const relaxed = relaxFit(positions, index, relaxAmount(group, garmentKey));
  const pushed = pushOut(positions, index, GAP, { smoothSide: goesAroundEars(group, garmentKey) });
  // A band or a fold of the garment underneath can stand out further than the skin it was measured against: this one is lifted over it where it does.
  const skin = under.length ? buildBodyIndex(bodyPositions, bodyFaces, { bounds: boundsOf(positions) }) : null;
  let lifted = under.length ? liftOverLayers(positions, pack.A.faces, under, skin, GAP) : 0;
  // The dressed body can fold where a bottom bridges a crease of the body (the cleft of the seat), and a top kept off it can end up inside the real skin there. Whatever the
  // dressed body did, nothing is left inside or against the real skin; anything that was moved is then lifted over the garment underneath once more.
  if (under.length && pushOut(positions, skin, GAP, { smoothSide: goesAroundEars(group, garmentKey) }) > 0) lifted += liftOverLayers(positions, pack.A.faces, under, skin, GAP);
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
    hemmed,
    pushed,
    relaxed,
    lifted,
    layered: dressed ? dressed.moved : 0,
    downloaded,
    timings: { pack: t1 - t0, blend: t2 - t1, push: t3 - t2, total: t3 - t0 },
  };
}

// lib/tryOn/sizing.js
//
// Which size to try on first, and whether a size is likely to fit. Two parts, both made by the pack builder from the simulated fits (see docs/TRYON_PACKS.md):
//   1. a tape measure for the body model's mesh: a waist, hip, bust or underbust in cm worked out from the body's own vertices, accurate to about
//      0.3-0.5 cm on the bodies it was built from;
//   2. for each garment and size, how likely the garment is to come out too tight or too loose at those measures. P(fit) = (1 - P(tight)) x (1 - P(loose)).
// The size picked is the one that was tested on bodies like this one and is most likely to fit; a body outside everything that was tested is flagged.
// The sizing file is read from private storage (lib/tryOn/packStore.js); the sizing is worked out on the phone from the body's own vertices, and nothing is sent for it.
import { base64ToArrayBuffer } from '../meshCache';

const logistic = (x) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
const dot = (b, f) => { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * f[i]; return s; };

/** Turns the sizing file (parsed JSON) into numbers ready to use. */
export function decodeSizing(json) {
  const zoneIdx = new Int16Array(base64ToArrayBuffer(json.zoneIdx));
  const measures = {};
  for (const name of Object.keys(json.measures)) {
    const m = json.measures[name];
    const w = new Float32Array(base64ToArrayBuffer(m.w));
    if (w.length !== zoneIdx.length * 3) throw new Error('the sizing file does not match itself');
    measures[name] = { ...m, w };
  }
  return { ...json, zoneIdx, measures };
}

/** Measures (cm) for the body (Float32Array/Float64Array, 3 per vertex, the body model's own order and axes): { waist, hip } or { bust, ub, waist } for what is asked. */
export function measureBody(sizing, body, names) {
  const nv = body.length / 3;
  let minZ = Infinity;
  for (let i = 0; i < nv; i++) if (body[3 * i + 2] < minZ) minZ = body[3 * i + 2];
  let sx = 0;
  let sy = 0;
  let c = 0;
  for (let i = 0; i < nv; i++) {
    if (body[3 * i + 2] < minZ + 0.02) { sx += body[3 * i]; sy += body[3 * i + 1]; c++; }
  }
  const cx = sx / c;
  const cy = sy / c;
  const idx = sizing.zoneIdx;
  const result = {};
  for (const name of names) {
    const m = sizing.measures[name];
    if (!m) throw new Error('the sizing file has no ' + name + ' measure');
    let s = m.b0;
    for (let j = 0; j < idx.length; j++) {
      const v = idx[j];
      s += (body[3 * v] - cx) * m.w[3 * j] + (body[3 * v + 1] - cy) * m.w[3 * j + 1] + (body[3 * v + 2] - minZ) * m.w[3 * j + 2];
    }
    result[name] = s;
  }
  return result;
}

/** The measures a garment's features need. */
export function measuresNeeded(garment) {
  const out = new Set();
  for (const f of garment.features) {
    if (f === 'cup') { out.add('bust'); out.add('ub'); } else out.add(f);
  }
  return [...out];
}

/** The garment's feature numbers for a body's measures (a cup is the bust minus the underbust). */
export function featureVector(garment, measures) {
  return garment.features.map((f) => (f === 'cup' ? measures.bust - measures.ub : measures[f]));
}

/** For one size: how likely it is to come out too tight / too loose / fit, whether the body is within what was tested, and how far from a typical good fit. */
export function sizeFit(sizing, garment, size, features) {
  const m = garment.sizes[size];
  const margin = sizing.pick.margin;
  let inside = true;
  for (let i = 0; i < features.length; i++) if (features[i] < m.lo[i] - margin || features[i] > m.hi[i] + margin) inside = false;
  const pTight = logistic(m.tight.b0 + dot(m.tight.b, features));
  const pLoose = logistic(m.loose.b0 + dot(m.loose.b, features));
  const pFit = (1 - pTight) * (1 - pLoose);
  let d2 = 0;
  let side = 0; // below 0: the body is smaller than this size's typical good fit, above 0: bigger
  for (let i = 0; i < features.length; i++) { const e = (features[i] - m.centre[i]) / m.sd[i]; d2 += e * e; side += e; }
  return { size, inside, pTight, pLoose, pFit, distance: Math.sqrt(d2), side };
}

/**
 * A short verdict for a size, for the screen: good | likely | tight | loose | outside. A size the body is well beyond the range of (much smaller or much bigger
 * than the bodies it was tested on) is loose or tight; "outside" is for a body that none of the garment's sizes were tested on.
 */
export function verdictOf(fit, anyInside) {
  if (!anyInside) return 'outside';
  if (!fit.inside) return fit.side > 0 ? 'tight' : 'loose';
  if (fit.pFit >= 0.8) return 'good';
  if (fit.pFit >= 0.55) return 'likely';
  return fit.pTight >= fit.pLoose ? 'tight' : 'loose';
}

/**
 * garmentKey: 'shorts' | 'sweatpants' | 'bra' | 'cami'. Returns { measures, features, sizes: [fit per size, smallest first], size (the recommended one),
 * verdict (for it), anyInside (false when the body is outside everything the sizes were tested on) }.
 */
export function chooseSize(sizing, garmentKey, body) {
  const garment = sizing.garments[garmentKey];
  if (!garment) throw new Error('no sizing for ' + garmentKey);
  const measures = measureBody(sizing, body, measuresNeeded(garment));
  const features = featureVector(garment, measures);
  const sigma = sizing.pick.sigma;
  const sizes = Object.keys(garment.sizes).map((s) => sizeFit(sizing, garment, s, features));
  const anyInside = sizes.some((s) => s.inside);
  let best = null;
  if (anyInside) {
    for (const s of sizes) {
      if (!s.inside) continue;
      s.score = s.pFit * Math.exp(-(s.distance * s.distance) / (2 * sigma * sigma));
      if (!best || s.score > best.score) best = s;
    }
  } else {
    for (const s of sizes) if (!best || s.distance < best.distance) best = s;
  }
  return { measures, features, sizes, size: best.size, verdict: verdictOf(best, anyInside), anyInside };
}

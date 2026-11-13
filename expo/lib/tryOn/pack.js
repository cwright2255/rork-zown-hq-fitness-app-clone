// lib/tryOn/pack.js
//
// Reads a drape pack (.zdp) and blends the garment for one body. A pack holds, for one garment in one size, what the simulator learned from a few
// dozen made-up bodies: a few "body numbers" that describe a body's shape, and the small tables that turn those numbers into the garment's shape
// as it would hang on that body. The body's own vertices go in, and the blend is worked out on the phone: nothing is sent for it.
//
// The file is a small header (JSON) followed by raw arrays, written by the pack builder (see docs/TRYON_PACKS.md). Plain loops over typed arrays,
// no dependencies, so it runs the same in the app (Hermes) and in tests. The numbers it returns were checked against the builder's own blend.

const MAGIC = 'ZDP1';
const TYPES = { float32: Float32Array, int16: Int16Array, uint16: Uint16Array, uint32: Uint32Array };

/** Reads the header text (plain ASCII) without needing TextDecoder. */
function headerText(bytes, start, end) {
  let s = '';
  for (let i = start; i < end; i += 0x2000) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(end, i + 0x2000)));
  return s;
}

/** buffer: ArrayBuffer or Uint8Array of the whole .zdp file. Returns { head, A } where A holds each array by name. Throws if it is not a pack. */
export function parsePack(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 8 || String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== MAGIC) throw new Error('not a drape pack');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headLen = view.getUint32(4, true);
  if (8 + headLen > bytes.length) throw new Error('the drape pack is cut short');
  const head = JSON.parse(headerText(bytes, 8, 8 + headLen));
  let off = 8 + headLen;
  const A = {};
  for (const a of head.arrays) {
    const T = TYPES[a.dtype];
    if (!T) throw new Error('the drape pack has a kind of array this version cannot read: ' + a.dtype);
    const n = a.shape.reduce((x, y) => x * y, 1);
    const size = n * T.BYTES_PER_ELEMENT;
    if (off + size > bytes.length) throw new Error('the drape pack is cut short');
    const copy = bytes.slice(off, off + size); // a real copy, so the view is aligned
    A[a.name] = new T(copy.buffer);
    off += size;
  }
  const pack = { head, A };
  pack.nnScale = nearestNeighbourScale(pack);
  return pack;
}

/** How far apart the pack's training bodies are from each other in body-number space (90th percentile of each one's nearest neighbour). */
function nearestNeighbourScale(pack) {
  const { A, head } = pack;
  const k = head.k;
  const n = head.n_train;
  if (n < 2) return 1;
  const nearest = [];
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      let s = 0;
      for (let d = 0; d < k; d++) { const e = A.Ztrain[i * k + d] - A.Ztrain[j * k + d]; s += e * e; }
      if (s < best) best = s;
    }
    nearest.push(Math.sqrt(best));
  }
  nearest.sort((a, b) => a - b);
  return nearest[Math.min(nearest.length - 1, Math.floor(0.9 * nearest.length))] || 1;
}

/**
 * The pack's body numbers for a body: its vertices (Float32Array/Float64Array, 3 per vertex, in the body model's own order and axes:
 * x sideways, y front to back, z up), moved so the soles are at the origin, projected on the pack's basis.
 */
export function shapeNumbers(pack, body) {
  const { A, head } = pack;
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
  const idx = A.zone_idx;
  const m = idx.length * 3;
  const k = head.k;
  const z = new Float64Array(k);
  for (let j = 0; j < idx.length; j++) {
    const v = idx[j];
    const x0 = body[3 * v] - cx - A.basis_mean[3 * j];
    const x1 = body[3 * v + 1] - cy - A.basis_mean[3 * j + 1];
    const x2 = body[3 * v + 2] - minZ - A.basis_mean[3 * j + 2];
    for (let d = 0; d < k; d++) z[d] += x0 * A.basis_comps[d * m + 3 * j] + x1 * A.basis_comps[d * m + 3 * j + 1] + x2 * A.basis_comps[d * m + 3 * j + 2];
  }
  for (let d = 0; d < k; d++) z[d] /= A.basis_std[d];
  return z;
}

/** How far this body is from the bodies the pack was built on. { nearest, ratio, outside }: ratio is nearest / typical spacing; outside is true when it is well beyond. */
export function bodyDistance(pack, z) {
  const { A, head } = pack;
  const k = head.k;
  const n = head.n_train;
  const zs = new Float64Array(k);
  for (let d = 0; d < k; d++) zs[d] = (z[d] - A.mu_z[d]) / A.sd_z[d];
  let best = Infinity;
  for (let t = 0; t < n; t++) {
    let s = 0;
    for (let d = 0; d < k; d++) { const e = A.Ztrain[t * k + d] - zs[d]; s += e * e; }
    if (s < best) best = s;
  }
  const nearest = Math.sqrt(best);
  const ratio = nearest / pack.nnScale;
  return { nearest, ratio, outside: ratio > OUTSIDE_RATIO };
}
// Held-out bodies (pack built without them) were up to 1.5 times the typical spacing from their nearest training body and were about 5-8 mm off on
// average; the two that were beyond 2 were over 20 mm off. So 2 is where the pack stops being a good guide for a body.
export const OUTSIDE_RATIO = 2;

/** The garment's vertices (Float32Array, 3 per vertex, in the body model's own axes, in the body's own place) for a body. `out` can be passed to reuse an array. */
export function blendGarment(pack, body, out) {
  const { A, head } = pack;
  const k = head.k;
  const r = head.r;
  const n = head.n_train;
  const z = shapeNumbers(pack, body);
  const zs = new Float64Array(k);
  for (let d = 0; d < k; d++) zs[d] = (z[d] - A.mu_z[d]) / A.sd_z[d];
  const c = new Float64Array(r);
  for (let j = 0; j < r; j++) c[j] = A.W[j]; // row 0 of W is the constant
  for (let d = 0; d < k; d++) for (let j = 0; j < r; j++) c[j] += zs[d] * A.W[(d + 1) * r + j];
  for (let t = 0; t < n; t++) { // the smooth correction from the training bodies
    let s = 0;
    for (let d = 0; d < k; d++) { const e = A.Ztrain[t * k + d] - zs[d]; s += e * e; }
    const w = Math.exp(-s / (2 * head.ell * head.ell));
    for (let j = 0; j < r; j++) c[j] += w * A.alpha[t * r + j];
  }
  const m = head.n_vertices * 3;
  const result = out && out.length === m ? out : new Float32Array(m);
  for (let i = 0; i < m; i++) result[i] = A.ybar_int16[i] * head.ybar_scale;
  for (let j = 0; j < r; j++) {
    const f = c[j] * A.V_scale[j];
    const base = j * m;
    for (let i = 0; i < m; i++) result[i] += f * A.V_int16[base + i];
  }
  return result;
}

// lib/tryOnSpike/standInGarment.js
//
// A garment made in code for the try-on runtime test (app/shop/try-on-runtime-test.jsx). It has the same SIZES as the real Men's 7in Shorts, M
// (17,004 points and about 34,000 triangles) and carries a set of "shape changes" the way a drape pack will: the garment on one body is the
// average garment plus a weighted sum of the shape changes. It is a plain tube with made-up numbers: nothing from any product, so it is safe to
// keep in the code. What the test measures (time to blend, to load, to draw) depends on how much data there is, not on what it looks like.

export const REAL_SHORTS_M = { vertices: 17004, triangles: 33988, textureSize: 4096, textures: 2 };

export const STAND_IN_DEFAULTS = { around: 109, rings: 156, components: 16 }; // 109 x 156 = 17,004 points

// A small, repeatable random-number generator, so the same stand-in comes out every time (and tests can check it).
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The stand-in garment: a tube, wide at the hips and narrower at the waist and the hem, wrapped around `around` points, `rings` rings tall.
 * Returns { vertexCount, triangleCount, components, mean, basis, uvs, indices }:
 *   mean     the average garment, 3 numbers (x, y, z) per point, in metres
 *   basis    `components` shape changes, each with 3 numbers per point, one after the other
 *   uvs      2 numbers per point (where each point sits on the texture)
 *   indices  3 point numbers per triangle (16-bit: the stand-in has fewer than 65,536 points)
 */
export function makeStandInGarment({ around, rings, components, seed = 7 } = {}) {
  const a = around ?? STAND_IN_DEFAULTS.around;
  const r = rings ?? STAND_IN_DEFAULTS.rings;
  const k = components ?? STAND_IN_DEFAULTS.components;
  if (!(a >= 3) || !(r >= 2) || !(k >= 1)) throw new Error('standInGarment: needs around >= 3, rings >= 2, components >= 1');
  const vertexCount = a * r;
  if (vertexCount > 65535) throw new Error('standInGarment: too many points for 16-bit triangle numbers');
  const random = seededRandom(seed);

  const mean = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const radial = new Float32Array(vertexCount * 3); // which way is "outwards" at each point, used to make the shape changes
  for (let ring = 0; ring < r; ring++) {
    const v = ring / (r - 1);
    // Waist at the top (v = 0), widest at the hip about a third of the way down, a little narrower at the hem.
    const radius = 0.16 + 0.04 * Math.sin(Math.min(1, v * 3) * Math.PI / 2) - 0.03 * Math.max(0, v - 0.6);
    for (let i = 0; i < a; i++) {
      const theta = (i / a) * Math.PI * 2;
      const p = ring * a + i;
      const cx = Math.cos(theta);
      const cz = Math.sin(theta);
      mean[p * 3] = radius * cx;
      mean[p * 3 + 1] = 0.5 - v * 0.5;
      mean[p * 3 + 2] = radius * cz;
      radial[p * 3] = cx;
      radial[p * 3 + 2] = cz;
      uvs[p * 2] = i / a;
      uvs[p * 2 + 1] = v;
    }
  }

  const basis = new Float32Array(k * vertexCount * 3);
  for (let c = 0; c < k; c++) {
    const wave = 1 + Math.floor(random() * 4);
    const phase = random() * Math.PI * 2;
    const height = 1 + random() * 2;
    const size = 0.004 + random() * 0.008; // a few millimetres, like the differences between neighbouring bodies
    const offset = c * vertexCount * 3;
    for (let ring = 0; ring < r; ring++) {
      const v = ring / (r - 1);
      for (let i = 0; i < a; i++) {
        const p = ring * a + i;
        const theta = (i / a) * Math.PI * 2;
        const push = size * Math.sin(wave * theta + phase) * Math.cos(height * v * Math.PI);
        basis[offset + p * 3] = radial[p * 3] * push;
        basis[offset + p * 3 + 2] = radial[p * 3 + 2] * push;
        basis[offset + p * 3 + 1] = size * 0.25 * Math.sin(theta + phase) * v;
      }
    }
  }

  const triangleCount = a * (r - 1) * 2;
  const indices = new Uint16Array(triangleCount * 3);
  let t = 0;
  for (let ring = 0; ring < r - 1; ring++) {
    for (let i = 0; i < a; i++) {
      const i2 = (i + 1) % a; // the last column joins the first
      const p00 = ring * a + i;
      const p01 = ring * a + i2;
      const p10 = (ring + 1) * a + i;
      const p11 = (ring + 1) * a + i2;
      // Counter-clockwise seen from outside, so the front of every triangle faces outwards.
      indices[t++] = p00; indices[t++] = p01; indices[t++] = p10;
      indices[t++] = p01; indices[t++] = p11; indices[t++] = p10;
    }
  }

  return { vertexCount, triangleCount, components: k, mean, basis, uvs, indices };
}

/** The first `count` shape changes of a stand-in garment, as a garment of its own (so the test can time 8, 16 and 32 shape changes). */
export function withComponents(garment, count) {
  if (count > garment.components) throw new Error('withComponents: the garment has only ' + garment.components + ' shape changes');
  const per = garment.vertexCount * 3;
  return { ...garment, components: count, basis: garment.basis.subarray(0, count * per) };
}

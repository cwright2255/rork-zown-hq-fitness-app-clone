// The stand-in garment, the blend and the surface directions the try-on runtime test uses (lib/tryOnSpike/standInGarment.js, blend.js).
// The test only means something if the stand-in has the real shorts' sizes and the blend does what it says, so both are pinned here.
const {
  makeStandInGarment, withComponents, seededRandom, REAL_SHORTS_M, STAND_IN_DEFAULTS,
} = require('../lib/tryOnSpike/standInGarment');
const { blendInto, normalsInto, sampleWeights } = require('../lib/tryOnSpike/blend');

describe('the stand-in garment', () => {
  const garment = makeStandInGarment({ components: 16 });

  it('has the real shorts M\'s number of points and (to within one percent) triangles, so the timings carry over', () => {
    expect(garment.vertexCount).toBe(REAL_SHORTS_M.vertices);
    expect(Math.abs(garment.triangleCount - REAL_SHORTS_M.triangles) / REAL_SHORTS_M.triangles).toBeLessThan(0.01);
    expect(garment.mean.length).toBe(garment.vertexCount * 3);
    expect(garment.uvs.length).toBe(garment.vertexCount * 2);
    expect(garment.indices.length).toBe(garment.triangleCount * 3);
    expect(garment.basis.length).toBe(16 * garment.vertexCount * 3);
  });

  it('only points at points that exist, and has no triangle with a repeated point', () => {
    let worst = 0;
    for (let t = 0; t < garment.indices.length; t += 3) {
      const [a, b, c] = [garment.indices[t], garment.indices[t + 1], garment.indices[t + 2]];
      worst = Math.max(worst, a, b, c);
      expect(a !== b && b !== c && a !== c).toBe(true);
    }
    expect(worst).toBe(garment.vertexCount - 1);
  });

  it('is a closed tube: every edge is shared by exactly two triangles except the two rims, which are shared by one', () => {
    const edges = new Map();
    for (let t = 0; t < garment.indices.length; t += 3) {
      const tri = [garment.indices[t], garment.indices[t + 1], garment.indices[t + 2]];
      for (let e = 0; e < 3; e++) {
        const [u, v] = [tri[e], tri[(e + 1) % 3]].sort((x, y) => x - y);
        const key = u * 100000 + v;
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    const counts = {};
    edges.forEach((n) => { counts[n] = (counts[n] || 0) + 1; });
    expect(counts[1]).toBe(2 * STAND_IN_DEFAULTS.around); // the top and bottom rims
    expect(counts[2]).toBe(edges.size - 2 * STAND_IN_DEFAULTS.around);
    expect(Object.keys(counts).sort()).toEqual(['1', '2']);
  });

  it('is the same every time, and has no number that is not a number', () => {
    const again = makeStandInGarment({ components: 16 });
    expect(Buffer.from(again.basis.buffer).equals(Buffer.from(garment.basis.buffer))).toBe(true);
    expect(Buffer.from(again.mean.buffer).equals(Buffer.from(garment.mean.buffer))).toBe(true);
    expect(Array.from(garment.basis).every(Number.isFinite)).toBe(true);
    expect(Array.from(garment.mean).every(Number.isFinite)).toBe(true);
  });

  it('is a garment-sized thing: about half a metre tall and about 40 cm across', () => {
    let minY = Infinity; let maxY = -Infinity; let maxR = 0;
    for (let i = 0; i < garment.mean.length; i += 3) {
      minY = Math.min(minY, garment.mean[i + 1]); maxY = Math.max(maxY, garment.mean[i + 1]);
      maxR = Math.max(maxR, Math.hypot(garment.mean[i], garment.mean[i + 2]));
    }
    expect(maxY - minY).toBeCloseTo(0.5, 2);
    expect(maxR * 2).toBeGreaterThan(0.3);
    expect(maxR * 2).toBeLessThan(0.5);
  });

  it('lays the picture over the whole garment: across from 0 to just under 1 (the seam joins the ends), down from 0 to 1', () => {
    let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
    for (let p = 0; p < garment.vertexCount; p++) {
      minU = Math.min(minU, garment.uvs[p * 2]); maxU = Math.max(maxU, garment.uvs[p * 2]);
      minV = Math.min(minV, garment.uvs[p * 2 + 1]); maxV = Math.max(maxV, garment.uvs[p * 2 + 1]);
    }
    expect(minU).toBe(0);
    expect(maxU).toBeCloseTo(1 - 1 / STAND_IN_DEFAULTS.around, 5);
    expect(minV).toBe(0);
    expect(maxV).toBe(1);
  });

  it('has shape changes that are millimetres, not metres', () => {
    let biggest = 0;
    for (let i = 0; i < garment.basis.length; i++) biggest = Math.max(biggest, Math.abs(garment.basis[i]));
    expect(biggest).toBeGreaterThan(0.001);
    expect(biggest).toBeLessThan(0.02);
  });

  it('defaults to the sizes the test measures, and refuses sizes that cannot work', () => {
    expect(STAND_IN_DEFAULTS.around * STAND_IN_DEFAULTS.rings).toBe(REAL_SHORTS_M.vertices);
    expect(() => makeStandInGarment({ around: 2 })).toThrow(/around >= 3/);
    expect(() => makeStandInGarment({ rings: 1 })).toThrow(/rings >= 2/);
    expect(() => makeStandInGarment({ components: 0 })).toThrow(/components >= 1/);
    expect(() => makeStandInGarment({ around: 300, rings: 300, components: 1 })).toThrow(/too many points/);
  });

  it('can be cut down to its first few shape changes, and not asked for more than it has', () => {
    const eight = withComponents(garment, 8);
    expect(eight.components).toBe(8);
    expect(eight.basis.length).toBe(8 * garment.vertexCount * 3);
    expect(eight.basis[0]).toBe(garment.basis[0]);
    expect(() => withComponents(garment, 17)).toThrow(/only 16/);
  });

  it('gives the same random numbers for the same seed, and different ones for another', () => {
    const a = seededRandom(5); const b = seededRandom(5); const c = seededRandom(6);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    first.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
  });
});

describe('blendInto', () => {
  const garment = makeStandInGarment({ components: 4 });
  const n = garment.mean.length;

  it('gives the average garment when every weight is zero', () => {
    const out = new Float32Array(n);
    blendInto(out, garment.mean, garment.basis, new Float32Array(4));
    expect(Buffer.from(out.buffer).equals(Buffer.from(garment.mean.buffer))).toBe(true);
  });

  it('is the average plus the weighted shape changes, checked against a slow, plain calculation', () => {
    const weights = [0.5, -1, 2, 0.25];
    const out = new Float32Array(n);
    blendInto(out, garment.mean, garment.basis, Float32Array.from(weights));
    for (const i of [0, 1, 2, 1000, 5000, n - 3, n - 2, n - 1]) {
      let expected = garment.mean[i];
      for (let c = 0; c < 4; c++) expected += weights[c] * garment.basis[c * n + i];
      expect(out[i]).toBeCloseTo(expected, 5);
    }
  });

  it('writes into the array it is given and returns it (no new array per blend)', () => {
    const out = new Float32Array(n);
    expect(blendInto(out, garment.mean, garment.basis, Float32Array.from([1, 0, 0, 0]))).toBe(out);
    expect(out[3]).not.toBe(garment.mean[3]);
  });

  it('does not touch the average or the shape changes', () => {
    const meanBefore = Buffer.from(garment.mean.buffer).toString('base64');
    const basisBefore = Buffer.from(garment.basis.buffer).toString('base64');
    blendInto(new Float32Array(n), garment.mean, garment.basis, Float32Array.from([1, 1, 1, 1]));
    expect(Buffer.from(garment.mean.buffer).toString('base64')).toBe(meanBefore);
    expect(Buffer.from(garment.basis.buffer).toString('base64')).toBe(basisBefore);
  });

  it('refuses arrays of different sizes, or more weights than shape changes', () => {
    expect(() => blendInto(new Float32Array(n - 3), garment.mean, garment.basis, new Float32Array(4))).toThrow(/same length/);
    expect(() => blendInto(new Float32Array(n), garment.mean, garment.basis, new Float32Array(5))).toThrow(/fewer shape changes/);
  });
});

describe('normalsInto', () => {
  const garment = makeStandInGarment({ components: 1 });
  const normals = new Float32Array(garment.mean.length);
  normalsInto(normals, garment.mean, garment.indices);

  it('gives every point a direction of length 1', () => {
    for (let i = 0; i < normals.length; i += 3 * 97) {
      expect(Math.hypot(normals[i], normals[i + 1], normals[i + 2])).toBeCloseTo(1, 4);
    }
  });

  it('points outwards, away from the middle of the tube, so the garment is lit from the outside', () => {
    let outward = 0; let inward = 0;
    // Skip the first and last rings: on the edge of a tube the average direction is not a clean outwards.
    const a = STAND_IN_DEFAULTS.around;
    for (let p = a; p < garment.vertexCount - a; p++) {
      const dot = normals[p * 3] * garment.mean[p * 3] + normals[p * 3 + 2] * garment.mean[p * 3 + 2];
      if (dot > 0) outward++; else inward++;
    }
    expect(inward).toBe(0);
    expect(outward).toBeGreaterThan(0);
  });

  it('does not depend on what the array held before', () => {
    const dirty = new Float32Array(garment.mean.length).fill(5);
    normalsInto(dirty, garment.mean, garment.indices);
    expect(Buffer.from(dirty.buffer).equals(Buffer.from(normals.buffer))).toBe(true);
  });

  it('writes into the array it is given', () => {
    const own = new Float32Array(garment.mean.length);
    expect(normalsInto(own, garment.mean, garment.indices)).toBe(own);
  });
});

describe('sampleWeights', () => {
  it('gives the same weights for the same step, different weights for another, and stays within the amount', () => {
    expect(Array.from(sampleWeights(5, 2))).toEqual(Array.from(sampleWeights(5, 2)));
    expect(Array.from(sampleWeights(5, 2))).not.toEqual(Array.from(sampleWeights(5, 3)));
    expect(Array.from(sampleWeights(32, 4, 0.5)).every((w) => Math.abs(w) <= 0.5 + 1e-6)).toBe(true);
    expect(sampleWeights(7, 1).length).toBe(7);
  });
});

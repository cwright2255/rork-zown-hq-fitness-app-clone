// The hem of full-length pants is brought to the wearer's ankle bone (lib/tryOn/legLength.js): the part of the leg below the knee is stretched or
// squashed up-and-down, and nothing above the knee, nor any width or depth, is touched.
import { MALLEOLUS_FRACTION, HEM_FRACTION, KNEE_FRACTION, MAX_CHANGE, bodyExtent, hemToAnkle } from '../lib/tryOn/legLength';
import { GARMENTS, hasAnkleHem } from '../lib/tryOn/garments';

// A body with its soles at z = 0 and the top of its head at z = 1.8 (two vertices are enough: the function reads only the heights).
const body = () => Float32Array.from([0, 0, 0, 0, 0, 1.8]);
const KNEE = KNEE_FRACTION * 1.8; // 0.513
// A made-up pair of pants: [x, y, z] for the band, the thigh, the knee, the shin and the hem.
const pants = (hem = 0.15) => Float32Array.from([0.2, -0.1, 1.1, 0.25, 0.0, 0.8, 0.2, 0.05, KNEE, 0.18, 0.05, 0.3, 0.15, 0.04, hem]);
const z = (g, p) => g[3 * p + 2];

describe('bodyExtent', () => {
  it('is the floor and the height of the body', () => {
    expect(bodyExtent(Float32Array.from([0, 0, 0.1, 0, 0, 1.9]))).toEqual({ floor: expect.closeTo(0.1, 5), height: expect.closeTo(1.8, 5) });
  });
  it('is null for no body, a body too small to be one, or a broken number', () => {
    expect(bodyExtent(null)).toBeNull();
    expect(bodyExtent(new Float32Array(6))).toBeNull();
    expect(bodyExtent(Float32Array.from([0, 0, 0, 0, 0, 0.2, 0, 0, 0.1]))).toBeNull();
    expect(bodyExtent(Float32Array.from([0, 0, 0, 0, 0, NaN, 0, 0, 1.8]))).toBeNull();
  });
});

describe('hemToAnkle', () => {
  it('puts the hem a little under the middle of the ankle bone', () => {
    expect(HEM_FRACTION).toBeLessThan(MALLEOLUS_FRACTION);
    const g = pants(0.15);
    const moved = hemToAnkle(g, body());
    expect(moved).toBeCloseTo(0.15 - HEM_FRACTION * 1.8, 5);
    expect(z(g, 4)).toBeCloseTo(HEM_FRACTION * 1.8, 5);
  });

  it('leaves everything from the knee up where it was', () => {
    const g = pants(0.15);
    const before = Array.from(g);
    hemToAnkle(g, body());
    expect(z(g, 0)).toBe(before[2]);
    expect(z(g, 1)).toBe(before[5]);
    expect(z(g, 2)).toBeCloseTo(KNEE, 6);
  });

  it('stretches the points between the knee and the hem in proportion', () => {
    const g = pants(0.15);
    const moved = hemToAnkle(g, body());
    const t = (KNEE - 0.3) / (KNEE - 0.15); // how far down the shin point is
    expect(z(g, 3)).toBeCloseTo(0.3 - moved * t, 5);
    expect(z(g, 2)).toBeGreaterThan(z(g, 3));
    expect(z(g, 3)).toBeGreaterThan(z(g, 4));
  });

  it('leaves the sideways and front-to-back shape alone', () => {
    const g = pants();
    const before = Array.from(g);
    hemToAnkle(g, body());
    for (let p = 0; p < 5; p++) {
      expect(g[3 * p]).toBe(before[3 * p]);
      expect(g[3 * p + 1]).toBe(before[3 * p + 1]);
    }
  });

  it('shortens legs that reach the floor, and says so with a negative number', () => {
    const g = pants(0.01);
    const moved = hemToAnkle(g, body());
    expect(moved).toBeCloseTo(0.01 - HEM_FRACTION * 1.8, 5);
    expect(moved).toBeLessThan(0);
    expect(z(g, 4)).toBeCloseTo(HEM_FRACTION * 1.8, 5);
  });

  it('moves the hem by at most 20 cm', () => {
    // a 3 m body (knee at 0.855 m) in pants whose hem is at 0.5 m: 40 cm too high, so only 20 cm is made up
    const g = Float32Array.from([0, 0, 1.5, 0, 0, 0.9, 0, 0, 0.5]);
    const moved = hemToAnkle(g, Float32Array.from([0, 0, 0, 0, 0, 3.0]));
    expect(MAX_CHANGE).toBeCloseTo(0.2, 6);
    expect(moved).toBeCloseTo(0.2, 6);
    expect(g[8]).toBeCloseTo(0.3, 5);
    expect(g[5]).toBeCloseTo(0.9, 6);
  });

  it('works on a body of any height: the hem goes to the same fraction of it', () => {
    const tall = Float32Array.from([0, 0, 0, 0, 0, 2.0]);
    const g = pants(0.2);
    hemToAnkle(g, tall);
    expect(z(g, 4)).toBeCloseTo(HEM_FRACTION * 2.0, 5);
  });

  it('measures from the floor, not from zero', () => {
    const raised = Float32Array.from([0, 0, 5, 0, 0, 6.8]); // the same body, 5 m up
    const g = pants(0.15);
    for (let i = 2; i < g.length; i += 3) g[i] += 5; // the same garment, 5 m up
    hemToAnkle(g, raised);
    expect(z(g, 4)).toBeCloseTo(5 + HEM_FRACTION * 1.8, 4);
  });

  it('does nothing when the hem is already there (to a millimetre)', () => {
    const g = pants(HEM_FRACTION * 1.8 + 0.0005);
    const before = Array.from(g);
    expect(hemToAnkle(g, body())).toBe(0);
    expect(Array.from(g)).toEqual(before);
  });

  it('does nothing without a body, without points, with a broken number, or when the hem is not below the knee', () => {
    const g = pants();
    const before = Array.from(g);
    expect(hemToAnkle(g, null)).toBe(0);
    expect(hemToAnkle(null, body())).toBe(0);
    expect(hemToAnkle(new Float32Array(0), body())).toBe(0);
    const broken = pants();
    broken[8] = NaN;
    expect(hemToAnkle(broken, body())).toBe(0);
    const shorts = Float32Array.from([0, 0, 1.0, 0, 0, 0.7, 0, 0, 0.6]); // a hem above the knee: not full length
    expect(hemToAnkle(shorts, body())).toBe(0);
    expect(Array.from(g)).toEqual(before);
  });
});

describe('which garments are hemmed to the ankle', () => {
  it('is none: the sweatpants packs (v2.2 pattern) come with the hem at the ankle', () => {
    expect(hasAnkleHem('men', 'sweatpants')).toBe(false);
    expect(hasAnkleHem('men', 'shorts')).toBe(false);
    expect(hasAnkleHem('women', 'cami')).toBe(false);
    expect(hasAnkleHem('men', 'unknown')).toBe(false);
    expect(GARMENTS.filter((g) => g.ankleHem).map((g) => g.key)).toEqual([]);
  });
  it('follows the flag on a garment', () => {
    const sweatpants = GARMENTS.find((g) => g.key === 'sweatpants');
    sweatpants.ankleHem = true;
    try {
      expect(hasAnkleHem('men', 'sweatpants')).toBe(true);
      expect(hasAnkleHem('women', 'sweatpants')).toBe(false);
    } finally {
      delete sweatpants.ankleHem;
    }
    expect(hasAnkleHem('men', 'sweatpants')).toBe(false);
  });
});

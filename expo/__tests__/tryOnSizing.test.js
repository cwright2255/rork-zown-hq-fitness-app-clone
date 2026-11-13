// Which size to try first (lib/tryOn/sizing.js), on a made-up sizing file: a tape measure read off three vertices of an 8-vertex body, and three sizes whose
// chance of coming out too tight or too loose follows the measured waist. The real sizing files are built from the simulated fits (docs/TRYON_PACKS.md).
import { decodeSizing, measureBody, measuresNeeded, featureVector, sizeFit, verdictOf, chooseSize } from '../lib/tryOn/sizing';

const b64 = (floats) => Buffer.from(new Float32Array(floats).buffer).toString('base64');
const i16 = (ints) => Buffer.from(new Int16Array(ints).buffer).toString('base64');

// waist (cm) = 1000 x the sideways distance of vertex 1 from the middle of the soles; hip = 500 x that of vertex 3 plus 10
const sizingJson = () => ({
  version: 1,
  group: 'men',
  zoneIdx: i16([1, 3, 5]),
  measures: {
    waist: { b0: 0, w: b64([1000, 0, 0, 0, 0, 0, 0, 0, 0]) },
    hip: { b0: 10, w: b64([0, 0, 0, 500, 0, 0, 0, 0, 0]) },
    bust: { b0: 0, w: b64([0, 0, 0, 0, 0, 0, 1000, 0, 0]) },
    ub: { b0: 0, w: b64([0, 0, 0, 0, 0, 0, 800, 0, 0]) },
  },
  pick: { margin: 1.5, sigma: 1.5 },
  garments: {
    shorts: {
      features: ['waist'],
      sizes: {
        S: { tight: { b0: -64, b: [0.8] }, loose: { b0: 0, b: [-0.8] }, lo: [60], hi: [80], centre: [70], sd: [5] },
        M: { tight: { b0: -72, b: [0.8] }, loose: { b0: -40, b: [-0.5] }, lo: [70], hi: [95], centre: [82], sd: [5] },
        L: { tight: { b0: -88, b: [0.8] }, loose: { b0: -60, b: [-0.7] }, lo: [85], hi: [110], centre: [97], sd: [5] },
      },
    },
    bra: {
      features: ['ub', 'cup'],
      sizes: { M: { tight: { b0: -5, b: [0.05, 0.1] }, loose: { b0: -12, b: [0, 0] }, lo: [70, 5], hi: [90, 20], centre: [80, 12], sd: [4, 3] } },
    },
  },
});

// 8 vertices: four soles on the floor, then points higher up. Vertex 1 sits `x1` metres from the middle of the soles' x.
const bodyWith = ({ x1, x3 = 0.1, x5 = 0.1 }) => {
  const v = new Float32Array(8 * 3);
  const set = (i, x, y, z) => { v[3 * i] = x; v[3 * i + 1] = y; v[3 * i + 2] = z; };
  set(0, -0.1, 0, 0); set(1, x1, 0, 1); set(2, 0, 0.1, 1.4); set(3, x3, 0, 1.2); set(4, 0.1, 0, 0); set(5, x5, 0, 1.4); set(6, 0, 0, 0); set(7, 0, 0, 1.7);
  // the soles are vertices 0, 4, 6 and a fourth at the same height: put vertex 2's twin on the floor too, so the sole centre is the mean x of those
  return v;
};

describe('decodeSizing and measureBody', () => {
  const sizing = decodeSizing(sizingJson());

  it('turns the stored weights into numbers', () => {
    expect(sizing.zoneIdx).toBeInstanceOf(Int16Array);
    expect(sizing.measures.waist.w).toBeInstanceOf(Float32Array);
    expect(sizing.measures.waist.w).toHaveLength(9);
  });

  it('refuses a sizing file whose weights do not match its vertex list', () => {
    const bad = sizingJson();
    bad.measures.waist.w = b64([1, 2, 3]);
    expect(() => decodeSizing(bad)).toThrow('does not match itself');
  });

  it('reads a tape measure off the body, with the soles moved to the origin first', () => {
    const body = bodyWith({ x1: 0.12 });
    // the soles (z = 0) are vertices 0, 4 and 6: mean x = (-0.1 + 0.1 + 0) / 3 = 0
    expect(measureBody(sizing, body, ['waist']).waist).toBeCloseTo(120, 3);
    const moved = body.slice();
    for (let i = 0; i < moved.length; i += 3) { moved[i] += 3; moved[i + 1] += 2; moved[i + 2] += 1; }
    expect(measureBody(sizing, moved, ['waist']).waist).toBeCloseTo(120, 3);
  });

  it('includes the stored constant', () => {
    expect(measureBody(sizing, bodyWith({ x1: 0.1, x3: 0.2 }), ['hip']).hip).toBeCloseTo(110, 3);
  });

  it('refuses a measure the file does not have', () => {
    expect(() => measureBody(sizing, bodyWith({ x1: 0.1 }), ['inseam'])).toThrow('no inseam');
  });
});

describe('what a garment needs measured', () => {
  const sizing = decodeSizing(sizingJson());

  it('is the waist for the shorts and the bust and underbust for a cup', () => {
    expect(measuresNeeded(sizing.garments.shorts)).toEqual(['waist']);
    expect(measuresNeeded(sizing.garments.bra).sort()).toEqual(['bust', 'ub']);
  });

  it('works out a cup as the bust minus the underbust', () => {
    expect(featureVector(sizing.garments.bra, { bust: 95, ub: 80 })).toEqual([80, 15]);
    expect(featureVector(sizing.garments.shorts, { waist: 81 })).toEqual([81]);
  });
});

describe('chooseSize', () => {
  const sizing = decodeSizing(sizingJson());

  it.each([[68, 'S'], [82, 'M'], [97, 'L']])('a body measuring a %i cm waist is sent to size %s, with the sizes listed smallest first', (waist, size) => {
    const choice = chooseSize(sizing, 'shorts', bodyWith({ x1: waist / 1000 }));
    expect(choice.measures.waist).toBeCloseTo(waist, 1);
    expect(choice.size).toBe(size);
    expect(choice.anyInside).toBe(true);
    expect(choice.sizes.map((s) => s.size)).toEqual(['S', 'M', 'L']);
  });

  it('calls the picked size a good fit when it is likely to fit', () => {
    expect(chooseSize(sizing, 'shorts', bodyWith({ x1: 0.082 })).verdict).toBe('good');
  });

  it('flags a body outside everything the sizes were tested on, and picks the closest size', () => {
    const choice = chooseSize(sizing, 'shorts', bodyWith({ x1: 0.14 }));
    expect(choice.anyInside).toBe(false);
    expect(choice.verdict).toBe('outside');
    expect(choice.size).toBe('L');
  });

  it('throws for a garment it has no sizing for', () => {
    expect(() => chooseSize(sizing, 'jacket', bodyWith({ x1: 0.08 }))).toThrow('no sizing for jacket');
  });
});

describe('sizeFit and verdictOf', () => {
  const sizing = decodeSizing(sizingJson());
  const shorts = sizing.garments.shorts;

  it('reads a size the body is well below as loose and well above as tight, not as "outside"', () => {
    const small = sizeFit(sizing, shorts, 'L', [78]);
    expect(small.inside).toBe(false);
    expect(verdictOf(small, true)).toBe('loose');
    const big = sizeFit(sizing, shorts, 'S', [96]);
    expect(big.inside).toBe(false);
    expect(verdictOf(big, true)).toBe('tight');
  });

  it('says tight when the chance of too tight is the larger worry inside the tested range, and loose for the other', () => {
    const edgeTight = sizeFit(sizing, shorts, 'M', [93]);
    expect(edgeTight.inside).toBe(true);
    expect(edgeTight.pFit).toBeLessThan(0.8);
    expect(['tight', 'likely']).toContain(verdictOf(edgeTight, true));
    expect(verdictOf({ inside: true, pFit: 0.3, pTight: 0.1, pLoose: 0.6 }, true)).toBe('loose');
    expect(verdictOf({ inside: true, pFit: 0.3, pTight: 0.6, pLoose: 0.1 }, true)).toBe('tight');
    expect(verdictOf({ inside: true, pFit: 0.7, pTight: 0.2, pLoose: 0.1 }, true)).toBe('likely');
    expect(verdictOf({ inside: true, pFit: 0.95, pTight: 0.02, pLoose: 0.03 }, true)).toBe('good');
  });

  it('is "outside" for every size when the body is outside all of them', () => {
    expect(verdictOf({ inside: false, pFit: 0.9, pTight: 0, pLoose: 0, side: 1 }, false)).toBe('outside');
  });

  it('gives probabilities between 0 and 1 that add up as P(fit) = (1 - P(tight)) x (1 - P(loose))', () => {
    const fit = sizeFit(sizing, shorts, 'M', [82]);
    for (const p of [fit.pTight, fit.pLoose, fit.pFit]) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
    expect(fit.pFit).toBeCloseTo((1 - fit.pTight) * (1 - fit.pLoose), 10);
  });
});

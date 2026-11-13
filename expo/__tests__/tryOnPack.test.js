// The drape pack reader (lib/tryOn/pack.js) against a tiny pack made by the pack builder itself (fixtures/tryon/tiny.zdp, made-up numbers, 2.6 KB):
// the blend and the body numbers must come out the same as the builder's own. Also what it does with a file that is not a pack or is cut short.
const fs = require('fs');
const path = require('path');
import { parsePack, shapeNumbers, blendGarment, bodyDistance, OUTSIDE_RATIO } from '../lib/tryOn/pack';

const DIR = path.join(__dirname, 'fixtures', 'tryon');
const file = () => { const b = fs.readFileSync(path.join(DIR, 'tiny.zdp')); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const expected = JSON.parse(fs.readFileSync(path.join(DIR, 'tiny.expected.json'), 'utf8'));
const bodyOf = (i) => new Float32Array(expected.bodies[i]);

describe('parsePack', () => {
  it('reads the header and every array of a pack made by the builder', () => {
    const pack = parsePack(file());
    expect(pack.head).toMatchObject({ k: 3, r: 6, n_train: 14, n_vertices: 10, garment: 'tiny' });
    expect(pack.A.V_int16).toBeInstanceOf(Int16Array);
    expect(pack.A.V_int16.length).toBe(6 * 30);
    expect(pack.A.faces).toBeInstanceOf(Uint16Array);
    expect(pack.A.faces.length).toBe(8 * 3);
    expect(pack.A.Ztrain).toBeInstanceOf(Float32Array);
  });

  it('accepts a Uint8Array that is a view into a larger buffer', () => {
    const inner = new Uint8Array(file());
    const padded = new Uint8Array(inner.length + 7);
    padded.set(inner, 7);
    const pack = parsePack(padded.subarray(7));
    expect(blendGarment(pack, bodyOf(1))).toEqual(blendGarment(parsePack(file()), bodyOf(1)));
  });

  it('refuses a file that is not a drape pack', () => {
    expect(() => parsePack(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow('not a drape pack');
    expect(() => parsePack(new ArrayBuffer(3))).toThrow('not a drape pack');
  });

  it('refuses a pack that is cut short, in the header or in an array', () => {
    const whole = new Uint8Array(file());
    expect(() => parsePack(whole.slice(0, 20))).toThrow('cut short');
    expect(() => parsePack(whole.slice(0, whole.length - 10))).toThrow('cut short');
  });
});

describe('the blend matches the pack builder\'s own', () => {
  const pack = parsePack(file());

  it.each([0, 1, 2, 3])('body %i: the body numbers', (i) => {
    const z = shapeNumbers(pack, bodyOf(i));
    expect(Array.from(z)).toHaveLength(3);
    z.forEach((v, d) => expect(v).toBeCloseTo(expected.shape_numbers[i][d], 3));
  });

  it.each([0, 1, 2, 3])('body %i: the garment vertices', (i) => {
    const out = blendGarment(pack, bodyOf(i));
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(30);
    let worst = 0;
    for (let v = 0; v < 30; v++) worst = Math.max(worst, Math.abs(out[v] - expected.garments[i][v]));
    expect(worst).toBeLessThan(1e-4); // metres: a tenth of a millimetre
  });

  it('writes into the array it is given instead of making a new one', () => {
    const out = new Float32Array(30);
    const result = blendGarment(pack, bodyOf(1), out);
    expect(result).toBe(out);
    expect(out.some((v) => v !== 0)).toBe(true);
  });

  it('gives the same garment wherever the body stands: the soles are moved to the origin first', () => {
    const moved = bodyOf(1).slice();
    for (let i = 0; i < moved.length; i += 3) { moved[i] += 2; moved[i + 1] -= 1.5; }
    const a = blendGarment(pack, bodyOf(1));
    const b = blendGarment(pack, moved);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 4);
  });
});

describe('bodyDistance', () => {
  const pack = parsePack(file());

  it('says a body the pack was built on is at distance 0', () => {
    const d = bodyDistance(pack, shapeNumbers(pack, bodyOf(0)));
    expect(d.nearest).toBeCloseTo(0, 2);
    expect(d.outside).toBe(false);
  });

  it('says a body unlike every training body is outside', () => {
    const d = bodyDistance(pack, shapeNumbers(pack, bodyOf(3)));
    expect(d.ratio).toBeGreaterThan(OUTSIDE_RATIO);
    expect(d.outside).toBe(true);
  });
});

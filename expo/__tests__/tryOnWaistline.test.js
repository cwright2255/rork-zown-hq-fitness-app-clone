// The waistband of shorts and pants is set just under the navel (lib/tryOn/waistline.js): the band moves down to its place, the hem stays, and
// the garment's width and depth are not touched.
import { NAVEL_VERTEX, WAIST_BELOW_NAVEL, MAX_LOWERING, navelHeight, lowerWaistband } from '../lib/tryOn/waistline';
import { BODY_VERTEX_COUNT } from '../lib/tryOn/tryOnSession';
import { GARMENTS, hasWaistband } from '../lib/tryOn/garments';

// A body of the body model's size with the navel at height z; every other vertex is at the origin.
const bodyWithNavel = (z) => {
  const body = new Float32Array(BODY_VERTEX_COUNT * 3);
  body[3 * NAVEL_VERTEX + 2] = z;
  return body;
};
// Four points of a made-up garment: two on the top of the band, one half-way, one on the hem. [x, y, z] each.
const garment = (top = 1.15, hem = 0.1) => Float32Array.from([0.2, -0.1, top, -0.2, 0.1, top, 0.3, 0.0, (top + hem) / 2, 0.25, 0.05, hem]);
const heights = (g) => [g[2], g[5], g[8], g[11]];

describe('navelHeight', () => {
  it('is the height of the navel vertex', () => {
    expect(navelHeight(bodyWithNavel(1.05))).toBeCloseTo(1.05, 5);
  });
  it('is null for a body without that vertex or with a broken number there', () => {
    expect(navelHeight(new Float32Array(30))).toBeNull();
    expect(navelHeight(null)).toBeNull();
    expect(navelHeight(bodyWithNavel(NaN))).toBeNull();
  });
});

describe('lowerWaistband', () => {
  it('puts the top of the band 3 cm under the navel', () => {
    const g = garment(1.15, 0.1);
    const moved = lowerWaistband(g, bodyWithNavel(1.05));
    expect(WAIST_BELOW_NAVEL).toBeCloseTo(0.03, 6);
    expect(moved).toBeCloseTo(1.15 - (1.05 - 0.03), 5);
    expect(g[2]).toBeCloseTo(1.02, 5);
    expect(g[5]).toBeCloseTo(1.02, 5);
  });

  it('keeps the hem where it is and moves the points between in proportion', () => {
    const g = garment(1.15, 0.1);
    const moved = lowerWaistband(g, bodyWithNavel(1.05));
    expect(g[11]).toBeCloseTo(0.1, 6); // hem
    expect(g[8]).toBeCloseTo(0.625 - moved * 0.5, 5); // half-way up moves half as far
    const [a, , mid, hem] = heights(g);
    expect(a).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(hem);
  });

  it('leaves the sideways and front-to-back shape alone', () => {
    const g = garment();
    const before = Array.from(g);
    lowerWaistband(g, bodyWithNavel(1.05));
    for (let p = 0; p < 4; p++) {
      expect(g[3 * p]).toBe(before[3 * p]);
      expect(g[3 * p + 1]).toBe(before[3 * p + 1]);
    }
  });

  it('never raises a band that is already under the navel', () => {
    const g = garment(0.95, 0.1);
    const before = Array.from(g);
    expect(lowerWaistband(g, bodyWithNavel(1.05))).toBe(0);
    expect(Array.from(g)).toEqual(before);
  });

  it('does not move a band that is exactly where it should be', () => {
    const g = garment(1.02, 0.1);
    expect(lowerWaistband(g, bodyWithNavel(1.05))).toBe(0);
    const near = garment(1.0205, 0.1); // half a millimetre too high: not worth a move
    expect(lowerWaistband(near, bodyWithNavel(1.05))).toBe(0);
  });

  it('moves the band by at most 20 cm', () => {
    const g = garment(1.6, 0.1);
    const moved = lowerWaistband(g, bodyWithNavel(1.05));
    expect(MAX_LOWERING).toBeCloseTo(0.2, 6);
    expect(moved).toBeCloseTo(0.2, 6);
    expect(g[2]).toBeCloseTo(1.4, 5);
    expect(g[11]).toBeCloseTo(0.1, 6);
  });

  it('accepts another distance under the navel', () => {
    const g = garment(1.15, 0.1);
    lowerWaistband(g, bodyWithNavel(1.05), 0.05);
    expect(g[2]).toBeCloseTo(1.0, 5);
  });

  it('does nothing without a navel, without points, with a broken number, or with a garment too flat to squash', () => {
    const g = garment();
    const before = Array.from(g);
    expect(lowerWaistband(g, new Float32Array(30))).toBe(0);
    expect(Array.from(g)).toEqual(before);
    expect(lowerWaistband(new Float32Array(0), bodyWithNavel(1.05))).toBe(0);
    expect(lowerWaistband(null, bodyWithNavel(1.05))).toBe(0);
    const broken = garment();
    broken[8] = NaN;
    expect(lowerWaistband(broken, bodyWithNavel(1.05))).toBe(0);
    const flat = garment(1.15, 1.12);
    expect(lowerWaistband(flat, bodyWithNavel(1.05))).toBe(0);
    expect(flat[2]).toBeCloseTo(1.15, 5);
  });
});

describe('which garments have a waistband', () => {
  it('is the shorts and the sweatpants, and nothing worn above the waist', () => {
    expect(hasWaistband('men', 'shorts')).toBe(true);
    expect(hasWaistband('men', 'sweatpants')).toBe(true);
    expect(hasWaistband('women', 'bra')).toBe(false);
    expect(hasWaistband('women', 'cami')).toBe(false);
    expect(hasWaistband('men', 'unknown')).toBe(false);
    expect(hasWaistband('women', 'shorts')).toBe(false); // the shorts pack is the men's
  });
  it('is set only on garments that exist', () => {
    for (const g of GARMENTS) expect(typeof (g.waistband || false)).toBe('boolean');
    expect(GARMENTS.filter((g) => g.waistband).map((g) => g.key).sort()).toEqual(['shorts', 'sweatpants']);
  });
});

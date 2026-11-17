// The waistband of shorts and pants is set just under the navel (lib/tryOn/waistline.js): the band moves down to its place, the hem stays, and
// the garment's width and depth are not touched.
import { NAVEL_VERTEX, WAIST_BELOW_NAVEL, MAX_LOWERING, SEAT_FRACTION, navelHeight, lowerWaistband } from '../lib/tryOn/waistline';
import { BODY_VERTEX_COUNT } from '../lib/tryOn/tryOnSession';
import { GARMENTS, hasWaistband, waistbandKind } from '../lib/tryOn/garments';

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

describe('lowerWaistband tilted (lower in front, above the seat only)', () => {
  // bodyWithNavel(1.05) has a floor at 0 and a height of 1.05 m, so its seat is at SEAT_FRACTION x 1.05 = 0.4725 m.
  const seat = SEAT_FRACTION * 1.05;
  const body = () => bodyWithNavel(1.05);
  // A body 1.05 m tall (so the same seat) whose navel is at navelZ, for a band that has to come down a long way.
  const bodyTall = (navelZ) => {
    const b = bodyWithNavel(navelZ);
    b[2] = 1.05;
    return b;
  };
  // Six points of a made-up pair of pants, x, y, z each (the front of the body is the smaller y): the top of the band at the front, at the side and at
  // the back, one half-way down the front, one under the seat, and one on the hem.
  const FRONT_TOP = 2;
  const SIDE_TOP = 5;
  const BACK_TOP = 8;
  const FRONT_MID = 11;
  const UNDER_SEAT = 14;
  const HEM = 17;
  const pants = (top = 1.15, hem = 0.1) => Float32Array.from([
    0.0, -0.2, top, // 0 front top (its z is at index 2)
    0.3, 0.0, top, // 1 side top (index 5)
    0.0, 0.2, top, // 2 back top (index 8)
    0.0, -0.2, (top + seat) / 2, // 3 front, half-way between the top and the seat (index 11)
    0.1, -0.2, seat - 0.2, // 4 under the seat (index 14)
    0.1, 0.0, hem, // 5 hem (index 17)
  ]);

  it('puts the top of the band at the front 3 cm under the navel', () => {
    const g = pants(1.15);
    const moved = lowerWaistband(g, body(), WAIST_BELOW_NAVEL, true);
    expect(SEAT_FRACTION).toBeCloseTo(0.45, 6);
    expect(moved).toBeCloseTo(1.15 - 1.02, 5);
    expect(g[FRONT_TOP]).toBeCloseTo(1.02, 5);
  });

  it('leaves the back where it was, moves the side part of the way, and keeps the back above the front', () => {
    const g = pants(1.15);
    const moved = lowerWaistband(g, body(), WAIST_BELOW_NAVEL, true);
    expect(g[BACK_TOP]).toBe(Math.fround(1.15));
    const side = 1.15 - g[SIDE_TOP];
    expect(side).toBeGreaterThan(0.2 * moved);
    expect(side).toBeLessThan(0.8 * moved);
    expect(g[BACK_TOP]).toBeGreaterThan(g[SIDE_TOP]);
    expect(g[SIDE_TOP]).toBeGreaterThan(g[FRONT_TOP]);
  });

  it('leaves everything under the seat where it was, and moves the front above it in proportion', () => {
    const g = pants(1.15);
    const moved = lowerWaistband(g, body(), WAIST_BELOW_NAVEL, true);
    expect(g[UNDER_SEAT]).toBe(Math.fround(seat - 0.2));
    expect(g[HEM]).toBe(Math.fround(0.1));
    const mid = (1.15 + seat) / 2;
    expect(g[FRONT_MID]).toBeCloseTo(mid - (moved * (mid - seat)) / (1.15 - seat), 5);
    expect(g[FRONT_MID]).toBeGreaterThan(seat);
    expect(g[FRONT_MID]).toBeLessThan(g[FRONT_TOP]);
  });

  it('leaves the sideways and front-to-back shape alone', () => {
    const g = pants(1.15);
    const before = Array.from(g);
    lowerWaistband(g, body(), WAIST_BELOW_NAVEL, true);
    for (let p = 0; p < 6; p++) {
      expect(g[3 * p]).toBe(before[3 * p]);
      expect(g[3 * p + 1]).toBe(before[3 * p + 1]);
    }
  });

  it('takes its move from the front of the band, however high the back is', () => {
    // the front top is at 1.1 and the back top at 1.15: the front has to come down 8 cm, and only the front
    const g = pants(1.15);
    g[FRONT_TOP] = 1.1;
    const moved = lowerWaistband(g, body(), WAIST_BELOW_NAVEL, true);
    expect(moved).toBeCloseTo(1.1 - 1.02, 5);
    expect(g[FRONT_TOP]).toBeCloseTo(1.02, 5);
    expect(g[BACK_TOP]).toBe(Math.fround(1.15));
    // and a front that is already under the navel is left alone, back included
    const low = pants(1.15);
    low[FRONT_TOP] = 1.0;
    const before = Array.from(low);
    expect(lowerWaistband(low, body(), WAIST_BELOW_NAVEL, true)).toBe(0);
    expect(Array.from(low)).toEqual(before);
  });

  it('lowers everything above the seat the same way when the garment has no depth to tilt over (a flat one)', () => {
    const flat = (top, hem) => Float32Array.from([0.0, 0.0, top, 0.3, 0.0, top, 0.0, 0.0, (top + hem) / 2, 0.1, 0.0, hem]);
    const a = flat(1.15, 0.6); // hem above the seat: the same as squashing about the hem
    const b = flat(1.15, 0.6);
    const moved = lowerWaistband(a, body(), WAIST_BELOW_NAVEL, true);
    expect(moved).toBeCloseTo(lowerWaistband(b, body()), 6);
    for (let i = 0; i < 12; i++) expect(a[i]).toBeCloseTo(b[i], 6);
    const c = flat(1.15, 0.1);
    lowerWaistband(c, body(), WAIST_BELOW_NAVEL, true);
    expect(c[2]).toBeCloseTo(1.02, 5);
    expect(c[5]).toBeCloseTo(1.02, 5);
    expect(c[11]).toBe(Math.fround(0.1));
  });

  it('never raises a band that is already under the navel, and keeps the 20 cm limit', () => {
    const low = pants(0.95);
    const before = Array.from(low);
    expect(lowerWaistband(low, body(), WAIST_BELOW_NAVEL, true)).toBe(0);
    expect(Array.from(low)).toEqual(before);
    const high = pants(1.6);
    expect(lowerWaistband(high, body(), WAIST_BELOW_NAVEL, true)).toBeCloseTo(MAX_LOWERING, 6);
    expect(high[HEM]).toBe(Math.fround(0.1));
    expect(high[BACK_TOP]).toBe(Math.fround(1.6));
  });

  it('takes out at most 80 % of the height above the seat at the front, so no point is brought down past one under it', () => {
    // the top is 7.75 cm over the seat and the navel would have it come down 28 cm (20 cm after the limit): it is held to 6.2 cm
    const g = pants(seat + 0.0775);
    const moved = lowerWaistband(g, bodyTall(0.3), WAIST_BELOW_NAVEL, true);
    expect(moved).toBeCloseTo(0.8 * 0.0775, 5);
    expect(g[FRONT_TOP]).toBeGreaterThan(seat);
    expect(g[FRONT_TOP]).toBeGreaterThan(g[FRONT_MID]);
    expect(g[FRONT_MID]).toBeGreaterThan(seat);
  });

  it('does nothing for a body with no usable height, a broken number, or when the part above the seat is too short', () => {
    const g = pants();
    const before = Array.from(g);
    expect(lowerWaistband(g, bodyWithNavel(0.3), WAIST_BELOW_NAVEL, true)).toBe(0); // a body under 0.5 m has no height to find the seat from
    expect(lowerWaistband(g, new Float32Array(30), WAIST_BELOW_NAVEL, true)).toBe(0);
    expect(Array.from(g)).toEqual(before);
    const brokenZ = pants();
    brokenZ[FRONT_MID] = NaN;
    expect(lowerWaistband(brokenZ, body(), WAIST_BELOW_NAVEL, true)).toBe(0);
    const brokenY = pants();
    brokenY[BACK_TOP - 1] = NaN;
    expect(lowerWaistband(brokenY, body(), WAIST_BELOW_NAVEL, true)).toBe(0);
    expect(brokenY[FRONT_TOP]).toBe(Math.fround(1.15));
    const flat = pants(seat + 0.03); // its top is only 3 cm above the seat
    expect(lowerWaistband(flat, body(), WAIST_BELOW_NAVEL, true)).toBe(0);
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
  it('squashes the shorts about the hem and tilts the sweatpants', () => {
    expect(waistbandKind('men', 'shorts')).toBe('hem');
    expect(waistbandKind('men', 'sweatpants')).toBe('tilt');
    expect(waistbandKind('women', 'cami')).toBeNull();
    expect(waistbandKind('men', 'unknown')).toBeNull();
  });
  it('is set only on garments that exist', () => {
    for (const g of GARMENTS) expect(g.waistband === undefined || g.waistband === true || g.waistband === 'tilt').toBe(true);
    expect(GARMENTS.filter((g) => g.waistband).map((g) => g.key).sort()).toEqual(['shorts', 'sweatpants']);
  });
});

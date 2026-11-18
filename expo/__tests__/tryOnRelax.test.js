// A little more room in a pair of pants (lib/tryOn/relax.js), on made-up legs: two tubes (radius 7 cm, 1 m tall) 24 cm apart, and a pair of pants round them,
// two open tubes (radius 8.5 cm, from 20 cm to 90 cm up), 1.5 cm off the skin.
import { relaxFit, BAND_RAMP, HEM_RAMP, HEM_KEEP, FAR } from '../lib/tryOn/relax';
import { buildBodyIndex, boundsOf, pushOut, GAP } from '../lib/tryOn/pushOut';
import { relaxAmount, GARMENTS } from '../lib/tryOn/garments';

const N = 24;

// A tube along z centred at (cx, 0), outward facing triangles, rings every `step` metres.
function tube(cx, radius, z0, z1, step) {
  const rings = Math.round((z1 - z0) / step) + 1;
  const verts = new Float32Array(rings * N * 3);
  for (let r = 0; r < rings; r++) {
    for (let j = 0; j < N; j++) {
      const a = (2 * Math.PI * j) / N;
      verts.set([cx + radius * Math.cos(a), radius * Math.sin(a), z0 + r * step], 3 * (r * N + j));
    }
  }
  const faces = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let j = 0; j < N; j++) {
      const a = r * N + j; const b = r * N + ((j + 1) % N); const c = (r + 1) * N + j; const d = (r + 1) * N + ((j + 1) % N);
      faces.push(a, b, c, b, d, c);
    }
  }
  return { verts, faces, rings };
}
function twoTubes(radius, z0, z1, step, centre = 0.12) {
  const l = tube(centre, radius, z0, z1, step); const r = tube(-centre, radius, z0, z1, step);
  const verts = new Float32Array(l.verts.length * 2); verts.set(l.verts); verts.set(r.verts, l.verts.length);
  const off = l.verts.length / 3;
  return { positions: verts, faces: Uint32Array.from([...l.faces, ...r.faces.map((i) => i + off)]), rings: l.rings, per: l.verts.length / 3 };
}

const body = twoTubes(0.07, 0, 1, 0.02);
const index = () => buildBodyIndex(body.positions, body.faces);
const pants = () => twoTubes(0.085, 0.2, 0.9, 0.02);
const ring = (g, side, r) => { const o = (side === 0 ? 0 : g.per) + r * N; return o; };
// radius from the leg's centre line of one point of a ring (the one on the outside of the leg, j = 0 for the left leg and j = N/2 for the right)
const outer = (g, side, r) => {
  const o = ring(g, side, r) + (side === 0 ? 0 : N / 2); const cx = side === 0 ? 0.12 : -0.12;
  return Math.hypot(g.positions[3 * o] - cx, g.positions[3 * o + 1]);
};
const inner = (g, side, r) => {
  const o = ring(g, side, r) + (side === 0 ? N / 2 : 0); const cx = side === 0 ? 0.12 : -0.12;
  return Math.hypot(g.positions[3 * o] - cx, g.positions[3 * o + 1]);
};
const rings = pants().rings; // 36
const at = (z) => Math.round((z - 0.2) / 0.02);

describe('relaxFit', () => {
  it('does nothing for an amount of 0, and nothing to a garment with nothing near the body', () => {
    const g = pants(); const before = Array.from(g.positions);
    expect(relaxFit(g.positions, index(), 0)).toBe(0);
    expect(Array.from(g.positions)).toEqual(before);
    const oneLeg = tube(0.12, 0.07, 0, 1, 0.02); const oneIndex = buildBodyIndex(oneLeg.verts, Uint32Array.from(oneLeg.faces));
    const far = tube(0.12, 0.2, 0.2, 0.9, 0.02); const farBefore = Array.from(far.verts); // 13 cm off the skin
    expect(relaxFit(far.verts, oneIndex, 0.015)).toBe(0);
    expect(Array.from(far.verts)).toEqual(farBefore);
  });

  it('moves the outside of the legs out by the whole amount, away from the waistband and the hem', () => {
    const g = pants(); expect(relaxFit(g.positions, index(), 0.015)).toBeGreaterThan(0);
    for (const side of [0, 1]) for (const z of [0.4, 0.5, 0.6]) expect(outer(g, side, at(z))).toBeCloseTo(0.085 + 0.015, 3);
  });

  it('keeps the waistband (nothing at the top edge, eased in over the band ramp) and gives the hem half', () => {
    const g = pants();
    relaxFit(g.positions, index(), 0.015);
    expect(outer(g, 0, rings - 1)).toBeCloseTo(0.085, 4); // the top edge
    expect(outer(g, 0, at(0.9 - BAND_RAMP / 2))).toBeGreaterThan(0.085); // eased in
    expect(outer(g, 0, at(0.9 - BAND_RAMP / 2))).toBeLessThan(0.1);
    expect(outer(g, 0, 0)).toBeCloseTo(0.085 + 0.015 * HEM_KEEP, 3); // the hem
    expect(outer(g, 0, Math.round(HEM_RAMP / 0.02))).toBeCloseTo(0.1, 3); // full by the end of the hem ramp
  });

  it('leaves the band where its top edge is lower in front than behind (a tilted band), measured from that edge', () => {
    const g = pants();
    // the band's top edge is 6 cm lower in front than behind: nothing in the front half is above 84 cm
    for (let i = 0; i < g.positions.length / 3; i++) if (g.positions[3 * i + 1] < 0 && g.positions[3 * i + 2] > 0.84) g.positions[3 * i + 2] = 0.84;
    relaxFit(g.positions, index(), 0.015);
    const top = ring(g, 0, rings - 1) + 18; // the front point (y = -radius) on the top ring of the left leg, now at 84 cm: at its own top edge, so not moved out
    expect(Math.hypot(g.positions[3 * top] - 0.12, g.positions[3 * top + 1])).toBeCloseTo(0.085, 4);
    // and the point on the back of the same leg is at the top of the back, also not moved
    const back = ring(g, 0, rings - 1) + 6;
    expect(Math.hypot(g.positions[3 * back] - 0.12, g.positions[3 * back + 1])).toBeCloseTo(0.085, 4);
    // a point on the front 4 cm lower is eased in only part of the way (4 cm of the 8 cm ramp)
    const mid = ring(g, 0, at(0.8)) + 18;
    const r = Math.hypot(g.positions[3 * mid] - 0.12, g.positions[3 * mid + 1]);
    expect(r).toBeGreaterThan(0.085 + 0.004); expect(r).toBeLessThan(0.085 + 0.011);
  });

  it('gives hardly any room on the sides of the legs that face each other', () => {
    const g = pants(); relaxFit(g.positions, index(), 0.015);
    for (const side of [0, 1]) expect(inner(g, side, at(0.5))).toBeLessThan(0.085 + 0.015 * 0.3);
    expect(inner(g, 0, at(0.5))).toBeCloseTo(inner(g, 1, at(0.5)), 5); // and the two legs are alike
  });

  it('does not change the body or touch a point that is inside it, and a push off the skin afterwards keeps the garment clear', () => {
    const inside = twoTubes(0.06, 0.2, 0.9, 0.02); const before = Array.from(inside.positions);
    expect(relaxFit(inside.positions, index(), 0.015)).toBe(0);
    expect(Array.from(inside.positions)).toEqual(before);
    const g = pants(); const idx = index(); relaxFit(g.positions, idx, 0.015); pushOut(g.positions, idx, GAP);
    for (let i = 0; i < g.positions.length / 3; i++) {
      const cx = g.positions[3 * i] > 0 ? 0.12 : -0.12;
      expect(Math.hypot(g.positions[3 * i] - cx, g.positions[3 * i + 1])).toBeGreaterThan(0.07 + GAP - 1e-4);
    }
  });

  it('eases off smoothly with distance from the skin: full within 3 cm, nothing beyond FAR', () => {
    const shift = (radius) => { const g = twoTubes(radius, 0.2, 0.9, 0.02); relaxFit(g.positions, index(), 0.015); return outer(g, 0, at(0.5)) - radius; };
    expect(shift(0.07 + 0.02)).toBeCloseTo(0.015, 4);
    const a = shift(0.07 + 0.04); const b = shift(0.07 + 0.05);
    expect(a).toBeGreaterThan(b); expect(a).toBeLessThan(0.015); expect(b).toBeGreaterThan(0);
    expect(shift(0.07 + FAR + 0.005)).toBeCloseTo(0, 6);
  });
});

describe('the sweatpants ease', () => {
  it('is on the sweatpants only', () => {
    expect(relaxAmount('men', 'sweatpants')).toBeGreaterThan(0.005);
    expect(relaxAmount('men', 'sweatpants')).toBeLessThan(0.03);
    expect(relaxAmount('men', 'shorts')).toBe(0);
    expect(relaxAmount('men', 'hoodie')).toBe(0);
    expect(relaxAmount('women', 'bra')).toBe(0);
    expect(relaxAmount('men', 'nothing')).toBe(0);
    expect(GARMENTS.filter((g) => g.relax).map((g) => g.key)).toEqual(['sweatpants']);
  });
});

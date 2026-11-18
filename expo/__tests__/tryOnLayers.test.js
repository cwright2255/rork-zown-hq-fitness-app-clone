// A garment worn over another one (lib/tryOn/layers.js), on made-up shapes: a body that is a tube (radius 10 cm, 1 m tall) and a garment underneath that is an open
// tube round it (radius 12 cm, from 30 cm to 70 cm up, no ends, like a pair of shorts on a leg).
import { dressBody, liftOverLayers } from '../lib/tryOn/layers';
import { buildBodyIndex, boundsOf, pushOut, GAP } from '../lib/tryOn/pushOut';

// A tube along z with outward-facing triangles: rings every `step` metres, 24 points round.
function tube(radius, z0, z1, step, caps = false) {
  const rings = Math.round((z1 - z0) / step) + 1;
  const n = 24;
  const verts = new Float32Array(rings * n * 3);
  for (let r = 0; r < rings; r++) {
    for (let j = 0; j < n; j++) {
      const a = (2 * Math.PI * j) / n;
      verts.set([radius * Math.cos(a), radius * Math.sin(a), z0 + r * step], 3 * (r * n + j));
    }
  }
  const faces = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let j = 0; j < n; j++) {
      const a = r * n + j; const b = r * n + ((j + 1) % n); const c = (r + 1) * n + j; const d = (r + 1) * n + ((j + 1) % n);
      faces.push(a, b, c, b, d, c);
    }
  }
  return { positions: verts, faces: Uint32Array.from(faces), rings, n, caps };
}
const radiusAt = (positions, ring, n, j = 0) => Math.hypot(positions[3 * (ring * n + j)], positions[3 * (ring * n + j) + 1]);

describe('dressBody', () => {
  const body = tube(0.1, 0, 1, 0.02);
  const layer = tube(0.12, 0.3, 0.7, 0.02);

  it('changes nothing when there is nothing underneath', () => {
    const none = dressBody(body.positions, body.faces, []);
    expect(none.moved).toBe(0);
    expect(Array.from(none.positions)).toEqual(Array.from(body.positions));
  });

  it('changes nothing when the garment underneath is nowhere near the body', () => {
    const far = tube(0.12, 5, 6, 0.02);
    expect(dressBody(body.positions, body.faces, [far]).moved).toBe(0);
  });

  it('moves the skin that has the garment over it out to the garment', () => {
    const dressed = dressBody(body.positions, body.faces, [layer]);
    expect(dressed.moved).toBeGreaterThan(0);
    const mid = Math.round(0.5 / 0.02);
    expect(radiusAt(dressed.positions, mid, body.n)).toBeCloseTo(0.12, 3);
    expect(radiusAt(dressed.positions, Math.round(0.4 / 0.02), body.n)).toBeCloseTo(0.12, 3);
  });

  it('leaves the skin far from the garment where it is, and does not change the input', () => {
    const before = Array.from(body.positions);
    const dressed = dressBody(body.positions, body.faces, [layer]);
    expect(Array.from(body.positions)).toEqual(before);
    expect(radiusAt(dressed.positions, 0, body.n)).toBeCloseTo(0.1, 5);
    expect(radiusAt(dressed.positions, Math.round(0.9 / 0.02), body.n)).toBeCloseTo(0.1, 5);
  });

  it('eases off beyond the garment\'s edge, with no step', () => {
    const dressed = dressBody(body.positions, body.faces, [layer]);
    const radii = [];
    for (let r = 0; r < body.rings; r++) radii.push(radiusAt(dressed.positions, r, body.n));
    const edge = Math.round(0.3 / 0.02);
    // below the edge the offset only gets smaller going away from the garment, and each step is small
    for (let r = edge - 1; r >= 0; r--) {
      expect(radii[r]).toBeLessThanOrEqual(radii[r + 1] + 1e-6);
      expect(radii[r + 1] - radii[r]).toBeLessThan(0.006);
    }
    expect(radii[edge - 1]).toBeGreaterThan(0.1); // it does not just stop at the edge
    expect(radii[0]).toBeLessThan(0.1005);
  });

  it('is symmetric round the body', () => {
    const dressed = dressBody(body.positions, body.faces, [layer]);
    const mid = Math.round(0.5 / 0.02);
    for (let j = 1; j < body.n; j++) expect(radiusAt(dressed.positions, mid, body.n, j)).toBeCloseTo(radiusAt(dressed.positions, mid, body.n, 0), 4);
  });

  it('covers the skin under a seam between two panels that do not share their vertices (the inseam and side seams of pants), and not past a real opening', () => {
    // the same garment made of two halves, each with its own vertices along the seams, which sit 3 mm apart
    const half = (from, to) => {
      const rings = layer.rings; const n = 12; const verts = new Float32Array(rings * (n + 1) * 3); const faces = [];
      for (let r = 0; r < rings; r++) for (let j = 0; j <= n; j++) {
        const a = from + ((to - from) * j) / n; const rad = 0.12 + (from === 0 ? 0.0015 : -0.0015);
        verts.set([rad * Math.cos(a), rad * Math.sin(a), 0.3 + r * 0.02], 3 * (r * (n + 1) + j));
      }
      for (let r = 0; r < rings - 1; r++) for (let j = 0; j < n; j++) {
        const a = r * (n + 1) + j; const b = a + 1; const c = (r + 1) * (n + 1) + j; const d = c + 1;
        faces.push(a, b, c, b, d, c);
      }
      return { verts, faces };
    };
    const h1 = half(0, Math.PI); const h2 = half(Math.PI, 2 * Math.PI);
    const positions = new Float32Array(h1.verts.length + h2.verts.length); positions.set(h1.verts); positions.set(h2.verts, h1.verts.length);
    const off = h1.verts.length / 3;
    const faces = Uint32Array.from([...h1.faces, ...h2.faces.map((i) => i + off)]);
    const dressed = dressBody(body.positions, body.faces, [{ positions, faces }]);
    const mid = Math.round(0.5 / 0.02);
    for (let j = 0; j < body.n; j++) expect(radiusAt(dressed.positions, mid, body.n, j)).toBeGreaterThan(0.118); // all the way round, seams included
    expect(radiusAt(dressed.positions, 0, body.n)).toBeCloseTo(0.1, 5); // and nothing at the far end of the body
  });

  it('ignores a garment that is inside the skin (the body is outside it)', () => {
    const tight = tube(0.08, 0.3, 0.7, 0.02);
    expect(dressBody(body.positions, body.faces, [tight]).moved).toBe(0);
  });

  it('keeps a top that is pushed away from the dressed body above the garment underneath, and leaves the garment alone', () => {
    const dressed = dressBody(body.positions, body.faces, [layer]);
    const top = new Float32Array([0.105, 0, 0.5, 0.0, 0.118, 0.45, 0.1, 0.1, 0.5, 0.11, 0.0, 0.1]);
    const index = buildBodyIndex(dressed.positions, body.faces, { bounds: boundsOf(top) });
    pushOut(top, index, GAP);
    for (let i = 0; i < 3; i++) expect(Math.hypot(top[3 * i], top[3 * i + 1])).toBeGreaterThan(0.12 + GAP - 0.0012);
    // the one down at the leg with no garment over it is only kept off the skin
    expect(Math.hypot(top[9], top[10])).toBeGreaterThan(0.1 + GAP - 0.0012);
    expect(Math.hypot(top[9], top[10])).toBeLessThan(0.1 + GAP + 0.01);
    expect(radiusAt(layer.positions, 5, layer.n)).toBeCloseTo(0.12, 5);
  });
});

describe('dressBody over a crease of the body', () => {
  // A tube with a groove running up it (the cleft of the seat), 72 points round, and a garment underneath that bridges the groove (radius 11 cm).
  const N = 72;
  function grooved(depth, width) {
    const rings = 51;
    const verts = new Float32Array(rings * N * 3);
    const rad = (a) => 0.1 - depth * Math.exp(-(Math.atan2(Math.sin(a), Math.cos(a)) ** 2) / (2 * width * width));
    for (let r = 0; r < rings; r++) for (let j = 0; j < N; j++) { const a = (2 * Math.PI * j) / N; verts.set([rad(a) * Math.cos(a), rad(a) * Math.sin(a), r * 0.02], 3 * (r * N + j)); }
    const faces = [];
    for (let r = 0; r < rings - 1; r++) for (let j = 0; j < N; j++) { const a = r * N + j; const b = r * N + ((j + 1) % N); const c = (r + 1) * N + j; const d = (r + 1) * N + ((j + 1) % N); faces.push(a, b, c, b, d, c); }
    return { positions: verts, faces: Uint32Array.from(faces) };
  }
  const sheet = (() => { // the garment, 72 points round, from 30 cm to 70 cm up
    const rings = 21; const verts = new Float32Array(rings * N * 3);
    for (let r = 0; r < rings; r++) for (let j = 0; j < N; j++) { const a = (2 * Math.PI * j) / N; verts.set([0.11 * Math.cos(a), 0.11 * Math.sin(a), 0.3 + r * 0.02], 3 * (r * N + j)); }
    const faces = [];
    for (let r = 0; r < rings - 1; r++) for (let j = 0; j < N; j++) { const a = r * N + j; const b = r * N + ((j + 1) % N); const c = (r + 1) * N + j; const d = (r + 1) * N + ((j + 1) % N); faces.push(a, b, c, b, d, c); }
    return { positions: verts, faces: Uint32Array.from(faces) };
  })();

  it('bridges the crease with a surface that does not fold over itself', () => {
    for (const [depth, width] of [[0.03, 0.12], [0.03, 0.2]]) {
      const body = grooved(depth, width);
      const dressed = dressBody(body.positions, body.faces, [sheet]);
      const mid = 25 * N; // the ring at 50 cm
      let violations = 0;
      for (let j = 0; j < N; j++) {
        const a = mid + j; const b = mid + ((j + 1) % N);
        const a0 = Math.atan2(dressed.positions[3 * a + 1], dressed.positions[3 * a]); const a1 = Math.atan2(dressed.positions[3 * b + 1], dressed.positions[3 * b]);
        const da = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
        if (da <= 0) violations++; // two neighbouring points have crossed: a fold
      }
      expect(violations).toBe(0);
      // the bottom of the crease is brought out to the garment, and nothing is moved in
      expect(radiusAt(dressed.positions, 25, N)).toBeGreaterThan(0.1 - depth + 0.015);
      for (let j = 0; j < N; j++) expect(Math.hypot(dressed.positions[3 * (mid + j)], dressed.positions[3 * (mid + j) + 1])).toBeGreaterThanOrEqual(Math.hypot(body.positions[3 * (mid + j)], body.positions[3 * (mid + j) + 1]) - 1e-6);
    }
  });
});

describe('liftOverLayers', () => {
  const body = tube(0.1, 0, 1, 0.02);
  const bodyIndex = buildBodyIndex(body.positions, body.faces);
  const topOf = () => tube(0.13, 0.2, 0.8, 0.02); // a top 3 cm out from the skin, open at both ends (hem and neck)
  const layerWithBump = (ring, radius) => {
    const layer = tube(0.12, 0.1, 0.9, 0.02); // its rings are at the same heights as the top's
    for (let j = 0; j < layer.n; j++) { const a = (2 * Math.PI * j) / layer.n; layer.positions.set([radius * Math.cos(a), radius * Math.sin(a)], 3 * (ring * layer.n + j)); }
    return layer;
  };

  it('changes nothing where the garment underneath is below the top', () => {
    const top = topOf(); const before = Array.from(top.positions);
    expect(liftOverLayers(top.positions, top.faces, [tube(0.12, 0.1, 0.9, 0.02)], bodyIndex, GAP)).toBe(0);
    expect(Array.from(top.positions)).toEqual(before);
  });

  it('raises the top over a band that stands further out than it, with a smooth falloff, and leaves the garment underneath alone', () => {
    const top = topOf(); const layer = layerWithBump(20, 0.14); // ring 20 of the layer is at z = 0.5
    const layerBefore = Array.from(layer.positions);
    const raised = liftOverLayers(top.positions, top.faces, [layer], bodyIndex, GAP);
    expect(raised).toBeGreaterThan(0);
    const ringAt = (z) => Math.round((z - 0.2) / 0.02);
    expect(radiusAt(top.positions, ringAt(0.5), top.n)).toBeGreaterThan(0.14 + GAP - 0.002); // clear of the band, with the gap
    expect(radiusAt(top.positions, ringAt(0.5), top.n)).toBeLessThan(0.14 + GAP + 0.004);
    expect(radiusAt(top.positions, ringAt(0.48), top.n)).toBeGreaterThan(0.13); // eased off either side
    expect(radiusAt(top.positions, ringAt(0.48), top.n)).toBeLessThan(radiusAt(top.positions, ringAt(0.5), top.n));
    expect(radiusAt(top.positions, ringAt(0.3), top.n)).toBeCloseTo(0.13, 5); // and nothing far from it
    expect(radiusAt(top.positions, ringAt(0.7), top.n)).toBeCloseTo(0.13, 5);
    expect(Array.from(layer.positions)).toEqual(layerBefore);
  });

  it('does not move the top where it ends (the hem, the cuffs, the neck)', () => {
    const top = topOf(); const layer = layerWithBump(1, 0.14); // a band under the top's lower edge
    liftOverLayers(top.positions, top.faces, [layer], bodyIndex, GAP);
    expect(radiusAt(top.positions, 0, top.n)).toBeCloseTo(0.13, 5);
  });
});

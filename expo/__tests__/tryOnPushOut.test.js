// The push that keeps a garment off the body (lib/tryOn/pushOut.js), on a made-up body: a sphere of radius 10 cm made of triangles.
import { buildBodyIndex, boundsOf, pushOut, GAP } from '../lib/tryOn/pushOut';

// A sphere from a subdivided octahedron: vertices (3 per vertex) and outward-facing triangles.
function sphere(radius, centre = [0, 0, 0], subdivisions = 3) {
  let verts = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  for (let s = 0; s < subdivisions; s++) {
    const cache = new Map();
    const mid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!cache.has(k)) {
        const m = [0, 1, 2].map((d) => (verts[a][d] + verts[b][d]) / 2);
        const l = Math.hypot(...m);
        verts.push(m.map((x) => x / l));
        cache.set(k, verts.length - 1);
      }
      return cache.get(k);
    };
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b); const bc = mid(b, c); const ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const body = new Float32Array(verts.length * 3);
  verts.forEach((v, i) => { for (let d = 0; d < 3; d++) body[3 * i + d] = centre[d] + radius * v[d]; });
  return { body, faces: Uint16Array.from(faces.flat()) };
}

const R = 0.1;
const radiusOf = (points, i, centre = [0, 0, 0]) => Math.hypot(points[3 * i] - centre[0], points[3 * i + 1] - centre[1], points[3 * i + 2] - centre[2]);
// the faceted sphere is a little inside its own radius between vertices, so the checks allow that much
const TOL = 0.0012;

describe('pushOut', () => {
  const { body, faces } = sphere(R);

  it('leaves a point that is clear of the body where it is', () => {
    const points = new Float32Array([0.3, 0, 0, 0, -0.15, 0.05, 0.1 + 0.02, 0, 0]);
    const before = Array.from(points);
    const moved = pushOut(points, buildBodyIndex(body, faces));
    expect(moved).toBe(0);
    expect(Array.from(points)).toEqual(before);
  });

  it('moves a point that is just under the skin out to the gap above it', () => {
    const points = new Float32Array([0.099, 0, 0, 0, 0.09, 0]);
    expect(pushOut(points, buildBodyIndex(body, faces))).toBe(2);
    expect(radiusOf(points, 0)).toBeGreaterThan(R + GAP - TOL);
    expect(radiusOf(points, 1)).toBeGreaterThan(R + GAP - TOL);
    expect(radiusOf(points, 0)).toBeLessThan(R + GAP + TOL);
  });

  it('moves a point that is closer than the gap but still outside', () => {
    const points = new Float32Array([R + 0.001, 0, 0]);
    expect(pushOut(points, buildBodyIndex(body, faces))).toBe(1);
    expect(radiusOf(points, 0)).toBeGreaterThan(R + GAP - TOL);
  });

  it('brings a point that is deep inside the body, even at its centre, back out to the skin', () => {
    const points = new Float32Array([0, 0, 0, 0.03, 0.02, 0.01, 0, 0, -0.06]);
    expect(pushOut(points, buildBodyIndex(body, faces))).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(radiusOf(points, i)).toBeGreaterThan(R - TOL);
      expect(radiusOf(points, i)).toBeLessThan(R + GAP + TOL);
    }
  });

  it('takes a point that is far inside, but off to one side of the centre, to the nearest skin', () => {
    const points = new Float32Array([0.06, 0, 0]);
    pushOut(points, buildBodyIndex(body, faces));
    expect(points[0]).toBeGreaterThan(R - TOL); // went out along +x, the nearest skin, not across the body
    expect(Math.abs(points[1])).toBeLessThan(0.005);
  });

  it('gives the same answer when only the triangles near the garment are indexed', () => {
    const points = new Float32Array([0.099, 0.01, 0, 0.3, 0, 0, 0.05, 0.04, 0.02, 0.02, 0.098, 0.01]);
    const a = Float32Array.from(points);
    const b = Float32Array.from(points);
    const movedA = pushOut(a, buildBodyIndex(body, faces));
    const movedB = pushOut(b, buildBodyIndex(body, faces, { bounds: boundsOf(points) }));
    expect(movedB).toBe(movedA);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i], 6);
  });

  it('works for a body that is not at the origin', () => {
    const centre = [0.5, -0.3, 1.1];
    const moved = sphere(R, centre);
    const points = new Float32Array([centre[0] + 0.098, centre[1], centre[2]]);
    expect(pushOut(points, buildBodyIndex(moved.body, moved.faces))).toBe(1);
    expect(radiusOf(points, 0, centre)).toBeGreaterThan(R + GAP - TOL);
  });

  it('uses the gap it is given', () => {
    const points = new Float32Array([0.099, 0, 0]);
    pushOut(points, buildBodyIndex(body, faces), 0.01);
    expect(radiusOf(points, 0)).toBeGreaterThan(R + 0.01 - TOL);
  });
});

describe('boundsOf', () => {
  it('is the box that holds the points', () => {
    expect(boundsOf(new Float32Array([1, 2, 3, -1, 5, 0, 0, 0, 9]))).toEqual({ min: [-1, 0, 0], max: [1, 5, 9] });
  });
});

// A thin part of the body, like an ear: a flat lens 10 cm across and 4 mm thick at the middle, whose top and bottom faces meet at a sharp rim.
function lens() {
  const n = 16; const verts = [[0, 0, 0.002], [0, 0, -0.002]];
  for (let j = 0; j < n; j++) verts.push([0.05 * Math.cos((2 * Math.PI * j) / n), 0.05 * Math.sin((2 * Math.PI * j) / n), 0]);
  const faces = [];
  for (let j = 0; j < n; j++) { const a = 2 + j; const b = 2 + ((j + 1) % n); faces.push(1, b, a); } // the faces on the bottom first (they face down): they are the ones that win a tie at the rim
  for (let j = 0; j < n; j++) { const a = 2 + j; const b = 2 + ((j + 1) % n); faces.push(0, a, b); } // the faces on the top face up
  const body = new Float32Array(verts.length * 3); verts.forEach((v, i) => body.set(v, 3 * i));
  return { body, faces: Uint16Array.from(faces) };
}

describe('pushOut beside a thin part of the body (smoothSide)', () => {
  const { body, faces } = lens();
  const beside = () => Float32Array.from([0.08, 0, 0.003]); // 3 cm out from the rim and a little above its plane: plainly outside

  it('is built so that the lens faces outward', () => {
    const index = buildBodyIndex(body, faces);
    const top = faces.length / 3 - 1; // a top face
    expect(index.fn[3 * top + 2]).toBeGreaterThan(0.9);
    expect(index.fn[2]).toBeLessThan(-0.9); // a bottom face
  });

  it('can judge a point beside the rim to be inside when it goes by the face that happens to be closest (the default)', () => {
    const p = beside();
    pushOut(p, buildBodyIndex(body, faces), GAP);
    expect(Math.hypot(p[0] - 0.05, p[1], p[2])).toBeLessThan(0.01); // pulled in against the rim
  });

  it('leaves it where it is with smoothSide, which judges a point whose closest point is on the rim by the smoothed normal there', () => {
    const p = beside();
    expect(pushOut(p, buildBodyIndex(body, faces), GAP, { smoothSide: true })).toBe(0);
    expect(Array.from(p)).toEqual(Array.from(beside()));
  });

  it('still pushes out a point that is inside the lens, and one that is closer than the gap', () => {
    const inside = Float32Array.from([0.01, 0, 0.0001]); const close = Float32Array.from([0.08, 0, 0.0]);
    const index = buildBodyIndex(body, faces);
    expect(pushOut(inside, index, GAP, { smoothSide: true })).toBe(1);
    const nearRim = Float32Array.from([0.052, 0, 0.001]);
    expect(pushOut(nearRim, index, GAP, { smoothSide: true })).toBe(1);
    expect(pushOut(close, index, GAP, { smoothSide: true })).toBe(0); // 3 cm off the rim is clear
    expect(Math.hypot(nearRim[0] - 0.05, nearRim[1], nearRim[2])).toBeGreaterThan(GAP - 0.0005);
  });

  it('is the same as the default for a point whose closest point is inside a triangle (the sphere)', () => {
    const s = sphere(R); const a = Float32Array.from([0.05, 0.02, 0.03, 0.2, 0.0, 0.05, 0.0, 0.0, 0.1005]); const b = Float32Array.from(a);
    const ia = buildBodyIndex(s.body, s.faces); const ib = buildBodyIndex(s.body, s.faces);
    pushOut(a, ia, GAP); pushOut(b, ib, GAP, { smoothSide: true });
    expect(Array.from(b)).toEqual(Array.from(a));
  });
});

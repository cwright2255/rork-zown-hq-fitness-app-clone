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

// lib/tryOn/pushOut.js
//
// Keeps a blended garment outside the body: every garment point that is inside the body, or closer to it than `gap`, is moved out along the body's
// surface direction to exactly `gap` above the skin. The pack's blend is a prediction, a few millimetres off in places; this makes sure it is never
// drawn through the skin. Plain loops, no dependencies. Body: 3 numbers per vertex; faces: 3 indices per triangle, outward facing.

export const GAP = 0.004; // metres above the skin
const FINE_CELL = 0.02; // the fine grid: skin within one cell (2 cm) of a point is found at once
const COARSE_CELL = 0.08; // the coarse grid, made only if some points have no skin within 2 cm
const COARSE_RINGS = 3; // how far the coarse grid looks: 3 x 8 cm = 24 cm

/**
 * Works out what the push needs from the body once (surface directions at each vertex and each triangle, and a grid of which triangles are where).
 * options.bounds (optional): { min: [x, y, z], max: [x, y, z] } of the garment; only the triangles near it go into the grids, which makes this several times faster.
 */
export function buildBodyIndex(body, faces, options = {}) {
  const bounds = options.bounds || null;
  const nf = faces.length / 3;
  const nv = body.length / 3;
  const vn = new Float64Array(nv * 3);
  const fn = new Float64Array(nf * 3);
  for (let f = 0; f < nf; f++) {
    const a = faces[3 * f];
    const b = faces[3 * f + 1];
    const c = faces[3 * f + 2];
    const ux = body[3 * b] - body[3 * a];
    const uy = body[3 * b + 1] - body[3 * a + 1];
    const uz = body[3 * b + 2] - body[3 * a + 2];
    const vx = body[3 * c] - body[3 * a];
    const vy = body[3 * c + 1] - body[3 * a + 1];
    const vz = body[3 * c + 2] - body[3 * a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    fn[3 * f] = nx / l; fn[3 * f + 1] = ny / l; fn[3 * f + 2] = nz / l;
    vn[3 * a] += nx; vn[3 * a + 1] += ny; vn[3 * a + 2] += nz;
    vn[3 * b] += nx; vn[3 * b + 1] += ny; vn[3 * b + 2] += nz;
    vn[3 * c] += nx; vn[3 * c + 1] += ny; vn[3 * c + 2] += nz;
  }
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(vn[3 * v], vn[3 * v + 1], vn[3 * v + 2]) || 1;
    vn[3 * v] /= l; vn[3 * v + 1] /= l; vn[3 * v + 2] /= l;
  }
  const index = { body, faces, vn, fn, bounds, fine: buildGrid(body, faces, FINE_CELL, bounds), coarse: null };
  return index;
}

// Which triangles are in which cell of a grid with cells `cell` metres across. With bounds, only the triangles near the garment are put in.
function buildGrid(body, faces, cell, bounds) {
  const pad = cell * 2;
  const nf = faces.length / 3;
  const grid = new Map();
  const key = (i, j, k) => (i + 512) * 1048576 + (j + 512) * 1024 + (k + 512);
  for (let f = 0; f < nf; f++) {
    const a = faces[3 * f];
    const b = faces[3 * f + 1];
    const c = faces[3 * f + 2];
    const lo0 = Math.min(body[3 * a], body[3 * b], body[3 * c]);
    const lo1 = Math.min(body[3 * a + 1], body[3 * b + 1], body[3 * c + 1]);
    const lo2 = Math.min(body[3 * a + 2], body[3 * b + 2], body[3 * c + 2]);
    const hi0 = Math.max(body[3 * a], body[3 * b], body[3 * c]);
    const hi1 = Math.max(body[3 * a + 1], body[3 * b + 1], body[3 * c + 1]);
    const hi2 = Math.max(body[3 * a + 2], body[3 * b + 2], body[3 * c + 2]);
    if (bounds && (hi0 < bounds.min[0] - pad || lo0 > bounds.max[0] + pad || hi1 < bounds.min[1] - pad || lo1 > bounds.max[1] + pad
      || hi2 < bounds.min[2] - pad || lo2 > bounds.max[2] + pad)) continue;
    for (let i = Math.floor(lo0 / cell); i <= Math.floor(hi0 / cell); i++) {
      for (let j = Math.floor(lo1 / cell); j <= Math.floor(hi1 / cell); j++) {
        for (let k = Math.floor(lo2 / cell); k <= Math.floor(hi2 / cell); k++) {
          const kk = key(i, j, k);
          let arr = grid.get(kk);
          if (!arr) { arr = []; grid.set(kk, arr); }
          arr.push(f);
        }
      }
    }
  }
  return { grid, cell, key };
}

/** The box that holds a garment's points (Float32Array, 3 per point). */
export function boundsOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < points.length; i += 3) {
    for (let d = 0; d < 3; d++) {
      const x = points[i + d];
      if (x < min[d]) min[d] = x;
      if (x > max[d]) max[d] = x;
    }
  }
  return { min, max };
}

// Closest point on a triangle (Ericson, Real-Time Collision Detection). out = [x, y, z, weight of a, weight of b, weight of c].
function closestOnTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, out) {
  const abx = bx - ax; const aby = by - ay; const abz = bz - az;
  const acx = cx - ax; const acy = cy - ay; const acz = cz - az;
  const apx = px - ax; const apy = py - ay; const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; out[3] = 1; out[4] = 0; out[5] = 0; return; }
  const bpx = px - bx; const bpy = py - by; const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; out[3] = 0; out[4] = 1; out[5] = 0; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    out[0] = ax + v * abx; out[1] = ay + v * aby; out[2] = az + v * abz; out[3] = 1 - v; out[4] = v; out[5] = 0; return;
  }
  const cpx = px - cx; const cpy = py - cy; const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; out[3] = 0; out[4] = 0; out[5] = 1; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    out[0] = ax + w * acx; out[1] = ay + w * acy; out[2] = az + w * acz; out[3] = 1 - w; out[4] = 0; out[5] = w; return;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    out[0] = bx + w * (cx - bx); out[1] = by + w * (cy - by); out[2] = bz + w * (cz - bz); out[3] = 0; out[4] = 1 - w; out[5] = w; return;
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w; out[3] = 1 - v - w; out[4] = v; out[5] = w;
}

// The nearest triangle to a point among the grid's cells, ring by ring around the point's own cell, up to `rings` rings. It stops as soon as the nearest
// one found is closer than anything a further ring could hold. Fills `res` ({ f, d2, x, y, z, u, v, w }); res.f is -1 when no triangle was found.
function nearest(index, g, px, py, pz, rings, res, out) {
  const { body, faces } = index;
  const { grid, cell, key } = g;
  const ci = Math.floor(px / cell);
  const cj = Math.floor(py / cell);
  const ck = Math.floor(pz / cell);
  res.f = -1;
  res.d2 = Infinity;
  for (let ring = 1; ring <= rings; ring++) {
    for (let di = -ring; di <= ring; di++) {
      for (let dj = -ring; dj <= ring; dj++) {
        const edge = ring === 1 || di === -ring || di === ring || dj === -ring || dj === ring;
        for (let dk = -ring; dk <= ring; dk += (edge ? 1 : 2 * ring)) {
          const arr = grid.get(key(ci + di, cj + dj, ck + dk));
          if (!arr) continue;
          for (let q = 0; q < arr.length; q++) {
            const f = arr[q];
            const a = faces[3 * f];
            const b = faces[3 * f + 1];
            const c = faces[3 * f + 2];
            closestOnTriangle(px, py, pz, body[3 * a], body[3 * a + 1], body[3 * a + 2], body[3 * b], body[3 * b + 1], body[3 * b + 2], body[3 * c], body[3 * c + 1], body[3 * c + 2], out);
            const dx = px - out[0];
            const dy = py - out[1];
            const dz = pz - out[2];
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < res.d2) { res.d2 = d2; res.f = f; res.x = out[0]; res.y = out[1]; res.z = out[2]; res.u = out[3]; res.v = out[4]; res.w = out[5]; }
          }
        }
      }
    }
    if (res.f >= 0 && Math.sqrt(res.d2) <= ring * cell) return;
  }
}

/**
 * Moves points (Float32Array, 3 per point) in place so none is inside the body or closer than `gap` to it. Returns how many were moved.
 * A point with no skin within 2 cm is either well clear of the body or deep inside it (a garment too small for the body); the coarse grid, made the first
 * time it is needed, looks up to 24 cm to tell which, so a garment is never left inside the body.
 */
export function pushOut(points, index, gap = GAP) {
  const { vn, fn, faces } = index;
  const np = points.length / 3;
  const out = new Float64Array(6);
  const res = { f: -1, d2: Infinity, x: 0, y: 0, z: 0, u: 0, v: 0, w: 0 };
  let moved = 0;
  for (let p = 0; p < np; p++) {
    const px = points[3 * p];
    const py = points[3 * p + 1];
    const pz = points[3 * p + 2];
    nearest(index, index.fine, px, py, pz, 1, res, out);
    if (res.f < 0 || Math.sqrt(res.d2) > index.fine.cell) {
      if (!index.coarse) index.coarse = buildGrid(index.body, faces, COARSE_CELL, index.bounds);
      nearest(index, index.coarse, px, py, pz, COARSE_RINGS, res, out);
    }
    if (res.f < 0) continue; // no skin within 24 cm: well clear of the body
    const a = faces[3 * res.f];
    const b = faces[3 * res.f + 1];
    const c = faces[3 * res.f + 2];
    let nx = res.u * vn[3 * a] + res.v * vn[3 * b] + res.w * vn[3 * c];
    let ny = res.u * vn[3 * a + 1] + res.v * vn[3 * b + 1] + res.w * vn[3 * c + 1];
    let nz = res.u * vn[3 * a + 2] + res.v * vn[3 * b + 2] + res.w * vn[3 * c + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const dist = Math.sqrt(res.d2);
    const side = (px - res.x) * fn[3 * res.f] + (py - res.y) * fn[3 * res.f + 1] + (pz - res.z) * fn[3 * res.f + 2]; // > 0 outside (the closest triangle decides)
    const signed = (side >= 0 || dist < 1e-9) ? dist : -dist;
    if (signed < gap) {
      points[3 * p] = res.x + gap * nx;
      points[3 * p + 1] = res.y + gap * ny;
      points[3 * p + 2] = res.z + gap * nz;
      moved++;
    }
  }
  return moved;
}

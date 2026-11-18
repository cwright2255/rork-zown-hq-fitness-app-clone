// lib/tryOn/layers.js
//
// A garment worn over another one (a hoodie over sweatpants or shorts). The garment underneath is a thin open sheet, which cannot tell a point that is
// under it from one that is just above its edge, so pushing a top away from it directly would pinch the top into the sheet's edge. Instead the body is "dressed":
// each point of the body that has the garment over it is moved out to the garment's surface, with a smooth ramp beyond the garment's edges, and the
// result is a closed surface like the body itself. A top is kept off that, with the same push that keeps it off the skin, and the garment underneath is
// not changed at all.
import { buildBodyIndex, boundsOf, nearestOnSurface } from './pushOut';

const REACH = 0.04; // the garment underneath is looked for up to 4 cm from the skin; further than that is not "over the skin"
const RINGS = 2; // the same 4 cm, as rings of the 2 cm grid
const ALONG = 0.6; // the direction to the garment must be this close to the skin's own surface direction (cosine) for it to count as over that point
const GROW_RINGS = 2; // the full offset is carried this many mesh rings (about 2-3 cm) beyond the garment's edge, so a band or hem that stands a little proud of the skin there is not left poking through
const RAMP_STEPS = 14; // how many smoothing steps the dressed body's offsets ramp off beyond that (a few centimetres on the body's mesh)
const NORMAL_SMOOTH = 10; // smoothing steps of the directions the skin is moved out along (the mesh's rings are about 1.5 cm apart, so this is a few centimetres)
const MIN_OFFSET = 0.0005; // metres; smaller offsets are not worth a move

// For each point of a surface: which neighbours it has (a list per point), from the triangles.
function neighbours(count, faces) {
  const sets = Array.from({ length: count }, () => new Set());
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f]; const b = faces[f + 1]; const c = faces[f + 2];
    sets[a].add(b); sets[a].add(c); sets[b].add(a); sets[b].add(c); sets[c].add(a); sets[c].add(b);
  }
  return sets.map((s) => Int32Array.from(s));
}

const SEAM = 0.015; // metres: two open edges this close are a seam between panels (the panels' own vertices are not shared), not an opening

// The open edges of a garment sheet: the lines that belong to a single triangle, except the seams between its panels (an edge with another open edge within
// SEAM of it is stitched to it, as the inseam and side seams of pants are). What is left is the real openings: waist, hems, cuffs.
// Returns the edges as a Set of keys, the points on them as a Set, and the key function.
function openEdges(positions, faces) {
  const count = new Map();
  const key = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  for (let f = 0; f < faces.length; f += 3) {
    for (let e = 0; e < 3; e++) {
      const k = key(faces[f + e], faces[f + (e + 1) % 3]);
      count.set(k, (count.get(k) || 0) + 1);
    }
  }
  const boundary = [];
  count.forEach((n, k) => { if (n === 1) boundary.push(k); });
  // which open-edge loop (connected run of open edges) each point is on
  const parent = new Map();
  const find = (x) => { let r = x; while (parent.get(r) !== r) r = parent.get(r); let c = x; while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  boundary.forEach((k) => {
    const a = Math.floor(k / 4194304); const b = k % 4194304;
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  });
  const grid = new Map();
  const cell = (x) => Math.floor(x / SEAM);
  const gk = (i, j, l) => (i + 4096) * 16777216 + (j + 4096) * 4096 + (l + 4096);
  parent.forEach((_, v) => {
    const kk = gk(cell(positions[3 * v]), cell(positions[3 * v + 1]), cell(positions[3 * v + 2]));
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(v);
  });
  const stitched = new Set(); // points that have an open edge of another loop right beside them
  parent.forEach((_, v) => {
    const x = positions[3 * v]; const y = positions[3 * v + 1]; const z = positions[3 * v + 2];
    const root = find(v);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dl = -1; dl <= 1; dl++) {
      const list = grid.get(gk(cell(x) + di, cell(y) + dj, cell(z) + dl));
      if (!list) continue;
      for (let q = 0; q < list.length; q++) {
        const w = list[q];
        if (find(w) === root) continue;
        if (Math.hypot(positions[3 * w] - x, positions[3 * w + 1] - y, positions[3 * w + 2] - z) < SEAM) { stitched.add(v); return; }
      }
    }
  });
  const edges = new Set();
  const points = new Set();
  boundary.forEach((k) => {
    const a = Math.floor(k / 4194304); const b = k % 4194304;
    if (stitched.has(a) && stitched.has(b)) return; // a seam
    edges.add(k);
    if (!stitched.has(a)) points.add(a);
    if (!stitched.has(b)) points.add(b);
  });
  return { edges, points, key };
}

// Whether the nearest point `r` (from nearestOnSurface) of a sheet is on one of its openings: at a corner or along an edge that is open.
function onOpening(faces, r, open) {
  const a = faces[3 * r.f]; const b = faces[3 * r.f + 1]; const c = faces[3 * r.f + 2];
  const eps = 1e-6;
  const wa = r.u > eps; const wb = r.v > eps; const wc = r.w > eps;
  const count = (wa ? 1 : 0) + (wb ? 1 : 0) + (wc ? 1 : 0);
  if (count === 1) return open.points.has(wa ? a : wb ? b : c);
  if (count === 2) {
    const [p, q] = wa && wb ? [a, b] : wa ? [a, c] : [b, c];
    return open.edges.has(open.key(p, q));
  }
  return false;
}

/**
 * The body with the garments worn over it, as a closed surface: a copy of `body` (Float32Array, 3 per vertex) in which every vertex that has one of the
 * `layers` ({ positions, faces }) over it is moved out along its surface direction to the garment's surface, and the move eases off over a few centimetres
 * beyond the garment's edges. Nothing is moved where no garment is within 4 cm. Returns { positions, moved } (moved = how many vertices were).
 */
export function dressBody(body, bodyFaces, layers) {
  const nv = body.length / 3;
  const vn = new Float64Array(nv * 3);
  for (let f = 0; f < bodyFaces.length; f += 3) {
    const a = bodyFaces[f]; const b = bodyFaces[f + 1]; const c = bodyFaces[f + 2];
    const ux = body[3 * b] - body[3 * a]; const uy = body[3 * b + 1] - body[3 * a + 1]; const uz = body[3 * b + 2] - body[3 * a + 2];
    const vx = body[3 * c] - body[3 * a]; const vy = body[3 * c + 1] - body[3 * a + 1]; const vz = body[3 * c + 2] - body[3 * a + 2];
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { vn[3 * v] += nx; vn[3 * v + 1] += ny; vn[3 * v + 2] += nz; }
  }
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(vn[3 * v], vn[3 * v + 1], vn[3 * v + 2]) || 1;
    vn[3 * v] /= l; vn[3 * v + 1] /= l; vn[3 * v + 2] /= l;
  }
  // In a crease of the body (the cleft of the seat) the skin's own directions point at each other, and points moved out along them cross and make spikes. Moving along directions
  // smoothed over a few rings makes the dressed surface bridge the crease, as the garment does.
  const nbrs = neighbours(nv, bodyFaces);
  for (let s = 0; s < NORMAL_SMOOTH; s++) {
    const next = new Float64Array(nv * 3);
    for (let v = 0; v < nv; v++) {
      const n = nbrs[v];
      let x = vn[3 * v]; let y = vn[3 * v + 1]; let z = vn[3 * v + 2];
      for (let k = 0; k < n.length; k++) { x += vn[3 * n[k]]; y += vn[3 * n[k] + 1]; z += vn[3 * n[k] + 2]; }
      const l = Math.hypot(x, y, z) || 1;
      next[3 * v] = x / l; next[3 * v + 1] = y / l; next[3 * v + 2] = z / l;
    }
    vn.set(next);
  }
  const offset = new Float64Array(nv); // how far each vertex is moved out
  const covered = new Uint8Array(nv); // 1 where a garment is over the vertex
  for (const layer of layers) {
    const bounds = boundsOf(layer.positions);
    const index = buildBodyIndex(layer.positions, layer.faces, { bounds });
    const open = openEdges(layer.positions, layer.faces);
    const pad = REACH;
    for (let v = 0; v < nv; v++) {
      const x = body[3 * v]; const y = body[3 * v + 1]; const z = body[3 * v + 2];
      if (x < bounds.min[0] - pad || x > bounds.max[0] + pad || y < bounds.min[1] - pad || y > bounds.max[1] + pad || z < bounds.min[2] - pad || z > bounds.max[2] + pad) continue;
      const r = nearestOnSurface(index, x, y, z, RINGS);
      if (!r || r.d > REACH) continue;
      // the garment must be over the skin (the skin is on the inner side of it), and the nearest point must be on the sheet, not on its edge
      if (r.side > 0) continue;
      if (onOpening(layer.faces, r, open)) continue;
      const dx = r.x - x; const dy = r.y - y; const dz = r.z - z;
      const along = dx * vn[3 * v] + dy * vn[3 * v + 1] + dz * vn[3 * v + 2];
      if (!(along > 0) || along < ALONG * r.d) continue; // not out from this point of the skin
      if (along > offset[v]) offset[v] = along;
      covered[v] = 1;
    }
  }
  let anyCovered = false;
  for (let v = 0; v < nv; v++) if (covered[v]) { anyCovered = true; break; }
  if (!anyCovered) return { positions: Float32Array.from(body), moved: 0 };
  // carry the offset a little beyond the garment's edge
  for (let ring = 0; ring < GROW_RINGS; ring++) {
    const add = [];
    for (let v = 0; v < nv; v++) {
      if (covered[v]) continue;
      let best = 0;
      const n = nbrs[v];
      for (let k = 0; k < n.length; k++) if (covered[n[k]] && offset[n[k]] > best) best = offset[n[k]];
      if (best > 0) add.push(v, best);
    }
    for (let i = 0; i < add.length; i += 2) { offset[add[i]] = add[i + 1]; covered[add[i]] = 1; }
  }
  // ease off beyond that: smooth the offsets, but never below the real offset where a garment is over (or just beyond the edge of) the skin
  let cur = Float64Array.from(offset);
  for (let s = 0; s < RAMP_STEPS; s++) {
    const next = new Float64Array(nv);
    for (let v = 0; v < nv; v++) {
      const n = nbrs[v];
      let sum = cur[v];
      for (let k = 0; k < n.length; k++) sum += cur[n[k]];
      const smooth = sum / (n.length + 1);
      next[v] = covered[v] ? Math.max(offset[v], smooth) : smooth;
    }
    cur = next;
  }
  const positions = Float32Array.from(body);
  let moved = 0;
  for (let v = 0; v < nv; v++) {
    if (cur[v] < MIN_OFFSET) continue;
    positions[3 * v] += vn[3 * v] * cur[v];
    positions[3 * v + 1] += vn[3 * v + 1] * cur[v];
    positions[3 * v + 2] += vn[3 * v + 2] * cur[v];
    moved++;
  }
  return { positions, moved };
}

const LIFT_REACH = 0.04; // a point of the garment underneath is looked at only if the top is within 4 cm of it
const LIFT_RADIUS = 0.03; // the top is raised over a patch this far round a point that pokes through (a smooth bump)
const SKIN_RINGS = 6; // how far from the skin (6 x 2 cm) a distance to it is looked for

/**
 * Raises a top (positions, 3 per vertex, in place) where a garment worn under it still pokes through it: a band or fold of the garment underneath can stand out further than the
 * skin it was measured against, so the top, kept off the dressed body, can still lie inside it there. Each point of an underneath garment that is further from the skin than the
 * top's surface next to it lifts that surface, and the surface round it with a smooth falloff, out from the skin to just over it. Nothing is moved where nothing pokes through,
 * nor where the top ends (its hem, cuffs and neck).
 * `bodyIndex` is buildBodyIndex of the body. Returns how many points of the top were raised.
 */
export function liftOverLayers(top, topFaces, layers, bodyIndex, gap) {
  const topBounds = boundsOf(top);
  const topIndex = buildBodyIndex(top, topFaces, { bounds: topBounds });
  const topOpen = openEdges(top, topFaces);
  const nTop = top.length / 3;
  const cellOf = (x) => Math.floor(x / LIFT_RADIUS);
  const ck = (i, j, l) => (i + 4096) * 16777216 + (j + 4096) * 4096 + (l + 4096);
  const cells = new Map();
  for (let v = 0; v < nTop; v++) {
    const kk = ck(cellOf(top[3 * v]), cellOf(top[3 * v + 1]), cellOf(top[3 * v + 2]));
    if (!cells.has(kk)) cells.set(kk, []);
    cells.get(kk).push(v);
  }
  const lift = new Float64Array(nTop);
  const skinDistance = (x, y, z) => {
    const r = nearestOnSurface(bodyIndex, x, y, z, SKIN_RINGS);
    return r ? (r.side >= 0 ? r.d : -r.d) : null;
  };
  for (const layer of layers) {
    const p = layer.positions;
    const np = p.length / 3;
    for (let v = 0; v < np; v++) {
      const x = p[3 * v]; const y = p[3 * v + 1]; const z = p[3 * v + 2];
      if (x < topBounds.min[0] - LIFT_REACH || x > topBounds.max[0] + LIFT_REACH || y < topBounds.min[1] - LIFT_REACH || y > topBounds.max[1] + LIFT_REACH
        || z < topBounds.min[2] - LIFT_REACH || z > topBounds.max[2] + LIFT_REACH) continue;
      const q = nearestOnSurface(topIndex, x, y, z, 2);
      if (!q || q.d > LIFT_REACH) continue;
      if (onOpening(topFaces, q, topOpen)) continue; // the top just ends here
      const dPoint = skinDistance(x, y, z);
      const dTop = skinDistance(q.x, q.y, q.z);
      if (dPoint === null || dTop === null) continue;
      const h = dPoint - dTop + gap; // how far out the top has to come to clear this point
      if (!(h > 0)) continue;
      const ci = cellOf(q.x); const cj = cellOf(q.y); const cl = cellOf(q.z);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dl = -1; dl <= 1; dl++) {
        const list = cells.get(ck(ci + di, cj + dj, cl + dl));
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const tt = list[k];
          const dx = top[3 * tt] - q.x; const dy = top[3 * tt + 1] - q.y; const dz = top[3 * tt + 2] - q.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= LIFT_RADIUS * LIFT_RADIUS) continue;
          const f = 1 - Math.sqrt(d2) / LIFT_RADIUS;
          const amount = h * f * f * (3 - 2 * f);
          if (amount > lift[tt]) lift[tt] = amount;
        }
      }
    }
  }
  let raised = 0;
  for (let v = 0; v < nTop; v++) {
    if (!(lift[v] > 0.0002)) continue;
    const r = nearestOnSurface(bodyIndex, top[3 * v], top[3 * v + 1], top[3 * v + 2], SKIN_RINGS);
    if (!r) continue;
    let ux = top[3 * v] - r.x; let uy = top[3 * v + 1] - r.y; let uz = top[3 * v + 2] - r.z;
    let l = Math.hypot(ux, uy, uz);
    if (l < 1e-6) { ux = bodyIndex.fn[3 * r.f]; uy = bodyIndex.fn[3 * r.f + 1]; uz = bodyIndex.fn[3 * r.f + 2]; l = 1; }
    top[3 * v] += (ux / l) * lift[v]; top[3 * v + 1] += (uy / l) * lift[v]; top[3 * v + 2] += (uz / l) * lift[v];
    raised++;
  }
  return raised;
}

// lib/tryOnSpike/blend.js
//
// The two calculations a drape pack needs on the phone, written with plain loops over typed arrays so they run the same in the app and in tests.

/**
 * out = mean + sum over c of weights[c] * basis[c]. `out`, `mean` are 3 numbers per point; `basis` is `weights.length` shape changes one
 * after the other. Writes into `out` (no new array is made), so a blend does not create garbage for the phone to clean up.
 */
export function blendInto(out, mean, basis, weights) {
  const n = mean.length;
  if (out.length !== n) throw new Error('blendInto: out and mean must be the same length');
  if (basis.length < weights.length * n) throw new Error('blendInto: the basis holds fewer shape changes than there are weights');
  out.set(mean);
  for (let c = 0; c < weights.length; c++) {
    const w = weights[c];
    if (w === 0) continue;
    const base = c * n;
    for (let i = 0; i < n; i++) out[i] += w * basis[base + i];
  }
  return out;
}

/** Smooth per-point surface directions: every triangle adds its face direction (larger triangles count for more) to its 3 points, then each point is made length 1. Writes into `normals`. */
export function normalsInto(normals, positions, indices) {
  normals.fill(0);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
    normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
    normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i];
    const y = normals[i + 1];
    const z = normals[i + 2];
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    normals[i] = x / len; normals[i + 1] = y / len; normals[i + 2] = z / len;
  }
  return normals;
}

/** Weights that move smoothly with `step`, for the test's "change the size" swaps: component c follows its own sine, scaled to +-`amount`. */
export function sampleWeights(count, step, amount = 1) {
  const w = new Float32Array(count);
  for (let c = 0; c < count; c++) w[c] = amount * Math.sin(step * 0.9 + c * 1.7);
  return w;
}

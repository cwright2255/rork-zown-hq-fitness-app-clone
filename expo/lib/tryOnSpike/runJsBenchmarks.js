// lib/tryOnSpike/runJsBenchmarks.js
//
// The part of the try-on runtime test that needs no graphics: how long the phone takes to blend a garment to a new body (with 8, 16 and 32 shape
// changes), to recalculate its surface directions, and to read a 16-shape-change pack back from storage, make it usable and check its fingerprint.
// Everything that touches the phone (the clock, storage, the fingerprint function, the pause that lets the screen update) is passed in, so the same
// code runs in the app and in tests.
import { makeStandInGarment, withComponents } from './standInGarment';
import { blendInto, normalsInto, sampleWeights } from './blend';
import { summarize } from './stats';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../meshCache';

export const COMPONENT_COUNTS = [8, 16, 32];
export const PACK_COMPONENTS = 16;
const PACK_FILE = 'tryon-runtime-test-pack.bin';

const time = async (now, fn) => {
  const t0 = now();
  const value = await fn();
  return { ms: now() - t0, value };
};

/**
 * Runs the blend, surface-direction and pack-storage measurements.
 * deps: { now(): ms, getFs(): the expo-file-system module (or null), digest(bytes): Promise<ArrayBuffer> (SHA-256), pause(): Promise, onStep(text) }
 * options: { blendRuns = 20, normalsRuns = 10, garment (made if not given) }
 */
export async function runJsBenchmarks(deps, options = {}) {
  const { now, getFs, digest, pause = async () => {}, onStep = () => {} } = deps;
  const blendRuns = options.blendRuns ?? 20;
  const normalsRuns = options.normalsRuns ?? 10;
  const garment = options.garment || makeStandInGarment({ components: Math.max(...COMPONENT_COUNTS) });
  const n = garment.mean.length;
  const out = new Float32Array(n);
  const results = { vertices: garment.vertexCount, triangles: garment.triangleCount, blend: {}, normals: null, pack: null };

  for (const count of COMPONENT_COUNTS) {
    onStep('Blending with ' + count + ' shape changes...');
    await pause();
    const g = withComponents(garment, count);
    blendInto(out, g.mean, g.basis, sampleWeights(count, 0)); // one run that is not counted: the first run of anything is slower
    const samples = [];
    for (let i = 0; i < blendRuns; i++) {
      const w = sampleWeights(count, i + 1);
      const t0 = now();
      blendInto(out, g.mean, g.basis, w);
      samples.push(now() - t0);
    }
    results.blend[count] = { ...summarize(samples), megabytes: Math.round((g.basis.byteLength / 1e6) * 10) / 10 };
  }

  onStep('Calculating surface directions...');
  await pause();
  const normals = new Float32Array(n);
  blendInto(out, garment.mean, garment.basis, sampleWeights(garment.components, 3));
  normalsInto(normals, out, garment.indices);
  const normalSamples = [];
  for (let i = 0; i < normalsRuns; i++) {
    const t0 = now();
    normalsInto(normals, out, garment.indices);
    normalSamples.push(now() - t0);
  }
  results.normals = summarize(normalSamples);

  onStep('Saving and reading back a pack...');
  await pause();
  results.pack = await runPackRoundTrip({ now, getFs, digest }, withComponents(garment, PACK_COMPONENTS));
  return results;
}

/** Writes a pack's numbers to the phone's storage the way the app's mesh cache stores files, then times reading it back: read, make usable, check the fingerprint. */
export async function runPackRoundTrip({ now, getFs, digest }, garment) {
  let fs = null;
  try { fs = await getFs(); } catch (e) { fs = null; }
  const dir = fs && (fs.cacheDirectory || fs.documentDirectory);
  if (!fs || !dir) return { skipped: 'the phone\'s storage could not be opened' };
  const path = dir + PACK_FILE;
  const source = garment.basis;
  const bytes = source.byteLength;
  try {
    const encode = await time(now, async () => arrayBufferToBase64(source.buffer.slice(source.byteOffset, source.byteOffset + bytes)));
    const write = await time(now, () => fs.writeAsStringAsync(path, encode.value, { encoding: 'base64' }));
    const read = await time(now, () => fs.readAsStringAsync(path, { encoding: 'base64' }));
    const decode = await time(now, async () => new Float32Array(base64ToArrayBuffer(read.value)));
    const hash = await time(now, () => digest(decode.value));
    const same = decode.value.length === source.length
      && decode.value[0] === source[0]
      && decode.value[source.length >> 1] === source[source.length >> 1]
      && decode.value[source.length - 1] === source[source.length - 1];
    return {
      bytes,
      encodeMs: round(encode.ms), writeMs: round(write.ms), readMs: round(read.ms), decodeMs: round(decode.ms), hashMs: round(hash.ms),
      loadMs: round(read.ms + decode.ms + hash.ms), // what opening a saved pack costs: read, make usable, check
      intact: same,
    };
  } catch (e) {
    return { skipped: 'saving or reading the test pack failed: ' + (e && e.message ? e.message : String(e)) };
  } finally {
    try { await fs.deleteAsync(path, { idempotent: true }); } catch (e) { /* the file is only a test pack */ }
  }
}

const round = (x) => Math.round(x * 10) / 10;

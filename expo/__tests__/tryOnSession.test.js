// One try-on from start to finish (lib/tryOn/tryOnSession.js), with the tiny pack made by the pack builder (fixtures/tryon/tiny.zdp), a made-up sizing file,
// a made-up file store, and a made-up body: the blend must be the pack builder's, and the garment must end up off the skin.
const fs = require('fs');
const path = require('path');
import { fitGarment, loadSizing, readBodyGeometry, recommend, BODY_VERTEX_COUNT, TryOnError } from '../lib/tryOn/tryOnSession';
import { PackStoreError } from '../lib/tryOn/packStore';
import { decodeSizing } from '../lib/tryOn/sizing';
import { GAP } from '../lib/tryOn/pushOut';

const DIR = path.join(__dirname, 'fixtures', 'tryon');
const packBytes = () => { const b = fs.readFileSync(path.join(DIR, 'tiny.zdp')); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const expected = JSON.parse(fs.readFileSync(path.join(DIR, 'tiny.expected.json'), 'utf8'));
const text = (s) => Uint8Array.from(Buffer.from(s)).buffer;
const b64 = (floats) => Buffer.from(new Float32Array(floats).buffer).toString('base64');
const i16 = (ints) => Buffer.from(new Int16Array(ints).buffer).toString('base64');

// the tiny body's vertices 8..19 are the pack's zone; the made-up waist is 1000 x the sideways distance of the first of them from the middle of the soles
const sizingJson = () => ({
  version: 1, group: 'men', zoneIdx: i16([8, 9, 10]),
  measures: { waist: { b0: 0, w: b64([1000, 0, 0, 0, 0, 0, 0, 0, 0]) } },
  pick: { margin: 1.5, sigma: 1.5 },
  garments: {
    tiny: {
      features: ['waist'],
      sizes: { M: { tight: { b0: -1000, b: [1] }, loose: { b0: -1000, b: [-1] }, lo: [-1000], hi: [1000], centre: [0], sd: [1000] } },
    },
  },
});
const sizing = decodeSizing(sizingJson());

const store = (files) => ({ getFile: jest.fn(async (rel, onDownload) => { if (!(rel in files)) throw new PackStoreError('missing', rel); if (onDownload) onDownload(); return files[rel]; }) });

// A sphere (subdivided octahedron) added after the tiny body's 40 vertices, so there is a body surface to push against: [positions, faces]
function bodyWithSphere(tinyBody, centre, radius) {
  let verts = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let faces = [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]];
  for (let s = 0; s < 3; s++) {
    const cache = new Map();
    const mid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a;
      if (!cache.has(k)) { const m = [0, 1, 2].map((d) => (verts[a][d] + verts[b][d]) / 2); const l = Math.hypot(...m); verts.push(m.map((x) => x / l)); cache.set(k, verts.length - 1); }
      return cache.get(k);
    };
    const next = [];
    for (const [a, b, c] of faces) { const ab = mid(a, b); const bc = mid(b, c); const ca = mid(c, a); next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = next;
  }
  const positions = new Float32Array(tinyBody.length + verts.length * 3);
  positions.set(tinyBody);
  verts.forEach((v, i) => { for (let d = 0; d < 3; d++) positions[tinyBody.length + 3 * i + d] = centre[d] + radius * v[d]; });
  return { positions, faces: Uint16Array.from(faces.flat().map((i) => i + tinyBody.length / 3)) };
}

describe('fitGarment', () => {
  const tinyBody = new Float32Array(expected.bodies[1]);
  const files = () => ({ 'men/tiny_M.zdp': packBytes() });

  it('gets the pack, blends it the way the pack builder does, and says how long each step took', async () => {
    let t = 0;
    const steps = [];
    const { positions, faces } = bodyWithSphere(tinyBody, [9, 9, 9], 0.2); // a sphere far from the garment: nothing to push
    const result = await fitGarment({ store: store(files()), now: () => (t += 10), onStep: (s) => steps.push(s) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.size).toBe('M');
    expect(result.positions).toHaveLength(30);
    for (let i = 0; i < 30; i++) expect(result.positions[i]).toBeCloseTo(expected.garments[1][i], 3);
    expect(result.faces).toHaveLength(8 * 3);
    expect(result.pushed).toBe(0);
    expect(result.downloaded).toBe(true);
    expect(result.timings.total).toBe(result.timings.pack + result.timings.blend + result.timings.push);
    expect(steps).toEqual(['Getting the M garment...', 'Fitting it to your body...', 'Keeping it off the skin...']);
  });

  it('keeps the garment off the skin: points that land inside the body come out above it', async () => {
    const centre = [0, 1, 2].map((d) => { let s = 0; for (let v = 0; v < 10; v++) s += expected.garments[1][3 * v + d]; return s / 10; });
    const { positions, faces } = bodyWithSphere(tinyBody, centre, 0.5); // the whole garment starts inside this
    const result = await fitGarment({ store: store(files()) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.pushed).toBe(10);
    for (let v = 0; v < 10; v++) {
      const r = Math.hypot(result.positions[3 * v] - centre[0], result.positions[3 * v + 1] - centre[1], result.positions[3 * v + 2] - centre[2]);
      expect(r).toBeGreaterThan(0.5 + GAP - 0.03); // a faceted sphere is a little inside its radius between vertices
      expect(r).toBeLessThan(0.5 + GAP + 0.01);
    }
  });

  it('reports the fit for the size, the measures, and whether the body is unusual for the pack', async () => {
    const { positions, faces } = bodyWithSphere(tinyBody, [9, 9, 9], 0.2);
    const result = await fitGarment({ store: store(files()) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.fit).toMatchObject({ size: 'M', inside: true });
    expect(['good', 'likely', 'tight', 'loose']).toContain(result.fit.verdict);
    expect(typeof result.measures.waist).toBe('number');
    expect(result.outsidePack).toBe(false);
    const far = bodyWithSphere(new Float32Array(expected.bodies[3]), [9, 9, 9], 0.2);
    const farResult = await fitGarment({ store: store(files()) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: far.positions, bodyFaces: far.faces });
    expect(farResult.outsidePack).toBe(true);
  });

  it('does not say "downloaded" when the pack was already on the phone', async () => {
    const kept = { getFile: jest.fn(async () => packBytes()) };
    const { positions, faces } = bodyWithSphere(tinyBody, [9, 9, 9], 0.2);
    const result = await fitGarment({ store: kept }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.downloaded).toBe(false);
  });

  it('refuses a garment or size the sizing does not have, before downloading anything', async () => {
    const s = store(files());
    const { positions, faces } = bodyWithSphere(tinyBody, [9, 9, 9], 0.2);
    await expect(fitGarment({ store: s }, { sizing, garmentKey: 'tiny', group: 'men', size: 'XL', bodyPositions: positions, bodyFaces: faces })).rejects.toMatchObject({ code: 'no-pack' });
    await expect(fitGarment({ store: s }, { sizing, garmentKey: 'jacket', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces })).rejects.toBeInstanceOf(TryOnError);
    expect(s.getFile).not.toHaveBeenCalled();
  });

  it('passes on a store error (offline, missing, corrupt) unchanged, so the screen can say what happened', async () => {
    const { positions, faces } = bodyWithSphere(tinyBody, [9, 9, 9], 0.2);
    await expect(fitGarment({ store: store({}) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces })).rejects.toMatchObject({ name: 'PackStoreError', code: 'missing' });
  });
});

describe('loadSizing', () => {
  it('reads the sizing file for a group from the store', async () => {
    const s = store({ 'men/sizing.json': text(JSON.stringify(sizingJson())) });
    const loaded = await loadSizing(s, 'men');
    expect(s.getFile).toHaveBeenCalledWith('men/sizing.json');
    expect(Object.keys(loaded.garments)).toEqual(['tiny']);
    expect(loaded.zoneIdx).toBeInstanceOf(Int16Array);
  });

  it('passes on a store error, and turns a file it cannot read into a try-on error', async () => {
    await expect(loadSizing(store({}), 'men')).rejects.toMatchObject({ name: 'PackStoreError', code: 'missing' });
    await expect(loadSizing(store({ 'men/sizing.json': text('not json') }), 'men')).rejects.toMatchObject({ name: 'TryOnError', code: 'no-sizing' });
  });
});

describe('recommend', () => {
  it('chooses a size from the body alone, downloading nothing', () => {
    const { positions } = bodyWithSphere(new Float32Array(expected.bodies[1]), [9, 9, 9], 0.2);
    expect(recommend(sizing, 'tiny', positions)).toMatchObject({ size: 'M', anyInside: true });
  });
});

describe('readBodyGeometry', () => {
  const geometry = (count, { itemSize = 3, index = true, array } = {}) => ({
    attributes: { position: { count, itemSize, array: array || new Float32Array(count * 3), isInterleavedBufferAttribute: false } },
    index: index ? { array: new Uint16Array(30) } : null,
  });

  it('gives the vertices and triangles of the detailed body', () => {
    const g = geometry(BODY_VERTEX_COUNT);
    const { positions, faces } = readBodyGeometry(g);
    expect(positions).toBe(g.attributes.position.array);
    expect(faces).toBe(g.index.array);
  });

  it('refuses the simple stand-in body, a mesh with no triangles list, and a missing geometry', () => {
    for (const g of [geometry(500), geometry(BODY_VERTEX_COUNT, { index: false }), geometry(BODY_VERTEX_COUNT, { itemSize: 2 }), null, {}]) {
      expect(() => readBodyGeometry(g)).toThrow(TryOnError);
      try { readBodyGeometry(g); } catch (e) { expect(e.code).toBe('no-detailed-body'); }
    }
  });

  it('copies the vertices out when the geometry stores them some other way', () => {
    const g = geometry(BODY_VERTEX_COUNT);
    g.attributes.position.isInterleavedBufferAttribute = true;
    g.attributes.position.getX = (i) => i;
    g.attributes.position.getY = (i) => 2 * i;
    g.attributes.position.getZ = (i) => 3 * i;
    const { positions } = readBodyGeometry(g);
    expect(positions).toBeInstanceOf(Float32Array);
    expect(Array.from(positions.slice(3, 6))).toEqual([1, 2, 3]);
  });
});

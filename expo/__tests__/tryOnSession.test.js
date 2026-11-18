// One try-on from start to finish (lib/tryOn/tryOnSession.js), with the tiny pack made by the pack builder (fixtures/tryon/tiny.zdp), a made-up sizing file,
// a made-up file store, and a made-up body: the blend must be the pack builder's, and the garment must end up off the skin.
const fs = require('fs');
const path = require('path');
import { fitGarment, loadSizing, readBodyGeometry, recommend, BODY_VERTEX_COUNT, TryOnError } from '../lib/tryOn/tryOnSession';
import { PackStoreError } from '../lib/tryOn/packStore';
import { decodeSizing } from '../lib/tryOn/sizing';
import { GAP } from '../lib/tryOn/pushOut';
import { GARMENTS } from '../lib/tryOn/garments';

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

  it('over another garment: is kept off that garment as well as off the skin, and the garment underneath is not changed', async () => {
    const centre = [0, 1, 2].map((d) => { let s = 0; for (let v = 0; v < 10; v++) s += expected.garments[1][3 * v + d]; return s / 10; });
    const { positions, faces } = bodyWithSphere(tinyBody, centre, 0.5); // the whole garment starts inside the body
    const layer = bodyWithSphere(new Float32Array(0), centre, 0.52); // a garment 2 cm out from the skin, all round
    const before = Array.from(layer.positions);
    const steps = [];
    const result = await fitGarment({ store: store(files()), onStep: (s) => steps.push(s) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces, under: [layer] });
    expect(result.layered).toBeGreaterThan(0);
    expect(result.lifted).toBeGreaterThanOrEqual(0); // (the 8 flat triangles of this garment cut across the sphere, so some of what is under them can poke through)
    expect(result.pushed).toBe(10);
    expect(steps[2]).toBe('Fitting it over what you have on...');
    for (let v = 0; v < 10; v++) {
      const r = Math.hypot(result.positions[3 * v] - centre[0], result.positions[3 * v + 1] - centre[1], result.positions[3 * v + 2] - centre[2]);
      expect(r).toBeGreaterThan(0.52 + GAP - 0.03);
      expect(r).toBeLessThan(0.52 + GAP + 0.01);
    }
    expect(Array.from(layer.positions)).toEqual(before);
    // with nothing worn under it, the same garment comes out nearer the skin
    const bare = await fitGarment({ store: store(files()) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(bare.layered).toBe(0);
    expect(bare.lifted).toBe(0);
    for (let v = 0; v < 10; v++) {
      expect(Math.hypot(bare.positions[3 * v] - centre[0], bare.positions[3 * v + 1] - centre[1], bare.positions[3 * v + 2] - centre[2])).toBeLessThan(0.52);
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

describe('fitGarment: the waistband of shorts and pants', () => {
  const tinyBody = new Float32Array(expected.bodies[1]);
  const zs = [];
  for (let i = 2; i < 30; i += 3) zs.push(expected.garments[1][i]);
  const top = Math.max(...zs);
  const hem = Math.min(...zs);
  // The tiny body padded out to the body model's size, with the navel (vertex 4104) 1 cm under the top of the tiny garment; the filler vertices copy one
  // high vertex of the tiny body, so the floor and the soles are the tiny body's own, and a sphere far to the side so nothing is pushed (and no higher than
  // the body's top: the body's height, which the sweatpants' seat is found from, is its tallest vertex).
  const bodyWithNavel = (navelZ, topZ = 1.8) => {
    const { positions: small, faces } = bodyWithSphere(tinyBody, [9, 9, 1], 0.2);
    const positions = new Float32Array(BODY_VERTEX_COUNT * 3);
    positions.set(small);
    for (let v = small.length / 3; v < BODY_VERTEX_COUNT; v++) positions.set([0, 0, topZ], 3 * v);
    positions.set([0, -0.2, navelZ], 3 * 4104);
    return { positions, faces };
  };
  const sizingFor = (key) => decodeSizing({ ...sizingJson(), garments: { [key]: sizingJson().garments.tiny } });
  const filesFor = (key) => ({ ['men/' + key + '_M.zdp']: packBytes() });
  const files = () => filesFor('tiny');

  it('lowers the band of shorts to 3 cm under the navel and keeps the hem where it was', async () => {
    const { positions, faces } = bodyWithNavel(top - 0.01);
    const result = await fitGarment({ store: store(filesFor('shorts')) }, { sizing: sizingFor('shorts'), garmentKey: 'shorts', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.lowered).toBeCloseTo(0.04, 4);
    const zAfter = [];
    for (let i = 2; i < 30; i += 3) zAfter.push(result.positions[i]);
    expect(Math.max(...zAfter)).toBeCloseTo(top - 0.04, 4);
    expect(Math.min(...zAfter)).toBeCloseTo(hem, 4);
    for (let p = 0; p < 10; p++) {
      expect(result.positions[3 * p]).toBeCloseTo(expected.garments[1][3 * p], 4);
      expect(result.positions[3 * p + 1]).toBeCloseTo(expected.garments[1][3 * p + 1], 4);
    }
  });

  it('tilts the band of sweatpants: lower at the front, as it was at the back, nothing under the seat moved; and leaves a band already under the navel alone', async () => {
    // the body is 1.8 m tall from a floor at 0, so its seat is at 0.45 x 1.8 = 0.81 m: just above the tiny garment's hem (0.79 m), which must not move.
    // The tiny garment's points 4 and 5 are the ones furthest to the front (y -0.31 and -0.29): point 4, at 0.9211, is the top of its front; its highest point
    // (8, at 1.1163) is at the back, and its lowest (0, at 0.7908) is under the seat.
    const gx = (i) => expected.garments[1][3 * i];
    const gy = (i) => expected.garments[1][3 * i + 1];
    const gz = (i) => expected.garments[1][3 * i + 2];
    const frontTop = gz(4);
    const low = bodyWithNavel(frontTop + 0.2);
    const stays = await fitGarment({ store: store(filesFor('sweatpants')) }, { sizing: sizingFor('sweatpants'), garmentKey: 'sweatpants', group: 'men', size: 'M', bodyPositions: low.positions, bodyFaces: low.faces });
    expect(stays.lowered).toBe(0);
    const high = bodyWithNavel(frontTop - 0.01); // the front has to come down 4 cm
    const moved = await fitGarment({ store: store(filesFor('sweatpants')) }, { sizing: sizingFor('sweatpants'), garmentKey: 'sweatpants', group: 'men', size: 'M', bodyPositions: high.positions, bodyFaces: high.faces });
    expect(moved.lowered).toBeCloseTo(0.04, 4);
    expect(moved.positions[3 * 4 + 2]).toBeCloseTo(frontTop - 0.04, 4); // the front of the band came down
    expect(moved.positions[3 * 8 + 2]).toBeCloseTo(gz(8), 4); // the back of the band did not
    expect(moved.positions[3 * 0 + 2]).toBeCloseTo(gz(0), 4); // under the seat, nothing moved
    for (let p = 0; p < 10; p++) {
      expect(moved.positions[3 * p]).toBeCloseTo(gx(p), 4);
      expect(moved.positions[3 * p + 1]).toBeCloseTo(gy(p), 4);
      expect(moved.positions[3 * p + 2]).toBeLessThanOrEqual(gz(p) + 1e-4); // and no point went up
    }
  });

  it('does not touch a garment that has no waistband', async () => {
    const { positions, faces } = bodyWithNavel(top - 0.01);
    const result = await fitGarment({ store: store(files()) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.lowered).toBe(0);
    for (let i = 0; i < 30; i++) expect(result.positions[i]).toBeCloseTo(expected.garments[1][i], 4);
  });
});

describe('fitGarment: more room in the sweatpants', () => {
  const tinyBody = new Float32Array(expected.bodies[1]);
  const gp = expected.garments[1];
  // a sphere in the middle of the tiny garment, a little smaller than the closest of its points is, so every point is a little off the skin
  const centre = [0, 0, 0];
  for (let i = 0; i < 10; i++) for (let d = 0; d < 3; d++) centre[d] += gp[3 * i + d] / 10;
  const dist = (i, c = centre) => Math.hypot(gp[3 * i] - c[0], gp[3 * i + 1] - c[1], gp[3 * i + 2] - c[2]);
  const radius = Math.min(...Array.from({ length: 10 }, (_, i) => dist(i))) - 0.012;
  const bodyAround = () => {
    const { positions: small, faces } = bodyWithSphere(tinyBody, centre, radius);
    const positions = new Float32Array(BODY_VERTEX_COUNT * 3); positions.set(small);
    for (let v = small.length / 3; v < BODY_VERTEX_COUNT; v++) positions.set([0, 0, 1.8], 3 * v);
    positions.set([0, -0.2, 5], 3 * 4104); // the navel far above: the band is not lowered
    return { positions, faces };
  };
  const sizingFor = (key) => decodeSizing({ ...sizingJson(), garments: { [key]: sizingJson().garments.tiny } });
  const run = (key) => { const { positions, faces } = bodyAround(); return fitGarment({ store: store({ ['men/' + key + '_M.zdp']: packBytes() }) }, { sizing: sizingFor(key), garmentKey: key, group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces }); };
  const withRelax = async (amount) => {
    const g = GARMENTS.find((x) => x.key === 'sweatpants'); const before = g.relax;
    g.relax = amount;
    try { return await run('sweatpants'); } finally { g.relax = before; }
  };

  it('moves the sweatpants out from the skin a little, and says how many points', async () => {
    const snug = await withRelax(0);
    const eased = await withRelax(0.015);
    expect(snug.relaxed).toBe(0);
    expect(eased.relaxed).toBeGreaterThan(0);
    let further = 0;
    for (let i = 0; i < 10; i++) {
      const d = (r) => Math.hypot(r.positions[3 * i] - centre[0], r.positions[3 * i + 1] - centre[1], r.positions[3 * i + 2] - centre[2]);
      expect(d(eased)).toBeGreaterThanOrEqual(d(snug) - 1e-5);
      expect(d(eased) - d(snug)).toBeLessThan(0.0151);
      if (d(eased) > d(snug) + 1e-4) further++;
    }
    expect(further).toBe(eased.relaxed);
  });

  it('is only for the sweatpants: the shorts are fitted as they were', async () => {
    const shorts = await run('shorts');
    expect(shorts.relaxed).toBe(0);
  });
});

describe('fitGarment: the hem of full-length pants', () => {
  const tinyBody = new Float32Array(expected.bodies[1]);
  const gz = (i) => expected.garments[1][3 * i + 2];
  const top = Math.max(...Array.from({ length: 10 }, (_, i) => gz(i)));
  const hem = Math.min(...Array.from({ length: 10 }, (_, i) => gz(i)));
  // The tiny body padded out to the body model's size and made 3.2 m tall (so its knee, 0.285 of that, is above the tiny garment's hem and the garment
  // has a leg to stretch); the navel is put above the band, so the waistband is left alone and only the hem moves.
  const tallBody = (navelZ = top + 0.5) => {
    const { positions: small, faces } = bodyWithSphere(tinyBody, [9, 9, 1], 0.2); // far to the side, and no higher than the body's top: the body's height is its tallest vertex
    const positions = new Float32Array(BODY_VERTEX_COUNT * 3);
    positions.set(small);
    for (let v = small.length / 3; v < BODY_VERTEX_COUNT; v++) positions.set([0, 0, 3.2], 3 * v);
    positions.set([0, -0.2, navelZ], 3 * 4104);
    return { positions, faces };
  };
  const knee = 0.285 * 3.2;
  const run = (key, navelZ) => {
    const { positions, faces } = tallBody(navelZ);
    const sizingFor = decodeSizing({ ...sizingJson(), garments: { [key]: sizingJson().garments.tiny } });
    return fitGarment({ store: store({ ['men/' + key + '_M.zdp']: packBytes() }) }, { sizing: sizingFor, garmentKey: key, group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
  };

  // No garment is hemmed to the ankle now, so these flag the sweatpants for the length of one test (the way fitGarment reads the list) and unflag them after.
  const withFlags = async (flags, fn) => {
    const sweatpants = GARMENTS.find((g) => g.key === 'sweatpants');
    const before = { waistband: sweatpants.waistband, ankleHem: sweatpants.ankleHem };
    Object.assign(sweatpants, flags);
    try {
      await fn();
    } finally {
      for (const k of Object.keys(before)) {
        if (before[k] === undefined) delete sweatpants[k];
        else sweatpants[k] = before[k];
      }
    }
  };

  it('does not bring the hem of sweatpants to the ankle (their v2.2 pack has it there)', async () => {
    const result = await run('sweatpants');
    expect(result.hemmed).toBe(0);
    expect(result.lowered).toBe(0);
    for (let i = 0; i < 30; i++) expect(result.positions[i]).toBeCloseTo(expected.garments[1][i], 4);
  });

  it('brings the hem of a garment flagged ankleHem down towards the ankle (here by the 20 cm limit) and leaves everything above the knee alone', async () => {
    await withFlags({ ankleHem: true }, async () => {
      const result = await run('sweatpants');
      expect(result.lowered).toBe(0);
      expect(result.hemmed).toBeCloseTo(0.2, 4);
      const after = Array.from({ length: 10 }, (_, i) => result.positions[3 * i + 2]);
      expect(Math.min(...after)).toBeCloseTo(hem - 0.2, 4);
      for (let i = 0; i < 10; i++) {
        if (gz(i) >= knee) expect(result.positions[3 * i + 2]).toBeCloseTo(gz(i), 5);
        else expect(result.positions[3 * i + 2]).toBeLessThan(gz(i));
        expect(result.positions[3 * i]).toBeCloseTo(expected.garments[1][3 * i], 5);
      }
    });
  });

  it('does not touch the hem of shorts', async () => {
    const result = await run('shorts');
    expect(result.hemmed).toBe(0);
    expect(result.lowered).toBe(0);
    for (let i = 0; i < 30; i++) expect(result.positions[i]).toBeCloseTo(expected.garments[1][i], 4);
  });

  it('lowers the band and lengthens the legs in the same fit when a garment has both flags', async () => {
    await withFlags({ waistband: true, ankleHem: true }, async () => {
      const result = await run('sweatpants', top - 0.01);
      expect(result.lowered).toBeCloseTo(0.04, 4);
      expect(result.hemmed).toBeCloseTo(0.2, 4);
    });
  });

  it('does not touch a garment that is not full length', async () => {
    const { positions, faces } = tallBody();
    const result = await fitGarment({ store: store({ 'men/tiny_M.zdp': packBytes() }) }, { sizing, garmentKey: 'tiny', group: 'men', size: 'M', bodyPositions: positions, bodyFaces: faces });
    expect(result.hemmed).toBe(0);
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

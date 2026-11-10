// The no-graphics part of the try-on runtime test (lib/tryOnSpike/runJsBenchmarks.js): blend timings, surface-direction timing, and saving a pack to
// the phone's storage and reading it back. The clock, the storage and the fingerprint function are stand-ins; the arithmetic and the file round trip are real.
const nodeCrypto = require('crypto');
const { runJsBenchmarks, runPackRoundTrip, COMPONENT_COUNTS, PACK_COMPONENTS } = require('../lib/tryOnSpike/runJsBenchmarks');
const { makeStandInGarment, withComponents } = require('../lib/tryOnSpike/standInGarment');

// A clock that moves 1 ms every time it is read, so every timed thing takes exactly 1 ms.
const steppingClock = () => { let t = 0; return () => { t += 1; return t; }; };
const digest = async (bytes) => nodeCrypto.createHash('sha256').update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest();

const memoryFs = (overrides = {}) => {
  const files = new Map();
  const fs = {
    cacheDirectory: 'file:///cache/',
    files,
    writeAsStringAsync: jest.fn(async (path, text) => { files.set(path, text); }),
    readAsStringAsync: jest.fn(async (path) => { if (!files.has(path)) throw new Error('no such file'); return files.get(path); }),
    deleteAsync: jest.fn(async (path) => { files.delete(path); }),
    ...overrides,
  };
  return fs;
};

const small = makeStandInGarment({ around: 8, rings: 6, components: 32 });

describe('runJsBenchmarks', () => {
  it('times a blend with 8, 16 and 32 shape changes, 20 times each, and the surface directions 10 times', async () => {
    const r = await runJsBenchmarks({ now: steppingClock(), getFs: async () => memoryFs(), digest }, { garment: small });
    expect(Object.keys(r.blend)).toEqual(COMPONENT_COUNTS.map(String));
    COMPONENT_COUNTS.forEach((c) => { expect(r.blend[c].n).toBe(20); expect(r.blend[c].median).toBe(1); });
    expect(r.normals.n).toBe(10);
    expect(r.vertices).toBe(48);
    expect(r.triangles).toBe(small.triangleCount);
  });

  it('reports how big each set of shape changes is, from the real stand-in sizes', async () => {
    const r = await runJsBenchmarks({ now: steppingClock(), getFs: async () => memoryFs(), digest }, { blendRuns: 1, normalsRuns: 1 });
    expect(r.vertices).toBe(17004);
    expect(r.blend[8].megabytes).toBe(1.6);
    expect(r.blend[16].megabytes).toBe(3.3);
    expect(r.blend[32].megabytes).toBe(6.5);
  });

  it('uses the number of runs it is told to', async () => {
    const r = await runJsBenchmarks({ now: steppingClock(), getFs: async () => memoryFs(), digest }, { garment: small, blendRuns: 3, normalsRuns: 2 });
    expect(r.blend[16].n).toBe(3);
    expect(r.normals.n).toBe(2);
  });

  it('tells the screen what it is doing, and lets the screen update between steps', async () => {
    const steps = [];
    const pause = jest.fn(async () => {});
    await runJsBenchmarks({ now: steppingClock(), getFs: async () => memoryFs(), digest, onStep: (t) => steps.push(t), pause }, { garment: small });
    expect(steps).toHaveLength(5); // three blends, the surface directions, the pack
    expect(pause).toHaveBeenCalledTimes(5);
  });

  it('still gives the blend and surface timings when the phone\'s storage cannot be opened', async () => {
    const r = await runJsBenchmarks({ now: steppingClock(), getFs: async () => null, digest }, { garment: small });
    expect(r.pack).toEqual({ skipped: 'the phone\'s storage could not be opened' });
    expect(r.blend[16].n).toBe(20);
    expect(r.normals.n).toBe(10);
  });
});

describe('runPackRoundTrip', () => {
  const pack = withComponents(small, PACK_COMPONENTS);

  it('saves the pack, reads it back, and finds it the same', async () => {
    const fs = memoryFs();
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(r.intact).toBe(true);
    expect(r.bytes).toBe(pack.basis.byteLength);
    expect(fs.writeAsStringAsync).toHaveBeenCalledTimes(1);
    expect(fs.writeAsStringAsync.mock.calls[0][2]).toEqual({ encoding: 'base64' });
    expect(Buffer.from(fs.writeAsStringAsync.mock.calls[0][1], 'base64').equals(Buffer.from(pack.basis.buffer, pack.basis.byteOffset, pack.basis.byteLength))).toBe(true);
  });

  it('times the steps one by one, and adds up the three that opening a saved pack costs', async () => {
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => memoryFs(), digest }, pack);
    expect(r).toMatchObject({ encodeMs: 1, writeMs: 1, readMs: 1, decodeMs: 1, hashMs: 1, loadMs: 3 });
  });

  it('leaves no file behind on the phone', async () => {
    const fs = memoryFs();
    await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(fs.files.size).toBe(0);
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
    expect(fs.deleteAsync.mock.calls[0][1]).toEqual({ idempotent: true });
  });

  it('writes under the cache folder when there is one, and the documents folder when there is not', async () => {
    const a = memoryFs();
    await runPackRoundTrip({ now: steppingClock(), getFs: async () => a, digest }, pack);
    expect(a.writeAsStringAsync.mock.calls[0][0]).toMatch(/^file:\/\/\/cache\/tryon-runtime-test-pack\.bin$/);
    const b = memoryFs({ cacheDirectory: undefined, documentDirectory: 'file:///docs/' });
    await runPackRoundTrip({ now: steppingClock(), getFs: async () => b, digest }, pack);
    expect(b.writeAsStringAsync.mock.calls[0][0]).toMatch(/^file:\/\/\/docs\//);
  });

  it('prefers the cache folder when both folders are there', async () => {
    const fs = memoryFs({ documentDirectory: 'file:///docs/' });
    await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(fs.writeAsStringAsync.mock.calls[0][0]).toMatch(/^file:\/\/\/cache\//);
  });

  it('says so, and still removes the file, when saving or reading fails', async () => {
    const fs = memoryFs({ readAsStringAsync: jest.fn(async () => { throw new Error('disk full'); }) });
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(r.skipped).toMatch(/disk full/);
    expect(fs.deleteAsync).toHaveBeenCalledTimes(1);
  });

  it('does not stop when removing the test file fails', async () => {
    const fs = memoryFs({ deleteAsync: jest.fn(async () => { throw new Error('busy'); }) });
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(r.intact).toBe(true);
  });

  it('flags a pack that reads back different from what was saved', async () => {
    const fs = memoryFs();
    // all zeros: the right size, the wrong numbers
    const zeros = Buffer.from(new Float32Array(pack.basis.length).buffer).toString('base64');
    fs.readAsStringAsync = jest.fn(async () => zeros);
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(r.intact).toBe(false);
  });

  it('takes the fingerprint of the numbers it read back, not of anything else', async () => {
    const seen = jest.fn(digest);
    await runPackRoundTrip({ now: steppingClock(), getFs: async () => memoryFs(), digest: seen }, pack);
    expect(seen).toHaveBeenCalledTimes(1);
    const bytes = seen.mock.calls[0][0];
    expect(bytes).toBeInstanceOf(Float32Array);
    expect(bytes.length).toBe(pack.basis.length);
  });

  it('flags a pack that has extra numbers on the end, even when the start, middle and end of the original are all the same', async () => {
    const fs = memoryFs();
    const longer = new Float32Array(pack.basis.length + 2);
    longer.set(pack.basis);
    fs.readAsStringAsync = jest.fn(async () => Buffer.from(longer.buffer).toString('base64'));
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(r.intact).toBe(false);
  });

  it('flags a pack that reads back the wrong length', async () => {
    const fs = memoryFs();
    fs.readAsStringAsync = jest.fn(async () => Buffer.from(new Float32Array(10).buffer).toString('base64'));
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => fs, digest }, pack);
    expect(r.intact).toBe(false);
  });

  it('treats a storage module that throws when it is opened as no storage', async () => {
    const r = await runPackRoundTrip({ now: steppingClock(), getFs: async () => { throw new Error('no module'); }, digest }, pack);
    expect(r.skipped).toMatch(/storage could not be opened/);
  });
});

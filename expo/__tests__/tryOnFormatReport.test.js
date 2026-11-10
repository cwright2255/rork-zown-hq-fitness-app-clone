// The text the try-on runtime test shows and shares (lib/tryOnSpike/formatReport.js): every measurement beside its target, and "OVER TARGET" only
// when it is over.
const { formatReport } = require('../lib/tryOnSpike/formatReport');
const { TARGETS } = require('../lib/tryOnSpike/stats');

const s = (median, extra = {}) => ({ n: 20, min: median, median, p95: median, max: median, mean: median, ...extra });
const goodJs = () => ({
  vertices: 17004, triangles: 33790,
  blend: { 8: { ...s(5), megabytes: 1.6 }, 16: { ...s(10), megabytes: 3.3 }, 32: { ...s(20), megabytes: 6.5 } },
  normals: s(12),
  pack: { bytes: 3264768, encodeMs: 40, writeMs: 30, readMs: 20, decodeMs: 10, hashMs: 15, loadMs: 45, intact: true },
});
const goodGl = () => ({
  textures: { firstMs: 100, secondMs: 90, totalMs: 190, decodedMB: 44.8 },
  firstFrameMs: 200,
  spin: { frames: 180, fps: 59.9, gapMedian: 16.7, gapP95: 17.5, gapMax: 30 },
  swaps: { blend: s(10, { n: 10 }), normals: s(12, { n: 10 }), draw: s(5, { n: 10, max: 9 }) },
});
const text = (report) => formatReport(report).join('\n');
const device = { os: 'ios', version: '18.1', app: '1.0.1' };

describe('a run that is inside every target', () => {
  const out = text({ device, js: goodJs(), gl: goodGl(), body: { state: 'not included (garment only)' } });

  it('says which phone and app it ran on and how big the garment was beside the real one', () => {
    expect(out).toContain('ios 18.1');
    expect(out).toContain('App: 1.0.1');
    expect(out).toContain('17004 points, 33790 triangles');
    expect(out).toContain('real shorts M: 17004 points, 33988 triangles');
  });

  it('has no line over target', () => {
    expect(out).not.toContain('OVER TARGET');
    expect(out).not.toContain('no result');
  });

  it('shows each measurement', () => {
    expect(out).toContain('16 shape changes (3.3 MB): median 10 ms');
    expect(out).toContain('SURFACE DIRECTIONS: median 12 ms');
    expect(out).toContain('= 45 ms');
    expect(out).toContain('= 190 ms');
    expect(out).toContain('59.9 frames a second');
    expect(out).toContain('SWAP TO A NEW BODY, 10 times');
  });

  it('puts the memory the pictures take beside what the real 4096 pair would take', () => {
    expect(out).toContain('about 44.8 MB');
    expect(out).toContain('about 179 MB');
  });

  it('says what it does not measure', () => {
    expect(out).toContain('Not measured here: memory in use');
  });
});

describe('a run that is over a target', () => {
  const lineWith = (report, start) => formatReport(report).find((l) => l.includes(start));

  it('marks a slow blend (the 16-change one is the one held to the target)', () => {
    const js = goodJs(); js.blend[16] = { ...s(TARGETS.blendMedianMs + 1), megabytes: 3.3 };
    expect(lineWith({ device, js, gl: null }, '  16 shape changes (')).toContain('OVER TARGET');
    expect(lineWith({ device, js, gl: null }, '  8 shape changes (')).not.toContain('OVER TARGET');
  });

  it('does not mark a blend exactly on the target', () => {
    const js = goodJs(); js.blend[16] = { ...s(TARGETS.blendMedianMs), megabytes: 3.3 };
    expect(lineWith({ device, js, gl: null }, '  16 shape changes (')).not.toContain('OVER TARGET');
  });

  it('marks slow surface directions, a slow pack and slow pictures', () => {
    const js = goodJs(); js.normals = s(TARGETS.normalsMedianMs + 1); js.pack.loadMs = TARGETS.packLoadMs + 1;
    const gl = goodGl(); gl.textures.totalMs = TARGETS.textureLoadMs + 1;
    const r = { device, js, gl };
    expect(lineWith(r, 'SURFACE DIRECTIONS')).toContain('OVER TARGET');
    expect(lineWith(r, 'PACK FROM STORAGE')).toContain('OVER TARGET');
    expect(lineWith(r, 'TWO 2048 x 2048 PICTURES')).toContain('OVER TARGET');
  });

  it('marks a slow first frame, a low frame rate and a slow slow-one-in-twenty', () => {
    const gl = goodGl(); gl.firstFrameMs = TARGETS.firstFrameMs + 1; gl.spin = { frames: 90, fps: TARGETS.fpsMin - 1, gapMedian: 22, gapP95: TARGETS.frameGapP95Ms + 1, gapMax: 80 };
    const r = { device, js: goodJs(), gl };
    expect(lineWith(r, 'FIRST FRAME')).toContain('OVER TARGET');
    expect(lineWith(r, 'TURNING (')).toContain('OVER TARGET');
    expect(lineWith(r, 'time between frames')).toContain('OVER TARGET');
  });

  it('marks a frame rate exactly on the target as fine', () => {
    const gl = goodGl(); gl.spin.fps = TARGETS.fpsMin;
    expect(lineWith({ device, js: goodJs(), gl }, 'TURNING (')).not.toContain('OVER TARGET');
  });

  it('says so when the pack came back different from what was saved', () => {
    const js = goodJs(); js.pack.intact = false;
    expect(text({ device, js, gl: null })).toContain('READ BACK DIFFERENT FROM WHAT WAS SAVED');
  });
});

describe('a run that did not finish', () => {
  it('says when the pack part was skipped, and why', () => {
    const js = goodJs(); js.pack = { skipped: 'disk full' };
    expect(text({ device, js, gl: null })).toContain('PACK FROM STORAGE: skipped, disk full');
  });

  it('says when the graphics failed, and why', () => {
    expect(text({ device, js: goodJs(), gl: { error: 'no GL context' } })).toContain('GRAPHICS: failed, no GL context');
  });

  it('says when the screen was closed part way', () => {
    expect(text({ device, js: goodJs(), gl: { cancelled: true } })).toContain('stopped early');
  });

  it('says there were too few frames to measure rather than printing nothing', () => {
    const gl = goodGl(); gl.spin = null;
    expect(text({ device, js: goodJs(), gl })).toContain('TURNING: too few frames to measure');
  });

  it('shows the body scan\'s state and how long it took to load, when there is one', () => {
    expect(text({ device, js: goodJs(), gl: goodGl(), body: { state: 'added (the garment is beside it, not fitted)', ms: 812.3 } })).toContain('BODY SCAN IN THE SCENE: added (the garment is beside it, not fitted) (812.3 ms)');
  });

  it('copes with a report that has only the phone\'s details', () => {
    expect(() => formatReport({ device })).not.toThrow();
    expect(() => formatReport({})).not.toThrow();
  });
});

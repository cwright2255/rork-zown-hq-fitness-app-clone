// The summaries and targets the try-on runtime test reports with (lib/tryOnSpike/stats.js).
const { summarize, decodedTextureMB, frameSummary, TARGETS } = require('../lib/tryOnSpike/stats');

describe('summarize', () => {
  it('gives the median, the slow one in twenty, the worst, the best and the mean', () => {
    const s = summarize(Array.from({ length: 20 }, (_, i) => i + 1)); // 1..20
    expect(s).toEqual({ n: 20, min: 1, median: 10, p95: 19, max: 20, mean: 10.5 });
  });

  it('does not depend on the order the times come in', () => {
    expect(summarize([5, 1, 3])).toEqual(summarize([1, 3, 5]));
    expect(summarize([5, 1, 3]).median).toBe(3);
  });

  it('copes with one time, and with none', () => {
    expect(summarize([7.26])).toEqual({ n: 1, min: 7.3, median: 7.3, p95: 7.3, max: 7.3, mean: 7.3 });
    expect(summarize([])).toBeNull();
    expect(summarize(null)).toBeNull();
  });

  it('leaves out times that are not numbers, rather than poisoning every figure', () => {
    expect(summarize([1, NaN, 3, undefined, Infinity])).toMatchObject({ n: 2, min: 1, max: 3 });
  });

  it('does not change the list it is given', () => {
    const list = [3, 1, 2];
    summarize(list);
    expect(list).toEqual([3, 1, 2]);
  });
});

describe('decodedTextureMB', () => {
  it('is 4 bytes a pixel, and a third more with the smaller copies', () => {
    expect(decodedTextureMB(2048, 2048, { mipmaps: false })).toBe(16.8);
    expect(decodedTextureMB(2048, 2048)).toBe(22.4);
    expect(decodedTextureMB(4096, 4096)).toBe(89.5);
  });

  it('shows why the real shorts\' 4096 pictures are the problem: the pair is four times the 2048 pair', () => {
    expect(decodedTextureMB(4096, 4096) / decodedTextureMB(2048, 2048)).toBeCloseTo(4, 1);
  });
});

describe('frameSummary', () => {
  it('works out frames a second and the gaps from the times frames were drawn', () => {
    const times = Array.from({ length: 61 }, (_, i) => i * 16.667); // 60 frames in one second
    const s = frameSummary(times);
    expect(s.frames).toBe(61);
    expect(s.fps).toBeCloseTo(60, 0);
    expect(s.gapMedian).toBeCloseTo(16.7, 1);
    expect(s.gapMax).toBeCloseTo(16.7, 1);
  });

  it('shows a slow frame in the worst gap and the slow-one-in-twenty', () => {
    const times = [0];
    for (let i = 1; i <= 40; i++) times.push(times[i - 1] + (i === 20 ? 120 : 16.7));
    const s = frameSummary(times);
    expect(s.gapMax).toBe(120);
    expect(s.gapP95).toBeLessThan(120);
  });

  it('says nothing from too few frames', () => {
    expect(frameSummary([0, 16])).toBeNull();
    expect(frameSummary([])).toBeNull();
    expect(frameSummary(undefined)).toBeNull();
  });
});

describe('TARGETS', () => {
  it('has a target for each thing the report holds to one, all positive', () => {
    expect(Object.keys(TARGETS).sort()).toEqual(['blendMedianMs', 'firstFrameMs', 'fpsMin', 'frameGapP95Ms', 'normalsMedianMs', 'packLoadMs', 'textureLoadMs']);
    Object.values(TARGETS).forEach((t) => expect(t).toBeGreaterThan(0));
  });

  it('are the plan\'s numbers: a change to one is a decision, not an accident', () => {
    expect(TARGETS).toEqual({
      blendMedianMs: 60, normalsMedianMs: 40, packLoadMs: 500, textureLoadMs: 1000, firstFrameMs: 500, fpsMin: 45, frameGapP95Ms: 30,
    });
  });
});

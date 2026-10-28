// What the launch splash does at each frame (lib/zownGlitchSpec.js). The splash was approved as a preview video rendered from this
// data, so these pin what was approved: the palette, the length, the two hits, the one flicker, and the clean ending.
const { frameSpec, envelope, SPEC } = require('../lib/zownGlitchSpec');

const FRAMES = Array.from({ length: SPEC.TOTAL_FRAMES }, (_, i) => i);
const specs = FRAMES.map((f) => frameSpec(f));
const glitchFrames = FRAMES.filter((f) => !specs[f].clean);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('the approved look', () => {
  it('runs 3.2 seconds at 30 frames a second, on the 960 x 242 wordmark', () => {
    expect(SPEC.FPS).toBe(30);
    expect(SPEC.TOTAL_FRAMES).toBe(96);
    expect((SPEC.TOTAL_FRAMES * 1000) / SPEC.FPS).toBe(3200);
    expect([SPEC.LOGO_W, SPEC.LOGO_H]).toEqual([960, 242]);
  });

  it('uses the palette Cj picked, and the logo itself stays pure black', () => {
    expect(SPEC.CYAN).toBe('#00CFFF');
    expect(SPEC.ORANGE).toBe('#FF3F00');
    expect(SPEC.DARK_RED).toBe('#8C1B1B');
    expect(SPEC.INK).toBe('#1D1F21');
    expect(SPEC.GREY).toBe('#E7E7E7');
    expect(SPEC.GREEN).toBe('#32CD32');
    expect(SPEC.BLACK).toBe('#000000');
  });

  it('draws blocks only in the palette, streaks in ink and the ghost in grey', () => {
    const allowed = [SPEC.CYAN, SPEC.ORANGE, SPEC.DARK_RED, SPEC.INK, SPEC.GREEN];
    for (const s of specs) {
      for (const b of s.blocks) expect(allowed).toContain(b.color);
      for (const l of s.lines) expect(l.color).toBe(SPEC.INK);
      if (s.echo) expect(s.echo.color).toBe(SPEC.GREY);
    }
  });

  it('has a little green in the blocks: some, never most', () => {
    const blocks = specs.flatMap((s) => s.blocks);
    const green = blocks.filter((b) => b.color === SPEC.GREEN);
    expect(green.length).toBeGreaterThanOrEqual(10);
    expect(green.length / blocks.length).toBeGreaterThan(0.05);
    expect(green.length / blocks.length).toBeLessThan(0.25);
    // the most-used colours are the cyan and the orange
    const count = (c) => blocks.filter((b) => b.color === c).length;
    expect(count(SPEC.CYAN)).toBeGreaterThan(green.length);
    expect(count(SPEC.ORANGE)).toBeGreaterThan(green.length);
  });
});

describe('the timeline', () => {
  it('starts with none of the logo there, only coloured blocks', () => {
    const first = specs[0];
    expect(first.clean).toBe(false);
    expect(first.bands.some((b) => b.visible)).toBe(false);
    expect(first.blocks.length).toBeGreaterThan(0);
  });

  it('brings the logo in through the first second or so', () => {
    expect(envelope(6).reveal).toBeLessThan(0.2);
    expect(envelope(20).reveal).toBeGreaterThan(0.3);
    expect(envelope(20).reveal).toBeLessThan(0.8);
    expect(envelope(35).reveal).toBe(1);
  });

  it('is plain, clean black ZOWN from frame 57 to the end, except one small flicker at 77 to 79', () => {
    const notClean = range(57, SPEC.TOTAL_FRAMES - 1).filter((f) => !specs[f].clean);
    expect(notClean).toEqual([77, 78, 79]);
    for (const f of range(0, 56)) expect(specs[f].clean).toBe(false);
  });

  it('ends on a clean frame, and every frame after the end is clean too', () => {
    expect(specs[SPEC.TOTAL_FRAMES - 1].clean).toBe(true);
    expect(frameSpec(150).clean).toBe(true);
    expect(frameSpec(1000).clean).toBe(true);
  });

  it('has two sharp hits (44 to 45 and 52 to 53), each pushing the logo up a little in size', () => {
    for (const f of [44, 45, 52, 53]) {
      expect(envelope(f).intensity).toBeCloseTo(0.85, 5);
      expect(specs[f].scale).toBe(1.015);
    }
    for (const f of FRAMES.filter((x) => ![44, 45, 52, 53].includes(x))) expect(specs[f].scale).toBe(1);
  });

  it('gets calmer between the first burst and the clean hold', () => {
    expect(envelope(6).intensity).toBeGreaterThan(envelope(30).intensity);
    expect(envelope(30).intensity).toBeGreaterThan(envelope(42).intensity);
    expect(envelope(56).intensity).toBeLessThan(0.05);
    expect(envelope(57).intensity).toBe(0);
  });
});

describe('what is drawn at a frame', () => {
  it('is the same every time it is asked for', () => {
    for (const f of [0, 13, 44, 78]) expect(frameSpec(f)).toEqual(frameSpec(f));
    expect(frameSpec(13)).not.toEqual(frameSpec(15));
  });

  it('rolls its dice again only every 2nd frame, so the glitch holds for a beat: the top slice is the same height for both frames of a beat', () => {
    for (let k = 0; k < 28; k += 1) {
      expect(specs[2 * k + 1].bands[0].sh).toBe(specs[2 * k].bands[0].sh);
    }
    // and the next beat is a new roll
    const tops = new Set(Array.from({ length: 28 }, (_, k) => specs[2 * k].bands[0].sh));
    expect(tops.size).toBeGreaterThan(5);
  });

  it('cuts the logo into slices that cover it top to bottom with no gap and no overlap', () => {
    for (const s of specs) {
      let y = 0;
      for (const b of s.bands) {
        expect(b.sy).toBe(y);
        expect(b.sh).toBeGreaterThan(0);
        y += b.sh;
      }
      expect(y).toBe(SPEC.LOGO_H);
    }
  });

  it('keeps every push inside what the preview showed', () => {
    for (const f of glitchFrames) {
      for (const b of specs[f].bands) {
        expect(Math.abs(b.dx)).toBeLessThanOrEqual(150);
        expect(b.split).toBeLessThanOrEqual(32);
        expect(b.split).toBeGreaterThanOrEqual(0);
      }
      expect(Math.abs(specs[f].dy)).toBeLessThanOrEqual(10);
      expect(specs[f].blocks.length).toBeLessThanOrEqual(8);
    }
  });

  it('has colour fringes while it glitches, and none on a clean frame', () => {
    for (const f of glitchFrames) expect(specs[f].fringe).toBe(envelope(f).intensity > 0.08);
    for (const f of FRAMES.filter((x) => specs[x].clean)) expect(specs[f].fringe).toBe(false);
  });

  it('shows the grey ghost copy only once the logo is mostly there and the glitch is strong', () => {
    const withEcho = FRAMES.filter((f) => specs[f].echo);
    expect(withEcho.length).toBeGreaterThan(0);
    for (const f of withEcho) {
      expect(envelope(f).reveal).toBeGreaterThan(0.35);
      expect(envelope(f).intensity).toBeGreaterThan(0.5);
    }
  });

  it('a clean frame is just the logo: one whole slice, nothing else, no nudge', () => {
    for (const f of FRAMES.filter((x) => specs[x].clean)) {
      expect(specs[f]).toEqual({
        clean: true,
        bands: [{ sy: 0, sh: SPEC.LOGO_H, dx: 0, split: 0, visible: true }],
        blocks: [],
        lines: [],
        dy: 0,
        scale: 1,
        echo: null,
        fringe: false,
      });
    }
  });
});

// What the ZOWN glitch splash looks like at each frame, as plain data. Nothing here draws anything: the splash component
// (components/ZownGlitchSplash.jsx) reads this, and the preview video Cj approved was rendered from the same data, so what
// ships is what was approved. Change a number here and the splash changes; __tests__/zownGlitchSpec.test.js pins the
// parts that were approved (the palette, the length, the clean ending).
//
// Units are "logo pixels": the wordmark image is 960 wide and 242 high (assets/branding/zown-wordmark.png), and every
// x / y / width / height below is in that space, with (0, 0) at the logo's top-left. A renderer scales them to the screen.
//
// Look: black ZOWN on white. It tears in through a burst of sliced, shifted pieces with cyan and orange colour fringes,
// coloured blocks (a little green among them) and thin dark streaks, settles with two sharp hits, holds perfectly clean,
// gives one small flicker, and ends clean. The dice are rolled again every 2nd frame (15 times a second), so the glitch holds
// for a beat instead of flickering on every frame.

const FPS = 30;
const TOTAL_FRAMES = 96; // 3.2 s
const LOGO_W = 960;
const LOGO_H = 242;

// The glitch palette (Cj's pick: "Glitching Digital Waveforms and Static"). The logo itself stays pure black.
const INK = '#1D1F21';
const ORANGE = '#FF3F00';
const CYAN = '#00CFFF';
const DARK_RED = '#8C1B1B';
const GREY = '#E7E7E7';
const GREEN = '#32CD32'; // a little of it, in the blocks only
const BLACK = '#000000';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// Two sharp hits while it settles, and one small flicker once it is clean (frame numbers, inclusive).
const HITS = [[44, 45], [52, 53]];
const FLICKER = [77, 79];
const inRange = (f, [a, b]) => f >= a && f <= b;

/** How hard the glitch is at this frame (0 = clean) and how much of the logo has arrived (0 to 1). */
export function envelope(frame) {
  const t = frame / FPS;
  let intensity;
  if (t < 0.2) intensity = 0.9;
  else if (t < 1.3) intensity = lerp(1, 0.5, (t - 0.2) / 1.1);
  else if (t < 1.9) intensity = lerp(0.5, 0, (t - 1.3) / 0.6);
  else intensity = 0;
  if (HITS.some((h) => inRange(frame, h))) intensity = Math.max(intensity, 0.85);
  if (inRange(frame, FLICKER)) intensity = Math.max(intensity, 0.35);
  const reveal = t < 0.2 ? 0 : lerp(0.08, 1, smooth(0.2, 1.15, t));
  return { intensity, reveal: t >= 1.15 ? 1 : reveal, hit: HITS.some((h) => inRange(frame, h)) };
}

/**
 * Everything to draw at this frame.
 *   bands   horizontal slices of the logo, top to bottom, covering it all: { sy, sh } what part of the image,
 *           dx how far it is pushed sideways, split how far the colour fringes are pushed from it, visible
 *   blocks  coloured rectangles { x, y, w, h, color }
 *   lines   thin streaks { x, y, w, h, color }
 *   dy      the whole logo nudged up or down      scale  the whole logo, 1 = normal
 *   echo    a light grey copy of the logo above or below { dy, color }, or null
 *   fringe  whether the colour fringes (cyan, red) are drawn at all
 *   clean   true when this frame is just the plain logo
 */
export function frameSpec(frame) {
  const { intensity, reveal, hit } = envelope(frame);
  if (intensity === 0 && reveal >= 1) {
    return { clean: true, bands: [{ sy: 0, sh: LOGO_H, dx: 0, split: 0, visible: true }], blocks: [], lines: [], dy: 0, scale: 1, echo: null, fringe: false };
  }
  const rnd = mulberry32(Math.floor(frame / 2) * 7919 + 101); // same state for frames 2k and 2k+1
  const I = intensity;

  const bands = [];
  for (let y = 0; y < LOGO_H;) {
    const sh = Math.min(LOGO_H - y, Math.round(6 + rnd() * 30));
    const displaced = rnd() < 0.2 + 0.5 * I;
    const dx = displaced ? Math.round((rnd() * 2 - 1) * I * 150) : 0;
    const split = Math.round(I * (6 + rnd() * 26));
    const visible = rnd() < reveal;
    bands.push({ sy: y, sh, dx, split, visible });
    y += sh;
  }

  const blocks = [];
  const nBlocks = Math.round(I * (3 + rnd() * 5));
  const palette = [CYAN, ORANGE, CYAN, ORANGE, DARK_RED, INK, GREEN];
  for (let i = 0; i < nBlocks; i += 1) {
    blocks.push({
      x: Math.round(-120 + rnd() * 1100),
      y: Math.round(-70 + rnd() * 380),
      w: Math.round(40 + rnd() * 320),
      h: Math.round(6 + rnd() * 40),
      color: palette[Math.floor(rnd() * palette.length)],
    });
  }

  const lines = [];
  const nLines = Math.round(I * 2 * rnd());
  for (let i = 0; i < nLines; i += 1) {
    lines.push({ x: Math.round(-200 + rnd() * 900), y: Math.round(-40 + rnd() * 330), w: Math.round(200 + rnd() * 500), h: Math.round(2 + rnd() * 2), color: INK });
  }

  const dy = rnd() < 0.35 ? Math.round((rnd() * 2 - 1) * I * 10) : 0;
  const scale = hit ? 1.015 : 1;
  const echo = I > 0.5 && reveal > 0.35 && rnd() < 0.4 ?{ dy: Math.round((rnd() < 0.5 ? -1 : 1) * (40 + rnd() * 30)), color: GREY } : null;

  return { clean: false, bands, blocks, lines, dy, scale, echo, fringe: I > 0.08 };
}

export const SPEC = { FPS, TOTAL_FRAMES, LOGO_W, LOGO_H, CYAN, ORANGE, DARK_RED, INK, GREY, GREEN, BLACK };

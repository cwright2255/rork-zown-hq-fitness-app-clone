// lib/tryOnSpike/stats.js
//
// Plain numbers for the try-on runtime test: summaries of repeated timings, the memory a texture takes once the phone has opened it, and the
// targets the test holds each measurement to.

/** n, min, median, p95 (the slow one in twenty), max and mean of a list of times, in milliseconds, rounded to 0.1. Null for an empty list. */
export function summarize(samples) {
  const list = (samples || []).filter((x) => Number.isFinite(x));
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
  const round = (x) => Math.round(x * 10) / 10;
  const mean = list.reduce((s, x) => s + x, 0) / list.length;
  return { n: list.length, min: round(sorted[0]), median: round(at(0.5)), p95: round(at(0.95)), max: round(sorted[sorted.length - 1]), mean: round(mean) };
}

/** Megabytes a picture takes in the phone's memory once it is opened (4 bytes a pixel; a third more with the smaller copies drawn far away). */
export function decodedTextureMB(width, height, { mipmaps = true } = {}) {
  const bytes = width * height * 4 * (mipmaps ? 4 / 3 : 1);
  return Math.round((bytes / 1e6) * 10) / 10;
}

/** Frames per second and frame times from the times (ms) at which successive frames were drawn. */
export function frameSummary(frameTimes) {
  if (!frameTimes || frameTimes.length < 3) return null;
  const gaps = [];
  for (let i = 1; i < frameTimes.length; i++) gaps.push(frameTimes[i] - frameTimes[i - 1]);
  const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
  const s = summarize(gaps);
  return { frames: frameTimes.length, fps: span > 0 ? Math.round(((frameTimes.length - 1) / span) * 10000) / 10 : null, gapMedian: s.median, gapP95: s.p95, gapMax: s.max };
}

// What the real try-on has to stay inside for the phone-side work to be a small part of the 15 seconds. These are the plan's targets, not
// results; the report shows each measurement against its target.
export const TARGETS = {
  blendMedianMs: 60,        // one blend of the garment to a new body or size
  normalsMedianMs: 40,      // recalculating the surface directions after a blend
  packLoadMs: 500,          // reading a pack from the phone's storage and making it usable
  textureLoadMs: 1000,      // opening both pictures and putting them on the graphics chip
  firstFrameMs: 500,        // the first picture of the garment (includes the graphics chip's one-time set-up)
  fpsMin: 45,               // while turning the model
  frameGapP95Ms: 30,        // the slow one in twenty frames
};

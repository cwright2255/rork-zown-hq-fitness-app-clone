// services/muscleVisualizerService.js
//
// Real anatomical muscle diagrams via the Muscle Visualizer API
// (ExerciseDB/AscendAPI — the same provider family as
// services/exerciseDbService.js's oss.exercisedb.dev, confirmed by
// matching domains, not assumed). This file existed before this session
// touched it, wired into app/workout/[id].jsx — but had three real bugs
// that would have made every call fail, found by checking the actual
// published API docs rather than trusting the existing code:
//   1. Wrong base path: called /api/v1/visualize/... — the real,
//      documented path (confirmed via the API's own GitHub README) is
//      /v1/visualize/..., no /api segment.
//   2. Wrong auth method: passed the key as a &rapidapi-key= query
//      param. The real, documented auth is the X-RapidAPI-Key header —
//      confirmed directly from the API's own curl examples.
//   3. Wrong muscle-name casing: uppercased every name (BICEPS,
//      PECTORALS). A real exercise record from the same provider family
//      returns lowercase names ("pectorals", "triceps", "shoulders"),
//      matching the visualizer API's own curl example
//      (muscles=biceps,triceps) — also lowercase.
//
// Fixed all three. Also switched from "return a plain URL for
// <Image source={{uri}}>" to "fetch with real headers, return a base64
// data URI" — a bare <Image> tag can't reliably send a custom
// X-RapidAPI-Key header across platforms/caching the way a real fetch()
// call can, and auth headers are exactly what this API requires.

// The API key is not in the app. The three requests below go through the cloud functions
// of the same names (functions/src/index.js), which hold the key, fetch the image and send
// it back as base64; this file turns that into the same data URI as before. Nothing here
// reads a key.
import { callProxy } from '@/services/callProxy';

// Real names, lowercase — matches confirmed real exercise data from the
// same provider (oss.exercisedb.dev) and the visualizer API's own
// documented curl examples. Not uppercased.
export function normalizeMuscleNames(muscles = []) {
  return (muscles || [])
    .filter((m) => m && typeof m === 'string')
    .map((m) => m.toLowerCase().trim());
}

async function fetchAsDataUri(functionName, request) {
  try {
    const answer = await callProxy(functionName, request);
    if (!answer || typeof answer.base64 !== 'string' || !answer.base64) {
      console.warn('[muscleVisualizerService] request sent no image:', functionName);
      return null;
    }
    return `data:${answer.contentType || 'image/png'};base64,${answer.base64}`;
  } catch (e) {
    console.warn('[muscleVisualizerService] request failed:', e?.message);
    return null;
  }
}

/**
 * Simple highlight: given muscle groups, one color. Returns a real
 * base64 data URI ready for <Image source={{uri}} />, or null if
 * unconfigured/failed — callers should render nothing rather than a
 * broken image, same pattern used throughout this app's other optional
 * AI/external-data cards.
 */
export async function getMuscleVisualizeImage({
  muscles = [],
  color = '#E74C3C',
  gender = 'male',
  size = 'small',
} = {}) {
  const names = normalizeMuscleNames(muscles);
  if (!names.length) return null;
  return fetchAsDataUri('getMuscleVisualizeImage', { muscles: names, color, gender, size });
}

/**
 * Primary vs. secondary muscle activation — used on activity preview
 * screens to show which muscles an exercise/workout/run/hike will
 * actually target.
 */
export async function getWorkoutVisualizeImage({
  targetMuscles = [],
  secondaryMuscles = [],
  gender = 'male',
  size = 'small',
} = {}) {
  const target = normalizeMuscleNames(targetMuscles);
  if (!target.length) return null;
  return fetchAsDataUri('getWorkoutVisualizeImage', {
    targetMuscles: target,
    secondaryMuscles: normalizeMuscleNames(secondaryMuscles),
    gender,
    size,
  });
}

/**
 * Real intensity-based heatmap — one color per muscle, intensity driven
 * by real per-muscle fatigue (see lib/muscleFatigue.js), not a flat
 * highlight. This is the "fatigue mapping" use case the API's own docs
 * explicitly describe as a real, intended purpose.
 * @param {Array<{muscle: string, color: string}>} muscleColors
 */
export async function getHeatmapVisualizeImage({
  muscleColors = [],
  gender = 'male',
  size = 'small',
} = {}) {
  if (!muscleColors.length) return null;
  // A muscle and its colour travel together, so an entry without a usable name drops out
  // with its colour rather than shifting the colours onto the wrong muscles.
  const entries = muscleColors
    .filter((m) => m && typeof m.muscle === 'string' && m.muscle)
    .map((m) => ({ muscle: m.muscle.toLowerCase().trim(), color: m.color }));
  if (!entries.length) return null;
  return fetchAsDataUri('getHeatmapVisualizeImage', { muscleColors: entries, gender, size });
}

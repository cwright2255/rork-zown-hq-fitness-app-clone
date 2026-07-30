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

const MUSCLE_VIZ_BASE = 'https://muscle-visualizer-api.p.rapidapi.com/v1';
const MUSCLE_VIZ_HOST = 'muscle-visualizer-api.p.rapidapi.com';

function getApiKey() {
  return process.env.EXPO_PUBLIC_RAPIDAPI_KEY || null;
}

// Real names, lowercase — matches confirmed real exercise data from the
// same provider (oss.exercisedb.dev) and the visualizer API's own
// documented curl examples. Not uppercased.
export function normalizeMuscleNames(muscles = []) {
  return (muscles || [])
    .filter((m) => m && typeof m === 'string')
    .map((m) => m.toLowerCase().trim());
}

async function fetchAsDataUri(url, apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': MUSCLE_VIZ_HOST,
      },
    });
    if (!res.ok) {
      console.warn('[muscleVisualizerService] request failed:', res.status);
      return null;
    }
    const blob = await res.blob();
    // Real, documented React Native edge case: a blob's own .type is
    // sometimes empty/missing depending on RN version and how the
    // response was produced, which breaks FileReader.readAsDataURL
    // silently or with a native error. Filling it in from the response's
    // actual Content-Type header first avoids relying on the blob
    // getting this right on its own.
    if (blob && !blob.type) {
      blob.type = res.headers.get('content-type') || 'image/png';
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('[muscleVisualizerService] fetch error:', e?.message);
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
  const apiKey = getApiKey();
  const names = normalizeMuscleNames(muscles);
  if (!names.length || !apiKey) return null;

  const musclesParam = encodeURIComponent(names.join(','));
  const colorParam = encodeURIComponent(color);
  const url = `${MUSCLE_VIZ_BASE}/visualize/muscles?muscles=${musclesParam}&color=${colorParam}&gender=${gender}&background=transparent&size=${size}&format=png`;
  return fetchAsDataUri(url, apiKey);
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
  const apiKey = getApiKey();
  const target = normalizeMuscleNames(targetMuscles);
  if (!target.length || !apiKey) return null;

  let url = `${MUSCLE_VIZ_BASE}/visualize/workout?targetMuscles=${encodeURIComponent(target.join(','))}&targetMusclesColor=%23E74C3C&gender=${gender}&background=transparent&size=${size}&format=png`;
  const secondary = normalizeMuscleNames(secondaryMuscles);
  if (secondary.length) {
    url += `&secondaryMuscles=${encodeURIComponent(secondary.join(','))}&secondaryMusclesColor=%23F39C12`;
  }
  return fetchAsDataUri(url, apiKey);
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
  const apiKey = getApiKey();
  if (!muscleColors.length || !apiKey) return null;

  const muscles = normalizeMuscleNames(muscleColors.map((m) => m.muscle));
  const colors = muscleColors.map((m) => encodeURIComponent(m.color));
  const url = `${MUSCLE_VIZ_BASE}/visualize/heatmap?muscles=${encodeURIComponent(muscles.join(','))}&colors=${colors.join(',')}&gender=${gender}&background=transparent&size=${size}&format=png`;
  return fetchAsDataUri(url, apiKey);
}

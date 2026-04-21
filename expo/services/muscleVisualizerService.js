const MUSCLE_VIZ_BASE = 'https://muscle-visualizer-api.p.rapidapi.com/api/v1';
const RAPIDAPI_KEY = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;

export function normalizeMuscleNames(muscles = []) {
  return (muscles || [])
    .filter((m) => m && typeof m === 'string')
    .map((m) => m.toUpperCase().trim());
}

export function getMuscleVisualizeUrl({
  muscles = [],
  color = '#E74C3C',
  gender = 'male',
  size = 'small',
} = {}) {
  if (!muscles || !muscles.length || !RAPIDAPI_KEY) return null;
  const musclesParam = encodeURIComponent(muscles.join(','));
  const colorParam = encodeURIComponent(color);
  return `${MUSCLE_VIZ_BASE}/visualize?muscles=${musclesParam}&color=${colorParam}&gender=${gender}&background=transparent&size=${size}&format=jpeg&rapidapi-key=${RAPIDAPI_KEY}`;
}

export function getWorkoutVisualizeUrl({
  targetMuscles = [],
  secondaryMuscles = [],
  gender = 'male',
  size = 'small',
} = {}) {
  if (!targetMuscles || !targetMuscles.length || !RAPIDAPI_KEY) return null;
  const target = encodeURIComponent(targetMuscles.join(','));
  let url = `${MUSCLE_VIZ_BASE}/visualize/workout?targetMuscles=${target}&targetMusclesColor=%23E74C3C&gender=${gender}&background=transparent&size=${size}&format=jpeg&rapidapi-key=${RAPIDAPI_KEY}`;
  if (secondaryMuscles && secondaryMuscles.length) {
    const secondary = encodeURIComponent(secondaryMuscles.join(','));
    url += `&secondaryMuscles=${secondary}&secondaryMusclesColor=%23F39C12`;
  }
  return url;
}

export function getHeatmapVisualizeUrl({
  muscles = [],
  gender = 'male',
  size = 'small',
} = {}) {
  if (!muscles || !muscles.length || !RAPIDAPI_KEY) return null;
  const COLORS = [
    '%23E74C3C',
    '%23F39C12',
    '%233498DB',
    '%232ECC71',
    '%239B59B6',
    '%231ABC9C',
    '%23E67E22',
    '%2316A085',
  ];
  const musclesParam = encodeURIComponent(muscles.join(','));
  const colorsParam = muscles.map((_, i) => COLORS[i % COLORS.length]).join(',');
  return `${MUSCLE_VIZ_BASE}/visualize/heatmap?muscles=${musclesParam}&colors=${colorsParam}&gender=${gender}&background=transparent&size=${size}&format=jpeg&rapidapi-key=${RAPIDAPI_KEY}`;
}

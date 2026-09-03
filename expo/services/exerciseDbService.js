const BASE_URL = 'https://oss.exercisedb.dev/api/v1';

export async function fetchExercises({ limit = 20, cursor = null } = {}) {
  const url = cursor
    ? `${BASE_URL}/exercises?limit=${limit}&cursor=${encodeURIComponent(cursor)}`
    : `${BASE_URL}/exercises?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ExerciseDB fetch failed: ${res.status}`);
  const json = await res.json();
  return json;
}

export async function fetchExerciseById(exerciseId) {
  const res = await fetch(`${BASE_URL}/exercises/${exerciseId}`);
  if (!res.ok) throw new Error(`ExerciseDB fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || null;
}

export async function fetchEquipments() {
  const res = await fetch(`${BASE_URL}/equipments`);
  if (!res.ok) throw new Error(`ExerciseDB fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

export async function fetchMuscles() {
  const res = await fetch(`${BASE_URL}/muscles`);
  if (!res.ok) throw new Error(`ExerciseDB fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data || [];
}

const ASCEND_BASE = 'https://edb-with-videos-and-images-by-ascendapi.p.rapidapi.com/api/v1';
const ASCEND_HOST = 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com';

function getAscendHeaders() {
  return {
    'x-rapidapi-key': process.env.EXPO_PUBLIC_RAPIDAPI_KEY || '',
    'x-rapidapi-host': ASCEND_HOST,
  };
}

export async function fetchAscendExercises({ limit = 20, cursor = null, bodyPart = '', name = '' } = {}) {
  let url = `${ASCEND_BASE}/exercises?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  if (bodyPart) url += `&bodyPart=${encodeURIComponent(bodyPart)}`;
  if (name) url += `&name=${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: getAscendHeaders() });
  if (!res.ok) throw new Error(`AscendAPI fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAscendBodyParts() {
  const res = await fetch(`${ASCEND_BASE}/bodyparts`, { headers: getAscendHeaders() });
  if (!res.ok) throw new Error(`AscendAPI fetch failed: ${res.status}`);
  return res.json();
}

// Real, confirmed endpoint from AscendAPI's own quickstart docs:
// GET /api/v1/exercises/search?search=<query>. Deliberately not folded
// into fetchAscendExercises above, since that one hits GET /exercises
// with a name= filter that this same API does not actually recognize
// on that path, it silently returns unfiltered results instead of
// erroring, which is why this went unnoticed until now. Search-by-name
// and paginated browse are different enough use cases to keep separate
// rather than patch the existing one and risk changing its behavior
// for wherever it's already relied on.
// Qualifier words the AI planner puts in front of a base movement name
// (e.g. "Bodyweight Squats", "Assisted Pull-ups") that a canonical
// exercise database's search is unlikely to expect. Stripped for a
// retry, never for the primary attempt, since some exercises are
// genuinely named with these words as part of the real exercise.
const NAME_QUALIFIERS = ['bodyweight', 'assisted', 'weighted', 'banded', 'machine', 'cable', 'barbell', 'dumbbell', 'kettlebell', 'resistance'];

function simplifyExerciseName(name) {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return null;
  if (!NAME_QUALIFIERS.includes(words[0].toLowerCase())) return null;
  return words.slice(1).join(' ');
}

async function runAscendSearch(query) {
  const url = `${ASCEND_BASE}/exercises/search?search=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: getAscendHeaders() });
  if (!res.ok) {
    console.warn('[exerciseDbService] searchAscendExercise request failed:', res.status, query);
    return null;
  }
  const json = await res.json();
  const results = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return results[0] || null;
}

// Two-step lookup: exact generated name first, then (only if that comes
// back empty) a simplified name with the leading qualifier word
// stripped. Every branch logs, so a null result always leaves a reason
// in the console instead of failing silently, at most 2 requests per
// exercise, never more.
export async function searchAscendExercise(name) {
  if (!name) return null;
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY;
  if (!apiKey) {
    console.warn('[exerciseDbService] searchAscendExercise: EXPO_PUBLIC_RAPIDAPI_KEY not set, skipping');
    return null;
  }

  const record = await runAscendSearch(name);
  if (record) return record;
  console.warn('[exerciseDbService] no AscendAPI match for exact name:', name);

  const simplified = simplifyExerciseName(name);
  if (!simplified) return null;

  console.warn('[exerciseDbService] retrying with simplified name:', simplified);
  const retryRecord = await runAscendSearch(simplified);
  if (retryRecord) return retryRecord;
  console.warn('[exerciseDbService] no AscendAPI match for simplified name either:', simplified);
  return null;
}

// The video field name on this specific endpoint isn't confirmed from
// documentation, sibling AscendAPI products in the same family use
// videoUrl, videoUrls, or gifUrls depending on tier. Checks every
// plausible shape and logs the real keys when none match, so a wrong
// guess here is a one-line fix once a real response has been seen
// rather than another silent null.
export function extractVideoUrl(exerciseRecord) {
  if (!exerciseRecord) return null;
  if (typeof exerciseRecord.videoUrl === 'string') return exerciseRecord.videoUrl;
  if (typeof exerciseRecord.video === 'string') return exerciseRecord.video;
  if (exerciseRecord.videoUrls && typeof exerciseRecord.videoUrls === 'object') {
    const first = Object.values(exerciseRecord.videoUrls).find((v) => typeof v === 'string');
    if (first) return first;
  }
  if (exerciseRecord.media?.type === 'video' && typeof exerciseRecord.media?.url === 'string') {
    return exerciseRecord.media.url;
  }
  console.warn('[exerciseDbService] no known video field on exercise record, keys were:', Object.keys(exerciseRecord));
  return null;
}

export function filterExercises(exercises, { query = '', equipment = '', bodyPart = '', muscle = '' } = {}) {
  const q = (query || '').toLowerCase().trim();
  const eq = (equipment || '').toLowerCase().trim();
  const bp = (bodyPart || '').toLowerCase().trim();
  const ms = (muscle || '').toLowerCase().trim();
  return (exercises || []).filter((ex) => {
    const name = (ex.name || '').toLowerCase();
    const equipments = Array.isArray(ex.equipments) ? ex.equipments.map((e) => (e || '').toLowerCase()) : [];
    const bodyParts = Array.isArray(ex.bodyParts) ? ex.bodyParts.map((b) => (b || '').toLowerCase()) : [];
    const targetMuscles = Array.isArray(ex.targetMuscles) ? ex.targetMuscles.map((m) => (m || '').toLowerCase()) : [];
    const matchName = !q || name.includes(q);
    const matchEquip = !eq || equipments.includes(eq);
    const matchBody = !bp || bodyParts.some((b) => bp.split('|').includes(b));
    const matchMuscle = !ms || targetMuscles.includes(ms);
    return matchName && matchEquip && matchBody && matchMuscle;
  });
}

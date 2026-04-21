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

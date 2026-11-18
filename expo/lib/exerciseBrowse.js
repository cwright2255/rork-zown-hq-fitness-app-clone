// lib/exerciseBrowse.js
//
// What the Browse Exercises row on the Workouts tab shows: the first few exercises as before, or what the person has searched for, or one body
// part, or the exercises they opened lately ("Recent").
//
// Recent is kept by store/recentExercisesStore.js. Each exercise is kept as a small summary, enough to draw its card and to filter it by body
// part, so Recent works before the exercise library has loaded and for an exercise that is not in the part of the library the phone holds.
import { filterExercises } from '../services/exerciseDbService';

export const RECENT_EXERCISES_KEPT = 12;

/** The fields of an exercise that are kept. */
export function summarizeExercise(exercise) {
  if (!exercise || exercise.exerciseId == null || !exercise.name) return null;
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    exerciseId: String(exercise.exerciseId),
    name: String(exercise.name),
    gifUrl: typeof exercise.gifUrl === 'string' ? exercise.gifUrl : '',
    bodyParts: list(exercise.bodyParts),
    equipments: list(exercise.equipments),
    targetMuscles: list(exercise.targetMuscles),
  };
}

/** The list with this exercise at the front (once, never twice) and no more than `max` kept. A thing that is not an exercise changes nothing. */
export function addToRecent(recent, exercise, max = RECENT_EXERCISES_KEPT) {
  const list = Array.isArray(recent) ? recent : [];
  const summary = summarizeExercise(exercise);
  if (!summary) return list;
  return [summary, ...list.filter((e) => e && e.exerciseId !== summary.exerciseId)].slice(0, max);
}

const capitalize = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * The body parts to offer as filters, most common first, from the exercises the phone holds: [{ value, label }]. `value` is what the filter
 * matches on (filterExercises in services/exerciseDbService.js lower-cases both sides), `label` is how it reads on the chip.
 */
export function bodyPartChoices(exercises, max = 8) {
  const counts = new Map();
  for (const ex of exercises || []) {
    for (const bp of Array.isArray(ex?.bodyParts) ? ex.bodyParts : []) {
      if (typeof bp !== 'string' || !bp.trim()) continue;
      const value = bp.trim().toLowerCase();
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([value]) => ({ value, label: capitalize(value) }));
}

/** How many cards the row holds: the first ten as it always was, and up to twenty when the person has searched or chosen something. */
export const BROWSE_DEFAULT_COUNT = 10;
export const BROWSE_FILTERED_COUNT = 20;

/**
 * The exercises for the row. `choice` is 'all', 'recent', or 'bp:<body part>' (what the chips set); `query` is what is typed in the search
 * box and matches the name. Search covers the exercises the phone holds (`exercises`), and Recent only the ones opened.
 * -> { items, total, filtering }: `total` is every match, `items` is as many as the row holds.
 */
export function exercisesToShow({ exercises, recent, query = '', choice = 'all' }) {
  const searching = String(query).trim().length > 0;
  const bodyPart = choice.startsWith('bp:') ? choice.slice(3) : '';
  const source = choice === 'recent' ? recent : exercises;
  const matches = filterExercises(source || [], { query, bodyPart });
  const filtering = searching || choice !== 'all';
  return { items: matches.slice(0, filtering ? BROWSE_FILTERED_COUNT : BROWSE_DEFAULT_COUNT), total: matches.length, filtering };
}

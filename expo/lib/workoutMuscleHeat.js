// lib/workoutMuscleHeat.js
//
// What a workout will work and how hard, for the "Muscles You'll Work" heat figure on a preview screen (the same figure the trail preview
// shows). A strength session's heat comes from its own exercises: every set counts 1 for each muscle the exercise is mainly for and 0.5
// for each muscle that helps (the primary and secondary muscles in data/exerciseLibrary.js; the same two weights lib/sessionPicker.js uses),
// added up over the session and scaled so the most-worked muscle reads 100. A saved workout whose exercise is not in the library falls
// back to the muscles written on the exercise itself, each counted as a main muscle. Running has no such list: it uses the fixed weights
// in lib/muscleFatigue.js, the same ones the trail preview uses for hiking.
//
// The body figure paints ten regions (lib/muscleAnchors.js), the library has seventeen muscles. Lats, upper back, traps and lower back
// all paint as "back"; forearms, adductors, abductors and neck have no region on the figure and are left out. Several library muscles on
// one region count once per exercise (the strongest of them), not added, so a row does not read as twice the back of a squat's quads.

import { findExercise } from './exerciseLibrary';
import { resolveMuscles } from './muscleVocabulary';
import { getTargetMuscles, getTargetMuscleIntensities } from './muscleFatigue';

const FIGURE_REGION = {
  chest: 'chest', shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps',
  lats: 'back', upper_back: 'back', traps: 'back', lower_back: 'back',
  core: 'core', quadriceps: 'quadriceps', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves',
};

const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.5;

// How many sets an exercise has: a number on a program's exercise, a list of sets or a number on a saved workout's; one when it says nothing.
function setCount(exercise) {
  const sets = exercise?.sets;
  if (Array.isArray(sets)) return sets.length > 0 ? sets.length : 1;
  const n = Number(sets);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// { region: weight } for one exercise, each region at the strongest weight any of its muscles has.
function regionWeights(exercise) {
  const byMuscle = {};
  const found = findExercise(exercise?.name);
  if (found) {
    (found.secondary || []).forEach((m) => { byMuscle[m] = SECONDARY_WEIGHT; });
    (found.primary || []).forEach((m) => { byMuscle[m] = PRIMARY_WEIGHT; });
  } else {
    resolveMuscles(exercise?.muscleGroups).forEach((m) => { byMuscle[m] = PRIMARY_WEIGHT; });
  }
  const byRegion = {};
  Object.entries(byMuscle).forEach(([muscle, weight]) => {
    const region = FIGURE_REGION[muscle];
    if (region) byRegion[region] = Math.max(byRegion[region] || 0, weight);
  });
  return byRegion;
}

/**
 * The muscles a list of strength exercises works, hardest first, and how hard (0-100, the most-worked muscle is 100).
 * @param {Array<{name?: string, sets?: number|Array, muscleGroups?: string[]}>} exercises
 * @returns {{ targetMuscles: string[], muscleIntensities: Record<string, number> }}
 */
export function strengthMuscleHeat(exercises) {
  const load = {};
  (Array.isArray(exercises) ? exercises : []).forEach((exercise) => {
    const sets = setCount(exercise);
    Object.entries(regionWeights(exercise)).forEach(([region, weight]) => {
      load[region] = (load[region] || 0) + weight * sets;
    });
  });
  const max = Math.max(0, ...Object.values(load));
  if (max <= 0) return { targetMuscles: [], muscleIntensities: {} };
  const muscleIntensities = {};
  Object.entries(load).forEach(([region, value]) => {
    muscleIntensities[region] = Math.max(1, Math.round((value / max) * 100));
  });
  const targetMuscles = Object.keys(muscleIntensities).sort((a, b) => muscleIntensities[b] - muscleIntensities[a]);
  return { targetMuscles, muscleIntensities };
}

/** What running works, from the fixed weights the trail preview also uses. */
export function runningMuscleHeat() {
  return { targetMuscles: getTargetMuscles('running'), muscleIntensities: getTargetMuscleIntensities('running') };
}

/** Every exercise on every day of a program week (data/workoutPrograms.js getProgramWeek), for a week or the whole-program preview. */
export function weekExercises(week) {
  return (week?.days || []).flatMap((day) => day.exercises || []);
}

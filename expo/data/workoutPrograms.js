// data/workoutPrograms.js
//
// Real training program content for the Workouts tab, following the exact
// same pattern already proven in data/runningPrograms.js: real, structured
// multi-week programs backed by well-established, generic training
// methodologies (full body / upper-lower / push-pull-legs splits, standard
// compound-lift progressive overload) rather than any single named,
// proprietary program - the same reasoning already documented in
// runningPrograms.js for why Couch to 5K's structure is fair to use.
//
// Each program repeats a fixed weekly day structure (the exercises stay
// the same) with sets/reps progressing in three phases across the
// program's length - this is standard progressive overload, not a
// week-by-week rewrite of the exercise list, which keeps this file
// legible while still being a real, followable program.
//
// getFeaturedProgram() below is what actually drives the "reshuffles
// every 8-10 weeks" behavior - see its own comment for how the rotation
// is calculated.

const PROGRESSION_PHASES = [
  { throughWeek: 3, sets: 3, reps: '8-10' },
  { throughWeek: 6, sets: 4, reps: '6-8' },
  { throughWeek: 9, sets: 4, reps: '4-6' },
];

function repsForWeek(weekNumber) {
  const phase = PROGRESSION_PHASES.find((p) => weekNumber <= p.throughWeek) || PROGRESSION_PHASES[PROGRESSION_PHASES.length - 1];
  return { sets: phase.sets, reps: phase.reps };
}

// Builds one day's exercise list with the correct sets/reps for a given
// week, from a compact {name, muscle} list - this is what keeps each
// program's definition short instead of repeating full exercise objects
// nine times over.
function buildDay(dayName, exerciseNames, weekNumber) {
  const { sets, reps } = repsForWeek(weekNumber);
  return {
    day: dayName,
    exercises: exerciseNames.map((name) => ({ name, sets, reps })),
  };
}

function buildWeeks(dayTemplates, totalWeeks) {
  return Array.from({ length: totalWeeks }, (_, i) => {
    const weekNumber = i + 1;
    return {
      week: weekNumber,
      title: weekNumber <= 3 ? 'Building the Habit' : weekNumber <= 6 ? 'Adding Load' : 'Peak Weeks',
      days: dayTemplates.map((t) => buildDay(t.day, t.exercises, weekNumber)),
    };
  });
}

export const WORKOUT_PROGRAMS = [
  {
    id: 'full-body-foundations',
    title: 'Full Body Foundations',
    subtitle: '9 weeks • 3x/week',
    level: 'Beginner',
    description: "A three-day full body split built on standard compound lifts. Ideal if you're new to structured training and want every session to hit your whole body.",
    weeks: buildWeeks([
      { day: 'Day A', exercises: ['Squat', 'Bench Press', 'Bent-Over Row', 'Plank'] },
      { day: 'Day B', exercises: ['Deadlift', 'Overhead Press', 'Lat Pulldown', 'Side Plank'] },
      { day: 'Day C', exercises: ['Goblet Squat', 'Incline Dumbbell Press', 'Seated Cable Row', 'Dead Bug'] },
    ], 9),
  },
  {
    id: 'upper-lower-strength',
    title: 'Upper/Lower Strength',
    subtitle: '9 weeks • 4x/week',
    level: 'Intermediate',
    description: 'A four-day upper/lower split for lifters who already have the basics down and want to add weight to the bar with a higher training frequency.',
    weeks: buildWeeks([
      { day: 'Upper A', exercises: ['Bench Press', 'Bent-Over Row', 'Overhead Press', 'Lat Pulldown', 'Bicep Curl', 'Tricep Pushdown'] },
      { day: 'Lower A', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise'] },
      { day: 'Upper B', exercises: ['Incline Bench Press', 'Seated Cable Row', 'Arnold Press', 'Pull-Up', 'Hammer Curl', 'Overhead Tricep Extension'] },
      { day: 'Lower B', exercises: ['Deadlift', 'Front Squat', 'Walking Lunge', 'Leg Extension', 'Seated Calf Raise'] },
    ], 9),
  },
  {
    id: 'push-pull-legs',
    title: 'Push Pull Legs',
    subtitle: '9 weeks • 6x/week',
    level: 'Advanced',
    description: 'A six-day push/pull/legs split for experienced lifters who can recover from training each muscle group twice a week at high volume.',
    weeks: buildWeeks([
      { day: 'Push', exercises: ['Bench Press', 'Overhead Press', 'Incline Dumbbell Press', 'Lateral Raise', 'Tricep Pushdown', 'Tricep Dip'] },
      { day: 'Pull', exercises: ['Deadlift', 'Pull-Up', 'Bent-Over Row', 'Face Pull', 'Barbell Curl', 'Hammer Curl'] },
      { day: 'Legs', exercises: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Leg Curl', 'Calf Raise', 'Hanging Leg Raise'] },
    ], 9),
  },
];

export function getProgram(programId) {
  return WORKOUT_PROGRAMS.find((p) => p.id === programId) || null;
}

export function getProgramWeek(programId, weekNumber) {
  const program = getProgram(programId);
  return program?.weeks.find((w) => w.week === weekNumber) || null;
}

// Real, new: the rotation itself. A fixed epoch date plus a 9-week
// (63-day) rotation length - the midpoint of the requested 8-10 week
// range - deterministically picks which program is "featured" this
// week, cycling through WORKOUT_PROGRAMS in order. Pure date math, no
// server or stored state needed: every device computes the same
// answer for the same day, and it advances on its own with no manual
// intervention required to keep it rotating.
const ROTATION_EPOCH = new Date('2026-01-05T00:00:00Z'); // a Monday
const ROTATION_LENGTH_DAYS = 63; // 9 weeks

export function getFeaturedProgram(now = new Date()) {
  const msSinceEpoch = now.getTime() - ROTATION_EPOCH.getTime();
  const daysSinceEpoch = Math.floor(msSinceEpoch / (24 * 60 * 60 * 1000));
  const rotationIndex = Math.floor(daysSinceEpoch / ROTATION_LENGTH_DAYS);
  const programIndex = ((rotationIndex % WORKOUT_PROGRAMS.length) + WORKOUT_PROGRAMS.length) % WORKOUT_PROGRAMS.length;
  return WORKOUT_PROGRAMS[programIndex];
}

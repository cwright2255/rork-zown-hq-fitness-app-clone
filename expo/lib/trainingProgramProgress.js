// lib/trainingProgramProgress.js
//
// Where a person is in a Training Program (data/workoutPrograms.js), read from the workouts they have finished. Nothing is kept for this on
// its own: a program day finished all the way is saved with its programId, programWeek and programDay (app/workout/active.jsx), and this
// reads those back. (The saved progress in lib/programProgress.js belongs to the running programs, not to these.)
//
// Only a day finished all the way counts: one saved part-way ("partial", or completed: false) does not. A workout finished before these three
// fields were saved has no way to say which week it was, so progress starts from the update.
//
// The week shown is the furthest week the person has trained in, or the next one when that week is done in full. A day skipped earlier does
// not hold the week back: someone who misses Day B in week 1 and trains in week 2 is in week 2.

/**
 * { started, finished, week, weeks, done, total } for one program. `week` is 0 until a day has been finished; `finished` is every
 * day of every week done.
 */
export function programProgress(program, completedWorkouts) {
  const weeks = Array.isArray(program?.weeks) ? program.weeks : [];
  const dayCount = new Map(weeks.map((w) => [w.week, Array.isArray(w.days) ? w.days.length : 0]));
  const total = [...dayCount.values()].reduce((a, b) => a + b, 0);

  const done = new Set();
  for (const w of completedWorkouts || []) {
    if (!w || w.programId !== program?.id) continue;
    if (w.partial === true || w.completed === false) continue;
    const { programWeek: week, programDay: day } = w;
    if (!Number.isInteger(week) || !Number.isInteger(day)) continue;
    if (day < 0 || day >= (dayCount.get(week) || 0)) continue; // a week or day the program does not have
    done.add(`${week}:${day}`);
  }

  const started = done.size > 0;
  const finished = total > 0 && done.size === total;
  let week = 0;
  if (started) {
    const furthest = Math.max(...[...done].map((k) => Number(k.split(':')[0])));
    const index = weeks.findIndex((w) => w.week === furthest);
    const doneInFurthest = [...done].filter((k) => Number(k.split(':')[0]) === furthest).length;
    const weekIsDone = doneInFurthest === dayCount.get(furthest);
    week = weekIsDone && index < weeks.length - 1 ? weeks[index + 1].week : furthest;
  }
  return { started, finished, week, weeks: weeks.length, done: done.size, total };
}

/** The line for the program's tile: "Week 2 of 9", "Completed", or nothing at all before the first day is finished. */
export function progressLabel(progress) {
  if (!progress || !progress.started) return null;
  if (progress.finished) return 'Completed';
  return `Week ${progress.week} of ${progress.weeks}`;
}

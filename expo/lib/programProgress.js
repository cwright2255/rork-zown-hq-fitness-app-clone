// lib/programProgress.js
//
// Reading a run/walk program's saved progress. The store keeps
// { currentWeek, completedSessionIndexes } where the indexes only describe the
// CURRENT week; when a week is finished the program moves on and the list
// starts again. So a week before currentWeek is done in full, and a week after
// it has not been started.

/** Whether the given session (0-based) of the given week is done. */
export function isSessionDone(progress, weekNumber, sessionIndex) {
  if (!progress || !Number.isFinite(progress.currentWeek) || !Number.isFinite(weekNumber)) return false;
  if (weekNumber < progress.currentWeek) return true;
  if (weekNumber > progress.currentWeek) return false;
  return Array.isArray(progress.completedSessionIndexes) && progress.completedSessionIndexes.includes(sessionIndex);
}

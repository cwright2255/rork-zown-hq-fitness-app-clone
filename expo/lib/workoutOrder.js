// lib/workoutOrder.js
//
// Which of the person's finished workouts is the newest, and the list put in order, newest first.
//
// The workouts list (store/workoutStore.js) comes from two places: the server, which sends it newest first, and the phone, which used to
// add a freshly finished workout at the END. Anything that trims the list by position, or reads "the last one" as the newest, is right
// for one of those and wrong for the other. So nothing here goes by position: a workout is placed by the time it finished.
//
// When a workout finished, in ms: `completedAt` (what the app writes when you finish), then `date` (what the server stamps on the
// record, a Firestore Timestamp), then `timestamp`. The same order lib/activity.js and lib/logWidgetData.js read it in. A record with
// no usable time goes after every record that has one, and keeps its place among the others like it. Pure functions, no stores.

/** When a workout finished, in ms, or NaN when the record carries no usable time. */
export function workoutMs(workout) {
  if (!workout || typeof workout !== 'object') return NaN;
  const raw = workout.completedAt || workout.date || workout.timestamp;
  if (!raw || typeof raw === 'boolean') return NaN;
  if (typeof raw.toDate === 'function') return new Date(raw.toDate()).getTime();
  // A Timestamp that went through the phone's saved storage comes back as plain { seconds, nanoseconds }.
  if (typeof raw.seconds === 'number') return raw.seconds * 1000 + Math.floor((raw.nanoseconds || 0) / 1e6);
  return new Date(raw).getTime();
}

/**
 * A new list, newest first. The list given is not changed. Records with the same time, or none, stay in the order they came in.
 * Anything in the list that is not a record is dropped.
 */
export function newestFirst(workouts) {
  if (!Array.isArray(workouts)) return [];
  return workouts
    .filter((w) => w && typeof w === 'object')
    .map((workout, index) => ({ workout, index, ms: workoutMs(workout) }))
    .sort((a, b) => {
      const aKnown = Number.isFinite(a.ms);
      const bKnown = Number.isFinite(b.ms);
      if (aKnown && bKnown && a.ms !== b.ms) return b.ms - a.ms;
      if (aKnown !== bKnown) return aKnown ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.workout);
}

/**
 * The workout that finished last, or null for an empty list. When no record in the list has a time (only an old or hand-made one
 * can lack it), the last one in the list is taken, the way the app always read it before.
 */
export function newestOf(workouts) {
  if (!Array.isArray(workouts)) return null;
  let best = null;
  let bestMs = NaN;
  for (const workout of workouts) {
    if (!workout || typeof workout !== 'object') continue;
    const ms = workoutMs(workout);
    const known = Number.isFinite(ms);
    const bestKnown = Number.isFinite(bestMs);
    if ((known && !bestKnown) || (known === bestKnown && (!known || ms >= bestMs))) {
      best = workout;
      bestMs = ms;
    }
  }
  return best;
}

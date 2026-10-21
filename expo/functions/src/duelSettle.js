// Duels that run to a date ("most workouts this week", "most calories this week"), settled on the server when the date passes.
//
// Progress is written by onWorkoutComplete (index.js) and nothing else: neither person's phone can read the other's workouts, and
// neither can write progress. A duel that ends the moment someone reaches a target is settled there too. A duel that runs to a date
// has no single workout to settle it on, so this settles it: an hourly function (settleDuels in index.js) finds the active
// "most by deadline" duels whose date has passed and decides each by the progress the server wrote. The phone used to work the
// winner out for itself every time it drew the duel and never recorded it, so the duel stayed "active" for ever. Now it is completed,
// with the winner on it, and the phone shows what the server settled.
//
// A tie settles with no winner (winnerId null, tied true). Nothing is awarded for a win: a duel has never paid XP.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.

/** How many duels one run settles at most; the rest wait for the next run an hour later. */
export const SETTLE_LIMIT = 500;

/** When a duel's date is, in milliseconds, or null when it has none (or none that can be read). */
export function endMs(duel) {
  if (!duel || typeof duel.endDate !== 'string') return null;
  const ms = Date.parse(duel.endDate);
  return Number.isFinite(ms) ? ms : null;
}

/** A duel that runs to a date and that date has come (at the date itself counts as over). */
export function isDue(duel, now) {
  return !!duel && duel.mode === 'most_by_deadline' && duel.status === 'active' && endMs(duel) !== null && endMs(duel) <= now;
}

/** Whether work done now still counts toward a duel: false once a duel that runs to a date has reached it. */
export function countsNow(duel, now) {
  if (!duel || duel.mode !== 'most_by_deadline') return true;
  const end = endMs(duel);
  return end === null || now < end;
}

/** Who won: { winnerId, tied }. The one with more progress wins; equal progress is a tie. */
export function outcomeOf(duel) {
  const ids = Array.isArray(duel && duel.participantIds) ? duel.participantIds : [];
  const progress = (duel && duel.progress && typeof duel.progress === 'object') ? duel.progress : {};
  const score = (id) => (typeof progress[id] === 'number' && Number.isFinite(progress[id]) ? progress[id] : 0);
  if (ids.length !== 2) return { winnerId: null, tied: true };
  const [a, b] = ids;
  if (score(a) === score(b)) return { winnerId: null, tied: true };
  return { winnerId: score(a) > score(b) ? a : b, tied: false };
}

/**
 * Settles every duel whose date has passed.
 * @param {object} args
 *   db     Firestore (firebase-admin)
 *   now    the time in milliseconds
 *   stamp  the time as text, recorded on each settled duel
 * @returns {Promise<{ settled: number, skipped: number }>} skipped: found due but changed by someone else before it could be settled
 */
export async function settleExpiredDuels({ db, now = Date.now(), stamp = new Date(now).toISOString(), limit = SETTLE_LIMIT }) {
  // Two equality filters, so no index is needed; whether the date has passed is checked here. (A range on the date would need one.)
  const snap = await db.collection('duels')
    .where('status', '==', 'active')
    .where('mode', '==', 'most_by_deadline')
    .get();
  let settled = 0;
  let skipped = 0;
  for (const found of snap.docs.filter((d) => isDue(d.data(), now)).slice(0, limit)) {
    const result = await db.runTransaction(async (tx) => {
      // Read again inside the transaction: the duel may have been settled or changed since the list was made.
      const fresh = await tx.get(found.ref);
      const duel = fresh.exists ? fresh.data() : null;
      if (!isDue(duel, now)) return 'skipped';
      const { winnerId, tied } = outcomeOf(duel);
      tx.update(found.ref, { status: 'completed', winnerId, tied, completedAt: stamp, settledBy: 'deadline' });
      return 'settled';
    });
    if (result === 'settled') settled += 1; else skipped += 1;
  }
  return { settled, skipped };
}

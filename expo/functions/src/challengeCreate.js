// Writes the generated challenges so that two people asking at the same moment end up with one set, not two.
//
// Each challenge has a fixed document id for its cadence and period (challengeDocId in challengePeriods.js), and is written with
// create(), which fails with ALREADY_EXISTS when the document is there. The person who is second finds the first one's challenge in
// place and leaves it alone. Each challenge is its own write rather than one batch: a batch would fail whole, and one cadence that
// already exists (a weekly made a moment ago) must not stop the others being written.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.

export const isAlreadyExists = (e) => e?.code === 6 || /ALREADY_EXISTS/.test(String(e?.message || e));

/**
 * @param {object} args
 *   db          Firestore (firebase-admin)
 *   challenges  [{ id, data }]: the document id and the fields to write
 * @returns {Promise<{ created: string[], existing: string[] }>} the ids written by this call, and the ids that were already there
 * @throws the first error that is not "already exists", after every write has been tried
 */
export async function createChallengesOnce({ db, challenges }) {
  const results = await Promise.allSettled(
    challenges.map(({ id, data }) => db.collection('challenges').doc(id).create(data))
  );
  const created = [];
  const existing = [];
  let failure = null;
  results.forEach((r, i) => {
    const { id } = challenges[i];
    if (r.status === 'fulfilled') created.push(id);
    else if (isAlreadyExists(r.reason)) existing.push(id);
    else if (!failure) failure = r.reason;
  });
  if (failure) throw failure;
  return { created, existing };
}

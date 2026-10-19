// Keeps communityGroups/{groupId}.memberCount equal to the people who have joined.
//
// The count used to be written by the app itself, and the rules had to let any signed-in person write it, so anyone could set
// any group's count to anything. Now the app writes only the person's own users/{uid}/groupMemberships/{groupId} document, which
// they can create once and delete, and these functions move the count when that document appears or goes (onGroupJoined and
// onGroupLeft in index.js). The rules let only an admin change a group.
//
// This file holds only the logic. Firestore is passed in so it can be tested without Firebase.
//
// - A group that has no document in Firestore (a group that exists only in the app's built-in list) is left alone. Creating one
//   here would turn it into a half-empty group document, and the app shows only the groups in Firestore once there are any.
// - The count never goes below 0.
// - Each event is applied once. Firebase can deliver the same event twice; a small marker document named after the event id
//   is written in the same transaction as the change, so the second delivery finds it and does nothing.

/**
 * @param {object} args
 *   db        Firestore (firebase-admin)
 *   groupId   the group that was joined or left
 *   delta     1 for a join, -1 for a leave
 *   eventId   the id of the Firestore event (the same for a repeated delivery)
 *   stamp     the value to record as the time of the change (FieldValue.serverTimestamp() in the real function)
 * @returns {Promise<'changed'|'duplicate'|'no-group'|'ignored'>}
 */
export async function changeMemberCount({ db, groupId, delta, eventId, stamp = null }) {
  if (!groupId || !eventId || (delta !== 1 && delta !== -1)) return 'ignored';

  const groupRef = db.doc(`communityGroups/${groupId}`);
  const markerRef = db.doc(`communityGroups/${groupId}/memberCountEvents/${eventId}`);

  return db.runTransaction(async (tx) => {
    const marker = await tx.get(markerRef);
    if (marker.exists) return 'duplicate';
    const group = await tx.get(groupRef);
    if (!group.exists) return 'no-group';

    const current = Number(group.data()?.memberCount);
    const next = Math.max(0, (Number.isFinite(current) ? current : 0) + delta);
    tx.update(groupRef, { memberCount: next });
    tx.set(markerRef, { delta, at: stamp });
    return 'changed';
  });
}

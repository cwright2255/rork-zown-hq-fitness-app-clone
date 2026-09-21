import { db } from '../src/config/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

// Real, new: a current/active fast (start time + target hours), not a
// growing history log - same "single document under users/{uid}/data"
// pattern store/homeWidgetsStore.js already uses for exactly this kind
// of per-user current-state data. Already covered by the existing
// users/{userId}/data/{docId} Firestore rule, so this needs no new rule.
export async function getActiveFast(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid, 'data', 'fasting'));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!data?.startedAt) return null;
  return {
    startedAt: data.startedAt.toDate ? data.startedAt.toDate() : new Date(data.startedAt),
    targetHours: data.targetHours || 16,
  };
}

export async function startFast(uid, targetHours = 16) {
  if (!uid) return;
  await setDoc(doc(db, 'users', uid, 'data', 'fasting'), {
    startedAt: new Date(),
    targetHours,
  });
}

export async function endFast(uid) {
  if (!uid) return;
  await deleteDoc(doc(db, 'users', uid, 'data', 'fasting'));
}

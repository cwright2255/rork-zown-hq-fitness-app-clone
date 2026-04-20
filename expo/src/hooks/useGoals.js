import { useCallback, useEffect } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { useGoalStore } from '../stores/goalStore';

const GOALS = 'goals';

function toGoal(id, data) {
  return {
    id,
    userId: data.userId,
    type: data.type['type'],
    title: data.title,
    target: (data.target) ?? 0,
    current: (data.current) ?? 0,
    unit: (data.unit) ?? '',
    deadline: (data.deadline as { toDate?: () => Date })?.toDate?.(),
    completed: (data.completed) ?? false,
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
  };
}

export function useGoals() {
  const user = useAuthStore((s) => s.user);
  const { goals, isLoading, error, setGoals, setLoading, setError } =
    useGoalStore();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, GOALS),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setGoals(snap.docs.map((d) => toGoal(d.id, d.data()))),
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [user, setGoals, setLoading, setError]);

  const addGoal = useCallback(
    async (goal) => {
      if (!user) throw new Error('Not authenticated');
      const ref = await addDoc(collection(db, GOALS), {
        ...goal,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user],
  );

  const updateGoal = useCallback(async (id, patch) => {
    await updateDoc(doc(db, GOALS, id), { ...patch });
  }, []);

  const deleteGoal = useCallback(async (id) => {
    await deleteDoc(doc(db, GOALS, id));
  }, []);

  return { goals, isLoading, error, addGoal, updateGoal, deleteGoal };
}

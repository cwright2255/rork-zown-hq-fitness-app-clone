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
import type { Goal } from '../types/firestore';

const GOALS = 'goals';

function toGoal(id: string, data: Record<string, unknown>): Goal {
  return {
    id,
    userId: data.userId as string,
    type: data.type as Goal['type'],
    title: data.title as string,
    target: (data.target as number) ?? 0,
    current: (data.current as number) ?? 0,
    unit: (data.unit as string) ?? '',
    deadline: (data.deadline as { toDate?: () => Date })?.toDate?.(),
    completed: (data.completed as boolean) ?? false,
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
    async (goal: Omit<Goal, 'id' | 'createdAt' | 'userId'>) => {
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

  const updateGoal = useCallback(async (id: string, patch: Partial<Goal>) => {
    await updateDoc(doc(db, GOALS, id), { ...patch });
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await deleteDoc(doc(db, GOALS, id));
  }, []);

  return { goals, isLoading, error, addGoal, updateGoal, deleteGoal };
}

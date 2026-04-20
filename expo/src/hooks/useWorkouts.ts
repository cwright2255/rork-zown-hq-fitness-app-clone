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
import { useWorkoutStore } from '../stores/workoutStore';
import type { Workout } from '../types/firestore';

const WORKOUTS = 'workouts';

function toWorkout(id: string, data: Record<string, unknown>): Workout {
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    description: data.description as string | undefined,
    exercises: (data.exercises as Workout['exercises']) ?? [],
    duration: (data.duration as number) ?? 0,
    calories: data.calories as number | undefined,
    date: (data.date as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    notes: data.notes as string | undefined,
    aiGenerated: (data.aiGenerated as boolean) ?? false,
    completed: (data.completed as boolean) ?? false,
    completedAt: (data.completedAt as { toDate?: () => Date })?.toDate?.(),
  };
}

export function useWorkouts() {
  const user = useAuthStore((s) => s.user);
  const {
    workouts,
    isLoading,
    error,
    setWorkouts,
    setLoading,
    setError,
  } = useWorkoutStore();

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(
      collection(db, WORKOUTS),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => toWorkout(d.id, d.data()));
        setWorkouts(list);
      },
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [user, setWorkouts, setLoading, setError]);

  const addWorkout = useCallback(
    async (workout: Omit<Workout, 'id'>) => {
      if (!user) throw new Error('Not authenticated');
      const ref = await addDoc(collection(db, WORKOUTS), {
        ...workout,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user],
  );

  const updateWorkout = useCallback(
    async (id: string, patch: Partial<Workout>) => {
      await updateDoc(doc(db, WORKOUTS, id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    [],
  );

  const deleteWorkout = useCallback(async (id: string) => {
    await deleteDoc(doc(db, WORKOUTS, id));
  }, []);

  const completeWorkout = useCallback(
    async (id: string) => {
      await updateWorkout(id, {
        completed: true,
        completedAt: new Date(),
      });
    },
    [updateWorkout],
  );

  return {
    workouts,
    isLoading,
    error,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    completeWorkout,
  };
}

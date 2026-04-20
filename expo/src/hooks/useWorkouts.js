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

const WORKOUTS = 'workouts';

function toWorkout(id, data) {
  return {
    id,
    userId: data.userId,
    name: data.name,
    description: data.description | undefined,
    exercises: (data.exercises['exercises']) ?? [],
    duration: (data.duration) ?? 0,
    calories: data.calories | undefined,
    date: (data.date as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    notes: data.notes | undefined,
    aiGenerated: (data.aiGenerated) ?? false,
    completed: (data.completed) ?? false,
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
    async (workout) => {
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
    async (id, patch) => {
      await updateDoc(doc(db, WORKOUTS, id), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
    },
    [],
  );

  const deleteWorkout = useCallback(async (id) => {
    await deleteDoc(doc(db, WORKOUTS, id));
  }, []);

  const completeWorkout = useCallback(
    async (id) => {
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

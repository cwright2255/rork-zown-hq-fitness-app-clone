import { useCallback, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where } from
'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { useAIStore } from '../stores/aiStore';

















function toRec(id, data) {
  return {
    id,
    userId: data.userId,
    type: data.type['type'],
    content: data.content ?? '',
    structuredData: data.structuredData | undefined,
    prompt: data.prompt ?? '',
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    isRead: data.isRead ?? false
  };
}

export function useAICoach() {
  const user = useAuthStore((s) => s.user);
  const {
    recommendations,
    isGenerating,
    isLoading,
    error,
    setRecommendations,
    setGenerating,
    setError
  } = useAIStore();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'aiRecommendations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRecommendations(snap.docs.map((d) => toRec(d.id, d.data()))),
      (err) => setError(err.message)
    );
    return () => unsub();
  }, [user, setRecommendations, setError]);

  const generateWorkoutPlan = useCallback(
    async (input) => {
      setGenerating(true);
      try {
        const fn = httpsCallable(
          functions,
          'generateWorkoutPlan'
        );
        const res = await fn(input);
        return res.data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate plan');
        throw err;
      } finally {
        setGenerating(false);
      }
    },
    [setGenerating, setError]
  );

  const getProgressSummary = useCallback(
    async (input) => {
      setGenerating(true);
      try {
        const fn = httpsCallable(
          functions,
          'getProgressSummary'
        );
        const res = await fn(input);
        return res.data;
      } finally {
        setGenerating(false);
      }
    },
    [setGenerating]
  );

  const getNutritionRecommendations = useCallback(
    async (input) => {
      setGenerating(true);
      try {
        const fn = httpsCallable(
          functions,
          'getNutritionRecommendations'
        );
        const res = await fn(input);
        return res.data;
      } finally {
        setGenerating(false);
      }
    },
    [setGenerating]
  );

  return {
    recommendations,
    isGenerating,
    isLoading,
    error,
    generateWorkoutPlan,
    getProgressSummary,
    getNutritionRecommendations
  };
}
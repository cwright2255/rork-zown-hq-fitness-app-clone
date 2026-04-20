import { useCallback, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';
import { useAIStore } from '../stores/aiStore';
import type { AIRecommendation, FitnessLevel, GoalType } from '../types/firestore';

interface WorkoutPlanInput {
  fitnessLevel: FitnessLevel;
  goals: GoalType[];
  history?: Array<{ name: string; date: string; duration: number }>;
}

interface ProgressSummaryInput {
  userId: string;
  dateRange: { start: string; end: string };
}

interface NutritionInput {
  recentWorkouts: Array<{ name: string; calories?: number; duration: number }>;
  goals: GoalType[];
}

function toRec(id: string, data: Record<string, unknown>): AIRecommendation {
  return {
    id,
    userId: data.userId as string,
    type: data.type as AIRecommendation['type'],
    content: (data.content as string) ?? '',
    structuredData: data.structuredData as Record<string, unknown> | undefined,
    prompt: (data.prompt as string) ?? '',
    createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    isRead: (data.isRead as boolean) ?? false,
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
    setError,
  } = useAIStore();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'aiRecommendations'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRecommendations(snap.docs.map((d) => toRec(d.id, d.data()))),
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [user, setRecommendations, setError]);

  const generateWorkoutPlan = useCallback(
    async (input: WorkoutPlanInput) => {
      setGenerating(true);
      try {
        const fn = httpsCallable<WorkoutPlanInput, { recommendationId: string }>(
          functions,
          'generateWorkoutPlan',
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
    [setGenerating, setError],
  );

  const getProgressSummary = useCallback(
    async (input: ProgressSummaryInput) => {
      setGenerating(true);
      try {
        const fn = httpsCallable<ProgressSummaryInput, { recommendationId: string }>(
          functions,
          'getProgressSummary',
        );
        const res = await fn(input);
        return res.data;
      } finally {
        setGenerating(false);
      }
    },
    [setGenerating],
  );

  const getNutritionRecommendations = useCallback(
    async (input: NutritionInput) => {
      setGenerating(true);
      try {
        const fn = httpsCallable<NutritionInput, { recommendationId: string }>(
          functions,
          'getNutritionRecommendations',
        );
        const res = await fn(input);
        return res.data;
      } finally {
        setGenerating(false);
      }
    },
    [setGenerating],
  );

  return {
    recommendations,
    isGenerating,
    isLoading,
    error,
    generateWorkoutPlan,
    getProgressSummary,
    getNutritionRecommendations,
  };
}

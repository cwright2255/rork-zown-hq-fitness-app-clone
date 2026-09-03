// app/workout/quick.jsx
//
// Replaces the old "Create Workout" manual-form entry points with a
// real, fast AI-generation flow: fitness level is already known from
// the real profile (store/userStore.js), so the only real input still
// needed is goals - a quick, pre-selected chip picker (defaults to
// whatever's already saved on the profile from app/profile/edit.jsx,
// so this is a fast confirm/adjust step, not a blank slate every time).
//
// Calls the real, already-existing generateNewWorkoutRecommendation
// (store/workoutStore.js), which itself calls the real generateWorkoutPlan
// Cloud Function (functions/src/index.js) - a genuine GPT-4o call using
// real fitnessLevel/goals/history, not a canned response. Takes day 1 of
// the real generated 7-day plan, saves it as a real workout via the
// already-proven addWorkout (confirmed Firestore-persisted earlier this
// session), then routes to the existing, already-working workout detail
// screen (app/workout/[id].jsx) - which already has real Start/track
// functionality, so there's no need to build a second, separate preview
// screen from scratch.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { useWorkoutStore } from '@/store/workoutStore';

const GOALS = ['weight_loss', 'build_muscle', 'increase_strength', 'improve_endurance', 'improve_flexibility', 'general_fitness'];
const GOAL_LABELS = {
  weight_loss: 'Weight Loss', build_muscle: 'Build Muscle', increase_strength: 'Increase Strength',
  improve_endurance: 'Improve Endurance', improve_flexibility: 'Improve Flexibility', general_fitness: 'General Fitness',
};

// Real estimate from the actual generated exercise data (sets and
// restSeconds), not a placeholder. 30s/set is a reasonable stand-in for
// active work time since the AI plan only gives reps, not a timed
// duration, per set - same limitation formatExerciseDuration() in
// app/workout/[id].jsx already works around on the display side.
const WORK_SECONDS_PER_SET = 30;
function estimateDurationMinutes(exercises) {
  const totalSeconds = exercises.reduce((sum, ex) => {
    const sets = ex.sets || 1;
    const rest = ex.restSeconds || 60;
    return sum + sets * (WORK_SECONDS_PER_SET + rest);
  }, 0);
  return Math.max(5, Math.round(totalSeconds / 60));
}

// Same formula as app/workout/create.jsx's calculateXpReward, duplicated
// locally rather than imported since create.jsx doesn't export it - kept
// identical on purpose so a Quick Workout and a manually-built workout of
// the same difficulty/duration earn the same XP.
function calculateXpReward(difficulty, durationMinutes) {
  const baseXp = 50;
  const mult = difficulty === 'beginner' ? 1 : difficulty === 'intermediate' ? 1.5 : difficulty === 'advanced' ? 2 : 1;
  return Math.round(baseXp * mult * Math.ceil(durationMinutes / 15));
}

export default function QuickWorkoutScreen() {
  const router = useRouter();
  const { user } = useUserStore();
  const [goals, setGoals] = useState(user?.goals || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const toggleGoal = (goal) => {
    setGoals((prev) => prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]);
  };

  const handleGenerate = async () => {
    if (!user?.uid) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await useWorkoutStore.getState().generateNewWorkoutRecommendation({
        uid: user.uid,
        fitnessLevel: user.fitnessLevel || 'intermediate',
        goals,
      });

      // Real fix: functions/src/index.js's generateWorkoutPlan returns
      // { recommendationId, plan: structured } - the actual days array
      // is nested under plan, not at the top level. The defensive check
      // below correctly caught this exact mismatch on first real test
      // rather than silently using garbage data.
      const day = result?.plan?.days?.[0];
      if (!day || !Array.isArray(day.exercises) || day.exercises.length === 0) {
        throw new Error('Generated plan was empty or malformed.');
      }

      const difficulty = user.fitnessLevel || 'intermediate';
      const duration = estimateDurationMinutes(day.exercises);
      const primaryGoalLabel = GOAL_LABELS[goals[0]] || 'General Fitness';

      const workout = {
        name: day.focus || 'Quick Workout',
        description: `AI-generated ${duration}-minute workout focused on ${primaryGoalLabel.toLowerCase()}, built for your ${difficulty} fitness level.`,
        category: primaryGoalLabel,
        difficulty,
        duration,
        xpReward: calculateXpReward(difficulty, duration),
        exercises: day.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds,
        })),
        source: 'ai_quick_workout',
      };

      const saved = await useWorkoutStore.getState().addWorkout(workout, user.uid);
      router.replace(`/workout/${saved.id}`);
    } catch (e) {
      console.error('[QuickWorkout] generation failed:', e?.message);
      setError("Couldn't generate a workout right now. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Quick Workout" showBack variant="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          We'll build a real workout for you right now, based on your fitness level
          ({(user?.fitnessLevel || 'intermediate').charAt(0).toUpperCase() + (user?.fitnessLevel || 'intermediate').slice(1)})
          and whichever goals you pick below.
        </Text>

        <Text style={styles.label}>Goals</Text>
        <View style={styles.chipRow}>
          {GOALS.map((g) => {
            const active = goals.includes(g);
            return (
              <Pressable key={g} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleGoal(g)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{GOAL_LABELS[g]}</Text>
              </Pressable>
            );
          })}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.bottomBar}>
        {isGenerating ? (
          <View style={styles.generatingRow}>
            <ActivityIndicator color="#FFF" />
            <Text style={styles.generatingText}>Building your workout...</Text>
          </View>
        ) : (
          <PrimaryButton title="Generate Workout" onPress={handleGenerate} disabled={goals.length === 0} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 140 },
  intro: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0F0F0' },
  chipActive: { backgroundColor: '#000' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#333' },
  chipTextActive: { color: '#FFF' },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 20 },
  bottomBar: { position: 'absolute', left: 20, right: 20, bottom: 24 },
  generatingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, borderRadius: 26, backgroundColor: '#000',
  },
  generatingText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

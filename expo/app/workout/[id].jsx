import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { useExerciseStore } from '@/store/exerciseStore';
import { fetchExerciseById } from '@/services/exerciseDbService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const exercises = useExerciseStore((s) => s.exercises);

  const [exercise, setExercise] = useState(() => exercises.find((e) => e.exerciseId === id) || null);
  const [isLoading, setIsLoading] = useState(!exercise);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (exercise) return;
    const found = exercises.find((e) => e.exerciseId === id);
    if (found) {
      setExercise(found);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await fetchExerciseById(id);
        if (!cancelled) {
          setExercise(data);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load exercise');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.loadingText}>Loading exercise…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!exercise) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingWrap}>
          <Text style={styles.errorText}>{error || 'Exercise not found'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.backBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tags = [
    ...((exercise.targetMuscles || [])),
    ...((exercise.equipments || [])),
  ];
  const secondary = (exercise.secondaryMuscles || []).join(', ');
  const instructions = Array.isArray(exercise.instructions) ? exercise.instructions : [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.imageWrap}>
          {exercise.gifUrl ? (
            <Image source={{ uri: exercise.gifUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          <TouchableOpacity style={styles.backBubble} onPress={() => router.back()} activeOpacity={0.85}>
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{exercise.name}</Text>

          <View style={styles.tagRow}>
            {tags.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>

          {!!secondary && (
            <Text style={styles.secondary}>Secondary: {secondary}</Text>
          )}

          {instructions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>INSTRUCTIONS</Text>
              {instructions.map((step, idx) => (
                <View key={idx} style={styles.stepCard}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{String(step).replace(/^Step:\d+\s*/i, '')}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  loadingText: { ...typography.caption },
  errorText: { ...typography.body, color: colors.text, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: colors.text,
  },
  backBtnText: { color: colors.bg, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 300, backgroundColor: colors.surface },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  backBubble: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { padding: spacing.lg },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'capitalize' },
  secondary: { ...typography.caption, marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: colors.bg, fontWeight: '900', fontSize: 13 },
  stepText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
});

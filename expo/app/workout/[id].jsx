import React, { useEffect, useState } from 'react';
import {
import { tokens } from '../../../theme/tokens';
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
import { useExerciseStore } from '@/store/exerciseStore';
import { fetchExerciseById } from '@/services/exerciseDbService';
import {
  getWorkoutVisualizeUrl,
  normalizeMuscleNames,
} from '@/services/muscleVisualizerService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const COLOR_BG = tokens.colors.grayscale.black;
const COLOR_SURFACE = tokens.colors.ink.darker;
const COLOR_CARD = tokens.colors.ink.darker;
const COLOR_BORDER = tokens.colors.legacy.darkSurface;
const COLOR_TEXT = tokens.colors.background.default;
const COLOR_TEXT_SECONDARY = tokens.colors.sky.dark;
const COLOR_TARGET = tokens.colors.legacy.legacy_e74c3c;
const COLOR_SECONDARY = tokens.colors.legacy.legacy_f39c12;

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const router = useRouter();
  const exercises = useExerciseStore((s) => s.exercises);

  const [exercise, setExercise] = useState(() => exercises.find((e) => e.exerciseId === id) || null);
  const [isLoading, setIsLoading] = useState(!exercise);
  const [error, setError] = useState(null);
  const [topImageError, setTopImageError] = useState(false);
  const [vizError, setVizError] = useState(false);

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
          <ActivityIndicator color={COLOR_TEXT} />
          <Text style={styles.loadingText}>Loading exerciseÃ¢ÂÂ¦</Text>
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

  const topImageUri = !topImageError ? (exercise.imageUrl || exercise.gifUrl || null) : null;
  const targetMusclesRaw = Array.isArray(exercise.targetMuscles) ? exercise.targetMuscles : [];
  const secondaryMusclesRaw = Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : [];
  const targetMuscles = normalizeMuscleNames(targetMusclesRaw);
  const secondaryMuscles = normalizeMuscleNames(secondaryMusclesRaw);

  const vizUrl = getWorkoutVisualizeUrl({ targetMuscles, secondaryMuscles });
  const equipments = Array.isArray(exercise.equipments) ? exercise.equipments : [];
  const instructions = Array.isArray(exercise.instructions) ? exercise.instructions : [];
  const tips = Array.isArray(exercise.exerciseTips) ? exercise.exerciseTips : [];
  const variations = Array.isArray(exercise.variations) ? exercise.variations : [];
  const relatedExercises = Array.isArray(exercise.relatedExerciseIds) ? exercise.relatedExerciseIds : [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.imageWrap}>
          {topImageUri ? (
            <Image
              source={{ uri: topImageUri }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setTopImageError(true)}
            />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          <TouchableOpacity style={styles.backBubble} onPress={() => router.back()} activeOpacity={0.85}>
            <ChevronLeft size={22} color={COLOR_TEXT} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{exercise.name}</Text>

          {!!exercise.exerciseType && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{String(exercise.exerciseType).toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.sectionHeader}>Muscles Worked</Text>
          {vizUrl && !vizError ? (
            <Image
              source={{ uri: vizUrl }}
              style={styles.vizImage}
              resizeMode="contain"
              onError={() => setVizError(true)}
            />
          ) : (
            <View style={styles.muscleTagRow}>
              {targetMusclesRaw.map((m, i) => (
                <View key={`t-${m}-${i}`} style={[styles.muscleTag, { backgroundColor: COLOR_TARGET }]}>
                  <Text style={styles.muscleTagText}>{m}</Text>
                </View>
              ))}
              {secondaryMusclesRaw.map((m, i) => (
                <View key={`s-${m}-${i}`} style={[styles.muscleTag, { backgroundColor: COLOR_SECONDARY }]}>
                  <Text style={styles.muscleTagText}>{m}</Text>
                </View>
              ))}
              {targetMusclesRaw.length === 0 && secondaryMusclesRaw.length === 0 && (
                <Text style={styles.secondaryText}>No muscle data available</Text>
              )}
            </View>
          )}

          {equipments.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Equipment</Text>
              <View style={styles.tagRow}>
                {equipments.map((e, i) => (
                  <View key={`${e}-${i}`} style={styles.equipTag}>
                    <Text style={styles.equipTagText}>{e}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {instructions.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Instructions</Text>
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

          {tips.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Tips</Text>
              {tips.map((tip, idx) => (
                <View key={`tip-${idx}`} style={styles.stepCard}>
                  <Text style={styles.stepText}>{String(tip)}</Text>
                </View>
              ))}
            </>
          )}

          {variations.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Variations</Text>
              <View style={styles.tagRow}>
                {variations.map((v, i) => (
                  <View key={`var-${i}`} style={styles.equipTag}>
                    <Text style={styles.equipTagText}>{String(v)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {relatedExercises.length > 0 && (
            <>
              <Text style={styles.sectionHeader}>Related Exercises</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.tagRow}>
                  {relatedExercises.map((r, i) => (
                    <View key={`rel-${i}`} style={styles.equipTag}>
                      <Text style={styles.equipTagText}>{String(r)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR_BG },
  scroll: { paddingBottom: 48 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: COLOR_BG,
  },
  loadingText: { color: COLOR_TEXT_SECONDARY, fontSize: 13 },
  errorText: { color: COLOR_TEXT, fontSize: 14, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: COLOR_TEXT,
  },
  backBtnText: { color: COLOR_BG, fontWeight: '900', letterSpacing: 1.5, fontSize: 12 },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 280, backgroundColor: COLOR_SURFACE },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  backBubble: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLOR_BORDER,
  },
  content: { padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: COLOR_TEXT,
    marginBottom: 12,
    textTransform: 'capitalize',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLOR_TEXT,
    marginBottom: 16,
  },
  typeBadgeText: {
    color: COLOR_BG,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sectionHeader: {
    color: COLOR_TEXT,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  vizImage: {
    width: '100%',
    height: 200,
    backgroundColor: COLOR_SURFACE,
    borderRadius: 12,
    marginBottom: 8,
  },
  muscleTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  muscleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  muscleTagText: { color: tokens.colors.background.default, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  secondaryText: { color: COLOR_TEXT_SECONDARY, fontSize: 13 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  equipTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLOR_CARD,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
  },
  equipTagText: { color: COLOR_TEXT_SECONDARY, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: COLOR_CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR_BORDER,
    padding: 14,
    marginBottom: 8,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: COLOR_TEXT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: COLOR_BG, fontWeight: '900', fontSize: 13 },
  stepText: { flex: 1, color: COLOR_TEXT, fontSize: 14, lineHeight: 20 },
});
